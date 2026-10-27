// התוסף ב־Chrome: מסנכרן את הסימניות וההיסטוריה עם Studio Browser דרך appDataFolder ב־Drive של המשתמש.
// כל כמה דקות, וחצי דקה אחרי כל שינוי בסימניות — כל עוד Chrome פתוח. הלוגיקה עצמה ב־core.js.
import { flatten, mobileFolderId, planOps, planVisits, buildState, sameState, HIST_DAYS, HIST_MAX } from './core.js';
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
  return { on, last, email, marks: prev ? prev.marks.length : 0, hold: prev ? prev.hold || 0 : 0, prefs: { marks: prefs.marks !== false, hist: prefs.hist !== false } };
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
    let p = { ack: prev ? prev.ack : 0, alias: prev ? prev.alias : {}, hold: 0 };
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
    let vat = prev ? prev.vat : 0, hist = [];
    if (prefs.hist !== false) {
      const pv = planVisits(ops, prev);
      for (const v of pv.add) { try { await chrome.history.addUrl({ url: v.u }); } catch (e) {} }
      vat = pv.vat;
      hist = await chrome.history.search({ text: '', startTime: now - HIST_DAYS * 86400000, maxResults: HIST_MAX });
    }
    const dirs = [];
    const flat = prefs.marks !== false ? flatten(tree, dirs) : [];
    const live = new Set(flat.map((m) => 'n' + m.id));
    const orig = [...origin].filter((i) => live.has(i));
    const next = buildState({ flat, dirs, hist, prev, ack: p.ack, alias: p.alias, vat, origin: orig, now, hold: p.hold });
    if (!sameState(prev, next)) await writeJson(t, 'state.json', next);
    await S.set({ prev: next, origin: orig, allowDel: false, last: { at: now, ok: true, added, removed } });
  } catch (e) {
    await S.set({ last: { at: now, err: code(e) } });
  }
}
