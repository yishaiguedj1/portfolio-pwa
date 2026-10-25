// 25/10/2026 — מקצה לקצה של שלב 3 של "תרגום בטלפון": השרתון האמיתי ב־HTTP (Firestore ו־R2 מדומים), job.py run + auto בפייתון בלי ספריות (כמו בטלפון),
// ועונה מדומה (ptNext/ptMark) שמחזיר תשובות בפורמט של pipeline.
// הרצה: node tests/studio-pt-e2e.test.js (צריך python3 — הוא רץ בלי site-packages, כמו הפייתון של youtubedl-android בטלפון)
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http'), crypto = require('crypto');
const { spawn } = require('child_process');
const root = path.join(__dirname, '..');
const { fakeR2, ENV } = require('./_r2fake');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }

(async () => {
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, ENV, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', SNB_RELAY_HUB_ON: '1', STUDIO_SMOKE: 'off',
  });
  delete process.env.IBKR_VAULT_KEY;
  const gauth = require(root + '/ibkr-proxy/lib/gauth.js');
  const R2 = require(root + '/ibkr-proxy/lib/r2.js');
  const S = require(root + '/ibkr-proxy/lib/studio.js');
  const studio = require(root + '/ibkr-proxy/api/studio.js');
  gauth._reset(); studio._reset(); R2._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub: 'ownerUid0001', iat: tnow - 5, exp: tnow + 3000, email: 'owner@example.com', email_verified: true });
  const OWNER = hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');

  const R = fakeR2();
  const db = new Map();
  let utSeq = 0;
  const J = (o, st = 200) => ({ status: st, ok: st < 300, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => null } });
  const fetchAll = async (url, opt = {}) => {
    if (url.includes('.r2.cloudflarestorage.com')) return R.fetch(url, opt);
    if (url.includes('oauth2.googleapis.com/token')) return J({ access_token: 'SA', expires_in: 3600 });
    if (url.endsWith('/documents:runQuery')) {
      const q = JSON.parse(opt.body).structuredQuery, w = q.where, col = q.from[0].collectionId;
      const fl = !w ? [] : w.fieldFilter ? [w.fieldFilter] : w.compositeFilter.filters.map((f) => f.fieldFilter);
      return J([...db.entries()].filter(([k, v]) => k.startsWith(col + '/') && fl.every((f) => v.fields[f.field.fieldPath] && v.fields[f.field.fieldPath].stringValue === f.value.stringValue))
        .map(([k, v]) => ({ document: { name: 'projects/p/databases/(default)/documents/' + k, fields: v.fields, updateTime: v.ut } })).concat([{ readTime: 'x' }]));
    }
    const m = url.match(/\/documents\/([A-Za-z]+)\/([A-Za-z0-9_-]+)(?:\?(.*))?$/);
    if (!m) return J({}, 404);
    const k = m[1] + '/' + m[2], cur = db.get(k);
    if ((opt.method || 'GET') === 'GET') return cur ? J({ fields: cur.fields, updateTime: cur.ut }) : J({}, 404);
    if (opt.method === 'DELETE') { db.delete(k); return J({}); }
    if (opt.method === 'PATCH') {
      const qp = new URLSearchParams(m[3] || '');
      const mask = qp.getAll('updateMask.fieldPaths'), pre = qp.get('currentDocument.updateTime');
      if (pre && (!cur || cur.ut !== pre)) return J({}, 400);
      const body = JSON.parse(opt.body).fields;
      db.set(k, { fields: mask.length ? Object.assign({}, cur ? cur.fields : {}, ...mask.map((f) => ({ [f]: body[f] }))) : body, ut: 't' + (++utSeq) });
      return J({});
    }
    return J({}, 400);
  };
  const handle = async (body, hdr) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    await studio._handler({ method: 'POST', query: {}, body, headers: hdr || {}, socket: { remoteAddress: '9.9.9.9' } }, res, { verify: { keys }, fetch: fetchAll });
    return res;
  };
  // HTTP: השרתון + פרוקסי ל־R2 המדומה (הקישורים החתומים מוחלפים לכתובת המקומית; החתימה נבדקת על הכתובת המקורית)
  let PORT = 0;
  const R2HOST = /https:\/\/([a-z0-9.]+\.r2\.cloudflarestorage\.com)/g;
  const srv = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const buf = Buffer.concat(chunks);
      if (req.url.startsWith('/__r2/')) {
        const rest = req.url.slice(6), i = rest.indexOf('/');
        const url = 'https://' + rest.slice(0, i) + rest.slice(i);
        const h = {}; for (const [k, v] of Object.entries(req.headers)) if (!['host', 'connection', 'content-length', 'accept-encoding', 'user-agent'].includes(k)) h[k] = v;
        const r = await R.fetch(url, { method: req.method, headers: h, body: ['PUT', 'POST'].includes(req.method) ? buf : undefined });
        const out = Buffer.from(await r.arrayBuffer());
        const oh = {}; r.headers.forEach((v, k) => { oh[k] = v; });
        if (!('content-length' in oh) && req.method !== 'HEAD') oh['content-length'] = String(out.length);
        res.writeHead(r.status, oh); res.end(req.method === 'HEAD' ? undefined : out);
        return;
      }
      let body = {}; try { body = JSON.parse(buf.toString('utf8') || '{}'); } catch (e) {}
      const r = await handle(body, req.headers);
      const txt = JSON.stringify(r.j).replace(R2HOST, 'http://127.0.0.1:' + PORT + '/__r2/$1');
      res.writeHead(r.code || 200, { 'content-type': 'application/json' }); res.end(txt);
    });
  });
  await new Promise((d) => srv.listen(0, '127.0.0.1', d));
  PORT = srv.address().port;
  const BASE = 'http://127.0.0.1:' + PORT;
  process.env.SNB_RELAY_HUB = BASE;
  const api = (op, b) => handle(Object.assign({}, b, { op, idToken: OWNER }), { origin: 'https://yishaiguedj1.github.io' }).then((r) => r.j);

  // העבודה: "הכל בטלפון" + שלבי הטקסט בטלפון
  const spec = { name: 'lecture.mp4', size: 1e8, type: 'video/mp4', dur: 120, from: 'en', to: ['he'], mode: 'haiku-high', eng: 'api', cap: 5, ph: 1, pw: 1, pt: 1 };
  const cj = await api('create', { spec });
  ok(cj.ok && cj.job.spec.pt === 1, 'נוצרה עבודה pt');
  const JOB = cj.job.id, doc = () => db.get('studioJobs/' + JOB).fields;
  const folder = doc().folder.stringValue;
  const PK = crypto.randomBytes(32).toString('base64url');
  Object.assign(doc(), { pkh: { stringValue: S.keyHash(PK) }, pkx: { integerValue: String(Date.now() + 3 * 86400e3) } });
  // המילים והמדידות (כמו שהטלפון מעלה)
  const voc = 'so today we are going to talk about how great products are built and why customers love them'.split(' ');
  const words = []; let t = 0.5;
  for (let i = 0; i < 260; i++) { const d = 0.22 + (i % 5) * 0.03; words.push({ w: voc[i % voc.length] + (i % 13 === 12 ? '.' : ''), s: +t.toFixed(3), e: +(t + d).toFixed(3), spk: i < 130 ? 'S1' : 'S2', align: 'qwen3' }); t += d + 0.08; }
  const probe = { format: { duration: '120.5', start_time: '0.000000' }, streams: [
    { index: 0, codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, avg_frame_rate: '30000/1001', r_frame_rate: '30000/1001', start_time: '0.000000' },
    { index: 1, codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2, start_time: '0.000000' }] };
  const put = (id, obj) => { R.objs.set('st/ownerUid0001/' + id, Buffer.from(JSON.stringify(obj))); R.meta.set('st/ownerUid0001/' + id, { type: 'application/json', am: {} }); };
  const wid = folder + '_wwwwwwwwwwww', mid = folder + '_mmmmmmmmmmmm';
  put(wid, { v: 1, engine: 'parakeet', aligner: 'qwen3', words, diarize: { speakers: 2, units: 10, seconds: 1 } });
  put(mid, { v: 1, probe, shots: { threshold: 10.0, shots: [{ t: 40.1, score: 22 }] } });
  const ph = (op, b) => handle(Object.assign({ op, job: JOB, key: PK }, b)).then((r) => r.j);
  ok((await ph('phFile', { which: 'w', id: wid })).ok && (await ph('phFile', { which: 'm', id: mid })).ok, 'המילים והמדידות נרשמו');
  ok((await ph('phStart')).state === 'queued', 'phStart');
  const cl = await ph('phClaim');
  ok(cl.ok && cl.job.key, 'phClaim');

  // העונה המדומה (במקום agent.pt_loop + Claude)
  const fixed = {}; let stop = false; const seenK = {};
  const sha1 = (x) => crypto.createHash('sha1').update(x, 'utf8').digest('hex');
  const ids = (s) => [...new Set([...s.matchAll(/#(\d+)/g)].map((m) => m[1]))];
  function reply(r, fx) {
    const p = r.pr || '';
    seenK[r.k] = (seenK[r.k] || 0) + 1;
    if (r.k === 'main' && p.includes('<transcript>')) return '=== PATCH ===\n=== BRIEF ===\nתדריך: הרצאה על מוצרים.\n=== GLOSSARY ===\n=== QUESTIONS ===\n[]';
    if (r.k === 'tl') {
      let want;
      const m = /תרגם את חלק (\d+)\/(\d+)/.exec(p);
      if (m) {
        const src = fx.slice(fx.indexOf('<source>'));
        const parts = src.split(/\n## חלק /);
        const part = parts.find((x) => x.startsWith(m[1] + '/')) || '';
        want = ids(part.split('\n').filter((l) => /^#\d+ /.test(l)).join('\n'));
      } else want = ids(p);
      return want.map((i) => '#' + i + ' זה תרגום קצר').join('\n');
    }
    if (r.k === 'rv') return '';
    if (r.k === 'jg') return ids(p).map((i) => '#' + i + ' 5 ok').join('\n');
    if (r.k === 'sub') return 'סיכום קצר.';
    return ids(p).map((i) => '#' + i + ' תיקון').join('\n');
  }
  const SID = 'srv000000e2e', STOK = SID + '-' + crypto.randomBytes(32).toString('base64url');
  db.set('studioServers/' + SID, { fields: { th: { stringValue: S.keyHash(STOK) }, by: { stringValue: 'ownerUid0001' }, seen: { integerValue: String(Date.now()) } }, ut: 's0' });
  const sh = { authorization: 'Bearer ' + STOK };
  let answered = 0;
  (async () => {
    while (!stop) {
      const r = (await handle({ op: 'ptNext', have: Object.keys(fixed), max: 8, w: 300 }, sh)).j;
      for (const [h, x] of Object.entries((r && r.fx) || {})) if (sha1(x) === h) fixed[h] = x;
      for (const q of (r && r.reqs) || []) {
        await handle({ op: 'ptMark', job: q.job, rid: q.rid, st: 's' }, sh);
        const txt = reply(q, fixed[q.fh] || '');
        await handle({ op: 'ptMark', job: q.job, rid: q.rid, st: 'd', usd: 0.001, ans: { t: txt, u: { i: 100, o: 50, cr: 0, c5: 0, c1: 0 }, st: 'end_turn', th: 0 } }, sh);
        answered++;
      }
      await new Promise((d) => setTimeout(d, 50));
    }
  })();

  // הטלפון: job.py run + auto בפייתון בלי ספריות
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-'));
  const pyw = path.join(tmp, 'py'); fs.writeFileSync(pyw, '#!/bin/sh\nexec python3 -S -E "$@"\n'); fs.chmodSync(pyw, 0o755);
  const env = Object.assign({}, process.env, { SNB_PHONE: '1', SNB_STATE: path.join(tmp, 'state'), VT_WORK: path.join(tmp, 'work'), VT_PY: pyw, PYTHONUNBUFFERED: '1',
    SNB_LADDER: 'off', SNB_LEARNMEDIA: 'off', HOME: tmp });
  const run = (args) => new Promise((d) => {
    const p = spawn(pyw, [root + '/translator/job.py'].concat(args), { env, cwd: root });
    let out = ''; p.stdout.on('data', (c) => { out += c; }); p.stderr.on('data', (c) => { out += c; });
    p.on('exit', (code) => d({ code, out }));
  });
  let r = await run(['run', '--job', JOB, '--key', cl.job.key, '--server', BASE]);
  if (r.code !== 0) console.error(r.out);
  ok(r.code === 0, 'job.py run (פייתון בלי ספריות)');
  const t0 = Date.now();
  r = await run(['auto']);
  console.log('# auto: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' שנ׳, קריאות ל־Claude: ' + answered + ' ' + JSON.stringify(seenK));
  if (r.code !== 0) console.error(r.out.slice(-4000));
  ok(r.code === 0, 'job.py auto הסתיים');
  stop = true;
  const st = doc().state.stringValue;
  ok(st === 'done', 'העבודה הסתיימה (done) — ' + st);
  const fo = JSON.parse((doc().fo || {}).stringValue || '[]');
  ok(fo.some((o) => o.k === 'srt') && fo.some((o) => o.k === 'ass'), 'התוצרים עלו ל־R2: ' + fo.map((o) => o.k).join(','));
  const use = JSON.parse(doc().use.stringValue);
  ok(use.length >= 2 && use.reduce((s, x) => s + x.n, 0) === answered, 'העלות בשרתון = כל הקריאות שנענו (' + answered + ')');
  const srtId = fo.find((o) => o.k === 'srt').id;
  const srt = R.objs.get('st/ownerUid0001/' + srtId).toString('utf8');
  ok(/זה תרגום קצר/.test(srt), 'קובץ הכתוביות בעברית');
  console.log(r.out.split('\n').filter((l) => /✓|·|⚠/.test(l)).slice(-25).join('\n'));
  srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('1..' + n);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
