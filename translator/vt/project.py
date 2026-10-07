"""תיקיית עבודה לכל ראיון ומצב השלבים שלה (project.json)."""

from __future__ import annotations

import os
import re
import time
from pathlib import Path

from .config import ROOT, DEFAULT_STYLE
from .util import read_json, write_json, die


def work_root() -> Path:
    return Path(os.environ.get("VT_WORK", str(ROOT / "work"))).resolve()


def slugify(name: str) -> str:
    s = re.sub(r"[^\w\-]+", "-", name.strip().lower(), flags=re.UNICODE).strip("-")
    return s or "interview"


class Project:
    def __init__(self, name: str):
        self.name = slugify(name)
        self.dir = work_root() / self.name
        self.meta_path = self.dir / "project.json"

    # --- נתיבים ---
    def p(self, *parts: str) -> Path:
        return self.dir.joinpath(*parts)

    @property
    def tr_dir(self) -> Path:
        return self.p("tr")

    @property
    def out_dir(self) -> Path:
        return self.p("out")

    # --- מטא־דאטה ---
    def exists(self) -> bool:
        return self.meta_path.exists()

    def load(self) -> dict:
        if not self.exists():
            die(f"אין פרויקט בשם '{self.name}' ב־{work_root()} (צרו עם: python -m vt new {self.name} …)")
        return read_json(self.meta_path)

    def save(self, meta: dict) -> None:
        meta["updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
        write_json(self.meta_path, meta)

    def create(self, source: str, title: str = "") -> dict:
        self.dir.mkdir(parents=True, exist_ok=True)
        meta = {
            "name": self.name, "title": title or self.name, "source": source,
            "created": time.strftime("%Y-%m-%d %H:%M:%S"),
            "speakers": {},
            "keyterms": [],
            "settings": {"style": DEFAULT_STYLE, "timing": {}, "text": {}, "shot_threshold": 10.0},
            "stages": {},
        }
        self.save(meta)
        return meta

    def mark(self, stage: str, **info) -> None:
        meta = self.load()
        meta.setdefault("stages", {})[stage] = {"at": time.strftime("%Y-%m-%d %H:%M:%S"), **info}
        self.save(meta)

    def source_path(self) -> Path | None:
        for f in sorted(self.dir.glob("source.*")):
            return f
        return None


STAGES = [
    ("ingest", "קליטת הסרטון וחילוץ אודיו", "python -m vt ingest {n}"),
    ("asr", "תמלול (מנוע אחד לפחות)", "python -m vt asr {n} --engine elevenlabs|parakeet"),
    ("edit_export", "ייצוא קובץ הגהה", "python -m vt edit-export {n}"),
    ("edit_import", "הגהה ידנית של en.edit.txt וייבוא", "python -m vt edit-import {n}"),
    ("align", "יישור כפוי של כל מילה", "python -m vt align {n}"),
    ("shots", "זיהוי חילופי שוטים", "python -m vt shots {n}"),
    ("plan", "תכנון הכתוביות", "python -m vt plan {n}"),
    ("tr_prep", "הכנת מנות תרגום", "python -m vt tr-prep {n}"),
    ("tr_merge", "תרגום + בדיקה + איחוד", "python -m vt tr-check {n}  →  python -m vt tr-merge {n}"),
    ("build", "בניית הכתוביות ובקרת איכות", "python -m vt build {n}"),
    ("render", "צריבה / MKV", "python -m vt render {n}"),
]
