// pf-backup-drive.test.js — גיבוי Invest מול Drive מדומה (14/10/2026): קובץ אחד שמתעדכן במקום, טעינה, גיבוי אוטומטי שקט,
// הפרדה בין חשבונות, ולא נוגע בגיבוי הספרייה. נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const { fakeDrive } = require('./_drivefake.js');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'pfbackup.js'), 'utf8');

(async () => {
  const M = await import(path.join(root, 'pfbackup.js'));
  const D = fakeDrive();
  const store = new Map();
  const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  let owner = 'u1';
  const ops = [];
  const libApi = async (body) => { ops.push(body.op); const r = body.op === 'gdToken' ? { ok: true, access_token: 'AT', expires_in: 3600, email: 'me@example.com' } : body.op === 'gdStatus' ? { ok: true, connected: true, email: 'me@example.com' } : { ok: true }; return { json: async () => r }; };
  const P = M.createPfBackup({ fetch: D.fetch, ls, owner: () => owner, libApi, idToken: async () => 'IDT', count: (s) => (s.positions || []).length });

  // לא מחובר — הגיבוי מסרב, בלי פנייה ל־Drive
  let err = null; try { await P.backupNow({ v: 1, app: 'invest', at: 1 }); } catch (e) { err = e.code; }
  ok(err === 'not_connected' && D.log.length === 0, 'בלי חיבור: לא מגבים ולא פונים ל־Drive');
  ok(await P.load() === null || true, 'טעינה בלי חיבור לא קורסת');

  await P.status();
  ok(P.email() === 'me@example.com', 'החיבור נקלט מהשרתון (אותו חיבור של גיבוי הספרייה)');

  const snap1 = { v: 1, app: 'invest', at: 1000, positions: [{ sym: 'KO', shares: 1, avg: 50 }] };
  const st = await P.backupNow(snap1);
  const fls = [...D.files.values()];
  const dir = fls.find((f) => f.appProperties.snbInvest === '1');
  const data = fls.find((f) => f.appProperties.snbInvestData === '1');
  ok(dir && dir.name === M.PF_ROOT && dir.mimeType === 'application/vnd.google-apps.folder', 'נוצרה תיקייה "THE SNOWBALL — Invest"');
  ok(data && data.name === M.PF_FILE && data.parents.includes(dir.id), 'הקובץ בתוך התיקייה');
  ok(st.lastAt === 1000 && st.count === 1 && !st.err, 'מצב: מתי וכמה');

  const snap2 = { v: 1, app: 'invest', at: 2000, positions: [{ sym: 'KO', shares: 2, avg: 50 }, { sym: 'PEP', shares: 1, avg: 170 }] };
  await P.backupNow(snap2);
  ok([...D.files.values()].filter((f) => f.appProperties.snbInvestData === '1' && !f.trashed).length === 1, 'גיבוי שני מעדכן את אותו קובץ (לא קובץ חדש)');
  ok([...D.files.values()].filter((f) => f.appProperties.snbInvest === '1').length === 1, 'ותיקייה אחת');
  const back = await P.load();
  ok(back && back.at === 2000 && back.positions.length === 2, 'טעינה מחזירה את הגיבוי האחרון');

  // מכשיר חדש: אין הגדרות מקומיות — מוצא את התיקייה לפי הסימון
  store.delete('pwa_pfbk_v1');
  const back2 = await P.load();
  ok(back2 && back2.at === 2000, 'מכשיר חדש (בלי הגדרות) — מוצא את הגיבוי ב־Drive');

  // קובץ זר / פגום — לא משוחזר
  data.data = '{"app":"other"}';
  ok(await P.load() === null, 'קובץ שאינו גיבוי של Invest — לא נטען');
  data.data = 'xx{';
  ok(await P.load() === null, 'קובץ פגום — לא נטען');

  // חשבון אחר — הגדרות נפרדות
  owner = 'u2';
  ok(!P.settings().lastAt && P.settings().auto === true, 'חשבון אחר — הגדרות משלו');
  owner = 'u1';

  // גיבוי אוטומטי: אותו תוכן = לא מעלים שוב; תוכן חדש = מעלים
  await P.backupNow(snap2);
  const before = D.log.filter((l) => /upload/.test(l)).length;
  P.schedule(() => snap2, 0); await new Promise((r) => setTimeout(r, 30));
  ok(D.log.filter((l) => /upload/.test(l)).length === before, 'אוטומטי: בלי שינוי — בלי העלאה');
  P.schedule(() => Object.assign({}, snap2, { at: 3000, cash: { usd: 5 } }), 0); await new Promise((r) => setTimeout(r, 30));
  ok(D.log.filter((l) => /upload/.test(l)).length === before + 1 && P.settings().lastAt === 3000, 'אוטומטי: שינוי — מעלה');
  P.save({ auto: false });
  P.schedule(() => Object.assign({}, snap2, { at: 4000, cash: { usd: 6 } }), 0); await new Promise((r) => setTimeout(r, 30));
  ok(P.settings().lastAt === 3000, 'אוטומטי כבוי — לא מעלה');
  P.save({ auto: true });

  // תקלה באוטומטי — נשמרת, בלי לזרוק
  const P2 = M.createPfBackup({ fetch: async () => ({ status: 403, ok: false, headers: { get: () => null }, text: async () => '' }), ls, owner: () => 'u3', libApi, idToken: async () => 'IDT' });
  await P2.status();
  P2.schedule(() => ({ v: 1, app: 'invest', at: 5 }), 0); await new Promise((r) => setTimeout(r, 60));
  ok(/drive_http_403/.test(P2.settings().err || ''), 'תקלה באוטומטי נשמרת כקוד (בלי הודעה קופצת)');

  // לא נוגע בגיבוי הספרייה
  ok(![...D.files.values()].some((f) => f.appProperties.snbRoot === '1' || f.appProperties.snbManifest === '1'), 'לא נוצרים קבצים של גיבוי הספרייה');
  ok(!/disconnect/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'אין ניתוק מכאן — החיבור משותף לספרייה ולסטודיו');
  ok(ops.every((o) => /^gd(Token|Status|Config)$/.test(o)), 'מהשרתון רק פעולות החיבור הקיימות');

  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
