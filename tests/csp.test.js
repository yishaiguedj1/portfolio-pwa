// csp.test.js — מדיניות אבטחת התוכן (v149). כל מקור שהקוד פונה אליו חייב להופיע
// במדיניות — אחרת הדפדפן חוסם אותו בשקט (מחירים/גרפים/התחברות נעלמים בלי שגיאה).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }

const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
ok(!!m, 'יש מדיניות CSP ב־index.html');
ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'), 'המדיניות לפני כל סקריפט');
const pol = {};
for (const part of m[1].split(';')) { const [k, ...v] = part.trim().split(/\s+/); if (k) pol[k] = v; }
const allows = (dir, url) => {
  const list = pol[dir] || pol['default-src'] || [];
  const u = new URL(url);
  return list.some((src) => {
    if (src === "'self'") return false;
    const sm = src.match(/^(https?|wss?):\/\/(\*\.)?([^/]+)$/);
    if (!sm || sm[1] + ':' !== u.protocol) return false;
    return sm[2] ? (u.hostname.endsWith('.' + sm[3])) : u.hostname === sm[3];
  });
};

// 1. כל host בקוד מכוסה
const hosts = new Set();
for (const src of [app, cloud]) for (const x of src.matchAll(/['"`](https:\/\/[a-z0-9.-]+)/gi)) hosts.add(x[1]);
const imgHosts = ['https://financialmodelingprep.com'];
for (const h of hosts) {
  if (imgHosts.includes(h)) { ok(allows('img-src', h + '/x.png'), 'img-src מכסה ' + h); continue; }
  if (/twelvedata\.com$/.test(h) && !/^https:\/\/api\./.test(h)) continue; // קישור הרשמה, לא fetch
  ok(allows('connect-src', h + '/x'), 'connect-src מכסה ' + h);
}
ok(allows('connect-src', 'https://my-proxy-123.vercel.app/api'), 'שרתון מותאם אישית ב־Vercel מותר');
// 2. Firebase
for (const u of ['https://identitytoolkit.googleapis.com/v1/x', 'https://securetoken.googleapis.com/v1/x', 'https://firestore.googleapis.com/x'])
  ok(allows('connect-src', u), 'Firebase: ' + new URL(u).hostname);
ok(allows('script-src', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js') && allows('script-src', 'https://apis.google.com/js/api.js'), 'Firebase SDK + gapi');
ok(allows('frame-src', 'https://yishaiguedj1-c786e.firebaseapp.com/__/auth/iframe'), 'iframe ההתחברות');
ok(allows('img-src', 'https://lh3.googleusercontent.com/a/x'), 'תמונת פרופיל Google');
// 3. הסקריפט הפנימי תואם ל־hash
const inl = html.match(/<script>([\s\S]*?)<\/script>/);
const h = "'sha256-" + crypto.createHash('sha256').update(inl[1], 'utf8').digest('base64') + "'";
ok(pol['script-src'].includes(h), 'hash הסקריפט הפנימי תואם (שינוי בו מחייב עדכון המדיניות)');
ok((html.match(/<script>/g) || []).length === 1, 'סקריפט פנימי אחד בלבד');
ok(!pol['script-src'].includes("'unsafe-inline'") && !pol['script-src'].includes("'unsafe-eval'"), 'בלי unsafe-inline/unsafe-eval לסקריפטים');
ok(pol['object-src'] && pol['object-src'][0] === "'none'" && pol['base-uri'] && pol['base-uri'][0] === "'self'", 'object-src none, base-uri self');
// 4. בלי handlers בתוך HTML
for (const [name, src] of [['app.js', app], ['index.html', html], ['cloud.js', cloud]])
  ok(!/\son(load|error|click|change|input|submit|mouseover)\s*=\s*["'\\]/i.test(src), name + ': אין on…= בתוך HTML');
// 5. SRI
const fb = [...html.matchAll(/<script src="https:\/\/www\.gstatic\.com[^>]+>/g)].map((x) => x[0]);
ok(fb.length === 3 && fb.every((t) => /integrity="sha384-[A-Za-z0-9+/=]{64}"/.test(t) && /crossorigin="anonymous"/.test(t)), 'SRI על שלושת קבצי Firebase');

const ver = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
console.log('\n' + n + ' בדיקות עברו');
