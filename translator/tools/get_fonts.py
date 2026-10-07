"""הורדת הגופנים (Arimo Bold, ‏Assistant SemiBold) מ־Google Fonts אם חסרים — רישיון OFL / Apache.

Google Fonts מגיש WOFF לדפדפן ישן; fontTools ממיר ל־TTF (אותו גופן בדיוק, כולל עברית).
"""
import io
import re
import sys
import urllib.request
from pathlib import Path

FONTS = {"Arimo-Bold.ttf": "Arimo:wght@700", "Assistant-SemiBold.ttf": "Assistant:wght@600"}
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.59.8 "
      "(KHTML, like Gecko) Version/5.1.9 Safari/534.59.8")


def fetch(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60).read()


def main(dest: str = "fonts"):
    from fontTools.ttLib import TTFont
    d = Path(dest)
    d.mkdir(parents=True, exist_ok=True)
    for name, fam in FONTS.items():
        if (d / name).exists():
            continue
        css = fetch(f"https://fonts.googleapis.com/css2?family={fam}").decode()
        url = re.search(r"url\((https://fonts\.gstatic\.com[^)]+)\)", css).group(1)
        t = TTFont(io.BytesIO(fetch(url)))
        t.flavor = None
        t.save(str(d / name))
        print(f"✔ {name}")


if __name__ == "__main__":
    main(*sys.argv[1:])
