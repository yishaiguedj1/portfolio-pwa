// שלב 4 (22/10/2026): רצועות כתוביות בתוך הסרטון — studiotracks.js מול קבצים שנוצרו ב־ffmpeg (tests/fixtures/tracks.json)
// ומול MKV שנבנה כאן ביד: דחיסת zlib, הסרת כותרת, אשכול בלי גודל, SimpleBlock בלי משך, הצפנה ורצועת תמונה.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const T = await import(path.join(__dirname, '..', 'studiotracks.js'));
  const S = await import(path.join(__dirname, '..', 'studiosubs.js'));
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'tracks.json'), 'utf8'));
  const buf = (n) => Buffer.from(FX[n], 'base64');
  const blob = (n) => new Blob([buf(n)]);
  const cues = (x) => S.importSubs(typeof x === 'string' ? new TextEncoder().encode(x) : x, { sdh: false }).cues;
  const same = (a, b, tol = 10) => a.length === b.length && a.every((c, i) => Math.abs(c.s - b[i].s) <= tol && Math.abs(c.e - b[i].e) <= tol && c.lines.join('|') === b[i].lines.join('|'));

  // 1. MKV מ־ffmpeg — רגיל ו"חי" (אשכולות בלי גודל): שלוש רצועות, פרטים, וחילוץ זהה לקבצים שנכנסו
  for (const f of ['s.mkv', 'sl.mkv']) {
    const L = await T.listTracks(blob(f));
    ok(L && L.kind === 'mkv' && L.tracks.length === 3, f + ': שלוש רצועות כתוביות');
    const [a, b, c] = L.tracks;
    ok(a.fmt === 'srt' && a.lang === 'en' && b.fmt === 'ass' && b.lang === 'he' && b.name === 'Hebrew Full' && b.forced && c.fmt === 'vtt' && c.sdh, f + ': פורמט, שפה, שם, מאולצת, SDH');
    ok(!('text' in a), f + ': הרשימה בלי חילוץ');
    const X = await T.extractTracks(blob(f), L.tracks.map((t) => t.id));
    ok(same(cues(X.tracks[0].text), cues(buf('sen.srt'))), f + ': SRT זהה למקור');
    ok(same(cues(X.tracks[1].text), cues(buf('she.ass'))), f + ': ASS זהה למקור (אחרי המפענח)');
    ok(same(cues(X.tracks[2].text), cues(buf('sen.vtt'))), f + ': WebVTT זהה למקור');
    ok(X.tracks[0].n === 40 && /\[V4\+? Styles\]/i.test(X.tracks[1].text), f + ': ספירה, וסגנונות ה־ASS נשמרו');
  }
  // 2. MP4 (tx3g)
  { const L = await T.listTracks(blob('s.mp4'));
    ok(L.kind === 'mp4' && L.tracks.length === 2 && L.tracks[0].lang === 'en' && L.tracks[1].lang === 'he' && L.tracks[1].name === 'Hebrew Full', 'MP4: שתי רצועות tx3g עם שפה ושם');
    const X = await T.extractTracks(blob('s.mp4'), L.tracks.map((t) => t.id));
    ok(same(cues(X.tracks[0].text), cues(buf('sm0.srt'))) && same(cues(X.tracks[1].text), cues(buf('sm1.srt'))), 'MP4: החילוץ זהה לחילוץ של ffmpeg'); }
  // 3. לא סרטון — null
  ok(await T.listTracks(new Blob([new Uint8Array(64)])) === null, 'קובץ שאינו MKV/MP4 — null');

  // 4. MKV ביד
  const vlen = (n) => { for (let l = 1; l <= 8; l++) if (n < 2 ** (7 * l) - 1) { const b = []; let v = n; for (let i = 0; i < l; i++) { b.unshift(v & 255); v = Math.floor(v / 256); } b[0] |= 1 << (8 - l); return b; } };
  const idb = (id) => { const b = []; while (id) { b.unshift(id & 255); id = Math.floor(id / 256); } return b; };
  const el = (id, ...parts) => { const body = Buffer.concat(parts.map((p) => Buffer.isBuffer(p) ? p : Buffer.from(p))); return Buffer.concat([Buffer.from(idb(id)), Buffer.from(vlen(body.length)), body]); };
  const unk = (id, ...parts) => Buffer.concat([Buffer.from(idb(id)), Buffer.from([0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]), ...parts]);
  const u = (n, w = 1) => { const b = []; for (let i = 0; i < w; i++) { b.unshift(n & 255); n = Math.floor(n / 256); } return Buffer.from(b); };
  const str = (s) => Buffer.from(s, 'utf8');
  const block = (tn, rel, data) => Buffer.concat([Buffer.from(vlen(tn)), u(rel & 0xFFFF, 2), Buffer.from([0x80]), data]);
  const track = (num, codec, extra = []) => el(0xAE, el(0xD7, u(num)), el(0x83, u(0x11)), el(0x86, str(codec)), el(0x22B59C, str('eng')), ...extra);
  const zEnc = el(0x6D80, el(0x6240, el(0x5034, el(0x4254, u(0)))));
  const hsEnc = el(0x6D80, el(0x6240, el(0x5034, el(0x4254, u(3)), el(0x4255, str('Hel')))));
  const crypt = el(0x6D80, el(0x6240, el(0x5033, u(1)), el(0x5035, el(0x47E1, u(5)))));
  const mkv = Buffer.concat([
    el(0x1A45DFA3, el(0x4282, str('matroska'))),
    unk(0x18538067,
      el(0x1549A966, el(0x2AD7B1, u(1000000, 3))),
      el(0x1654AE6B, track(1, 'S_TEXT/UTF8', [zEnc]), track(2, 'S_TEXT/UTF8', [hsEnc]), track(3, 'S_TEXT/UTF8'), track(4, 'S_TEXT/UTF8', [crypt]), track(5, 'S_HDMV/PGS')),
      unk(0x1F43B675, el(0xE7, u(1000, 2)),
        el(0xA0, el(0xA1, block(1, 0, zlib.deflateSync(str('zlib line')))), el(0x9B, u(1500, 2))),
        el(0xA0, el(0xA1, block(2, 500, str('lo there'))), el(0x9B, u(800, 2))),
        el(0xA3, block(3, 0, str('no duration A'))),
        el(0xA3, block(3, 2000, str('no duration B')))),
      unk(0x1F43B675, el(0xE7, u(20000, 2)), el(0xA3, block(3, 0, str('later')))),
      el(0x1C53BB6B, str('cues'))),
  ]);
  const L = await T.listTracks(new Blob([mkv]));
  ok(L.tracks.map((t) => t.kind).join() === 'text,text,text,other,image', 'ביד: מוצפנת = לא נתמכת, PGS = תמונה');
  const X = await T.extractTracks(new Blob([mkv]), [1, 2, 3, 4, 5]);
  const c1 = cues(X.tracks[0].text), c2 = cues(X.tracks[1].text), c3 = cues(X.tracks[2].text);
  ok(c1.length === 1 && c1[0].lines[0] === 'zlib line' && c1[0].s === 1000 && c1[0].e === 2500, 'דחיסת zlib + BlockDuration');
  ok(c2.length === 1 && c2[0].lines[0] === 'Hello there' && c2[0].s === 1500, 'הסרת כותרת (header stripping)');
  ok(c3.length === 3 && c3[0].e === 3000 && c3[1].e === 9000 && c3[2].s === 20000 && c3[2].e === 23000, 'SimpleBlock בלי משך: עד הבאה (עד 6 שנ׳), האחרונה 3 שנ׳; אשכולות בלי גודל');
  ok(!X.tracks[3].text && !X.tracks[4].text, 'מוצפנת ותמונה — בלי טקסט');
  ok(T.lang2('heb') === 'he' && T.lang2('eng') === 'en' && T.lang2('und') === '' && T.lang2('pt-BR') === 'pt', 'lang2');

  // 5. בתוך האפליקציה: המעטפת של הסטודיו, ובלי רשת
  const src = fs.readFileSync(path.join(__dirname, '..', 'studiotracks.js'), 'utf8');
  ok(!/fetch\(|XMLHttpRequest|import\(/.test(src.replace(/new Response\(/g, '')), 'studiotracks.js בלי רשת ובלי ייבוא');
  ok(/'\.\/studiotracks\.js'/.test(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8')), 'studiotracks.js ב־STUDIO_SHELL');
  console.log(`studio-tracks: ${pass} עברו, ${fail} נכשלו`);
  process.exit(fail ? 1 : 0);
})();
