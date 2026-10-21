// סט הזהב בעובד (פריט 15, 21/10/2026): translator/goldscore.py = goldCompare של studionet.js, ציון זהה
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gold-'));
  const N = await import(path.join(__dirname, '..', 'studionet.js'));
  const ts = (ms) => { const p = (n, w) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600e3), 2)}:${p(Math.floor(ms / 60e3) % 60, 2)}:${p(Math.floor(ms / 1e3) % 60, 2)},${p(ms % 1e3, 3)}`; };
  const W = ['שלום', 'עולם', 'אנחנו', 'מתרגמים', 'את', 'ההרצאה', 'הזאת', 'לעברית', '(צחוק)', 'נטפליקס', 'מיליון', '"מנוי"', 'אבל', 'לא', 'תמיד', '...', 'כן!', 'בְּרֵאשִׁית', '<i>נטוי</i>', '{\\an8}למעלה', '‏מילה', 'AI', '2026'];
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const mk = (n, jit) => {
    const out = []; let t = Math.floor(rnd() * 3000);
    for (let i = 0; i < n; i++) {
      const d = 800 + Math.floor(rnd() * 3000), k = 1 + Math.floor(rnd() * 7);
      const words = Array.from({ length: k }, () => W[Math.floor(rnd() * W.length)]);
      const txt = rnd() < 0.08 ? '(מחיאות כפיים)' : words.slice(0, Math.ceil(k / 2)).join(' ') + (k > 3 ? '\n' + words.slice(Math.ceil(k / 2)).join(' ') : '');
      out.push(`${i + 1}\r\n${ts(t + jit)} --> ${ts(t + d + jit)}\r\n${txt}`);
      t += d + Math.floor(rnd() * 600);
    }
    return (rnd() < 0.3 ? '﻿' : '') + out.join(rnd() < 0.5 ? '\r\n\r\n' : '\n\n\n');
  };
  const cases = [];
  for (let i = 0; i < 40; i++) cases.push([mk(5 + Math.floor(rnd() * 40), Math.floor(rnd() * 400)), mk(5 + Math.floor(rnd() * 40), 0)]);
  cases.push(['', mk(4, 0)], [mk(4, 0), ''], [mk(4, 0), '1\n00:00:01,000 --> 00:00:02,000\n(צחוק)']);
  fs.writeFileSync(path.join(tmp, 'c.json'), JSON.stringify(cases));
  const py = execFileSync('python3', ['-I', '-c', 'import json,sys;sys.path.insert(0,sys.argv[1]);from goldscore import gold_compare as g;print(json.dumps([g(h,r) for h,r in json.load(open(sys.argv[2]))]))',
    path.join(__dirname, '..', 'translator'), path.join(tmp, 'c.json')], { encoding: 'utf8' });
  const P = JSON.parse(py);
  cases.forEach(([h, r], i) => ok(JSON.stringify(N.goldCompare(h, r)) === JSON.stringify(P[i]), `case ${i}: js ${JSON.stringify(N.goldCompare(h, r))} py ${JSON.stringify(P[i])}`));
  ok(cases.filter(([h, r], i) => P[i] && P[i].s > 0).length > 30, 'רוב המקרים עם ציון אמיתי');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`gold-score: ${pass} עברו, ${fail} נכשלו`);
  process.exit(fail ? 1 : 0);
})();
