// המשפט שבראש החלון — טהור, נבדק ב־node
export function ago(ms, now) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'עכשיו';
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? 'לפני דקה' : `לפני ${m} דקות`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}

const ERR = {
  auth: 'צריך להתחבר שוב עם Google',
  no_token: 'צריך להתחבר שוב עם Google',
  drive_403: 'אין הרשאה ל־Drive — להתחבר שוב',
  drive_429: 'Google ביקש להאט — ננסה שוב עוד כמה דקות',
  other_writer: 'Chrome במחשב אחר מסנכרן עם הטלפון — אפשר להעביר לכאן',
};

export function describe(st, now) {
  const l = st.last || {};
  if (l.err) {
    const k = Object.keys(ERR).find((x) => String(l.err).includes(x));
    return { warn: true, title: 'הסנכרון נעצר', sub: k ? ERR[k] : 'אין חיבור — ננסה שוב לבד' };
  }
  if (st.hold || st.hhold) return { warn: true, title: 'מחכה לאישור שלך', sub: [st.hold ? `${st.hold} סימניות` : '', st.hhold ? `${st.hhold} ביקורים בהיסטוריה` : ''].filter(Boolean).join(' · ') + ' למחיקה' };
  if (!l.at) return { warn: false, title: 'מתחבר…', sub: 'הסנכרון הראשון רץ עכשיו' };
  const moved = [];
  if (l.added) moved.push(l.added === 1 ? 'סימנייה חדשה הגיעה מהטלפון' : `${l.added} סימניות חדשות הגיעו מהטלפון`);
  if (l.removed) moved.push(l.removed === 1 ? 'אחת נמחקה' : `${l.removed} נמחקו`);
  return { warn: false, title: 'הכל מסונכרן', sub: [ago(l.at, now)].concat(moved).join(' · ') };
}

// למה החיבור נכשל — משפט אחד + הקוד מ־Chrome (בלי טוקן; code() חותך ל־60 תווים)
export function connectErr(st) {
  const e = String((st && st.last && st.last.err) || '');
  if (/bad client id|OAuth2 request failed|invalid_client|OAUTH_CLIENT_ID/i.test(e)) return 'התוסף עוד לא רשום ב־Google — צריך לקוח OAuth מסוג Chrome Extension (' + e + ')';
  if (/did not approve|canceled|cancelled|user denied/i.test(e)) return 'החלון של Google נסגר בלי אישור — לנסות שוב';
  if (/not signed in|sign in/i.test(e)) return 'צריך להיות מחובר ל־Chrome עם חשבון Google';
  return e ? 'החיבור לא הושלם — ' + e : 'החיבור לא הושלם — לנסות שוב';
}
