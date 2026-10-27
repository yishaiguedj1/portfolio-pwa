// 28/10/2026: כתוביות רשמיות מהרשת — טביעת האצבע, הזיהוי מהשם, פענוח התשובות (טקסט מאתר חיצוני), zip, החיפוש עם
// מקור שנופל, מקור הקבצים בעבודה (normOrg), והחיבור בטופס ובמדיניות האבטחה. בלי רשת — mocks בלבד (שמות של סדרה ציבורית).
// הרצה: node tests/studio-netsubs.test.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/* zip קטן: stored או deflate, כמה קבצים */
function zip(files) {
  const loc = [], cen = [];
  let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'latin1');
    const raw = Buffer.from(f.data);
    const body = f.deflate ? zlib.deflateRawSync(raw) : raw;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(f.deflate ? 8 : 0, 8);
    lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(f.deflate ? 8 : 0, 10);
    ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    loc.push(lh, name, body); cen.push(ch, name);
    off += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(cen);
  const eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(files.length, 8); eo.writeUInt16LE(files.length, 10);
  eo.writeUInt32LE(cd.length, 12); eo.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...loc, cd, eo]));
}

(async () => {
  const N = await import(path.join(root, 'studionet.js'));

  /* ---------- 1. טביעת האצבע (האלגוריתם של OpenSubtitles) ---------- */
  const size = 200000;
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) buf[i] = (i * 7 + 3) & 255;
  const blob = { size, slice: (a, b) => ({ arrayBuffer: async () => { const s = buf.subarray(a, b); return s.buffer.slice(s.byteOffset, s.byteOffset + s.length); } }) };
  let ref = BigInt(size);
  for (const st of [0, size - 65536]) for (let i = 0; i < 65536; i += 8) ref = (ref + buf.readBigUInt64LE(st + i)) & ((1n << 64n) - 1n);
  ok(await N.osHash(blob) === ref.toString(16).padStart(16, '0'), 'osHash = הגודל + סכום מילים של 64 ביט בהתחלה ובסוף');
  ok(await N.osHash({ size: 1000, slice: () => ({ arrayBuffer: async () => new ArrayBuffer(1000) }) }) === '', 'קובץ קטן מ־64KB — בלי טביעה');

  /* ---------- 2. זיהוי מהשם ---------- */
  const g1 = N.nsGuess('How.I.Met.Your.Mother.S01E07.720p.BluRay.x264-SiNNERS.mkv');
  ok(g1.q === 'How I Met Your Mother' && g1.s === 1 && g1.e === 7, 'SxxEyy: שם הסדרה, עונה ופרק');
  const g2 = N.nsGuess('Lost 2x05 HDTV.avi');
  ok(g2.q === 'Lost' && g2.s === 2 && g2.e === 5, '1x02');
  const g3 = N.nsGuess('Inception (2010) 1080p BluRay.mp4');
  ok(g3.q === 'Inception' && g3.y === 2010 && !g3.s, 'סרט עם שנה');
  ok(N.nsGuess('').q === '' && N.nsGuess('x'.repeat(500)).q.length <= 100, 'ריק / ארוך');

  /* ---------- 3. הזיהוי לפי טביעה — רוב, ועדיפות לפרק שבשם ---------- */
  const hj = [
    { MovieKind: 'episode', SeriesIMDBParent: '460649', SeriesSeason: '1', SeriesEpisode: '8', MovieName: '"How I Met Your Mother" Return of the Shirt' },
    { MovieKind: 'episode', SeriesIMDBParent: '460649', SeriesSeason: '1', SeriesEpisode: '8', MovieName: '"How I Met Your Mother" Return of the Shirt' },
    { MovieKind: 'movie', IDMovieImdb: '86999', MovieName: 'Other' },
    { MovieKind: 'episode', SeriesIMDBParent: 'evil', SeriesSeason: '1', SeriesEpisode: '1' }, null, 'x'];
  const h1 = N.nsPickHash(hj, { s: 0 });
  ok(h1 && h1.id === 'tt0460649' && h1.type === 'series' && h1.s === 1 && h1.e === 8 && h1.by === 'h' && h1.t === 'How I Met Your Mother', 'הרוב מנצח; מזהה IMDb בשבע ספרות; שם הסדרה בלי שם הפרק');
  ok(N.nsPickHash(hj, { s: 9, e: 9 }).e === 8, 'פרק בשם שלא נמצא בטביעה — הטביעה גוברת');
  ok(N.nsPickHash([], {}) === null && N.nsPickHash({}, {}) === null, 'תשובה ריקה / לא מערך');
  const mj = { metas: [{ id: 'tt9999999', name: 'Inception Remake', releaseInfo: '2030' }, { imdb_id: 'tt1375666', name: 'Inception', releaseInfo: '2010' }, { id: 'bad' }] };
  const m1 = N.nsPickMeta(mj, g3);
  ok(m1.id === 'tt1375666' && m1.type === 'movie' && m1.by === 'n', 'Cinemeta: השנה מכריעה');
  ok(N.nsPickMeta(mj, g1).type === 'series' && N.nsPickMeta(mj, g1).e === 7, 'Cinemeta לסדרה — העונה והפרק מהשם');

  /* ---------- 4. פענוח התשובות (טקסט מאתר חיצוני) ---------- */
  const osj = { subtitles: [
    { id: '1', url: 'https://subs5.strem.io/en/download/file/1', lang: 'heb', m: 'h', movieReleaseName: 'HIMYM.S01E07.720p.BluRay.x264-SiNNERS', fpsMilli: 23976 },
    { id: '2', url: 'https://subs5.strem.io/en/download/file/2', lang: 'eng', m: 'i', movieReleaseName: 'How.I.Met.Your.Mother.S01E07.720p.BluRay.x264-SiNNERS' },
    { id: '3', url: 'https://evil.example.com/x.srt', lang: 'eng', m: 'h' },
    { id: '4', url: 'javascript:alert(1)', lang: 'eng' },
    { id: '5', url: 'https://subs5.strem.io/f/5', lang: 'eng', m: 'i', movieReleaseName: 'Other.DVDRip-XYZ‮<b>' },
    { id: '6', url: 'https://subs5.strem.io/f/6', lang: '<script>' }, null] };
  const os = N.nsParseOs(osj, 'How.I.Met.Your.Mother.S01E07.720p.BluRay.x264-SiNNERS.mkv');
  ok(os.length === 3 && os.every((x) => /^https:\/\/[a-z0-9-]+\.strem\.io\//.test(x.url)), 'רק כתובות של strem.io; שפה לא תקינה נזרקת');
  ok(os[0].lang === 'he' && os[0].m === 'h' && os[0].fps === 23.976 && os[0].src === 'os', 'קוד שלוש אותיות → שתיים; m:h = תואם בדיוק');
  ok(os[1].m === 'r' && os[2].m === 'n', 'אותה הוצאה (קבוצה) = r; אחרת n');
  ok(!/[‮]/.test(os[2].rel), 'תווי כיוון יורדים משם ההוצאה');
  const wz = N.nsParseWiz([{ id: 146, versioname: 'How.I.Met.Your.Mother.S01E07.720p.HDTV' }, { id: '1;rm', versioname: 'x' }, null], 'a.mkv');
  ok(wz.length === 1 && wz[0].url === N.NS_WIZ + 'files/sub/146' && wz[0].lang === 'he' && wz[0].zip === 1, 'Wizdom: מזהה מספרי בלבד, עברית, zip');
  const so = N.nsSort([...wz, ...os]);
  ok(so[0].m === 'h' && so[so.length - 1].m === 'n', 'סדר: מדויק → אותה הוצאה → השאר');

  /* ---------- 5. zip ---------- */
  const z = zip([{ name: 'HIMYM.S01E06.srt', data: '1\r\n00:00:01,000 --> 00:00:02,000\r\nsix\r\n' },
    { name: 'HIMYM.S01E07.srt', data: '1\r\n00:00:01,000 --> 00:00:02,000\r\nseven\r\n', deflate: true }, { name: 'readme.nfo', data: 'x' }]);
  ok(Buffer.from(await N.nsUnzip(z, { s: 1, e: 7 })).toString().includes('seven'), 'zip: הקובץ של הפרק (deflate)');
  ok(Buffer.from(await N.nsUnzip(z, null)).toString().includes('six'), 'zip בלי פרק — הכתובית הראשונה');
  const plain = new TextEncoder().encode('1\n00:00:01,000 --> 00:00:02,000\nhi\n');
  ok(await N.nsUnzip(plain, null) === plain, 'לא zip — כמו שהוא');
  let bad = false; try { await N.nsUnzip(new Uint8Array([0x50, 0x4b, ...new Array(40).fill(0)]), null); } catch (e) { bad = true; }
  ok(bad, 'zip פגום — שגיאה (subsGet מחזיר null)');

  /* ---------- 6. החיפוש: מקור שנופל לא עוצר; בלי טביעה → שם ---------- */
  const calls = [];
  const resp = (body, okk = true) => ({ ok: okk, status: okk ? 200 : 500, json: async () => body, arrayBuffer: async () => (body instanceof Uint8Array ? body.buffer : new ArrayBuffer(0)) });
  const net = N.createNet({ fetch: async (u) => {
    calls.push(u);
    if (u.startsWith(N.NS_OSH)) return resp(hj);
    if (u.startsWith(N.NS_OS3)) return resp(osj);
    if (u.startsWith(N.NS_WIZ + 'search')) throw new Error('down');
    return resp(null, false);
  } });
  const r = await net.subsFind(blob, 'How.I.Met.Your.Mother.S01E07.720p.BluRay.x264-SiNNERS.mkv');
  ok(r.ok && r.id.e === 8 && r.list.length === 3, 'טביעה → פרק 8 (התוכן, לא השם); Wizdom נפל — Stremio נשאר');
  ok(calls.some((u) => u.includes('/series/tt0460649:1:8/videoHash=')), 'Stremio עם הטביעה והגודל');
  ok(!calls.some((u) => /S01E07|How\.I\.Met/.test(u)), 'כשיש טביעה — שם הקובץ לא נשלח לאף שירות');
  calls.length = 0;
  const net2 = N.createNet({ fetch: async (u) => { calls.push(u); return u.startsWith(N.NS_META) ? resp(mj) : u.startsWith(N.NS_OSH) ? resp([]) : resp({ subtitles: [] }); } });
  const r2 = await net2.subsFind(blob, 'Inception (2010) 1080p BluRay.mp4');
  ok(!r2.ok || r2.list.length === 0, 'בלי כתוביות — רשימה ריקה');
  ok(calls.some((u) => u.startsWith(N.NS_META + 'movie/top/search=Inception')), 'בלי זיהוי בטביעה — Cinemeta לפי השם (רק שם הסרט)');
  ok(await net.subsGet({ url: 'https://evil.example.com/a.srt' }) === null, 'subsGet: רק מהכתובות שאושרו');

  /* ---------- 7. מקור הקבצים בעבודה ---------- */
  const st = read('studio.js');
  const i0 = st.indexOf('export function normOrg('), i1 = st.indexOf('\n}\n', i0);
  const NS_NAME = { os: 'OpenSubtitles', wz: 'Wizdom' };
  const ORG_V = ['ph', 'dr', 'bx', 'ln', 'dl', 'pa'], ORG_T = ['file', 'trk', 'net'];
  const normOrg = new Function('NS_NAME', 'ORG_V', 'ORG_T', st.slice(i0, i1 + 2).replace('export ', '') + '\nreturn normOrg;')(NS_NAME, ORG_V, ORG_T);
  const o = normOrg({ v: { k: 'ln', h: 'YouTube.com' }, s: { k: 'net', p: 'wz', l: 'he' }, r: { k: 'trk', l: 'en', p: 'os' }, g: { k: 'evil' }, x: 1 });
  ok(JSON.stringify(o) === JSON.stringify({ v: { k: 'ln', h: 'youtube.com' }, s: { k: 'net', l: 'he', p: 'wz' }, r: { k: 'trk', l: 'en' } }), 'normOrg: רק שדות מוכרים; p רק למהרשת');
  ok(normOrg({ v: { k: 'ln', h: 'a b<c>' } }).v.h === undefined && normOrg(null) === null && normOrg({}) === null && normOrg({ s: { k: 'net', p: '__proto__' } }).s.p === undefined, 'שם אתר לא תקין / ריק / __proto__');
  ok(/const org = normOrg\(j\.org\)/.test(st) && /\.\.\.\(org \? \{ org \} : \{\}\)/.test(st), 'normJob שומר את org');
  ok((st.match(/org: orgOf\(f, null, spec\.eng\)/g) || []).length === 2 && /org: normOrg\(\{ v: \{ k: 'ln'/.test(st) && /org: normOrg\(\{ v: \{ k: 'pa' \} \}\)/.test(st), 'org בכל מסלולי היצירה (קובץ/Drive, כתוביות, קישור, תרגום בטלפון)');
  ok(/p\.append\(\.\.\.orgRows\(rec\)\)/.test(st), 'מסך העבודה מציג את המקורות');

  /* ---------- 8. החיבור בטופס ---------- */
  ok(/nsFor\(f, file\);[^\n]*\n\s*if \(!\/\\\.\(mkv/.test(st), 'החיפוש מתחיל לכל סרטון — לפני בדיקת הסיומת של הרצועות');
  ok(/t\.net && t\.net\.m === 'h' && !to\.includes\(t\.lang\)/.test(st), 'לתרגום מכתוביות — רק "מדויק" שלא בשפת התרגום');
  ok(/t\.net && t\.lang === 'en' && t\.net\.m !== 'n'/.test(st), 'עזר אוטומטי מהרשת — רק מדויק / אותה הוצאה');
  ok(!/opensubtitles\.org|strem\.io|wizdom\.xyz|cinemeta/i.test(strip(st)), 'הטופס פונה רק דרך studionet (בלי כתובות בקוד של הסטודיו)');
  ok(!/localStorage/.test(st.slice(st.indexOf('const nsCache'), st.indexOf('function pageTracks('))), 'המטמון בזיכרון בלבד');

  /* ---------- 9. מדיניות האבטחה בכל הדפים ---------- */
  for (const p of ['index.html', 'academy.html', 'studio.html', 'admin.html']) {
    const h = read(p);
    ok(['https://rest.opensubtitles.org', 'https://\\*\\.strem\\.io', 'https://wizdom\\.xyz'].every((x) => new RegExp('connect-src[^;]*' + x).test(h)), p + ': המקורות ב־connect-src');
  }
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
