/* 14/10/2026 (בקשת המשתמש): הניתוח של מאגר הלמידה — רק Claude שבמנוי (סשן Claude Code / claude.ai), אף פעם לא ה־API.
   השומר: החבילה, המשיכה בטוקן והכלי לא קוראים ל־Anthropic ולא מייבאים את מודולי ה־AI של השרתון */
'use strict';
const fs = require('fs');
const path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0;
const ok = (c, m) => { if (!c) { console.error('FAIL - ' + m); process.exit(1); } n++; console.log('ok - ' + m); };
const AI = /api\.anthropic\.com|x-api-key|anthropic-version|\/v1\/messages|messages\.create|generativelanguage|require\(['"][^'"]*(aicache|gmodels|mistral|insight|llm|anthropic)['"]\)/i;
ok(!AI.test(R('ibkr-proxy/lib/studiolearn.js')), 'studiolearn.js — בלי קריאה ל־AI');
ok(!AI.test(R('tools/learn-pull.js')), 'learn-pull.js — בלי קריאה ל־AI');
const src = R('ibkr-proxy/api/studio.js');
const fn = (name) => { const i = src.indexOf('async function ' + name + '('); const j = src.indexOf('\nasync function ', i + 10); return src.slice(i, j); };
ok(fn('learnPull').length > 50 && !AI.test(fn('learnPull')) && !/fetch\(/.test(fn('learnPull')), 'learnPull — רק Firestore, בלי AI');
ok(fn('learnLoad').length > 50 && !AI.test(fn('learnLoad')), 'learnLoad — בלי AI');
const L = require('../ibkr-proxy/lib/studiolearn');
const b = L.learnBrief(L.learnView([], 0), 0);
ok(/מה מבקשים ממך, Claude/.test(b), 'החבילה מכוונת ל־Claude שקורא אותה (בלי לשלוח אותה לשום מקום)');
// 15/10/2026 (מ׳1): ההודעה בכניסה הראשונה ו"מחק את התרומות שלי"
const stj = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
ok(/function lrnNotice\(\)/.test(stj) && /alert: true/.test(stj.slice(stj.indexOf('function lrnNotice'), stj.indexOf('function lrnNotice') + 600)) && /lrnNotice\(\);/.test(stj), 'מ׳1: הודעה אחת בכניסה הראשונה — רק "הבנתי", לא מכבה כלום בעצמה');
ok(/net\.api\('learnForget'/.test(stj) && /danger: true, ok: T\('studioLrnForgetOk'\)/.test(stj), 'מ׳1: "מחק את התרומות שלי" — באישור הרסני');
const api = fs.readFileSync(path.join(__dirname, '..', 'ibkr-proxy', 'api', 'studio.js'), 'utf8');
ok(/op === 'learnForget'/.test(api) && /learnGone\(deps, uid, gone, now\)/.test(api) && /p\.lf > 0 && \(\+job\.created \|\| 0\) <= p\.lf/.test(api), 'מ׳1: המחיקה כוללת עבודות שנמחקו, ועבודות ישנות לא חוזרות');
console.log(`\nכל ${n} הבדיקות עברו ✓`);
