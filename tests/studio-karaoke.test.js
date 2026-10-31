// 26/10/2026: קריוקי משיר רגיל — השרתון (normSpec, תוצרים, קודי שגיאה, התוכנית), הטלפון (הטופס, המילים) והעובד (הניתוב).
// הלוגיקה של העובד — translator/tests/test_karaoke.py. הרצה: node tests/studio-karaoke.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const ETA = require(path.join(root, 'ibkr-proxy/lib/studioeta.js'));
  const INC = require(path.join(root, 'ibkr-proxy/lib/studioinc.js'));
  const N = await import(path.join(root, 'studionet.js'));
  const base = { name: 'song.mp3', size: 1000, to: ['he'], out: ['compact', 'mkv', 'small'], eng: 'api', ka: 1, lyr: 'hello‏ world\r\nagain' };

  /* ---------- 1. השרתון ---------- */
  const sp = S.normSpec(Object.assign({}, base, { bv: 1, gv: 99 }));
  ok(sp && sp.ka === 1 && sp.lyr === 'hello world\nagain' && sp.bv === 1 && sp.gv === 60, 'normSpec: קריוקי — המילים מנוקות, קולות רקע, קול מנחה עד 60%');
  ok(JSON.stringify(sp.out) === '["compact","small"]', 'תוצרים: רק סרטונים של קריוקי (בלי MKV)');
  ok(S.normSpec(Object.assign({}, base, { lyr: '  \n ' })) === null, 'בלי מילים — לא נוצרת עבודה');
  ok(S.normSpec(Object.assign({}, base, { eng: undefined })) === null, 'רק בשרת שלנו (eng api)');
  ok(S.normSpec(Object.assign({}, base, { cp: 1 })) === null && S.normSpec(Object.assign({}, base, { ry: 1 })) === null, 'לא בהעתק־הדבק ולא ב"מנוי שלי"');
  ok(S.normSpec(Object.assign({}, base, { ph: 1 })) === null, 'לא בתרגום בטלפון');
  ok(S.normSpec(Object.assign({}, base, { lyr: 'x'.repeat(20000) })).lyr.length === S.KA_LYR_MAX, 'המילים עד KA_LYR_MAX');
  const plain = S.normSpec({ name: 'a.mp4', size: 10, to: ['he'], out: ['compact'] });
  ok(plain && !('ka' in plain) && !('lyr' in plain), 'עבודת תרגום רגילה — בלי שדות הקריוקי');
  for (const k of ['inst', 'lrc', 'elrc', 'ass']) ok(S.OUT_KINDS.includes(k), 'תוצר ' + k + ' מותר');
  ok(INC.ERR_INFO.ka_lyrics && INC.ERR_INFO.ka_noaudio, 'קודי השגיאה של הקריוקי ב־ERR_INFO');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/body\.op === 'create' && body\.spec && body\.spec\.ka === 1 \? 20000 : 4096/.test(api), 'יצירת קריוקי — גוף עד 20KB (המילים), השאר כמו קודם');
  ok(/const kaAllowed = async \(\) => true;/.test(api) && /if \(user\.mon !== true && !allowed\(user\)\)/.test(api), '30/10: קריוקי — כל מי שעבר את שער הסטודיו (בקשת המשתמש)');
  ok(/if \(spec\.ka && !\(await kaAllowed\(\)\)\) return res\.status\(403\)/.test(api) && /ka: await kaAllowed\(\)/.test(api), 'השרתון חוסם ביצירה ומדווח לטלפון (ka)');
  ok(/if \(job\.spec\.ka === 1\) ep = ETA\.kaPlan\(ep, job\.spec\.dur, job\.spec\.bv === 1, ETA\.kaModel\(gd\.ka, now\)\)/.test(api), 'בלקיחה: התוכנית של הקריוקי — מהמודל הנלמד');
  ok(/const ks = up\.state === 'done' \? ETA\.kaSample\(Object\.assign\(\{\}, job, up\), now\) : null;/.test(api) && /\{ ka: ETA\.addKaSample\(g && g\.ka, ks\), updated: now \}/.test(api), '31/10: קריוקי שהסתיים נכנס למאגר הקריוקי (studioEta/a.ka)');
  ok(/eta: ETA\.etaView\(st\.et, now, gEta\.et, gEta\.ka\)/.test(api) && (api.match(/readDoc\(deps, 'studioEta', 'a'\)/g) || []).length === 4, 'status: אותה קריאה אחת של studioEta/a — גם לקריוקי (בלי קריאה נוספת)');

  /* ---------- 2. התוכנית — זהה בשרתון ובטלפון ---------- */
  for (const d of [0, 60, 215, 600]) {
    const a = ETA.kaPlan({ s: { tr: 1, tl: 99, rv: 99 } }, d), b = N.kaPlan({ s: { tr: 1, tl: 99, rv: 99 } }, d);
    ok(JSON.stringify(a.s) === JSON.stringify(b.s) && a.t === b.t && a.s.tl === 0 && a.s.rv === 0, 'kaPlan זהה בשני הצדדים, בלי תרגום וביקורת (' + d + ' שנ׳)');
  }
  ok(JSON.stringify(ETA.KA_STG) === JSON.stringify(N.KA_STG) && JSON.stringify(ETA.KA_BV) === JSON.stringify(N.KA_BV), 'KA_STG ו־KA_BV זהים');
  { const a = N.kaPlan({ s: {} }, 240), b = N.kaPlan({ s: {} }, 240, true), c = ETA.kaPlan({ s: {} }, 240, true);
    const tr = N.KA_STG.tr[0] + N.KA_STG.tr[1] * 4, tb = tr + N.KA_BV[0] + N.KA_BV[1] * 4;
    ok(a.s.tr === tr && b.s.tr === tb && c.s.tr === b.s.tr && tr === 860 && tb === 860 + 240, '31/10: ה־prior לפי השרת — שיר של 4 דק׳: הפרדה כ־14 דק׳, עם קולות רקע עוד 4'); }
  /* 31/10/2026: הצפי לומד — המאגר של הקריוקי נפרד מזה של התרגום */
  {
    const stg = (tr, al, bn, sv) => { let t = 1e6; const o = {}; for (const [k, v] of [['tr', tr], ['al', al], ['bn', bn], ['sv', sv]]) { o[k] = { s: t, e: t + v * 1000 }; t += v * 1000; } return o; };
    const job = (d, bv, tr) => ({ kind: 'tr', fires: 1, eng: 'api', hc: 8, spec: Object.assign({ ka: 1, dur: d, mode: 'opus-medium' }, bv ? { bv: 1 } : {}), prog: { stg: stg(tr, 120, 150, 30) } });
    ok(ETA.etaSample(job(240, 0, 900), 5) === null, 'קריוקי לא נכנס למאגר הצפי של התרגום (ההפרדה נרשמה שם כ"תמלול")');
    ok(ETA.kaSample({ kind: 'tr', fires: 1, spec: { dur: 240, mode: 'opus-medium' }, prog: { stg: stg(90, 1, 1, 1) } }, 5) === null && ETA.kaSample(Object.assign(job(240, 0, 300), { fires: 2 }), 5) === null, 'kaSample — רק קריוקי בהפעלה אחת');
    const sm = ETA.kaSample(job(240, 1, 400), 5);
    ok(sm && sm.d === 240 && sm.b === 1 && sm.s.tr === 400 && sm.s.al === 120 && !('tl' in sm.s) && !sm.f, 'kaSample: השלבים, האורך וקולות הרקע — בלי שמות ותוכן');
    { const c = ETA.kaSample(job(240, 0, 3), 5); ok(c && !('tr' in c.s) && c.s.al === 120, 'הפרדה מהמטמון (3 שנ׳ לשיר של 4 דק׳) — לא נלמדת, שאר השלבים כן'); }
    ok(/if ka_cache_get\(ck, work\):/.test(read('translator/job.py')) && /ka_cache_put\(ck, work\)/.test(read('translator/job.py')), 'העובד: מטמון ההפרדה לפני ההפרדה ואחריה');
    let list = [];
    for (let i = 0; i < 12; i++) list = ETA.addKaSample(list, ETA.kaSample(job(120 + 30 * i, 0, 20 + 60 * (120 + 30 * i) / 60), 1e12));
    for (let i = 0; i < 40; i++) list = ETA.addKaSample(list, null);
    ok(list.length === 12 && ETA.addKaSample(list.concat(list, list), null).length === 30, 'המאגר מוגבל ל־30');
    const md = ETA.kaModel(list, 1e12), p4 = ETA.kaPlan({ s: {} }, 240, false, md), p0 = ETA.kaPlan({ s: {} }, 240, false);
    ok(Math.abs(p4.s.tr - 260) < 40 && p0.s.tr !== p4.s.tr, 'נלמד: 12 שירים בקצב דקה לדקת שיר → צפי של כ־4.3 דק׳ לשיר של 4 דק׳ (' + p4.s.tr + ')');
    ok(ETA.kaPlan({ s: {} }, 240, true, md).s.tr === ETA.kaPlan({ s: {} }, 240, true).s.tr, 'עם קולות רקע — קו משלו (בלי דגימות bv נשאר ה־prior)');
    const v = ETA.etaView([], 1e12, [], list);
    ok(v.k && N.kaMdlOk(v.k) && N.kaPlan({ s: {} }, 240, false, v.k).s.tr === p4.s.tr, 'status.eta.k → הטלפון מחשב אותה תוכנית');
    ok(!N.kaMdlOk({ st: { tr: [1, 2] } }) && N.kaPlan({ s: {} }, 240, false, { st: { tr: [1, 2] } }).s.tr === p0.s.tr, 'מודל חלקי/פגום — ה־prior');
    ok(/if \(kaMdlOk\(o\.k\)\) out\.k = /.test(read('studio.js')), 'normEta בטלפון מקבל את k');
  }
  ok(/kaPlan\(pl, rec\.spec\.dur, rec\.spec\.bv === 1, ui\.eta && ui\.eta\.k\)/.test(read('studio.js')), 'הטלפון מעביר את bv ואת המודל הנלמד לתוכנית');

  /* ---------- 3. הטלפון ---------- */
  const st = read('studio.js');
  const kaLyr = new Function('KA_LYR_MAX', (st.match(/export function kaLyr\(t\) \{[\s\S]*?\n\}/) || [''])[0].replace('export ', '') + '; return kaLyr;')(8000);
  for (const t of ['a‎b\r\nc', 'x'.repeat(9000), null, 'שלום‫עולם']) ok(kaLyr(t) === S.normLyr(t), 'kaLyr בטלפון = normLyr בשרתון');
  ok(/const kaOk = \(\) => !!\(ui\.api && ui\.api\.servers > 0 && ui\.r2 && \(ui\.api\.admin \|\| ui\.api\.ka\)\)/.test(st), 'הקריוקי מוצע רק כשיש שרת ואחסון, למנהל ולחשבונות הבדיקה');
  { const N2 = new Function('return ' + (st.match(/export function normApi\(a\) \{[\s\S]*?\n\}/) || [''])[0].replace('export ', ''))();
    ok(N2({ ka: true }).ka === true && N2({ ka: 1 }).ka === false, 'normApi: ka רק true'); }
  ok(!/const kaRow = /.test(st) && /if \(f\.ka\) \{   \/\/ 26\/10\/2026: קריוקי — המילים/.test(st), 'בטופס: קטע משלו, בלי מתג (30/10: כלי נפרד)');
  ok(/function pageKa\(p\) \{ pageHome\(p, true\); \}/.test(st) && /ui\.view === 'ka' && kaOk\(\)\) pageKa\(p\)/.test(st) && /if \(kaTab\) form\.ka = true/.test(st), '30/10: לשונית קריוקי — רשימה משלה, והפרויקט החדש נפתח ישר במצב קריוקי');
  ok(/store\.jobs\.filter\(\(rec\) => !rec\.spec\.ka === !kaTab\)/.test(st) && /k !== 'ka' \|\| kaOk\(\)/.test(st), '30/10: שירים רק בלשונית הקריוקי, והלשונית רק למי שמורשה');
  ok(/if \(!f\.ka\) tracksFor\(f, file\)/.test(st) && /const adv = f\.ka \? null : advRows/.test(st), '30/10: בשיר — בלי חיפוש כתוביות, רצועות ועצות של תרגום');
  ok(/inp\.accept = f\.ka \? 'audio\/\*,video\/\*/.test(st), 'בקריוקי — גם שיר בלי וידאו');
  ok((st.match(/kaSpec\(f, spec\)/g) || []).length >= 2, 'הקריוקי נשלח גם מקובץ וגם מקישור');
  ok(/if \(est\.min && !f\.ka && !f\.estOk/.test(st) && /if \(est\.min && !f\.ka && typeof askConfirm/.test(st), 'בלי אומדן עלות (אין Claude)');
  ok(/if \(rec\.spec\.ka && \(s\.id === 'tl' \|\| s\.id === 'rv'\)\) continue;/.test(st), 'בדף העבודה — בלי שלבי תרגום וביקורת');
  // 30/10/2026 (הצילום: שיר מקישור שהורד בטלפון חזר כתרגום רגיל, עם מודל ועלות) — הפרדה מלאה בין הכלים
  ok(/\.\.\.\(f\.ka \? \{ ka: true, lyr: kaLyr\(f\.lyr\)/.test(st) && /pend\.f\.ka === true\) Object\.assign\(f, \{ ka: true/.test(st), 'הורדה בטלפון: הקריוקי והמילים נשמרים וחוזרים לטופס');
  ok(/if \(!f\.ka\) tracksFor\(f, file\);\n  if \(root\) \{ if \(ui\.view !== 'new'\) go\('new', f\.ka \? 'ka' : null/.test(st), 'הורדה בטלפון: חוזרים לטופס של הקריוקי');
  ok(/go\('new', kaTab \? 'ka' : null\)/.test(st) && /if \(!editing && ui\.param === 'ka'\) form\.ka = true;/.test(st), 'הכלי בכתובת הדף — טופס שנבנה מחדש נשאר קריוקי');
  ok(/\(x === 'new' && y === 'ka'\) \|\| \(x === 'job' && kaJob\(y\)\) \? \['ka', null\]/.test(st), 'שיר ועבודת קריוקי — תחת הקריוקי, לא תחת הסרטונים');
  ok(/rec\.spec\.ka \? null : kvRow\(T\('studioSecMode'\)/.test(st) && /rec\.spec\.ka \? null : kvRow\(T\('studioSecLangs'\)/.test(st), 'פרטי עבודת קריוקי — בלי מודל ושפות');
  ok(/if \(sp\.ka === 1\) Object\.assign\(spec, \{ ka: 1 \}/.test(st), 'normJob שומר את הקריוקי (אחרי רענון / סנכרון — לא נהיה "תרגום")');
  ok(/if \(styEditable\(rec\) && !rec\.spec\.ka\)/.test(st) && /if \(sla\.u && !rec\.spec\.ka\)/.test(st), 'עבודת קריוקי — בלי עיצוב כתוביות ובלי תקציב');
  ok(/end: f\.ka \? null : saveTop/.test(st), 'לטופס של שיר אין "שמירה" (טיוטות — רק לתרגום)');
  const app = read('app.js');
  for (const k of ['studioKaRow', 'studioKaLyr', 'studioKaStart', 'studioStgTrKa', 'studioOutInst', 'studioKaNoAudio'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בשתי השפות');

  /* ---------- 4. העובד ---------- */
  const jp = read('translator/job.py');
  ok(/if \(load_state\(\)\.get\('spec'\) or \{\}\)\.get\('ka'\) == 1:[^\n]*\n\s+return karaoke\(args\)/.test(jp), 'auto: עבודת קריוקי → karaoke (בלי Claude)');
  ok(/LYR_MAX = 8000/.test(read('translator/vt/karaoke.py')) && S.KA_LYR_MAX === 8000, 'אורך המילים — אותו גבול בעובד ובשרתון');
  ok(!/shell=True/.test(read('translator/karaoke.py')), 'karaoke.py — בלי shell');

  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
