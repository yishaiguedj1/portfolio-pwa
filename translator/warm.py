"""הכנת המודלים מראש — רץ בתהליך נפרד כשהסוכן עולה (agent.py), לא בתוך עבודה.

למה: (1) קובץ מודל שהורד חלקית מתגלה בכשל *אחרי* שההגהה כבר שולמה; (2) כל עבודה ראשונה אחרי עדכון
חיכתה להורדה של כ־3GB. כאן מורידים ומוודאים בזמן שאין עבודה. רק הורדה ובדיקת גודל — בלי לטעון את המודלים
לזיכרון (הסוכן עצמו נשאר קטן). כל תקלה = הודעה, אף פעם לא מפילה את הסוכן: העבודה תוריד בעצמה כמו קודם.
"""

from __future__ import annotations

import os
import sys
import urllib.request
from pathlib import Path

QWEN_ALIGNER = 'Qwen/Qwen3-ForcedAligner-0.6B'      # = MODEL_ID ב־vt/align.py


def remote_size(url: str, opener=urllib.request.urlopen) -> int:
    req = urllib.request.Request(url, method='HEAD')
    with opener(req, timeout=30) as r:
        return int(r.headers.get('Content-Length') or 0)


def ensure_file(url: str, dest: Path, opener=urllib.request.urlopen, download=None) -> str:
    """קובץ שלם במטמון: קיים בגודל הנכון → 'ok'; חסר/קטוע → הורדה מחדש ובדיקה → 'fixed'.
    torch.hub לא בודק גודל או hash — קובץ קטוע נשאר במטמון ומפיל כל עבודה (09/10/2026)."""
    want = remote_size(url, opener)
    if dest.exists() and want and dest.stat().st_size == want:
        return 'ok'
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + '.part')
    if download is None:
        import torch
        download = lambda u, p: torch.hub.download_url_to_file(u, str(p), progress=False)   # noqa: E731
    download(url, tmp)
    got = tmp.stat().st_size
    if want and got != want:
        tmp.unlink()
        raise OSError(f'הורדה קטועה ({got} מתוך {want} בתים)')
    tmp.replace(dest)
    return 'fixed'


def mms_fa() -> str:
    import torch
    import torchaudio
    url = torchaudio.pipelines.MMS_FA._path
    dest = Path(torch.hub.get_dir()) / 'checkpoints' / os.path.basename(url)
    return ensure_file(url, dest)


def qwen_aligner() -> str:
    from huggingface_hub import snapshot_download
    snapshot_download(QWEN_ALIGNER)       # מוודא כל קובץ מול ה־etag של Hugging Face; קיים ושלם → בלי הורדה
    return 'ok'


def main() -> int:
    bad = 0
    for name, fn in (('מודל היישור (Qwen)', qwen_aligner), ('מודל ה־CTC (MMS_FA)', mms_fa)):
        try:
            r = fn()
            print('✓ ' + name + (' — הורד מחדש' if r == 'fixed' else ' מוכן'), flush=True)
        except Exception as e:     # noqa: BLE001 — הכנה מראש בלבד; העבודה תוריד בעצמה
            bad += 1
            print('· ' + name + ': לא הוכן מראש (' + type(e).__name__ + ': ' + str(e)[:120] + ')', flush=True)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
