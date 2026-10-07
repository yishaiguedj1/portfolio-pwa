"""צילומי מסך "לפני / אחרי" לכל כתובית שהשתנתה — כדי לראות בעיניים כל תיקון.

שימוש:
  python tools/compare_shots.py <project_dir> <before_dir> <out_dir> [changes.json]

before_dir — עותק של out/ לפני התיקונים (he.ass + cues.final.json; vt build שומר רק את האחרון).
changes.json — הערות לכל תיקון (id, severity, category, source, note), למשל מהסוקר.
התוצאה: out_dir/img/<id>_before.jpg, <id>_after.jpg ו־out_dir/data.json לדף ההשוואה.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from vt.render import sub_filter  # noqa: E402


def frame(src: Path, ass: Path, t: float, out: Path, base: float, width: int = 854) -> None:
    vf = sub_filter(ass, base) + f",scale={width}:-2"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-copyts",
                    "-i", str(src), "-vf", vf, "-frames:v", "1", "-q:v", "4", str(out)], check=True)


def pick_time(b: dict | None, a: dict) -> tuple[float, float]:
    """זמן משותף שבו גם הכתובית הישנה וגם החדשה על המסך (אותו פריים בדיוק)."""
    if b:
        lo, hi = max(b["start"], a["start"]), min(b["end"], a["end"])
        if hi - lo > 0.12:
            t = lo + min(0.6, (hi - lo) * 0.4)
            return t, t
        return (b["start"] + b["end"]) / 2, (a["start"] + a["end"]) / 2
    return (a["start"] + a["end"]) / 2, (a["start"] + a["end"]) / 2


def main(proj: str, before_dir: str, out_dir: str, changes: str | None = None):
    p, bd, od = Path(proj), Path(before_dir), Path(out_dir)
    (od / "img").mkdir(parents=True, exist_ok=True)
    info = json.loads((p / "media.json").read_text())
    base = info.get("timeline_base", 0.0)
    src = next(p.glob("source.*"))
    before = {c["id"]: c for c in json.loads((bd / "cues.final.json").read_text())}
    after = {c["id"]: c for c in json.loads((p / "out" / "cues.final.json").read_text())}
    notes = {}
    if changes:
        for x in json.loads(Path(changes).read_text()):
            notes[x["id"]] = x
    en = {c["id"]: c["en"] for c in json.loads((p / "cues.en.json").read_text())}
    items = []
    for cid in sorted(set(before) | set(after)):
        b, a = before.get(cid), after.get(cid)
        if a is None or (b and b["lines"] == a["lines"]):
            continue
        n = notes.get(cid, {})
        same_text = b and " ".join(b["lines"]) == " ".join(a["lines"])
        tb, ta = pick_time(b, a)
        fb, fa = od / "img" / f"{cid}_before.jpg", od / "img" / f"{cid}_after.jpg"
        if b:
            frame(src, bd / "he.ass", tb, fb, base)
        frame(src, p / "out" / "he.ass", ta, fa, base)
        items.append({
            "id": cid, "t": round(ta, 2),
            "severity": n.get("severity", "minor"),
            "category": n.get("category", "שבירת שורה" if same_text else "עריכה"),
            "source": n.get("source", "עריכה עצמית"),
            "note": n.get("note", "שבירת השורה פיצלה צירוף אחד לשתי שורות — הועברה למקום הטבעי."
                          if same_text else ""),
            "en": en.get(cid, ""),
            "before": b["lines"] if b else [], "after": a["lines"],
            "img_before": f"img/{fb.name}" if b else None, "img_after": f"img/{fa.name}"})
        print(f"#{cid} {items[-1]['category']}", file=sys.stderr)
    order = {"critical": 0, "major": 1, "minor": 2}
    items.sort(key=lambda x: (order.get(x["severity"], 3), x["category"] == "שבירת שורה", x["id"]))
    (od / "data.json").write_text(json.dumps(items, ensure_ascii=False, indent=1))
    print(f"{len(items)} השוואות → {od}")


if __name__ == "__main__":
    main(*sys.argv[1:])
