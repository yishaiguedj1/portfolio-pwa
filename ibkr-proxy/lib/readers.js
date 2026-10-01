/* שלב 6: קוראים שנוספו מתוך האפליקציה — מסמך academy/config ב־Firestore של האפליקציה (REST + חשבון השירות).
   דורש פעם אחת: לתת לחשבון השירות את התפקיד "Cloud Datastore User" בפרויקט ה־Firebase. בלי זה — רק LIBRARY_READERS.
   הרשימה חתומה (signList) — רשימה בלי חתימה תקינה לא נחשבת. */
const { datastoreToken, signList } = require('./gauth');
const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const DOC = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents/academy/config';
const EMAIL_RE = /^[^\s@,;]{1,64}@[^\s@,;]{1,190}\.[a-z]{2,24}$/i;
let cache = { at: 0, list: null, err: '' };

function fromDoc(j) {
  const f = (j && j.fields) || {};
  const vals = (((f.readers || {}).arrayValue || {}).values || []).map((v) => v.stringValue).filter(Boolean);
  const list = vals.map((x) => { const [email, at] = x.split('|'); return { email: String(email).toLowerCase(), at: +at || 0 }; });
  const sig = (f.sig || {}).stringValue || '';
  return sig && sig === signList(list) ? list : [];
}
async function getReaders(fetchImpl, force) {
  if (!force && cache.list && Date.now() - cache.at < 60000) return cache;
  try {
    const tk = await datastoreToken(fetchImpl);
    const r = await (fetchImpl || fetch)(DOC(), { headers: { Authorization: 'Bearer ' + tk } });
    if (r.status === 404) cache = { at: Date.now(), list: [], err: '' };
    else if (r.status !== 200) cache = { at: Date.now(), list: [], err: 'fs_http_' + r.status };
    else cache = { at: Date.now(), list: fromDoc(await r.json()), err: '' };
  } catch (e) { cache = { at: Date.now(), list: [], err: String(e.message || e).slice(0, 40) }; }
  return cache;
}
async function saveReaders(list, fetchImpl) {
  const tk = await datastoreToken(fetchImpl);
  const body = { fields: {
    readers: { arrayValue: { values: list.map((x) => ({ stringValue: x.email + '|' + (x.at || 0) })) } },
    sig: { stringValue: signList(list) },
    updatedAt: { timestampValue: new Date().toISOString() },
  } };
  const r = await (fetchImpl || fetch)(DOC() + '?updateMask.fieldPaths=readers&updateMask.fieldPaths=sig&updateMask.fieldPaths=updatedAt', {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  cache = { at: Date.now(), list, err: '' };
  return list;
}
module.exports = { getReaders, saveReaders, EMAIL_RE, _reset: () => { cache = { at: 0, list: null, err: '' }; } };
