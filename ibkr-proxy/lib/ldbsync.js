'use strict';
/* 5/11/2026 — שלב 3 בתוכנית העצמאות מ־Firebase: מה שמסביב למסד שלנו (lib/ldb.js), בשרת שלנו בלבד (server.js).
   1. wrapFetch — השכבה האחת: בקשה ל־Firestore לאוסף שכבר במסד שלנו נענית מכאן. כל השאר — ל־Firestore כמו היום.
   2. העותק (mirror) — כל דקה: המצב האחרון של כל מסמך שהשתנה, במנות (documents:batchWrite, עד 450). כל מסמך בעותק מקבל
      _mt = מתי נכתב אצלנו (לשחזור). תקרה יומית של כתיבות (MIRROR_DAY) — מעליה העותק מחכה למחר; שום דבר לא נופל.
   3. האיחוד (merge) — אחרי הודעה "שיניתי" (lib/ldbping.js, 8/11/2026), בעלייה ופעם בשעה (רשת ביטחון): מה ש־Vercel כתב (יומן snbChg, lib/ldbchg.js). "השינוי האחרון גובר" לכל מסמך:
      מסמך שלא השתנה אצלנו מאז העותק — מקבל את הגרסה של Firestore; מסמך שהשתנה אצלנו ועוד לא נשלח — אם Vercel אחרון,
      השדות ש־Vercel כתב נכנסים (או כל המסמך, אם Vercel החליף אותו), ואם אנחנו אחרונים — שלנו נשאר וידרוס בעותק הבא.
   4. הייבוא — בפעם הראשונה: כל אוסף של השרתון נקרא מ־Firestore בעמודים של 300, בתקציב יומי (IMPORT_DAY קריאות). עד
      שאוסף גמור הוא ממשיך ל־Firestore, וכתיבה שעברה לשם מעדכנת גם את המסד (לפי updateTime), כך שלא הולך לאיבוד כלום.
   5. תמונת מצב — כל 10 דקות כשהיה שינוי: VACUUM INTO, דחיסה, הצפנה (AES-256-GCM, מפתח נגזר מהכספת) ← R2
      (ldb/<פרויקט>/snap.bin). שרת חדש / נפח שנמחק: משחזרים ממנה, ואז משלימים מ־Firestore את מה שנכתב אחריה (_mt).
   הדלקה: רק כשיש תיקייה קבועה שאפשר לכתוב בה (SNB_LDB_DIR, ברירת מחדל /data — נפח appdb ב־infra/compose.yaml).
   בלי נפח כזה — כבוי, והכל כמו קודם. כיבוי יזום: SNB_LDB=off. מצב: GET /api/session → ldb. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const C = require('./ldbchg');
const L = require('./ldb');
const FSM = require('./fsmeter');
const SF = require('./sysflags');

/* אבטחה: הסטטוס חשוף ב־/api/session בלי הרשאה — שגיאה רק כקוד קצר, בלי נתיבים, כתובות או תוכן */
const errOf = (e) => String((e && (e.code || e.message)) || e).replace(/(https?:)?\/[^\s'"]*/g, '').replace(/[^A-Za-z0-9_:. -]/g, '').trim().slice(0, 60) || 'err';
const MIRROR_MS = 60e3, MIRROR_SLOW_MS = 5 * 60e3, MERGE_MS = 3600e3, IMPORT_MS = 4e3, SNAP_MS = 10 * 60e3, SNAP_MEM_MS = 3 * 60e3;
const MIRROR_DAY = 12000, MIRROR_SLOW = 8000;    // כתיבות לעותק ביום (מכסת Firestore: 20 אלף)
const IMPORT_DAY = 8000;                         // קריאות ביום לייבוא (מכסה: 50 אלף)
/* 8/11/2026: איחוד לפי אירוע (lib/ldbping.js). KICK_MS — ריכוך: כל ההודעות שמגיעות בתוכו = איחוד אחד.
   UP2_MS — איחוד שני אחרי עלייה: מכסה כתיבה של Vercel שקרתה כשהשולח עוד חיכה אחרי תקלה (OPEN_MS) */
const KICK_MS = 3e3, UP2_MS = 90e3;
const BATCH = 450, BATCH_BYTES = 6e6, CHG_PAGE = 200, OVERLAP_MS = 6 * 60e3, TOMB_KEEP_MS = 3 * 864e5;
/* הסדר של הייבוא: הקטנים והחמים קודם (הקריאות של הלולאות), studioJobs (הגדול) אחריהם, ושאר האוספים לפי הא״ב */
const PRIO = ['sysCfg', 'studioServers', 'studioStats', 'studioOps', 'studioUp', 'studioVault', 'studioJobs'];
const SNAP_MAGIC = Buffer.from('SNBLDB1');
const FS_HOST = 'https://firestore.googleapis.com/';

const dayLA = (now) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const prio = (c) => { const i = PRIO.indexOf(c); return i < 0 ? PRIO.length : i; };
/* האוסף של שאילתה פשוטה (אוסף אחד, לא allDescendants) — '' אם אין */
const queryCol = (b) => {
  const sq = b && (b.structuredQuery || (b.structuredAggregationQuery && b.structuredAggregationQuery.structuredQuery));
  const f = sq && Array.isArray(sq.from) && sq.from.length === 1 ? sq.from[0] : null;
  return f && !f.allDescendants && typeof f.collectionId === 'string' ? f.collectionId : '';
};

/* ---------- תמונת מצב: הצפנה ---------- */
function sealSnap(key, header, body) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(SNAP_MAGIC);
  const pt = Buffer.concat([Buffer.from(JSON.stringify(header) + '\n'), zlib.gzipSync(body, { level: 6 })]);
  const ct = Buffer.concat([c.update(pt), c.final()]);
  return Buffer.concat([SNAP_MAGIC, iv, c.getAuthTag(), ct]);
}
function openSnap(key, buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 36 || !buf.subarray(0, 7).equals(SNAP_MAGIC)) return null;
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(7, 19));
    d.setAAD(SNAP_MAGIC);
    d.setAuthTag(buf.subarray(19, 35));
    const pt = Buffer.concat([d.update(buf.subarray(35)), d.final()]);
    const nl = pt.indexOf(10);
    return { header: JSON.parse(pt.subarray(0, nl).toString('utf8')), body: zlib.gunzipSync(pt.subarray(nl + 1)) };
  } catch (e) { return null; }
}

let cur = null;   // הבקר הפעיל (ל־status)

/* o = { fetch (ה־fetch האמיתי, עם המונה), env, now, token(fetch) → טוקן, r2: { put(key, buf), get(key) } | null, key: Buffer(32) | null,
         dir, timers:false (בבדיקות — מפעילים ביד), every(fn, ms) / later(fn, ms) (בדיקות — שעון מדומה) } */
function create(o = {}) {
  const env = o.env || process.env;
  const now = o.now || (() => Date.now());
  const inner = o.fetch;
  const project = String(o.project || env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e');
  const dir = o.dir || env.SNB_LDB_DIR || '/data';
  const file = o.file || path.join(dir, 'snb.db');
  const snapKey = 'ldb/' + project + '/snap.bin';
  const BASE = FS_HOST + 'v1/projects/' + project + '/databases/(default)/documents';
  const token = o.token || ((f) => require('./gauth').datastoreToken(f));
  const own = o.own || ((t) => require('./gauth').ownToken(t));
  const authOf = (init) => {
    const h = (init && init.headers) || {};
    const v = typeof h.get === 'function' ? h.get('authorization') : (h.Authorization || h.authorization);
    const m = /^Bearer (\S+)$/.exec(String(v || ''));
    return m ? m[1] : '';
  };
  const S = { on: false, why: '', at: now(), mirror: { at: 0, n: 0, err: '', bad: 0, until: 0, fails: 0 }, merge: { at: 0, n: 0, err: '', runs: 0, kicks: 0 },
    imp: { col: '', err: '' }, snap: { at: 0, err: '', gen: -1, mb: 0 }, restored: '', day: '', wDay: 0, rDay: 0 };
  let store = null, readyP = null, timers = [], refetch = new Set(), seenChg = new Map(), busy = {}, kickT = null, kickPend = false;
  const later = o.later || ((fn, ms) => { const t = setTimeout(fn, ms); if (t.unref) t.unref(); return t; });

  const call = async (method, url, body) => {
    const tk = await token(inner);
    const r = await inner(url, { method, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json(); } catch (e) {}
    return { status: r.status, j };
  };
  const tagged = (tag, fn) => FSM.run('ldb:' + tag, fn);
  const roll = () => { const d = dayLA(now()); if (d !== S.day) { S.day = d; S.wDay = 0; S.rDay = 0; } };
  const once = (k, fn) => async () => { if (busy[k]) return; busy[k] = true; try { await fn(); } finally { busy[k] = false; } };

  /* ---------- פתיחה (ושחזור, אם אין קובץ) ---------- */
  async function open() {
    if (env.SNB_LDB === 'off') { S.why = 'off'; return false; }
    /* קובץ בנפח קבוע (/data) — ואם אין (שרת שהנפח עוד לא הותקן בו, 5/11/2026): בזיכרון, ותמונת המצב ב־R2 היא ההתמדה —
       בעלייה משחזרים ממנה ומשלימים מ־Firestore (_mt), תמונה כל 3 דק׳ ובכיבוי מסודר. בלי R2 — כבוי. SNB_LDB_MEM=off — רק קובץ */
    S.mode = 'file';
    try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.W_OK); } catch (e) {
      if (o.r2 && o.key && env.SNB_LDB_MEM !== 'off') S.mode = 'mem'; else { S.why = 'no_dir'; return false; }
    }
    let sqlite;
    try { sqlite = o.sqlite || require('node:sqlite'); } catch (e) { S.why = 'no_sqlite'; return false; }
    const fresh = S.mode === 'mem' || !fs.existsSync(file);
    store = L.createStore({ file: S.mode === 'mem' ? ':memory:' : file, project, sqlite, now });
    let snapAt = 0;
    if (fresh && o.r2 && o.key) {
      let buf;
      // תקלה בקריאה (לא "אין עדיין") — לא עולים ריק: תמונה ריקה הייתה דורסת את הטובה. ננסה שוב בעוד דקה (start)
      try { buf = await o.r2.get(snapKey); } catch (e) { store.close(); store = null; S.why = 'restore_err'; S.restored = 'err:' + errOf(e); return false; }
      const s = buf && openSnap(o.key, buf);
      if (buf && !s) S.restored = 'bad_snap';
      if (s && s.header && s.header.project === project && s.header.fmt === 'json') {
        store.load(JSON.parse(s.body.toString('utf8')));
        snapAt = +s.header.at || 0; S.restored = new Date(snapAt).toISOString(); S.snap.gen = store.stats.gen;
      }
    }
    const p = store.kv('project');
    if (p && p !== project) { store.close(); store = null; S.why = 'project_mismatch'; return false; }
    if (!p) store.kv('project', project);
    // מההתחלה: רשומות ש־Vercel כתב ביומן לפני ההדלקה (הקוד ב־Vercel נפרס לפני שהנפח הותקן) — מטופלות ונמחקות באיחוד הראשון
    if (store.kv('chgSince') == null) store.kv('chgSince', 0);
    S.on = true; S.why = '';
    C.setThruProbe(thruProbe);
    if (snapAt) await tagged('restore', () => catchUp(snapAt)).catch((e) => { S.restored += ' catchup_err:' + errOf(e); });
    return true;
  }
  /* שלב 4: הדגל ud_srv (sysCfg/main.flOn) מהמסד עצמו — בלי קריאה ל־Firestore. מטמון 5 שנ׳. כבוי אחרי שהיה דולק —
     האוספים של הטלפון יוצאים מהמסד (dropCol), כדי שבהדלקה הבאה ייובאו מחדש ולא יוגש עותק ישן */
  let probeAt = 0, probeV = false;
  function thruProbe() {
    if (!store) return false;
    const t = now();
    if (t - probeAt < 5000) return probeV;
    probeAt = t;
    const d = store.get('sysCfg', 'main');
    const sv = (k) => (d && d.f && d.f[k] && d.f[k].stringValue) || '';
    // 6/11/2026: דולק כברירת מחדל (בקשת המשתמש — כמה שפחות פעולות שלו); כיבוי: מרכז הניהול ← דגלים (flOff), או SNB_UDATA=off
    const v = env.SNB_UDATA !== 'off' && SF.flagOn({ flOn: sv('flOn'), flOff: sv('flOff') }, 'ud_srv');
    if (probeV && !v && env.SNB_UDATA !== 'on') for (const c of C.CLIENT) if (store.cols.has(c)) store.dropCol(c);
    if (v) for (const c of C.CLIENT) if (!store.cols.has(c)) store.setCol(c, { st: 'imp' });   // הודלק — לייבוא
    probeV = v;
    return v;
  }
  /* אחרי שחזור: מה שנשלח לעותק אחרי תמונת המצב (_mt) — חוזר למסד */
  async function catchUp(snapAt) {
    for (const [c, x] of store.cols) {
      if (x.st !== 'ready') continue;
      const r = await call('POST', BASE + ':runQuery', { structuredQuery: { from: [{ collectionId: c }],
        where: { fieldFilter: { field: { fieldPath: '_mt' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(Math.round(snapAt - 10 * 60e3)) } } }, limit: 2000 } });
      if (r.status !== 200) throw new Error('fs_http_' + r.status);
      for (const x2 of Array.isArray(r.j) ? r.j : []) {
        const d = x2 && x2.document; if (!d) continue;
        const id = String(d.name).split('/').pop(), mt = +((d.fields && d.fields._mt && d.fields._mt.integerValue) || 0);
        const rec = store.rec(c, id);
        if (!rec || (rec.lw || 0) < mt) store.putRemote(c, id, d, { lw: mt });
      }
    }
  }

  /* ---------- 1. השכבה: fetch ---------- */
  function wrapFetch(f) {
    const w = async (input, init) => {
      const url = String(typeof input === 'string' ? input : (input && input.url) || '');
      if (!url.startsWith(FS_HOST)) return f(input, init);
      if (readyP) await readyP;
      if (!store) return f(input, init);
      // אבטחה: עונים רק לבקשה עם טוקן שהתהליך הנפיק (lib/gauth.js ownToken). בלי — ממשיכה ל־Firestore, שבודק אותה כמו תמיד:
      // כך המסד לא נותן יותר ממה ש־Firestore היה נותן, גם אם כתובת של Firestore מגיעה מבחוץ
      if (!own(authOf(init))) { store.stats.passWhy.auth = (store.stats.passWhy.auth || 0) + 1; return f(input, init); }
      const method = String((init && init.method) || 'GET').toUpperCase();
      let body = null;
      if (method !== 'GET' && init && typeof init.body === 'string') { try { body = JSON.parse(init.body); } catch (e) { return f(input, init); } }
      // שלב 4: כתיבה לאוסף של הטלפון (מצב "דרך") — קודם ל־Firestore, ומשם למסד (learn). רק כש־Firestore לא זמין — מקומית
      // (dirty, והעותק ישלח אחר כך). כך כתיבה ישירה של הטלפון ב־Firestore לא נדרסת בעותק של מסמך שלם
      if (method !== 'GET' && C.changesOf(method, url, body).list.some((ch) => C.thru(ch.col))) {
        let res = null;
        try { res = await f(input, init); } catch (e) { res = null; }
        if (res && res.status !== 429 && res.status < 500) { try { await learn(method, url, body, res); } catch (e) {} return res; }
        S.thruLocal = (S.thruLocal || 0) + 1;
        let lr = null;
        try { lr = store.handle(method, url, body); } catch (e) { lr = null; }
        if (lr) return new Response(JSON.stringify(lr.j), { status: lr.status, headers: { 'content-type': 'application/json; charset=UTF-8' } });
        if (res) return res;
        throw new Error('fs_down');
      }
      let r = null;
      try { r = store.handle(method, url, body); } catch (e) { r = null; }
      if (r) {
        if (r.reads) FSM.addLoc(r.reads);
        return new Response(JSON.stringify(r.j), { status: r.status, headers: { 'content-type': 'application/json; charset=UTF-8' } });
      }
      const res = await f(input, init);
      try { await learn(method, url, body, res); } catch (e) {}
      return res;
    };
    w._ldb = true;
    return w;
  }
  /* בקשה שעברה ל־Firestore: אוסף חדש — לייבוא; כתיבה מוצלחת לאוסף של השרתון — גם למסד (לפי updateTime) */
  async function learn(method, url, body, res) {
    const u = C.parseUrl(url);
    if (!u || u.project !== project) return;
    // 6/11/2026: שאילתה (runQuery/runAggregationQuery) — הכתובת בלי אוסף, והאוסף ב־from. בלי זה אוסף שנגיעים בו רק
    // בשאילתות ושריק ב־Firestore (listCollectionIds לא מחזיר אוסף ריק) לא נכנס למסד אף פעם — studioProbe בניסוי, כל 20 שנ׳
    const col = u.path.length ? u.path[0] : queryCol(body);
    if (col && C.serverCol(col) && !store.cols.has(col)) store.setCol(col, { st: 'imp' });
    if (!res || res.status !== 200 || method === 'GET') return;
    const list = C.changesOf(method, url, body).list.filter((ch) => C.serverCol(ch.col));   // היומן רושם גם את אוספי הטלפון — כאן רק מה שבמסד
    if (!list.length) return;
    if (method === 'PATCH') {
      const d = await res.clone().json();
      const ch = list[0];
      store.putRemote(ch.col, ch.id, d, { ifNewer: !store.ready(ch.col), lw: now() });
      return;
    }
    for (const ch of list) {
      if (!store.cols.has(ch.col)) store.setCol(ch.col, { st: 'imp' });
      if (ch.d) store.putTomb(ch.col, ch.id, { ifNewer: !store.ready(ch.col) });
      else refetch.add(ch.col + '/' + ch.id);   // commit עם טרנספורם — קוראים את התוצאה
    }
  }

  /* ---------- 2. העותק ---------- */
  async function mirror() {
    if (!store) return;
    roll();
    const t = now();
    if (t < S.mirror.until) return;
    if (S.wDay >= MIRROR_DAY) { S.mirror.err = 'day_cap'; return; }
    if (S.wDay >= MIRROR_SLOW && t - S.mirror.at < MIRROR_SLOW_MS) return;
    const rows = [];
    let bytes = 0;
    for (const x of store.dirtyRows(BATCH)) {
      const sz = x.r.f ? JSON.stringify(x.r.f).length : 50;
      if (rows.length && bytes + sz > BATCH_BYTES) break;
      rows.push(x); bytes += sz;
    }
    if (!rows.length) return;
    const writes = rows.map(({ col, id, r }) => (r.del ? { delete: C.docName(project, col, id) }
      : { update: { name: C.docName(project, col, id), fields: Object.assign({}, r.f, { _mt: { integerValue: String(r.lw || 0) } }) } }));
    let res;
    try { res = await tagged('mirror', () => call('POST', BASE + ':batchWrite', { writes })); } catch (e) { res = { status: 0 }; }
    if (res.status !== 200) {
      S.mirror.fails++; S.mirror.err = 'http_' + res.status;
      S.mirror.until = now() + Math.min(15 * 60e3, 30e3 * 2 ** Math.min(5, S.mirror.fails));
      return;
    }
    S.mirror.fails = 0; S.mirror.err = ''; S.mirror.until = 0;
    const stt = (res.j && Array.isArray(res.j.status)) ? res.j.status : [];
    let ok = 0;
    rows.forEach((x, i) => {
      const code = stt[i] && stt[i].code ? stt[i].code : 0;
      if (!code) { store.markClean(x.col, x.id, x.r.lw); ok++; }
      else if (code === 3) { store.markClean(x.col, x.id, x.r.lw); S.mirror.bad++; }   // INVALID_ARGUMENT (מסמך גדול מדי וכו׳) — לא ינסה לנצח
    });
    S.wDay += writes.length; S.mirror.n += ok; S.mirror.at = now();
    if (rows.length === BATCH) setTimeout(() => runMirror().catch(() => {}), 1000).unref?.();
  }

  /* ---------- 3. האיחוד מול Vercel ---------- */
  async function merge() {
    if (!store) return;
    roll();
    const since = +store.kv('chgSince') || 0;
    const r = await tagged('merge', () => call('POST', BASE + ':runQuery', { structuredQuery: { from: [{ collectionId: C.CHG }],
      where: { fieldFilter: { field: { fieldPath: 't' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(Math.round(since - OVERLAP_MS)) } } },
      orderBy: [{ field: { fieldPath: 't' }, direction: 'ASCENDING' }], limit: CHG_PAGE } }));
    S.merge.runs++;
    if (r.status !== 200) { S.merge.err = 'http_' + r.status; return; }
    const got = (Array.isArray(r.j) ? r.j : []).filter((x) => x && x.document);
    S.rDay += Math.max(1, got.length);
    let maxT = since;
    const done = [];
    for (const x of got) {
      const d = x.document, f = d.fields || {};
      const c = f.c && f.c.stringValue, id = f.i && f.i.stringValue, t = +(f.t && f.t.integerValue || 0);
      if (seenChg.get(d.name) === d.updateTime) continue;
      if (c && id && C.serverCol(c) && store.cols.has(c)) await applyChg(c, id, t, !!(f.d && f.d.booleanValue),
        ((f.m && f.m.arrayValue && f.m.arrayValue.values) || []).map((v) => v.stringValue), +(f.f && f.f.integerValue || 0) > 0);
      seenChg.set(d.name, d.updateTime);
      done.push({ delete: d.name, currentDocument: { updateTime: d.updateTime } });   // רק אם Vercel לא כתב שוב בינתיים
      if (t > maxT) maxT = Math.min(t, now());   // שלב 4: רשומה של הטלפון — השעון שלו; הסמן לא קופץ קדימה
      S.merge.n++;
    }
    if (seenChg.size > 2000) seenChg = new Map([...seenChg].slice(-500));
    if (done.length) await tagged('merge', () => call('POST', BASE + ':batchWrite', { writes: done })).then(() => { S.wDay += done.length; }).catch(() => {});
    store.kv('chgSince', maxT);
    S.merge.at = now(); S.merge.err = '';
    if (got.length >= CHG_PAGE) return merge();
  }
  async function applyChg(c, id, t, del, m, full) {
    const rec = store.rec(c, id);
    const ready = store.ready(c);
    if (rec && rec.dirty && (rec.lw || 0) > t) return;   // השינוי שלנו אחרון — נשאר, והעותק ידרוס
    let doc = null;
    if (!del) {
      const g = await call('GET', BASE + '/' + c + '/' + encodeURIComponent(id));
      S.rDay++;
      if (g.status === 200) doc = g.j;
      else if (g.status !== 404) throw new Error('fs_http_' + g.status);
    }
    if (!doc) { store.putTomb(c, id, { lw: t }); return; }
    if (!ready) { store.putRemote(c, id, doc, { ifNewer: true }); return; }
    if (rec && rec.dirty && !rec.del && !full && m.length) { store.mergeFields(c, id, doc.fields || {}, m); return; }   // Vercel אחרון, ושלנו עוד לא נשלח — רק השדות שלו
    store.putRemote(c, id, doc, { lw: t });
  }

  /* שלב 4 (lib/udata.js): הטלפון כתב ישירות ב־Firestore כשהשרת לא היה זמין — קוראים את המסמך משם ומאחדים
     ("השינוי האחרון גובר": מסמך מקומי שעוד לא נשלח ונכתב אחרי Firestore — נשאר). קריאה אחת */
  async function refresh(c, id) {
    if (!store || !C.serverCol(c) || !store.ready(c) || !/^[A-Za-z0-9_-]{1,128}$/.test(String(id || ''))) return false;
    const g = await tagged('udata', () => call('GET', BASE + '/' + c + '/' + encodeURIComponent(id)));
    S.rDay++;
    const rec = store.rec(c, id);
    if (g.status === 404) { if (!rec || !rec.dirty) store.putTomb(c, id, {}); return true; }
    if (g.status !== 200) throw new Error('fs_http_' + g.status);
    const t = Math.floor(L.parseUt(g.j.updateTime) / 1000);
    if (rec && rec.dirty && (rec.lw || 0) > t) return true;
    store.putRemote(c, id, g.j, { lw: t });
    return true;
  }

  /* ---------- 4. הייבוא ---------- */
  async function importTick() {
    if (!store) return;
    roll();
    if (S.rDay >= IMPORT_DAY) { S.imp.err = 'day_cap'; return; }
    if (!store.kv('colsListed')) {
      const r = await tagged('import', () => call('POST', BASE + ':listCollectionIds', { pageSize: 300 }));
      if (r.status !== 200) { S.imp.err = 'list_http_' + r.status; return; }
      for (const c of (r.j && r.j.collectionIds) || []) if (C.serverCol(c) && !store.cols.has(c)) store.setCol(c, { st: 'imp' });
      store.kv('colsListed', now());
      S.rDay++;
    }
    for (const k of [...refetch].slice(0, 20)) {
      refetch.delete(k);
      const i = k.indexOf('/'), c = k.slice(0, i), id = k.slice(i + 1);
      const g = await tagged('import', () => call('GET', BASE + '/' + c + '/' + encodeURIComponent(id)));
      S.rDay++;
      if (g.status === 200) store.putRemote(c, id, g.j, { ifNewer: !store.ready(c) });
      else if (g.status === 404) store.putTomb(c, id, { ifNewer: true });
    }
    const todo = [...store.cols.entries()].filter(([c, x]) => x.st !== 'ready' && C.serverCol(c)).sort((a, b) => prio(a[0]) - prio(b[0]) || (a[0] < b[0] ? -1 : 1));
    if (!todo.length) { S.imp.col = ''; return; }
    const [c, x] = todo[0];
    S.imp.col = c;
    const r = await tagged('import', () => call('GET', BASE + '/' + c + '?pageSize=300' + (x.pt ? '&pageToken=' + encodeURIComponent(x.pt) : '')));
    if (r.status !== 200) { S.imp.err = 'http_' + r.status; return; }
    const docs = (r.j && r.j.documents) || [];
    S.rDay += Math.max(1, docs.length);
    for (const d of docs) store.putRemote(c, String(d.name).split('/').pop(), d, { ifNewer: true });
    const pt = r.j && r.j.nextPageToken ? String(r.j.nextPageToken) : '';
    store.setCol(c, pt ? { pt, n: x.n + docs.length } : { st: 'ready', pt: '', n: x.n + docs.length, at: now() });
    S.imp.err = '';
  }

  /* ---------- 5. תמונת מצב ל־R2 ---------- */
  async function snapshot(force) {
    if (!store || !o.r2 || !o.key) return;
    const gen = store.stats.gen;
    if (!force && gen === S.snap.gen) return;
    try {
      const at = now();
      const buf = Buffer.from(JSON.stringify(store.dump()), 'utf8');
      const blob = sealSnap(o.key, { v: 2, fmt: 'json', project, at }, buf);
      await o.r2.put(snapKey, blob);
      S.snap = { at, err: '', gen, mb: Math.round(blob.length / 1e5) / 10 };
    } catch (e) { S.snap.err = errOf(e); }
  }

  const runMirror = once('mirror', mirror), runMerge = once('merge', () => merge().catch((e) => { S.merge.err = errOf(e); }));
  /* הודעה "שיניתי" (lib/ldbping.js): איחוד בעוד KICK_MS. עוד הודעות בינתיים — אותו איחוד. הודעה בזמן איחוד — עוד אחד אחריו */
  function kick() {
    if (!store) return false;
    kickPend = true;
    if (kickT) return true;
    kickT = later(async () => {
      kickT = null;
      if (!store) return;
      if (busy.merge) { kick(); return; }
      kickPend = false;
      S.merge.kicks++;
      await runMerge();
      if (kickPend) kick();
    }, KICK_MS);
    return true;
  }
  const runImport = once('import', () => importTick().catch((e) => { S.imp.err = errOf(e); }));
  const runSnap = once('snap', () => snapshot());
  function start() {
    readyP = open().catch((e) => { S.why = 'open_err:' + errOf(e); store = null; return false; })
      .then((ok) => {
        readyP = null;
        if (ok && o.timers !== false) schedule();
        else if (S.why === 'restore_err' && o.timers !== false) { const t = setTimeout(start, 60e3); t.unref(); timers.push(t); }
        return ok;
      });
    return readyP;
  }
  function schedule() {
    const every = o.every ? (fn, ms) => o.every(() => fn().catch(() => {}), ms)   // בדיקות: שעון מדומה
      : (fn, ms) => { const iv = setInterval(() => fn().catch(() => {}), ms); iv.unref(); timers.push(iv); };
    every(runMirror, MIRROR_MS);
    every(runMerge, MERGE_MS);
    every(runImport, IMPORT_MS);
    every(runSnap, S.mode === 'mem' ? SNAP_MEM_MS : SNAP_MS);
    every(async () => { if (store) store.purgeTombs(TOMB_KEEP_MS); }, 6 * 3600e3);
    later(() => runMerge().catch(() => {}), 5e3);
    later(() => runMerge().catch(() => {}), UP2_MS);
  }
  /* כיבוי מסודר (SIGTERM): מה שעוד לא נשלח לעותק — עכשיו */
  /* כיבוי מסודר (SIGTERM, כל פריסה): מה שעוד לא נשלח — לעותק, ואז תמונת מצב (במצב mem — זו ההתמדה) */
  async function flush() { try { await mirror(); } catch (e) {} try { await snapshot(); } catch (e) {} }
  function status() {
    if (!store) return { on: false, why: S.why };
    const i = store.info(), s = store.stats;
    const imp = [...store.cols.entries()].filter(([, x]) => x.st !== 'ready').map(([c, x]) => c + ':' + x.n);
    return { on: true, mode: S.mode, docs: i.docs, mb: i.mb, cols: i.cols, ready: i.ready, imp, impErr: S.imp.err || undefined, q: i.dirty,
      loc: s.loc, locReads: s.locReads, w: s.w, pass: s.pass, passWhy: s.passWhy, day: S.day, wDay: S.wDay, rDay: S.rDay,
      mirror: { at: S.mirror.at ? new Date(S.mirror.at).toISOString() : '', n: S.mirror.n, err: S.mirror.err || undefined, bad: S.mirror.bad || undefined },
      merge: { at: S.merge.at ? new Date(S.merge.at).toISOString() : '', n: S.merge.n, runs: S.merge.runs, kicks: S.merge.kicks, err: S.merge.err || undefined },
      ping: require('./ldbping').view(),   // 8/11/2026: הודעות "שיניתי" — כמה התקבלו וכמה נדחו (מונים בלבד)
      snap: { at: S.snap.at ? new Date(S.snap.at).toISOString() : '', mb: S.snap.mb, err: S.snap.err || undefined }, restored: S.restored || undefined,
      thru: C.thruOn() ? { local: S.thruLocal || 0 } : undefined };
  }
  const ctl = { start, wrapFetch, mirror, merge, kick, importTick, snapshot, flush, status, catchUp, refresh, get store() { return store; }, stop: () => { timers.forEach(clearInterval); timers = []; if (kickT) { clearTimeout(kickT); kickT = null; } if (store) store.close(); store = null; } };
  cur = ctl;
  return ctl;
}

/* החיבור ב־server.js: R2 והמפתח (נגזר מהכספת — אותו מפתח בכל עלייה) */
function forServer(inner, env = process.env) {
  const R2 = require('./r2');
  const c = R2.config(env);
  const r2 = c.ok ? {
    put: (key, buf) => R2.putBuf(c, { fetch: inner }, key, buf, 'application/octet-stream'),
    get: (key) => R2.getBuf(c, { fetch: inner }, key, 1024 * 1024 * 1024),   // null = אין עדיין
  } : null;
  let key = null;
  try { const d = require('./vault').derive('snb-ldb-snap/v1'); key = d ? d.key : null; } catch (e) {}
  return create({ fetch: inner, env, r2, key });
}
const status = () => (cur ? cur.status() : { on: false, why: 'not_started' });
/* lib/udata.js: האם אוסף כבר במסד (מוכן), ואיחוד של מסמך אחד מ־Firestore */
const ready = (c) => !!(cur && cur.store && cur.store.ready(c));
const refresh = (c, id) => (cur ? cur.refresh(c, id) : Promise.resolve(false));
/* lib/ldbping.js: הודעה תקפה → איחוד (מרוכך). אין מסד — false */
const kick = () => (cur ? cur.kick() : false);

/* 6/11/2026 (שלב 2): דגל מהמסד עצמו (sysCfg/main) — בלי קריאה ל־Firestore. אין מסד (Vercel / לא עלה) = כבוי */
function flag(k) {
  const st = cur && cur.store;
  if (!st) return false;
  const d = st.get('sysCfg', 'main');
  const sv = (x) => (d && d.f && d.f[x] && d.f[x].stringValue) || '';
  return SF.flagOn({ flOn: sv('flOn'), flOff: sv('flOff') }, k);
}

module.exports = { flag, create, forServer, status, ready, refresh, kick, KICK_MS, MERGE_MS, sealSnap, openSnap, MIRROR_DAY, IMPORT_DAY, PRIO };
