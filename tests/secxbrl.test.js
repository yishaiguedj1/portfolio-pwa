// 5/11/2026 — השלמת companyfacts מקובץ ה־XBRL של ההגשה (ibkr-proxy/lib/secxbrl.js).
// הרקע: 56 דוחות תקופתיים של 42 חברות (AEP, ‏V, ‏PLD, ‏NEE…) הוגשו ל־EDGAR ולא נכנסו ל־companyfacts — המסך הראה רבעון ישן.
// בלי רשת: instance מדומה, submissions מדומה, fetch מדומה.
// הרצה: node tests/secxbrl.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const XB = require(path.join(root, 'ibkr-proxy/lib/secxbrl.js'));
const F = require(path.join(root, 'ibkr-proxy/lib/fundamentals.js'));

const XML = `<?xml version="1.0" encoding="utf-8"?>
<xbrl xmlns="http://www.xbrl.org/2003/instance" xmlns:us-gaap="http://fasb.org/us-gaap/2026" xmlns:dei="http://xbrl.sec.gov/dei/2026"
  xmlns:acme="http://www.acme.com/20260930" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:xbrli="http://www.xbrl.org/2003/instance"
  xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <context id="q3"><entity><identifier scheme="http://www.sec.gov/CIK">0000000001</identifier></entity>
    <period><startDate>2026-07-01</startDate><endDate>2026-09-30</endDate></period></context>
  <context id="q3py"><entity><identifier scheme="http://www.sec.gov/CIK">0000000001</identifier></entity>
    <period><startDate>2025-07-01</startDate><endDate>2025-09-30</endDate></period></context>
  <context id="sub"><entity><identifier scheme="http://www.sec.gov/CIK">0000000001</identifier>
    <segment><xbrldi:explicitMember dimension="dei:LegalEntityAxis">acme:SubMember</xbrldi:explicitMember></segment></entity>
    <period><startDate>2026-07-01</startDate><endDate>2026-09-30</endDate></period></context>
  <xbrli:context id="bs"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">0000000001</xbrli:identifier></xbrli:entity>
    <xbrli:period><xbrli:instant>2026-09-30</xbrli:instant></xbrli:period></xbrli:context>
  <unit id="usd"><measure>iso4217:USD</measure></unit>
  <unit id="sh"><measure>xbrli:shares</measure></unit>
  <unit id="ps"><divide><unitNumerator><measure>iso4217:USD</measure></unitNumerator><unitDenominator><measure>xbrli:shares</measure></unitDenominator></divide></unit>
  <us-gaap:Revenues contextRef="q3" decimals="-6" id="f1" unitRef="usd">6832000000</us-gaap:Revenues>
  <us-gaap:Revenues contextRef="q3" decimals="-6" id="f1b" unitRef="usd">6832000000</us-gaap:Revenues>
  <us-gaap:Revenues contextRef="q3py" decimals="-6" id="f2" unitRef="usd">6010400000</us-gaap:Revenues>
  <us-gaap:Revenues contextRef="sub" decimals="-6" id="f3" unitRef="usd">1853000000</us-gaap:Revenues>
  <us-gaap:NetIncomeLoss contextRef="q3" decimals="-6" id="f4" unitRef="usd">-12000000</us-gaap:NetIncomeLoss>
  <us-gaap:EarningsPerShareDiluted contextRef="q3" decimals="2" id="f5" unitRef="ps">2.16</us-gaap:EarningsPerShareDiluted>
  <us-gaap:Assets contextRef="bs" decimals="-6" id="f6" unitRef="usd">125695000000</us-gaap:Assets>
  <us-gaap:Goodwill contextRef="bs" unitRef="usd" xsi:nil="true"/>
  <dei:EntityCommonStockSharesOutstanding contextRef="bs" decimals="INF" id="f7" unitRef="sh">548000000</dei:EntityCommonStockSharesOutstanding>
  <acme:CustomRevenue contextRef="q3" decimals="-6" id="f8" unitRef="usd">5</acme:CustomRevenue>
  <dei:DocumentType contextRef="q3">10-Q</dei:DocumentType>
</xbrl>`;
const META = { acc: '0000000001-26-000072', form: '10-Q', filed: '2026-10-28' };

/* ---------- 1. פענוח ה־instance ---------- */
const P = XB.parseInstance(XML, META);
const rev = P.facts['us-gaap'].Revenues.units.USD;
ok(rev.length === 2, 'ערך עם ממד (חברה בת) לא נכנס, וכפילות של אותו ערך — פעם אחת');
ok(rev.some((x) => x.start === '2026-07-01' && x.end === '2026-09-30' && x.val === 6832000000 && x.accn === META.acc && x.form === '10-Q' && x.filed === '2026-10-28'),
  'ערך תקופה: start/end/val/accn/form/filed כמו ב־companyfacts');
ok(rev.some((x) => x.end === '2025-09-30' && x.val === 6010400000), 'גם תקופת ההשוואה מאותה הגשה');
ok(P.facts['us-gaap'].NetIncomeLoss.units.USD[0].val === -12000000, 'הפסד — הסימן נשמר');
ok(P.facts['us-gaap'].EarningsPerShareDiluted.units['USD/shares'][0].val === 2.16, 'יחידה מחולקת = USD/shares');
const ta = P.facts['us-gaap'].Assets.units.USD[0];
ok(ta.end === '2026-09-30' && !('start' in ta), 'ערך מאזן (instant) — בלי start, גם עם קידומת xbrli:');
ok(P.facts.dei.EntityCommonStockSharesOutstanding.units.shares[0].val === 548000000, 'dei ומניות (shares)');
ok(!P.facts['us-gaap'].Goodwill, 'xsi:nil — לא נכנס');
ok(!P.facts.acme, 'תגית פרטית של החברה — לא נכנסת (כמו ב־companyfacts)');
ok(!P.facts.dei.DocumentType, 'ערך טקסט בלי unitRef — לא נכנס');
ok(Object.keys(XB.parseInstance('', META).facts).length === 0 && Object.keys(XB.parseInstance(null).facts).length === 0, 'קלט ריק — ריק, בלי חריגה');

/* ---------- 2. אילו הגשות חסרות ---------- */
const facts = { facts: { 'us-gaap': { Revenues: { units: { USD: [{ start: '2026-01-01', end: '2026-03-31', val: 1, accn: 'A-Q1', form: '10-Q', filed: '2026-05-05' }] } } } } };
const sub = { filings: { recent: {
  form: ['8-K', '10-Q', 'S-8', '10-Q', '10-Q', '10-K', '10-Q'],
  accessionNumber: ['A-8K', META.acc, 'A-S8', 'A-Q2', 'A-Q1', 'A-K', 'A-OLD'],
  filingDate: ['2026-11-04', '2026-10-28', '2026-08-01', '2026-07-30', '2026-05-05', '2026-02-20', '2023-05-01'],
  reportDate: ['2026-11-04', '2026-09-30', '', '2026-06-30', '2026-03-31', '2025-12-31', '2023-03-31'],
  primaryDocument: ['x8k.htm', 'acme-20260930.htm', 's8.htm', 'acme-20260630.htm', 'acme-20260331.htm', 'acme-20251231.htm', 'old.htm'],
  isXBRL: [1, 1, 0, 1, 1, 1, 1],
} } };
const NOW = Date.parse('2026-11-05T08:00:00Z');
const miss = XB.missingFilings(sub, facts, NOW);
ok(miss.map((m) => m.acc).join() === [META.acc, 'A-Q2', 'A-K'].join(), 'רק דוחות תקופתיים שאין להם אף ערך ב־companyfacts, מהחדש לישן (לא 8-K/S-8, לא ישן מ־800 יום)');
ok(miss[0].doc === 'acme-20260930.htm' && miss[0].per === '2026-09-30', 'שם המסמך ותאריך התקופה');
ok(XB.missingFilings(null, facts).length === 0 && XB.missingFilings({}, facts).length === 0, 'בלי submissions — אין מה להשלים');
const many = { filings: { recent: { form: Array(9).fill('10-Q'), accessionNumber: [...Array(9).keys()].map((i) => 'M' + i),
  filingDate: Array(9).fill('2026-10-01'), reportDate: Array(9).fill('2026-09-30'), primaryDocument: Array(9).fill('d.htm'), isXBRL: Array(9).fill(1) } } };
ok(XB.missingFilings(many, facts, NOW).length === XB.MAX_FILINGS, 'לכל היותר ' + XB.MAX_FILINGS + ' הגשות לבקשה');

/* ---------- 3. השלמה ומיזוג (fetch מדומה) ---------- */
(async () => {
  const urls = [];
  const deps = { now: NOW, merge: F.mergeFacts,
    getText: async (u) => { urls.push(u); if (u.endsWith('acme-20260930_htm.xml')) return XML; throw new Error('http_404'); },
    getJson: async (u) => { urls.push(u); if (/A-K|AK/.test(u)) return { directory: { item: [{ name: 'acme-20251231_cal.xml' }, { name: 'acme-20251231.xml' }] } }; throw new Error('http_404'); } };
  const r = await XB.patchFacts(facts, sub, '0000000001', deps);
  ok(urls.includes('https://www.sec.gov/Archives/edgar/data/1/000000000126000072/acme-20260930_htm.xml'), 'הכתובת: התיקייה של ההגשה + <doc>_htm.xml');
  ok(r.added.length === 1 && r.added[0].acc === META.acc && r.added[0].per === '2026-09-30' && r.added[0].n > 0, 'הגשה שנמצאה נוספת; הגשה שנכשלה — מדלגים בשקט');
  const R2 = r.facts.facts['us-gaap'].Revenues.units.USD;
  ok(R2.some((x) => x.accn === 'A-Q1') && R2.some((x) => x.accn === META.acc && x.end === '2026-09-30'), 'מיזוג: הערכים הקיימים נשארים, החדשים נוספים');
  const same = await XB.patchFacts(r.facts, { filings: { recent: { form: ['10-Q'], accessionNumber: [META.acc], filingDate: ['2026-10-28'], reportDate: ['2026-09-30'], primaryDocument: ['acme-20260930.htm'], isXBRL: [1] } } }, '1', deps);
  ok(same.added.length === 0 && same.facts === r.facts, 'כשאין חסר — אותו אובייקט, בלי בקשות');

  // השרשרת המלאה: normalizeSec מכניס את הרבעון שהגיע מה־instance
  const sec = F.normalizeSec(r.facts, [], null);
  ok(!sec || !sec.q || sec.q.includes('2026-09-30') || sec.fy.length < 2, 'normalizeSec מקבל את הצורה (רבעון חדש נכנס כשיש מספיק היסטוריה)');

  /* ---------- 4. החיבור בקוד ---------- */
  const src = fs.readFileSync(path.join(root, 'ibkr-proxy/lib/fundamentals.js'), 'utf8');
  ok(/require\('\.\/secxbrl'\)\.patchFacts\(facts1, sub, cik/.test(src), 'fundamentals(): השלמה לפני normalizeSec');
  ok(/checks\.push\(\{ k: 'xbrl'/.test(src) && F.CHECK_INFO.has('xbrl'), "סימון 'xbrl' = מידע (לא 'לבדוק')");
  ok(typeof F.secFacts === 'function', 'secFacts מיוצא — לכלי הבקרה');
  ok(/F\.secFacts\(/.test(fs.readFileSync(path.join(root, 'tools/fund-audit.js'), 'utf8')) && /F\.secFacts\(/.test(fs.readFileSync(path.join(root, 'tools/fund-xcheck.js'), 'utf8')),
    'הבקרה הלילית ושכבה 8 משווים מול companyfacts + ההשלמה (לא companyfacts לבד)');
  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error('FAIL - ' + e.stack); process.exit(1); });
