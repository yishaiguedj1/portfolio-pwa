/* taxil.js — מנוע מרכז המס הישראלי של Invest (מחקר-שדרוג-Invest.md, קבוצה ד). טהור: בלי DOM, בלי רשת.
   שער האימות (01/11/2026, מול נוסח הפקודה, חוזר מ״ה 22/2002 וע״א 3555/15 מוזס — דנ״א 7517/16 נדחה):
   הכללים כאן אומתו; מקורות וציטוטים ב־docs/invest.md "מרכז המס". כלל שלא אומת = verified:false → דגל,
   והמסך מציג "הערכה". זה עדיין לא תחליף לרו״ח.
   קלטים: עסקאות Flex (ibkr-proxy/lib/ibkr.js → data.trades), תנועות מזומן (data.cashTransactions),
   ופונקציית שער fxOf(cur, 'YYYY-MM-DD') → שקלים למטבע (שער יציג ביום, או ביום הפרסום הקודם).
   כל הסכומים בשקלים, אלא אם כתוב אחרת. */

/* כללים לפי שנת מס — לא בקוד. ערך שלא אומת = verified:false (שער האימות). */
const TI_RULES = {
  base: {
    rate: 0.25,                 // 91(ב)(1), 125ב — רווח הון ריאלי ודיבידנד ליחיד (30% לבעל מניות מהותי — לא נתמך)
    surtax: { th: 721560, r: 0.03 },   // 121ב(א) — 721,560 ₪ ב־2024–2027
    capSurtax: null,            // 121ב(א1) — מ־2025
    // fourCase: 88 (שער המטבע הוא המדד — חובה ליחיד) + מוזס; המקרה המעורב (סימנים שונים → 0) נגזר מהמנגנון.
    // fifo: חוזר 22/2002 §1.5.1 (בתוך חשבון). fees: דברי ההסבר ל־1325. offset: 92(א)(1),(3),(4), 92(ב).
    // creditCarry: האם זיכוי מס זר שלא נוצל (אחרי קיזוז הפסד מול דיבידנד) עובר לשנה הבאה — לא אומת.
    verified: { rate: true, fourCase: true, fifo: true, fees: true, offset: true, surtax: true, capSurtax: true, dividend: true, creditCarry: false },
  },
  2025: { capSurtax: { th: 721560, r: 0.02 } },   // 2% על ההכנסה ההונית בלבד שמעל אותו סף (1.1 מיליון — לא קיים בחוק)
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
      isin: String(t.isin || '').toUpperCase(), country: String(t.country || '').toUpperCase(),
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
      q.push({ sym: t.sym, cur: t.cur, date: t.date, id: t.id, qty: t.qty, unit: t.price + t.fee / t.qty, fx: fx, qty0: t.qty, isin: t.isin, country: t.country });
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
        isin: t.isin || lot.isin || '', country: t.country || lot.country || '',
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
    // הפסד שוטף: 92(א)(4) — "יקוזז" (חובה) גם כנגד ריבית/דיבידנד מני״ע באותה שנה (שיעור עד 25%).
    // מול דיבידנד שנוכה בו מס בחו״ל זה שורף גם את ההפסד וגם את הזיכוי (creditLost) — המסך מזהיר.
    // היתרה מועברת — 92(ב): רק כנגד רווח הון, בלי הגבלת שנים, בתנאי שהוגש דוח לשנת ההפסד.
    let left = -net;
    offIncome = Math.min(left, divGross + intGross);
    left -= offIncome;
    carryOut = carryIn + left;
  }
  const cgTax = R.rate * taxable;
  const incGross = divGross + intGross, incWh = divWh + intWh;
  const israeliInc = R.rate * Math.max(0, incGross - offIncome);
  const credit = Math.min(incWh, israeliInc);
  const extraInc = Math.max(0, israeliInc - incWh);
  const creditLost = Math.max(0, incWh - credit);
  // מס יסף: 3% על כל ההכנסה החייבת מעל הסף; 2% על ההכנסה ההונית לבדה מעל אותו סף. בלי הסכום האינפלציוני
  // (החייב כאן כבר ריאלי). לא נכלל במקדמה החצי־שנתית — 121ב(ב).
  const capital = taxable + Math.max(0, incGross - offIncome);
  const other = o.other == null ? null : Math.max(0, tiNum(o.other));
  const total = (other || 0) + capital;
  const s3 = R.surtax ? R.surtax.r * Math.max(0, total - R.surtax.th) : 0;
  const s2 = R.capSurtax ? R.capSurtax.r * Math.max(0, capital - R.capSurtax.th) : 0;
  const flags = [];
  for (const k of Object.keys(R.verified)) if (!R.verified[k] && (k !== 'creditCarry' || creditLost > 0)) flags.push(k);
  if (other == null) flags.push('otherUnknown');
  if (ys.some((s) => s.nominal)) flags.push('nominalIls');
  return {
    year: +year, rate: R.rate, sales: ys.length,
    gains: gains, losses: losses, net: net, carryIn: carryIn, carryUsed: carryUsed, carryOut: carryOut,
    offIncome: offIncome, taxable: taxable, cgTax: cgTax,
    div: { gross: divGross, wh: divWh, n: div.length }, interest: { gross: intGross, wh: intWh, n: intr.length },
    israeliInc: israeliInc, credit: credit, extraInc: extraInc, creditLost: creditLost,
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
  // 92(א)(4): מה שלא מקזז רווח הון מקזז חובה דיבידנד/ריבית של השנה — ושם, אם נוכה מס בחו״ל, הזיכוי אובד
  let incRoom = Math.max(0, tiNum(yearState && yearState.div && yearState.div.gross) + tiNum(yearState && yearState.interest && yearState.interest.gross) - tiNum(yearState && yearState.offIncome));
  return c.map((u) => {
    const use = Math.min(-u.taxable, room);
    room -= use;
    const onInc = Math.min(-u.taxable - use, incRoom);
    incRoom -= onInc;
    return { sym: u.sym, date: u.date, qty: u.qty, loss: -u.taxable, saves: R.rate * use, onIncome: onInc, carry: -u.taxable - use - onInc };
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

/* דוח לרו״ח (ד8) — טיוטה לשנה אחת: שורות 1325 (מכירה לכל חלק FIFO), סיכום 1322, דיבידנדים וריבית ל־1324.
   שורות בלבד — הכותרות והקובץ (CSV) בממשק (taxcenter.js), כדי שיהיו בשפת המשתמש. Y = tiYear של אותה שנה */
function tiReport(year, sales, divs, Y) {
  const y = String(year);
  const s1325 = (sales || []).filter((s) => s.sellDate.slice(0, 4) === y).map((s) => ({
    sym: s.sym, isin: s.isin || '', country: s.country || (s.isin ? s.isin.slice(0, 2) : ''), qty: s.qty,
    buyDate: s.buyDate, sellDate: s.sellDate, cur: s.cur, cost: s.cost, proceeds: s.proceeds, fxBuy: s.fxBuy, fxSell: s.fxSell,
    costIls: s.costIls, proceedsIls: s.proceedsIls, gIls: s.gIls, gFx: s.gFx, taxable: s.taxable, nominal: !!s.nominal,
  }));
  const s1324 = (divs || []).filter((d) => d.date.slice(0, 4) === y);
  const byCountry = new Map();
  for (const d of s1324) {
    const k = (d.country || '—') + '|' + d.kind;
    const r = byCountry.get(k) || { country: d.country || '', kind: d.kind, grossIls: 0, whIls: 0, n: 0, missing: 0 };
    if (d.grossIls == null) r.missing++; else { r.grossIls += d.grossIls; r.whIls += d.whIls; }
    r.n++;
    byCountry.set(k, r);
  }
  const sum = Y ? {
    gains: Y.gains, losses: Y.losses, carryIn: Y.carryIn, carryUsed: Y.carryUsed, offIncome: Y.offIncome, taxable: Y.taxable,
    rate: Y.rate, cgTax: Y.cgTax, carryOut: Y.carryOut, incGross: Y.div.gross + Y.interest.gross, incWh: Y.div.wh + Y.interest.wh,
    credit: Y.credit, extraInc: Y.extraInc, creditLost: Y.creditLost, surtax: Y.surtax, due: Y.due,
  } : null;
  return { year: +year, s1325: s1325, s1324: s1324, s1324c: [...byCountry.values()].sort((a, b) => (a.country < b.country ? -1 : 1)), s1322: sum };
}

/* מד חשיפה למס עיזבון אמריקאי (ד10): שווי נכסים שמקורם בארה״ב מול הסף לזר שאינו תושב (60,000$).
   מקור: ISIN שמתחיל ב־US או מדינת המנפיק מ־Flex. בלי ISIN — ניחוש: נייר במטבע דולר שאינו ת״א (guess).
   המזומן ב־IBKR לא נכלל (מעמדו לא ודאי), ומדרגות המס לא מחושבות — לא אומתו במקור ראשי. */
const TI_ESTATE_TH = 60000;
function tiEstate(positions, priceOf) {
  let usd = 0, guess = 0, n = 0;
  for (const p of (positions || [])) {
    if (!p || /^(CASH|FX)/i.test(String(p.asset || ''))) continue;
    const sym = String(p.symbol || '').toUpperCase();
    const isin = String(p.isin || '').toUpperCase(), ctry = String(p.country || '').toUpperCase();
    const cur = String(p.currency || '').toUpperCase();
    let us = false, g = false;
    if (isin || ctry) us = isin.slice(0, 2) === 'US' || (!isin && ctry === 'US');
    else if (cur === 'USD' && !/\.TA$/.test(sym)) { us = true; g = true; }
    if (!us || cur !== 'USD') continue;
    const px = tiNum(priceOf && priceOf(sym)) || tiNum(p.markPrice);
    const v = Math.abs(tiNum(p.qty)) * px;
    if (!(v > 0)) continue;
    usd += v; n++;
    if (g) guess += v;
  }
  return { usd: usd, n: n, guess: guess, th: TI_ESTATE_TH, over: usd > TI_ESTATE_TH };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TI_RULES, tiRules, tiNormTrades, tiFourCase, tiFifo, tiDividends, tiYear, tiYears,
    tiUnrealized, tiHarvest, tiCheck, tiW8, tiRateOn, tiReport, tiEstate, TI_ESTATE_TH,
  };
}
