// 16/11/2026 (בקשת המשתמש): בסטודיו המשתמשים יודעים שהתרגום ב־Claude — אבל לא באיזה מודל. מוצג רק "רגיל" / "ביצועים",
// וגם מי שסורק את האתר או את התעבורה (מתחרים) לא יגלה את המודל. המאגר והעובד יודעים הכל, כמו קודם (ועוד: tier ברשומת הלמידה).
// (1) אף קובץ שהאתר מגיש (tools/sitefiles.js) לא מזכיר מודל; (2) lib/modecode.js — הקודים, המיפוי בשני הכיוונים והסינון;
// (3) הטלפון, מרכז הניהול והשרתון מסכימים על הקודים ועל הטבלאות; (4) המסלול המלא דרך api/studio.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { siteFiles } = require('../tools/sitefiles.js');
const MC = require('../ibkr-proxy/lib/modecode.js');
const S = require('../ibkr-proxy/lib/studio.js');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('✓ ' + name); };

/* שם של מודל: משפחה (גם בלי גרסה), מזהה claude-…, מזהה מצב פנימי. "Opus" לבד = פורמט הקול — מותר */
const LEAK = [/\b(?:sonnet|haiku|fable)\b/i, /claude[ _-]?(?:opus|sonnet|haiku|fable|instant|\d)/i, /\bopus[ _-]?\d/i, /\bopus[ ·_-]*(?:low|medium|high|max)\b/i,
  /\b(?:haiku|sonnet|opus)-(?:low|medium|high|max)\b/i];
const leakIn = (s) => { for (const re of LEAK) { const m = re.exec(s); if (m) return s.slice(Math.max(0, m.index - 40), m.index + 40); } return ''; };

(async () => {
  await t('אף קובץ שהאתר מגיש לא מזכיר מודל (קוד, מחרוזות, הערות, CHANGELOG, מניפסטים)', () => {
    const all = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 1 << 28 }).toString('utf8').split('\0').filter(Boolean);
    const files = siteFiles(all).filter((f) => /\.(m?js|html|css|webmanifest|md|json|ya?ml|txt|svg)$/i.test(f) && fs.existsSync(path.join(root, f)));
    assert.ok(files.length > 100, 'קבצים: ' + files.length);
    const bad = [];
    for (const f of files) { const w = leakIn(read(f)); if (w) bad.push(f + ': …' + w.replace(/\s+/g, ' ') + '…'); }
    assert.deepStrictEqual(bad, [], 'שם מודל בקובץ שהאתר מגיש:\n' + bad.join('\n'));
    for (const s of ['Sonnet', 'claude-haiku-5-5', 'opus-medium', 'Opus 5.5', 'Haiku · High', 'Claude Opus']) assert.ok(leakIn(s), 'הגלאי תופס: ' + s);
    for (const s of ['Opus', '.opus', "c: 'opus'", 'Claude', 'AV1, Opus, HDR', 'std', 'perf', 'lab4']) assert.ok(!leakIn(s), 'מותר: ' + s);
  });

  await t('הקודים: אחד לכל מצב פנימי, זהים לשרתון (MODES, LEGACY, PUBLIC, DEFAULT)', () => {
    assert.deepStrictEqual(Object.keys(MC.MODE_CODE).sort(), S.MODES.slice().sort(), 'קוד לכל מצב ב־S.MODES');
    assert.strictEqual(new Set(MC.CODES).size, MC.CODES.length, 'בלי כפילות');
    assert.deepStrictEqual(MC.LEGACY, S.LEGACY_MODES, '= LEGACY_MODES');
    assert.deepStrictEqual(S.PUBLIC_MODES.map(MC.codeOf), MC.PUBLIC_CODES, 'הציבוריים = std, perf');
    assert.strictEqual(MC.codeOf(S.DEFAULT_MODE), 'std', 'ברירת המחדל = "רגיל"');
    for (const m of S.MODES) assert.strictEqual(MC.modeIn(MC.codeOf(m)), m, 'הלוך ושוב: ' + m);
    assert.strictEqual(MC.codeOf('opus-high'), MC.codeOf('opus-medium'), 'מזהה ישן → הקוד של המצב הקרוב');
    assert.strictEqual(MC.modeIn('haiku-high'), 'haiku-high', 'מזהה פנימי מגרסה ישנה של הטלפון — כמו שהוא');
    for (const c of MC.CODES) assert.ok(!/opus|sonnet|haiku|fable|low|medium|high|max/i.test(c), 'קוד אטום: ' + c);
    const nm = MC.modeNames();
    assert.deepStrictEqual(Object.keys(nm).sort(), MC.CODES.slice().sort(), 'שם לכל קוד (למנהל)');
  });

  await t('הטלפון ומרכז הניהול: אותם קודים ואותן טבלאות כמו השרתון', async () => {
    const st = await import(path.join(root, 'studio.js'));
    assert.deepStrictEqual(st.MODES.map((m) => m.id).sort(), MC.CODES.slice().sort(), 'studio.js MODES = הקודים');
    assert.deepStrictEqual(st.PUBLIC_MODES, MC.PUBLIC_CODES, 'PUBLIC_MODES');
    assert.strictEqual(st.DEFAULT_MODE, MC.codeOf(S.DEFAULT_MODE), 'DEFAULT_MODE');
    for (const [m, v] of Object.entries(S.NORM_DEF_API)) assert.strictEqual(st.NORM_DEF_API[MC.codeOf(m)], v, 'NORM_DEF_API: ' + m);
    const tier = Object.fromEntries(st.MODES.filter((m) => m.tier).map((m) => [m.id, m.tier]));
    assert.deepStrictEqual(tier, { std: 'std', perf: 'perf' }, 'רק לשני הציבוריים יש tier');
    const net = await import(path.join(root, 'studionet.js'));
    const adm = read('admin-app.js');
    const vi = JSON.parse(adm.match(/const VI_USD_H = (\{[^\n]*?\});/)[1].replace(/(\w+):/g, '"$1":'));
    assert.deepStrictEqual(vi, JSON.parse(JSON.stringify(net.VI_USD_H)), 'VI_USD_H — זהה בטלפון ובמרכז הניהול');
    assert.deepStrictEqual(Object.keys(net.VI_USD_H).sort(), MC.CODES.slice().sort(), 'VI_USD_H לפי קוד');
    const gm = JSON.parse(adm.match(/const GOLD_MODES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
    assert.deepStrictEqual(gm.slice().sort(), MC.CODES.slice().sort(), 'GOLD_MODES — קודים');
    const vr = JSON.parse(adm.match(/const VR_DM = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
    assert.deepStrictEqual(vr.map((c) => MC.draftIn(c, S.VP_MODES)), ['o', 's', 'h'], 'טיוטת הייחוס: הקודים → האותיות של VP_MODES');
    // התוויות: "רגיל" / "ביצועים" / "בדיקה N"; בלי שם אמיתי כשאין ui.mn
    const T = (k, v) => k + (v && v.n ? v.n : '');
    global.t = T;
    assert.strictEqual(st.modeName(st.modeById('std')), 'studioTierStd');
    assert.strictEqual(st.modeName(st.modeById('perf')), 'studioTierPerf');
    assert.strictEqual(st.modeName(st.modeById('lab4')), 'studioTierLab4');
    delete global.t;
    assert.deepStrictEqual(st.normNames({ std: 'X', zz: 'Y', lab1: 5 }), { std: 'X' }, 'normNames — רק קודים מוכרים ושמות');
    assert.strictEqual(st.normNames(null), null);
    assert.strictEqual(st.modelLabel('claude'), 'Claude');
    // הגדרה ישנה: המזהה נשמר ב־lm עד שהשרתון ממיר (status)
    const s1 = st.migrateSettings({ mode: 'haiku-high', mv: 4 });
    assert.ok(s1.mode === 'std' && s1.lm === 'haiku-high' && s1.mv === 5, 'מזהה ישן → lm + ברירת המחדל עד ההמרה');
    const s2 = st.migrateSettings({ mode: 'perf', mv: 5 });
    assert.ok(s2.mode === 'perf' && !('lm' in s2), 'קוד — כמו שהוא');
    assert.strictEqual(st.normSettings(s1).lm, 'haiku-high', 'lm שורד שמירה ונרמול חוזר');
    // העלות: שורה בלי המודל ('claude') נשארת; האזהרה "מודל אחר" — רק עם השמות (מנהל)
    const use = [{ k: 'main', m: 'claude', n: 1, i: 10, o: 5, usd: 0.01 }, { k: 'tl', m: 'claude', n: 1, i: 10, o: 5, usd: 0.02, of: 1 }];
    const cv = st.costView(use, 'std');
    assert.ok(cv && cv.rows.length === 2 && cv.rows[0].model === 'Claude' && !cv.warn.length && cv.want === '', 'בלי שמות: Claude, בלי אזהרה');
    const cv2 = st.costView(use, 'std', undefined, { std: 'N' });
    assert.ok(cv2.warn.length === 1 && cv2.want === 'N', 'למנהל: האזהרה והמצב שבחר');
  });

  await t('pubOut: מזהים → קודים (ערכים ומפתחות); מי שאינו מנהל — בלי מזהה מודל ובלי שמות בטקסט המערכת', () => {
    const job = { spec: { mode: 'haiku-high', name: "Shakespeare's Sonnet 18.mp4", terms: 'haiku' }, use: [{ k: 'main', m: 'claude-haiku-5-5', usd: 1 }],
      norm: { 'haiku-medium': { ph: 1 }, 'opus-medium': { ph: 2 } }, rl: { mx: 'sonnet-high' }, ps: { t: 'הסשן של Claude Sonnet 5.5 נכשל; haiku-high המשיך', m: 'claude-sonnet-5-5' },
      prog: { msg: 'Error: model claude-haiku-5-5 overloaded (Haiku · High)' }, hla: { c: 'opus' }, codec: 'opus', ops: ['claude', 'drive'] };
    const u = MC.pubOut(job, false);
    assert.strictEqual(u.spec.mode, 'perf');
    assert.deepStrictEqual(Object.keys(u.norm), ['std', 'lab4'], 'מפתחות');
    assert.strictEqual(u.rl.mx, 'lab3');
    assert.strictEqual(u.use[0].m, 'claude', 'מזהה מודל → claude');
    assert.strictEqual(u.ps.m, 'claude');
    assert.ok(!leakIn(u.ps.t) && /Claude/.test(u.ps.t) && /perf/.test(u.ps.t), 'הדוח אחרי תקלה בלי שם: ' + u.ps.t);
    assert.ok(!leakIn(u.prog.msg) && /Claude/.test(u.prog.msg), 'הודעת התקלה בלי שם: ' + u.prog.msg);
    assert.strictEqual(u.spec.name, "Shakespeare's Sonnet 18.mp4", 'תוכן של המשתמש — לא נוגעים');
    assert.strictEqual(u.spec.terms, 'haiku', 'המונחים שלך — לא נוגעים');
    assert.ok(u.hla.c === 'opus' && u.codec === 'opus', 'פורמט הקול Opus — לא נוגעים');
    assert.deepStrictEqual(u.ops, ['claude', 'drive'], "'claude' כרכיב — כמו שהוא");
    assert.strictEqual(job.spec.mode, 'haiku-high', 'המקור לא משתנה (עותק)');
    const a = MC.pubOut(job, true);
    assert.ok(a.spec.mode === 'perf' && a.use[0].m === 'claude-haiku-5-5' && a.ps.t === job.ps.t && a.prog.msg === job.prog.msg, 'למנהל: קודים, והמודל המלא נשאר');
    assert.deepStrictEqual(MC.pubOut([1, 'sonnet-low', null, { x: Buffer.from('a') }], false).slice(0, 3), [1, 'lab1', null]);
  });

  await t('inModes: בקשה עם קודים → המזהים הפנימיים', () => {
    const b = MC.inModes({ mode: 'perf', spec: { mode: 'lab4', name: 'std' }, modes: ['std', 'lab2'], arms: [{ mode: 'perf' }, { mode: 'haiku-medium' }], rl: { mx: 'lab3' }, draft: 'lab2' }, S.VP_MODES);
    assert.deepStrictEqual(b, { mode: 'haiku-high', spec: { mode: 'opus-medium', name: 'std' }, modes: ['haiku-medium', 'sonnet-medium'], arms: [{ mode: 'haiku-high' }, { mode: 'haiku-medium' }], rl: { mx: 'sonnet-high' }, draft: 's' });
    assert.strictEqual(MC.inModes({ draft: 'o' }, S.VP_MODES).draft, 'o', 'אות ישנה — כמו שהיא');
  });

  await t('wrapRes: התשובה עוברת דרך pubOut; למנהל — גם השמות (mn)', () => {
    let sent = null, code = 0;
    const res = { status(c) { code = c; return this; }, json(o) { sent = o; return this; }, setHeader() {} };
    let adm = false;
    const w = MC.wrapRes(res, () => adm);
    w.status(200).json({ ok: true, job: { spec: { mode: 'haiku-medium' } }, use: [{ m: 'claude-opus-5-5' }] });
    assert.ok(code === 200 && sent.job.spec.mode === 'std' && sent.use[0].m === 'claude' && !('mn' in sent), 'משתמש: קוד, בלי מודל ובלי שמות');
    adm = true;
    w.status(403).json({ ok: false, error: 'mode_locked' });
    assert.ok(code === 403 && sent.mn && sent.mn.lab4 && sent.error === 'mode_locked', 'מנהל: השמות מצורפים');
    w.setHeader('x', 'y');
  });

  await t('השרתון: עבודה, status ויצירה — מהטלפון רק קודים, ולמאגר המזהה הפנימי', async () => {
    const run = read('ibkr-proxy/api/studio.js');
    const i = run.indexOf("if (body.op === 'dmPull')"), j = run.indexOf('res = MC.wrapRes(res'), k = run.indexOf('if (PHONE_OPS.has(');
    assert.ok(i > 0 && j > i && k > j, 'העובד, השרתים ומשיכת המאגר — לפני העטיפה (רואים הכל); הטלפון — אחריה');
    for (const op of ['WORKER_OPS', 'SERVER_OPS', 'RELAY_OPS']) assert.ok(run.indexOf('if (' + op + '.has(') < j, op + ' לפני העטיפה');
    assert.ok(/pub\.admin = user\.mon !== true && isAdmin\(user\)/.test(run), 'השמות — רק למנהל');
    const L = require('../ibkr-proxy/lib/studiolearn.js');
    assert.ok(/tier: require\('\.\/modecode'\)\.codeOf\(sp\.mode\)/.test(read('ibkr-proxy/lib/studiolearn.js')), 'רשומת הלמידה: גם הקוד שהמשתמש ראה');
    assert.ok(typeof L === 'object');
    const pj = S.publicJob({ id: 'j' + 'a'.repeat(21), kind: 'tr', state: 'done', spec: { mode: 'haiku-high' }, use: [{ k: 'tl', m: 'claude-sonnet-5-5' }, { k: 'main', m: 'claude-sonnet-5-5' }, { k: 'rv', m: 'claude-haiku-5-5' }] }, Date.now());
    assert.deepStrictEqual(pj.use.map((r) => r.of || 0), [1, 0, 0], 'useOff: סוכן־משנה על משפחה אחרת מסומן');
  });

  console.log(`\n${n} בדיקות עברו (model-hide)`);
})().catch((e) => { console.error(e); process.exit(1); });
