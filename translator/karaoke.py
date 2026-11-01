"""קריוקי משיר רגיל (26/10/2026) — השלבים הכבדים, בסביבת vt (job.py karaoke מפעיל כל שלב בנפרד, כמו rerender.py).

  sep    — הפרדת קול וליווי (audio-separator, מודלים ברישיון פתוח בלבד — החלטת המשתמש): voc.wav, inst.wav,
           ובמצב "עם קולות רקע" גם inst_bv.wav (מודל karaoke: הקול הראשי מול כל השאר).
  lyrics — 01/11/2026: אין מילים → טיוטה מתמלול הקול המופרד (עברית ivrit / אנגלית Parakeet) → lyrics.txt.
  align  — המילים שהודבקו → words.json. שיר עברי (31/10/2026, vt/align_he.py): ivrit + stable-ts + CTC עברי; אחרת עיגון
           לתמלול של הקול המופרד (Parakeet) → יישור Qwen לכל מילה. בלי סימון זמרים במילים — זיהוי הזמרים מהקול (sg).
  build  — words.json → karaoke.ass (מצב לכל מילה), ‏.lrc, ‏.elrc.lrc.
  video  — רקע לשיר בלי וידאו (צבע אחיד + שם השיר), באורך השיר.
  burn   — הצריבה (אותה צריבה של vt: ציור מראש + overlay).
  mix    — הליווי + הקול המנחה ב־X% (0 = בלי) → AAC, וחיבור לסרטון הצרוב (הווידאו מועתק).

כל טקסט מהמשתמש (המילים, השם) נכנס רק לקבצים — אף פעם לא לפקודה. רשימות ארגומנטים בלי shell.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

# המודלים: רק מה שהרישיון שלו פתוח (MIT / Apache / GPL) — 26/10/2026, החלטת המשתמש. בתמונת העובד (שלב separator
# ב־infra/worker/Dockerfile): MelBand RoFormer של Kim לקול/ליווי, BS RoFormer karaoke של anvuew לקולות הרקע.
# SNB_KA_SEP / SNB_KA_KAR גוברים (לבדיקות ולהשוואה).
SEP_DEFAULT = os.environ.get('SNB_KA_SEP') or 'vocals_mel_band_roformer.ckpt'
KAR_DEFAULT = os.environ.get('SNB_KA_KAR') or 'bs_roformer_karaoke_anvuew.ckpt'
MODEL_DIR = os.environ.get('SNB_KA_MODELS') or '/opt/separator'
# שניות חישוב לשניית שיר במעבר אחד, 4 ליבות (נמדד 31/10/2026) — רק היחס ביניהם חשוב (משקל בפס ההתקדמות)
PASS_W = {'vocals_mel_band_roformer.ckpt': 2.75, 'bs_roformer_karaoke_anvuew.ckpt': 3.6}
# נקבעו במדידה (31/10/2026, docs/studio-karaoke-he.md "מהירות ההפרדה"): overlap 1 = אותה איכות (±0.1 dB), פי ~1.9 מהר;
# מעבר אחד של karaoke על השיר = אותו ליווי ואותו קול ראשי כמו Kim ואחריו karaoke (±0.05 dB), בלי המעבר של Kim
OV_DEFAULT = 1
BV1_DEFAULT = True
# audio-separator מותקן בנפרד מ־/opt/vt (requirements-karaoke.lock) — בסוף הנתיב, כך שהספריות של העובד גוברות
SEP_DEPS = os.environ.get('SNB_KA_DEPS') or '/opt/sepdeps'
if os.path.isdir(SEP_DEPS) and SEP_DEPS not in sys.path:
    sys.path.append(SEP_DEPS)


def sep_overlap() -> int:
    """31/10/2026: overlap = כמה פעמים כל קטע של 8 שנ׳ עובר במודל (הזמן ליניארי בו). SNB_KA_OV גובר (1–4)."""
    v = os.environ.get('SNB_KA_OV', '')
    return int(v) if v in ('1', '2', '3', '4') else OV_DEFAULT


def bv_one_pass() -> bool:
    """31/10/2026: "עם קולות רקע" במעבר אחד — מודל ה־karaoke ישר על השיר (קול ראשי מול כל השאר) במקום Kim ואחריו
    karaoke על הקול. SNB_KA_BV1=1/0 גובר."""
    v = os.environ.get('SNB_KA_BV1', '')
    return v == '1' if v in ('0', '1') else BV1_DEFAULT


def sep_ready(model: str = '') -> bool:
    """המודל (וקובץ ההגדרות שלו) בתיקיית המודלים — בלי רשת. אחרת audio-separator היה מוריד אותו בזמן העבודה."""
    m = Path(MODEL_DIR) / (model or SEP_DEFAULT)
    return m.is_file() and (Path(MODEL_DIR) / 'download_checks.json').is_file()


def autocast_ok(flags: str = '') -> bool:
    """31/10/2026 (הצילום: כ־25 דק׳ הפרדה לשיר של 4 דק׳): autocast במעבד = bfloat16. מעבד בלי bf16 בחומרה
    (avx512_bf16 / amx_bf16) מדמה אותו — לא מהיר יותר מ־fp32, ולרוב איטי יותר. SNB_KA_AUTOCAST=1/0 גובר (להשוואה)."""
    env = os.environ.get('SNB_KA_AUTOCAST', '')
    if env in ('0', '1'):
        return env == '1'
    if not flags:
        try:
            flags = Path('/proc/cpuinfo').read_text(encoding='utf-8', errors='replace')
        except OSError:
            return False
    return ' avx512_bf16' in flags or ' amx_bf16' in flags


def _pick(files, *keys):
    for f in files:
        n = Path(f).name.lower()
        if any(k in n for k in keys):
            return Path(f)
    return None


def relevel(src: Path, a: Path, b: Path) -> list:
    """01/11/2026: audio-separator מנרמל את הקלט ואת כל פלט לחוד לשיא 0.9 — הליווי יצא שקט מהשיר (נמדד ב"ממותה":
    ‎-2.6 dB אחיד בקטעי הנגינה, נשמע כאילו "הוסרו כלים"). מחזירים את שני הפלטים לרמת המקור: src ≈ ga·a + gb·b
    (ריבועים פחותים), ושומרים ב־float — כדי ששיא מעל 1 (פענוח opus/aac) לא ייחתך."""
    import numpy as np
    import soundfile as sf
    s = sf.read(str(src), dtype='float32', always_2d=True)[0]
    A, sr = sf.read(str(a), dtype='float32', always_2d=True)
    B = sf.read(str(b), dtype='float32', always_2d=True)[0]
    n = min(len(s), len(A), len(B))
    if n < sr:
        return [1.0, 1.0]
    x, y, z = (v[:n].astype('float64').ravel() for v in (A, B, s))
    M = np.array([[x @ x, x @ y], [x @ y, y @ y]])
    g = np.linalg.solve(M, [x @ z, y @ z]) if abs(np.linalg.det(M)) > 1e-9 * (M[0, 0] * M[1, 1] + 1e-12) else np.ones(2)
    g = [float(v) if 0.25 < v < 4 else 1.0 for v in g]           # שומר מפני התאמה משובשת (שקט, הפוך מופע)
    sf.write(str(a), A * g[0], sr, subtype='FLOAT')
    sf.write(str(b), B * g[1], sr, subtype='FLOAT')
    return [round(v, 3) for v in g]


def separate(src: Path, out: Path, model: str, prefix: str) -> dict:
    """מודל אחד → שני קבצים (קול / ליווי). audio-separator מחליט על הפורמט לפי המודל."""
    from audio_separator.separator import Separator
    tmp = out / ('_' + prefix)
    tmp.mkdir(parents=True, exist_ok=True)
    t0, ac = time.time(), autocast_ok()
    sep = Separator(output_dir=str(tmp), model_file_dir=MODEL_DIR, output_format='WAV', use_autocast=ac,
                    mdxc_params={'overlap': sep_overlap(), 'segment_size': 256, 'batch_size': 1, 'pitch_shift': 0})
    sep.load_model(model_filename=model)
    files = sep.separate(str(src))
    files = [tmp / Path(f).name if not Path(f).is_absolute() else Path(f) for f in files]
    voc = _pick(files, '(vocals)', '(vocal)', '(lead')
    inst = _pick(files, '(instrumental)', '(no_vocals)', '(other)', '(backing') or next((f for f in files if f != voc), None)
    if not voc or not inst:
        raise SystemExit('✗ ההפרדה לא החזירה קול וליווי.')
    shutil.move(str(voc), out / (prefix + '_voc.wav'))
    shutil.move(str(inst), out / (prefix + '_inst.wav'))
    shutil.rmtree(tmp, ignore_errors=True)
    g = relevel(src, out / (prefix + '_voc.wav'), out / (prefix + '_inst.wav'))
    sec = round(time.time() - t0, 1)
    print(f'⏱ {model}: {sec} שנ׳ (autocast={int(ac)}, overlap={sep_overlap()}, ליבות={os.cpu_count()}, רמה={g})', flush=True)   # המדידה — ביומן העבודה
    return {'model': model, 'sec': sec, 'ac': int(ac), 'ov': sep_overlap(), 'g': g}


def cmd_sep(a):
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    km = a.kmodel or KAR_DEFAULT
    one = bool(a.backing and km and bv_one_pass() and sep_ready(km))
    # 31/10/2026: המעברים ומשקלם (זמן נמדד לשנייה) — job.py (KaSepProg) מחבר את האחוזים של כל מעבר לפס אחד.
    # עד אז כל מעבר דיווח 0–100%, והטלפון (שמציג את המקסימום) הראה פס מלא לאורך כל המעבר השני
    ws = [PASS_W.get(km, 1.0)] if one else [PASS_W.get(a.model or SEP_DEFAULT, 1.0)] + ([PASS_W.get(km, 1.0)] if a.backing and km else [])
    print('⏩ מעברים: ' + ','.join(f'{w:.2f}' for w in ws), flush=True)
    if one:
        # מעבר אחד: הקול הראשי (ליישור ולקול המנחה) מול הליווי + קולות הרקע
        st = separate(Path(a.src), out, km, 'k')
        os.replace(out / 'k_voc.wav', out / 'voc.wav')
        shutil.copyfile(out / 'voc.wav', out / 'lead.wav')
        os.replace(out / 'k_inst.wav', out / 'inst_bv.wav')
        st.update(kmodel=km, one=1)
        (out / 'sep.json').write_text(json.dumps(st), encoding='utf-8')
        print('✓ הקול הראשי והליווי עם קולות הרקע הופרדו במעבר אחד (' + km + ')')
        return
    st = separate(Path(a.src), out, a.model or SEP_DEFAULT, 'm')
    os.replace(out / 'm_voc.wav', out / 'voc.wav')
    os.replace(out / 'm_inst.wav', out / 'inst.wav')
    if a.backing:
        if km:
            # "עם קולות רקע": מודל karaoke על הקול המופרד — הקול הראשי מול קולות הרקע; הליווי + קולות הרקע = inst_bv
            st['ksec'] = separate(out / 'voc.wav', out, km, 'k')['sec']
            os.replace(out / 'k_voc.wav', out / 'lead.wav')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(out / 'inst.wav'), '-i', str(out / 'k_inst.wav'),
                            '-filter_complex', 'amix=inputs=2:normalize=0', '-c:a', 'pcm_f32le', str(out / 'inst_bv.wav')], check=True)
            (out / 'k_inst.wav').unlink(missing_ok=True)
            st['kmodel'] = km
        else:
            print('· אין מודל karaoke בסביבה — "עם קולות רקע" = הליווי בלי קול (כמו "בלי שום קול").')
    (out / 'sep.json').write_text(json.dumps(st), encoding='utf-8')
    print('✓ הקול והליווי הופרדו (' + st['model'] + ')')


def singers(a, words) -> list:
    """31/10/2026: בלי סימון זמרים במילים — זיהוי אוטומטי מהקול המופרד (vt/karaoke.auto_singers). יש סימון — הסימון קובע
    (build), כאן לא מחשבים. SNB_KA_SG=0 מכבה."""
    from vt import karaoke as K
    if os.environ.get('SNB_KA_SG', '1') == '0' or K.parse_singers(Path(a.lyrics).read_text(encoding='utf-8')):
        return []
    t0 = time.time()
    sg = K.auto_singers(K.timed_lines(words), a.voc)
    print(f'👥 זמרים: {len(set(x for x in sg if x)) or 1} ({time.time() - t0:.0f} שנ׳)', flush=True)
    return sg


def cmd_align(a):
    from vt import karaoke as K
    from vt.align import align_words
    from vt.asr_parakeet import transcribe
    lines = K.parse_lyrics(Path(a.lyrics).read_text(encoding='utf-8'))
    if not lines:
        raise SystemExit('✗ לא נמצאו מילים בטקסט שהודבק.')
    from vt import align_he as H
    if H.is_hebrew(lines) and H.ready() and os.environ.get('SNB_KA_HE', '1') != '0':
        # 31/10/2026: שיר עברי — ivrit + stable-ts + CTC עברי (Parakeet ו־Qwen3 לא מכירים עברית: המילים הופיעו בלי קשר לשירה)
        words, stats = H.align_hebrew(lines, a.voc)
        n = sum(1 for w in words if w['align'] != 'anchor')
        Path(a.out).write_text(json.dumps({'words': words, 'stats': stats, 'asr': stats.get('asr', 0),
                                           'sg': singers(a, words)}, ensure_ascii=False), encoding='utf-8')
        print(f'✓ יושרו {n} מתוך {len(words)} מילים (עברית: stable-ts {stats["from_st"]}, '
              f'CTC {stats["from_ctc"]}; עוגנים מהתמלול: {stats.get("asr", 0)})')
        return
    asr = transcribe(a.voc)['words']                 # הקול המופרד — עוגנים בלבד (המילים מגיעות מהמשתמש)
    words = K.anchor(lines, asr)
    words, stats = align_words(words, a.voc, cache=str(Path(a.out).with_suffix('.part.json')))
    n = sum(1 for w in words if w.get('align') == 'qwen3')
    Path(a.out).write_text(json.dumps({'words': words, 'stats': {k: v for k, v in stats.items() if not isinstance(v, dict)},
                                       'asr': len(asr), 'sg': singers(a, words)}, ensure_ascii=False), encoding='utf-8')
    print(f'✓ יושרו {n} מתוך {len(words)} מילים (עוגנים מהתמלול: {len(asr)})')


def cmd_lyrics(a):
    """01/11/2026: אין מילים — טיוטה מתמלול הקול המופרד (16kHz). עברית: ivrit (חובה language=he; בלי VAD — בשירה הוא
    הפיל חצי מהמשפטים, ו־gate מוריד את ההזיות בשקט). אנגלית: Parakeet. השפה מהטופס (זיהוי השפה של ivrit פגוע)."""
    import soundfile as sf
    from vt import karaoke as K
    audio, sr = sf.read(a.voc, dtype='float32')
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    t0 = time.time()
    if a.lang == 'he':
        from vt import align_he as H
        if not H.ready():
            raise SystemExit('✗ המודלים לעברית לא מותקנים בעובד.')
        words = H.transcribe(H.load_ivrit(), audio, vad=False)
    else:
        from vt.asr_parakeet import transcribe
        words = transcribe(a.voc)['words']
    heard = K.gate(words, audio, sr)
    lines = K.draft_lines(heard)
    if not lines:
        Path(a.out).write_text('', encoding='utf-8')     # קובץ ריק = הסימן לעובד (ka_nowords), להבדיל מקריסה
        raise SystemExit('✗ לא נשמעו מילים בשיר.')
    Path(a.out).write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'✓ תמלול אוטומטי ({a.lang}): {len(lines)} שורות, {len(heard)} מילים '
          f'(ירדו {len(words) - len(heard)} בשקט) · {time.time() - t0:.0f} שנ׳', flush=True)


def cmd_build(a):
    from vt import config as C
    from vt import karaoke as K
    from vt.util import write_text
    words = json.loads(Path(a.words).read_text(encoding='utf-8'))['words']
    lines = K.timed_lines(words)
    ky = K.norm_ky(json.loads(a.ky or '{}'))
    if a.lyrics and Path(a.lyrics).exists():          # 31/10/2026: דואט — מי שר כל שורה, מהסימון במילים
        K.assign_singers(lines, K.parse_singers(Path(a.lyrics).read_text(encoding='utf-8'))
                         or json.loads(Path(a.words).read_text(encoding='utf-8')).get('sg') or [])   # או מהזיהוי האוטומטי
    shown = K.layout(lines)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    rtl_text = K.is_rtl([[w['w'] for w in ln['words']] for ln in lines])
    style = C.STYLES.get(a.style) or C.STYLES[C.DEFAULT_STYLE]
    write_text(out / 'karaoke.ass', K.write_ass(shown, style, a.W, a.H, a.title, rtl_text, ky, a.video == 1))
    write_text(out / 'karaoke.lrc', K.write_lrc(lines, a.title))
    write_text(out / 'karaoke.elrc.lrc', K.write_lrc(lines, a.title, enhanced=True))
    print(f'✓ {len(lines)} שורות, {len(words)} מילים')


def cmd_video(a):
    """שיר בלי וידאו: רקע באורך השיר, 1920×1080 ‏30fps (הכתוביות נצרבות עליו כמו על כל סרטון). 31/10/2026: לפי עיצוב
    הקריוקי — כהה (צבע אחיד), מעבר צבע או צבע הערכה (תמונה קטנה שמוגדלת, K.bg_ppm)."""
    from vt import karaoke as K
    ky = K.norm_ky(json.loads(a.ky or '{}'))
    if ky['bg'] == 'dark':
        vin = ['-f', 'lavfi', '-i', f'color=c=0x101418:s=1920x1080:r=30:d={a.dur:.3f}']
    else:
        img = Path(a.out).with_suffix('.bg.ppm')
        img.write_bytes(K.bg_ppm(ky))
        vin = ['-loop', '1', '-framerate', '30', '-t', f'{a.dur:.3f}', '-i', str(img)]
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + vin + ['-i', a.audio, '-vf', 'scale=1920:1080:flags=bicubic', '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', a.out], check=True)


def cmd_burn(a):
    """הכתוביות על הסרטון — אותה צריבה של vt (ציור מראש + overlay, AV1). profile: same = איכות המקור, small = דחוס."""
    from vt.media import probe
    from vt.render import burn
    src = Path(a.src)
    burn(src, Path(a.ass), Path(a.out), probe(src), codec='av1', profile=a.profile, work=Path(a.work))


def cmd_mix(a):
    """הליווי (+ הקול המנחה ב־gv%) → הסרטון הצרוב, הווידאו בלי קידוד מחדש."""
    gv = max(0, min(100, int(a.gv)))
    ins = ['-i', a.video, '-i', a.inst]
    if gv and a.voc:
        ins += ['-i', a.voc]
        fc = f'[2:a]volume={gv / 100:.2f}[g];[1:a][g]amix=inputs=2:normalize=0[a]'
        amap = ['-filter_complex', fc, '-map', '0:v', '-map', '[a]']
    else:
        amap = ['-map', '0:v', '-map', '1:a']
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + ins + amap + ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                                                                   '-movflags', '+faststart', '-shortest', a.out], check=True)


def main(argv=None):
    p = argparse.ArgumentParser(description='קריוקי משיר רגיל')
    sp = p.add_subparsers(dest='cmd', required=True)
    s = sp.add_parser('sep'); s.add_argument('--src', required=True); s.add_argument('--out', required=True)
    s.add_argument('--model', default=''); s.add_argument('--kmodel', default=''); s.add_argument('--backing', action='store_true')
    s = sp.add_parser('align'); s.add_argument('--voc', required=True); s.add_argument('--lyrics', required=True); s.add_argument('--out', required=True)
    s = sp.add_parser('lyrics'); s.add_argument('--voc', required=True); s.add_argument('--lang', default='he', choices=('he', 'en'))
    s.add_argument('--out', required=True)
    s = sp.add_parser('build'); s.add_argument('--words', required=True); s.add_argument('--out', required=True)
    s.add_argument('--W', type=int, default=1920); s.add_argument('--H', type=int, default=1080)
    s.add_argument('--title', default=''); s.add_argument('--style', default='bold')
    s.add_argument('--ky', default=''); s.add_argument('--lyrics', default=''); s.add_argument('--video', type=int, default=1)
    s = sp.add_parser('video'); s.add_argument('--audio', required=True); s.add_argument('--dur', type=float, required=True); s.add_argument('--out', required=True)
    s.add_argument('--ky', default='')
    s = sp.add_parser('burn'); s.add_argument('--src', required=True); s.add_argument('--ass', required=True)
    s.add_argument('--out', required=True); s.add_argument('--work', required=True); s.add_argument('--profile', default='small', choices=('same', 'small'))
    s = sp.add_parser('mix'); s.add_argument('--video', required=True); s.add_argument('--inst', required=True)
    s.add_argument('--voc', default=''); s.add_argument('--gv', default='0'); s.add_argument('--out', required=True)
    a = p.parse_args(argv)
    {'sep': cmd_sep, 'lyrics': cmd_lyrics, 'align': cmd_align, 'build': cmd_build, 'video': cmd_video, 'burn': cmd_burn, 'mix': cmd_mix}[a.cmd](a)


if __name__ == '__main__':
    main()
