/* גיבוי הספרייה הפרטית ל־Google Drive של המשתמש (v318, "כמו וואטסאפ").
   איפה: תיקייה גלויה בדרייב "THE SNOWBALL — הספרייה שלי" (קובצי הספרים) + תת־תיקייה "נתוני הספרייה"
   (library.json = הפרטים שנערכו, ההתקדמות וההדגשות; וכריכה לכל ספר). הרשאה drive.file — האפליקציה רואה
   רק קבצים שהיא יצרה. הטלפון מדבר ישירות עם Drive עם גישה זמנית (שעה) שהשרתון מנפיק מהרשאה קבועה מוצפנת
   (api/library.js → lib/gdrive.js); ההרשאה הקבועה לא מגיעה לטלפון.
   הקובץ בלי DOM מלבד חלון ההסכמה — כל התלויות מוזרקות (createBackup(env)) כדי שיהיה אפשר לבדוק אותו ב־node. */
const API = 'https://www.googleapis.com/drive/v3';
const UP = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
export const ROOT_NAME = 'THE SNOWBALL — הספרייה שלי';
export const DATA_NAME = 'נתוני הספרייה';
export const MANIFEST = 'library.json';
export const SCOPES = 'openid email https://www.googleapis.com/auth/drive.file';
const LS_KEY = 'pwa_libbk_v1';
const DAY = 864e5;

/* ---------- טהורות (נבדקות) ---------- */
export function safeName(title, author, ext) {      // שם קובץ קריא בדרייב: "שם הספר — כותב.epub"
  const clean = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f‎‏‪-‮]/g, ' ').replace(/\s+/g, ' ').trim();
  const base = [clean(title) || 'ספר', clean(author)].filter(Boolean).join(' — ').slice(0, 120);
  return base + (ext || '.epub');
}
export function extOf(name) { const m = String(name || '').match(/\.(epub|azw3|azw|mobi|kf8|fb2)$/i); return m ? '.' + m[1].toLowerCase() : '.epub'; }
export const isPrivate = (b, owner) => !!b && b.src !== 'drive' && b.owner === owner;
/* מתי לגבות אוטומטית: בכל שינוי (יש ספר שלא גובה) / פעם ביום / פעם בשבוע (גם כשרק ההתקדמות השתנתה) */
export function backupDue(s, books, now) {
  if (!s || !s.email || s.auto === false) return false;
  const dirty = books.some((b) => b.bkD || !b.bk);
  const last = s.lastAt || 0;
  if (s.freq === 'weekly') return now - last >= 7 * DAY;
  if (s.freq === 'daily') return now - last >= DAY;
  return dirty || now - last >= DAY;             // 'change' (ברירת המחדל): מיד בשינוי, ולפחות פעם ביום להתקדמות
}
/* מה להעלות לכל ספר מקומי, מול מה שבדרייב (listing = Map של קבצים קיימים) */
export function planBook(b, entry, listing) {
  const fileOk = !!(entry && entry.file && listing.has(entry.file.id));
  const coverOk = !!(entry && entry.cover && listing.has(entry.cover.id));
  return {
    file: !fileOk ? 'create' : b.bkD ? 'update' : '',
    cover: b.cover ? (!coverOk ? 'create' : b.bkD ? 'update' : '') : (coverOk ? 'remove' : ''),
  };
}
/* רשומות בגיבוי — לתצוגה ("בטלפון" / "רק בגיבוי") */
export function backupList(manifest, local) {
  const have = new Set(local.map((b) => b.id));
  return Object.entries((manifest && manifest.books) || {}).map(([id, e]) => ({ id, title: (e.meta && e.meta.title) || '—', author: (e.meta && e.meta.author) || '',
    size: (e.file && +e.file.size) || 0, year: (e.meta && e.meta.year) || 0, coverId: e.cover && e.cover.id, coverRatio: e.coverRatio || 0, onPhone: have.has(id), up: e.up || 0 }))
    .sort((a, b) => (b.onPhone - a.onPhone) || String(a.title).localeCompare(String(b.title), 'he'));
}
export function manifestBytes(m) {
  return Object.values((m && m.books) || {}).reduce((a, e) => a + ((e.file && +e.file.size) || 0) + ((e.cover && +e.cover.size) || 0), 0);
}

/* חלון ההסכמה של Google: הקוד חוזר מ־oauth.html (אותו origin) ב־BroadcastChannel, או באחסון כגיבוי.
   משותף לספרייה ולסטודיו (v355). oauth.cancel — ביטול מהממשק ("ביטול" בזמן ההמתנה לחלון) */
export const oauth = { cancel: null };
export function waitOAuthCode(w, url, state) {
  return new Promise((resolve) => {
    let bc = null, poll = 0, to = 0;
    const done = (v) => {
      clearInterval(poll); clearTimeout(to); oauth.cancel = null;
      try { bc && bc.close(); } catch (e) {}
      window.removeEventListener('storage', onStore);
      try { localStorage.removeItem('pwa_oauth_v1'); } catch (e) {}
      resolve(v);
    };
    const take = (m) => { if (m && m.state === state) done({ code: m.code, error: m.error }); };
    const fromLs = () => { try { const m = JSON.parse(localStorage.getItem('pwa_oauth_v1') || 'null'); if (m) take(m); } catch (e) {} };
    const onStore = (e) => { if (e.key === 'pwa_oauth_v1') fromLs(); };
    try { bc = new BroadcastChannel('snb-oauth'); bc.onmessage = (e) => take(e.data); } catch (e) {}
    window.addEventListener('storage', onStore);
    poll = setInterval(fromLs, 600);
    to = setTimeout(() => done(null), 5 * 60 * 1000);
    oauth.cancel = () => done(null);
    let win = w;
    try { if (win && !win.closed) win.location.href = url; else win = window.open(url, 'snb-oauth', 'popup,width=480,height=700'); } catch (e) { win = null; }
    if (!win) done({ error: 'popup_blocked' });
  });
}
/* ---------- המנוע ---------- */
export function createBackup(env) {
  const E = Object.assign({ fetch: (...a) => fetch(...a), now: () => Date.now(), ls: typeof localStorage !== 'undefined' ? localStorage : null }, env);
  let tok = null;           // { at, exp, email }
  let busy = null;
  let clientId = '';

  /* הגדרות — לכל חשבון בנפרד (גם המפתח ב־ACCOUNT_KEYS של האפליקציה) */
  function allSettings() { try { return JSON.parse((E.ls && E.ls.getItem(LS_KEY)) || '{}') || {}; } catch (e) { return {}; } }
  function settings() { return Object.assign({ auto: true, freq: 'change', prog: true }, allSettings()[E.owner()] || {}); }
  function saveSettings(patch) {
    const all = allSettings(); all[E.owner()] = Object.assign(settings(), patch);
    try { E.ls && E.ls.setItem(LS_KEY, JSON.stringify(all)); } catch (e) {}
    return all[E.owner()];
  }
  function forget() { const all = allSettings(); delete all[E.owner()]; try { E.ls && E.ls.setItem(LS_KEY, JSON.stringify(all)); } catch (e) {} tok = null; }

  async function api(body) {
    const r = await E.libApi(Object.assign({ idToken: await E.idToken() }, body));
    let j = {}; try { j = await r.json(); } catch (e) {}
    return j || {};
  }
  async function config() {
    if (clientId) return { clientId, configured: true };
    const j = await api({ op: 'gdConfig' });
    if (j.configured && j.clientId) clientId = j.clientId;
    return { clientId, configured: !!j.configured };
  }
  /* מצב החיבור מהשרתון — במכשיר חדש ההרשאה כבר שמורה שם, אז הגיבוי "מתחבר" בלי חלון */
  async function status() {
    const j = await api({ op: 'gdStatus' });
    if (j.ok && j.connected) saveSettings({ email: j.email || settings().email || '?' });
    else if (j.ok) { const s = settings(); if (s.email) saveSettings({ email: '' }); }
    return j;
  }
  async function token() {
    if (tok && tok.exp - 90e3 > E.now()) return tok.at;
    const j = await api({ op: 'gdToken' });
    if (!j.ok) {
      if (j.error === 'revoked' || j.error === 'not_connected') { saveSettings({ email: '' }); tok = null; }
      const e = new Error(j.error || 'gd_token'); e.code = j.error; throw e;
    }
    tok = { at: j.access_token, exp: E.now() + (j.expires_in || 3600) * 1000, email: j.email };
    if (j.email && settings().email !== j.email) saveSettings({ email: j.email });
    return tok.at;
  }

  /* חלון ההסכמה של Google — נפתח בתוך הלחיצה (לפני כל await, אחרת הדפדפן חוסם), והקוד חוזר מ־oauth.html */
  function connect(hint) {
    const w = E.openWindow ? E.openWindow() : null;
    return (async () => {
      const cf = await config();
      if (!cf.configured) { if (w) try { w.close(); } catch (e) {} const e = new Error('gd_not_configured'); e.code = 'gd_not_configured'; throw e; }
      const state = Math.random().toString(36).slice(2) + E.now().toString(36);
      const redirect = E.redirectUri();
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + [['client_id', cf.clientId], ['redirect_uri', redirect], ['response_type', 'code'], ['scope', SCOPES],
        ['access_type', 'offline'], ['prompt', 'consent'], ['include_granted_scopes', 'true'], ['state', state]].concat(hint ? [['login_hint', hint]] : [])
        .map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
      const got = await E.waitCode(w, url, state);       // { code } | { error }
      if (!got || !got.code) { const e = new Error(got && got.error === 'access_denied' ? 'gd_denied' : got && got.error === 'popup_blocked' ? 'gd_popup' : 'gd_cancel'); e.code = e.message; throw e; }
      const j = await api({ op: 'gdConnect', code: got.code, redirect });
      if (!j.ok) { const e = new Error(j.error || 'gd_connect'); e.code = j.error; throw e; }
      tok = { at: j.access_token, exp: E.now() + (j.expires_in || 3600) * 1000, email: j.email };
      saveSettings({ email: j.email || '?' });
      return j.email;
    })();
  }
  async function disconnect() {
    await api({ op: 'gdDisconnect' });
    const keep = settings();
    forget();
    saveSettings({ auto: keep.auto, freq: keep.freq, prog: keep.prog });   // ההעדפות נשארות; החיבור והתיקייה — לא
    for (const b of await E.allBooksRaw()) if (b.bk && isPrivate(b, E.owner())) { delete b.bk; await E.putBook(b); }
  }

  /* ---------- Drive REST ---------- */
  async function req(method, url, body, headers, asBlob) {
    for (let attempt = 0; ; attempt++) {
      const r = await E.fetch(url, { method, body, headers: Object.assign({ Authorization: 'Bearer ' + await token() }, headers || {}) });
      if (r.status === 401 && attempt === 0) { tok = null; continue; }          // הגישה פגה באמצע — אחת חדשה
      if ((r.status === 429 || r.status >= 500) && attempt < 2) { await new Promise((ok) => setTimeout(ok, 800 * (attempt + 1))); continue; }
      if (r.status === 404) return null;
      if (r.status < 200 || r.status >= 300) { const e = new Error('drive_http_' + r.status); e.code = e.message; e.status = r.status; throw e; }
      if (asBlob) return r.blob();
      if (r.status === 204) return {};
      const tx = await r.text(); return tx ? JSON.parse(tx) : {};
    }
  }
  const J = (o) => JSON.stringify(o);
  const q = (s) => encodeURIComponent(s);
  async function findOrMake(name, prop, parent) {
    const qs = "appProperties has { key='" + prop + "' and value='1' } and trashed=false and mimeType='" + FOLDER + "'" + (parent ? " and '" + parent + "' in parents" : '');
    const j = await req('GET', API + '/files?q=' + q(qs) + '&fields=files(id,name)&pageSize=10&spaces=drive');
    if (j && j.files && j.files.length) return j.files[0].id;
    const meta = { name, mimeType: FOLDER, appProperties: { [prop]: '1' } };
    if (parent) meta.parents = [parent];
    else meta.description = 'גיבוי הספרייה הפרטית של THE SNOWBALL. הספרים כאן; הפרטים, ההתקדמות והכריכות בתיקייה "' + DATA_NAME + '".';
    return (await req('POST', API + '/files?fields=id', J(meta), { 'Content-Type': 'application/json' })).id;
  }
  async function folders(create) {
    const s = settings();
    if (s.root && s.data) {                              // בדיקה מהירה שהתיקייה עדיין קיימת (המשתמש יכול למחוק בדרייב)
      const f = await req('GET', API + '/files/' + s.root + '?fields=id,trashed');
      if (f && !f.trashed) return { root: s.root, data: s.data };
    }
    if (!create) {
      const qs = "appProperties has { key='snbRoot' and value='1' } and trashed=false";
      const j = await req('GET', API + '/files?q=' + q(qs) + '&fields=files(id)&pageSize=5&spaces=drive');
      if (!j || !j.files || !j.files.length) return null;
    }
    const root = await findOrMake(ROOT_NAME, 'snbRoot');
    const data = await findOrMake(DATA_NAME, 'snbData', root);
    saveSettings({ root, data });
    return { root, data };
  }
  async function listing(f) {
    const out = new Map(); let page = '';
    do {
      const qs = "('" + f.root + "' in parents or '" + f.data + "' in parents) and trashed=false";
      const j = await req('GET', API + '/files?q=' + q(qs) + '&fields=nextPageToken,files(id,name,size,md5Checksum,appProperties)&pageSize=1000&spaces=drive' + (page ? '&pageToken=' + page : ''));
      (j && j.files || []).forEach((x) => out.set(x.id, x));
      page = j && j.nextPageToken;
    } while (page);
    return out;
  }
  function multipart(meta, blob, type) {
    const b = 'snb' + Math.random().toString(36).slice(2);
    const body = new Blob(['--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + J(meta) + '\r\n--' + b + '\r\nContent-Type: ' + (type || 'application/octet-stream') + '\r\n\r\n', blob, '\r\n--' + b + '--']);
    return { body, ct: 'multipart/related; boundary=' + b };
  }
  /* העלאה: עד 5MB — בבקשה אחת; גדול יותר — resumable (Drive לא מקבל multipart מעל 5MB) */
  async function upload(id, meta, blob, type) {
    const fields = 'fields=id,size,md5Checksum';
    if (blob.size <= 5 * 1024 * 1024) {
      const m = multipart(meta, blob, type);
      return req(id ? 'PATCH' : 'POST', UP + '/files' + (id ? '/' + id : '') + '?uploadType=multipart&' + fields, m.body, { 'Content-Type': m.ct });
    }
    const init = await E.fetch(UP + '/files' + (id ? '/' + id : '') + '?uploadType=resumable&' + fields, { method: id ? 'PATCH' : 'POST',
      headers: { Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type || 'application/octet-stream', 'X-Upload-Content-Length': String(blob.size) }, body: J(meta) });
    const loc = init.headers && init.headers.get && init.headers.get('Location');
    if (!init.ok || !loc) { const e = new Error('drive_http_' + init.status); e.code = e.message; throw e; }
    const put = await E.fetch(loc, { method: 'PUT', body: blob, headers: { 'Content-Type': type || 'application/octet-stream' } });
    if (!put.ok) { const e = new Error('drive_http_' + put.status); e.code = e.message; throw e; }
    return put.json();
  }
  const trash = (id) => req('PATCH', API + '/files/' + id + '?fields=id', J({ trashed: true }), { 'Content-Type': 'application/json' });
  async function readManifest(f, list) {
    const mf = [...list.values()].find((x) => x.appProperties && x.appProperties.snbManifest === '1');
    if (!mf) return { id: '', m: { v: 1, books: {} } };
    const blob = await req('GET', API + '/files/' + mf.id + '?alt=media', null, null, true);
    let m = null; try { m = JSON.parse(await blob.text()); } catch (e) {}
    return { id: mf.id, m: m && m.books ? m : { v: 1, books: {} } };
  }
  async function writeManifest(f, mid, m) {
    m.v = 1; m.at = E.now();
    const blob = new Blob([J(m)], { type: 'application/json' });
    const meta = mid ? {} : { name: MANIFEST, parents: [f.data], appProperties: { snbManifest: '1' } };
    return (await upload(mid, meta, blob, 'application/json')).id;
  }

  /* ---------- גיבוי ---------- */
  /* פעולות על הגיבוי רצות בתור, אחת אחרי השנייה — הורדה שמתבקשת בזמן גיבוי אוטומטי מחכה לו (לא נבלעת) */
  let chain = Promise.resolve(), pending = 0;
  function run(fn) {
    pending++; busy = true;
    const p = chain.then(fn);
    chain = p.catch(() => {});
    return p.finally(() => { if (--pending === 0) busy = null; });
  }
  function backupNow(onProgress) {
    return run(async () => {
      const s = settings();
      const f = await folders(true);
      const list = await listing(f);
      const { id: mid, m } = await readManifest(f, list);
      const owner = E.owner();
      const mine = (await E.allBooksRaw()).filter((b) => isPrivate(b, owner) && !b.bkX);   // bkX = הוסר מהגיבוי בבקשת המשתמש
      let done = 0;
      const total = mine.length;
      for (const b0 of mine) {
        const entry = m.books[b0.id] || {};
        const p = planBook(b0, entry, list);
        if (p.file) {
          const file = await E.getFile(b0.id);
          if (file) {
            const name = safeName(b0.title, b0.author, extOf(file.name || entry.file && entry.file.name));
            const meta = p.file === 'create' ? { name, parents: [f.root], appProperties: { snbBook: '1', bid: String(b0.id).slice(0, 100) } } : { name };
            const up = await upload(p.file === 'update' ? entry.file.id : '', meta, file, file.type || 'application/epub+zip');
            entry.file = { id: up.id, name, size: up.size || file.size, md5: up.md5Checksum || '' };
          }
        } else if (entry.file) {                                    // השם השתנה (עריכה) — שינוי שם בדרייב
          const name = safeName(b0.title, b0.author, extOf(entry.file.name));
          if (name !== entry.file.name) { await req('PATCH', API + '/files/' + entry.file.id + '?fields=id', J({ name }), { 'Content-Type': 'application/json' }); entry.file.name = name; }
        }
        if (p.cover === 'remove') { await trash(entry.cover.id).catch(() => null); delete entry.cover; }
        else if (p.cover) {
          const meta = p.cover === 'create' ? { name: String(b0.id).slice(0, 80) + '.jpg', parents: [f.data], appProperties: { snbCover: '1', bid: String(b0.id).slice(0, 100) } } : {};
          const up = await upload(p.cover === 'update' ? entry.cover.id : '', meta, b0.cover, b0.cover.type || 'image/jpeg');
          entry.cover = { id: up.id, size: up.size || b0.cover.size };
        }
        if (!entry.file) { done++; continue; }
        entry.meta = { title: b0.title, author: b0.author || '', year: b0.year || 0, lang: b0.lang || '', added: b0.added || 0 };
        entry.edit = b0.edit || null;
        entry.coverCustom = b0.coverCustom ? 1 : 0;
        entry.coverRatio = b0.coverRatio || 0;
        if (s.prog !== false) { entry.prog = { cfi: b0.cfi || '', fraction: b0.fraction || 0, done: !!b0.done, lastRead: b0.lastRead || 0 }; entry.ann = b0.ann || []; }
        else { delete entry.prog; delete entry.ann; }
        entry.up = E.now();
        m.books[b0.id] = entry;
        const cur = (await E.allBooksRaw()).find((x) => x.id === b0.id);   // רשומה עדכנית — לא לדרוס התקדמות שנשמרה בינתיים
        if (cur) { cur.bk = { f: entry.file.id, at: entry.up }; if ((cur.bkD || 0) <= (b0.bkD || 0)) delete cur.bkD; await E.putBook(cur); }
        done++;
        if (onProgress) onProgress(done, total);
      }
      for (const [id, e] of Object.entries(m.books)) if (!e.file || !list.has(e.file.id)) {   // נמחק ידנית מהדרייב ולא בטלפון
        if (!mine.some((b) => b.id === id)) delete m.books[id];
      }
      await writeManifest(f, mid, m);
      const bytes = manifestBytes(m);
      return saveSettings({ lastAt: E.now(), count: Object.keys(m.books).length, bytes, err: '' });
    });
  }
  /* הגיבוי כפי שהוא בדרייב (לרשימה, לכרטיס השחזור) */
  async function overview() {
    const f = await folders(false);
    if (!f) return { exists: false, books: [], bytes: 0, at: 0 };
    const list = await listing(f);
    const { m } = await readManifest(f, list);
    for (const [id, e] of Object.entries(m.books)) if (!e.file || !list.has(e.file.id)) delete m.books[id];
    return { exists: true, manifest: m, books: backupList(m, (await E.allBooksRaw()).filter((b) => isPrivate(b, E.owner()))), bytes: manifestBytes(m), at: m.at || 0, folder: f.root };
  }
  async function coverBlob(id) { return id ? req('GET', API + '/files/' + id + '?alt=media', null, null, true) : null; }
  /* שחזור: הקובץ → ייבוא רגיל (הפרטים מהקובץ), ואז מעליו: הפרטים שנערכו, הכריכה, ההתקדמות וההדגשות */
  function restore(ids, onProgress) {
    return run(async () => {
      const f = await folders(false);
      if (!f) return 0;
      const list = await listing(f);
      const { m } = await readManifest(f, list);
      const local = new Set((await E.allBooksRaw()).filter((b) => isPrivate(b, E.owner())).map((b) => b.id));
      const want = Object.entries(m.books).filter(([id, e]) => e.file && list.has(e.file.id) && (ids ? ids.includes(id) : !local.has(id)));
      let n = 0;
      for (const [id, e] of want) {
        try {
          const blob = await req('GET', API + '/files/' + e.file.id + '?alt=media', null, null, true);
          if (!blob) continue;
          const file = typeof File === 'function' ? new File([blob], e.file.name || 'book.epub', { type: blob.type || 'application/epub+zip' }) : blob;
          const got = [];
          await E.importFiles([file], null, got);
          const rid = got[0] || id;
          const cur = (await E.allBooksRaw()).find((x) => x.id === rid);
          if (cur) {
            if (e.edit) { cur.edit = e.edit; E.applyEdit(cur, e.edit); }
            if (e.coverCustom && e.cover) { const cb = await coverBlob(e.cover.id).catch(() => null); if (cb) Object.assign(cur, { cover: cb, coverRatio: e.coverRatio || cur.coverRatio, coverCustom: 1, coverV: 1 }); }
            if (e.prog && (e.prog.lastRead || 0) > (cur.lastRead || 0)) Object.assign(cur, e.prog);
            if (e.ann && e.ann.length) cur.ann = E.mergeAnn ? E.mergeAnn(cur.ann || [], e.ann) : e.ann;
            cur.bk = { f: e.file.id, at: e.up || 0 }; delete cur.bkD;
            await E.putBook(cur);
          }
          n++;
        } catch (er) { if (er && er.code === 'revoked') throw er; }
        if (onProgress) onProgress(n, want.length);
      }
      return n;
    });
  }
  /* מחיקה מהגיבוי בלבד (הספר בטלפון — אם יש — נשאר, ויגובה שוב רק אם יסומן כשינוי) */
  function removeFromBackup(ids) {
    return run(async () => {
      const f = await folders(false);
      if (!f) return 0;
      const list = await listing(f);
      const { id: mid, m } = await readManifest(f, list);
      let n = 0;
      for (const id of ids) {
        const e = m.books[id]; if (!e) continue;
        if (e.file) await trash(e.file.id).catch(() => null);
        if (e.cover) await trash(e.cover.id).catch(() => null);
        delete m.books[id]; n++;
        const cur = (await E.allBooksRaw()).find((x) => x.id === id);
        if (cur && cur.bk) { delete cur.bk; cur.bkX = 1; await E.putBook(cur); }   // bkX: לא לגבות שוב אוטומטית
      }
      await writeManifest(f, mid, m);
      saveSettings({ count: Object.keys(m.books).length, bytes: manifestBytes(m) });
      return n;
    });
  }
  /* מחיקת כל הגיבוי — התיקייה עוברת לפח של Drive (30 יום לשחזור משם) */
  function deleteAll() {
    return run(async () => {
      const f = await folders(false);
      if (f) await trash(f.root);
      saveSettings({ root: '', data: '', lastAt: 0, count: 0, bytes: 0 });
      for (const b of await E.allBooksRaw()) if (b.bk && isPrivate(b, E.owner())) { delete b.bk; await E.putBook(b); }
      return true;
    });
  }
  async function quota() {
    const j = await req('GET', API + '/about?fields=storageQuota,user(emailAddress)');
    const sq = (j && j.storageQuota) || {};
    return { limit: +sq.limit || 0, usage: +sq.usage || 0, email: j && j.user && j.user.emailAddress || '' };
  }
  /* גיבוי אוטומטי — שקט; תקלה נרשמת ונראית במסך הגיבוי, בלי הודעות קופצות */
  let autoT = 0;
  function schedule(delay) {
    clearTimeout(autoT);
    autoT = setTimeout(async () => {
      const s = settings();
      if (!s.email || s.auto === false || busy) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      const mine = (await E.allBooksRaw()).filter((b) => isPrivate(b, E.owner()) && !b.bkX);
      if (!backupDue(s, mine, E.now())) return;
      try { await backupNow(); if (E.onAuto) E.onAuto(); } catch (e) { saveSettings({ err: String(e.code || e.message || 'failed').slice(0, 40), errAt: E.now() }); if (E.onAuto) E.onAuto(); }
    }, delay == null ? 15000 : delay);
  }
  return { settings, saveSettings, config, status, token, connect, disconnect, backupNow, overview, restore, removeFromBackup, deleteAll, quota, schedule, coverBlob,
    busy: () => !!busy, _folders: folders, _listing: listing };
}
