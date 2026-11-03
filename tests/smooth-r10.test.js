// 03/11/2026 — סבב קפיצות 10: הבועה בהדר נבנתה מחדש בכל ציור, והסרגל העליון של דפי Studio נעלם לפריימים בציור במקום
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL - ' + m); } else console.log('ok - ' + m); };
const sh = R('shell.js'), st = R('studio.js'), qa = R('tools/qa-sweep.js');

// 1. הבועה בהדר — מתעדכנת במקום
ok(/setStatus\(node\) \{ statusSet\(sub, node\); \}/.test(sh), 'setStatus עובר דרך statusSet');
ok(/sub\.addEventListener\('click', \(e\) => \{\s*const f = sub\._fwd;/.test(sh), 'הנגיעה בבועה עוברת לבועה של הציור האחרון');

// DOM מינימלי לבדיקת התנהגות
class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.childNodes = []; this.attrs = new Map(); this.parentNode = null; this.hidden = false; this.clicks = 0; this.text = ''; }
  get firstElementChild() { return this.childNodes[0] || null; }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  hasAttribute(k) { return this.attrs.has(k); } getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  setAttribute(k, v) { this.attrs.set(k, String(v)); } removeAttribute(k) { this.attrs.delete(k); }
  append(...a) { for (const c of a) { if (c.parentNode) c.parentNode.childNodes.splice(c.parentNode.childNodes.indexOf(c), 1); c.parentNode = this; this.childNodes.push(c); } }
  replaceChildren(...a) { this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; this.append(...a); }
  set textContent(v) { this.replaceChildren(); this.text = v; }
  get innerHTML() { return this.text + this.childNodes.map((c) => c.outerHTML).join(''); }
  get outerHTML() { return '<' + this.tagName + [...this.attrs].map(([k, v]) => ' ' + k + '="' + v + '"').join('') + '>' + this.innerHTML + '</' + this.tagName + '>'; }
}
const a = sh.indexOf('export function statusSet'), b = sh.indexOf('/* מסך הכניסה של Academy');
const c = {}; vm.createContext(c); vm.runInContext(sh.slice(a, b).replace('export function', 'function') + '\nthis.statusSet = statusSet;', c);
const pill = (cls, val) => { const p = new El('button'); p.setAttribute('class', cls); const v = new El('b'); v.text = val; p.append(v); return p; };
{
  const sub = new El('div'); sub.hidden = true;
  const p1 = pill('lib-bkpill off', 'כבוי'); c.statusSet(sub, p1);
  ok(sub.firstElementChild === p1 && !sub.hidden, 'ציור ראשון — הבועה נכנסת');
  const p2 = pill('lib-bkpill off', 'כבוי'); c.statusSet(sub, p2);
  ok(sub.firstElementChild === p1 && sub.childNodes.length === 1 && sub._fwd === p2, 'אותה בועה — הצומת הקיים נשאר, הנגיעה עוברת לחדשה');
  const p3 = pill('lib-bkpill ok done', 'פעיל'); p3.setAttribute('aria-label', 'x'); c.statusSet(sub, p3);
  ok(sub.firstElementChild === p1 && p1.getAttribute('class') === 'lib-bkpill ok done' && p1.getAttribute('aria-label') === 'x' && p1.innerHTML.includes('פעיל'), 'מצב חדש — אותו צומת, מחלקות/תכונות/תוכן מהחדשה');
  const p4 = pill('lib-bkpill ok', 'פעיל'); c.statusSet(sub, p4);
  ok(p1.getAttribute('aria-label') === null && p1.getAttribute('class') === 'lib-bkpill ok', 'תכונה שירדה — יורדת גם מהקיים');
  const sp = new El('span'); c.statusSet(sub, sp);
  ok(sub.firstElementChild === sp && sub._fwd === null, 'תגית אחרת — החלפה');
  c.statusSet(sub, null); ok(sub.hidden && sub.childNodes.length === 0, 'בלי בועה — מוסתר');
}

// 2. Studio: ציור במקום בכל הדפים, חלקים זהים נשארים
ok(/const oldPg = kind === 'none' \? root\.querySelector\(':scope > \.st-page'\) : null;/.test(st), 'render(none): הדף הקיים נשמר בכל הדפים (לא רק בבית)');
ok(/const kids = pageKeep\(oldPg, /.test(st), 'הילדים עוברים דרך pageKeep');
ok(/root\.addEventListener\('click', stKeepTap, true\);/.test(st), 'מאזין הלכידה של הנגיעה בחלק שנשמר');
ok(/const KEEP_NO = 'input,textarea,select,video,audio,canvas,iframe,\[contenteditable\],\[data-live\]';/.test(st), 'לא נשמרים: עדכון חי, שדות, וידאו, קנבס');
ok(/o\._fwd = null;\s*o\.replaceWith\(f\);/.test(st), 'בנגיעה — החלק מתחלף בחדש לפני הלחיצה (הפעולה מהציור האחרון, על מה שעל המסך)');
ok(/רענון שקט במגדל/.test(qa) && /הבועה בהדר נבנתה מחדש/.test(qa), 'qa-sweep: גלאי המגדל והבועה');

console.log(n - bad + '/' + n + ' passed');
process.exit(bad ? 1 : 0);
