// 11/10/2026 — תקלת max_tokens בעבודה אמיתית (Haiku · High): התשובה של Claude נקטעה, העבודה נכשלה, והטלפון הראה
// "משהו השתבש (max_tokens)" עם שורש סביר "אחרי שינוי בסביבה · 100%". כאן: הקוד מוכר בשרתון ובטלפון, והשורש = הקוד עצמו.
// (התיקון בעובד — translator/tests/test_pipeline.py ו־test_llm.py.)
// הרצה: node tests/studio-maxtok.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const I = require(path.join(root, 'ibkr-proxy/lib/studioinc.js'));

ok(I.ERR_INFO.max_tokens && I.ERR_INFO.max_tokens[0] === 'claude', 'max_tokens מוכר בשרתון (רכיב Claude)');

/* השורש: עבודה שנכשלה ב־max_tokens אחרי שהסביבה השתנתה מאז העבודה האחרונה שהצליחה */
const T0 = 1.8e12;
const ok1 = { id: 'jaaaaaaaaaaaaaaaaaaaaaaaa1', st: 'done', err: '', bad: false, fires: 1, ar: 0, rw: 0, at: T0 - 5e6, fired: T0 - 6e6, ev: 'aaaaaaaa', fp: '' };
const bad = { id: 'jaaaaaaaaaaaaaaaaaaaaaaaa2', st: 'failed', err: 'max_tokens', bad: true, fires: 1, ar: 0, rw: 0, at: T0, fired: T0 - 1e6, ev: 'bbbbbbbb', fp: '' };
const inc = I.incSync([], [ok1, bad], [], [], T0 + 1000);
const x = inc.find((y) => y.j === bad.id);
ok(x && x.rc && x.rc[0].t === 'code' && x.rc[0].k === 'max_tokens', 'השורש הראשון = הקוד עצמו (לא "אחרי שינוי בסביבה")');
ok(x.rc.some((r) => r.t === 'env'), 'שינוי הסביבה עדיין מופיע — כמועמד שני');
ok(!x.ev, 'התגית "אחרי שינוי בסביבה" רק כשהוא השורש הראשון');

/* בלי קוד מסביר — שינוי הסביבה עדיין בראש (ההתנהגות של v371 נשמרת) */
const bad2 = Object.assign({}, bad, { id: 'jaaaaaaaaaaaaaaaaaaaaaaaa3', err: 'worker' });
const x2 = I.incSync([], [ok1, bad2], [], [], T0 + 1000).find((y) => y.j === bad2.id);
ok(x2.rc[0].t === 'env' && x2.ev === 1, 'קוד כללי — השינוי בסביבה נשאר השורש והתגית מוצגת');

/* "המשך" אוטומטי רק לכשל חולף — גם כשנשארה התראת Drive ישנה פתוחה (ביקורת העמידות) */
const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
ok(!S.isTransient('max_tokens', ['drive:dl_fail']), 'max_tokens + התראת Drive ישנה — לא חולף (בלי "המשך" אוטומטי שמשלם שוב)');
ok(!S.isTransient('check_errors', ['drive:up_retry']) && !S.isTransient('no_api_key', []), 'כשל דטרמיניסטי / מפתח חסר — לא חולף');
ok(S.isTransient('api_overloaded', []) && S.isTransient('net', []), 'עומס באמצע הזרם / רשת — חולף');
ok(S.isTransient('worker', ['drive:dl_fail']), 'קוד כללי עם התראת Drive — עדיין חולף (כמו קודם)');
ok(I.ERR_INFO.api_overloaded && I.ERR_INFO.no_api_key[1] === 1, 'הקודים החדשים מוכרים (מפתח חסר = P1)');

/* הטלפון */
const st = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
ok(/case 'max_tokens': return T\('studioErrMaxTok'\)/.test(st) && /case 'max_tokens': return T\('studioIncMaxTok'\)/.test(st), 'הטלפון: הודעה ברורה במקום "משהו השתבש (max_tokens)"');
ok(/RC_T = \[[^\]]*'code'/.test(st) && /case 'code': return T\('studioRcCode'/.test(st), 'הטלפון: סוג השורש "code"');
for (const k of ['studioErrMaxTok', 'studioIncMaxTok', 'studioRcCode']) ok((app.match(new RegExp(k + ':', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);

/* העובד: התקרה והשמירה */
const py = fs.readFileSync(path.join(root, 'translator/pipeline.py'), 'utf8');
const lm = fs.readFileSync(path.join(root, 'translator/llm.py'), 'utf8');
ok(/MAX_OUT = 120_000/.test(lm) && /partial_ok/.test(lm), 'llm: ניסיון בתקרת המודל + partial_ok');
ok(/partial_ok=True/.test(py) && /FIX_BATCH/.test(py) && /J\.save_ck\(ctx, 'al'\)/.test(py), 'pipeline: חלק שנקטע נשמר, תיקונים במנות, וכשל תרגום שומר את נקודת היישור');
console.log('# ' + n + ' בדיקות עברו');
