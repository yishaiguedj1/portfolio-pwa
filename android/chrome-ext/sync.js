// התוסף ב־Chrome: מסנכרן את הסימניות וההיסטוריה עם Studio Browser דרך appDataFolder ב־Drive של המשתמש.
// כל כמה דקות, וחצי דקה אחרי כל שינוי בסימניות — כל עוד Chrome פתוח. הלוגיקה עצמה ב־core.js.
import { flatten, mobileFolderId, planOps, planVisits, buildState, sameState, visitsMerge, echoChromeAt, histList, HIST_DAYS, HIST_MAX } from './core.js';
import { token, forget, readJson, writeJson } from './drive.js';

const EVERY_MIN = 5;
const S = {
  get: (k) => chrome.storage.local.get(k),
  set: (o) => chrome.storage.local.set(o),
};
let running = null;

chrome.runtime.onInstalled.addListener((d) => {
  chrome.alarms.create('sync', { periodInMinutes: EVERY_MIN });
  if (d.reason === 'install') chrome.tabs.create({ url: 'welcome.html' });
});
chrome.runtime.onStartup.addListener(() => { chrome.alarms.create('sync', { periodInMinutes: EVERY_MIN }); soon(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'sync' || a.name === 'soon') sync(); });

function soon() { chrome.alarms.create('soon', { delayInMinutes: 0.5 }); }
for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) chrome.bookmarks[ev].addListener(() => soon());
// היסטוריה: ביקור חדש — לסנכרן בקרוב; מחיקה ב־Chrome — לבנות את המטמון מחדש (onVisitRemoved לא תמיד אומר אילו ביקורים)
chrome.history.onVisited.addListener(() => soon());
chrome.history.onVisitRemoved.addListener(() => { S.set({ hdirty: true }); soon(); });
const FULL_EVERY = 6 * 3600000;   // בנייה מלאה של המטמון — גם כדי לתפוס מחיקה של ביקור בודד

chrome.runtime.onMessage.addListener((m, _s, reply) => {
  (async () => {
    if (m.cmd === 'status') return reply(await status());
    if (m.cmd === 'connect') {
      try { await token(true); await S.set({ on: true }); await sync(true); } catch (e) { await S.set({ last: { at: Date.now(), err: code(e) } }); }
      return reply(await status());
    }
    if (m.cmd === 'disconnect') { await forget(); await S.set({ on: false, prev: null, origin: [] }); return reply(await status()); }
    if (m.cmd === 'sync') { await sync(true); return reply(await status()); }
    if (m.cmd === 'allowDel') { await S.set({ allowDel: true }); await sync(true); return reply(await status()); }
    if (m.cmd === 'pref') { const { prefs = {} } = await S.get('prefs'); prefs[m.k] = !!m.v; await S.set({ prefs }); return reply(await status()); }
    reply(null);
  })();
  return true;
});

async function status() {
  const { on = false, last = null, prev = null, prefs = {} } = await S.get(['on', 'last', 'prev', 'prefs']);
  let email = '';
  try { email = (await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' })).email || ''; } catch (e) {}
  return { on, last, email, marks: prev ? prev.marks.length : 0, hold: prev ? prev.hold || 0 : 0, hhold: prev ? prev.hhold || 0 : 0, prefs: { marks: prefs.marks !== false, hist: prefs.hist !== false } };
}

const code = (e) => String((e && e.message) || e || 'error').slice(0, 60);

function sync(force) {
  if (running) return running;
  running = run(force).finally(() => { running = null; });
  return running;
}

async function run() {
  const st = await S.get(['on', 'prev', 'origin', 'allowDel', 'prefs']);
  if (!st.on) return;
  const prefs = st.prefs || {};
  const now = Date.now();
  try {
    const t = await token(false);
    const ops = await readJson(t, 'ops.json');
    const prev = st.prev || (await readJson(t, 'state.json'));
    let tree = await chrome.bookmarks.getTree();
    const origin = new Set(st.origin || []);
    let added = 0, removed = 0;
    let p = { ack: prev ? prev.ack : 0, alias: prev ? prev.alias : {}, hold: 0, hhold: 0, hdels: [] };
    if (prefs.marks !== false) {
      p = planOps(flatten(tree), ops, prev, !!st.allowDel);
      const folder = mobileFolderId(tree);
      for (const c of p.creates) {
        const n = await chrome.bookmarks.create({ parentId: folder, title: c.t, url: c.u });
        origin.add('n' + n.id); if (c.aid) p.alias[c.aid] = 'n' + n.id; added++;
      }
      for (const r of p.renames) await chrome.bookmarks.update(r.id, { title: r.t });
      for (const id of p.deletes) { try { await chrome.bookmarks.remove(id); removed++; } catch (e) {} }
      if (p.creates.length || p.deletes.length || p.renames.length) tree = await chrome.bookmarks.getTree();
    }
    let vat = prev ? prev.vat : 0, hist = [], hfrom = 0;
    if (prefs.hist !== false) {
      const since = now - HIST_DAYS * 86400000;
      const hs = await S.get(['hv', 'hscan', 'hfull', 'hdirty', 'echo']);
      let hv = hs.hv || {}, echo = (hs.echo || []).filter((e) => e.p >= since);
      const touched = new Set();
      // 1) ביקורים מהטלפון → Chrome. Chrome קובע את הזמן בעצמו — שומרים איזה ביקור נוצר (ההד), כדי שיחזור לטלפון בזמן שלו
      const pv = planVisits(ops, prev);
      for (const v of pv.add) {
        const t0 = Date.now();
        try {
          await chrome.history.addUrl({ url: v.u });
          const mine = (await chrome.history.getVisits({ url: v.u })).filter((x) => x.visitTime >= t0 - 5).sort((a, b) => b.visitTime - a.visitTime)[0];
          if (mine) echo.push({ id: String(mine.visitId), u: v.u, p: v.at, c: mine.visitTime });
          touched.add(v.u);
        } catch (e) {}
      }
      vat = pv.vat;
      // 2) ביקורים שנמחקו בטלפון → נמחקים ב־Chrome: בדיוק הביקור הזה (טווח של אלפית שנייה), לא כל הכתובת
      for (const d of (prefs.marks !== false ? p : planOps(flatten(tree), ops, prev, !!st.allowDel)).hdels) {
        const c = Math.floor(echoChromeAt(echo, d.u, d.at));
        try { await chrome.history.deleteRange({ startTime: c, endTime: c + 1 }); } catch (e) {}
        touched.add(d.u);
      }
      // 3) המטמון ביקור־ביקור: מה שהשתנה מאז הפעם הקודמת, ובנייה מלאה אחרי מחיקה ב־Chrome / כל כמה שעות
      const full = hs.hdirty || !hs.hfull || now - hs.hfull > FULL_EVERY;
      if (full) hv = {};
      const items = await chrome.history.search({ text: '', startTime: full ? since : Math.max(since, (hs.hscan || 0) - 120000), maxResults: 100000 });
      const urls = new Map(items.map((i) => [i.url, i.title || '']));
      for (const u of touched) if (!urls.has(u)) urls.set(u, (hv[u] && hv[u].t) || '');
      for (const [u, t] of urls) {
        try { visitsMerge(hv, u, t, (await chrome.history.getVisits({ url: u })).map((x) => [x.visitId, x.visitTime]), since); } catch (e) {}
      }
      for (const u of Object.keys(hv)) { hv[u].v = hv[u].v.filter((x) => x[1] >= since); if (!hv[u].v.length) delete hv[u]; }
      const live = new Set(); for (const e of Object.values(hv)) for (const x of e.v) live.add(x[0]);
      echo = echo.filter((e) => live.has(e.id));
      ({ hist, hfrom } = histList(hv, echo, since, HIST_MAX));
      await S.set({ hv, echo, hscan: now, hfull: full ? now : hs.hfull, hdirty: false });
    }
    const dirs = [];
    const flat = prefs.marks !== false ? flatten(tree, dirs) : [];
    const live = new Set(flat.map((m) => 'n' + m.id));
    const orig = [...origin].filter((i) => live.has(i));
    const next = buildState({ flat, dirs, hist, hfrom, prev, ack: p.ack, alias: p.alias, vat, origin: orig, now, hold: p.hold, hhold: p.hhold });
    if (!sameState(prev, next)) await writeJson(t, 'state.json', next);
    await S.set({ prev: next, origin: orig, allowDel: false, last: { at: now, ok: true, added, removed } });
  } catch (e) {
    await S.set({ last: { at: now, err: code(e) } });
  }
}
