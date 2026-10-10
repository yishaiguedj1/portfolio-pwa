// סקירת הקוד של סטודיו התרגום (10/10/2026): ממצאים שתוקנו — שפות נחסמות לפני ההעלאה, קודי השגיאה של מצב השרת,
// ציון החריגה לפי מנוע (ועלות השופט), צוואר הבקבוק מול הצפי הנלמד (studioeta) ולא מול הטבלה הישנה, וקוד מת שהוסר.
// "שמות ומונחים" והסגנון במצב Routine — translator/tests/test_worker.py (test_terms_and_style).
// הרצה: node tests/studio-review.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const I = require(path.join(root, 'ibkr-proxy/lib/studioinc.js'));
  const AN = require(path.join(root, 'ibkr-proxy/lib/studioanom.js'));
  const L = require(path.join(root, 'ibkr-proxy/lib/studiosla.js'));
  const st = await import(path.join(root, 'studio.js'));
  const api = read('ibkr-proxy/api/studio.js');

  /* ---------- 1. שפות: מה שהעובד יודע — נחסם כבר ביצירה (לפני העלאה של כמה GB) ---------- */
  ok(JSON.stringify(st.LANG_READY) === JSON.stringify(S.LANG_READY), 'LANG_READY זהה בטלפון ובשרתון');
  ok(S.langReady({ from: 'auto', to: ['he'] }) && S.langReady({ from: 'en', to: ['he'] }) && !S.langReady({ from: 'es', to: ['he'] })
    && !S.langReady({ from: 'en', to: ['he', 'fr'] }) && !S.langReady({ from: 'en', to: [] }) && !S.langReady(null), 'langReady: מקור אנגלית/אוטומטי, יעד עברית בלבד');
  ok(st.langReady('auto', ['he']) && !st.langReady('fr', ['he']) && !st.langReady('en', ['he', 'en']), 'langReady בטלפון — אותו כלל');
  ok(/op === 'create'[\s\S]{0,400}!S\.langReady\(spec\)\) return res\.status\(400\)\.json\(\{ ok: false, error: 'lang_unsupported' \}\)/.test(api)
    && /op === 'start'[\s\S]{0,400}!S\.langReady\(job\.spec\)\)/.test(api), 'השרתון: create ו־start דוחים שפה שלא נתמכת');
  const sj = read('studio.js');
  ok(/if \(!langReady\(f\.from, f\.to\)\) \{ flashSafe\(errText\('lang_unsupported'\)\); return; \}[^\n]*\n\s*ui\.starting = true/.test(sj), 'הטלפון: בודק לפני probe/create/העלאה');
  ok(/disabled: off, badge: off \? T\('studioSoon'\)/.test(sj) && /function rowCheck\(o\)[\s\S]{0,300}o\.disabled/.test(sj), 'בורר השפות: שפה שעוד לא נתמכת — "בקרוב" ולא נבחרת');

  /* ---------- 2. קודי השגיאה של מצב השרת (llm.py / pipeline.py) ---------- */
  const codes = (read('translator/llm.py') + read('translator/pipeline.py')).match(/'(api_[a-z_]+|budget_cap|model_refusal|check_errors)'/g).map((x) => x.slice(1, -1)).filter((c) => c !== 'api_usage');   // api_usage = שדה במצב, לא קוד שגיאה
  ok([...new Set(codes)].every((c) => I.ERR_INFO[c]), 'כל קוד שגיאה של מצב השרת ממופה ברכיב ובחומרה (' + [...new Set(codes)].join(', ') + ')');
  ok(I.ERR_INFO.api_auth[1] === 1 && I.ERR_INFO.api_model[1] === 1 && I.ERR_INFO.api_network[1] === 3, 'מפתח/מודל שנדחו = P1 (שום עבודת API לא תעבוד); רשת = P3');
  ok(S.isTransient('api_network') && S.isTransient('api_timeout') && S.isTransient('api_rate') && !S.isTransient('api_auth') && !S.isTransient('budget_cap'), 'רשת/קצב מול Anthropic = חולף (המשך אוטומטי); מפתח ותקרה — לא');
  ok(S.COST_STOP({ err: 'budget_cap' }) && S.COST_STOP({ err: 'budget_stop' }) && !S.COST_STOP({ err: 'api_auth' }), 'תקרת עבודה במצב API = עצירה על עלות ("מצב זול יותר" מוצע)');
  for (const c of ['api_auth', 'api_network', 'model_refusal', 'check_errors', 'budget_cap']) ok(new RegExp("case '" + c + "'").test(sj), 'טלפון: טקסט לקוד ' + c);

  /* ---------- 3. ציון החריגה: עלות לפי מנוע, ועלות השופט ---------- */
  ok(AN.METRICS.some((m) => m.k === 'u:jg') && JSON.stringify(st.AN_KEYS) === JSON.stringify(AN.METRICS.map((m) => m.k)), 'u:jg (השופט) — בשרתון ובטלפון');
  const now = Date.UTC(2026, 9, 10);
  let seq = 0;
  const job = (eng, usd) => ({ id: 'j' + String(seq++).padStart(20, '0'), kind: 'tr', state: 'done', eng, ended: now - (100 - seq) * 3600e3,
    spec: { dur: 600, mode: 'sonnet-medium' }, prog: { stg: { tr: { s: 1, e: 151e3 } } }, use: [{ k: 'main', m: 'claude-sonnet-5-5', usd }] });
  // 6 עבודות Routine יקרות (סשן) ואז עבודת API זולה פי 10 — זה לא "חריג", זה מנוע אחר
  const list = [0, 1, 2, 3, 4, 5].map(() => job('', 1)).concat([job('api', 0.1)]);
  const v = AN.anomView(list, now);
  const last = v.j[list[6].id] || [];
  ok(!last.some((r) => r[0] === 'u:main'), 'עבודת API לא נמדדת מול בסיס של Routine (בלי ציון עלות כשאין 5 עבודות מאותו מנוע)');
  ok(/const anOpen = !!ic && \(/.test(api), 'כשסנכרון התקלות נכשל — בלי קריאה וכתיבה של התראת חריגה בכל צפייה');

  /* ---------- 4. צוואר הבקבוק מול הצפי של העבודה ---------- */
  const short = (i) => ({ id: 'k' + String(i).padStart(20, '0'), kind: 'tr', state: 'done', ended: now - 3600e3, spec: { dur: 300, mode: 'sonnet-medium' },
    prog: { stg: { tr: { s: 1, e: 1 + 120e3 }, al: { s: 1, e: 1 + 300e3 }, tl: { s: 1, e: 1 + 60e3 }, rv: { s: 1, e: 1 + 60e3 }, bn: { s: 1, e: 1 + 120e3 }, sv: { s: 1, e: 1 + 30e3 } } } });
  const vv = L.valueView([short(1), short(2)], now, 0);
  ok(vv.bn && vv.bn.x != null && vv.bn.x < 3, 'סרטון של 5 דק׳ שרץ כרגיל — צוואר הבקבוק לא "פי 5–6 מהצפוי" (היה מול הטבלה הישנה): x=' + (vv.bn && vv.bn.x));
  const ep = { s: { tr: 60, al: 100, tl: 20, rv: 20, bn: 60, sv: 10 }, q: [0, 0.3, 0.45], n: 9 };
  ok(Math.abs(L.progFrac({ ep, prog: { stg: { tr: { s: 1, e: 2 }, al: { s: 3 } }, st: 'al', p: 0.5 } }) - (60 + 50) / 270) < 1e-9, 'progFrac: משקל השלבים לפי ep של העבודה');
  ok(L.targets({ mode: 'sonnet-medium', dur: 300 }, 3, 1.5).t > 600, 'targets: ברירת המחדל מהצפי (prior), לא מהטבלה הישנה (שנתנה כ־3 דק׳ ל־5 דק׳ סרטון)');

  /* ---------- 5. קוד מת שהוסר ---------- */
  ok(!/majNo|rulesSum/.test(sj) && !/incByJob/.test(read('ibkr-proxy/lib/studioinc.js')), 'majNo, rulesSum, incByJob — הוסרו');
  const app = read('app.js');
  ok(!/studioOpsTitle|studioHaltOnS|studioTwSecStops|studioRlSumB/.test(app), 'מחרוזות שאף קוד לא משתמש בהן — הוסרו');

  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
