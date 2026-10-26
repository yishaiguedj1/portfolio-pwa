// 26/10/2026: מילים לקריוקי מ־LRCLIB — השאילתה משם הקובץ, פענוח התשובה (טקסט מאתר חיצוני), הסדר לפי אורך השיר,
// והחיבור בטופס ובמדיניות האבטחה של הדפים. בלי רשת. הרצה: node tests/studio-lyrics.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const N = await import(path.join(root, 'studionet.js'));

  /* ---------- 1. השאילתה משם הקובץ ---------- */
  ok(N.lyrGuess('Queen_-_Bohemian_Rhapsody_(Official_Video_Remastered).mp4') === 'Queen - Bohemian Rhapsody', 'שם קובץ מיוטיוב — בלי סיומת, קווים תחתונים וסוגריים');
  ok(N.lyrGuess('Adele - Hello (Lyrics) [4K].webm') === 'Adele - Hello', 'סוגריים מרובעים ו־Lyrics');
  ok(N.lyrGuess('עומר אדם - תגידי | הקליפ הרשמי.mkv') === 'עומר אדם - תגידי', 'עברית: "הקליפ הרשמי" יורד (בלי \\b)');
  ok(N.lyrGuess('').length === 0 && N.lyrGuess('x'.repeat(500)).length === 120, 'ריק נשאר ריק, ארוך נחתך ל־120');

  /* ---------- 2. שורות מתוזמנות → טקסט ---------- */
  ok(N.lrcPlain('[00:01.20]a\n[00:02.00]\n[00:03.5][00:09.1]b') === 'a\n\nb', 'חותמות זמן יורדות, גם כמה בשורה אחת');

  /* ---------- 3. התשובה ---------- */
  const raw = [
    { trackName: 'Song', artistName: 'Far', duration: 400, plainLyrics: 'far version', syncedLyrics: null },
    { trackName: 'Song', artistName: 'Close', duration: 201, plainLyrics: '', syncedLyrics: '[00:01.00]close line' },
    { trackName: 'Inst', artistName: 'X', duration: 200, instrumental: true, plainLyrics: 'nope' },
    { trackName: 'Empty', artistName: 'X', duration: 200, plainLyrics: '   ', syncedLyrics: '' },
    { trackName: 'Dup', artistName: 'Y', duration: 199, plainLyrics: 'close line' },
    { trackName: 'Evil‮<b>', artistName: 'Z\u0000', duration: 1e9, plainLyrics: 'x'.repeat(20000) },
    null, 'str', 5,
  ];
  const r = N.lrcResults(raw, 200);
  ok(r[0].a === 'Close' && r[0].m && r[0].plain === 'close line' && r[0].s, 'הקרובה באורך ראשונה; מילים רגילות מהשורות המתוזמנות כשאין');
  ok(!r.some((x) => x.t === 'Inst' || x.t === 'Empty'), 'בלי קטעים בלי מילים ובלי כלי בלבד');
  ok(r.filter((x) => x.plain === 'close line').length === 1, 'מילים זהות — פעם אחת');
  const ev = r.find((x) => x.a === 'Z');
  ok(ev && !/[‮\u0000]/.test(ev.t + ev.a) && ev.d === 0 && ev.plain.length === 8000, 'טקסט מבחוץ: בלי תווי בקרה וכיווניות, אורך מוגבל, משך לא סביר = 0');
  ok(N.lrcResults({ error: 1 }, 0).length === 0 && N.lrcResults(null, 0).length === 0, 'תשובה לא צפויה = רשימה ריקה');
  ok(N.lrcResults(Array.from({ length: 30 }, (_, i) => ({ trackName: 't' + i, plainLyrics: 'l' + i })), 0).length === 8, 'עד 8 תוצאות');

  /* ---------- 4. החיפוש ---------- */
  let url = '';
  const net = N.createNet({ fetch: async (u) => { url = u; return { ok: true, status: 200, json: async () => raw }; }, base: () => '', idToken: async () => '' });
  const s = await net.lyricsSearch('Song Close', 200);
  ok(s.ok && s.list.length && url.startsWith(N.LRC_API + '?q=Song%20Close'), 'החיפוש פונה ל־LRCLIB עם השאילתה בלבד');
  ok((await net.lyricsSearch(' a ', 0)).error === 'short', 'שאילתה קצרה מדי — בלי פנייה');
  const bad = N.createNet({ fetch: async () => { throw new Error('x'); }, base: () => '', idToken: async () => '' });
  ok((await bad.lyricsSearch('abc', 0)).error === 'net', 'תקלת רשת = קוד, בלי זריקה');

  /* ---------- 5. הטופס והמדיניות ---------- */
  const st = read('studio.js');
  ok(/function kaFind\(f\)/.test(st) && /kaFind\(f\), ta,/.test(st), 'החיפוש בטופס הקריוקי, מעל שדה המילים');
  ok(/net\.lyricsSearch\(/.test(st) && !/lrclib/i.test(st.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'הטופס פונה רק דרך studionet (בלי כתובת בקוד של הסטודיו)');
  for (const p of ['index.html', 'academy.html', 'studio.html', 'admin.html']) ok(/connect-src[^;]*https:\/\/lrclib\.net/.test(read(p)), p + ': lrclib.net ב־connect-src');
  for (const k of ['studioKaFind', 'studioKaFindPh', 'studioKaFindNone', 'studioKaFindErr', 'studioKaFindLen', 'studioKaFindSrc', 'studioKaFindUsed'])
    ok((read('app.js').match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, k + ' בעברית ובאנגלית');

  console.log('\n# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
