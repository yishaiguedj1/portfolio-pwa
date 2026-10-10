/* v355: סטודיו התרגום — שלב 2 (העלאה ועבודות).
   1. studionet.js: העלאה מתחדשת ל־Drive מול Drive מדומה — חתיכות בכפולות של 256KB, ניתוק באמצע וחזרה מאותו בייט,
      כתובת העלאה שפגה, קובץ של 5GB בלי לקרוא אותו לזיכרון, Drive מלא, עצירה; השרתון (api) והתיקיות; מודל הזמנים.
   2. studio.js: נרמול עבודות (כתובת העלאה רק של Drive), אותו קובץ, מצב העבודה מנקודת המבט של המשתמש.
   3. שילוב: Service Worker, CSP, הספרייה המוטמעת (Mediabunny), חלון ההסכמה המשותף, אבטחה.
   הרצה: node tests/studio-v355.test.js */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let n = 0;
const ok = (c, name) => { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); };
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const N = await import(path.join(root, 'studionet.js'));
  const K = 256 * 1024;

  /* ---------- 1. טהורות ---------- */
  ok(N.rangeNext('bytes=0-1048575') === 1048576 && N.rangeNext(null) === 0 && N.rangeNext('') === 0, 'Range של Drive → הבייט הבא לשלוח (בלי כותרת = כלום לא הגיע)');
  ok(N.backoff(1) === 1000 && N.backoff(3) === 4000 && N.backoff(20) === 30000, 'המתנה אחרי תקלה: 1, 2, 4… עד 30 שניות');
  ok([0, 1, 5e4, 1e6, 3e6, 1e9].every((r) => { const c = N.nextChunk(r); return c % K === 0 && c >= N.CHUNK_MIN && c <= N.CHUNK_MAX; }) && N.nextChunk(0) === N.CHUNK_START,
    'גודל חתיכה: תמיד כפולה של 256KB (דרישה של Drive), בין 1MB ל־32MB, לפי המהירות');
  const est = N.stageEstimates(105, 77 * 60);
  ok(Math.round(est.tr / 60) === 8 && Math.round(est.al / 60) === 5 && Math.round(est.tl / 60) === 50 && Math.round(est.rv / 60) === 12 && Math.round(est.bn / 60) === 23 && Math.round(est.sv / 60) === 3,
    'הערכת זמן: ראיון של 77 דק׳ ב־Opus Medium = 8/5/50/12/23/3 דקות (הטבלה בתוכנית)');
  const eSon = N.stageEstimates(85, 77 * 60);
  ok(eSon.tl < est.tl && eSon.rv < est.rv && eSon.tr === est.tr && eSon.bn === est.bn, 'מצב חסכוני: התרגום והבדיקה קצרים יותר, התמלול והצריבה — אותו דבר');
  const now = 1_000_000_000;
  let m = N.progressModel({ state: 'running', prog: { st: 'tl', p: 0.5, at: now, stg: { tr: { s: now - 900e3, e: now - 600e3 }, al: { s: now - 600e3, e: now - 300e3 }, tl: { s: now - 300e3, e: 0 } } } }, est, { done: true, took: 70 }, now);
  const byId = (id) => m.stages.find((s) => s.id === id);
  // 10/10/2026 (מחקר הצפי): השלב הנוכחי = שילוב — ההערכה (מותאמת ב־√ρ של השלבים שהסתיימו) והקצב בפועל, w = p/(p+0.15)
  const rho = Math.max(0.5, Math.min(3, 600 / (est.tr + est.al))), eTl = Math.round(est.tl * Math.sqrt(rho)), w = 0.5 / 0.65;
  const want = Math.round((1 - w) * eTl + w * 600 - 300);
  ok(byId('up').state === 'done' && byId('up').took === 70 && byId('tr').state === 'done' && byId('tr').took === 300 && byId('tl').state === 'now' && Math.abs(byId('tl').left - want) < 2 && byId('rv').state === 'wait',
    'מסך ההתקדמות: שלב שהסתיים — כמה לקח באמת; שלב נוכחי — שילוב ההערכה עם הקצב בפועל; שלב שמחכה — ההערכה');
  ok(m.left === byId('tl').left + byId('rv').est + byId('bn').est + byId('sv').est && byId('rv').est === Math.round(est.rv * Math.sqrt(rho)) && m.pct > 0 && m.pct < 1, 'הזמן הכולל = מה שנשאר בשלב הנוכחי + ההערכות של השלבים שמחכים');
  m = N.progressModel({ state: 'running', prog: { st: 'tl', p: 0.01, eta: 1200, at: now - 60e3, stg: { tl: { s: now - 120e3, e: 0 } } } }, est, { done: true }, now);
  ok(m.stages.find((s) => s.id === 'tl').left === 1140, 'כשהעובד מדווח כמה נשאר (eta) — זה גובר, פחות מה שעבר מאז הדיווח');
  m = N.progressModel({ state: 'done', prog: {} }, est, { done: true }, now);
  ok(m.left === 0 && m.pct === 1 && m.stages.every((s) => s.state === 'done'), 'עבודה שהסתיימה — הכל ✓');
  m = N.progressModel({ state: 'new', prog: null }, est, { active: true, p: 0.4, left: 50 }, now);
  ok(m.stages[0].state === 'now' && m.stages[0].left === 50 && m.stages.slice(1).every((s) => s.state === 'wait'), 'בזמן העלאת הקול — השלב הראשון "עכשיו", השאר מחכים');

  /* ---------- 2. Drive מדומה: העלאה מתחדשת ---------- */
  // Blob מדומה בלי תוכן: slice מחזיר רק תיאור — כך אפשר לבדוק 5GB, ומוודאים שאף פעם לא נקראת חתיכה גדולה מ־32MB
  const fakeBlob = (size) => ({ size, slice: (a, b) => ({ size: b - a, a, b }) });
  function drive(opts = {}) {
    const st = { sessions: [], puts: [], inits: 0, maxSlice: 0, failAt: opts.failAt || [], expireAt: opts.expireAt || -1, full: !!opts.full };
    let got = 0, cur = null;
    const fetch = async (url, o = {}) => {
      if (url.includes('/upload/drive/v3/files?uploadType=resumable')) {
        st.inits++;
        if (o.headers.Authorization !== 'Bearer TOK') return { status: 401, headers: { get: () => null }, json: async () => ({}) };
        cur = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=S' + st.inits; got = 0;
        st.sessions.push(cur);
        st.meta = JSON.parse(o.body); st.len = +o.headers['X-Upload-Content-Length'];
        return { status: 200, headers: { get: (k) => (k === 'Location' ? cur : null) }, json: async () => ({}) };
      }
      return { status: 404, json: async () => ({}) };
    };
    const put = async (uri, body, headers, onProgress) => {
      st.puts.push({ uri, range: headers['Content-Range'], len: body ? body.size : 0 });
      if (uri !== cur) return { status: 404 };
      const total = st.len;
      if (st.puts.length === st.expireAt) { cur = null; return { status: 404 }; }
      if (!body) return got >= total ? { status: 200, json: { id: 'F1', size: String(total) } } : { status: 308, range: got ? 'bytes=0-' + (got - 1) : null };
      const m2 = /bytes (\d+)-(\d+)\/(\d+)/.exec(headers['Content-Range']);
      const a = +m2[1], b = +m2[2];
      st.maxSlice = Math.max(st.maxSlice, body.size);
      if (a !== got) return { status: 308, range: got ? 'bytes=0-' + (got - 1) : null };   // Drive לא מקבל חור
      if (st.full) return { status: 403, json: { error: { errors: [{ reason: 'storageQuotaExceeded' }] } } };
      if (st.failAt.includes(st.puts.length)) {             // ניתוק באמצע חתיכה: חלק הגיע, התשובה לא
        got = a + Math.floor((b - a) / 2 / K) * K;
        if (onProgress) onProgress(Math.floor((b - a) / 2));
        return { status: 0 };
      }
      got = b + 1;
      if (onProgress) onProgress(b - a + 1);
      return got >= total ? { status: 201, json: { id: 'F1', name: 'x', size: String(total) } } : { status: 308, range: 'bytes=0-' + (got - 1) };
    };
    return { st, fetch, put };
  }
  const mkNet = (d, extra) => N.createNet(Object.assign({ fetch: d.fetch, put: d.put, sleep: async () => {}, base: () => 'https://proxy.example', idToken: async () => 'ID',
    online: () => true, now: (() => { let t = 0; return () => (t += 1000); })() }, extra || {}));
  const withToken = (d) => { const f0 = d.fetch; d.fetch = async (url, o) => (url.endsWith('/api/studio') ? { status: 200, json: async () => ({ ok: true, token: 'TOK', exp: Date.now() + 3600e3 }) } : f0(url, o)); return d; };

  let d = withToken(drive());
  let net = mkNet(d);
  let prog = [];
  const size = 3 * 1024 * 1024 * 1024 + 12345;               // 3GB ועוד קצת — לא כפולה של 256KB
  let f = await net.upload({ blob: fakeBlob(size), size, mime: 'video/mp4', meta: { name: 'v.mp4', parents: ['P'] }, onUri: () => {}, onProgress: (b) => prog.push(b) });
  const full = d.st.puts.filter((p) => p.len);
  ok(f.id === 'F1' && full.slice(0, -1).every((p) => p.len % K === 0) && d.st.maxSlice <= N.CHUNK_MAX, 'קובץ של 3GB עולה בחתיכות: כל חתיכה (חוץ מהאחרונה) כפולה של 256KB, אף פעם לא יותר מ־32MB בזיכרון');
  ok(full.every((p, i) => i === 0 || +/bytes (\d+)/.exec(p.range)[1] === +/-(\d+)\//.exec(full[i - 1].range)[1] + 1) && /\/3221237817$/.test(full[0].range), 'Content-Range רציף ונכון (כולל הגודל המלא)');
  ok(prog[prog.length - 1] === size && prog.every((b, i) => i === 0 || b >= prog[i - 1] - N.CHUNK_MAX), 'התקדמות עד הבייט האחרון');

  d = withToken(drive({ failAt: [3] }));
  net = mkNet(d);
  const s2 = 40 * 1024 * 1024;
  f = await net.upload({ blob: fakeBlob(s2), size: s2, mime: 'video/mp4', meta: { name: 'v' }, onUri: () => {}, onProgress: () => {} });
  const status = d.st.puts.filter((p) => !p.len);
  const after = d.st.puts[d.st.puts.indexOf(status[0]) + 1];
  ok(f.id === 'F1' && status.length === 1 && /bytes \*\/41943040/.test(status[0].range) && after && /^bytes (\d+)-/.exec(after.range)[1] % K === 0 && d.st.inits === 1,
    'ניתוק באמצע: שואלים את Drive "כמה הגיע?" וממשיכים מאותו בייט — בלי להתחיל מחדש');

  d = withToken(drive());
  net = mkNet(d);
  let uri = '';
  const ac = new AbortController();
  let calls = 0;
  try {
    await net.upload({ blob: fakeBlob(s2), size: s2, meta: { name: 'v' }, onUri: (u) => { uri = u; }, signal: ac.signal, onProgress: () => { if (++calls === 3) ac.abort(); } });
    ok(false, 'abort');
  } catch (e) { ok(e.name === 'AbortError' && uri, 'עצירה (למשל "ביטול") — נעצר מיד, והכתובת נשמרה להמשך'); }
  const before = d.st.puts.length;
  f = await net.upload({ blob: fakeBlob(s2), size: s2, meta: { name: 'v' }, uri, onUri: () => {}, onProgress: () => {} });
  ok(f.id === 'F1' && d.st.inits === 1 && !d.st.puts[before].len && /bytes \*\//.test(d.st.puts[before].range), 'אחרי רענון: אותה כתובת → "כמה הגיע?" → ממשיכים (בלי כתובת חדשה)');

  d = withToken(drive({ expireAt: 2 }));
  net = mkNet(d);
  f = await net.upload({ blob: fakeBlob(s2), size: s2, meta: { name: 'v' }, onUri: () => {}, onProgress: () => {} });
  ok(f.id === 'F1' && d.st.inits === 2, 'כתובת העלאה שפגה (שבוע) — כתובת חדשה ומתחילים ממנה');

  d = withToken(drive({ full: true }));
  net = mkNet(d);
  try { await net.upload({ blob: fakeBlob(s2), size: s2, meta: { name: 'v' }, onUri: () => {}, onProgress: () => {} }); ok(false, 'full'); }
  catch (e) { ok(e.code === 'drive_full' && e.fatal, 'Drive מלא — שגיאה ברורה מיד, בלי ניסיונות חוזרים'); }

  d = drive();
  let tokCalls = 0;
  d.fetch = ((f0) => async (url, o) => { if (url.endsWith('/api/studio')) { tokCalls++; return { status: 200, json: async () => ({ ok: true, token: tokCalls === 1 ? 'OLD' : 'TOK', exp: Date.now() + 3600e3 }) }; } return f0(url, o); })(d.fetch);
  net = mkNet(d);
  f = await net.upload({ blob: fakeBlob(1024), size: 1024, meta: { name: 'a' }, onUri: () => {}, onProgress: () => {} });
  ok(f.id === 'F1' && tokCalls === 2, 'גישה ל־Drive שפגה (401) — מבקשים גישה חדשה מהשרתון פעם אחת וממשיכים');

  // שערים: בלי רשת מחכים; השער נקרא לפני כל חתיכה
  d = withToken(drive());
  net = mkNet(d);
  let gates = 0;
  f = await net.upload({ blob: fakeBlob(9 * 1024 * 1024), size: 9 * 1024 * 1024, meta: { name: 'v' }, onUri: () => {}, onProgress: () => {}, gate: async () => { gates++; } });
  ok(f.id === 'F1' && gates >= 2 && gates === d.st.puts.filter((p) => p.len).length, 'לפני כל חתיכה — בדיקת רשת / Wi‑Fi (השער)');

  // השרתון: בלי התחברות / בלי רשת
  net = N.createNet({ fetch: async () => { throw new Error('x'); }, base: () => 'https://p', idToken: async () => '' });
  ok((await net.api('status')).error === 'signin', 'בלי התחברות — "signin" בלי לפנות לשרתון');
  net = N.createNet({ fetch: async () => { throw new Error('x'); }, base: () => 'https://p', idToken: async () => 'ID' });
  ok((await net.api('status')).error === 'net', 'בלי רשת — "net" (לא חריגה)');
  let sent = null;
  net = N.createNet({ fetch: async (u, o) => { sent = { u, b: JSON.parse(o.body) }; return { status: 200, json: async () => ({ ok: true }) }; }, base: () => 'https://p', idToken: async () => 'ID', headers: () => ({ 'X-App-Key': 'k' }) });
  await net.api('job', { job: 'jX', op: 'evil', idToken: 'fake' });
  ok(sent.u === 'https://p/api/studio' && sent.b.op === 'job' && sent.b.idToken === 'ID' && sent.b.job === 'jX', 'קריאה לשרתון: ה־op וההתחברות לא נדרסים על ידי הפרמטרים');

  // תיקיות: מוצאים לפי מזהה העבודה (בלי כפילות אחרי רענון), אחרת יוצרים
  const fq = [];
  d = drive();
  d.fetch = async (url, o = {}) => {
    if (url.endsWith('/api/studio')) return { status: 200, json: async () => ({ ok: true, token: 'TOK', exp: Date.now() + 3600e3 }) };
    fq.push({ url: decodeURIComponent(url), method: o.method || 'GET', body: o.body ? JSON.parse(o.body) : null });
    if ((o.method || 'GET') === 'GET') return { status: 200, json: async () => ({ files: /snbStudio/.test(decodeURIComponent(url)) ? [{ id: 'ROOT1' }] : [] }) };
    return { status: 200, json: async () => ({ id: 'NEW1' }) };
  };
  net = mkNet(d);
  const fid = await net.jobFolder('jAAAAAAAAAAAAAAAAAAAA', 'Ackman interview');
  const mk = fq.find((x) => x.method === 'POST');
  ok(fid === 'NEW1' && /appProperties has \{ key='snbJob' and value='jAAAAAAAAAAAAAAAAAAAA' \}/.test(fq[1].url) && mk.body.parents[0] === 'ROOT1' && mk.body.appProperties.snbJob === 'jAAAAAAAAAAAAAAAAAAAA' && mk.body.name === 'Ackman interview',
    'תיקיית הפרויקט: מחפשים לפי מזהה העבודה בתוך "THE SNOWBALL — סטודיו", ויוצרים רק אם אין');

  /* ---------- 3. studio.js — טהורות ---------- */
  const st = read('studio.js');
  const STUBS = { createNet: () => ({}), probeVideo: async () => ({}), extractAudio: async () => ({}), stageEstimates: N.stageEstimates, progressModel: N.progressModel, createBackup: () => ({}), waitOAuthCode: () => {} };
  const body = st.replace(/^export (const|function) /gm, '$1 ').replace(/^import \{([^}]+)\} from '[^']+';$/gm, 'const {$1} = __stubs;');
  const S = new Function('t', '__stubs', body + '\nreturn { normJob, normStore, sameFile, jobPhase, normSettings };')(undefined, STUBS);
  const J = { id: 'jAAAAAAAAAAAAAAAAAAAA', created: 5, spec: { name: 'a.mkv', size: 100, to: ['he', 'zz'], mode: 'x', out: ['same', 'evil'] },
    up: { folder: 'F'.repeat(20), a: { done: true, id: 'A'.repeat(20), size: 7, uri: 'https://evil.example/upload' }, v: { uri: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=X', sent: 50 } },
    fp: { name: 'a.mkv', size: 100, lm: 9 }, srv: { state: 'running', sess: { url: 'javascript:alert(1)' }, prog: { st: 'tr' } } };
  const nj = S.normJob(J);
  ok(nj && nj.spec.to.join() === 'he' && nj.spec.mode === 'sonnet-medium' && nj.spec.out.join() === 'same' && nj.up.a.uri === '' && /^https:\/\/www\.googleapis\.com\/upload/.test(nj.up.v.uri) && nj.srv.sess === null && nj.srv.state === 'running',
    'עבודה שמורה: כתובת העלאה רק של Drive, קישור לסשן רק של claude.ai, שפות ומצבים מוכרים בלבד');
  ok(S.normJob({ id: '../x' }) === null && S.normJob(null) === null, 'מזהה עבודה לא תקין — נדחה');
  const ns = S.normStore({ jobs: [J, J, { id: 'bad' }], conn: { hint: 'trig_…abcd', ok: 5, k: 'SECRET' }, drive: { connected: true, email: 'a@b.c' }, settings: { wifi: true } });
  ok(ns.jobs.length === 1 && ns.conn.hint === 'trig_…abcd' && !('k' in ns.conn) && ns.drive.connected && ns.settings.wifi === true, 'אחסון: עבודות בלי כפילויות, מהחיבור רק הרמז (בלי מפתח), "רק ב־Wi‑Fi"');
  const file = { name: 'a.mkv', size: 100, lastModified: 9 };
  ok(S.sameFile(file, J.fp) && S.sameFile({ name: 'a.mkv', size: 100, lastModified: 12345 }, J.fp) && !S.sameFile({ name: 'a.mkv', size: 101, lastModified: 9 }, J.fp) && !S.sameFile({ name: 'b.mkv', size: 100, lastModified: 9 }, J.fp) && !S.sameFile(file, null),
    'אותו קובץ = שם וגודל מדויק (לא תאריך שינוי — באנדרואיד הוא משתנה בין בחירות)');
  const base = S.normJob({ id: 'jAAAAAAAAAAAAAAAAAAAA', spec: { name: 'a', size: 1 }, srv: { state: 'new' } });
  const ph = (patch, run) => { const r = JSON.parse(JSON.stringify(base)); Object.assign(r.up, patch.up || {}); if (patch.srv) r.srv = Object.assign(r.srv, patch.srv); return S.jobPhase(r, run); };
  ok(ph({}, { active: true, phase: 'extract' }) === 'extract' && ph({}, { active: true, phase: 'audio' }) === 'audio' && ph({}, { active: true, phase: 'video', wait: 'wifi' }) === 'wait'
    && ph({}, null) === 'paused' && ph({}, { active: false, need: true }) === 'need' && ph({}, { active: false, phase: 'error' }) === 'error',
    'מצב העבודה בזמן ההעלאה: חילוץ / קול / סרטון / ממתין לרשת / נעצר / צריך לבחור שוב / תקלה');
  ok(ph({ up: { a: { done: true }, v: { done: true } } }, null) === 'ready' && ph({ up: { a: { done: true }, v: { done: true }, started: 5 } }, null) === 'queued'
    && ph({ srv: { state: 'running' } }, null) === 'running' && ph({ srv: { state: 'done' } }, { active: true }) === 'done', 'אחרי ההעלאה: מוכן / הופעל / רץ / הסתיים (מצב השרתון גובר)');

  /* ---------- 4. שילוב ---------- */
  const sw = read('sw.js'), html = read('index.html'), lib = read('library.js'), bk = read('libbackup.js'), app = read('app.js');
  const swVer = +(sw.match(/CACHE_NAME = 'portfolio-pwa-v(\d+)'/) || [])[1];
  if (swVer >= 355) ok(/const STUDIO_SHELL = \[[^\]]*'\.\/studionet\.js'[^\]]*'\.\/libbackup\.js'/.test(sw), 'sw.js: גם studionet.js ו־libbackup.js נטענים מראש (הסטודיו נפתח אופליין)');
  else ok(true, 'sw.js עוד בגרסה הקודמת (שלב התוכן בפרוטוקול הדו־שלבי)');
  const imports = [...st.matchAll(/^import .* from '\.\/([\w.-]+)';$/gm)].map((x) => x[1]);
  ok(imports.sort().join() === 'libbackup.js,studionet.js,studioplay.js', 'studio.js מייבא רק את studionet.js, libbackup.js ו־studioplay.js (מ1: הנגן)');
  const csp = (html.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  ok(/connect-src[^;]*https:\/\/\*\.googleapis\.com/.test(csp) && /connect-src[^;]*https:\/\/\*\.vercel\.app/.test(csp) && /worker-src 'self'/.test(csp), 'CSP: ההעלאה ל־Drive והשרתון מותרים; Worker רק מאותו מקור');
  const net0 = read('studionet.js');
  ok(/import\(MB_URL\)/.test(net0) && /const MB_URL = '\.\/vendor\/mediabunny\/mediabunny\.min\.mjs'/.test(net0), 'Mediabunny נטען רק כשמתחילים עבודה (import דינמי מהעותק בריפו)');
  const mb = fs.readFileSync(path.join(root, 'vendor/mediabunny/mediabunny.min.mjs'));
  const ver = read('vendor/mediabunny/VERSION');
  ok(ver.includes(crypto.createHash('sha256').update(mb).digest('hex')) && /Mozilla Public License/.test(read('vendor/mediabunny/LICENSE')), 'Mediabunny המוטמע = הגרסה שנבדקה (sha256 ב־VERSION) + הרישיון (MPL-2.0)');
  ok(/video: \{ discard: true \}/.test(net0) && /isValid/.test(net0), 'חילוץ הקול: העתקה בלי וידאו; קודק שאי אפשר להעתיק — העבודה מתחילה מהסרטון המלא');
  ok(/export function waitOAuthCode/.test(bk) && /waitCode: waitOAuthCode/.test(lib) && /waitCode: waitOAuthCode/.test(st) && !/function waitCode/.test(lib), 'חלון ההסכמה של Google — פונקציה אחת משותפת לספרייה ולסטודיו');
  ok(!/console\.(log|info|debug)/.test(net0) && !/localStorage/.test(net0), 'studionet.js לא כותב ליומן ולא לאחסון (הגישה ל־Drive רק בזיכרון)');
  ok(/x\.upload\.onprogress/.test(net0) && /STALL_MS/.test(net0), 'העלאה: התקדמות בתוך החתיכה, וזיהוי חיבור שנתקע');
  ok(/navigator\.wakeLock\.request\('screen'\)/.test(st) && /visibilitychange[\s\S]{0,120}wakeOn\(\)/.test(st), 'מסך דולק בזמן העלאה — וחוזר אחרי שחוזרים לאפליקציה');
  ok(/navigator\.connection\.type === 'cellular'/.test(st) && /store\.settings\.wifi && isCellular\(\)/.test(st), '"רק ב־Wi‑Fi": בסלולר ההעלאה מחכה');
  ok(+((app.match(/const APP_VERSION = 'v(\d+)'/) || [])[1] || 0) >= 355, 'APP_VERSION — v355 ומעלה');
  ok(fs.existsSync(path.join(root, 'ibkr-proxy/api/studio.js')) && /"api\/studio\.js": \{"maxDuration": 30\}/.test(read('ibkr-proxy/vercel.json')), 'השרתון: api/studio.js ב־vercel.json (הפונקציה ה־12)');
  ok(fs.readdirSync(path.join(root, 'ibkr-proxy/api')).filter((x) => x.endsWith('.js')).length <= 12, 'לא יותר מ־12 פונקציות ב־Vercel Hobby');

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e && e.stack || e); process.exit(1); });
