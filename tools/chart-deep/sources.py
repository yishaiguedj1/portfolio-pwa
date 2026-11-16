#!/usr/bin/env python3
"""בדיקת העומק של גרף הנרות (docs/chart-deep-audit.md) — המושכים של המקורות הבלתי תלויים.

כל מושך כותב קובץ אחיד: <out>/src/<מקור>/<SYM>/<iv>.json =
  { src, sym, iv, tz, conv, adj, vol, ext, at, bars: [[t, o, h, l, c, v], ...] }
  t = תחילת הנר בשניות UTC (גם ביומי ומעלה: תחילת היום/השבוע/החודש לפי מוסכמת המקור, ראו conv).
  conv = 'start' (תווית = תחילת הנר); adj = 'split' / 'none' / 'split+div'; vol = 'venue' (בורסה אחת) / 'consolidated'.

רק מקורות שתנאי השימוש שלהם מתירים גישה תכנותית לבדיקה פנימית (סעיף 4 במסמך):
  קריפטו — הממשקים הציבוריים של Coinbase Exchange, Bitstamp, Kraken ו־Binance (data-api.binance.vision);
  מט"ח — ECB (שער ייחוס) ובנק ישראל (שער יציג) — שפיות יומית בלבד;
  מניות — Massive/Polygon, Twelve Data ו־Tiingo — רק עם מפתח של המשתמש, שהפרוקסי מזריק (request_credential), אף פעם לא בקוד.
Nasdaq.com ו־Cboe לא כאן: התנאים שלהם אוסרים לכידה אוטומטית / שימוש לאימות מידע אחר (נבדק 16/11/2026).

שימוש:
  python3 -I tools/chart-deep/sources.py crypto --sym BTC-USD --out <dir> [--ivs 1m,5m,1h,1d] [--days 30]
  python3 -I tools/chart-deep/sources.py fx --out <dir>
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
    {'crypto': cmd_crypto, 'fx': cmd_fx}[A['cmd']](A)
