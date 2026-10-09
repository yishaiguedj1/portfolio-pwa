// בדיקות לכללי Firestore מול האמולטור הרשמי (@firebase/rules-unit-testing) — בלי הפרויקט האמיתי ובלי נתונים אמיתיים.
// הרצה (מתוך firestore/): npx firebase emulators:exec --only firestore --project demo-snb "node rules.test.mjs"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

let n = 0;
const ok = async (p, name) => { n++; try { await p; console.log('ok - ' + name); } catch (e) { console.error('FAIL - ' + name + ': ' + e.message); process.exit(1); } };

const env = await initializeTestEnvironment({
  projectId: 'demo-snb',
  firestore: { rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8085 },
});
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'users/alice'), { db: '{}', lib: { p: {} } });
  await setDoc(doc(db, 'users/bob'), { db: '{"secret":1}' });
  for (const col of ['studioJobs/j1', 'studioVault/alice', 'studioServers/s1', 'studioStats/alice', 'ibkrVault/alice', 'driveVault/alice', 'academy/config', 'aiCache/x'])
    await setDoc(doc(db, col), { x: 1, uid: 'alice' });
});
const alice = env.authenticatedContext('alice').firestore();
const anon = env.unauthenticatedContext().firestore();

await ok(assertSucceeds(getDoc(doc(alice, 'users/alice'))), 'משתמש קורא את המסמך שלו');
await ok(assertSucceeds(setDoc(doc(alice, 'users/alice'), { lib: { s: { theme: 'auto' } } }, { merge: true })), 'משתמש כותב למסמך שלו (merge — כמו הספרייה)');
await ok(assertSucceeds(updateDoc(doc(alice, 'users/alice'), { db: '{"positions":[]}' })), 'משתמש מעדכן את התיק שלו');
await ok(assertSucceeds(setDoc(doc(env.authenticatedContext('carol').firestore(), 'users/carol'), { db: '{}' })), 'משתמש חדש יוצר את המסמך שלו');
await ok(assertFails(getDoc(doc(alice, 'users/bob'))), 'אסור לקרוא מסמך של משתמש אחר');
await ok(assertFails(setDoc(doc(alice, 'users/bob'), { db: '{}' })), 'אסור לכתוב למסמך של משתמש אחר');
await ok(assertFails(deleteDoc(doc(alice, 'users/bob'))), 'אסור למחוק מסמך של משתמש אחר');
await ok(assertFails(getDocs(collection(alice, 'users'))), 'אסור לרשום את כל המשתמשים');
await ok(assertFails(getDoc(doc(anon, 'users/alice'))), 'בלי התחברות — אין גישה');
await ok(assertFails(setDoc(doc(alice, 'users/alice'), { isAdmin: true }, { merge: true })), 'אסור להוסיף לעצמך שדה ניהול');
for (const p of ['studioJobs/j1', 'studioVault/alice', 'studioServers/s1', 'studioStats/alice', 'ibkrVault/alice', 'driveVault/alice', 'academy/config', 'aiCache/x']) {
  await ok(assertFails(getDoc(doc(alice, p))), 'השרתון בלבד — אסור לקרוא ' + p.split('/')[0]);
  await ok(assertFails(setDoc(doc(alice, p), { x: 2 })), 'השרתון בלבד — אסור לכתוב ' + p.split('/')[0]);
}
await ok(assertFails(setDoc(doc(alice, 'users/alice/sub/x'), { x: 1 })), 'אסור תת־אוספים מתחת למסמך המשתמש');
await ok(assertSucceeds(deleteDoc(doc(alice, 'users/alice'))), 'משתמש מוחק את המסמך שלו (איפוס מלא)');
await env.cleanup();
console.log('# ' + n + ' בדיקות עברו');
