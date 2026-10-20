/* מ׳7 (20/10/2026): הלולאה — לפני ואחרי לכל גרסה (versionsView), הסיכום השבועי (weekSum), המסקנות ver_worse/ver_better,
   וההתראה השבועית למנהל (lab_week → מרכז הניהול, עמוד labWk) */
const fs = require('fs');
const path = require('path');
const L = require('../ibkr-proxy/lib/studiolearn.js');
const W = require('../ibkr-proxy/lib/webpush.js');
let n = 0, fail = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { fail++; console.log('FAIL - ' + m); } };
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const D = 864e5, now = Date.UTC(2026, 9, 20);
let i = 0;
const mk = (o) => Object.assign({ v: 1, id: 'r' + (i++), k: 'tr', st: 'done', dur: 600, pr: 1, usd: 0.5, use: [{ usd: 0.5 }], t: { run: 300, pz: 0 },
  at: now - 20 * D, q: { s: 70 }, jd: { s: 65 }, fires: 1, ar: 0, env: 'aaaaaaaaaaaa', pv: { tl: '11111111' } }, o);
const old = (k, o) => Array.from({ length: k }, (_, j) => mk(Object.assign({ at: now - 30 * D + j * D, q: { s: 70 + (j % 3) }, jd: { s: 65 + (j % 3) } }, o)));
const nw = (k, o) => Array.from({ length: k }, (_, j) => mk(Object.assign({ env: 'bbbbbbbbbbbb', at: now - 5 * D + j * 3600e3 }, o)));

// 1. טוב יותר בוודאות
let rs = old(8).concat(nw(6, { q: { s: 82 }, jd: { s: 77 }, usd: 0.3, use: [{ usd: 0.3 }] }));
let v = L.versionsView(rs);
const env = v.find((x) => x.d === 'env');
ok(env && env.a === 'bbbbbbbbbbbb' && env.b === 'aaaaaaaaaaaa' && env.na === 6 && env.nb === 8, 'גרסה חדשה מול הקודמת — לפי מתי הופיעה לראשונה');
ok(env.v === 'up' && env.m.find((m) => m.k === 'q').v === 'up' && env.m.find((m) => m.k === 'cpm').v === 'up', 'ציון גבוה יותר ועלות נמוכה יותר → "טוב יותר"');
ok(!v.find((x) => x.d === 'tl'), 'ממד בלי גרסה שנייה (ההנחיות לא השתנו) — לא מוצג');
let lv = L.learnView(rs, now);
ok(lv.ins.some((x) => x.k === 'ver_better' && x.v.d === 'env' && x.v.k) && !lv.ins.some((x) => x.k === 'ver_worse'), 'מסקנה: "גרסה חדשה טובה יותר" עם המדד');
ok(JSON.stringify(L.versionsView(rs)) === JSON.stringify(v), 'זרע קבוע — אותה תשובה בכל טעינה');

// 2. גרוע יותר
rs = old(8).concat(nw(6, { q: { s: 55 }, jd: { s: 50 } }));
v = L.versionsView(rs);
ok(v[0].v === 'dn' && L.learnView(rs, now).ins.some((x) => x.k === 'ver_worse' && x.sev === 1 && x.v.k === 'q'), 'ציון נמוך יותר → "גרוע יותר", מסקנה בחומרה הגבוהה');

// 3. אותו דבר / מעט עבודות / לא ברור
rs = old(8).concat(nw(6, { q: { s: 71 }, jd: { s: 66 } }));
v = L.versionsView(rs);
ok(v[0].m.find((m) => m.k === 'ok').v === 'eq' && v[0].v !== 'dn' && v[0].v !== 'up', 'בלי הבדל — לא "טוב" ולא "גרוע"');
rs = old(8).concat(nw(2, { q: { s: 90 } }));
v = L.versionsView(rs);
ok(v[0].v === 'few' && !L.learnView(rs, now).ins.some((x) => /^ver_/.test(x.k)), 'פחות מ־3 עבודות בגרסה החדשה — "מעט עבודות", בלי מסקנה');
const noisy = old(8, {}).map((r, j) => Object.assign(r, { q: { s: [40, 95, 60, 85, 50, 90, 45, 80][j] } }));
rs = noisy.concat(nw(4, { q: { s: [50, 95, 70, 85][0] } }).map((r, j) => Object.assign(r, { q: { s: [50, 95, 70, 85][j] } })));
ok(L.versionsView(rs)[0].m.find((m) => m.k === 'q').v === '?', 'פיזור גדול — "עוד לא ברור"');

// 4. ממד ההנחיות, עבודות שנכשלו, סט הזהב
rs = old(6).concat(old(6, { at: now - 4 * D, pv: { tl: '22222222' }, st: 'failed', q: null, jd: null }));
v = L.versionsView(rs);
const tl = v.find((x) => x.d === 'tl');
ok(tl && tl.a === '22222222' && tl.m.find((m) => m.k === 'ok').v === 'dn' && tl.v === 'dn', 'ההנחיות של המתרגם: כל העבודות נכשלו → הצלחה בלי "המשך" ירדה → "גרוע יותר"');
ok(L.versionsView(old(6).concat(nw(6, { gold: 1 }))).length === 0, 'עבודות של סט הזהב לא נספרות');
ok(L.versionsView(old(30).concat(nw(25))).every((x) => x.na <= 20 && x.nb <= 20), 'עד 20 העבודות האחרונות בכל גרסה');

// 5. הסיכום השבועי
lv = L.learnView(old(8).concat(nw(6, { q: { s: 82 }, jd: { s: 77 } })), now);
ok(lv.ws && lv.ws.k.n === 6 && lv.ws.kp.n === 0 && lv.ws.nv.some((x) => x.d === 'env' && x.v === 'up'), 'השבוע: 6 עבודות, והגרסה החדשה שהופיעה השבוע');
ok(/לפני ואחרי לכל גרסה \(מ׳7\)/.test(L.learnBrief(lv, now)) && /השבוע מול השבוע שעבר/.test(L.learnBrief(lv, now)), 'החבילה ל־Claude כוללת את ההשוואה ואת השבוע');
ok(!/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(JSON.stringify(lv.ver) + JSON.stringify(lv.ws)), 'רק מספרים וגרסאות — בלי פרטים אישיים');

// 6. ההתראה השבועית
const m = W.message('lab_week', '', 'he'), me = W.message('lab_week', '', 'en');
ok(m && m.u === 'https://admin.thesnowball.app/#labWk' && me && /lab/i.test(me.t), 'lab_week → מרכז הניהול, עמוד השבוע, בשתי השפות');
const api = R('ibkr-proxy/api/studio.js');
ok(/async function learnWeekly[\s\S]{0,900}query\(deps, 'studioLearn'[\s\S]{0,400}if \(!n\) return 0;[\s\S]{0,200}notify\(deps, cfg\.uid, 'lab_week'/.test(api), 'השבועית: רק אחרי שבדקה שהיו עבודות, ולמנהל (בעל הגיבוי)');
ok(!/learnWeekly[\s\S]{0,1200}patchDoc\(deps, 'studioLearn'/.test(api), 'השבועית קוראת בלבד מ־studioLearn');

// 7. המסך
const adm = R('admin-app.js');
ok(/page\('labVer'/.test(adm) && /page\('labWk'/.test(adm) && /verRow\(v\)/.test(adm) && /wkRow\(v\)/.test(adm), 'מרכז הניהול: עמודי "לפני ואחרי" ו"השבוע"');
for (const d of L.VER_DIMS) ok(new RegExp("case '" + d + "': return t\\('admVd").test(adm), 'שם לממד ' + d);
for (const [k] of L.VER_MET) ok(new RegExp("case '" + k + "': return t\\(").test(adm.slice(adm.indexOf('function verMetName'))), 'שם למדד ' + k);
console.log(fail ? `\n${fail} מתוך ${n} נכשלו` : `\nכל ${n} הבדיקות עברו ✓`);
process.exit(fail ? 1 : 0);
