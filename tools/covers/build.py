# בונה OPF אחיד + EPUB חדש לכל מכתב באפט (בלי לגעת בטקסט, בסדר הקריאה או ב־dc:identifier) — הורץ 04/10/2026.
# שימוש: python3 build.py <תיקיית עבודה> [שנים...]
#   בתיקיית העבודה: list.txt (שורה לכל מכתב: "שנה גודל מזהה־קובץ"), src/<מזהה>.epub (המקור), covers/cover-<שנה>.jpg
#   התוצר: out/<שנה>.epub. קבצי המכתבים והתמונות לא נכנסים לריפו.
import zipfile, re, html, json, sys, os
from xml.sax.saxutils import escape
HERE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.getcwd()
CHACE = {1965: ["מלקולם ג'י. צ'ייס ג'וניור", "קנת' וי. צ'ייס"], 1966: ["מלקולם ג'י. צ'ייס ג'וניור", "קנת' וי. צ'ייס"],
         1967: ["מלקולם ג'י. צ'ייס ג'וניור", "קנת' וי. צ'ייס"], 1968: ["קנת' וי. צ'ייס"], 1969: ["קנת' וי. צ'ייס"]}
SERIES = "מכתבי באפט לבעלי המניות"

def date_for(y):
    return str(y)   # החלטת המשתמש: התאריך = השנה שבשם הקובץ (אחיד לכל המכתבים)

def plan(y):
    sub = "מכתב חג ההודיה" if y == 2025 else "מכתב לבעלי המניות של ברקשייר האת'וויי"
    desc = ("הודעת חג ההודיה של וורן א. באפט לבעלי המניות של ברקשייר האת'וויי, נובמבר 2025, בתרגום לעברית." if y == 2025
            else "המכתב השנתי לבעלי המניות של ברקשייר האת'וויי לשנת %d, בתרגום לעברית." % y)
    src = ("Berkshire Hathaway Inc., Thanksgiving letter, November 2025" if y == 2025
           else "Berkshire Hathaway Inc., %d Letter to Shareholders" % y)
    return dict(title="מכתב באפט %d" % y, subtitle=sub, date=date_for(y), signers=CHACE.get(y, []), desc=desc, source=src)

def new_opf(opf, y):
    p = plan(y)
    uid = re.search(r'unique-identifier="([^"]+)"', opf).group(1)
    ident = re.search(r'<dc:identifier[^>]*id="%s"[^>]*>.*?</dc:identifier>' % re.escape(uid), opf, re.S).group(0)
    m = []
    a = m.append
    a(ident)
    a('<dc:title id="title">%s</dc:title>' % escape(p['title']))
    a('<meta refines="#title" property="title-type">main</meta>')
    a('<dc:title id="subtitle">%s</dc:title>' % escape(p['subtitle']))
    a('<meta refines="#subtitle" property="title-type">subtitle</meta>')
    a('<dc:creator id="creator">וורן א. באפט</dc:creator>')
    a('<meta refines="#creator" property="role" scheme="marc:relators">aut</meta>')
    a('<meta refines="#creator" property="file-as">באפט, וורן א.</meta>')
    a('<meta refines="#creator" property="alternate-script" xml:lang="en">Warren E. Buffett</meta>')
    for k, s in enumerate(p['signers'], 1):
        a('<dc:contributor id="signer%d">%s</dc:contributor>' % (k, escape(s)))
        a('<meta refines="#signer%d" property="role" scheme="marc:relators">sgn</meta>' % k)
    a("<dc:publisher id=\"publisher\">ברקשייר האת'וויי</dc:publisher>")
    a('<meta refines="#publisher" property="alternate-script" xml:lang="en">Berkshire Hathaway Inc.</meta>')
    if p['date']: a('<dc:date>%s</dc:date>' % p['date'])
    a('<dc:language>he</dc:language>')
    a('<dc:source>%s</dc:source>' % escape(p['source']))
    for s in ("השקעות", "מכתבי בעלי מניות", "ברקשייר האת'וויי"): a('<dc:subject>%s</dc:subject>' % escape(s))
    a('<dc:description>%s</dc:description>' % escape(p['desc']))
    a('<dc:rights>%s</dc:rights>' % escape("תרגום לעברית לשימוש אישי. הטקסט המקורי © Berkshire Hathaway Inc."))
    a('<meta property="belongs-to-collection" id="series">%s</meta>' % SERIES)
    a('<meta refines="#series" property="collection-type">series</meta>')
    a('<meta refines="#series" property="group-position">%d</meta>' % y)
    a('<meta name="calibre:series" content="%s"/>' % SERIES)
    a('<meta name="calibre:series_index" content="%d"/>' % y)
    a('<meta name="cover" content="cover-image"/>')
    a('<meta property="dcterms:modified">2026-10-04T00:00:00Z</meta>')
    # שמירה על מאפייני תצוגה קיימים (כיוון כתיבה/פריסה), אם היו
    for keep in re.findall(r'<meta property="(?:rendition:[a-z]+|primary-writing-mode|ibooks:specified-fonts)">[^<]*</meta>', opf): a(keep)
    md_open = re.search(r'<metadata[^>]*>', opf).group(0)
    if 'xmlns:dc' not in md_open: md_open = md_open[:-1] + ' xmlns:dc="http://purl.org/dc/elements/1.1/">'
    body = md_open + '\n' + '\n'.join(m) + '\n</metadata>'
    out = re.sub(r'<metadata[^>]*>.*?</metadata>', lambda _: body, opf, count=1, flags=re.S)
    # כריכה: רק פריט במניפסט (לא עמוד בסדר הקריאה — כדי לא להזיז מיקומים/הדגשות)
    out = re.sub(r'\s*<item[^>]*properties="cover-image"[^>]*/>', '', out)
    out = re.sub(r'\s*<item[^>]*id="cover-image"[^>]*/>', '', out)
    out = out.replace('</manifest>', '<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>\n</manifest>', 1)
    if 'xml:lang=' not in re.search(r'<package[^>]*>', out).group(0):
        out = out.replace('<package ', '<package xml:lang="he" ', 1)
    if 'prefix=' not in out[:400]:
        out = out.replace('<package ', '<package prefix="calibre: https://calibre-ebook.com" ', 1)
    return out

def build(src, dst, y, cover_jpg):
    zi = zipfile.ZipFile(src)
    opf_path = re.search(r'full-path="([^"]+)"', zi.read('META-INF/container.xml').decode()).group(1)
    base = os.path.dirname(opf_path)
    with zipfile.ZipFile(dst, 'w') as zo:
        zo.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        for info in zi.infolist():
            if info.filename == 'mimetype': continue
            if info.filename == base + '/images/cover.jpg': continue
            data = zi.read(info.filename)
            if info.filename == opf_path: data = new_opf(data.decode('utf8'), y).encode('utf8')
            zo.writestr(info.filename, data, compress_type=zipfile.ZIP_DEFLATED)
        zo.write(cover_jpg, (base + '/' if base else '') + 'images/cover.jpg', compress_type=zipfile.ZIP_STORED)

if __name__ == '__main__':
    os.makedirs(HERE + '/out', exist_ok=True)
    for line in open(HERE + '/list.txt'):
        y, sz, i = line.split(); y = int(y)
        if sys.argv[2:] and str(y) not in sys.argv[2:]: continue
        build(HERE + '/src/%s.epub' % i, HERE + '/out/%d.epub' % y, y, HERE + '/covers/cover-%d.jpg' % y)
        print(y, os.path.getsize(HERE + '/out/%d.epub' % y))
