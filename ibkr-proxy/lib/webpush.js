'use strict';
/* התראות לטלפון — Web Push עצמאי (שלב 4 בסטודיו, 10/10/2026), בלי תלויות ובלי שירות חיצוני משלנו:
     RFC 8291 — הצפנת התוכן (aes128gcm): רק הטלפון יכול לקרוא; שירות ה־push (Google/Mozilla/Apple) רואה בייטים.
     RFC 8292 — VAPID: זוג מפתחות של השרתון, נוצר פעם אחת ונשמר מוצפן בכספת (lib/vault.js) — בלי הגדרה ידנית.
   מה נשלח: רק סוג האירוע (מוכן / שאלה / אישור / נעצרה) ומזהה העבודה — לא שם קובץ ולא תוכן (פרטיות, סעיף 3).
   SSRF: שולחים רק לשירותי ה־push המוכרים (PUSH_HOSTS), ב־https. */
const crypto = require('crypto');

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s || ''), 'base64url');

const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/, /^web\.push\.apple\.com$/];
const SUB_MAX = 5;                 // מכשירים לאדם
const TTL = 24 * 3600;             // שעות שההתראה מחכה לטלפון כבוי
const ADMIN_URL = 'https://admin.thesnowball.app/';   // 20/10/2026: הכתובת של מרכז הניהול (מאחורי Cloudflare Access)
const SUBJECT = 'https://yishaiguedj1.github.io/portfolio-pwa/';   // VAPID "sub" — כתובת ולא מייל (פרטיות)
const KINDS = ['done', 'fail', 'ask', 'gate', 'cp', 'srv_down', 'srv_up', 'srv_auth', 'srv_new', 'site_down', 'site_up', 'major', 'bk_fail', 'ready_fail', 'lab_week', 'fund_audit', 'svc_quota', 'fs_hot'].concat(require('./usermon').KINDS);   // 29/10/2026: ניטור משתמשים — עבודה של משתמש אחר בווילון, סוף, "אין אחרים", 80% מהתקרה, סיכום יומי (למנהל)   // 26/10/2026: svc_quota = שירות חיצוני הגיע ל־70% מהמכסה החינמית / המיילים לא נשלחים (למנהל)   // 25/10/2026: fund_audit = בקרת הדיוק הלילית של מנתח החברות מצאה שמשהו נשבר (למנהל)   // 20/10/2026 (מ׳7): lab_week = הסיכום השבועי של המעבדה (למנהל)   // 15/10/2026: srv_new = שרת שהתחבר בפעם הראשונה (גם מהזמנה אוטומטית)   // 15/10/2026: למנהל — הגיבוי נכשל / בדיקת המוכנות נכשלה (נפתח במרכז הניהול)   // 14/10/2026: major = תקלה רחבה (studioinc majorSync)   // שלב 5: הכתובות עצמן (lib/sitewatch.js)   // סבב 10: cp = העתק־הדבק מחכה לך
const TEXT = {
  he: { done: ['התרגום מוכן ✓', 'הכתוביות והסרטון מחכים בסטודיו'], fail: ['העבודה נעצרה', 'פתחו את הסטודיו לפרטים'],
    ask: ['שאלה מ־Claude', 'העבודה מחכה לתשובה שלך'], gate: ['צריך את האישור שלך', 'העבודה מחכה לאישור'],
    cp: ['העתקה והדבקה ל־Claude', 'בקשה חדשה מחכה — מעתיקים, מדביקים ב־Claude ומחזירים את התשובה'],
    srv_down: ['שרת התרגום לא מדווח', 'עבר רבע שעה בלי דיווח מהשרת — פתחו את מסך השרת'], srv_up: ['שרת התרגום חזר ✓', 'השרת מדווח שוב'],
    srv_auth: ['שרת התרגום לא מצליח להתחבר', 'השרתון דוחה את הטוקן שלו — פתחו את מסך השרת'],
    srv_new: ['שרת חדש התחבר ✓', 'שרת התרגום החדש מדווח — פרטים במסך השרת'],
    site_down: ['THE SNOWBALL לא עונה', 'השרת או אחת האפליקציות לא עונים כבר שתי בדיקות. האפליקציה עוברת לגיבוי לבד'], site_up: ['THE SNOWBALL חזר ✓', 'כל הכתובות עונות שוב'],
    major: ['תקלה רחבה בסטודיו', 'אותה תקלה בכמה עבודות. עבודות חדשות מחכות עד שהיא עוברת — פרטים במגדל הפיקוח'],
    bk_fail: ['הגיבוי לא רץ', 'עברו יותר מיומיים בלי גיבוי אצל ספק שני — פרטים במרכז הניהול'],
    ready_fail: ['בדיקת מוכנות נכשלה', 'משהו בהגדרות השתנה — מה ומה עושים, במרכז הניהול'],
    lab_week: ['סיכום השבוע במעבדה', 'מה השתנה השבוע, ואם הגרסה החדשה עזרה — במרכז הניהול'],
    fund_audit: ['נתוני החברות — משהו זז', 'הבדיקה הלילית מצאה ערך שלא תואם לדוח — מה ואיפה, במרכז הניהול'],
    svc_quota: ['שירות מתקרב לסוף המכסה', 'אחד השירותים עבר 70% מהמכסה החינמית — מה ומה הגיבוי, במרכז הניהול'],
    fs_hot: ['קריאות חריגות למסד הנתונים', 'פעולה אחת קוראת הרבה יותר מהרגיל — פרטים בניטור השרתים'],
    test: ['ההתראות עובדות ✓', 'כך תדעו כשתרגום מוכן או כש־Claude שואל משהו'] },
  en: { done: ['Translation ready ✓', 'Subtitles and video are waiting in the studio'], fail: ['The job stopped', 'Open the studio for details'],
    ask: ['Claude has a question', 'The job is waiting for your answer'], gate: ['Your approval is needed', 'The job is waiting for approval'],
    cp: ['Copy & paste to Claude', 'A new request is waiting — copy it, paste in Claude and bring back the answer'],
    srv_down: ['Translation server is silent', 'No report from the server for 15 minutes — open the Server screen'], srv_up: ['Translation server is back ✓', 'The server is reporting again'],
    srv_auth: ['Translation server cannot connect', 'Its token is being rejected — open the Server screen'],
    srv_new: ['New server connected ✓', 'The new translation server is reporting — details on the Server screen'],
    site_down: ['THE SNOWBALL is not responding', 'The server or one of the apps failed two checks in a row. The app switches to the backup by itself'], site_up: ['THE SNOWBALL is back ✓', 'All addresses respond again'],
    major: ['Studio-wide problem', 'The same failure hit several jobs. New jobs wait until it clears — details in the Control Tower'],
    bk_fail: ['Backup is not running', 'More than 2 days without an off-site backup — details in the admin center'],
    ready_fail: ['A readiness check failed', 'Something in the setup changed — what and how to fix it, in the admin center'],
    lab_week: ['This week in the lab', 'What changed this week, and whether the new version helped — in the admin center'],
    fund_audit: ['Company data — something moved', 'The nightly check found a value that no longer matches the filing — what and where, in the admin center'],
    svc_quota: ['A service is near its quota', 'One of the services passed 70% of its free quota — which one and its backup, in the admin center'],
    fs_hot: ['Unusual database reads', 'One operation reads far more than usual — details in server monitoring'],
    test: ['Notifications work ✓', 'You will know when a translation is ready or Claude asks something'] },
};

/* 27/10/2026 (בקשת המשתמש): התקדמות העבודה בווילון — התראה אחת לעבודה שמתחלפת בכל שלב, עם פס של השלב.
   רק קוד השלב והאחוז — לא שם קובץ. הסדר והשמות = stageName בטלפון (studio.js). ka = קריוקי, sb = קובץ כתוביות */
const STAGE = {
  he: { up: 'מעלים את הסרטון', tr: 'כותבים כל מילה שנאמרה', al: 'מתאימים כל משפט לרגע הנכון', tl: 'מתרגמים', tlhe: 'מתרגמים לעברית',
    rv: 'בודקים ומתקנים', bn: 'מוסיפים את הכתוביות לסרטון', sv: 'שומרים ושולחים אליך',
    sb: { up: 'מעלים את הקובץ', tr: 'קוראים את הכתוביות', al: 'מכינים לתרגום', bn: 'בונים את קובצי הכתוביות' },
    ka: { up: 'מעלים את השיר', tr: 'מפרידים את הקול מהליווי', al: 'מתאימים כל מילה לרגע שלה', bn: 'צורבים את המילים' },
    of: 'שלב {n} מתוך {t}' },
  en: { up: 'Uploading the video', tr: 'Writing down every word', al: 'Timing every sentence', tl: 'Translating', tlhe: 'Translating to Hebrew',
    rv: 'Checking and fixing', bn: 'Adding subtitles to the video', sv: 'Saving and sending it to you',
    sb: { up: 'Uploading the file', tr: 'Reading the subtitles', al: 'Preparing to translate', bn: 'Building the subtitle files' },
    ka: { up: 'Uploading the song', tr: 'Separating the voice from the music', al: 'Matching each word to its moment', bn: 'Burning in the lyrics' },
    of: 'Step {n} of {t}' },
};
const STAGE_IDS = ['up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv'];
const BAR_N = 10;
/* פס טקסט — התראת אתר לא יכולה להציג פס התקדמות אמיתי. מבודד בכיוון של השפה: בעברית מתמלא מימין, כמו הפס בדף העבודה */
function stageBar(p, lang) {
  const f = Math.max(0, Math.min(BAR_N, Math.round((Number(p) || 0) * BAR_N)));
  return (lang === 'en' ? '\u2066' : '\u2067') + '▰'.repeat(f) + '▱'.repeat(BAR_N - f) + '\u2069';
}
function stageText(x, lang) {
  const L = STAGE[lang] || STAGE.he;
  const id = STAGE_IDS.includes(x && x.st) ? x.st : '';
  if (!id) return null;
  const v = x.v === 'ka' || x.v === 'sb' ? L[x.v][id] : '';
  const name = v || (id === 'tl' && x.to === 'he' ? L.tlhe : L[id]);
  const pct = Math.max(0, Math.min(100, Math.round((Number(x.p) || 0) * 100)));
  const n = STAGE_IDS.indexOf(id) + 1;
  // 27/10/2026: זהה להתראה מהדף (studio.js shadeSync) — פס ואחוז, ואז "שלב 2 מתוך 7"; RLM בתחילת כל שורה בעברית
  const d = lang === 'en' ? '' : '\u200F';
  return [name, d + stageBar(x.p, lang === 'en' ? 'en' : 'he') + '  ' + pct + '%\n' + d + L.of.replace('{n}', n).replace('{t}', STAGE_IDS.length)];
}
/* מתי שולחים: שלב חדש, או כל 10% בתוך השלב. prev/next = job.prog לפני ואחרי הדיווח */
function stageDue(prev, next) {
  if (!next || !STAGE_IDS.includes(next.st)) return false;
  if (!prev || prev.st !== next.st) return true;
  const b = (p) => Math.floor((Number(p) || 0) * BAR_N + 1e-9);
  return b(next.p) > b(prev.p);
}

function endpointOk(e) {
  let u;
  try { u = new URL(String(e || '')); } catch (x) { return false; }
  return u.protocol === 'https:' && !u.port && !u.username && String(e).length <= 1024 && PUSH_HOSTS.some((r) => r.test(u.hostname));
}

/* מה שהטלפון שולח (PushSubscription.toJSON) → {e, p, a, l}; לא תקין → null */
function normSub(o) {
  if (!o || typeof o !== 'object') return null;
  const e = String(o.endpoint || o.e || ''), k = o.keys || {};
  const p = String(k.p256dh || o.p || ''), a = String(k.auth || o.a || '');
  if (!endpointOk(e) || !/^[A-Za-z0-9_-]{87}$/.test(p) || !/^[A-Za-z0-9_-]{22}$/.test(a)) return null;
  if (unb64u(p).length !== 65 || unb64u(p)[0] !== 4 || unb64u(a).length !== 16) return null;
  return { e, p, a, l: (o.l || o.lang) === 'en' ? 'en' : 'he' };
}
function normSubs(list) {
  const out = [];
  for (const x of Array.isArray(list) ? list : []) {
    const s = normSub(x);
    if (s && !out.some((y) => y.e === s.e)) out.push(Object.assign(s, { at: Number(x.at) || 0 }));
  }
  return out.slice(-SUB_MAX);
}
function addSub(list, sub, now) { return normSubs(normSubs(list).filter((x) => x.e !== sub.e).concat([Object.assign({}, sub, { at: now })])); }
function dropSub(list, e) { return normSubs(list).filter((x) => x.e !== String(e || '')); }

/* ---------------------------------------------------------------- VAPID */
function genVapid() {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const j = privateKey.export({ format: 'jwk' });
  return { pub: b64u(Buffer.concat([Buffer.from([4]), unb64u(j.x), unb64u(j.y)])), d: j.d };
}
function privKey(v) {
  const p = unb64u(v.pub);
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: v.d, x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)) }, format: 'jwk' });
}
function vapidAuth(v, endpoint, now) {
  const aud = new URL(endpoint).origin;
  const enc = (o) => b64u(Buffer.from(JSON.stringify(o)));
  const data = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: SUBJECT });
  const sig = crypto.sign('sha256', Buffer.from(data), { key: privKey(v), dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + data + '.' + b64u(sig) + ', k=' + v.pub;
}

/* ---------------------------------------------------------------- הצפנה (RFC 8291) */
function encrypt(sub, payload, opt = {}) {
  const ua = unb64u(sub.p), auth = unb64u(sub.a);
  if (ua.length !== 65 || auth.length !== 16) throw new Error('bad_sub');
  const ecdh = crypto.createECDH('prime256v1');
  if (opt.asPriv) ecdh.setPrivateKey(unb64u(opt.asPriv)); else ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(ua);
  const salt = opt.salt ? unb64u(opt.salt) : crypto.randomBytes(16);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPub]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}

const nf = (n) => Math.round(+n || 0).toLocaleString('en-US');
function fsHotText(x, lang) {
  if (!x || (x.k !== 'tag' && x.k !== 'pace')) return null;
  const tag = String(x.tag || '').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 50);
  if (lang === 'en') return x.k === 'tag'
    ? ['Unusual database reads', tag + ' read ' + nf(x.h) + ' documents in the last hour — looks like a loop. At this pace the day ends at ' + nf(x.proj) + ' of 50,000. Details in server monitoring']
    : ['Database quota will run out today', nf(x.tot) + ' reads so far, ' + nf(x.h) + ' in the last hour — about ' + nf(x.proj) + ' of 50,000 by the reset. Details in server monitoring'];
  return x.k === 'tag'
    ? ['קריאות חריגות למסד הנתונים', tag + ' קרא ' + nf(x.h) + ' מסמכים בשעה האחרונה — נראה כמו לולאה. בקצב הזה היום ייגמר ב־' + nf(x.proj) + ' מתוך 50,000. פרטים בניטור השרתים']
    : ['מכסת מסד הנתונים תיגמר היום', nf(x.tot) + ' קריאות עד עכשיו, ' + nf(x.h) + ' בשעה האחרונה — בערך ' + nf(x.proj) + ' מתוך 50,000 עד האיפוס. פרטים בניטור השרתים'];
}

/* התוכן של התראה: כותרת + שורה בשפת המכשיר, ולאן לפתוח. בלי שם קובץ ובלי תוכן העבודה */
function message(kind, jobId, lang, x, now) {
  // 28/10/2026: קריאות חריגות ל־Firestore (lib/fsmeter.js) — מי ובאיזה קצב, הרבה לפני שהמכסה נגמרת; נפתח בניטור השרתים
  if (kind === 'fs_hot') { const m = fsHotText(x, lang); return m ? { t: m[0], b: m[1], k: kind, j: '', u: ADMIN_URL + '#mon' } : null; }
  // 29/10/2026: ניטור משתמשים (lib/usermon.js) — למנהל בלבד. עבודה של משתמש אחר = תג משלה (watch-<עבודה>), נפתחת במרכז הניהול
  if (require('./usermon').KINDS.includes(kind)) {
    const t = require('./usermon').pushText(kind, x || {}, lang);
    if (!t) return null;
    const j = /^j[A-Za-z0-9_-]{20}$/.test(String(jobId || '')) ? jobId : '';
    if ((kind === 'watch' || kind === 'watch_end') && !j) return null;
    const m = { t: t[0], b: t[1], k: kind, j, u: ADMIN_URL + (j ? '#live=' + j : kind === 'cap80' ? '#users' : kind === 'daily' ? '#act' : '#ov') };
    if (Number.isFinite(now)) m.at = now;
    if (kind === 'watch') m.p = Math.round(Math.max(0, Math.min(1, Number(x && x.p) || 0)) * 1000) / 1000;
    return m;
  }
  // 27/10/2026: התראת מחיר מגרף הנרות (lib/pxalert.js) — הטקסט נבנה מההתראה עצמה; נפתח בגרף של המניה (#chart=)
  if (kind === 'px') { const m = x && x.a ? require('./pxalert').text(x.a, x.p, lang) : null; return m ? { t: m.t, b: m.b, k: 'px', j: '', i: m.i, u: m.u } : null; }
  const t = kind === 'stage' ? stageText(x, lang) : (TEXT[lang] || TEXT.he)[kind];
  if (!t) return null;
  const j = /^j[A-Za-z0-9_-]{20}$/.test(String(jobId || '')) ? jobId : '';
  if (kind === 'stage' && !j) return null;
  const adm = { bk_fail: 'ready', ready_fail: 'ready', lab_week: 'labWk', fund_audit: 'labFund', svc_quota: 'svc' }[kind];   // התראות המנהל — נפתחות במרכז הניהול
  const m = { t: t[0], b: t[1], k: kind, j, u: SUBJECT + (j ? '#studio=' + j : '') };
  if (j && Number.isFinite(now)) m.at = now;
  // 27/10/2026: השלב והאחוז — sw.js לא מחליף התראה שכבר מראה יותר (הדף מעדכן אותה לפי ההערכה שלו כל כמה שניות)
  if (kind === 'stage') { m.st = x.st; m.p = Math.round(Math.max(0, Math.min(1, Number(x.p) || 0)) * 1000) / 1000; }   // 27/10/2026: הסדר בין התראות של אותה עבודה (sw.js — ישנה לא דורסת חדשה)
  if (adm) m.u = ADMIN_URL + '#' + adm;
  return m;
}

/* שליחה לכל המכשירים של אדם. מחזיר את הרשימה המעודכנת (מנוי שפג — 404/410 — יוצא ממנה) ומספר ההצלחות */
async function sendAll(deps, v, subs, kind, jobId, now, x) {
  const f = deps.fetch || fetch;
  // במקביל (עד SUB_MAX): בטור, מנוי תקוע אחד (5 שנ׳) כפול חמישה עיכב את הדיווח של העובד עד 25 שנ׳
  const res = await Promise.all(normSubs(subs).map(async (s) => {
    const msg = message(kind, jobId, s.l, x, now);
    if (!msg) return { s, keep: true, ok: false };
    try {
      // התקדמות: חצי שעה מספיקה (מצב ישן לא שימושי), ובלי להעיר את הטלפון בדחיפות
      const r = await f(s.e, { method: 'POST', headers: { TTL: String(kind === 'stage' || kind === 'watch' ? 1800 : kind === 'px' ? 3600 : TTL), Urgency: kind === 'done' || kind === 'stage' || kind === 'watch' || kind === 'daily' ? 'normal' : 'high',
        'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: vapidAuth(v, s.e, now) },
      body: encrypt(s, JSON.stringify(msg)), redirect: 'manual', signal: AbortSignal.timeout(5000) });
      if (r.status === 404 || r.status === 410) return { s, keep: false, ok: false };      // המנוי בוטל בטלפון
      return { s, keep: true, ok: r.status >= 200 && r.status < 300 };
    } catch (e) { return { s, keep: true, ok: false }; }
  }));
  return { subs: res.filter((x) => x.keep).map((x) => x.s), sent: res.filter((x) => x.ok).length };
}

module.exports = { PUSH_HOSTS, SUB_MAX, KINDS, TEXT, STAGE, STAGE_IDS, stageText, stageDue, stageBar, endpointOk, normSub, normSubs, addSub, dropSub, genVapid, vapidAuth,
  encrypt, message, sendAll, b64u, unb64u };
