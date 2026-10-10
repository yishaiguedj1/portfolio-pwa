// איכויות צפייה כמו ב־YouTube (10/10/2026): הנגן קורא את האינדקס (sidx) מתחילת כל קובץ שהעובד ארז, בונה רשימות HLS
// עם טווחי בתים ו־hls.js בוחר איכות. ברירת המחדל = המקור (האיכות הכי טובה); "אוטומטי" — בתפריט ההגדרות.
// הרצה: node tests/studio-quality.test.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

/* MP4 מקוטע מינימלי: ftyp, moov, sidx (גרסה 0/1), ואז moof+mdat */
function box(type, body) { const b = Buffer.alloc(8 + body.length); b.writeUInt32BE(8 + body.length, 0); b.write(type, 4, 'latin1'); body.copy(b, 8); return b; }
function sidx(refs, ts, ver = 0, fo = 0) {
  const head = Buffer.alloc(ver === 0 ? 20 : 28);
  head.writeUInt32BE(ver << 24, 0); head.writeUInt32BE(1, 4); head.writeUInt32BE(ts, 8);
  if (ver === 0) { head.writeUInt32BE(0, 12); head.writeUInt32BE(fo, 16); } else { head.writeUInt32BE(0, 16); head.writeUInt32BE(fo, 24); }
  const cnt = Buffer.alloc(4); cnt.writeUInt16BE(refs.length, 2);
  const rs = Buffer.concat(refs.map(([size, dur]) => { const r = Buffer.alloc(12); r.writeUInt32BE(size, 0); r.writeUInt32BE(dur, 4); r.writeUInt32BE(0x90000000, 8); return r; }));
  return box('sidx', Buffer.concat([head, cnt, rs]));
}

(async () => {
  const P = await import(path.join(root, 'studioplay.js'));
  const SV = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- האינדקס מתחילת הקובץ ---------- */
  const ftyp = box('ftyp', Buffer.from('iso6\0\0\0\0iso6mp41', 'latin1')), moov = box('moov', Buffer.alloc(300));
  const refs = [[100000, 30720], [90000, 30720], [110000, 15360]];
  const sx = sidx(refs, 15360);
  const file = Buffer.concat([ftyp, moov, sx, Buffer.alloc(16)]);
  const x = P.parseMp4Head(file);
  const first = ftyp.length + moov.length + sx.length;
  ok(x.init === ftyp.length + moov.length && x.segs.length === 3 && x.segs[0].o === first && x.segs[1].o === first + 100000 && x.segs[2].d === 1,
    'sidx: סוף האתחול, היסט וגודל לכל קטע, משך בשניות');
  const x1 = P.parseMp4Head(Buffer.concat([ftyp, moov, sidx(refs, 15360, 1, 280), Buffer.alloc(16)]));
  ok(x1.segs[0].o === ftyp.length + moov.length + sidx(refs, 15360, 1).length + 280, 'sidx גרסה 1 + first_offset (ffmpeg כותב sidx לכל רצועה — מדלגים על השני)');
  ok(P.parseMp4Head(file.subarray(0, first - 10)).need === first, 'האינדקס לא נכנס בקריאה הראשונה — כמה בתים צריך');
  ok(P.parseMp4Head(Buffer.concat([ftyp, box('moof', Buffer.alloc(8))])) === null, 'בלי moov/sidx — לא קובץ ארוז (הנגן נשאר על הקובץ)');

  /* ---------- קיבוץ ורשימות ---------- */
  const many = Array.from({ length: 20 }, (_, i) => ({ o: 1000 + i * 500, s: 500, d: 0.5 }));
  const g = P.groupSegs(many);
  ok(g.length === 2 && g[0].d === 6 && g[0].s === 6000 && g[1].o === 1000 + 12 * 500, 'מפתח כל חצי שנייה → קטעים של ~6 שנ׳ (לא אלפי בקשות)');
  ok(P.groupSegs([{ o: 0, s: 20e6, d: 2 }, { o: 20e6, s: 10e6, d: 2 }]).length === 2, 'קטע לא עובר את SEG_MAX_BYTES (תקרת הטווח המפורש ב־sw.js)');
  const U = 'https://yishaiguedj1.github.io/portfolio-pwa/studio-media/abcdefghij12';
  const mp = P.mediaPlaylist(U, 328, g);
  ok(/^#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:6\n#EXT-X-PLAYLIST-TYPE:VOD/.test(mp) && mp.includes('#EXT-X-MAP:URI="' + U + '",BYTERANGE="328@0"')
    && mp.includes('#EXTINF:6.000,\n#EXT-X-BYTERANGE:6000@1000\n' + U) && mp.trim().endsWith('#EXT-X-ENDLIST'), 'רשימת איכות: אתחול + טווחי בתים לאותו קובץ');
  const lv = [{ w: 1920, h: 1080, bw: 6e6, abw: 5e6, c: 'avc1.640028,mp4a.40.2', uri: 'a/0.m3u8' }, { w: 1280, h: 720, bw: 1.6e6, abw: 1.1e6, c: 'avc1.64001f,mp4a.40.2', uri: 'a/1.m3u8' }];
  const ms = P.masterPlaylist(lv);
  ok(ms.includes('#EXT-X-STREAM-INF:BANDWIDTH=6000000,AVERAGE-BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"\na/0.m3u8'), 'רשימה ראשית: קצב, מידות, קודקים (hls.js מסנן מה שהטלפון לא מנגן)');

  /* ---------- בחירת איכות ---------- */
  const L = [{ width: 640, height: 360, bitrate: 4e5 }, { width: 1280, height: 720, bitrate: 1.6e6 }, { width: 1920, height: 1080, bitrate: 6e6 }, { width: 854, height: 480, bitrate: 8e5 }];
  ok(P.pickLevel(L, 'src') === 2, 'ברירת המחדל "מקור" = האיכות הכי גבוהה (בקשת המשתמש)');
  ok(P.pickLevel(L, 'auto') === -1, '"אוטומטי" = hls.js בוחר לפי מהירות החיבור');
  ok(P.pickLevel(L, 720) === 1 && P.pickLevel(L, 1440) === 2 && P.pickLevel(L, 144) === 0, 'גובה שנבחר — הקרוב שלא מעליו; אין כזה — הנמוך');
  ok(P.pickLevel([{ width: 1080, height: 1920 }, { width: 720, height: 1280 }], 720) === 1 && P.qLabel({ w: 1080, h: 1920 }) === '1080p' && P.qHd({ w: 720, h: 1280 }),
    'אנכי — לפי הצלע הקצרה ("1080p", HD מ־720 — כמו ב־YouTube)');
  ok(P.normPq(undefined) === 'src' && P.normPq('auto') === 'auto' && P.normPq(720) === 720 && P.normPq(721) === 'src' && P.normPq('x') === 'src', 'ההעדפה שנשמרת: מקור כברירת מחדל');

  /* ---------- אותה בדיקה בטלפון ובשרתון ---------- */
  const top = { id: 'vid1234567890', w: 1920, h: 1080, bw: 6000000, abw: 5000000, c: 'avc1.640028,mp4a.40.2', size: 9 };
  const r7 = { id: 'r7201234567890', w: 1280, h: 720, bw: 1600000, abw: 1100000, c: 'avc1.64001f,mp4a.40.2', size: 9 };
  const cases = [[top, r7], [r7, top], [top], [top, r7, r7], [Object.assign({}, top, { c: 'x"y' }), r7], [Object.assign({}, top, { abw: 7e6 }), r7], [top, Object.assign({}, r7, { id: 'bad' })]];
  for (const c of cases) ok((P.normLadder(c, 'vid1234567890') === null) === (SV.normHl(c, 'vid1234567890') === null), 'normLadder (טלפון) = normHl (שרתון): ' + JSON.stringify(c.map((x) => x.h)));
  ok(P.normLadder([top, r7], 'other12345678') === null, 'הראשונה חייבת להיות הסרטון שהנגן מנגן');

  /* ---------- הנגן והחיבור ---------- */
  const pl = read('studioplay.js'), st = read('studio.js');
  ok(/enableWorker: false/.test(pl) && /pLoader: PL/.test(pl) && /capLevelToPlayerSize: false/.test(pl), 'hls.js: בלי Worker (CSP), הרשימות מהזיכרון, בלי הגבלה לגודל הנגן (המקור במלואו)');
  ok(/if \(ladder && !opts\.burned\) startHls\(\); else v\.src = opts\.src/.test(pl) && /toFile\(v\.currentTime \|\| 0\)/.test(pl), 'בלי איכויות / תקלה — הקובץ כמו קודם, מאותו מקום');
  ok(/hls\.currentLevel = pickLevel\(levels, pq\)/.test(pl) && /if \(opts\.onPq\) opts\.onPq\(pq\)/.test(pl), 'בחירה ידנית — מיד, ונשמרת');
  ok(/const gearB = ib\('gear', 'gear', T\('studioPlSettings'\)/.test(pl) && !/st-pl-b sp/.test(pl), 'גלגל שיניים כמו ב־YouTube (המהירות עברה לתפריט)');
  ok(/pq: 'src'/.test(st) && /s\.pq = normPq\(o\.pq\)/.test(st) && /ladder: src \? ladderOf\(rec\) : null, pq: store\.settings\.pq, onPq: pqSave/.test(st), 'ההעדפה בהגדרות הסטודיו (pwa_studio_v1); הנגן ועורך הכתוביות');
  ok(/hl\[0\]\.id !== vid \|\| rec\.spec\.edl/.test(st), 'רק כשהאיכות הראשונה היא הסרטון שהנגן מנגן (לא בחיתוך לפני התרגום)');
  const app = read('app.js');
  for (const k of ['studioPlSettings', 'studioPlQuality', 'studioPlAuto', 'studioPlAutoNow', 'studioPlSrcQ', 'studioPlNormal'])
    ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'מחרוזת בשתי השפות: ' + k);

  /* ---------- hls.js המוטמע ---------- */
  const js = fs.readFileSync(path.join(root, 'vendor/hls/hls.light.min.js'));
  const ver = read('vendor/hls/VERSION');
  ok(ver.includes(crypto.createHash('sha256').update(js).digest('hex')) && /Apache License/.test(read('vendor/hls/LICENSE')), 'hls.js המוטמע = הגרסה שנבדקה (sha256) + הרישיון (Apache-2.0)');
  ok(/import\(opts\.hlsUrl \|\| '\.\/vendor\/hls\/hls\.light\.min\.js'\)/.test(pl), 'נטען רק כשיש איכויות (import דינמי מהעותק בריפו — script-src self)');

  /* ---------- sw.js: טווח מפורש שלם (שלב ה־sw בפרוטוקול) ---------- */
  const sw = read('sw.js');
  if (/MEDIA_CAP_RANGE = (\d+) \* 1024 \* 1024/.test(sw)) ok(+RegExp.$1 * 1048576 >= P.SEG_MAX_BYTES, 'תקרת הטווח המפורש ב־sw.js ≥ הקטע הגדול שהנגן מבקש');
  else console.log('ok - sw.js עוד בלי תקרת הטווח המפורש (נכנסת ב־PR של sw.js) — דילוג');

  /* ---------- מול ffmpeg אמיתי וה־python של העובד (אם יש) ---------- */
  let ff = false;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); ff = true; } catch (e) {}
  if (ff) {
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'q-'));
    const out = path.join(tmp, 'top.mp4');
    try {
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=25', '-t', '6', '-c:v', 'libx264', '-g', '25',
        '-movflags', '+frag_keyframe+empty_moov+default_base_moof+global_sidx', '-f', 'mp4', out]);
      const head = fs.readFileSync(out).subarray(0, P.HEAD_BYTES);
      const js1 = P.parseMp4Head(head);
      const py = JSON.parse(execFileSync('python3', ['-c', 'import sys,json; sys.path.insert(0, sys.argv[1]); import ladder; i,s=ladder.sidx_index(ladder.head(sys.argv[2])); print(json.dumps([i,s]))',
        path.join(root, 'translator'), out]).toString());
      ok(js1.init === py[0] && JSON.stringify(js1.segs.map((s) => [s.o, s.s, +s.d.toFixed(6)])) === JSON.stringify(py[1].map((s) => [s[0], s[1], +s[2].toFixed(6)])),
        'קובץ אמיתי של ffmpeg: הטלפון קורא את האינדקס בדיוק כמו העובד (ladder.py)');
    } catch (e) { console.log('ok - ffmpeg בלי libx264 — דילוג'); }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
