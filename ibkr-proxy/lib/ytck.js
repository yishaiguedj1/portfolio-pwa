'use strict';
/* 25/10/2026 (בקשת המשתמש): הורדה מיוטיוב בשרת דרך חשבון יוטיוב ייעודי — עוגיות בפורמט Netscape (cookies.txt) שהמנהל
   מדביק במרכז הניהול. טהור: בדיקה וניקוי. נשמרות רק מוצפנות בכספת (studioVault/_ytck, ‏AAD משלהן), יוצאות רק לשרת
   התרגום (טוקן שרת), לא חוזרות לטלפון ולא נכנסות ליומנים. רק דומיינים של יוטיוב וגוגל — שום עוגייה אחרת לא נשמרת */
const IN_MAX = 256 * 1024;          // מה שמותר להדביק (ייצוא מלא של הדפדפן גדול יותר מהצורך)
const OUT_MAX = 64 * 1024;          // אחרי הסינון — רק יוטיוב וגוגל
const LINES_MAX = 400;
const DOM_RE = /^(?:[a-z0-9-]+\.)*(?:youtube\.com|google\.com)$/;
const NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/;
const VAL_RE = /^[\x21-\x7e]{0,4096}$/;       // בלי רווחים, טאבים ותווי בקרה
// בלי אחת מאלה זה לא חשבון מחובר (עוגיות אורח לא עוזרות מול "not a bot")
const AUTH = ['SAPISID', '__Secure-1PAPISID', '__Secure-3PAPISID', '__Secure-1PSID', '__Secure-3PSID', 'SID', 'LOGIN_INFO'];
const HEAD = '# Netscape HTTP Cookie File';

/* טקסט מהמנהל → { text, n, exp } או { error }. exp = התפוגה הקרובה מבין עוגיות החשבון (ms), 0 = עוגיית סשן */
function normCookies(raw) {
  const s = String(raw == null ? '' : raw);
  if (!s.trim()) return { error: 'empty' };
  if (s.length > IN_MAX) return { error: 'too_large' };
  const out = [], names = new Set();
  let exp = 0;
  for (let line of s.replace(/\r/g, '').split('\n')) {
    let pre = '';
    if (line.startsWith('#HttpOnly_')) { pre = '#HttpOnly_'; line = line.slice(10); }
    else if (!line.trim() || line.startsWith('#')) continue;
    const f = line.split('\t');
    if (f.length !== 7) continue;
    const [dom0, sub, path, sec, ex, name, val] = f;
    const dom = dom0.toLowerCase().replace(/^\./, '');
    if (!DOM_RE.test(dom) || !NAME_RE.test(name) || !VAL_RE.test(val)) continue;
    if (!/^(TRUE|FALSE)$/.test(sub) || !/^(TRUE|FALSE)$/.test(sec) || !/^\/[\x21-\x7e]{0,200}$/.test(path) || !/^\d{1,12}$/.test(ex)) continue;
    out.push(pre + dom0.toLowerCase() + '\t' + sub + '\t' + path + '\t' + sec + '\t' + ex + '\t' + name + '\t' + val);
    names.add(name);
    if (AUTH.includes(name) && +ex > 0) exp = exp ? Math.min(exp, +ex * 1000) : +ex * 1000;
    if (out.length > LINES_MAX) return { error: 'too_many' };
  }
  if (!out.length) return { error: 'no_cookies' };
  if (!AUTH.some((k) => names.has(k))) return { error: 'not_logged_in' };
  const text = HEAD + '\n' + out.join('\n') + '\n';
  if (text.length > OUT_MAX) return { error: 'too_large' };
  return { text, n: out.length, exp };
}

/* מה שמותר לשרת לדווח אחרי שימוש: הצליח, או נחסם / החשבון לא מחובר / העוגיות פגו */
const REP_CODES = ['blocked', 'login', 'ck'];
function normRep(r) {
  if (!r || typeof r !== 'object') return null;
  if (r.ok === true) return { ok: true };
  const c = String(r.code || '');
  return REP_CODES.includes(c) ? { ok: false, code: c } : null;
}

/* מצב החשבון בשרת (studioVault/_ytck) → מה שמרכז הניהול רואה. בלי העוגיות עצמן. שמות השדות y* — לא ck/sc/v, שכבר
   ב־JSON_FIELDS (חל לפי שם שדה על כל האוספים, CLAUDE.md סעיף 18): yk = העוגיות המוצפנות, yv = הגרסה, ya = מתי נשמרו,
   yn = כמה, ye = התפוגה, ys = מצב (ok/bad), yc = קוד החסימה, yt = מתי נחסם, yo = מתי עבד, yp = מתי חזרו מעודכנות, yb = חסימות ברצף */
function ytView(d, now) {
  d = d || {};
  const on = !!d.yk;
  return { on, at: +d.ya || 0, n: +d.yn || 0, exp: +d.ye || 0, st: on ? (d.ys === 'bad' ? 'bad' : d.ys === 'ok' ? 'ok' : 'new') : 'off',
    sc: REP_CODES.includes(d.yc) ? d.yc : '', sat: +d.yt || 0, ok: +d.yo || 0, put: +d.yp || 0,
    soon: on && +d.ye > 0 && +d.ye - (now || Date.now()) < 7 * 864e5 };
}
/* הטלפון: אפשר להוריד מיוטיוב לענן — יש חשבון, ולא נחסם */
const ytCloud = (d) => !!(d && d.yk && d.ys !== 'bad');

module.exports = { normCookies, normRep, ytView, ytCloud, REP_CODES, AUTH, IN_MAX, OUT_MAX };
