# בונה OPF אחיד + EPUB חדש לכל מכתב באפט (בלי לגעת בטקסט, בסדר הקריאה או ב־dc:identifier) — הורץ 04/10/2026.
# שימוש: python3 build.py <תיקיית עבודה> [--author buffett|bezos] [שנים...]
#   בתיקיית העבודה: list.txt (שורה לכל מכתב: "שנה גודל מזהה־קובץ"), src/<מזהה>.epub (המקור), covers/cover-<שנה>.jpg
#   התוצר: out/<שנה>.epub. קבצי המכתבים והתמונות לא נכנסים לריפו.
import zipfile, re, html, json, sys, os
from xml.sax.saxutils import escape
HERE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.getcwd()
# פרופיל לכל כותב — כל השדות האחידים של הסדרה (החלטות המשתמש, 04/10/2026)
AUTHORS = {
    'buffett': dict(
        title='מכתב באפט %d', subtitle="מכתב לבעלי המניות של ברקשייר האת'וויי",
        creator='וורן א. באפט', file_as='באפט, וורן א.', creator_en='Warren E. Buffett',
        publisher="ברקשייר האת'וויי", publisher_en='Berkshire Hathaway Inc.',
        series='מכתבי באפט לבעלי המניות', subjects=('השקעות', 'מכתבי בעלי מניות', "ברקשייר האת'וויי"),
        desc="המכתב השנתי לבעלי המניות של ברקשייר האת'וויי לשנת %d, בתרגום לעברית.",
        source='Berkshire Hathaway Inc., %d Letter to Shareholders',
        rights='תרגום לעברית לשימוש אישי. הטקסט המקורי © Berkshire Hathaway Inc.',
        # 1965–1969 נחתמו בפועל על ידי צ'ייס — חותמים (sgn), הכותב נשאר באפט
        signers={1965: ["מלקולם ג'י. צ'ייס ג'וניור", "קנת' וי. צ'ייס"], 1966: ["מלקולם ג'י. צ'ייס ג'וניור", "קנת' וי. צ'ייס"],
                 1967: ["מלקולם ג'י. צ'ייס ג'וניור", "קנת' וי. צ'ייס"], 1968: ["קנת' וי. צ'ייס"], 1969: ["קנת' וי. צ'ייס"]},
        special={2025: dict(subtitle='מכתב חג ההודיה',
                            desc="הודעת חג ההודיה של וורן א. באפט לבעלי המניות של ברקשייר האת'וויי, נובמבר 2025, בתרגום לעברית.",
                            source='Berkshire Hathaway Inc., Thanksgiving letter, November 2025')}),
    'bezos': dict(
        title='מכתב בזוס %d', subtitle='מכתב לבעלי המניות של אמזון',
        creator="ג'פרי פ. בזוס", file_as="בזוס, ג'פרי פ.", creator_en='Jeffrey P. Bezos',
        publisher='אמזון', publisher_en='Amazon.com, Inc.',
        series='מכתבי בזוס לבעלי המניות', subjects=('השקעות', 'מכתבי בעלי מניות', 'אמזון'),
        desc='המכתב השנתי לבעלי המניות של אמזון לשנת %d, בתרגום לעברית.',
        source='Amazon.com, Inc., %d Letter to Shareholders',
        rights='תרגום לעברית לשימוש אישי. הטקסט המקורי © Amazon.com, Inc.',
        signers={}, special={}),
}
A = AUTHORS['buffett']

def date_for(y):
    return str(y)   # החלטת המשתמש: התאריך = השנה שבשם הקובץ (אחיד לכל המכתבים)

def plan(y):
    sp = A['special'].get(y, {})
    return dict(title=A['title'] % y, subtitle=sp.get('subtitle', A['subtitle']), date=date_for(y),
                signers=A['signers'].get(y, []), desc=sp.get('desc', A['desc'] % y), source=sp.get('source', A['source'] % y))

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
    a('<dc:creator id="creator">%s</dc:creator>' % escape(A['creator']))
    a('<meta refines="#creator" property="role" scheme="marc:relators">aut</meta>')
    a('<meta refines="#creator" property="file-as">%s</meta>' % escape(A['file_as']))
    a('<meta refines="#creator" property="alternate-script" xml:lang="en">%s</meta>' % escape(A['creator_en']))
    for k, s in enumerate(p['signers'], 1):
        a('<dc:contributor id="signer%d">%s</dc:contributor>' % (k, escape(s)))
        a('<meta refines="#signer%d" property="role" scheme="marc:relators">sgn</meta>' % k)
    a('<dc:publisher id="publisher">%s</dc:publisher>' % escape(A['publisher']))
    a('<meta refines="#publisher" property="alternate-script" xml:lang="en">%s</meta>' % escape(A['publisher_en']))
    if p['date']: a('<dc:date>%s</dc:date>' % p['date'])
    a('<dc:language>he</dc:language>')
    a('<dc:source>%s</dc:source>' % escape(p['source']))
    for s in A['subjects']: a('<dc:subject>%s</dc:subject>' % escape(s))
    a('<dc:description>%s</dc:description>' % escape(p['desc']))
    a('<dc:rights>%s</dc:rights>' % escape(A['rights']))
    a('<meta property="belongs-to-collection" id="series">%s</meta>' % escape(A['series']))
    a('<meta refines="#series" property="collection-type">series</meta>')
    a('<meta refines="#series" property="group-position">%d</meta>' % y)
    a('<meta name="calibre:series" content="%s"/>' % escape(A['series']))
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
    args = sys.argv[2:]
    if '--author' in args:
        k = args.index('--author'); A = AUTHORS[args[k + 1]]; del args[k:k + 2]
    os.makedirs(HERE + '/out', exist_ok=True)
    for line in open(HERE + '/list.txt'):
        y, sz, i = line.split(); y = int(y)
        if args and str(y) not in args: continue
        build(HERE + '/src/%s.epub' % i, HERE + '/out/%d.epub' % y, y, HERE + '/covers/cover-%d.jpg' % y)
        print(y, os.path.getsize(HERE + '/out/%d.epub' % y))
