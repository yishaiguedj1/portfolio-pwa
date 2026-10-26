// 26/10/2026: רצועות הכתוביות שבתוך סרטון שנבחר ב־Drive — אותו studiotracks.js, דרך net.rangeBlob (קריאות Range).
// הרשימה קוראת רק את תחילת הקובץ (MKV) / ה־moov (MP4); החילוץ נותן בדיוק מה שנותן קובץ מהטלפון
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const T = await import('../studiotracks.js');
  const { createNet } = await import('../studionet.js');
  const src = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
  ok(/f\._rb = net\.rangeBlob\(\(force\) => gb\(\)\.token\(force\), x\.id, x\.size, x\.name\); tracksFor\(f, f\._rb\);/.test(src), 'בחירה מהרשימה של Drive — מחפשים רצועות כתוביות כמו בקובץ מהטלפון');
  ok(/f\._rb === file && f\.drive && f\.drive\.id === file\.id/.test(src), 'תשובה מאוחרת של Drive לא דורסת קובץ אחר שנבחר בינתיים');
  let ff = false;
  try { execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=d=0.1', '-f', 'null', '-'], { stdio: 'ignore' }); ff = true; } catch (e) {}
  if (!ff) { console.log('# בלי ffmpeg — רק בדיקות הקוד'); }
  else {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trkdrv-'));
    const s1 = path.join(d, 'en.srt'), s2 = path.join(d, 'he.srt');
    fs.writeFileSync(s1, '1\n00:00:01,000 --> 00:00:02,500\nHello there\n\n2\n00:00:04,000 --> 00:00:05,000\nSecond line\n');
    fs.writeFileSync(s2, '1\n00:00:01,000 --> 00:00:02,500\nשלום\n');
    const files = {};
    for (const [ext, codec] of [['mkv', 'srt'], ['mp4', 'mov_text']]) {
      const out = path.join(d, 'v.' + ext);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=10:d=6', '-i', s1, '-i', s2, '-map', '0', '-map', '1', '-map', '2',
        '-c:v', 'mpeg4', '-c:s', codec, '-metadata:s:s:0', 'language=eng', '-metadata:s:s:1', 'language=heb'].concat(ext === 'mp4' ? ['-movflags', '+faststart'] : []).concat([out]));
      files[ext] = fs.readFileSync(out);
    }
    for (const ext of ['mkv', 'mp4']) {
      const buf = files[ext], ranges = [];
      const fetch = async (u, o) => {
        const m = /bytes=(\d+)-(\d+)/.exec((o.headers || {}).Range || '');
        ranges.push(m ? +m[2] - +m[1] + 1 : buf.length);
        if (!/\/files\/VIDdrive12345\?alt=media/.test(u) || (o.headers || {}).Authorization !== 'Bearer BAT') return { ok: false, status: 403, json: async () => ({}) };
        const a = +m[1], b = Math.min(buf.length - 1, +m[2]);
        const part = buf.subarray(a, b + 1);
        return { ok: true, status: 206, arrayBuffer: async () => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) };
      };
      const net = createNet({ fetch, base: () => '' });
      const rb = net.rangeBlob(async () => 'BAT', 'VIDdrive12345', buf.length, 'v.' + ext);
      const L = await T.listTracks(rb);
      const local = await T.listTracks(new Blob([buf]));
      ok(L && L.tracks.length === local.tracks.length && L.tracks.filter((t) => t.kind === 'text').length === 2, ext + ': רשימת הרצועות מ־Drive = כמו מהטלפון');
      ok(L && L.tracks.some((t) => t.lang === 'he') && L.tracks.some((t) => t.lang === 'en'), ext + ': שפות הרצועות');
      const ids = L.tracks.filter((t) => t.kind === 'text').map((t) => t.id);
      const X = await T.extractTracks(rb, ids), Y = await T.extractTracks(new Blob([buf]), ids);
      const tx = (R) => R.tracks.filter((t) => ids.includes(t.id)).map((t) => typeof t.text === 'string' ? t.text : t.text ? new TextDecoder().decode(t.text) : '').join('|');
      ok(tx(X) && tx(X) === tx(Y) && /Hello there/.test(tx(X)) && /שלום/.test(tx(X)), ext + ': החילוץ מ־Drive = החילוץ מהטלפון');
      ok(ranges.every((n) => n <= 4 * 1024 * 1024), ext + ': כל קריאה עד 4MB');
    }
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(`studio-tracks-drive: ${pass} עברו, ${fail} נכשלו`);
  process.exit(fail ? 1 : 0);
})();
