#!/usr/bin/env python3
"""מחולל ibkr-proxy/lib/damodaran.json — נתוני הענפים של Damodaran (NYU) למחשבון הערכת השווי.

מקור: https://pages.stern.nyu.edu/~adamodar/ (חינם, "no strings attached"; ייחוס מבוקש — מוצג באפליקציה).
מה נלקח: בטא לא ממונפת מתוקנת למזומן וגם הממונפת (betas.xls — הממונפת לבנקים וביטוח, שם החוב הוא חומר הגלם),
שולי רווח (margin.xls), מכפילים (pedata.xls), מכפיל ההון ותשואה על ההון (pbvdata.xls),
ופרמיית הסיכון של ישראל (ctrypremXXX.xlsx — הקובץ האחרון; מתעדכן בינואר, אפריל ויולי).
פרמיית השוק האמריקאית (ERP) מתעדכנת כל חודש — עדכון ידני של ERP/ERP_DATE למטה, מ־ERPbymonth.xlsx.

הרצה (צריך xlrd ו־openpyxl):
  pip install xlrd openpyxl
  python3 tools/damodaran.py           # מוריד ומעדכן את הקובץ
  python3 tools/damodaran.py --dir D   # מקבצים שכבר ירדו לתיקייה D

לעדכן: אחרי עדכון נתוני הענפים (ינואר), ובכל רבעון לפרמיית המדינה.
"""
import json, os, sys, urllib.request, datetime as dt

BASE = 'https://pages.stern.nyu.edu/~adamodar/pc/datasets/'
FILES = ['betas.xls', 'margin.xls', 'pedata.xls', 'pbvdata.xls']
CTRY = 'ctrypremJuly26.xlsx'          # הקובץ הרבעוני האחרון — להחליף כשיוצא חדש
ERP = 0.042                           # ERPbymonth.xlsx — ERP מרומז, 1/10/2026
ERP_DATE = '2026-10-01'
RF_IL = 0.0407                        # אג"ח ממשלתי שקלי ל־10 שנים (אין API חינמי — עדכון ידני)
RF_IL_DATE = '2026-04-30'
OUT = os.path.join(os.path.dirname(__file__), '..', 'ibkr-proxy', 'lib', 'damodaran.json')
UA = 'Mozilla/5.0 (compatible; TheSnowball/1.0)'


def fetch(name, d):
  p = os.path.join(d, name)
  if not os.path.exists(p):
    url = BASE + name
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
      open(p, 'wb').write(r.read())
  return p


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
  il = {}
  try: il = israel(fetch(CTRY, d))
  except Exception as e: print('אזהרה: פרמיית ישראל לא נקראה:', e)
  out = {'v': 1, 'src': 'Damodaran Online (NYU Stern)', 'asOf': dt.date.today().isoformat(),
         'erp': ERP, 'erpDate': ERP_DATE, 'rfIL': RF_IL, 'rfILDate': RF_IL_DATE,
         'crpIL': il.get('crp'), 'taxIL': il.get('tax'), 'ratingIL': il.get('rating'), 'ind': ind}
  json.dump(out, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
  print('נכתב', OUT, len(ind), 'ענפים', 'ישראל', il)


if __name__ == '__main__':
  main()
