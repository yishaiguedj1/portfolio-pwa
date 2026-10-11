"""ממשק הפקודות: python -m vt <פקודה> <שם-ראיון> [אפשרויות]

סדר העבודה המלא מתואר ב"מדריך-עבודה.md". הפקודה status מראה מה נעשה ומה הבא.
"""

from __future__ import annotations

import argparse
import os
import random
import shutil
import sys
from pathlib import Path

from . import config as C
from .project import Project, STAGES, work_root
from .util import log, die, read_json, write_json, write_text, fmt_ts, human_size


# ---------------------------------------------------------------------------
# עזר
# ---------------------------------------------------------------------------

def _info(pr: Project) -> dict:
    p = pr.p("media.json")
    if not p.exists():
        die("חסר media.json — הריצו קודם: python -m vt ingest " + pr.name)
    return read_json(p)


def _words_for_plan(pr: Project) -> list[dict]:
    for name in ("en.aligned.json", "en.words.json"):
        p = pr.p(name)
        if p.exists():
            if name == "en.words.json":
                log("אזהרה: אין יישור כפוי — משתמש בזמנים המשוערים (הריצו vt align לדיוק מרבי)")
            return read_json(p)["words"]
    die("אין תמליל מוגה — הריצו edit-import (ואז align)")


def _asr_preferred(pr: Project, engine: str | None) -> tuple[str, dict]:
    order = [engine] if engine else ["elevenlabs", "assemblyai", "parakeet"]
    for e in order:
        p = pr.p("asr", f"{e}.json")
        if p.exists():
            return e, read_json(p)
    die("אין תמלול — הריצו: python -m vt asr " + pr.name)


def _style(meta: dict, override: str | None = None) -> C.Style:
    name = override or meta.get("settings", {}).get("style", C.DEFAULT_STYLE)
    if name not in C.STYLES:
        die(f"סגנון לא מוכר: {name} (קיימים: {', '.join(C.STYLES)})")
    return C.STYLES[name]


# ---------------------------------------------------------------------------
# פקודות
# ---------------------------------------------------------------------------

def cmd_new(a):
    pr = Project(a.name)
    if pr.exists() and not a.force:
        die(f"הפרויקט {pr.name} כבר קיים ({pr.dir})")
    meta = pr.create(a.source, a.title or "")
    if a.speakers:
        meta["settings"]["num_speakers"] = a.speakers
        pr.save(meta)
    log(f"נוצר פרויקט: {pr.dir}")
    print(pr.dir)


def cmd_ingest(a):
    from . import media, drive
    pr = Project(a.name)
    meta = pr.load()
    src = meta["source"]
    existing = pr.source_path()
    if existing and not a.force:
        log(f"המקור כבר קיים: {existing.name}")
        dest = existing
    elif re.match(r"^https?://", src):
        ext = Path(src.split("?")[0]).suffix.lower() or ".mp4"
        if ext not in (".mp4", ".mkv", ".mov", ".webm", ".m4a", ".mp3", ".wav", ".m4v", ".ts"):
            ext = ".mp4"
        dest = drive.fetch(src, pr.p("source" + ext))
    elif src.startswith("drive:"):
        tmp = pr.p("_dl")
        drive.get(src[len("drive:"):], tmp)
        f = next((x for x in tmp.iterdir() if x.is_file()), None)
        if not f:
            die("ההורדה מ־Drive לא החזירה קובץ")
        dest = pr.p("source" + f.suffix.lower())
        f.rename(dest)
        shutil.rmtree(tmp, ignore_errors=True)
    else:
        sp = Path(src).expanduser()
        if not sp.exists():
            die(f"הקובץ לא נמצא: {sp}")
        dest = drive.copy_local(sp, pr.p("source" + sp.suffix.lower()))
    info = media.probe(dest)
    write_json(pr.p("media.json"), info)
    v, au = info.get("video"), info.get("audio")
    if not au:
        die("אין רצועת אודיו בקובץ")
    log(f"משך {info['duration'] / 60:.1f} דק׳ · " + (f"וידאו {v['width']}x{v['height']} @ {v['fps_float']:.3f}fps" if v else "אודיו בלבד")
        + f" · היסט אודיו {au.get('t0', 0):.3f} שנ׳")
    if v and v.get("vfr"):
        log("אזהרה: קצב פריימים משתנה (VFR) — התזמון יחושב לפי הקצב הממוצע")
    media.extract_audio(dest, pr.p("audio16k.wav"))
    # 10/10/2026: audio_api.ogg (Opus) רק למנועי התמלול בענן — נוצר ב־asr כשבאמת צריך אותו. Parakeet (המקומי)
    # קורא את audio16k.wav, והקידוד היה ~7 שנ׳ לכל 5 דק׳ (פעמיים בעבודה: בקליטה ובצירוף הסרטון). מקור חדש — ישן נמחק.
    stale = pr.p("audio_api.ogg")
    if stale.exists():
        stale.unlink()
    pr.mark("ingest", duration=info["duration"])


def _api_audio(pr):
    from . import media
    out = pr.p("audio_api.ogg")
    if not out.exists():
        media.extract_api_audio(pr.source_path(), out)
        log(f"אודיו לתמלול: {human_size(out.stat().st_size)}")
    return out


def cmd_asr(a):
    pr = Project(a.name)
    meta = pr.load()
    terms = meta.get("keyterms", [])
    n_spk = a.num_speakers or meta.get("settings", {}).get("num_speakers")
    if a.engine == "parakeet":
        from . import asr_parakeet
        res = asr_parakeet.transcribe(str(pr.p("audio16k.wav")), quantization=None if a.fp32 else "int8")
    elif a.engine == "elevenlabs":
        from . import asr_api
        res = asr_api.elevenlabs(_api_audio(pr), terms, n_spk)
    elif a.engine == "assemblyai":
        from . import asr_api
        ctx = meta.get("asr_context") or meta.get("title")
        res = asr_api.assemblyai(_api_audio(pr), terms, n_spk, ctx)
    else:
        die("מנוע לא מוכר")
    write_json(pr.p("asr", f"{a.engine}.json"), res)
    log(f"נשמר asr/{a.engine}.json — {len(res['words'])} מילים, דוברים: {sorted({w.get('spk') for w in res['words'] if w.get('spk')})}")
    pr.mark("asr", engine=a.engine, words=len(res["words"]))


def cmd_compare(a):
    from .transcript import compare, compare_report
    pr = Project(a.name)
    A = read_json(pr.p("asr", f"{a.a}.json"))["words"]
    B = read_json(pr.p("asr", f"{a.b}.json"))["words"]
    diffs = compare(A, B)
    out = pr.p("asr", f"diff_{a.a}_{a.b}.md")
    write_text(out, compare_report(a.a, a.b, diffs, len(A)))
    log(f"{len(diffs)} נקודות מחלוקת → {out}")


def cmd_edit_export(a):
    from .transcript import export_edit
    pr = Project(a.name)
    meta = pr.load()
    eng, res = _asr_preferred(pr, a.source)
    out = pr.p("en.edit.txt")
    if out.exists() and not a.force:
        die("en.edit.txt כבר קיים (ייתכן שכבר הוגה). ‏--force כדי לדרוס.")
    write_text(out, export_edit(res["words"], meta.get("speakers")))
    pr.mark("edit_export", source=eng)
    log(f"נוצר {out} (ממנוע {eng})")


def cmd_edit_import(a):
    from .transcript import import_edit, apply_patch
    pr = Project(a.name)
    meta = pr.load()
    patch = pr.p("en.patch.txt")
    if patch.exists():                     # תיקוני הגהה כקובץ קצר (חוסך כתיבה מחדש של כל התמליל)
        text, errs = apply_patch(pr.p("en.edit.txt").read_text(encoding="utf-8"), patch.read_text(encoding="utf-8"))
        if errs:
            die("en.patch.txt לא הוחל:\n" + "\n".join(errs))
        write_text(pr.p("en.edit.txt"), text)
        n = len([x for x in patch.read_text(encoding="utf-8").splitlines() if " => " in x])
        patch.rename(pr.p(f"en.patch.applied.{len(list(pr.dir.glob('en.patch.applied.*')))}.txt"))
        log(f"הוחלו {n} תיקוני הגהה מ־en.patch.txt")
    eng = meta.get("stages", {}).get("edit_export", {}).get("source")
    eng, res = _asr_preferred(pr, eng)
    words, stats = import_edit(res["words"], pr.p("en.edit.txt").read_text(encoding="utf-8"))
    write_json(pr.p("en.words.json"), {"source": eng, "words": words})
    log(f"יובאו {len(words)} מילים · זהות {stats['equal']} · הוחלפו {stats['replaced']} · "
        f"נוספו {stats['inserted']} · נמחקו {stats['deleted']}")
    unknown = sum(1 for w in words if w.get("spk") in (None, "S?"))
    if unknown:
        log(f"אזהרה: {unknown} מילים בלי דובר מזוהה (S?) — לתקן בקובץ ההגהה")
    pr.mark("edit_import", **stats)


def cmd_align(a):
    from .align import align_words
    pr = Project(a.name)
    words = read_json(pr.p("en.words.json"))["words"]
    words, stats = align_words(words, str(pr.p("audio16k.wav")), device=a.device)
    aligner = "Qwen3-ForcedAligner-0.6B" + (" · ONNX INT8" if str(stats.get("engine", "")).startswith("onnx-int8") else "")
    log(f"יושרו {stats['aligned']} מילים · חשודות {stats['suspicious']} · משוערות {stats['kept_approx']} "
        f"· {stats['seconds']} שנ׳")
    if not a.no_ctc:
        # מנוע שני + חציון של שלושה מקורות (Qwen, ‏CTC, תמלול) — מבחן TED: אפס הקדמות
        # של יותר מ־0.2 שנ׳, ו־95% מהכתוביות עד חצי שנייה מהתזמון האנושי (Qwen לבד: 90%)
        from .align_ctc import ctc_align, consensus
        for w in words:
            if w.get("s_asr") is None and w.get("align") in ("suspicious", "approx"):
                w["s_asr"], w["e_asr"] = w["s"], w["e"]
        stats["ctc"] = ctc_align(words, str(pr.p("audio16k.wav")))
        stats["consensus"] = consensus(words)
        aligner += " + MMS_FA (CTC) + ASR · median"
        log(f"CTC: {stats['ctc']['aligned']} מילים ב־{stats['ctc']['seconds']} שנ׳ · "
            f"הכרעה הזיזה {stats['consensus']['moved_100ms']} מילים ביותר מ־0.1 שנ׳")
    write_json(pr.p("en.aligned.json"), {"aligner": aligner, "stats": stats, "words": words})
    pr.mark("align", **{k: v for k, v in stats.items() if not isinstance(v, dict)})


def cmd_retime(a):
    """אחרי יישור משופר: זמני דיבור חדשים לכתוביות שכבר תורגמו (החלוקה והתרגום נשמרים)."""
    from .segment import retime
    pr = Project(a.name)
    meta = pr.load()
    words = read_json(pr.p("en.aligned.json"))["words"]
    cues = read_json(pr.p("cues.en.json"))
    st = retime(words, cues, C.timing_rules(meta["settings"].get("timing")),
                C.text_rules(meta["settings"].get("text")))
    write_json(pr.p("cues.en.json"), cues)
    log(f"עודכנו זמני {st['cues']} כתוביות · זזו מעל 0.1 שנ׳: {st['moved_over_100ms']} · "
        f"מעל 0.3: {st['moved_over_300ms']} · מרבי {st['max_moved_s']} שנ׳ (הריצו tr-check ו־build)")


def cmd_shots(a):
    from . import media
    pr = Project(a.name)
    meta = pr.load()
    info = _info(pr)
    if not info.get("video"):
        write_json(pr.p("shots.json"), {"threshold": None, "shots": []})
        log("אין וידאו — אין חילופי שוטים")
        return
    th = a.threshold or meta.get("settings", {}).get("shot_threshold", 10.0)
    shots = media.detect_shots(pr.source_path(), th)
    write_json(pr.p("shots.json"), {"threshold": th, "shots": shots})
    log(f"נמצאו {len(shots)} חילופי שוטים")
    pr.mark("shots", count=len(shots))


def cmd_plan(a):
    from .segment import plan
    pr = Project(a.name)
    meta = pr.load()
    words = _words_for_plan(pr)
    tr = C.timing_rules(meta["settings"].get("timing"))
    tx = C.text_rules(meta["settings"].get("text"))
    cues = plan(words, tr, tx)
    write_json(pr.p("cues.en.json"), cues)
    sp = meta.get("speakers", {})
    lines = [f"# תכנון כתוביות — {len(cues)} כתוביות", ""]
    for c in cues:
        who = sp.get(c.get("spk") or "", {}).get("name", c.get("spk"))
        extra = " [שני דוברים]" if c.get("parts") else ""
        lines.append(f"#{c['id']} {fmt_ts(c['speech_s'])} ({c['dur']}ש׳, ≤{c['budget']}) {who}{extra}: {c['en']}")
    write_text(pr.p("plan.md"), "\n".join(lines) + "\n")
    durs = [c["speech_e"] - c["speech_s"] for c in cues]
    log(f"{len(cues)} כתוביות · משך דיבור ממוצע {sum(durs) / max(len(durs), 1):.2f} שנ׳ → plan.md")
    pr.mark("plan", cues=len(cues))


def cmd_tr_prep(a):
    from .translate import batches, render_batch, load_answers, render_source
    pr = Project(a.name)
    meta = pr.load()
    cues = read_json(pr.p("cues.en.json"))
    td = pr.tr_dir
    td.mkdir(parents=True, exist_ok=True)
    for tpl, dest in (("brief.md", "brief.md"), ("glossary.tsv", "glossary.tsv")):
        if not (td / dest).exists():
            shutil.copy(C.TEMPLATES_DIR / tpl, td / dest)
    src, nb = render_source(cues, meta.get("speakers", {}), a.size)
    write_text(td / "source.md", src)
    if a.batches:                       # הפורמט הישן (מנה לקובץ עם הקשר חוזר) — רק לבקשה
        he, _ = load_answers(td)
        bs = batches(cues, a.size)
        prev: list[dict] = []
        for k, b in enumerate(bs, start=1):
            write_text(td / f"batch_{k:03d}.md", render_batch(k, len(bs), b, prev[-8:], he, meta.get("speakers", {})))
            prev = b
    log(f"tr/source.md: {len(cues)} כתוביות ב־{nb} חלקים ({len(src) // 1000}K תווים) — לקרוא פעם אחת")
    pr.mark("tr_prep", batches=nb)


def cmd_tr_check(a):
    from .translate import load_answers, load_glossary, check, check_report
    pr = Project(a.name)
    cues = read_json(pr.p("cues.en.json"))
    he, dups = load_answers(pr.tr_dir)
    issues, stats = check(cues, he, load_glossary(pr.tr_dir / "glossary.tsv"))
    for d in dups:
        issues.insert(0, f"- #{d}: מופיע ביותר ממנה אחת")
    write_text(pr.tr_dir / "check.md", check_report(issues, stats))
    log(f"תורגמו {stats['translated']}/{stats['total']} · שגיאות {stats['errors']} · "
        f"מעל תקציב {stats['over_budget']} · מספרים {stats['numbers']} · מילון {stats['glossary']} → tr/check.md")


def cmd_tr_merge(a):
    from .translate import load_answers
    from .hebrew import normalize_he
    pr = Project(a.name)
    cues = read_json(pr.p("cues.en.json"))
    he, _ = load_answers(pr.tr_dir)
    missing = [c["id"] for c in cues if str(c["id"]) not in he]
    if missing and not a.allow_missing:
        die(f"חסרים תרגומים ל־{len(missing)} כתוביות (למשל {missing[:10]}). ‏--allow-missing כדי להמשיך")
    out = {k: (v if v in ("=", "∅") else normalize_he(v)) for k, v in he.items()}
    write_json(pr.p("he.json"), out)
    log(f"נשמר he.json ({len(out)} כתוביות)")
    pr.mark("tr_merge", count=len(out), missing=len(missing))


def build(pr: Project, style_name: str | None = None) -> dict:
    from .hebrew import break_lines, dual_lines, Measurer, visible_len
    from .media import grid_from
    from .qc import run_qc
    from .subs import write_ass, write_ass_compat, write_srt, write_vtt, frame_check
    from .timing import time_cues
    from .translate import apply_merges

    meta = pr.load()
    info = _info(pr)
    v = info.get("video") or {"width": 1920, "height": 1080}
    W, H = int(v["width"]), int(v["height"])
    style = _style(meta, style_name)
    st = style.scaled(W, H)
    tr = C.timing_rules(meta["settings"].get("timing"))
    tx = C.text_rules(meta["settings"].get("text"))
    grid = grid_from(info)
    words = _words_for_plan(pr)
    cues = read_json(pr.p("cues.en.json"))
    he = read_json(pr.p("he.json"))
    shots_raw = read_json(pr.p("shots.json"))["shots"] if pr.p("shots.json").exists() else []
    shots = sorted({grid.frame_at(s["t"]) for s in shots_raw})
    meas = Measurer(C.FONTS_DIR / style.font_file, st.size, st.spacing, st.outline)

    final, warns = apply_merges(cues, he, tr.max_dur_s)

    def refit(c):
        t = c["he"]
        if c.get("parts") and "||" in t:
            a_, b_ = t.split("||", 1)
            lines = dual_lines(a_, b_)
            ok = all(visible_len(x) <= tx.max_chars_line and meas.width(x) <= st.max_line_px for x in lines)
        else:
            lines, ok = break_lines(t.replace("||", " "), tx.max_chars_line, meas, st.max_line_px)
        c["lines"] = lines
        c["chars"] = sum(visible_len(x) for x in lines) + (len(lines) - 1)
        c["_fits"] = ok
        return ok

    for c in final:
        refit(c)
    time_cues(final, grid, shots, tr)
    # מיזוג מונע־CPS: כתובית שנשארה מהירה מדי גם אחרי ההארכה מתאחדת עם שכנתה, והתזמון מחושב מחדש
    from .segment import cps_merge
    final, n_merged = cps_merge(final, tr, tx, refit)
    if n_merged:
        for c in final:
            c["flags"] = []
            for key in ("snap_in", "snap_out", "chained"):
                c.pop(key, None)
        time_cues(final, grid, shots, tr)
        warns.append(f"מיזוג מונע־CPS: {n_merged} זוגות כתוביות אוחדו כדי לעמוד בקצב הקריאה")
    bad_fit = [c["id"] for c in final if not c.pop("_fits", True)]
    issues = frame_check(final, grid)
    od = pr.out_dir
    od.mkdir(parents=True, exist_ok=True)
    title = meta.get("title", pr.name)
    write_text(od / "he.ass", write_ass(final, style, W, H, title))
    write_text(od / "he.srt", write_srt(final), bom=True)
    write_text(od / "he.vtt", write_vtt(final))
    write_text(od / "he.player.ass", write_ass_compat(final, style, W, H, title))   # לרצועה הרכה ב־MKV
    en_cues = [dict(c, en_lines=[c["en"]]) for c in final]
    write_text(od / "en.reference.srt", write_srt(en_cues, with_rlm=False, key="en_lines"))
    keep = ("id", "spk", "speech_s", "speech_e", "si", "so", "fi", "fo", "start", "end", "lines", "chars",
            "cps", "flags", "en", "he", "snap_in", "snap_out", "chained", "merged", "cps_merged")
    write_json(od / "cues.final.json", [{k: c[k] for k in keep if k in c} for c in final])
    rep, stats = run_qc(final, words, tr, tx, grid.fps_f, shots, meas, st.max_line_px)
    extra = []
    if warns:
        extra += ["## הערות בנייה", ""] + [f"- {w}" for w in warns] + [""]
    if bad_fit:
        extra += ["## לא נכנס בשתי שורות — לקצר", "", ", ".join(f"#{i}" for i in bad_fit), ""]
    if issues:
        extra += ["## בדיקת פריימים", ""] + [f"- {x}" for x in issues] + [""]
    write_text(od / "qc.md", rep + "\n" + "\n".join(extra))
    log(f"נבנו {len(final)} כתוביות ({style.name}) · שגיאות QC: {stats['errors']} · אזהרות: {stats['warnings']} "
        f"· לא נכנסו: {len(bad_fit)} → out/")
    pr.mark("build", style=style.name, **stats)
    return {"cues": final, "stats": stats, "bad_fit": bad_fit}


def cmd_build(a):
    build(Project(a.name), a.style)


def cmd_breaks(a):
    """כל הכתוביות הדו־שורתיות לבדיקה בעין — שבירה לא טבעית מתקנים עם '|' בקובץ המנה."""
    from .hebrew import _break_cost
    pr = Project(a.name)
    cues = read_json(pr.out_dir / "cues.final.json")
    rows, flagged = [], 0
    for c in cues:
        if len(c["lines"]) != 2:
            continue
        top, bottom = c["lines"][0].split(" "), c["lines"][1].split(" ")
        cost = _break_cost(top, bottom, len(top) + len(bottom), shape=False)
        manual = "|" in (c.get("he") or "")
        mark = "⚠ " if cost > 2.5 and not manual else ""
        flagged += bool(mark)
        rows.append(f"- {mark}#{c['id']}: {c['lines'][0]}  ⏎  {c['lines'][1]}")
    head = ["# בדיקת שבירות שורה", "",
            "לא מפרקים: סמיכות (\"הזמנת | התוכן\"), מספר ונספר, שם עצם ותואר, צירוף קבוע (\"אי | אפשר\"), שם אדם.",
            "שוברים: אחרי פיסוק, לפני מילת קישור / ו׳ החיבור / מילת יחס. תיקון: '|' במקום השבירה בקובץ המנה.",
            f"⚠ = שבירה שהכללים האוטומטיים מסמנים כחשודה ({flagged}).", ""]
    write_text(pr.out_dir / "breaks.md", "\n".join(head + rows) + "\n")
    log(f"{len(rows)} כתוביות דו־שורתיות ({flagged} חשודות) → out/breaks.md")


def cmd_snapshot(a):
    """עותק של out/ ו־tr/ (למשל לפני תיקוני ביקורת) — בשביל דף צילומי לפני/אחרי."""
    pr = Project(a.name)
    dest = pr.p("snap", a.label)
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    for f in ("he.ass", "cues.final.json", "he.srt"):
        if (pr.out_dir / f).exists():
            shutil.copy(pr.out_dir / f, dest / f)
    if pr.tr_dir.exists():
        shutil.copytree(pr.tr_dir, dest / "tr")
    log(f"נשמר עותק → snap/{a.label}")


def cmd_preview(a):
    from .render import preview_frames, contact_sheet
    pr = Project(a.name)
    info = _info(pr)
    cues = read_json(pr.out_dir / "cues.final.json")
    if a.ids:
        want = {int(x) for x in a.ids.split(",")}
        sel = [c for c in cues if c["id"] in want]
    else:
        from .hebrew import has_latin
        tricky = [c for c in cues if has_latin(" ".join(c["lines"])) or any(ch.isdigit() for ch in " ".join(c["lines"]))]
        two = [c for c in cues if len(c["lines"]) == 2]
        random.seed(7)
        pool = tricky[:a.auto // 2] + random.sample(two, min(len(two), a.auto // 3))
        rest = [c for c in cues if c not in pool]
        pool += random.sample(rest, min(len(rest), a.auto - len(pool)))
        sel = sorted(pool, key=lambda c: c["id"])[:a.auto]
    times = [(c["start"] + c["end"]) / 2 for c in sel]
    base = info.get("timeline_base", 0.0)
    frames = preview_frames(pr.source_path(), pr.out_dir / "he.ass", times, pr.out_dir / "preview", base)
    contact_sheet(frames, pr.out_dir / "preview" / "sheet.png")
    log(f"{len(frames)} תמונות → out/preview/sheet.png")


def cmd_render(a):
    from .render import burn, mux_mkv
    pr = Project(a.name)
    meta = pr.load()
    info = _info(pr)
    src = pr.source_path()
    od = pr.out_dir
    style = _style(meta)
    start = end = None
    suffix = ""
    if a.clip:
        s, e = a.clip.split("-")
        from .util import parse_ts
        start, end = parse_ts(s), parse_ts(e)
        suffix = f".clip_{int(start)}-{int(end)}"
    burned = od / f"{pr.name}.he{suffix}.mp4"
    comp = od / f"{pr.name}.he{suffix}.compact.mp4"
    # ברירת המחדל (בקשת המשתמש, 07/10/2026): רק הגרסה הדחוסה (+ SRT מ־build). "זהה למקור" (--burn) ו־MKV — לבקשה.
    if not (a.burn or a.mkv or a.compact or a.small):
        a.compact = True
    if a.mkv:
        ass_mkv = od / "he.player.ass"
        if not ass_mkv.exists():
            die("חסר out/he.player.ass — הריצו vt build מחדש")
        mux_mkv(src, ass_mkv, od / "he.srt", od / f"{pr.name}.he.mkv", style.font_file)
    if a.burn:
        r = burn(src, od / "he.ass", burned, info, codec=a.codec, profile="same", crf=a.crf, preset=a.preset,
                 start=start, end=end, scale_h=a.height, work=pr.p("overlay"))
        log(f"✔ {burned.name}: {human_size(burned.stat().st_size)} (המקור: {human_size(src.stat().st_size)})")
    if a.compact:
        burn(src, od / "he.ass", comp, info, codec="av1", profile="small", start=start, end=end,
             work=pr.p("overlay"))
        log(f"✔ {comp.name}: {human_size(comp.stat().st_size)}")
    if a.small:
        from .render import small_copy
        base = burned if burned.exists() else comp
        if not base.exists():
            die("אין סרטון צרוב לעותק קטן — הריצו קודם vt render")
        small_copy(base, base.with_suffix(".small.mp4"), a.small)
    pr.mark("render", burn=bool(a.burn), compact=bool(a.compact), mkv=bool(a.mkv), small=bool(a.small))


def cmd_review_pack(a):
    from .review import package
    pr = Project(a.name)
    meta = pr.load()
    cues = read_json(pr.p("cues.en.json"))
    he = read_json(pr.p("he.json")) if pr.p("he.json").exists() else {}
    brief = (pr.tr_dir / "brief.md").read_text(encoding="utf-8") if (pr.tr_dir / "brief.md").exists() else ""
    gl = (pr.tr_dir / "glossary.tsv").read_text(encoding="utf-8") if (pr.tr_dir / "glossary.tsv").exists() else ""
    out = pr.p("review", "package.md")
    write_text(out, package(meta, cues, he, brief, gl))
    log(f"חבילת ביקורת → {out}")


def cmd_review_gemini(a):
    from .review import gemini_review
    pr = Project(a.name)
    pkg = pr.p("review", "package.md")
    if not pkg.exists():
        cmd_review_pack(a)
    gemini_review(pkg.read_text(encoding="utf-8"), pr.p("review"))


def cmd_drive(a):
    from . import drive
    if a.action == "ls":
        print(drive.ls(a.path or ""))
    elif a.action == "get":
        drive.get(a.path, Path(a.dest or "."))
    elif a.action == "put":
        drive.put(Path(a.path), a.dest)


def cmd_publish(a):
    from . import drive
    pr = Project(a.name)
    meta = pr.load()
    dest = a.dest or f"{os.environ.get('VT_DRIVE_OUT', 'תרגום ראיונות/פלט')}/{meta.get('title', pr.name)}"
    od = pr.out_dir
    # ברירת המחדל: רק מה שהמשתמש צריך — הסרטונים (בלי קטעי בדיקה ועותקים קטנים) ו־he.srt. ‏--all: גם ASS/VTT/qc.md.
    sent = []
    for f in sorted(od.iterdir()):
        if not f.is_file():
            continue
        video = f.suffix in (".mp4", ".mkv") and ".clip_" not in f.name and not f.name.endswith(".small.mp4")
        extra = a.all and f.suffix in (".srt", ".ass", ".vtt", ".md")
        if video or f.name == "he.srt" or extra:
            drive.put(f, dest)
            sent.append(f.name)
    log(f"הועלה ל־Drive: {dest} ({', '.join(sent)})")


def cmd_status(a):
    pr = Project(a.name)
    meta = pr.load()
    st = meta.get("stages", {})
    print(f"פרויקט: {meta.get('title')}  ({pr.dir})")
    nxt = None
    for key, desc, cmd in STAGES:
        done = key in st
        print(f"  {'✔' if done else '·'} {desc}" + (f"  [{st[key].get('at')}]" if done else ""))
        if not done and nxt is None:
            nxt = cmd.format(n=pr.name)
    if nxt:
        print(f"\nהשלב הבא: {nxt}")


def cmd_speakers(a):
    pr = Project(a.name)
    meta = pr.load()
    for item in a.items:
        k, _, v = item.partition("=")
        parts = (v.split("|") + ["", "", ""])[:3]
        meta.setdefault("speakers", {})[k.strip()] = {"name": parts[0].strip(), "role": parts[1].strip(),
                                                      "gender": parts[2].strip()}
    pr.save(meta)
    for k, v in meta["speakers"].items():
        print(f"{k}: {v}")


def cmd_doctor(a):
    import importlib
    import subprocess
    ok = True
    conf = subprocess.run(["ffmpeg", "-hide_banner", "-buildconf"], capture_output=True, text=True).stdout
    for flag in ("libass", "libfribidi", "libharfbuzz", "libx264", "libsvtav1", "libvmaf"):
        has = f"--enable-{flag}" in conf
        ok &= has
        print(f"{'✔' if has else '✘'} ffmpeg {flag}")
    for f in ("Arimo-Bold.ttf", "Assistant-SemiBold.ttf"):
        has = (C.FONTS_DIR / f).exists()
        ok &= has
        print(f"{'✔' if has else '✘'} גופן {f}")
    for mod, need in (("numpy", True), ("soundfile", True), ("PIL", True), ("requests", True),
                      ("onnx_asr", False), ("qwen_asr", False), ("torch", False), ("torchaudio", False)):
        try:
            importlib.import_module(mod)
            print(f"✔ {mod}")
        except Exception:
            print(f"{'✘' if need else '·'} {mod}" + ("" if need else " (אופציונלי)"))
            ok &= not need
    for env in ("ELEVENLABS_API_KEY", "ASSEMBLYAI_API_KEY", "GEMINI_API_KEY", "RCLONE_DRIVE_TOKEN"):
        print(f"{'✔' if os.environ.get(env) else '·'} {env} {'מוגדר' if os.environ.get(env) else 'לא מוגדר'}")
    print(f"תיקיית עבודה: {work_root()}")
    sys.exit(0 if ok else 1)


import re  # noqa: E402  (בשימוש ב־cmd_ingest)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="vt", description="תרגום ראיונות וידאו לעברית ברמה מקצועית")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def add(name, fn, *args, **kw):
        p = sub.add_parser(name, **kw)
        p.set_defaults(fn=fn)
        if "name" in args:
            p.add_argument("name")
        return p

    p = add("new", cmd_new, "name", help="פרויקט חדש")
    p.add_argument("--source", required=True, help="נתיב, קישור (Drive/Dropbox/ישיר) או drive:נתיב")
    p.add_argument("--title")
    p.add_argument("--speakers", type=int, help="מספר הדוברים הצפוי")
    p.add_argument("--force", action="store_true")
    p = add("ingest", cmd_ingest, "name", help="קליטה וחילוץ אודיו")
    p.add_argument("--force", action="store_true")
    p = add("asr", cmd_asr, "name", help="תמלול")
    p.add_argument("--engine", choices=["elevenlabs", "assemblyai", "parakeet"], default="parakeet")
    p.add_argument("--num-speakers", type=int)
    p.add_argument("--fp32", action="store_true", help="Parakeet בדיוק מלא (איטי יותר)")
    p = add("compare", cmd_compare, "name", help="השוואת שני תמלולים")
    p.add_argument("a")
    p.add_argument("b")
    p = add("edit-export", cmd_edit_export, "name", help="קובץ הגהה")
    p.add_argument("--from", dest="source")
    p.add_argument("--force", action="store_true")
    add("edit-import", cmd_edit_import, "name", help="ייבוא ההגהה")
    p = add("align", cmd_align, "name", help="יישור כפוי (Qwen + CTC + הכרעה)")
    p.add_argument("--device", default="cpu")
    p.add_argument("--no-ctc", action="store_true", help="בלי המנוע השני (מהיר יותר, פחות עמיד)")
    add("retime", cmd_retime, "name", help="זמנים חדשים לכתוביות קיימות אחרי יישור משופר")
    p = add("shots", cmd_shots, "name", help="חילופי שוטים")
    p.add_argument("--threshold", type=float)
    add("plan", cmd_plan, "name", help="תכנון כתוביות")
    p = add("tr-prep", cmd_tr_prep, "name", help="קובץ המקור לתרגום (tr/source.md)")
    p.add_argument("--size", type=int, default=150, help="כתוביות בחלק (= קובץ תשובה אחד)")
    p.add_argument("--batches", action="store_true", help="גם קובצי מנה נפרדים בפורמט הישן")
    add("tr-check", cmd_tr_check, "name", help="בדיקת תרגום")
    p = add("tr-merge", cmd_tr_merge, "name", help="איחוד תרגום")
    p.add_argument("--allow-missing", action="store_true")
    p = add("build", cmd_build, "name", help="בניית כתוביות + QC")
    p.add_argument("--style", choices=list(C.STYLES))
    add("breaks", cmd_breaks, "name", help="רשימת שבירות שורה לבדיקה")
    p = add("snapshot", cmd_snapshot, "name", help="עותק של התוצרים (לפני/אחרי)")
    p.add_argument("label")
    p = add("preview", cmd_preview, "name", help="תמונות בדיקה")
    p.add_argument("--ids")
    p.add_argument("--auto", type=int, default=12)
    p = add("render", cmd_render, "name", help="צריבה / MKV")
    p.add_argument("--burn", action="store_true", help="גם גרסה זהה למקור (בגודל המקור) — לבקשה")
    p.add_argument("--mkv", action="store_true", help="גם MKV: הווידאו המקורי + כתוביות שאפשר לכבות — לבקשה")
    p.add_argument("--clip", help="קטע בלבד, למשל 00:10:00-00:12:00")
    p.add_argument("--small", type=float, nargs="?", const=28.0,
                   help="גם עותק קטן לשליחה בצ'אט (עד 30MB; ברירת מחדל 28MB). לסרטון ארוך — Drive")
    p.add_argument("--codec", choices=["av1", "h264"], default="av1",
                   help="av1 (ברירת מחדל): בגודל המקור; h264: תאימות לנגנים ישנים מאוד, קובץ גדול פי 3–5")
    p.add_argument("--compact", action="store_true",
                   help="הגרסה הדחוסה (ברירת המחדל כשלא מבקשים דבר אחר; עם --burn/--mkv צריך לציין במפורש)")
    p.add_argument("--crf", type=int, help="דריסה ידנית (ברירת מחדל: כיול אוטומטי לגודל המקור)")
    p.add_argument("--preset", help="דריסה ידנית (av1: 9; h264: slow)")
    p.add_argument("--height", type=int, help="הקטנה (למשל 720) לקובץ קטן יותר")
    add("review-pack", cmd_review_pack, "name", help="חבילת ביקורת")
    add("review-gemini", cmd_review_gemini, "name", help="ביקורת חיצונית (Gemini)")
    p = add("publish", cmd_publish, "name", help="העלאת התוצרים ל־Drive (סרטונים + he.srt)")
    p.add_argument("--dest")
    p.add_argument("--all", action="store_true", help="גם he.ass, he.vtt ו־qc.md")
    add("status", cmd_status, "name", help="מצב השלבים")
    p = add("speakers", cmd_speakers, "name", help="הגדרת דוברים: S1='שם|תפקיד|m/f'")
    p.add_argument("items", nargs="+")
    p = sub.add_parser("drive", help="Drive: ls/get/put")
    p.set_defaults(fn=cmd_drive)
    p.add_argument("action", choices=["ls", "get", "put"])
    p.add_argument("path", nargs="?")
    p.add_argument("dest", nargs="?")
    p = sub.add_parser("doctor", help="בדיקת סביבה")
    p.set_defaults(fn=cmd_doctor)

    a = ap.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
