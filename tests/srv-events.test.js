// ת7 (11/10/2026): יומן השרת — העובד שולח את 12 האירועים האחרונים בדופק, השרתון מסנן לקטלוג, ומסך השרת מציג (מקופל).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const S = require('../ibkr-proxy/lib/studio.js');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
const t0 = 1791700000;
const ev = S.normHb({ ev: [[t0, 'up'], [t0 + 5, 'job'], [t0 + 9, '<script>'], [t0 + 9, 'done', 'x'], ['x', 'net'], [99, 'net'], [t0 + 30, 'net']] }).ev;
ok(JSON.stringify(ev) === JSON.stringify([[t0, 'up'], [t0 + 5, 'job'], [t0 + 30, 'net']]), 'השרתון: רק קודים מהקטלוג וזמנים סבירים — השאר נזרק');
ok(S.normHb({ ev: Array.from({ length: 30 }, (_, i) => [t0 + i, 'job']) }).ev.length === 12, 'השרתון: עד 12 אירועים');
ok(Array.isArray(S.normHb({}).ev) && S.normHb({}).ev.length === 0, 'השרתון: בלי יומן — רשימה ריקה');
const ag = fs.readFileSync(path.join(__dirname, '..', 'translator', 'agent.py'), 'utf8');
const agCodes = [...ag.matchAll(/ev\('([a-z]+)'\)|return '([a-z]+)'|'(timeout|oom)'/g)].map((m) => m[1] || m[2] || m[3]).filter((c) => c && c.length <= 8);
const codes = new Set(agCodes.filter((c) => S.SRV_EV.includes(c) || ['up', 'job', 'net', 'auth', 'warm', 'done', 'fail', 'stop', 'crash'].includes(c)));
for (const c of codes) ok(S.SRV_EV.includes(c), 'קוד מהעובד בקטלוג של השרתון: ' + c);
(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
  for (const c of S.SRV_EV) ok(new RegExp("case '" + c + "': return T\\('studioSrvEv").test(src), 'הטלפון: תווית לכל קוד — ' + c);
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  ok((app.match(/studioSrvEvT: "/g) || []).length === 2 && (app.match(/studioSrvEvWarm: "/g) || []).length === 2, 'מחרוזות בשתי השפות');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
