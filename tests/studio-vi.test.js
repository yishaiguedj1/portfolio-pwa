// 9/11/2026: ניתוח סרטונים, גל 0 (PR 0.2) — השלד וההרצה היבשה: השרתון (normSpec, המתג st_vi, התור, הצפי, הסיכום),
// הטלפון (הטופס למנהל, השלבים, התוצרים) והתאום מול העובד (translator/analyze.py). הלוגיקה של העובד —
// translator/tests/test_analyze.py. התוכנית: docs/studio-video-analysis-plan.md. הרצה: node tests/studio-vi.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const VI = require(path.join(root, 'ibkr-proxy/lib/studiovi.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const ETA = require(path.join(root, 'ibkr-proxy/lib/studioeta.js'));
  const SF = require(path.join(root, 'ibkr-proxy/lib/sysflags.js'));
  const UM = require(path.join(root, 'ibkr-proxy/lib/usermon.js'));
  const W = require(path.join(root, 'ibkr-proxy/lib/webpush.js'));
  const N = await import(path.join(root, 'studionet.js'));
  const py = read('translator/analyze.py');
  const pyTuple = (name) => { const m = py.match(new RegExp('^' + name + " = \\(([^)]*)\\)", 'm')); return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : null; };

  /* ---------- 1. זהה לעובד (19.3) ---------- */
  ok(py.includes("VI_V = '" + VI.VI_V + "'"), 'VI_V זהה בעובד');
  ok(same(pyTuple('VI_LANGS'), VI.VI_LANGS), 'VI_LANGS זהה בעובד');
  ok(same(pyTuple('VI_FROM'), VI.VI_FROM) && VI.VI_FROM[0] === 'auto' && VI.VI_LANGS.every((c) => VI.VI_FROM.includes(c)), 'VI_FROM (עם "אוטומטי", 1.2א) זהה בעובד');
  ok(same(pyTuple('VI_FAIL'), VI.VI_FAIL) && same(pyTuple('VI_WARN'), VI.VI_WARN), 'קודי הכישלון והאזהרה זהים בעובד');
  ok(new RegExp("^VI_MAX_S = int\\(os\\.environ\\.get\\('VI_MAX_S'\\) or " + VI.VI_MAX_S + '\\)', 'm').test(py), 'VI_MAX_S — ברירת המחדל זהה בעובד');
  const files = [...py.matchAll(/^\s+\('(\w+)', '[^']+', '[^']+', '[^']+'\),?$/gm)].map((x) => x[1]);
  ok(same(files, VI.VI_OUTS), 'VI_OUTS = VI_FILES בעובד, באותו סדר');
  ok(VI.VI_OUTS.every((k) => S.OUT_KINDS.includes(k)) && VI.VI_OUTS.length <= S.OUT_MAX, 'כל תוצרי הניתוח מותרים בשרתון, בתוך OUT_MAX');
  ok(new Set(VI.VI_ERR).size === VI.VI_ERR.length && VI.VI_ERR.every((c) => /^[a-z0-9_]{1,40}$/.test(c)), 'קודים ייחודיים בצורה ש־ERR_RE מקבל');

  /* ---------- 2. normSpec ---------- */
  const base = { name: 'lecture.mp4', size: 1000, dur: 3600, from: 'he', to: ['he'], out: ['compact', 'small'], eng: 'api', vi: 1, dry: 1, mode: 'opus-medium' };
  const sp = S.normSpec(base);
  ok(sp && sp.vi === 1 && sp.dry === 1 && same(sp.out, []) && sp.from === 'he' && same(sp.to, ['he']), 'ניתוח יבש: vi/dry נשמרים, בלי תוצרי וידאו');
  ok(S.normSpec(Object.assign({}, base, { dry: 0 })) === null, 'ניתוח בלי הצהרת זכויות (vr) — נדחה');
  const real = S.normSpec(Object.assign({}, base, { dry: 0, vr: 1 }));
  ok(real && real.vi === 1 && real.vr === 1 && !('dry' in real) && real.mode === 'opus-medium' && same(real.out, []), '1.5א: ניתוח עם Claude — עם vr, המצב נשמר, בלי תוצרי וידאו');
  ok(S.normSpec(Object.assign({}, base, { dry: 0, vr: 1, eng: 'cl' })) === null && S.normSpec(Object.assign({}, base, { dry: 0, vr: 1, ka: 1 })) === null, 'גם עם vr — רק בשרת שלנו, ולא קריוקי');
  for (const [k, v] of [['src', 'subs'], ['ph', 1], ['nu', 1], ['ka', 1], ['cp', 1], ['ry', 1], ['eng', undefined]]) {
    ok(S.normSpec(Object.assign({}, base, { [k]: v })) === null, 'לא שייך לניתוח: ' + k);
  }
  const ext = S.normSpec(Object.assign({}, base, { bt: 1, edl: [[10, 20]], sty: { sz: 'L' } }));
  ok(ext && !ext.bt && !ext.edl && !ext.sty, 'בלי חצי מחיר, בלי חיתוך ובלי עיצוב כתוביות');
  const link = S.normSpec(Object.assign({}, base, { src: 'url', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', pick: { h: 720 } }));
  ok(link && link.vi === 1 && link.src === 'url', 'מקישור — מותר (העובד מוריד ל־R2, כמו בתרגום)');
  const plain = S.normSpec({ name: 'a.mp4', size: 10, to: ['he'], out: ['compact'] });
  ok(plain && !('vi' in plain) && !('dry' in plain), 'עבודת תרגום רגילה — בלי שדות הניתוח');

  /* ---------- 3. השפות והאורך ---------- */
  ok(S.langReady(sp) && S.langReady(Object.assign({}, sp, { from: 'en' })), 'מקור עברית או אנגלית');
  ok(S.langReady(Object.assign({}, sp, { from: 'auto' })) && !S.langReady(Object.assign({}, sp, { from: 'fr' })), '1.2א: "אוטומטי" — העובד מזהה; בלי שפות אחרות');
  ok(!S.langReady(Object.assign({}, sp, { to: ['he', 'en'] })) && !S.langReady(Object.assign({}, sp, { to: ['en'] })), 'יעד — עברית בלבד');
  ok(S.langReady({ from: 'auto', to: ['he'] }) && !S.langReady({ from: 'he', to: ['he'] }), 'התרגום — בלי שינוי');
  ok(VI.viTooLong({ dur: VI.VI_MAX_S + 1 }) && !VI.viTooLong({ dur: VI.VI_MAX_S }) && !VI.viTooLong({ dur: 0 }), 'vi_long — מעל VI_MAX_S (0 = לא ידוע, העובד בודק)');

  /* ---------- 4. התור: הזיכרון והקבלה החזויה (agent.py — mem_fit) ---------- */
  const fit0 = { mb: 9000, a: 4000, b: 20, ra: 2000, rb: 5, ai: 700 };
  const f1 = S.normFit(Object.assign({}, fit0, { dm: 30, va: 5000, vb: 25, dv: 10 }));
  ok(f1 && f1.va === 5000 && f1.vb === 25 && f1.dv === 10, 'normFit: va/vb/dv — שדות רשות');
  ok(same(Object.keys(S.normFit(fit0)).sort(), Object.keys(fit0).sort()), 'סוכן ישן (בלי שדות הניתוח) — כמו קודם');
  const viJob = { kind: 'tr', spec: { vi: 1, dur: 1200 } }, trJob = { kind: 'tr', spec: { dur: 1200 } };
  ok(S.peakNeed(viJob, f1) === 5000 + 25 * 20 && S.peakNeed(trJob, f1) === 4000 + 20 * 20, 'peakNeed: הניתוח — המודל שלו (va/vb)');
  ok(S.peakNeed(viJob, S.normFit(fit0)) === 4000 + 20 * 20, 'בלי va — כמו תרגום');
  ok(S.perfBlock(viJob, f1) === true && S.perfBlock(trJob, f1) === false, 'perfBlock: הניתוח מול dv, התרגום מול dm');
  ok(S.perfBlock(viJob, S.normFit(Object.assign({}, fit0, { dm: 30 }))) === false, 'בלי dv — dm');
  ok(S.normHb({ vi: 1 }).vi === 1 && S.normHb({}).vi === 0 && S.normHb({ vi: 'yes' }).vi === 0, 'normHb: העובד מצהיר שהוא מכיר ניתוח');

  /* ---------- 5. הסיכום (vsm) ---------- */
  const job = { id: 'j' + 'a'.repeat(20), kind: 'tr', state: 'running', spec: sp, prog: { st: 'sv', p: 0.5, stg: { sv: { s: 1, e: 0 } } } };
  const vsm = { n: 3.6, ok: -1, cov: 250, so: 7, d: 3600.4, text: 'סוד' };
  const up = S.applyReport(job, { done: true, vsm }, 1000);
  ok(up.state === 'done' && same(up.vsm, { n: 4, ok: 0, cov: 100, so: 7, d: 3600 }), 'applyReport: הסיכום נשמר — מספרים שלמים בגבולות, בלי טקסט');
  ok(!('vsm' in S.applyReport(job, { st: 'sv', p: 0.9, vsm }, 1000)), 'רק בסוף העבודה');
  ok(!('vsm' in S.applyReport(Object.assign({}, job, { spec: plain }), { done: true, vsm }, 1000)), 'רק בעבודת ניתוח');
  ok(VI.viSummary(null) === null && VI.viSummary([1]) === null, 'viSummary: צורה לא תקינה — null');
  const pj = S.publicJob(Object.assign({}, job, up), 1000);
  ok(same(pj.vsm, up.vsm) && S.publicJob(Object.assign({}, job, { spec: plain, vsm: up.vsm }), 1000).vsm === null, 'publicJob: vsm רק לעבודת ניתוח');
  ok(S.JSON_FIELDS.includes('vsm') && S.toFields({ vsm: up.vsm }).vsm.stringValue === JSON.stringify(up.vsm), 'vsm נשמר כ־JSON');

  /* ---------- 6. המתג st_vi (13.5) ---------- */
  const fl = SF.FLAGS.find((f) => f.k === 'st_vi');
  ok(fl && fl.def === false && fl.app === 'studio', 'st_vi — כבוי כברירת מחדל');
  ok(SF.flagOn({}, 'st_vi') === false && SF.flagOn({ flOn: 'st_vi' }, 'st_vi') === true, 'נדלק רק במרכז הניהול');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/!isAdmin\(user\) && !\(await flagOn\(deps, 'st_vi', now\)\) \? \[409, 'vi_off'\]/.test(api), 'create: המתג כבוי — vi_off לכל מי שאינו המנהל');
  ok(/spec\.dry && !isAdmin\(user\) \? \[403, 'not_allowed'\]/.test(api), 'create: הרצה יבשה — רק המנהל');
  ok(/\[400, 'vi_lang'\]/.test(api) && /\[400, 'vi_long'\]/.test(api) && /\[503, 'r2_needed'\] : null\);/.test(api), 'create: שפה, אורך ו־R2 — לפני ההעלאה');
  ok(/const vie = spec\.vi \? await viCreateErr\(spec\) : null;[^\n]*\n\s+if \(vie\) return res\.status\(vie\[0\]\)\.json\(\{ ok: false, error: vie\[1\] \}\);\n\s+if \(!S\.langReady\(spec\)\)/.test(api), 'create: בדיקות הניתוח לפני lang_unsupported');
  ok(/job\.spec\.vi === 1 && !g\.adm && !\(await flagOn\(deps, 'st_vi', now\)\)\) return \[409, \{ ok: false, error: 'vi_off'/.test(api), 'startJob: המתג כבה בין היצירה להתחלה');
  ok(/vi: isAdmin\(user\) \|\| await flagOn\(deps, 'st_vi', now\)/.test(api), 'apiView: הלשונית — המנהל תמיד, אחרים לפי המתג');
  /* התור */
  ok(/\(\(a\.spec \|\| \{\}\)\.vi === 1\) - \(\(b\.spec \|\| \{\}\)\.vi === 1\)/.test(api), 'הלקיחה: הניתוח אחרי התרגום');
  ok(/if \(job\.spec && job\.spec\.vi === 1 && hb\.vi !== 1\) continue;/.test(api), 'הלקיחה: רק לעובד שמכיר ניתוח (עובד ישן היה מריץ אותו כתרגום, עם Claude)');
  ok(/job\.spec && job\.spec\.vi === 1 \? Object\.assign\(\{ vi: 1 \}, job\.spec\.vo === 1 \|\| job\.spec\.vj === 1 \|\| job\.spec\.vp === 1 \? \{ vo: 1 \} : \{\}\) : \{\}/.test(api), 'תשובת הלקיחה: vi לסוכן, ו־vo לעבודת "אמת שוב" (PR 1.2ג) ולשופט בזוגות ולטיוטת הייחוס (PR 1.6)');
  ok(/if \(job\.spec\.vi === 1\) ep = ETA\.viPlan\(ep, job\.spec\.dur, job\.spec\.dry === 1\);/.test(api), 'הלקיחה: התוכנית של הניתוח');
  ok(/job\.spec\.src === 'subs' \|\| job\.spec\.vi === 1/.test(api) && /job\.spec\.vi === 1 && \(!job\.uid \|\| job\.uid !== \(await adminUid\(deps/.test(api) && /if \(sp\.vi === 1\) return job\.kind === 'tr' \? learnViRec\(/.test(read('ibkr-proxy/lib/studiolearn.js')), 'סוף העבודה: לא מלמד את "הרגיל"; במאגר — רשומה משלו (k:vi), ורק של המנהל (PR 1.3)');
  ok(/v: sp\.ka \? 'ka' : sp\.vi === 1 \? 'vi'/.test(api), 'התראת השלב: vi');
  const agent = read('translator/agent.py');
  ok(/'vi': 1\}/.test(agent) && /if jb\.get\('vi'\) == 1/.test(agent), 'הסוכן מצהיר (hb.vi) ומעביר את vi לעבודה');

  /* ---------- 7. הצפי — זהה בשרתון ובטלפון ---------- */
  ok(same(ETA.VI_STG, N.VI_STG) && same(ETA.VI_DRY_RV, N.VI_DRY_RV), 'VI_STG ו־VI_DRY_RV זהים');
  for (const d of [0, 600, 3600, 5400]) {
    for (const dry of [false, true]) {
      const a = ETA.viPlan({ s: { tr: 1, tl: 99 } }, d, dry), b = N.viPlan({ s: { tr: 1, tl: 99 } }, d, dry);
      ok(same(a.s, b.s) && a.t === b.t && a.s.tl === 0, 'viPlan זהה בשני הצדדים, בלי תרגום (' + d + ' שנ׳' + (dry ? ', יבש' : '') + ')');
    }
  }
  { const w = ETA.viPlan({ s: {} }, 3600, false), y = ETA.viPlan({ s: {} }, 3600, true);
    ok(w.s.rv === Math.round(120 + 3.6 * 60) && y.s.rv === 15 && w.s.tr === Math.round(10.8 * 60), 'שעה: התמלול ~11 דק׳; הניתוח ~6 דק׳, ביבש — ספירה בלבד'); }
  const smp = ETA.etaSample({ kind: 'tr', fires: 1, eng: 'api', spec: { vi: 1, dur: 600, mode: 'opus-medium' }, prog: { stg: { tr: { s: 1, e: 9e4 }, al: { s: 9e4, e: 2e5 }, bn: { s: 2e5, e: 3e5 }, sv: { s: 3e5, e: 4e5 } } } }, 1);
  ok(smp === null, 'עבודת ניתוח לא מלמדת את הצפי של התרגום');

  /* ---------- 8. ניטור, התראות, מרכז הניהול ---------- */
  ok(UM.typeOf({ kind: 'tr', spec: { vi: 1 } }) === 'vi', 'ניטור משתמשים: סוג vi');
  ok(W.stageText({ st: 'rv', p: 0.5, v: 'vi' }, 'he')[0] === 'מנתחים את התוכן' && W.stageText({ st: 'tr', p: 0, v: 'vi' }, 'he')[0] === W.stageText({ st: 'tr', p: 0 }, 'he')[0], 'התראת השלב: שמות הניתוח (התמלול — כמו בתרגום)');
  const adm = read('admin-app.js');
  ok(/st_vi: \[\(\) => t\('admFlStVi'\), \(\) => t\('admFlStViS'\)\]/.test(adm) && /vi: 'admTyVi'/.test(adm), 'מרכז הניהול: המתג וסוג העבודה');

  /* ---------- 9. הטלפון ---------- */
  const stj = read('studio.js');
  const P = await import(path.join(root, 'studio.js'));
  ok(VI.VI_OUTS.every((k) => P.OUT_ALL.includes(k)) && P.OUT_MAIN.includes('vi'), 'OUT_ALL — כל תוצרי הניתוח; קובץ הניתוח בשורות התוצרים');
  const nj = P.normJob({ id: 'j' + 'b'.repeat(20), spec: { name: 'x', size: 1, from: 'he', to: ['he'], vi: 1, dry: 1, out: ['compact'] }, srv: { vsm: { n: 0, ok: 0, cov: 0, so: 5, d: 60, x: 'y' } } });
  ok(nj && nj.spec.vi === 1 && nj.spec.dry === 1 && same(nj.spec.out, []), 'normJob: עבודת ניתוח נשארת ניתוח אחרי סנכרון');
  ok(nj && nj.srv && same(nj.srv.vsm, { n: 0, ok: 0, cov: 0, so: 5, d: 60 }), 'normJob: הסיכום — רק המספרים');
  for (const c of VI.VI_FAIL.filter((x) => x !== 'cap')) ok(new RegExp("case '" + c + "': return T\\('studioErr").test(stj), 'errText: ' + c);
  ok(/const viDry = \(f\) => !!\(f && f\.vdry && ui\.api && ui\.api\.admin\);/.test(stj), 'הטופס: "ניתוח יבש" — למנהל בלבד');
  ok(/Object\.assign\(spec, \{ vi: 1, from: VI_FROM\.includes\(f\.vf\) \? f\.vf : 'auto', to: \['he'\], out: \[\], eng: 'api'/.test(stj)
    && /if \(viDry\(f\)\) \{ spec\.dry = 1; delete spec\.vr; \} else \{ delete spec\.dry; spec\.vr = 1; \}/.test(stj), 'viSpecOf = normSpec בשרתון (יבש — או הצהרת זכויות)');
  ok((stj.match(/\n\s+if \(f\.vi\) viSpecOf\(f, spec\);/g) || []).length === 1 && /else if \(f\.vi\) viSpecOf\(f, spec\);/.test(stj), 'מקובץ ומקישור');
  ok((stj.match(/const sk = rec\.spec\.ka \? 'ka' : rec\.spec\.vi \? 'vi'/g) || []).length === 2 && /if \(subs === 'vi'\) return/.test(stj), 'שמות השלבים — בדף ובווילון');
  ok(/if \(rec\.spec\.vi\) return viPlan\(pl, rec\.spec\.dur, rec\.spec\.dry === 1\);/.test(stj), 'planFor: התוכנית של הניתוח (= השרתון)');
  const credits = stj.match(/const CREDITS = \[([\s\S]*?)\n\];/)[1];
  ok(/'zipformer2-66m-streaming-he', 'Yakov Kolani · ivrit\.ai', 'CC-BY-4\.0'/.test(credits), 'ייחוס למודל העברי (CC-BY-4.0)');

  /* ---------- 10. המחרוזות ---------- */
  const app = read('app.js');
  const keys = ['studioStgUpVi', 'studioStgUpViS', 'studioStgAlVi', 'studioStgAlViS', 'studioStgRvVi', 'studioStgRvViS', 'studioStgBnVi', 'studioStgBnViS',
    'studioOutVi', 'studioOutViS', 'studioNowRunningVi', 'studioViT', 'studioViS', 'studioViStart', 'studioViNote', 'studioViDry', 'studioViSo',
    'studioErrViOff', 'studioErrViLang', 'studioErrViLong', 'studioErrViCard', 'studioErrViSchema', 'admFlStVi', 'admFlStViS', 'admTyVi'];
  for (const k of keys) ok(app.split(' ' + k + ': "').length === 3, 'המחרוזת ' + k + ' בעברית ובאנגלית');

  /* ---------- 11. vi.json והמדדים (גל 1, PR 1.3) — fixtures משותפים עם vicheck.py ו־vimetrics.py (PR 1.2) ---------- */
  const fx = (f) => JSON.parse(read('translator/tests/fixtures/' + f));
  const vok = fx('vi_ok.json'), vbad = fx('vi_bad.json'), vnorm = fx('vi_bad.norm.json'), vmx = fx('vi_metrics.json');
  ok(same(VI.normVi(vok), vok), 'vi.json תקין — יוצא בדיוק כמו שנכנס (גם הסדר)');
  ok(same(VI.normVi(vbad), vnorm), 'vi.json פגום — בדיוק הפלט המנורמל שבקובץ (= vicheck.py)');
  ok(same(VI.normVi(vnorm), vnorm), 'normVi אידמפוטנטי');
  const nb = VI.normVi(vbad), flatB = JSON.stringify(nb);
  ok(!/u-should-drop|secret|\/home\/x/.test(flatB) && !('uid' in nb) && !('path' in nb.video) && !('secret' in nb.items[0]), 'שדות לא מוכרים — נזרקים (גם בתוך פריט)');
  ok(nb.genre === 'other' && nb.lang.src === 'en' && nb.lang.out === 'he' && nb.items.find((x) => x.id === 'n3').ver === 'unk' && nb.items.find((x) => x.id === 'n4').basis === 'speaker',
    'ערך מחוץ ל־enum — ברירת המחדל הזהירה (ver → unk)');
  ok(!flatB.includes('e404') && !flatB.includes('n404') && !flatB.includes('o404') && !flatB.includes('c99') && !nb.briefing.one && !nb.thesis, 'הפניה למזהה שלא קיים — נזרקת');
  ok(!nb.evidence.some((e) => e.id === 'e4') && !nb.chapters.some((c) => c.id === 'c4') && !nb.items.some((x) => x.id === 'n5'), 'טווח הפוך / טקסט ריק — הרשומה נזרקת');
  ok(nb.evidence.find((e) => e.id === 'e5').text === 'ctl <b>kept as text</b>', 'תווי בקרה נמחקים; HTML נשאר טקסט (הדף מציג טקסט בלבד)');
  ok(nb.ledger.every((l) => ('used' in l) !== ('drop' in l)) && !nb.ledger.some((l) => l.drop === 'boring'), 'הפנקס: נוצל או נדחה מסיבה ידועה — לא שניהם');
  ok(VI.normVi(Object.assign({}, vok, { v: 'snb.video-analysis/2' })) === null && VI.normVi(null) === null && VI.normVi([]) === null, 'גרסה אחרת / לא אובייקט — null');
  ok(same(VI.viMetrics(fx(vmx.in), vmx.ref), vmx.out), 'viMetrics = הפלט שבקובץ (= vimetrics.py)');
  const m0 = VI.viMetrics(vok);
  ok(m0.support_rate === 0.5 && m0.kf_used === 2 && m0.kf_total === 3 && !('ch_f1_5' in m0), 'בלי ייחוס — בלי F1 של הגבולות');
  ok(VI.boundF1([600, 1090], [605, 1200], 5) === 0.5 && VI.boundF1([], [], 5) === null && VI.boundF1([10], [], 5) === 0, 'F1 של הגבולות — התאמה אחד־לאחד בחלון');
  ok(VI.viCostHour(0.05, 1800) === 0.1 && VI.viCostHour(1, 0) === null && VI.viCostHour(-1, 60) === null, 'עלות לשעת הרצאה');
  ok(VI.VI_DROP.length === 10 && VI.VI_GENRES.includes('other') && VI.VI_VER.includes('unk'), 'ה־enum של נספח 19.1');

  /* ---------- 10. הלשונית (PR 1.5א, 10/11/2026) ---------- */
  { const NA = new Function('return ' + (stj.match(/export function normApi\(a\) \{[\s\S]*?\n\}/) || [''])[0].replace('export ', ''))();
    ok(NA({ vi: true }).vi === true && NA({ vi: 1 }).vi === false && NA({}).vi === false, 'normApi: vi עובר מהסטטוס (נזרק עד 1.5א — הניתוח לא הוצג גם למנהל)'); }
  ok(/const ST_SIB = \['ka', 'home', 'vi', 'job', 'tower'\];/.test(stj) && /\(k !== 'vi' \|\| viTabOk\(\)\)/.test(stj), 'החוגה: הניתוח במרכז (מימינו התרגום ומימין לו הקריוקי, 10/11), רק למי שמורשה');
  ok(/const stRoot = \(\) => \(viTabOk\(\) \? 'vi' : 'home'\);/.test(stj) && /\[\{ v: stRoot\(\), p: null \}\]/.test(stj) && /ui\.view = restore \? \(restore\.sv \|\| stRoot\(\)\) : stRoot\(\);/.test(stj), 'עמוד הבית = הניתוח (כשהלשונית זמינה), אחרת התרגום');
  ok(/rootFresh = !restore && stRoot\(\) === 'home';/.test(stj) && /if \(rootFresh\) \{[^]*?rootFresh = false;[^]*?ui\.view === 'home' && stRoot\(\) === 'vi' && \(!CW_OK \|\| stack\.length === 1\)[^]*?ui\.view = 'vi'; ui\.param = null;[^]*?history\.state\.studio === 1\) history\.replaceState\(cleanState\(\{ studio: 1, sv: 'vi', sp: null \}\)/.test(stj),
    'פתיחה ראשונה בלי מטמון: הסטטוס הראשון מעביר מהתרגום לניתוח — פעם אחת, רק אם לא זזו, בלי רשומת היסטוריה');
  ok(/if \(ui\.view === 'home' \|\| ui\.view === 'vi'\) \{ refreshStatus\(\); refreshJobs\(\); \}/.test(stj) && /r2: src\.st\.r2 === true/.test(stj), 'עמוד הבית החדש מרענן כמו הבית; R2 במטמון — הניתוח כבר בפתיחה');
  ok(/const viTabOk = \(\) => !!\(ui\.api && ui\.api\.vi && ui\.api\.servers > 0 && ui\.r2\);/.test(stj) && /const viOk = \(f\) => viTabOk\(\) && /.test(stj), 'הלשונית — כמו הקריוקי (שרת ואחסון) + המתג st_vi');
  ok(/\{ k: 'vi', ico: ST_DIAL_ICO\.vi, lbl: T\('studioDialVi'\) \}/.test(stj) && /if \(vb\) vb\.hidden = !stDialKeys\(\)\.includes\('vi'\);/.test(stj), 'פריט בחוגה, מוסתר בלי הרשאה');
  ok(/\(x === 'new' && y === 'vi'\) \|\| \(x === 'job' && viJob\(y\)\) \? \['vi', null\]/.test(stj) && /ch\.slice\(\)\.reverse\(\)\.find\(\(x\) => x\.v === 'ka' \|\| x\.v === 'vi' \|\| x\.v === 'home'\)/.test(stj), 'הטופס ועבודת ניתוח — תחת לשונית הניתוח');
  ok(/!rec\.spec\.ka === !kaTab && !rec\.spec\.vi === !viTab/.test(stj) && /function pageViL\(p\) \{ pageHome\(p, false, true\); \}/.test(stj) && /ui\.view === 'vi' && viTabOk\(\)\) pageViL\(p\)/.test(stj), 'רשימה משלה — ניתוחים רק בלשונית הניתוח');
  ok(/const stDialJob|function stDialJob\(\) \{[\s\S]{0,200}store\.jobs\.find\(\(r\) => r && r\.srv && !FINAL/.test(stj), '"העבודה" — הפעילה מכל הסוגים (גם ניתוח)');
  ok(/go1\.disabled = [^;]*!\(f\.vr \|\| dry\);/.test(stj), 'V130: "נתח" נעול בלי הצהרת זכויות (או הרצה יבשה של המנהל)');
  ok(/if \(f\.vi\) \{ viForm\(p, f\); return; \}/.test(stj) && !/T\('studioViT'\), sub: T\('studioViS'\), on: !!f\.vi,/.test(stj), 'טופס התרגום — בלי מתג הניתוח (עבר ללשונית)');
  { const nj2 = P.normJob({ id: 'j' + 'c'.repeat(20), spec: { name: 'x', size: 1, from: 'en', to: ['he'], vi: 1, vr: 1, mode: 'haiku-high', out: [] } });
    ok(nj2 && nj2.spec.vi === 1 && nj2.spec.vr === 1 && !nj2.spec.dry, 'normJob: הצהרת הזכויות נשמרת'); }
  // העלות לשעה (5.4) — כל המצבים, ואותו סדר כמו MODE_ORDER
  const mo = JSON.parse(stj.match(/const MODE_ORDER = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  ok(same(Object.keys(N.VI_USD_H), mo) && N.VI_USD_H['haiku-medium'][0] === 0.034 && N.VI_USD_H['opus-medium'][1] === 1.52, 'VI_USD_H — כל המצבים (5.4)');
  ok(Math.abs(N.viUsd('haiku-medium', 'he', 3600) - 0.051) < 1e-9 && Math.abs(N.viUsd('sonnet-low', 'en', 1800) - 0.225) < 1e-9 && N.viUsd('nope', 'en', 3600) === 0.034 && N.viUsd('haiku-high', 'he', -5) === 0, 'viUsd — לפי משך, שפה ומצב');
  ok(N.viUsd('haiku-medium', 'auto', 3600) === N.viUsd('haiku-medium', 'he', 3600), '1.2א: "אוטומטי" — לפי עברית (היקרה)');
  ok(/fmtUsd\(viUsd\(m\.id, o\.vi, 3600\)\)/.test(stj), 'הבורר: עלות לשעה בניתוח, במקום זמן לשעה');
  // ההסכמות (LRN_VV) — זהה לשרתון, רק lat/lam/lau
  const apiSt = read('ibkr-proxy/api/studio.js');
  ok(P.LRN_VV === 5 && Number((apiSt.match(/const LRN_VV = (\d+);/) || [])[1]) === P.LRN_VV && P.LRN_TV !== P.LRN_VV, 'LRN_VV — זהה לשרתון ונפרד מ־LRN_TV');
  ok(/net\.api\('learnPref', \{ ack: true, tv: LRN_VV, vi: \{ \[k\]: on \} \}\)/.test(stj) && /\['lat', T\('studioViLatT'\), T\('studioViLatS'\)\], \['lam', T\('studioViLamT'\), T\('studioViLamS'\)\], \['lau', T\('studioViLauT'\), T\('studioViLauS'\)\]/.test(stj), 'הגדרות: שלוש הסכמות נפרדות, דרך learnPref עם vi');
  ok(/ui\.lat = num\(j\.lat\); ui\.lam = num\(j\.lam\); ui\.lau = num\(j\.lau\);/.test(stj), 'המצב מהסטטוס');
  const appj = read('app.js');
  ok(appj.includes('studioViLatS: "כדי לשפר את ניתוח הסרטונים, נשמרים התמליל, הטקסט שעל השקפים והתוצאה של הניתוח — מוצפנים') && appj.includes('studioViLamS: "גם תמונות קטנות של השקפים, מוצפנות באותו אופן."'), 'הנוסח המאושר (docs/privacy.md)');
  ok(/nuPickOk = \(f\) => phOk\(\) && !!f && !f\.ka && !f\.vi;/.test(stj), 'ניתוח — בלי הורדה בטלפון (העובד מקבל קובץ רגיל)');

  console.log(`---- studio-vi: ${n} בדיקות, הכל תקין`);
})().catch((e) => { console.error(e); process.exit(1); });
