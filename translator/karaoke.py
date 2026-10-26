"""קריוקי משיר רגיל (26/10/2026) — השלבים הכבדים, בסביבת vt (job.py karaoke מפעיל כל שלב בנפרד, כמו rerender.py).

  sep    — הפרדת קול וליווי (audio-separator, מודלים ברישיון פתוח בלבד — החלטת המשתמש): voc.wav, inst.wav,
           ובמצב "עם קולות רקע" גם inst_bv.wav (מודל karaoke: הקול הראשי מול כל השאר).
  align  — המילים שהודבקו → עיגון לתמלול של הקול המופרד (Parakeet) → יישור Qwen לכל מילה → words.json.
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
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

# המודלים: רק מה שהרישיון שלו פתוח (MIT / Apache / GPL) — 26/10/2026, החלטת המשתמש. ברירת המחדל נקבעת
# אחרי המדידה (שלב 0); עד אז — מה שבסביבה (SNB_KA_SEP / SNB_KA_KAR), ואחרת המודל הפתוח המוכר של UVR
SEP_DEFAULT = os.environ.get('SNB_KA_SEP') or 'UVR-MDX-NET-Inst_HQ_5.onnx'
KAR_DEFAULT = os.environ.get('SNB_KA_KAR') or ''
MODEL_DIR = os.environ.get('SNB_KA_MODELS') or '/opt/separator'


def _pick(files, *keys):
    for f in files:
        n = Path(f).name.lower()
        if any(k in n for k in keys):
            return Path(f)
    return None


def separate(src: Path, out: Path, model: str, prefix: str) -> dict:
    """מודל אחד → שני קבצים (קול / ליווי). audio-separator מחליט על הפורמט לפי המודל."""
    from audio_separator.separator import Separator
    tmp = out / ('_' + prefix)
    tmp.mkdir(parents=True, exist_ok=True)
    sep = Separator(output_dir=str(tmp), model_file_dir=MODEL_DIR, output_format='WAV',
                    mdxc_params={'overlap': 2, 'segment_size': 256, 'batch_size': 1, 'pitch_shift': 0})
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
    return {'model': model}


def cmd_sep(a):
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    st = separate(Path(a.src), out, a.model or SEP_DEFAULT, 'm')
    os.replace(out / 'm_voc.wav', out / 'voc.wav')
    os.replace(out / 'm_inst.wav', out / 'inst.wav')
    if a.backing:
        km = a.kmodel or KAR_DEFAULT
        if km:
            # "עם קולות רקע": מודל karaoke על הקול המופרד — הקול הראשי מול קולות הרקע; הליווי + קולות הרקע = inst_bv
            separate(out / 'voc.wav', out, km, 'k')
            os.replace(out / 'k_voc.wav', out / 'lead.wav')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(out / 'inst.wav'), '-i', str(out / 'k_inst.wav'),
                            '-filter_complex', 'amix=inputs=2:normalize=0', str(out / 'inst_bv.wav')], check=True)
            (out / 'k_inst.wav').unlink(missing_ok=True)
            st['kmodel'] = km
        else:
            print('· אין מודל karaoke בסביבה — "עם קולות רקע" = הליווי בלי קול (כמו "בלי שום קול").')
    (out / 'sep.json').write_text(json.dumps(st), encoding='utf-8')
    print('✓ הקול והליווי הופרדו (' + st['model'] + ')')


def cmd_align(a):
    from vt import karaoke as K
    from vt.align import align_words
    from vt.asr_parakeet import transcribe
    lines = K.parse_lyrics(Path(a.lyrics).read_text(encoding='utf-8'))
    if not lines:
        raise SystemExit('✗ לא נמצאו מילים בטקסט שהודבק.')
    asr = transcribe(a.voc)['words']                 # הקול המופרד — עוגנים בלבד (המילים מגיעות מהמשתמש)
    words = K.anchor(lines, asr)
    words, stats = align_words(words, a.voc, cache=str(Path(a.out).with_suffix('.part.json')))
    n = sum(1 for w in words if w.get('align') == 'qwen3')
    Path(a.out).write_text(json.dumps({'words': words, 'stats': {k: v for k, v in stats.items() if not isinstance(v, dict)},
                                       'asr': len(asr)}, ensure_ascii=False), encoding='utf-8')
    print(f'✓ יושרו {n} מתוך {len(words)} מילים (עוגנים מהתמלול: {len(asr)})')


def cmd_build(a):
    from vt import config as C
    from vt import karaoke as K
    from vt.util import write_text
    words = json.loads(Path(a.words).read_text(encoding='utf-8'))['words']
    lines = K.timed_lines(words)
    shown = K.layout(lines)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    rtl_text = K.is_rtl([[w['w'] for w in ln['words']] for ln in lines])
    style = C.STYLES.get(a.style) or C.STYLES[C.DEFAULT_STYLE]
    write_text(out / 'karaoke.ass', K.write_ass(shown, style, a.W, a.H, a.title, rtl_text))
    write_text(out / 'karaoke.lrc', K.write_lrc(lines, a.title))
    write_text(out / 'karaoke.elrc.lrc', K.write_lrc(lines, a.title, enhanced=True))
    print(f'✓ {len(lines)} שורות, {len(words)} מילים')


def cmd_video(a):
    """שיר בלי וידאו: רקע כהה באורך השיר, 1920×1080 ‏30fps (הכתוביות נצרבות עליו כמו על כל סרטון)."""
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=0x101418:s=1920x1080:r=30:d={a.dur:.3f}',
                    '-i', a.audio, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
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
    s = sp.add_parser('build'); s.add_argument('--words', required=True); s.add_argument('--out', required=True)
    s.add_argument('--W', type=int, default=1920); s.add_argument('--H', type=int, default=1080)
    s.add_argument('--title', default=''); s.add_argument('--style', default='bold')
    s = sp.add_parser('video'); s.add_argument('--audio', required=True); s.add_argument('--dur', type=float, required=True); s.add_argument('--out', required=True)
    s = sp.add_parser('burn'); s.add_argument('--src', required=True); s.add_argument('--ass', required=True)
    s.add_argument('--out', required=True); s.add_argument('--work', required=True); s.add_argument('--profile', default='small', choices=('same', 'small'))
    s = sp.add_parser('mix'); s.add_argument('--video', required=True); s.add_argument('--inst', required=True)
    s.add_argument('--voc', default=''); s.add_argument('--gv', default='0'); s.add_argument('--out', required=True)
    a = p.parse_args(argv)
    {'sep': cmd_sep, 'align': cmd_align, 'build': cmd_build, 'video': cmd_video, 'burn': cmd_burn, 'mix': cmd_mix}[a.cmd](a)


if __name__ == '__main__':
    main()
