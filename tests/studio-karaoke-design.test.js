// 31/10/2026: עיצוב הקריוקי (ת־קריוקי) — הנרמול זהה בטלפון, בשרתון ובעובד; סימון הזמרים במילים זהה בתצוגה ובעובד;
// הדף מחובר (טופס → הדף, החזרה, המחרוזות), והעובד מקבל את העיצוב. הרצה: node tests/studio-karaoke-design.test.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const st = await import(path.join(root, 'studio.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const cases = [{}, null, [], { u: '#abcdef', c: 'red', f: 'd', z: 'L', cd: 0, tc: 0, dm: 2, bg: 'tint', sg: ['#000000', 5], sb: '#00ff00', x: 1 },
    { dm: 7, z: 'XL', bg: 'x', f: 'q', sg: 'no' }, { dm: 0, cd: 1, tc: '0' }];
  const py = JSON.parse(execFileSync('python3', ['-c',
    'import json,sys; sys.path.insert(0,"translator"); from vt import karaoke as K; print(json.dumps([K.norm_ky(x) for x in json.loads(sys.argv[1])]))',
    JSON.stringify(cases)], { cwd: root, encoding: 'utf8' }));
  cases.forEach((c, i) => {
    const a = st.normKy(c), b = S.normKy(c);
    ok(JSON.stringify(a) === JSON.stringify(b), 'טלפון = שרתון #' + i);
    ok(JSON.stringify(a) === JSON.stringify(py[i]), 'טלפון = עובד #' + i);
  });
  ok(JSON.stringify(st.KY_DEF) === JSON.stringify(S.KY_DEF), 'ברירות המחדל זהות');
  ok(st.normKy({}).u === '#FFFFFF' && st.normKy({ c: '#ff5ca8' }).c === '#FF5CA8', 'צבע באותיות גדולות');

  /* השרתון שומר את העיצוב בעבודת קריוקי בלבד */
  const base = { name: 'song.mp3', size: 1000, type: 'audio/mpeg', eng: 'api', ka: 1, lyr: 'a b c', out: ['compact'], to: ['he'] };
  const sp = S.normSpec(Object.assign({ ky: { c: '#FF5CA8', evil: 1 } }, base));
  ok(sp && sp.ky && sp.ky.c === '#FF5CA8' && !('evil' in sp.ky), 'normSpec: ky מנורמל בקריוקי');

  /* סימון הזמרים — התצוגה בטלפון = parse_singers בעובד (על השורות הראשונות) */
  const lyr = '[1]\nשורה ראשונה כאן\n[זמר 2] שורה שנייה כאן\n[Chorus]\n[ביחד]\nכולם שרים\n(p1) back to one';
  const pv = st.kyPvLines(lyr);
  const pys = JSON.parse(execFileSync('python3', ['-c',
    'import json,sys; sys.path.insert(0,"translator"); from vt import karaoke as K; print(json.dumps(K.parse_singers(sys.argv[1])))', lyr], { cwd: root, encoding: 'utf8' }));
  ok(JSON.stringify(pv.map((x) => x.sg)) === JSON.stringify(pys), 'סימון הזמרים זהה: ' + JSON.stringify(pys));
  ok(pv[1].t === 'שורה שנייה כאן', 'הסימון יורד מהשורה');
  ok(st.kyPvLines('no tags\nat all').every((x) => x.sg === null), 'בלי סימון — זמר לא ידוע');
  ok(st.kySchemeOf(st.normKy({})) === 'gold' && st.kySchemeOf(st.normKy({ c: '#123456' })) === 'custom', 'ערכה לפי הצבעים');
  ok(st.normSettings({ ky: { c: '#3DD6FF' } }).ky.c === '#3DD6FF' && !('ky' in st.normSettings({})), 'ההגדרות שומרות את העיצוב');

  /* החיבורים */
  const sj = read('studio.js');
  ok(/ky: normKy\(f\.ky \|\| store\.settings\.ky\)/.test(sj), 'kaSpec שולח את העיצוב');
  ok(/go\('kasty'\)/.test(sj) && /ui\.view === 'kasty' && kaOk\(\)\) pageKaSty\(p\)/.test(sj) && /x === 'kasty' \? \['new', 'ka'\]/.test(sj), 'הדף: מהטופס, בניתוב, וחזרה לטופס');
  ok(!/f\.ka[\s\S]{0,400}stylePicker\(f\.style/.test(sj.slice(sj.indexOf('if (f.ka) {   // 26/10/2026'), sj.indexOf('// שפות'))), 'בטופס של שיר — בלי "עיצוב הכתוביות"');
  const jp = read('translator/job.py');
  ok(/'--ky', json\.dumps\(ks\['ky'\]\), '--lyrics', str\(lyr\)/.test(jp) && /'video', '--audio'[^\n]*'--ky'/.test(jp), 'job.py מעביר את העיצוב ל־build ול־video');
  for (const k of ['studioKyT', 'studioKySingersNote', 'studioKySch_custom', 'studioKyS4']) {
    ok(new RegExp(k + ': "').test(read('app.js')) && (read('app.js').match(new RegExp(k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);
  }
  console.log('\n' + n + '/' + n + ' passed');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
