// החלון של התוסף: מציג את המצב שהסנכרון שמר, ושולח פקודות ל־sync.js. טקסט בלבד (textContent), בלי HTML.
import { describe, connectErr } from './status.js';

const $ = (id) => document.getElementById(id);
const send = (m) => chrome.runtime.sendMessage(m);

function paint(st) {
  if (!st) return;
  $('off').hidden = st.on; $('on').hidden = !st.on;
  $('offErr').hidden = st.on || !(st.last && st.last.err);
  $('offErr').textContent = $('offErr').hidden ? '' : connectErr(st);
  if (!st.on) return;
  const d = describe(st, Date.now());
  $('title').textContent = d.title; $('sub').textContent = d.sub;
  $('ring').classList.toggle('warn', d.warn);
  $('ico').setAttribute('d', d.warn ? 'M12 7v6M12 16.5v.5' : 'M5 12.5l4.5 4.5L19 7.5');
  $('count').textContent = st.marks ? st.marks.toLocaleString('he-IL') : '';
  $('email').textContent = st.email || '—';
  $('pMarks').checked = st.prefs.marks; $('pHist').checked = st.prefs.hist;
  const what = [st.hold ? `${st.hold} סימניות` : '', st.hhold ? `${st.hhold} ביקורים מההיסטוריה` : ''].filter(Boolean).join(' ו־');
  $('holdCard').hidden = !what;
  $('holdMsg').textContent = what ? `Studio Browser ביקש למחוק ${what} בבת אחת. זה הרבה — המחיקה מחכה לאישור שלך.` : '';
}

async function busy(btn, m) {
  btn.disabled = true;
  try { paint(await send(m)); } finally { btn.disabled = false; }
}

$('connect').addEventListener('click', () => busy($('connect'), { cmd: 'connect' }));
$('now').addEventListener('click', () => busy($('now'), { cmd: 'sync' }));
$('allow').addEventListener('click', () => busy($('allow'), { cmd: 'allowDel' }));
$('disc').addEventListener('click', () => busy($('disc'), { cmd: 'disconnect' }));
$('pMarks').addEventListener('change', (e) => send({ cmd: 'pref', k: 'marks', v: e.target.checked }).then(paint));
$('pHist').addEventListener('change', (e) => send({ cmd: 'pref', k: 'hist', v: e.target.checked }).then(paint));
send({ cmd: 'status' }).then(paint);
