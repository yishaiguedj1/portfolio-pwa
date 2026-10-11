// סבב 2 (11/10/2026): הצעות לפני ההתחלה (בדיקת הסרטון בטלפון — שקט בקצוות, אין קול, שפה, כבר תורגם)
// והצעות אחרי (בדיקת משמעות לכתוביות שהשופט סימן, הפקה מחדש לסרטון אנכי).
// הרצה: node tests/studio-round2.test.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  global.document = { documentElement: { lang: 'he' } };
  global.t = (k, v) => (v ? k + ':' + JSON.stringify(v) : k);
  const N = await import(path.join(root, 'studionet.js'));
  const st = await import(path.join(root, 'studio.js'));

  /* ---------- 1. עוצמה ושקט (טהור) ---------- */
  const sr = 1000, sig = (sec, on) => { const a = new Float32Array(sec * sr); if (on) for (let i = 0; i < a.length; i++) a[i] = 0.3 * Math.sin(i / 3); return a; };
  const acc = N.levelAcc(0.5);
  // 20 שנ׳ שקט, 40 שנ׳ דיבור, 15 שנ׳ שקט — בשתי חתיכות, שתי ערוצים
  const all = new Float32Array(75 * sr); all.set(sig(40, true), 20 * sr);
  acc.add(0, sr, [all.subarray(0, 30 * sr), all.subarray(0, 30 * sr)]);
  acc.add(30, sr, [all.subarray(30 * sr), all.subarray(30 * sr)]);
  const bins = acc.bins();
  ok(bins.length === 150 && bins[0].t === 0 && bins[149].t === 74.5, 'levelAcc: חלון כל חצי שנייה, חתיכות שמתחברות');
  ok(bins[10].db < -100 && bins[60].db > -20, 'levelAcc: שקט ≈ ‎-120dB, דיבור ≈ ‎-13dB');
  const e = N.edgeSilence(bins, 75, 60);
  ok(e.lead === 20 && e.trail === 15, 'edgeSilence: 20 שנ׳ שקט בהתחלה, 15 בסוף');
  ok(e.db > -20, 'edgeSilence: עוצמת הדיבור (אחוזון 90)');
  ok(N.edgeSilence([], 30, 15).lead === 15 && N.edgeSilence([], 30, 15).db === null, 'בלי חלונות — "שקט" לכל החלון, בלי עוצמה');
  ok(N.langOf('heb') === 'he' && N.langOf('eng') === 'en' && N.langOf('und') === '' && N.langOf('en-US') === 'en' && N.langOf('xyz') === '' && N.langOf('<b>') === '',
    'langOf: קוד שפה מהקובץ (3 אותיות / BCP47) → שתי אותיות; לא מסומן — ריק');

  /* ---------- 2. הצעות לפני ההתחלה ---------- */
  const m = { dur: 600, w: 1920, h: 1080, audio: 'aac', lang: '', lead: 2, trail: 3, db: -20 };
  const ctx = { from: 'auto', to: ['he'], name: 'talk.mp4', size: 100, jobs: [] };
  ok(st.sourceAdvice(m, ctx).length === 0, 'סרטון רגיל — בלי הצעות');
  const ed = st.sourceAdvice(Object.assign({}, m, { lead: 25, trail: 14 }), ctx);
  ok(ed.length === 1 && ed[0].k === 'edges' && ed[0].a === 24 && ed[0].b === 587 && ed[0].save === 37 && ed[0].act === 'cut', 'שקט בקצוות → חיתוך (שנייה מרווח בכל צד)');
  ok(st.sourceAdvice(Object.assign({}, m, { lead: 25 }), ctx)[0].b === 600, 'שקט רק בהתחלה — הסוף נשאר');
  ok(st.sourceAdvice(Object.assign({}, m, { lead: 25 }), Object.assign({}, ctx, { edl: { k: [[0, 10]] } })).length === 0, 'כבר יש חיתוך — בלי הצעה');
  ok(st.sourceAdvice(Object.assign({}, m, { lead: 300, trail: 290 }), ctx).length === 0, 'נשאר פחות מ־20 שנ׳ — בלי הצעה לחתוך');
  ok(st.sourceAdvice(Object.assign({}, m, { audio: '' }), ctx)[0].k === 'noaudio', 'אין קול → "אין קול"');
  const sil = st.sourceAdvice(Object.assign({}, m, { db: -70, lead: 60, trail: 60 }), ctx);
  ok(sil.length === 1 && sil[0].k === 'silent' && sil[0].sev === 'bad', 'שקט כמעט מלא → "כמעט אין קול" (בלי הצעת חיתוך)');
  ok(st.sourceAdvice(Object.assign({}, m, { lang: 'he' }), ctx)[0].k === 'same', 'הקול מסומן בעברית ומתרגמים לעברית → "כבר בשפת התרגום"');
  const fr = st.sourceAdvice(Object.assign({}, m, { lang: 'fr' }), ctx)[0];
  ok(fr.k === 'lang' && fr.lang === 'fr' && fr.sev === 'warn', 'הקול מסומן בצרפתית → כרגע רק מאנגלית');
  ok(st.sourceAdvice(Object.assign({}, m, { lang: 'en' }), ctx).length === 0, 'אנגלית — בלי הצעה');
  const prev = { id: 'j' + 'C'.repeat(20), spec: { name: 'talk.mp4', size: 100 }, srv: { state: 'done', kind: 'tr' } };
  const dup = st.sourceAdvice(null, Object.assign({}, ctx, { jobs: [prev] }));
  ok(dup.length === 1 && dup[0].k === 'dup' && dup[0].id === prev.id, 'אותו שם וגודל כבר תורגם → פתיחת התרגום הקודם (גם בלי בדיקה — סרטון מ־Drive)');
  ok(st.sourceAdvice(null, Object.assign({}, ctx, { jobs: [Object.assign({}, prev, { srv: { state: 'failed' } })] })).length === 0, 'עבודה שנכשלה — לא "כבר תורגם"');
  const order = st.sourceAdvice(Object.assign({}, m, { audio: '', lead: 30 }), Object.assign({}, ctx, { jobs: [prev] })).map((a) => a.sev).join();
  ok(order === 'bad,warn', 'סדר: קודם מה שחוסם, אחר כך אזהרות, ובסוף חיסכון');

  /* ---------- 3. אחרי: השופט וסרטון אנכי ---------- */
  const jd = { s: 70, n: 38, t: 40, a: 312, c: { mean: 2, omit: 1 }, f: [5, 9, 31] };
  ok(JSON.stringify(st.normJudge(jd).f) === '[5,9,31]', 'normJudge: מספרי הכתוביות שסומנו');
  ok(JSON.stringify(st.normJudge(Object.assign({}, jd, { f: [9, 5, 5, 'x', 7] })).f) === '[9]', 'normJudge בטלפון: רק עולים, מספרים');
  ok(!('f' in st.normJudge(Object.assign({}, jd, { f: [] }))), 'בלי מספרים — בלי שדה');
  const done = { id: 'j' + 'D'.repeat(20), spec: { name: 'a.mp4' }, srv: { state: 'done', kind: 'tr', jd: st.normJudge(jd) }, vm: { w: 1080, h: 1920 } };
  const aa = st.afterAdvice(done, {});
  ok(aa.map((a) => a.k).join() === 'jd,vert' && aa[0].n === 3, 'אחרי: בדיקת משמעות ל־3 + הפקה לאנכי');
  ok(st.afterAdvice(done, { rrDone: true }).map((a) => a.k).join() === 'jd', 'כבר הופק מחדש — בלי הצעת אנכי');
  ok(st.afterAdvice(Object.assign({}, done, { vm: { w: 1920, h: 1080 } }), {}).map((a) => a.k).join() === 'jd', 'אופקי — בלי הצעת אנכי');
  ok(st.afterAdvice(Object.assign({}, done, { srv: Object.assign({}, done.srv, { state: 'running' }) })).length === 0, 'רק לעבודה שהסתיימה');
  const cues = [{ i: 5, s: 0, e: 2, lines: ['א'], en: 'a' }, { i: 6, s: 2, e: 4, lines: ['ב'], en: 'b' }, { i: 9, s: 4, e: 6, lines: ['ג'], en: 'c' }];
  const rows = st.jdRows(cues, [5, 9, 77]);
  ok(rows.length === 2 && rows[0].id === 1 && rows[1].id === 3 && rows[1].en === 'c', 'jdRows: מזהי vt → שורות לגיליון (מספור העורך), מזהה שלא קיים — בחוץ');

  /* ---------- 4. העבודה שומרת את המידות ---------- */
  const J = 'j' + 'E'.repeat(20);
  ok(JSON.stringify(st.normJob({ id: J, spec: {}, vm: { w: 1080, h: 1920 } }).vm) === '{"w":1080,"h":1920}', 'normJob: מידות הסרטון נשמרות');
  ok(!('vm' in st.normJob({ id: J, spec: {}, vm: { w: 0, h: 5 } })) && !('vm' in st.normJob({ id: J, spec: {} })), 'normJob: מידות לא תקינות — בלי שדה');

  /* ---------- 5. אותו קבוע בשלושה מקומות ---------- */
  const job = read('translator/job.py'), lib = read('ibkr-proxy/lib/studio.js'), sj = read('studio.js');
  ok(/JG_F_MAX = 40/.test(job) && /const JG_F_MAX = 40;/.test(lib) && st.JG_F_MAX === 40, 'JG_F_MAX זהה בעובד, בשרתון ובטלפון');
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  ok(JSON.stringify(S.normJudge(jd).f) === '[5,9,31]' && S.normJudge(Object.assign({}, jd, { f: [9, 5] })) === null, 'השרתון: אותה צורה (לא תקין — נזרק כולו)');
  const py = spawnSync('python3', ['-c', 'import sys,json; sys.path.insert(0, sys.argv[1]); import job; ids={1,2,3,4,5,6,7,8,9,10,11,12};'
    + ' t="\\n".join("#%d %d %s" % (i, 2 if i in (3,7) else 5, "mean" if i in (3,7) else "ok") for i in sorted(ids)); print(json.dumps(job.judge_score(t, ids)))',
    path.join(root, 'translator')], { encoding: 'utf8' });
  if (py.status === 0) {
    const r = JSON.parse(py.stdout.trim().split('\n').pop());
    ok(JSON.stringify(r.f) === '[3,7]' && JSON.stringify(S.normJudge(Object.assign(r, { t: 12, a: 100 })).f) === '[3,7]', 'מהעובד לשרתון: מספרי הכתוביות שסומנו עוברים כמו שהם');
  }

  /* ---------- 6. החיבור בממשק ---------- */
  ok(/inspectFor\(f, file\)/.test(sj) && /f\.edl = null; f\.dur = 0; inspectFor/.test(sj), 'בחירת קובץ: בדיקה ברקע, וחיתוך של הקובץ הקודם מתאפס');
  ok(/sm && sm\.dur \? \{ dur: sm\.dur \} : await probeVideo\(file\)/.test(sj), 'ההתחלה משתמשת באורך מהבדיקה (בלי לקרוא את הקובץ שוב)');
  ok(/aiPreset = \{ id: rec\.id, ids: rec\.srv\.jd\.f \}; go\('subs', rec\.id\)/.test(sj) && /jdRows\(cues, aiPreset\.ids\)/.test(sj), 'בדיקת משמעות: העורך ואז גיליון ה־AI עם הבקשה בתור (אומדן ואישור — כרגיל)');
  ok(/AudioBufferSink/.test(read('studionet.js')) && !/fetch\(/.test(read('studionet.js').split('export async function inspectSource')[1].split('/* רצועת הקול')[0]), 'הבדיקה בטלפון בלבד — בלי רשת');
  const app = read('app.js');
  for (const k of ['studioAdvDup', 'studioAdvDupS', 'studioAdvNoAudio', 'studioAdvSilent', 'studioAdvRepickS', 'studioAdvSame', 'studioAdvSameS', 'studioAdvLang', 'studioAdvLangS',
    'studioAdvEdges', 'studioAdvEdgesS', 'studioAdvCutOk', 'studioAdvOpen', 'studioAdvCut', 'studioAdvHide', 'studioAdvAfterT', 'studioAdvJd', 'studioAdvJdS', 'studioAdvVert', 'studioAdvVertS'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בשתי השפות: ' + k);
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
