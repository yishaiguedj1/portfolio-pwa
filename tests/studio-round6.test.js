// סבב 6: הציר בעורך הכתוביות — גל הקול וחילופי השוטים מהעובד (peaks.py → timeline.json), הצמדה לחיתוכים (כלל Netflix),
// וצבע לכל דובר. הרצה: node tests/studio-round6.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const VPY = fs.existsSync('/tmp/vtv/bin/python') ? '/tmp/vtv/bin/python' : 'python3';

(async () => {
  const SB = await import(path.join(root, 'studiosubs.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- 1. timeline.json — הצורה ---------- */
  const pk = Buffer.from([0, 10, 200, 255]).toString('base64');
  const m = SB.normMeta({ v: 1, r: 20, pk, sh: [1, 0.5, 2, 2, -1, 'x', 90000, 3] });
  ok(m && Array.from(m.pk).join() === '0,10,200,255' && m.sh.join() === '1,2,3', 'normMeta: base64 → בתים; חילופים — ממוינים, בלי כפולים, בטווח');
  ok(SB.normMeta({ v: 2, r: 20, pk }) === null && SB.normMeta({ v: 1, r: 10, pk }) === null && SB.normMeta({ v: 1, r: 20, pk: 5 }) === null
    && SB.normMeta({ v: 1, r: 20, pk: 'A'.repeat(Math.ceil(SB.PK_MAX / 3) * 4 + 8) }) === null && SB.normMeta(null) === null, 'normMeta: גרסה / קצב / ארוך מ־4 שעות — null');
  const pyc = JSON.parse(execFileSync('python3', ['-c', 'import sys, json; sys.path.insert(0, "translator"); import peaks as P; print(json.dumps([P.R, P.PK_MAX, P.SH_MAX]))'], { cwd: root, encoding: 'utf8' }));
  ok(pyc[0] === SB.META_R && pyc[1] === SB.PK_MAX && pyc[2] === SB.SH_MAX, 'R / PK_MAX / SH_MAX — זהים בעובד (peaks.py) ובטלפון');

  /* ---------- 2. peaks.py על קובץ קול אמיתי ---------- */
  let np = true;
  try { execFileSync(VPY, ['-c', 'import numpy'], { stdio: 'ignore' }); } catch (e) { np = false; }
  if (np) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-'));
    // 3 שנ׳: שנייה שקט, שנייה טון חזק, שנייה טון חלש (16kHz מונו 16 ביט); 2 חילופי שוטים (אחד כפול) + אחד פגום
    execFileSync(VPY, ['-c', `
import wave, numpy as np, json, sys
sr = 16000
a = np.concatenate([np.zeros(sr), 0.9 * np.sin(np.arange(sr) * 0.2), 0.03 * np.sin(np.arange(sr) * 0.2)])
with wave.open(sys.argv[1] + '/audio16k.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((a * 32767).astype('<i2').tobytes())
json.dump({'shots': [{'t': 2.5, 'score': 30}, {'t': 1.25}, {'t': 1.25}, {'t': 'x'}]}, open(sys.argv[1] + '/shots.json', 'w'))`, d]);
    const out = execFileSync(VPY, [path.join(root, 'translator', 'peaks.py'), '--project', d, '--out', path.join(d, 'meta.json')], { encoding: 'utf8' });
    const mm = SB.normMeta(JSON.parse(fs.readFileSync(path.join(d, 'meta.json'), 'utf8')));
    const avg = (a, b) => Array.from(mm.pk.slice(a, b)).reduce((x, y) => x + y, 0) / (b - a);
    ok(/✓ גל הקול: 3 שנ׳, 2 חילופי שוטים/.test(out) && mm.pk.length === 60 && mm.sh.join() === '1.25,2.5', 'peaks.py: 20 נקודות לשנייה; חילופי השוטים ממוינים ובלי כפולים');
    ok(avg(0, 20) === 0 && avg(20, 40) > 240 && avg(40, 60) > 120 && avg(40, 60) < 200, 'peaks.py: שקט = 0, טון חזק ≈ 255, חלש באמצע (סולם dB)');
    fs.rmSync(d, { recursive: true, force: true });
    const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-'));
    ok(/בלי גל קול/.test(execFileSync(VPY, [path.join(root, 'translator', 'peaks.py'), '--project', d2, '--out', path.join(d2, 'm.json')], { encoding: 'utf8' })) && !fs.existsSync(path.join(d2, 'm.json')),
      'בלי audio16k.wav — בלי קובץ (העורך כמו קודם)');
  } else console.log('# (בלי numpy — דילגנו על peaks.py)');

  /* ---------- 3. הצמדה לחיתוכים ---------- */
  const cs = [{ i: 1, s: 0.9, e: 2.4, lines: ['א'] }, { i: 2, s: 2.6, e: 4.7, lines: ['ב'] }, { i: 3, s: 5.3, e: 7, lines: ['ג'] }, { i: 4, s: 7.05, e: 8, lines: ['ד'] }];
  const sh = [1.0, 5.0, 7.0];
  const sa = SB.snapAll(cs, sh);
  ok(JSON.stringify(sa.cues.map((c) => [c.s, c.e])) === '[[1,2.4],[2.6,4.917],[5,6.917],[7,8]]' && sa.n === 5,
    'snapAll: התחלה על החיתוך, סוף שני פריימים לפניו (גם כשזה מאריך); הצמדה של כתובית אחת מפנה מקום לבאה');
  ok(SB.snapEdge(cs, 3, 's', sh) === null, 'התחלה שהייתה נצמדת לסוף הכתובית הקודמת (פחות משני פריימים) — לא מצמידים');
  ok(SB.snapEdge(cs, 0, 's', [3]) === null && SB.snapEdge(cs, 0, 's', []) === null && SB.snapAll(cs, []).n === 0, 'חיתוך רחוק מחצי שנייה / בלי חיתוכים — כלום');
  ok(SB.snapEdge([{ i: 1, s: 1.0, e: 2, lines: ['א'] }], 0, 's', [1.01]) === null, 'כבר על החיתוך (פחות מ־20ms) — כלום');

  /* ---------- 4. דוברים ---------- */
  const col = SB.spkColors([{ spk: 'S1' }, { spk: 'S2' }, { spk: 'S1' }, { spk: '' }]);
  ok(col.size === 2 && col.get('S1') === SB.SPK_COLORS[0] && col.get('S2') === SB.SPK_COLORS[1], 'spkColors: צבע לפי סדר ההופעה');
  ok(SB.spkColors([{ spk: 'S1' }, { spk: 'S1' }]).size === 0, 'דובר אחד — בלי צבעים (אין מה להבדיל)');

  /* ---------- 5. החיבורים ---------- */
  ok(S.OUT_KINDS.includes('meta') && /'aiout', 'meta'\]/.test(read('studio.js')), 'meta = סוג תוצר מוכר בשרתון ובטלפון (קובץ עזר — לא ברשימת התוצרים)');
  const jp = read('translator/job.py');
  ok(/\('meta', 'timeline\.json', '\.timeline\.json', 'application\/json'\)/.test(jp) && /    meta_safe\(ctx\)\n    for k, fname, suffix, mime in AUX_FILES:/.test(jp) && /except Stop:\n        raise\n    except BaseException/.test(jp),
    'finish יוצר את timeline.json לפני קבצי העזר; תקלה בו לא מפילה את העבודה ("עצור" — כן)');
  ok(S.OUT_MAX >= 9, 'מקום לכל התוצרים (4 עיקריים + 5 קבצי עזר)');
  const sj = read('studio.js');
  ok(/mo \? net\.driveJson\(mo\.id\)\.catch\(\(\) => null\) : null\]/.test(sj) && /shots: me\.meta \? me\.meta\.sh : \[\]/.test(sj) && /se\.tl = createTimeline\(/.test(sj),
    'העורך: הקובץ נטען במקביל לכתוביות (בלעדיו — העורך כמו קודם); הציר מתחת לנגן');
  ok(/if \(se && se\.tl\) \{ se\.tl\.destroy\(\); se\.tl = null; \}/.test(sj), 'יציאה מהעורך עוצרת את הציר');
  const ss = read('studiosubs.js');
  ok(/'snap:' \+ shots\.length \+ ':' \+ sn\.n/.test(ss) && /'cue-snap:' \+ k/.test(ss), 'כרטיס הצעה אחד להצמדת הכל, וכפתור לכתובית הפתוחה');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
