// שלב 4 בסטודיו (10/10/2026): קבלה לעבודה שהסתיימה — טקסט לשיתוף/העתקה מהרשומה שבטלפון (בלי רשת).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };

(async () => {
  global.document = { documentElement: { lang: 'he' } };
  global.t = (k, v) => (v && v.n != null ? k + ':' + v.n : k);   // כמו t() של האפליקציה: מפתח + המספר
  const st = await import('../studio.js');
  const t0 = Date.UTC(2026, 9, 10, 6, 33);
  const rec = {
    id: 'j' + 'A'.repeat(20), created: t0, spec: { name: 'TED_talk-5min.mp4', dur: 300, mode: 'opus-medium' },
    srv: { state: 'done', ended: t0 + 814e3, q: { s: 99 }, jd: { s: 88 },
      use: [{ k: 'main', m: 'claude-opus-5-5', n: 9, i: 1000, o: 2000, cr: 10000, c5: 0, c1: 3000, usd: 0.21 },
        { k: 'tl', m: 'claude-opus-5-5', n: 4, i: 500, o: 6000, cr: 20000, c5: 0, c1: 2000, usd: 0.22 }] },
  };
  const txt = st.receiptText(rec);
  const L = txt.split('\n');
  ok(L[0].includes('studioRcptHead') || L[0].length > 0, 'כותרת');
  ok(/TED talk-5min/.test(txt), 'שם הסרטון (בלי סיומת, קווים תחתונים → רווחים)');
  ok(/5:00/.test(txt) && /13:34/.test(txt), 'אורך הסרטון וזמן העבודה');
  ok(/Opus Medium/.test(txt), 'המצב');
  ok(/0\.43/.test(txt) && /44,500|44500/.test(txt), 'עלות כוללת וטוקנים (אותם מספרים של כרטיס העלות)');
  ok(/99\/100/.test(txt) && /88\/100/.test(txt), 'איכות + שופט');
  ok(txt.includes(rec.id), 'מזהה העבודה');
  ok(st.receiptText(Object.assign({}, rec, { srv: Object.assign({}, rec.srv, { state: 'running' }) })) === '', 'רק לעבודה שהסתיימה');
  const src = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
  ok(/btn\('st-row st-act', T\('studioRcpt'\), \(\) => shareReceipt\(rec\), 'receipt'\)/.test(src) && /navigator\.share/.test(src) && /copyText\(txt, T\('studioRcptCopied'\)\)/.test(src), 'כפתור במקטע התוצרים: שיתוף, ואם אין — העתקה');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  for (const k of ['studioRcpt', 'studioRcptHead', 'studioRcptDone', 'studioRcptWall', 'studioRcptJudge', 'studioRcptCopied'])
    ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'מחרוזת בשתי השפות: ' + k);
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + e.message); process.exit(1); });
