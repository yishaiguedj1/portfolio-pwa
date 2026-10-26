// דף הפתיחה של התוסף: חיבור אחד עם Google (drive.appdata) — ואז הסנכרון רץ לבד
import { describe } from './status.js';
const go = document.getElementById('go');
go.addEventListener('click', async () => {
  go.disabled = true;
  const st = await chrome.runtime.sendMessage({ cmd: 'connect' });
  go.disabled = false;
  const bad = !st || !st.on || (st.last && st.last.err);
  document.getElementById('done').hidden = !!bad;
  const e = document.getElementById('err');
  e.hidden = !bad; e.textContent = bad ? (st && st.on ? describe(st, Date.now()).sub : 'החיבור לא הושלם — לנסות שוב') : '';
  if (!bad) go.hidden = true;
});
