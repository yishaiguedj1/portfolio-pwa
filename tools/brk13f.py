#!/usr/bin/env python3
"""v168: מייצר את טבלת BRK_13F של תיק הדמו (app.js) מדוחות 13F של ברקשייר האת'וויי ב־SEC.

הרצה (מחשב עם רשת — לא מהטלפון):  python3 tools/brk13f.py > /tmp/brk13f.js
ואז להחליף ב־app.js את הבלוק מ־`const BRK_13F_Q` עד סוף `const BRK_13F = {...};`.
לעדכן אחרי כל דוח רבעוני (אמצע פבר'/מאי/אוג'/נוב'). מידע ציבורי בלבד — אין כאן שום נתון של המשתמש.

- כל רבעון = הדוח המקורי + תיקונים (13F-HR/A חושפים אחזקות שהוסתרו זמנית, למשל CVX ב־2020, CB ב־2023).
- השווי בדוחות עד 2022-09-30 באלפי דולרים, מאז בדולרים.
- CUSIP → סימבול ב־CUSIP_MAP (None = אין היסטוריה ב־Yahoo). CUSIP חדש שלא במפה — מודפס ל־stderr; להוסיף.
- נכנס: כל מה שמוחזק היום + מה שהגיע אי פעם ל־MIN_WEIGHT מהתיק; ורק אם בקנה המידה SCALE זה לפחות מניה אחת.
"""
import json, os, sys, time, datetime, urllib.request, xml.etree.ElementTree as ET

# SEC דורשת User-Agent עם כתובת ליצירת קשר — אפשר להחליף ב־SEC_UA
UA = os.environ.get('SEC_UA', 'Mozilla/5.0 (research script) admin@example.com')
CIK = '1067983'
FROM_PERIOD = '2020-09-30'
SCALE = 1e-6          # ~$300K
MIN_WEIGHT = 0.35     # אחוזים
CUSIP_MAP = {
    '00287Y109': 'ABBV', '00507V109': None, '02005N100': 'ALLY', '02079K107': 'GOOG',
    '02079K305': 'GOOGL', '023135106': 'AMZN', '025816109': 'AXP', '037833100': 'AAPL',
    '047726302': 'BATRK', '060505104': 'BAC', '064058100': 'BNY', '067901108': 'B',
    '09062X103': 'BIIB', '110122108': 'BMY', '14040H105': 'COF', '150870103': 'CE',
    '16119P108': 'CHTR', '166764100': 'CVX', '172967424': 'C', '191216100': 'KO',
    '21036P108': 'STZ', '22160K105': 'COST', '23331A109': 'DHI', '23918K108': 'DVA',
    '247361702': 'DAL', '25243Q205': 'DEO', '25754A201': 'DPZ', '339750101': 'FND',
    '37045V100': 'GM', '37959E102': 'GL', '40434L105': 'HPQ', '422806208': 'HEI-A',
    '46625H100': 'JPM', '47233W109': 'JEF', '478160104': 'JNJ', '500754106': 'KHC',
    '501044101': 'KR', '512816109': 'LAMR', '526057104': 'LEN', '526057302': 'LEN-B',
    '530909100': 'LLYVA', '530909308': 'LLYVK', '531229409': None, '531229607': None,
    '531229722': 'LLYVK', '531229748': 'LLYVA', '531229755': 'FWONK', '531229789': None,
    '531229813': None, '531229854': 'FWONK', '546347105': 'LPX', '55261F104': 'MTB',
    '55616P104': 'M', '570535104': 'MKL', '571748102': 'MRSH', '57636Q104': 'MA',
    '58155Q103': 'MCK', '58933Y105': 'MRK', '609207105': 'MDLZ', '615369105': 'MCO',
    '62944T105': 'NVR', '650111107': 'NYT', '670346105': 'NUE', '674599105': 'OXY',
    '68622V106': 'OGN', '693475105': 'PNC', '717081103': 'PFE', '73278L105': 'POOL',
    '742718109': 'PG', '74967X103': 'RH', '78462F103': 'SPY', '82968B103': 'SIRI',
    '829933100': 'SIRI', '833445109': 'SNOW', '862121100': None, '867224107': 'SU',
    '87165B103': 'SYF', '872590104': 'TMUS', '874039100': 'TSM', '881624209': 'TEVA',
    '902973304': 'USB', '90384S303': 'ULTA', '911312106': 'UPS', '91324P102': 'UNH',
    '922908363': 'VOO', '92343E102': 'VRSN', '92343V104': 'VZ', '92556H206': 'PSKY',
    '92826C839': 'V', '92852X103': 'VTS', '949746101': 'WFC', 'G0176J109': 'ALLE',
    'G0403H108': 'AON', 'G0750C108': 'AXTA', 'G5480U104': 'LBTYA', 'G5480U120': 'LBTYK',
    'G6683N103': 'NU', 'G6693N103': 'NU', 'G7709Q104': 'RPRX', 'G85158106': 'STNE',
    'G9001E102': 'LILA', 'G9001E128': 'LILAK', 'H1467J104': 'CB',
}

def get(url, tries=4):
    for k in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read()
        except Exception:
            time.sleep(2 + 2 * k)
    raise RuntimeError('fetch failed: ' + url)

def info_table(folder):
    idx = json.loads(get('https://www.sec.gov/Archives/edgar/data/%s/%s/index.json' % (CIK, folder)))
    name = [x['name'] for x in idx['directory']['item'] if x['name'].endswith('.xml') and x['name'] != 'primary_doc.xml'][0]
    root = ET.fromstring(get('https://www.sec.gov/Archives/edgar/data/%s/%s/%s' % (CIK, folder, name)))
    agg = {}
    for it in root.iter():
        if not it.tag.endswith('infoTable'):
            continue
        g = lambda n: next((c.text for c in it.iter() if c.tag.endswith(n)), None)
        a = agg.setdefault(g('cusip'), {'name': g('nameOfIssuer'), 'value': 0.0})
        a['value'] += float(g('value'))
    return agg

def quarters():
    sub = json.loads(get('https://data.sec.gov/submissions/CIK%010d.json' % int(CIK)))['filings']['recent']
    fl = [(sub['reportDate'][i], sub['form'][i], sub['accessionNumber'][i]) for i in range(len(sub['form']))
          if sub['form'][i].startswith('13F-HR') and sub['reportDate'][i] >= FROM_PERIOD]
    Q = {}
    for period, form, acc in sorted(fl, key=lambda x: (x[0], x[1])):  # המקורי לפני התיקון
        k = 1000 if period <= '2022-09-30' else 1
        d = Q.setdefault(period, {})
        for c, a in info_table(acc.replace('-', '')).items():
            if c in d and form.endswith('/A'):
                continue
            d[c] = {'name': a['name'], 'value': a['value'] * k}
        time.sleep(0.3)
    return Q

HIST = {}
def history(sym):
    if sym not in HIST:
        try:
            r = json.loads(get('https://query2.finance.yahoo.com/v8/finance/chart/%s?range=10y&interval=1d' % sym))['chart']['result'][0]
            off = r['meta'].get('gmtoffset', 0)
            HIST[sym] = [(datetime.datetime.utcfromtimestamp(t + off).strftime('%Y-%m-%d'), c)
                         for t, c in zip(r['timestamp'], r['indicators']['quote'][0]['close']) if c]
        except Exception:
            HIST[sym] = []
        time.sleep(0.2)
    return HIST[sym]

def close_on_or_before(sym, d):
    best = None
    for dd, c in history(sym):
        if dd > d:
            break
        best = c
    return best

def main():
    Q = quarters()
    P = sorted(Q)
    V, unknown = {}, set()
    for p in P:
        for c, a in Q[p].items():
            if c not in CUSIP_MAP:
                unknown.add((c, a['name']))
                continue
            t = CUSIP_MAP[c]
            if t:
                V.setdefault(t, {})[p] = V.get(t, {}).get(p, 0) + a['value']
    for c, n in sorted(unknown):
        print('CUSIP חדש — להוסיף ל־CUSIP_MAP: %s %s' % (c, n), file=sys.stderr)
    tot = {p: sum(a['value'] for a in Q[p].values()) for p in P}
    keep = []
    for t, v in V.items():
        if not history(t):
            print('אין היסטוריה ב־Yahoo: %s' % t, file=sys.stderr)
            continue
        mx = max(v[p] / tot[p] for p in v) * 100
        if not (mx >= MIN_WEIGHT or P[-1] in v):
            continue
        shares = [v.get(p, 0) * SCALE / (close_on_or_before(t, p) or float('inf')) for p in P]
        if max(shares) >= 0.5:
            keep.append(t)
    keep.sort(key=lambda t: (-V[t].get(P[-1], 0), -max(V[t].values())))
    out = ["const BRK_13F_Q = [%s];" % ','.join("'%s'" % p for p in P), 'const BRK_13F = {']
    for t in keep:
        row = [round(V[t].get(p, 0) * SCALE) for p in P]
        while row and row[-1] == 0:
            row.pop()
        out.append("  '%s': [%s]," % (t, ','.join(str(x) for x in row)))
    out.append('};')
    print('\n'.join(out))

if __name__ == '__main__':
    main()
