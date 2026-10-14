/* גיבוי Invest ל־Google Drive של המשתמש (14/10/2026, בקשת המשתמש — "בדיוק כמו בספרים").
   אותו חיבור של גיבוי הספרייה (libbackup.js: הרשאת drive.file, ההרשאה שמורה מוצפנת בשרתון ולא חוזרת לטלפון),
   וקובץ JSON אחד בתיקייה "THE SNOWBALL — Invest" שמתעדכן במקום — Drive שומר את הגרסאות הקודמות.
   מה נכנס לגיבוי ואיך משחזרים בלי כפילויות — pfBackupSnapshot/pfBackupMerge ב־app.js. בלי DOM (נבדק ב־node). */
import { createBackup, waitOAuthCode } from './libbackup.js';

const API = 'https://www.googleapis.com/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
export const PF_ROOT = 'THE SNOWBALL — Invest';
export const PF_FILE = 'invest-backup.json';
const LS_KEY = 'pwa_pfbk_v1';            // לכל חשבון (גם ב־ACCOUNT_KEYS של האפליקציה)
const MAX_BYTES = 5 * 1024 * 1024;       // קובץ גדול מזה = לא שלנו / פגום

export function createPfBackup(env) {
  const E = Object.assign({ now: () => Date.now(), ls: typeof localStorage !== 'undefined' ? localStorage : null }, env);
  const bkEnv = { owner: E.owner, libApi: E.libApi, idToken: E.idToken, allBooksRaw: async () => [], putBook: async () => {},
    redirectUri: E.redirectUri, openWindow: E.openWindow, waitCode: E.waitCode || waitOAuthCode, now: E.now, ls: E.ls };
  if (E.fetch) bkEnv.fetch = E.fetch;
  const BK = createBackup(bkEnv);

  function all() { try { return JSON.parse((E.ls && E.ls.getItem(LS_KEY)) || '{}') || {}; } catch (e) { return {}; } }
  function settings() { return Object.assign({ auto: true }, all()[E.owner()] || {}); }
  function save(patch) {
    const a = all(); a[E.owner()] = Object.assign(settings(), patch);
    try { E.ls && E.ls.setItem(LS_KEY, JSON.stringify(a)); } catch (e) {}
    return a[E.owner()];
  }
  const email = () => BK.settings().email || '';
  const q = (s) => encodeURIComponent(s);
  const sigOf = (snap) => { const t = JSON.stringify(Object.assign({}, snap, { at: 0 })); let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return t.length + ':' + h; };

  async function folder(create) {
    const s = settings();
    if (s.folder) {
      const f = await BK._req('GET', API + '/files/' + s.folder + '?fields=id,trashed');
      if (f && !f.trashed) return s.folder;
    }
    const qs = "appProperties has { key='snbInvest' and value='1' } and trashed=false and mimeType='" + FOLDER + "'";
    const j = await BK._req('GET', API + '/files?q=' + q(qs) + '&fields=files(id)&pageSize=5&spaces=drive');
    let id = j && j.files && j.files.length ? j.files[0].id : '';
    if (!id && create) {
      id = (await BK._req('POST', API + '/files?fields=id', JSON.stringify({ name: PF_ROOT, mimeType: FOLDER, appProperties: { snbInvest: '1' },
        description: 'גיבוי של מה שהוזן ביד ב־THE SNOWBALL Invest. השחזור — מההגדרות באפליקציה.' }), { 'Content-Type': 'application/json' })).id;
    }
    save({ folder: id || '', file: id && s.folder === id ? s.file : '' });
    return id || '';
  }
  async function file(dir) {
    const qs = "appProperties has { key='snbInvestData' and value='1' } and trashed=false and '" + dir + "' in parents";
    const j = await BK._req('GET', API + '/files?q=' + q(qs) + '&fields=files(id,size)&pageSize=5&spaces=drive');
    return j && j.files && j.files.length ? j.files[0] : null;
  }

  let chain = Promise.resolve(), busy = 0;
  function run(fn) { busy++; const p = chain.then(fn); chain = p.catch(() => {}); return p.finally(() => { busy--; }); }

  /* snap = pfBackupSnapshot(...) מהאפליקציה */
  function backupNow(snap) {
    return run(async () => {
      if (!email()) { const e = new Error('not_connected'); e.code = 'not_connected'; throw e; }
      const dir = await folder(true);
      const f = await file(dir);
      const blob = new Blob([JSON.stringify(snap)], { type: 'application/json' });
      const meta = f ? {} : { name: PF_FILE, parents: [dir], appProperties: { snbInvestData: '1' } };
      const r = await BK._upload(f ? f.id : '', meta, blob, 'application/json');
      return save({ file: (r && r.id) || (f && f.id) || '', lastAt: snap.at || E.now(), count: E.count ? E.count(snap) : 0, sig: sigOf(snap), err: '', errAt: 0 });
    });
  }
  /* הגיבוי מ־Drive (או null כשאין) */
  function load() {
    return run(async () => {
      const dir = await folder(false);
      if (!dir) return null;
      const f = await file(dir);
      if (!f || +f.size > MAX_BYTES) return null;
      const blob = await BK._req('GET', API + '/files/' + f.id + '?alt=media', null, null, true);
      let s = null; try { s = JSON.parse(await blob.text()); } catch (e) {}
      return s && s.app === 'invest' && s.v === 1 ? s : null;
    });
  }

  /* גיבוי אוטומטי אחרי שינוי — שקט, תקלה נשמרת ומוצגת בגיליון */
  let autoT = 0;
  function schedule(getSnap, delay) {
    clearTimeout(autoT);
    autoT = setTimeout(async () => {
      const s = settings();
      if (!email() || s.auto === false || busy) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const snap = getSnap();
      if (!snap) return;
      if (sigOf(snap) === s.sig) return;              // אותו תוכן — לא מעלים שוב
      try { await backupNow(snap); if (E.onAuto) E.onAuto(); }
      catch (e) { save({ err: String(e.code || e.message || 'failed').slice(0, 40), errAt: E.now() }); if (E.onAuto) E.onAuto(); }
    }, delay == null ? 20000 : delay);
  }

  return { settings, save, email, connect: (h) => BK.connect(h), status: () => BK.status(), config: () => BK.config(),
    backupNow, load, schedule, busy: () => busy > 0 };
}
