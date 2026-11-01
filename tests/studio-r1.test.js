// סבב 1 (11/10/2026): פרקים בנגן (מ"רעיונות"), שיתוף / הורדה של התוצרים מהטלפון, ואחוז מהתקציב החודשי בקבלה.
// הרצה: node tests/studio-r1.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  global.document = { documentElement: { lang: 'he' } };
  global.t = (k, v) => (v ? k + ':' + JSON.stringify(v) : k);
  const P = await import(path.join(root, 'studioplay.js'));
  const A = await import(path.join(root, 'studioai.js'));
  const st = await import(path.join(root, 'studio.js'));

  /* ---------- 1. פרקים: נרמול וחיפוש ---------- */
  const ch = P.normChapters([{ t: 90, title: 'שני' }, { t: 0, title: '  פתיחה  ' }, { t: 90.4, title: 'כפול' }, { t: -1, title: 'שלילי' },
    { t: 30, title: '' }, { t: 'x', title: 'פגום' }, null, { t: 200, title: 'א<b>ב\u0007' }, { t: 5000, title: 'אחרי הסוף' }], 600);
  ok(ch.map((c) => c.t).join() === '0,90,200', 'normChapters: ממוין, בלי זמן כפול (שנייה), בלי שלילי/ריק/פגום/אחרי הסוף');
  ok(ch[0].title === 'פתיחה' && ch[2].title === 'א b ב', 'normChapters: טקסט נקי — בלי תגיות ותווי בקרה');
  ok(P.normChapters(Array.from({ length: 50 }, (_, i) => ({ t: i * 10, title: 'פ' + i }))).length === P.CHAP_MAX, 'עד ' + P.CHAP_MAX + ' פרקים');
  ok(P.normChapters('x').length === 0 && P.normChapters(null).length === 0, 'קלט שאינו רשימה — ריק');
  ok(P.chapterAt(ch, 0) === 0 && P.chapterAt(ch, 89.9) === 0 && P.chapterAt(ch, 90) === 1 && P.chapterAt(ch, 999) === 2 && P.chapterAt([], 5) === -1
    && P.chapterAt([{ t: 10, title: 'x' }], 3) === -1, 'chapterAt: [התחלה, הפרק הבא)');
  const fromAi = P.normChapters(A.parseChapters('0:00 פתיחה\n02:15 - הרעיון\n1:02:03 סיכום\nשורה בלי זמן'));
  ok(fromAi.length === 3 && fromAi[1].t === 135 && fromAi[2].t === 3723, 'מהתשובה של "רעיונות" (parseChapters) לנגן');

  /* ---------- 2. העבודה שומרת את הפרקים ---------- */
  const J = 'j' + 'B'.repeat(20);
  const r1 = st.normJob({ id: J, spec: { name: 'a.mp4', dur: 600 }, chap: [{ t: 0, title: 'פתיחה' }, { t: 60, title: '<script>' }] });
  ok(r1.chap && r1.chap.length === 2 && r1.chap[1].title === 'script', 'normJob: הפרקים נשמרים עם העבודה, טקסט נקי');
  ok(!('chap' in st.normJob({ id: J, spec: {} })), 'normJob: בלי פרקים — בלי שדה');
  const s1 = st.normStore({ jobs: [{ id: J, spec: { dur: 60 }, chap: [{ t: 0, title: 'x' }] }] });
  ok(s1.jobs[0].chap.length === 1, 'normStore: שורד שמירה וטעינה');

  /* ---------- 3. הנגן ---------- */
  const src = read('studioplay.js'), sj = read('studio.js'), css = read('studio.css');
  ok(/chapters: rec\.chap \|\| \[\]/.test(sj), 'playLoad מעביר את הפרקים לנגן');
  ok(/setChapters\(c\) \{ chs = normChapters\(c\)/.test(src) && /chapters: \(\) => chs\.slice\(\)/.test(src), 'setChapters / chapters בנגן');
  ok(/mRow\('chap', T\('studioPlChaps'\)/.test(src) && /page === 'c'/.test(src), 'גלגל השיניים: שורת "פרקים" ← רשימה (נגיעה קופצת)');
  ok(/tbox\.append\(cur, tsep, tot, chapB\)/.test(src) && /time\.append\(tbox, fsB\)/.test(src) && /openMenu\('c'\)/.test(src), 'שם הפרק אחרי הזמן "0:02 / 18:32" (לפי ת־נגן, 1/11/2026) — נגיעה פותחת את הרשימה; מסך מלא בסוף השורה');
  ok(/c\.t > 0\.5 && c\.t < d - 0\.5/.test(src) && /\.st-pl-chs i/.test(css), 'מפרידים על הפס (לא בתחילת הפרק הראשון ולא בסוף)');
  ok(/chapL\.dir = 'auto'/.test(src) && /t\.dir = 'auto'/.test(src), 'שם פרק בעברית בתוך נגן LTR — dir=auto');
  ok(/rec\.chap = chs; save\(\)/.test(sj) && /'id-chap'/.test(sj) && /'id-chapdel'/.test(sj), '"רעיונות": להוסיף לנגן / להסיר (באישור)');

  /* ---------- 4. שיתוף / הורדה ---------- */
  const rec = { id: J, spec: { name: 'TED_talk: part/1.mp4', to: ['he'] } };
  ok(st.outFileName(rec, 'srt') === 'TED talk part 1.he.srt' && st.outFileName(rec, 'en') === 'TED talk part 1.en.srt', 'outFileName: שם הסרטון + שפה, בלי תווים אסורים');
  ok(st.outFileName({ spec: {} }, 'srt') === 'video.he.srt', 'outFileName: בלי שם — video');
  ok(/list\(\.\.\.outs\.map\(\(o\) => rowOut\(rec, o\)\)/.test(sj), 'מקטע התוצרים — שורה עם כפתור שיתוף/הורדה לכל קובץ');
  ok(/navigator\.canShare && navigator\.canShare\(\{ files: \[f\] \}\)/.test(sj) && /x\.download = name/.test(sj), 'כתוביות: שיתוף כקובץ, ואם אין — הורדה');
  ok(/uc\?export=download&id=' \+ encodeURIComponent\(o\.id\)/.test(sj), 'סרטון: הורדה מ־Drive (לא דרך הזיכרון של הדף)');
  ok(!/<a[^>]*><button/.test(sj) && /h\('div', 'st-row st-ric st-outr'\)/.test(sj), 'כפתור לא בתוך קישור (HTML תקין)');

  /* ---------- 5. אחוז מהתקציב בקבלה ---------- */
  const t0 = Date.UTC(2026, 9, 10, 6, 33);
  const use = [{ k: 'main', m: 'claude-sonnet-5-5', n: 5, i: 1000, o: 2000, cr: 0, c5: 0, c1: 0, usd: 1.5 }, { k: 'tl', m: 'claude-sonnet-5-5', n: 2, i: 100, o: 100, usd: 1 }];
  const apiRec = { id: J, created: t0, spec: { name: 'a.mp4', dur: 300, mode: 'sonnet-medium' }, srv: { state: 'done', ended: t0 + 6e5, eng: 'api', use } };
  const q = st.quotaPct(apiRec, { cap: 50, month: 10 });
  ok(q && q.pct === 5 && q.cap === 50, 'quotaPct: עלות העבודה מתוך התקרה החודשית (2.5 מתוך 50 = 5%)');
  ok(st.quotaPct(apiRec, { cap: 1000 }).pct === 0.3, 'פחות מאחוז — ספרה אחרי הנקודה');
  ok(st.quotaPct(Object.assign({}, apiRec, { srv: Object.assign({}, apiRec.srv, { eng: 'sub' }) }), { cap: 50 }) === null, 'מנוי (Routine): בלי אחוז — Anthropic לא חושפת את המכסה, לא ממציאים');
  ok(st.quotaPct(apiRec, { cap: 0 }) === null && st.quotaPct(apiRec, null) === null, 'בלי תקרה ידועה — בלי אחוז');
  const txt = st.receiptText(apiRec, { cap: 50 });
  ok(/studioRcptQuota: studioRcptQuotaV/.test(txt) && /"p":5/.test(txt), 'הקבלה: שורת "מהתקציב החודשי"');
  ok(!/studioRcptQuota/.test(st.receiptText(apiRec)), 'בלי נתוני התקציב — בלי השורה');
  ok(/receiptText\(rec, ui\.api\)/.test(sj), 'שיתוף הקבלה מעביר את נתוני התקציב');

  /* ---------- 6. מחרוזות ---------- */
  const app = read('app.js');
  for (const k of ['studioPlChaps', 'studioPlChapNow', 'studioIdChapAdd', 'studioIdChapRep', 'studioIdChapN', 'studioIdChapOk', 'studioIdChapIn',
    'studioIdChapDel', 'studioIdChapDelQ', 'studioOutShare', 'studioOutDown', 'studioOutErr', 'studioRcptQuota', 'studioRcptQuotaV'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בשתי השפות: ' + k);
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
