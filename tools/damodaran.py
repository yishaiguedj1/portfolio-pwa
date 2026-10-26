#!/usr/bin/env python3
"""מחולל ibkr-proxy/lib/damodaran.json — נתוני הענפים של Damodaran (NYU) למחשבון הערכת השווי.

מקור: https://pages.stern.nyu.edu/~adamodar/ (חינם, "no strings attached"; ייחוס מבוקש — מוצג באפליקציה).
מה נלקח: בטא לא ממונפת מתוקנת למזומן וגם הממונפת (betas.xls — הממונפת לבנקים וביטוח, שם החוב הוא חומר הגלם),
שולי רווח (margin.xls), מכפילים (pedata.xls), מכפיל ההון ותשואה על ההון (pbvdata.xls),
ופרמיית הסיכון של ישראל (ctrypremXXX.xlsx — הקובץ האחרון; מתעדכן בינואר, אפריל ויולי).
פרמיית השוק האמריקאית (ERP) — מ־ERPbymonth.xlsx (החודש האחרון, העמודה של Damodaran עצמו), וקובץ פרמיית המדינה
החדש ביותר נמצא לבד. ERP/CTRY למטה = רק גיבוי כשהקובץ לא נקרא. הריבית השקלית (RF_IL) — עדיין ידנית.
רץ אוטומטית ב־3 לכל חודש (.github/workflows/damodaran.yml), וכותב רק כשמשהו השתנה.

הרצה (צריך xlrd ו־openpyxl):
  pip install --require-hashes -r tools/damodaran-requirements.txt
  python3 tools/damodaran.py           # מוריד ומעדכן את הקובץ
  python3 tools/damodaran.py --dir D   # מקבצים שכבר ירדו לתיקייה D

לעדכן: אחרי עדכון נתוני הענפים (ינואר), ובכל רבעון לפרמיית המדינה.
"""
import json, os, sys, urllib.request, datetime as dt

BASE = 'https://pages.stern.nyu.edu/~adamodar/pc/datasets/'
FILES = ['betas.xls', 'margin.xls', 'pedata.xls', 'pbvdata.xls']
CTRY = 'ctrypremJuly26.xlsx'          # גיבוי בלבד — הקובץ החדש ביותר נמצא לבד (ctry_names)
ERP = 0.042                           # גיבוי בלבד — ERPbymonth.xlsx, 1/10/2026
ERP_COL = 'ERP (T12 m with sustainable payout)'  # ה־ERP שלו בראש הקובץ
ERP_DATE = '2026-10-01'
RF_IL = 0.0407                        # אג"ח ממשלתי שקלי ל־10 שנים (אין API חינמי — עדכון ידני)
RF_IL_DATE = '2026-04-30'
OUT = os.path.join(os.path.dirname(__file__), '..', 'ibkr-proxy', 'lib', 'damodaran.json')
UA = 'Mozilla/5.0 (compatible; TheSnowball/1.0)'


def fetch(name, d, base=BASE):
  p = os.path.join(d, name)
  if not os.path.exists(p):
    url = base + name
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
      data = r.read()
    if data[:2] != b'PK' and data[:4] != b'\xd0\xcf\x11\xe0':  # xlsx = zip, xls = OLE — דף שגיאה לא נשמר
      raise ValueError('not a spreadsheet: ' + name)
    open(p, 'wb').write(data)
  return p


MON = {1: ['Jan', 'January'], 4: ['Apr', 'April'], 7: ['July', 'Jul'], 10: ['Oct', 'October']}


def ctry_names(today):
  """שמות אפשריים לקובץ פרמיית המדינה (ctrypremJuly26.xlsx), מהחדש לישן — רבעון אחורה, עד שנתיים."""
  out, y, m = [], today.year, today.month
  for _ in range(24):
    for w in MON.get(m, []):
      out.append('ctryprem%s%02d.xlsx' % (w, y % 100))
    m -= 1
    if m == 0: y, m = y - 1, 12
  return out


def latest_erp(path):
  """(ERP, תאריך) מהחודש האחרון ב־'Historical ERP' — רק ערך סביר (2%–9%), אחרת None."""
  import openpyxl
  b = openpyxl.load_workbook(path, read_only=True, data_only=True)
  rows = b['Historical ERP'].iter_rows(values_only=True)
  hdr = [str(x).strip() if x is not None else '' for x in next(rows)]
  i = hdr.index(ERP_COL)
  best = None
  for r in rows:
    if len(r) <= i: continue
    d, v = r[0], r[i]
    if isinstance(d, dt.datetime) and isinstance(v, (int, float)) and 0.02 <= v <= 0.09:
      best = (round(v, 4), d.date().isoformat())
  return best


def sheet_rows(path):
  if path.endswith('.xls'):
    import xlrd
    b = xlrd.open_workbook(path)
    s = b.sheet_by_name('Industry Averages')
    return [[c.value for c in s.row(r)] for r in range(s.nrows)]
  import openpyxl
  b = openpyxl.load_workbook(path, read_only=True, data_only=True)
  return [b, None]


def table(path, cols):
  rows = sheet_rows(path)
  hdr = next(i for i, r in enumerate(rows) if str(r[0]).strip().startswith('Industry Name'))
  names = [str(x).strip() for x in rows[hdr]]
  idx = {}
  for key, want in cols.items():
    idx[key] = next(i for i, n in enumerate(names) if n.startswith(want))
  out = {}
  for r in rows[hdr + 1:]:
    n = str(r[0]).strip()
    if not n: continue
    v = {}
    for key, i in idx.items():
      x = r[i]
      v[key] = round(x, 4) if isinstance(x, float) else None
    out[n] = v
  return out


def israel(path):
  """גיליון 'ERPs by country': מדינה | אזור | דירוג | מרווח | ERP כולל | פרמיית מדינה ...;
  שיעור המס — בגיליון 'Regional Weighted Averages' (עמודה 7)."""
  import openpyxl
  b = openpyxl.load_workbook(path, read_only=True, data_only=True)
  out = {}
  for row in b['ERPs by country'].iter_rows(values_only=True):
    if row and row[0] == 'Israel':
      out['crp'] = round(row[5], 4); out['erpIL'] = round(row[4], 4); out['rating'] = row[2]
      break
  for row in b['Regional Weighted Averages'].iter_rows(values_only=True):
    if row and row[0] == 'Israel' and isinstance(row[6], (int, float)):
      out['tax'] = round(row[6], 4)
      break
  return out


def main():
  d = sys.argv[sys.argv.index('--dir') + 1] if '--dir' in sys.argv else os.path.join(os.path.dirname(OUT), '.damodaran')
  os.makedirs(d, exist_ok=True)
  beta = table(fetch('betas.xls', d), {'bu': 'Unlevered beta corrected', 'bl': 'Beta', 'n': 'Number of firms'})
  marg = table(fetch('margin.xls', d), {'gm': 'Gross Margin', 'om': 'Pre-tax Unadjusted Operating', 'nm': 'Net Margin', 'sbc': 'Stock-Based Compensation'})
  pe = table(fetch('pedata.xls', d), {'fpe': 'Forward PE', 'ape': 'Aggregate Mkt Cap/ Trailing', 'g5': 'Expected growth'})
  pbv = table(fetch('pbvdata.xls', d), {'pbv': 'PBV', 'roe': 'ROE'})
  ind = {}
  for n, b in beta.items():
    r = dict(b); r.update(marg.get(n, {})); r.update(pe.get(n, {})); r.update(pbv.get(n, {}))
    r['n'] = int(r['n']) if r.get('n') else None
    ind[n] = r
  il, ctry = {}, None
  for name in ctry_names(dt.date.today()) + [CTRY]:
    try: il = israel(fetch(name, d)); ctry = name; break
    except Exception: continue
  if not il: print('אזהרה: פרמיית ישראל לא נקראה — נשאר הערך הקודם')
  erp, erp_date = ERP, ERP_DATE
  try:
    got = latest_erp(fetch('ERPbymonth.xlsx', d, 'https://pages.stern.nyu.edu/~adamodar/pc/implprem/'))
    if got: erp, erp_date = got
    else: print('אזהרה: לא נמצא ERP בקובץ — הגיבוי', ERP)
  except Exception as e: print('אזהרה: ERPbymonth לא נקרא — הגיבוי', ERP, e)
  old = {}
  try: old = json.load(open(OUT))
  except Exception: pass
  # שומר: ירידה גדולה במספר הענפים / ענף השוק חסר = קובץ שבור — לא דורסים
  if len(ind) < 0.85 * len(old.get('ind') or {}) or 'Total Market' not in ind:
    print('שגיאה: נתוני הענפים לא שלמים —', len(ind), 'ענפים. לא נכתב.'); sys.exit(1)
  out = {'v': 1, 'src': 'Damodaran Online (NYU Stern)', 'asOf': dt.date.today().isoformat(),
         'erp': erp, 'erpDate': erp_date, 'rfIL': RF_IL, 'rfILDate': RF_IL_DATE,
         'crpIL': il.get('crp', old.get('crpIL')), 'taxIL': il.get('tax', old.get('taxIL')), 'ratingIL': il.get('rating', old.get('ratingIL')), 'ind': ind}
  same = {k: v for k, v in out.items() if k != 'asOf'} == {k: v for k, v in old.items() if k != 'asOf'}
  if same:
    print('לא השתנה — הקובץ נשאר כמו שהוא'); return
  json.dump(out, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
  print('נכתב', OUT, len(ind), 'ענפים', 'ERP', erp, erp_date, 'ישראל', ctry, il)


if __name__ == '__main__':
  main()
