#!/usr/bin/env python3
"""בדיקת העומק של גרף הנרות (docs/chart-deep-audit.md) — המושכים של המקורות הבלתי תלויים.

כל מושך כותב קובץ אחיד: <out>/src/<מקור>/<SYM>/<iv>.json =
  { src, sym, iv, tz, conv, adj, vol, ext, at, bars: [[t, o, h, l, c, v], ...] }
  t = תחילת הנר בשניות UTC (גם ביומי ומעלה: תחילת היום/השבוע/החודש לפי מוסכמת המקור, ראו conv).
  conv = 'start' (תווית = תחילת הנר); adj = 'split' / 'none' / 'split+div'; vol = 'venue' (בורסה אחת) / 'consolidated'.

רק מקורות בלי הרשמה ובלי תשלום (החלטת המשתמש 16/11/2026: "מקורות כמו Yahoo שלא דורשים טוקנים או תשלום"),
ורק כאלה שתנאי השימוש שלהם לא אוסרים גישה תכנותית לבדיקה פנימית (סעיף 4 במסמך). קצב נמוך, הפלט לא מוצג ולא נשמר בריפו:
  קריפטו — הממשקים הציבוריים של Coinbase Exchange, Bitstamp ו־Binance (data-api.binance.vision, מול USDT);
  מט"ח — ECB (שער ייחוס) ובנק ישראל (שער יציג) — שפיות יומית בלבד;
  מניות — Webull (בלי מפתח: יומי/שבועי/חודשי בלבד — בתוך־יומי בלי התחברות מחזיר נר אחד; גולמי ומותאם פיצול+דיבידנד);
          מפתחות ההדגמה הציבוריים (apikey=demo, מתפרסמים בתיעוד של הספקים): Twelve Data — AAPL בלבד, כל המרווחים כולל
          45 דק׳/שעתיים/4 שעות שהספק מצרף בעצמו; EODHD — AAPL/TSLA/AMZN/VTI/BTC/EURUSD, דקה (כולל טרום/אחרי, עם נפח), 5 דק׳, שעה, יומי גולמי.
לא כאן: Nasdaq.com ו־Cboe (התנאים אוסרים לכידה אוטומטית / שימוש לאימות מידע אחר, נבדק 16/11/2026);
  אתר הבורסה בת"א (הממשק חסום מהקונטיינר, ולא עוקפים חסימות) — ת"א נבדקת מול Yahoo עצמו בין מרווחים ומול צילומים.
שימוש:
  python3 -I tools/chart-deep/sources.py crypto --sym BTC-USD --out <dir> [--ivs 1m,5m,1h,1d] [--days 30]
  python3 -I tools/chart-deep/sources.py fx --out <dir>
  python3 -I tools/chart-deep/sources.py stocks --syms AAPL,NVDA --out <dir> [--src webull,twelvedata,eodhd]
הפלט (מחירים ציבוריים) נשאר מחוץ לריפו.
"""
import csv
import io
import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone, timedelta

UA = 'Mozilla/5.0 (X11; Linux x86_64) chart-deep-audit/1.0'
DAY = 86400


def get(url, headers=None, tries=4, pause=0.0):
    """GET עם ניסיונות חוזרים. מחזיר טקסט. אף פעם לא מדפיס כותרות (מפתח מוזרק בפרוקסי)."""
    h = {'User-Agent': UA, 'Accept': 'application/json'}
    h.update(headers or {})
    last = None
    for i in range(tries):
        if pause:
            time.sleep(pause)
        try:
            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 502, 503, 504):
                time.sleep(15 * (i + 1))
                continue
            raise
        except Exception as e:  # רשת
            last = e
            time.sleep(5 * (i + 1))
    raise RuntimeError('נכשל: %s (%s)' % (url.split('?')[0], last))


def save(out, src, sym, iv, bars, **meta):
    d = os.path.join(out, 'src', src, sym)
    os.makedirs(d, exist_ok=True)
    bars = sorted({b[0]: b for b in bars}.values())  # בלי כפילויות, לפי זמן
    rec = dict(src=src, sym=sym, iv=iv, at=int(time.time()), bars=bars)
    rec.update(meta)
    with open(os.path.join(d, iv + '.json'), 'w') as f:
        json.dump(rec, f)
    return len(bars)


# ---------------------------------------------------------------- קריפטו
# המרווחים של כל בורסה (שניות). נר = תחילת הנר ב־UTC בכולן.
CB_GRAN = {'1m': 60, '5m': 300, '15m': 900, '1h': 3600, '6h': 21600, '1d': 86400}
BS_STEP = {'1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400}
BN_IV = {'1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '2h': '2h', '4h': '4h', '1d': '1d', '1w': '1w', '1M': '1M'}
CB_PAIR = {'BTC-USD': 'BTC-USD', 'ETH-USD': 'ETH-USD'}
BS_PAIR = {'BTC-USD': 'btcusd', 'ETH-USD': 'ethusd'}
BN_PAIR = {'BTC-USD': 'BTCUSDT', 'ETH-USD': 'ETHUSDT'}   # USDT — לא דולר; בסיס קטן, מסומן


def coinbase(sym, iv, t0, t1):
    g = CB_GRAN[iv]
    out = []
    end = t1
    while end > t0:
        start = max(t0, end - g * 300)
        u = ('https://api.exchange.coinbase.com/products/%s/candles?granularity=%d&start=%s&end=%s' %
             (CB_PAIR[sym], g, iso(start), iso(end)))
        rows = json.loads(get(u, pause=0.2))
        # [time, low, high, open, close, volume]
        out += [[int(r[0]), float(r[3]), float(r[2]), float(r[1]), float(r[4]), float(r[5])] for r in rows if t0 <= r[0] < t1]
        end = start
    return out


def bitstamp(sym, iv, t0, t1):
    step = BS_STEP[iv]
    out = []
    start = t0
    while start < t1:
        u = 'https://www.bitstamp.net/api/v2/ohlc/%s/?step=%d&limit=1000&start=%d' % (BS_PAIR[sym], step, start)
        rows = json.loads(get(u, pause=0.25)).get('data', {}).get('ohlc', [])
        if not rows:
            break
        for r in rows:
            t = int(r['timestamp'])
            if t0 <= t < t1:
                out.append([t, float(r['open']), float(r['high']), float(r['low']), float(r['close']), float(r['volume'])])
        nxt = int(rows[-1]['timestamp']) + step
        if nxt <= start:
            break
        start = nxt
    return out


def binance(sym, iv, t0, t1):
    out = []
    start = t0 * 1000
    while start < t1 * 1000:
        u = ('https://data-api.binance.vision/api/v3/klines?symbol=%s&interval=%s&limit=1000&startTime=%d&endTime=%d' %
             (BN_PAIR[sym], BN_IV[iv], start, t1 * 1000 - 1))
        rows = json.loads(get(u, pause=0.15))
        if not rows:
            break
        out += [[int(r[0] // 1000), float(r[1]), float(r[2]), float(r[3]), float(r[4]), float(r[5])] for r in rows]
        nxt = int(rows[-1][0]) + 1
        if nxt <= start:
            break
        start = nxt
    return out


def iso(t):
    return datetime.fromtimestamp(t, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def cmd_crypto(a):
    now = int(time.time())
    ivs = a.get('ivs', '1m,5m,15m,30m,1h,2h,4h,1d,1w,1M').split(',')
    for iv in ivs:
        # עומק: כמו השרתון (1m — 29 יום; 2m–30m — 59; 60m — 729; יומי ומעלה — הכל מ־2014)
        days = {'1m': 30, '3m': 30, '5m': 60, '15m': 60, '30m': 60, '1h': 730, '2h': 730, '4h': 730}.get(iv, 4500)
        t0 = now - days * DAY
        t0 -= t0 % 60
        for name, fn, ok in (('coinbase', coinbase, CB_GRAN), ('bitstamp', bitstamp, BS_STEP), ('binance', binance, BN_IV)):
            if iv not in ok:
                continue
            try:
                bars = fn(a['sym'], iv, t0, now)
                n = save(a['out'], name, a['sym'], iv, bars, tz='UTC', conv='start', adj='none', vol='venue', ext='24x7',
                         quote='USDT' if name == 'binance' else 'USD')
                print(name, a['sym'], iv, n)
            except Exception as e:
                print(name, a['sym'], iv, 'שגיאה:', e)


# ---------------------------------------------------------------- מט"ח (שפיות יומית)
def cmd_fx(a):
    out = a['out']
    # ECB: דולר לאירו (EURUSD=X) ושקל לאירו — שער ייחוס ~14:15 CET
    for cur in ('USD', 'ILS'):
        txt = get('https://data-api.ecb.europa.eu/service/data/EXR/D.%s.EUR.SP00.A?startPeriod=2014-01-01&format=csvdata' % cur, {'Accept': 'text/csv'})
        rows = list(csv.reader(io.StringIO(txt)))
        hdr = rows[0]
        it, iv = hdr.index('TIME_PERIOD'), hdr.index('OBS_VALUE')
        bars = []
        for p in rows[1:]:
            if len(p) > iv and p[iv]:
                d = datetime.strptime(p[it], '%Y-%m-%d').replace(tzinfo=timezone.utc)
                x = float(p[iv])
                bars.append([int(d.timestamp()), x, x, x, x, 0])
        print('ecb', cur, save(out, 'ecb', 'EUR' + cur, '1d', bars, tz='Europe/Berlin', conv='fix-14:15CET', adj='none', vol='none', ext=''))
    # בנק ישראל: שער יציג דולר־שקל (ILS=X)
    txt = get('https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS?startperiod=2014-01-01&format=csv', {'Accept': 'text/csv'})
    rows = list(csv.reader(io.StringIO(txt)))
    hdr = rows[0]
    it, iv = hdr.index('TIME_PERIOD'), hdr.index('OBS_VALUE')
    bars = []
    for p in rows[1:]:
        if len(p) > iv and p[iv]:
            d = datetime.strptime(p[it][:10], '%Y-%m-%d').replace(tzinfo=timezone.utc)
            x = float(p[iv])
            bars.append([int(d.timestamp()), x, x, x, x, 0])
    print('boi USDILS', save(out, 'boi', 'USDILS', '1d', bars, tz='Asia/Jerusalem', conv='fix-rep', adj='none', vol='none', ext=''))


# ---------------------------------------------------------------- מניות
def nyd(t):
    """תאריך הנר (YYYY-MM-DD) לפי ניו יורק — מפתח ההשוואה ביומי ומעלה"""
    from zoneinfo import ZoneInfo
    return datetime.fromtimestamp(t, ZoneInfo('America/New_York')).strftime('%Y-%m-%d')


def day_t(ds):
    """'YYYY-MM-DD' → חצות UTC של התאריך (conv='date': התווית היא התאריך, לא רגע)"""
    return int(datetime.strptime(ds[:10], '%Y-%m-%d').replace(tzinfo=timezone.utc).timestamp())


WB = 'https://quotes-gw.webullfintech.com/api'
WB_TYPE = {'1d': 'd1', '1wk': 'w1', '1mo': 'mth1'}


def wb_id(out, sym):
    f = os.path.join(out, 'src', 'webull', 'ids.json')
    ids = json.load(open(f)) if os.path.exists(f) else {}
    if sym in ids:
        return ids[sym]
    want = sym.replace('-', '.')   # BRK-B → BRK.B
    j = json.loads(get(WB + '/search/pc/tickers?keyword=%s&pageIndex=1&pageSize=20' % urllib.parse.quote(want), pause=1.0))
    hit = [x for x in j.get('data', []) if x.get('symbol') == want and x.get('regionCode') == 'US']
    ids[sym] = hit[0]['tickerId'] if hit else None
    os.makedirs(os.path.dirname(f), exist_ok=True)
    json.dump(ids, open(f, 'w'))
    return ids[sym]


def webull(tid, iv, rt, pages=14):
    """rt=0 גולמי, rt=1 מותאם פיצול+דיבידנד. שורה: t,o,c,h,l,סגירה_קודמת,v,vwap; מהחדש לישן; t = חצות ניו יורק של היום"""
    out, ts = [], int(time.time())
    for _ in range(pages):
        u = WB + '/quote/charts/query?tickerIds=%s&type=%s&count=800&restorationType=%d&loadFactor=1&extendTrading=0&timestamp=%d' % (tid, WB_TYPE[iv], rt, ts)
        j = json.loads(get(u, pause=1.2))
        rows = (j[0].get('data') if j else None) or []
        n0 = len(out)
        for r in rows:
            f = r.split(',')
            if 'null' in f[:5]:
                continue
            t = int(f[0])
            out.append([day_t(nyd(t)), float(f[1]), float(f[3]), float(f[4]), float(f[2]), float(f[6]) if f[6] != 'null' else 0.0])
        if not rows or len(out) == n0 or not (j[0].get('hasMore')):
            break
        ts = min(int(r.split(',')[0]) for r in rows) - 1
    return out


TD_IV = {'1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min', '45m': '45min', '1h': '1h', '2h': '2h', '4h': '4h',
         '1d': '1day', '1wk': '1week', '1mo': '1month'}


def twelvedata(sym, iv, pages):
    """מפתח ההדגמה (AAPL בלבד): עד 5000 נרות לבקשה, 8 בקשות לדקה. timezone=UTC → תוך־יומי = תחילת הנר ב־UTC; יומי ומעלה = תאריך"""
    out, end = [], None
    for _ in range(pages):
        u = 'https://api.twelvedata.com/time_series?symbol=%s&interval=%s&outputsize=5000&apikey=demo&timezone=UTC&order=DESC' % (sym, TD_IV[iv])
        if end:
            u += '&end_date=' + urllib.parse.quote(end)
        j = json.loads(get(u, pause=8.6))
        if j.get('status') != 'ok':
            raise RuntimeError(str(j.get('message', j))[:160])
        vals = j.get('values') or []
        for x in vals:
            d = x['datetime']
            t = day_t(d) if len(d) == 10 else int(datetime.strptime(d, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc).timestamp())
            out.append([t, float(x['open']), float(x['high']), float(x['low']), float(x['close']), float(x.get('volume') or 0)])
        if len(vals) < 5000:
            break
        end = vals[-1]['datetime']
    return out


EOD_SYM = {'AAPL': 'AAPL.US', 'TSLA': 'TSLA.US', 'AMZN': 'AMZN.US', 'VTI': 'VTI.US', 'BTC-USD': 'BTC-USD.CC', 'EURUSD=X': 'EURUSD.FOREX'}


def eodhd(sym, iv, days):
    """מפתח ההדגמה. תוך־יומי: datetime ב־UTC = תחילת הנר (דקה כולל טרום/אחרי). יומי: מחיר גולמי, נפח מותאם פיצול, adjusted_close בנפרד"""
    s = EOD_SYM[sym]
    now = int(time.time())
    if iv == '1d':
        j = json.loads(get('https://eodhd.com/api/eod/%s?from=1980-01-01&api_token=demo&fmt=json' % s, pause=1.0))
        return [[day_t(x['date']), x['open'], x['high'], x['low'], x['close'], x.get('volume') or 0] for x in j if x.get('close')]
    j = json.loads(get('https://eodhd.com/api/intraday/%s?interval=%s&from=%d&to=%d&api_token=demo&fmt=json' % (s, iv, now - days * DAY, now), pause=1.0))
    return [[int(x['timestamp']), x['open'], x['high'], x['low'], x['close'], x.get('volume') or 0] for x in j if x.get('close') is not None]


def cmd_stocks(a):
    out = a['out']
    srcs = a.get('src', 'webull,twelvedata,eodhd').split(',')
    for sym in a['syms'].split(','):
        if 'webull' in srcs and not sym.startswith('^') and '.' not in sym and '=' not in sym:
            try:
                tid = wb_id(out, sym)
                if tid:
                    for iv in ('1d', '1wk', '1mo'):
                        for rt, name in ((0, 'webull'), (1, 'webull-adj')):
                            if rt and iv != '1d':
                                continue
                            n = save(out, name, sym, iv, webull(tid, iv, rt), tz='America/New_York', conv='date', adj='none' if rt == 0 else 'split+div',
                                     vol='consolidated', ext='rth')
                            print(name, sym, iv, n)
                else:
                    print('webull', sym, 'לא נמצא')
            except Exception as e:
                print('webull', sym, 'שגיאה:', e)
        if 'twelvedata' in srcs and sym == 'AAPL':
            for iv, pages in (('1m', 3), ('5m', 1), ('15m', 1), ('30m', 1), ('45m', 1), ('1h', 1), ('2h', 1), ('4h', 1), ('1d', 2), ('1wk', 1), ('1mo', 1)):
                try:
                    n = save(out, 'twelvedata', sym, iv, twelvedata(sym, iv, pages), tz='UTC', conv='date' if iv in ('1d', '1wk', '1mo') else 'start',
                             adj='split', vol='?', ext='rth')
                    print('twelvedata', sym, iv, n)
                except Exception as e:
                    print('twelvedata', sym, iv, 'שגיאה:', e)
        if 'eodhd' in srcs and sym in EOD_SYM:
            for iv, days in (('1m', 30), ('5m', 60), ('1h', 730), ('1d', 0)):
                try:
                    n = save(out, 'eodhd', sym, iv, eodhd(sym, iv, days), tz='UTC', conv='date' if iv == '1d' else 'start',
                             adj='none' if iv == '1d' else 'split', vol='?', ext='ext' if iv == '1m' else '?')
                    print('eodhd', sym, iv, n)
                except Exception as e:
                    print('eodhd', sym, iv, 'שגיאה:', e)


def parse_args(argv):
    a = {'cmd': argv[0] if argv else ''}
    i = 1
    while i < len(argv):
        k = argv[i].lstrip('-')
        a[k] = argv[i + 1] if i + 1 < len(argv) else ''
        i += 2
    return a


if __name__ == '__main__':
    A = parse_args(sys.argv[1:])
    {'crypto': cmd_crypto, 'fx': cmd_fx, 'stocks': cmd_stocks}[A['cmd']](A)
