/* boifx.js — שער יציג של בנק ישראל (op:'boifx' ב־api/history.js) — מרכז המס של Invest.
   המקור: SDMX הרשמי של בנק ישראל (edge.boi.org.il), חינם, בלי מפתח. מהדפדפן ישירות הוא
   נכשל (בקשה עם Origin מחזירה 404), ולכן דרך השרתון. מידע ציבורי בלבד — אין כאן שום נתון של משתמש.
   קלט: {op:'boifx', cur:'USD', from:'YYYY-MM-DD'} · פלט: {ok, cur, rows:[['YYYY-MM-DD', rate], ...]} ממוין.
   מטמון בזיכרון: הסדרה המלאה לכל מטבע, 6 שעות (השער מתפרסם פעם ביום, בצהריים).
   03/11/2026: cur:'CPI' — מדד המחירים לצרכן, כללי (סדרה CP ב־PRI, חודשית, משורשרת — היחס בין חודשים תקף). כל חודש
   מוחזר בתאריך שבו הוא "המדד הידוע": ה־15 בחודש שאחריו (הלמ״ס מפרסמת ב־15 בערב — הערכה). כך tiRateOn נותן את המדד
   הידוע ביום העסקה: נייר שקלי ריאלי (88) והצמדה של עודף הזיכוי (205א). */
const CURS = new Set(['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CPI']);
const EARLIEST = '2000-01-01';
const TTL = 6 * 3600 * 1000;
const cache = new Map(); // cur -> {at, from, rows}
const UA = 'THE SNOWBALL Invest (tax center)';

function url(cur, from) {
  if (cur === 'CPI') return 'https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/PRI/1.0/CP?startperiod=' + from.slice(0, 7) + '&format=csv';
  return 'https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_' + cur +
    '_ILS?startperiod=' + from + '&format=csv';
}

/* CSV של SDMX → [[date, rate]]. עמודות לפי שם (TIME_PERIOD, OBS_VALUE), לא לפי מיקום. */
function parse(csv) {
  const lines = String(csv || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const head = lines[0].split(',');
  const iD = head.indexOf('TIME_PERIOD'), iV = head.indexOf('OBS_VALUE');
  if (iD < 0 || iV < 0) return [];
  const m = new Map();
  for (const ln of lines.slice(1)) {
    const c = ln.split(',');
    const d = c[iD], v = Number(c[iV]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d || '') && v > 0 && isFinite(v)) m.set(d, v);
    else if (/^\d{4}-\d{2}$/.test(d || '') && v > 0 && isFinite(v)) m.set(known(d), v);   // מדד חודשי → יום הפרסום
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/* 'YYYY-MM' → 'YYYY-MM-15' של החודש הבא (היום שבו המדד של החודש הזה ידוע) */
function known(ym) {
  let y = +ym.slice(0, 4), m = +ym.slice(5, 7) + 1;
  if (m > 12) { m = 1; y++; }
  return y + '-' + String(m).padStart(2, '0') + '-15';
}

async function fetchSeries(cur, from) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url(cur, from), { headers: { 'User-Agent': UA, Accept: 'text/csv' }, signal: ctl.signal });
    if (r.status !== 200) return null;
    const rows = parse(await r.text());
    return rows.length ? rows : null;
  } catch (e) { return null; } finally { clearTimeout(to); }
}

async function handle(body, res) {
  const cur = String((body && body.cur) || 'USD').toUpperCase();
  let from = String((body && body.from) || '');
  if (!CURS.has(cur) || (from && !/^\d{4}-\d{2}-\d{2}$/.test(from))) return res.status(400).json({ ok: false, error: 'bad_params' });
  if (!from || from < EARLIEST) from = EARLIEST;
  if (cur === 'CPI') {   // המדד הידוע ביום from פורסם עד חודשיים לפניו
    const d = new Date(Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 3, 1));
    from = d.toISOString().slice(0, 10);
  }
  const hit = cache.get(cur);
  const fresh = hit && Date.now() - hit.at < TTL && hit.from <= from;
  let rows = fresh ? hit.rows : null;
  if (!rows) {
    // תמיד מושכים מהמוקדם שנדרש עד כה — בקשה אחת משרתת את כל המשתמשים
    const start = hit && hit.from < from ? hit.from : from;
    rows = await fetchSeries(cur, start);
    if (rows) cache.set(cur, { at: Date.now(), from: start, rows: rows });
    else if (hit) rows = hit.rows; // בנק ישראל לא ענה — המטמון הישן עדיף על כלום
  }
  if (!rows) return res.status(502).json({ ok: false, error: 'upstream' });
  const out = rows.filter((r) => r[0] >= from);
  if (cur === 'CPI') { const prev = rows.filter((r) => r[0] < from).pop(); if (prev) out.unshift(prev); }
  res.setHeader && res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json({ ok: true, cur: cur, src: 'boi', rows: out });
}

module.exports = { handle, _parse: parse, _cache: cache, CURS };
