/* taxil.js — מנוע מרכז המס הישראלי של Invest (מחקר-שדרוג-Invest.md, קבוצה ד). טהור: בלי DOM, בלי רשת.
   ⚠ "הערכה" עד שכל כלל עובר את שער האימות — כל כלל שלא אומת מול מקור ראשי מסומן ב־TI_RULES
   (verified:false) ומחזיר דגל, והמסך מציג "הערכה, לאמת מול רו״ח".
   קלטים: עסקאות Flex (ibkr-proxy/lib/ibkr.js → data.trades), תנועות מזומן (data.cashTransactions),
   ופונקציית שער fxOf(cur, 'YYYY-MM-DD') → שקלים למטבע (שער יציג ביום, או ביום הפרסום הקודם).
   כל הסכומים בשקלים, אלא אם כתוב אחרת. */

/* כללים לפי שנת מס — לא בקוד. ערך שלא אומת = verified:false (שער האימות). */
const TI_RULES = {
  base: {
    rate: 0.25,                 // רווח הון ריאלי ודיבידנד ליחיד (לא בעל מניות מהותי)
    surtax: { th: 721560, r: 0.03 },   // מס יסף (2024–2026 — אותה תקרה)
    capSurtax: null,            // שכבת ה־2% על הכנסה הונית (מ־2025)
    verified: { rate: false, fourCase: false, fifo: false, fees: false, offset: false, surtax: false, capSurtax: false, dividend: false },
  },
  2025: { capSurtax: { th: 721560, r: 0.02 } },   // ⚠ סף שכבת ה־2% — סתירה בין מקורות (721,560 מול 1.1 מיליון)
  2026: { capSurtax: { th: 721560, r: 0.02 } },
};
function tiRules(year) {
  const b = TI_RULES.base, y = TI_RULES[year] || TI_RULES[Object.keys(TI_RULES).filter((k) => /^\d{4}$/.test(k) && +k <= year).sort().pop()] || {};
  return Object.assign({}, b, y, { verified: Object.assign({}, b.verified, y.verified || {}) });
}

function tiNum(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function tiDate(d) { const s = String(d || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }

/* עסקאות Flex → צורה אחידה, מהישנה לחדשה (תאריך, שעה, מזהה עסקה) */
function tiNormTrades(trades) {
  const out = [];
  for (const t of (trades || [])) {
    if (!t || !t.symbol) continue;
    const date = tiDate(t.date), qtyS = tiNum(t.qty);
    if (!date || !qtyS) continue;
    const sideRaw = String(t.side || '').toUpperCase();
    const side = sideRaw === 'BUY' || sideRaw === 'SELL' ? sideRaw : (qtyS > 0 ? 'BUY' : 'SELL');
    const cur = String(t.currency || 'USD').toUpperCase();
    const feeCur = String(t.commissionCurrency || cur).toUpperCase();
    out.push({
      sym: String(t.symbol).trim().toUpperCase(), date: date, time: String(t.time || ''), id: String(t.tradeId || ''),
      side: side, qty: Math.abs(qtyS), price: Math.abs(tiNum(t.price)), cur: cur,
      fee: Math.abs(tiNum(t.commission)) + Math.abs(tiNum(t.taxes)), feeCur: feeCur,
      openClose: String(t.openClose || '').toUpperCase(),
    });
  }
  const idn = (s) => s.replace(/\D/g, '');
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
    const ia = idn(a.id), ib = idn(b.id);
    if (ia && ib && ia !== ib) return ia.length !== ib.length ? ia.length - ib.length : (ia < ib ? -1 : 1);
    return 0;
  });
  return out;
}

/* ארבעת המצבים: רווח בשקלים (gIls) מול רווח במטבע × שער המכירה (gFx).
   שניהם רווח → הנמוך; שניהם הפסד → ההפסד הקטן; סימנים שונים → 0. (verified.fourCase) */
function tiFourCase(gIls, gFx) {
  if (gIls > 0 && gFx > 0) return Math.min(gIls, gFx);
  if (gIls < 0 && gFx < 0) return Math.max(gIls, gFx);
  return 0;
}

/* מנוע המנות: FIFO לכל סימבול. עמלת קנייה נכנסת לעלות, עמלת מכירה יורדת מהתמורה (verified.fees).
   מחזיר {open:[מנות פתוחות], sales:[חלקי מכירה], issues:[בעיות נתונים]} */
function tiFifo(trades, fxOf) {
  const lots = new Map(); // sym -> [{...}]
  const sales = [], issues = [];
  const rate = (cur, d) => (cur === 'ILS' ? 1 : tiNum(fxOf && fxOf(cur, d)));
  for (const t of tiNormTrades(trades)) {
    if (t.feeCur !== t.cur) issues.push({ type: 'feeCur', sym: t.sym, date: t.date });
    const fx = rate(t.cur, t.date);
    if (!(fx > 0)) { issues.push({ type: 'noFx', sym: t.sym, date: t.date, cur: t.cur }); continue; }
    const q = lots.get(t.sym) || [];
    if (t.side === 'BUY') {
      q.push({ sym: t.sym, cur: t.cur, date: t.date, id: t.id, qty: t.qty, unit: t.price + t.fee / t.qty, fx: fx, qty0: t.qty });
      lots.set(t.sym, q);
      continue;
    }
    // מכירה: מתאימים למנות הוותיקות קודם
    let left = t.qty;
    const unitNet = t.price - t.fee / t.qty;
    while (left > 1e-9 && q.length) {
      const lot = q[0];
      const take = Math.min(left, lot.qty);
      const cost = take * lot.unit, proceeds = take * unitNet;
      const gIls = proceeds * fx - cost * lot.fx;
      const gFx = (proceeds - cost) * fx;
      sales.push({
        sym: t.sym, cur: t.cur, qty: take, buyDate: lot.date, sellDate: t.date, buyId: lot.id, sellId: t.id,
        cost: cost, proceeds: proceeds, fxBuy: lot.fx, fxSell: fx,
        costIls: cost * lot.fx, proceedsIls: proceeds * fx,
        gIls: gIls, gFx: gFx, taxable: t.cur === 'ILS' ? gIls : tiFourCase(gIls, gFx),
        // נייר שקלי: רווח נומינלי — הריאלי (לפי מדד) קטן ממנו; מסומן
        nominal: t.cur === 'ILS',
      });
      lot.qty -= take;
      left -= take;
      if (lot.qty <= 1e-9) q.shift();
    }
    if (left > 1e-9) issues.push({ type: 'noLots', sym: t.sym, date: t.date, qty: left });
    lots.set(t.sym, q);
  }
  const open = [];
  for (const q of lots.values()) for (const l of q) if (l.qty > 1e-9) open.push(l);
  return { open: open, sales: sales, issues: issues };
}

/* דיבידנדים וניכוי במקור מתנועות המזומן של Flex. התיאור של IBKR: "AAPL(US0378331005) Cash Dividend ..." */
function tiDividends(cashTx, fxOf) {
  const m = new Map();
  for (const c of (cashTx || [])) {
    const type = String((c && c.type) || '');
    const isDiv = /dividend|payment in lieu/i.test(type);
    const isWh = /withholding/i.test(type);
    const isInt = /interest/i.test(type) && !isWh;
    if (!isDiv && !isWh && !isInt) continue;
    const date = tiDate(c.date), amt = tiNum(c.amount);
    if (!date || !amt) continue;
    const desc = String(c.description || '');
    const sm = desc.match(/^\s*([A-Z0-9.]+)\s*\(/);
    const im = desc.match(/\(([A-Z]{2})[A-Z0-9]{9}\d\)/);
    const sym = isInt ? '' : (sm ? sm[1] : '');
    const cur = String(c.currency || 'USD').toUpperCase();
    const key = date + '|' + (isInt ? 'INT' : sym) + '|' + cur;
    const r = m.get(key) || { date: date, sym: sym, kind: isInt ? 'interest' : 'dividend', country: im ? im[1] : '', cur: cur, gross: 0, wh: 0 };
    if (isWh) r.wh += -amt; else r.gross += amt;     // ביטול ניכוי מגיע חיובי — מקטין את הניכוי
    if (!r.country && im) r.country = im[1];
    m.set(key, r);
  }
  const out = [];
  for (const r of m.values()) {
    const fx = r.cur === 'ILS' ? 1 : tiNum(fxOf && fxOf(r.cur, r.date));
    r.fx = fx > 0 ? fx : null;
    r.grossIls = r.fx ? r.gross * r.fx : null;
    r.whIls = r.fx ? r.wh * r.fx : null;
    r.whRate = r.gross > 0 ? r.wh / r.gross : null;
    out.push(r);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* שנת מס: קיזוז, מס רווח הון, דיבידנד וזיכוי, מס יסף.
   opts.carry — הפסד מועבר משנים קודמות (חיובי, בשקלים); opts.other — הכנסה חייבת אחרת (למס יסף; null = לא ידוע) */
function tiYear(year, sales, divs, opts) {
  const o = opts || {};
  const R = tiRules(year);
  const y = String(year);
  const ys = (sales || []).filter((s) => s.sellDate.slice(0, 4) === y);
  const yd = (divs || []).filter((d) => d.date.slice(0, 4) === y && d.grossIls != null);
  let gains = 0, losses = 0;
  for (const s of ys) { if (s.taxable > 0) gains += s.taxable; else losses -= s.taxable; }
  const div = yd.filter((d) => d.kind === 'dividend'), intr = yd.filter((d) => d.kind === 'interest');
  const divGross = div.reduce((a, d) => a + d.grossIls, 0), divWh = div.reduce((a, d) => a + d.whIls, 0);
  const intGross = intr.reduce((a, d) => a + d.grossIls, 0), intWh = intr.reduce((a, d) => a + d.whIls, 0);
  const carryIn = Math.max(0, tiNum(o.carry));
  let net = gains - losses, carryUsed = 0, carryOut = carryIn, offIncome = 0, taxable = 0;
  if (net >= 0) {
    carryUsed = Math.min(carryIn, net);
    taxable = net - carryUsed;
    carryOut = carryIn - carryUsed;
  } else {
    // הפסד שוטף: מול דיבידנד/ריבית מני״ע באותה שנה — רק בחלק שעליו יש מס ישראלי מעבר לזיכוי
    // (קיזוז מול דיבידנד שכבר נוכה במלואו בחו״ל לא מחזיר כסף ושורף הפסד שאפשר להעביר). (verified.offset)
    let left = -net;
    const base = Math.max(0, divGross + intGross - (divWh + intWh) / R.rate);
    offIncome = Math.min(left, base);
    left -= offIncome;
    carryOut = carryIn + left;
  }
  const cgTax = R.rate * taxable;
  const incGross = divGross + intGross, incWh = divWh + intWh;
  const israeliInc = R.rate * Math.max(0, incGross - offIncome);
  const credit = Math.min(incWh, israeliInc);
  const extraInc = Math.max(0, israeliInc - incWh);
  // מס יסף: על כל ההכנסה החייבת; השכבה ההונית — רק על החלק ההוני שמעל הסף
  const capital = taxable + Math.max(0, incGross - offIncome);
  const other = o.other == null ? null : Math.max(0, tiNum(o.other));
  const total = (other || 0) + capital;
  const s3 = R.surtax ? R.surtax.r * Math.max(0, total - R.surtax.th) : 0;
  const s2 = R.capSurtax ? R.capSurtax.r * Math.min(capital, Math.max(0, total - R.capSurtax.th)) : 0;
  const flags = [];
  for (const k of Object.keys(R.verified)) if (!R.verified[k]) flags.push(k);
  if (other == null) flags.push('otherUnknown');
  if (ys.some((s) => s.nominal)) flags.push('nominalIls');
  return {
    year: +year, rate: R.rate, sales: ys.length,
    gains: gains, losses: losses, net: net, carryIn: carryIn, carryUsed: carryUsed, carryOut: carryOut,
    offIncome: offIncome, taxable: taxable, cgTax: cgTax,
    div: { gross: divGross, wh: divWh, n: div.length }, interest: { gross: intGross, wh: intWh, n: intr.length },
    israeliInc: israeliInc, credit: credit, extraInc: extraInc,
    surtax: s3 + s2, surtax3: s3, surtax2: s2,
    due: cgTax + extraInc + s3 + s2, flags: flags,
  };
}

/* כמה שנים ברצף: ההפסד המועבר זורם משנה לשנה */
function tiYears(sales, divs, opts) {
  const o = opts || {};
  const ys = new Set();
  for (const s of (sales || [])) ys.add(+s.sellDate.slice(0, 4));
  for (const d of (divs || [])) ys.add(+d.date.slice(0, 4));
  const list = [...ys].filter((y) => y > 1990).sort((a, b) => a - b);
  let carry = Math.max(0, tiNum(o.carry));
  const out = [];
  for (const y of list) {
    const r = tiYear(y, sales, divs, { carry: carry, other: (o.other || {})[y] });
    carry = r.carryOut;
    out.push(r);
  }
  return out;
}

/* "המס אם אמכור היום": לכל מנה פתוחה — ארבעת המצבים מול מחיר ושער של היום.
   priceOf(sym) → מחיר במטבע הנייר; fxNow(cur) → שער היום. fee — עמלת מכירה משוערת למנה (במטבע) */
function tiUnrealized(open, priceOf, fxNow, fee) {
  const rows = [];
  for (const l of (open || [])) {
    const p = tiNum(priceOf && priceOf(l.sym));
    const fx = l.cur === 'ILS' ? 1 : tiNum(fxNow && fxNow(l.cur));
    if (!(p > 0) || !(fx > 0)) { rows.push(Object.assign({}, l, { missing: true })); continue; }
    const cost = l.qty * l.unit, proceeds = l.qty * p - tiNum(fee);
    const gIls = proceeds * fx - cost * l.fx, gFx = (proceeds - cost) * fx;
    rows.push(Object.assign({}, l, {
      price: p, fxNow: fx, value: l.qty * p * fx, gIls: gIls, gFx: gFx,
      fxPart: gIls - gFx,   // החלק שנבע מהשער (לא חייב, והפסד ממנו לא מתקזז)
      taxable: l.cur === 'ILS' ? gIls : tiFourCase(gIls, gFx), nominal: l.cur === 'ILS',
    }));
  }
  return rows;
}

/* קציר הפסדים: מנות שמכירתן היום יוצרת הפסד מוכר, ומה היה נחסך מול הרווח החייב שנשאר השנה.
   הפסד שכולו מירידת המטבע לא נוצר (ארבעת המצבים מחזירים 0). */
function tiHarvest(unreal, yearState) {
  const R = tiRules(yearState && yearState.year || new Date().getFullYear());
  let room = Math.max(0, tiNum(yearState && yearState.taxable));
  const c = (unreal || []).filter((u) => !u.missing && u.taxable < 0).sort((a, b) => a.taxable - b.taxable);
  return c.map((u) => {
    const use = Math.min(-u.taxable, room);
    room -= use;
    return { sym: u.sym, date: u.date, qty: u.qty, loss: -u.taxable, saves: R.rate * use, carry: -u.taxable - use };
  });
}

/* בריאות הנתונים: הכמות שהמנוע שחזר מהעסקאות מול האחזקות של IBKR (Flex). פער = חסרות עסקאות
   (היסטוריה חלקית, פיצול, העברת מניות) — וכל מספר המס של הסימבול לא אמין */
function tiCheck(open, positions) {
  const mine = new Map(), theirs = new Map();
  for (const l of (open || [])) mine.set(l.sym, (mine.get(l.sym) || 0) + l.qty);
  for (const p of (positions || [])) {
    const s = String((p && p.symbol) || '').toUpperCase();
    if (!s || /^(CASH|FX)/i.test(String(p.asset || ''))) continue;
    theirs.set(s, (theirs.get(s) || 0) + tiNum(p.qty));
  }
  const out = [];
  for (const s of new Set([...mine.keys(), ...theirs.keys()])) {
    const a = mine.get(s) || 0, b = theirs.get(s) || 0;
    if (Math.abs(a - b) > 1e-6) out.push({ sym: s, lots: a, broker: b, diff: b - a });
  }
  return out.sort((x, y) => (x.sym < y.sym ? -1 : 1));
}

/* W-8BEN: דיבידנד אמריקאי שנוכה בו יותר מ־25% (העודף לא חוזר בישראל) */
function tiW8(divs) {
  return (divs || []).filter((d) => d.kind === 'dividend' && d.country === 'US' && d.whRate != null && d.whRate > 0.26)
    .map((d) => ({ date: d.date, sym: d.sym, rate: d.whRate, lostIls: d.grossIls != null ? d.grossIls * (d.whRate - 0.25) : null }));
}

/* שער ביום או ביום הפרסום הקודם — rows [['YYYY-MM-DD', rate]] ממוין (op:'boifx') */
function tiRateOn(rows, iso) {
  let lo = 0, hi = (rows || []).length - 1, ans = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][0] <= iso) { ans = rows[mid][1]; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TI_RULES, tiRules, tiNormTrades, tiFourCase, tiFifo, tiDividends, tiYear, tiYears,
    tiUnrealized, tiHarvest, tiCheck, tiW8, tiRateOn,
  };
}
