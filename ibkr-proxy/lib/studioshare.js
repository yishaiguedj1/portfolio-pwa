/* שיתוף תוצאה בקישור (11/11/2026, בקשת המשתמש): "לשתף את התוצאה עם חבר בקישור — צפייה והורדה בלבד, בלי עריכה".
   הכללים הטהורים; הפעולות עצמן ב־api/studio.js (shareMake / shareOff של הבעלים, shareView / shareGet בלי התחברות).

   הקישור: ‎<כתובת Studio>/share#<טוקן>, והטוקן = ‎<מזהה העבודה>.<סוד>. הסוד = 24 בתים אקראיים (192 ביט) — אי אפשר לנחש.
   הוא אחרי ה־# — לא נשלח לשרת של הדפים, לא נרשם ביומנים שלו ולא יוצא ב־Referer.
   במסמך העבודה (בלי אוסף חדש — קריאה אחת לכל צפייה, ומחיקת העבודה מבטלת את הקישור לבד):
     lnh — SHA-256 של הסוד (ההשוואה בזמן קבוע); lnx — עד מתי; lna — מתי נוצר;
     lne — הסוד מוצפן בכספת (AAD לפי העבודה), כדי שהבעלים יראה שוב את אותו קישור. אף פעם לא גלוי במסמך.
   מה שהצופה מקבל — רק מה שבדף התוצאה: השם, השפות, האורך, התוצרים (SH_KINDS) ומה שהנגן צריך. בלי uid, מייל, עלות,
   מצב, שרתים או קבצי עזר אחרים. כל קובץ — קישור חתום ל־R2 לשעה, רק בתיקייה של העבודה. */
const crypto = require('crypto');

const JOB_RE = /^j[A-Za-z0-9_-]{20}$/;
const SEC_RE = /^[A-Za-z0-9_-]{32}$/;
const DAY = 24 * 3600e3;
const SH_MAX = 30 * DAY;            // תקרה לקישור (בכל מקרה לא אחרי שהקבצים נמחקים — rt.j)
const SH_URL_TTL = 3600;            // קישור חתום לקובץ — שעה (הדף מבקש חדשים כשפג)
/* התוצרים שמוצגים בדף התוצאה (OUT_MAIN בטלפון) — מה שהצופה רואה ויכול להוריד */
const SH_KINDS = ['compact', 'same', 'mkv', 'small', 'srt', 'en', 'inst', 'lrc', 'elrc', 'lyr', 'vi'];
/* קבצים שהנגן ודף הניתוח צריכים (צפייה בלבד, לא ברשימת ההורדות) */
const SH_AUX = ['cues', 'vis', 'thumb'];
const BURNED = ['compact', 'same', 'small'];   // הסרטון הצרוב — לנגן כשאין מקור (או כגיבוי)

const newSecret = () => crypto.randomBytes(24).toString('base64url');
const secHash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function parseToken(t) {
  const m = /^(j[A-Za-z0-9_-]{20})\.([A-Za-z0-9_-]{32})$/.exec(String(t || ''));
  return m ? { id: m[1], sec: m[2] } : null;
}
const tokenOf = (id, sec) => (JOB_RE.test(String(id || '')) && SEC_RE.test(String(sec || '')) ? id + '.' + sec : '');

/* הקישור פעיל: יש hash, לא פג, והסוד תואם (זמן קבוע) */
function shareOk(job, sec, now) {
  if (!job || typeof job.lnh !== 'string' || job.lnh.length !== 64 || !(Number(job.lnx) > now) || !SEC_RE.test(String(sec || ''))) return false;
  const a = Buffer.from(secHash(sec), 'hex'), b = Buffer.from(job.lnh, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const shareActive = (job, now) => !!(job && typeof job.lnh === 'string' && job.lnh.length === 64 && Number(job.lnx) > now);

/* אפשר לשתף? '' = כן, אחרת קוד שגיאה. eff = המצב האפקטיבי (S.effState), rdy = התוצרים כבר אצלך */
function shareErr(job, eff, isR2Folder) {
  const sp = (job && job.spec) || {};
  if (!job || job.kind !== 'tr' || sp.dry || sp.vo === 1 || sp.vp === 1 || sp.vj === 1) return 'state';
  if (!(eff === 'done' || (job.rdy && eff === 'running'))) return 'state';
  if (!isR2Folder(job.folder)) return 'not_r2';   // תוצרים ב־Drive של הבעלים — אין קישור חתום
  if (!outsOf(job).length) return 'no_out';
  return '';
}

/* הסיומת של הקובץ שהעובד העלה (לשם בהורדה) — אותיות וספרות בלבד */
const extOf = (n) => { const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(n || '')); return m ? m[1].toLowerCase() : ''; };
/* התוצרים להצגה ולהורדה (סדר הרשימה של העובד), רק בתיקייה של העבודה */
function outsOf(job, inFolder) {
  const fo = Array.isArray(job && job.fo) ? job.fo : [];
  return fo.filter((o) => o && SH_KINDS.includes(o.k) && typeof o.id === 'string' && (!inFolder || inFolder(o.id, job.folder)))
    .map((o) => ({ k: o.k, id: o.id, size: Math.max(0, Math.floor(Number(o.size) || 0)), x: extOf(o.name) }));
}
const auxOf = (job, k, inFolder) => {
  const o = (Array.isArray(job && job.fo) ? job.fo : []).find((x) => x && x.k === k && typeof x.id === 'string');
  return o && (!inFolder || inFolder(o.id, job.folder)) ? o.id : '';
};

/* עד מתי הקישור: התקרה, ולא אחרי שהקבצים נמחקים (rt.j מ־studioscan.retention) */
function shareExp(rt, now) {
  const cap = now + SH_MAX;
  return rt && rt.j > now ? Math.min(rt.j, cap) : cap;
}

/* מה הצופה מקבל (בלי הקישורים — השרתון חותם אותם): urls(id) → כתובת חתומה. srcId = סרטון המקור לנגן ('' = אין) */
function shareMeta(job, now) {
  const sp = (job && job.spec) || {};
  const to = Array.isArray(sp.to) ? sp.to.filter((x) => /^[a-z]{2,3}$/.test(String(x))).slice(0, 4) : [];
  return {
    n: String(sp.name || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 200),
    k: sp.vi === 1 ? 'vi' : sp.ka === 1 ? 'ka' : 'tr',
    from: /^[a-z]{2,3}$/.test(String(sp.from || '')) ? sp.from : '',
    to, dur: Math.max(0, Math.round(Number(sp.dur) || 0)),
    at: Math.max(0, Math.floor(Number(job.ended || job.updated || 0))),
    exp: Math.floor(Number(job.lnx) || 0),
  };
}

/* סרטון המקור לנגן: רק ב־R2, בתיקייה של העבודה, לא נמחק ולא מ־Drive (ext) */
function srcOf(job, inFolder) {
  const fv = job && job.fv;
  return fv && typeof fv.id === 'string' && !fv.ext && !(job.sx > 0) && inFolder(fv.id, job.folder) ? fv.id : '';
}

/* שם הקובץ בהורדה (מהדף): בלי תווי בקרה ובלי תווים שמערכות קבצים לא מקבלות */
const dlName = (s) => String(s || '').replace(/[\u0000-\u001f\u007f\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

module.exports = { SH_KINDS, SH_AUX, BURNED, SH_MAX, SH_URL_TTL, newSecret, secHash, parseToken, tokenOf, shareOk, shareActive, shareErr,
  outsOf, auxOf, shareExp, shareMeta, srcOf, dlName };
