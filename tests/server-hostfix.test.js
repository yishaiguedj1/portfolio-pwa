/* התקנת קובצי המארח דרך Rescue — tools/server-hostfix.js + .github/workflows/hostfix.yml. 26/10/2026.
   Hetzner, Firestore, SSH והשרתונים מדומים — בלי רשת ובלי סודות. הסקריפט של ה־Rescue רץ באמת (sh) על תיקייה
   שמדמה את הדיסק של השרת. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const H = require('../tools/server-hostfix.js');
const S = require('../ibkr-proxy/lib/studio.js');

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { bad++; console.log('not ok - ' + m); } };
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const SA = (p) => JSON.stringify({ type: 'service_account', project_id: p, client_email: 'x@' + p + '.iam.gserviceaccount.com', private_key: pem, token_uri: 'https://oauth2.googleapis.com/token' });
const PROD = 'yishaiguedj1-c786e', STG = 'snowball-staging-758f6';
const E = { HCLOUD_TOKEN: 'H'.repeat(64), PROD_FIREBASE_SA: SA(PROD), STG_FIREBASE_SA: SA(STG) };
const T0 = Date.parse('2026-10-26T08:00:00Z');
const MIN = 60e3;

/* הסקריפט על "שרת" מדומה */
function fakeRoot(o = {}) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-root-'));
  for (const d of ['opt/snb', 'usr/local/lib/snb', 'usr/local/sbin', 'var/lib/docker/overlay2/l1', 'var/lib/docker/volumes/snb_work/_data', 'var/lib/docker/volumes/snb_cache/_data', 'var/log/journal', 'var/lib/docker/image/overlay2/imagedb/content/sha256']) fs.mkdirSync(path.join(r, d), { recursive: true });
  fs.writeFileSync(path.join(r, 'var/lib/docker/overlay2/l1/blob'), Buffer.alloc(300 * 1024));
  for (const i of [1, 2, 3]) fs.writeFileSync(path.join(r, 'var/lib/docker/image/overlay2/imagedb/content/sha256', 'img' + i), 'x');
  fs.writeFileSync(path.join(r, 'usr/local/sbin/snb-update'), '#!/bin/sh\necho old\n');
  fs.writeFileSync(path.join(r, 'usr/local/lib/snb/common.sh'), read('infra/host/snb-common.sh'));   // זהה — "same"
  fs.writeFileSync(path.join(r, 'opt/snb/compose.yaml'), 'old: 1\n');
  if (o.busy) fs.writeFileSync(path.join(r, 'var/lib/docker/volumes/snb_work/_data/.busy'), 'j');
  return r;
}
function runScript(script, root) {
  const r = cp.spawnSync('sh', ['-s'], { input: script, encoding: 'utf8', env: Object.assign({}, process.env, { SNB_TEST_ROOT: root }) });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/* העולם המדומה. o: busyUntil, sshNever, scriptFail, diskAfter, keyLeft, ruleLeft */
function world(o = {}) {
  const w = {
    now: T0, acts: [], calls: [], rules: o.ruleLeft ? [{ direction: 'in', protocol: 'tcp', port: '22', source_ips: ['9.9.9.9/32'], description: 'snb-hostfix' }] : [],
    keys: o.keyLeft ? [{ id: 5, name: 'snb-hostfix-1' }] : [], keyN: 10,
    srv: { status: 'running', rescue: false, inRescue: false, bootAt: 0 }, actN: 0, sshScripts: [], root: o.root,
    docs: {
      [PROD]: { p1: { name: 'snb-cx43', seen: T0, paused: false, job: '', hb: { nj: 0, disk: 88.9 }, th: 'x' } },
      [STG]: { s1: { name: 'snb-cx43', seen: T0, paused: false, job: '', hb: { nj: 0, disk: 88.9 }, th: 'y' } },
    },
  };
  const res = (status, j) => ({ status, json: async () => j, text: async () => (typeof j === 'string' ? j : JSON.stringify(j)) });
  const status = () => { if (w.srv.status === 'stopping' && w.now >= w.offAt) w.srv.status = 'off'; return w.srv.status; };
  const agent = () => {
    if (status() !== 'running' || w.srv.inRescue) return;
    const busy = o.busyUntil && w.now < o.busyUntil;
    for (const p of [PROD, STG]) for (const d of Object.values(w.docs[p])) {
      d.seen = w.now;
      d.hb = Object.assign({}, d.hb, { busy: busy && p === PROD ? 'J1' : '' });
      if (busy && p === PROD) d.hb.nj = 1; else delete d.hb.nj;
      // snb-update החדש: 2 דק׳ אחרי עלייה רגילה מוחק תמונות
      if (w.installed && w.srv.bootAt && w.now >= w.srv.bootAt + 3 * MIN) d.hb.disk = o.diskAfter == null ? 21.4 : o.diskAfter;
    }
  };
  const fetch = async (url, init = {}) => {
    const m = init.method || 'GET';
    w.calls.push({ m, url, t: w.now, body: init.body });
    if (url === 'https://oauth2.googleapis.com/token') return res(200, { access_token: 'ya29.t', expires_in: 3600 });
    if (url.endsWith('/healthz')) return (status() === 'running' && !w.srv.inRescue) ? { status: 200, text: async () => 'ok' } : res(503, 'down');
    if (url.startsWith('https://firestore.googleapis.com/')) {
      const project = url.split('/projects/')[1].split('/')[0];
      agent();
      if (m === 'GET' && url.includes('/documents/studioServers?')) return res(200, { documents: Object.entries(w.docs[project]).map(([id, d]) => ({ name: 'projects/' + project + '/databases/(default)/documents/studioServers/' + id, fields: S.toFields(d) })) });
      if (m === 'PATCH' && url.includes('/documents/studioServers/')) {
        const id = decodeURIComponent(url.split('/studioServers/')[1].split('?')[0]);
        const mask = [...url.matchAll(/updateMask\.fieldPaths=([A-Za-z0-9_]+)/g)].map((x) => x[1]);
        const got = S.fromFields(JSON.parse(init.body).fields);
        for (const k of mask) w.docs[project][id][k] = got[k];
        return res(200, {});
      }
      if (m === 'POST' && url.endsWith(':runQuery')) return res(200, [{ readTime: 'x' }]);
      return res(404, {});
    }
    if (url.startsWith('https://api.hetzner.cloud/v1')) {
      const p = url.slice('https://api.hetzner.cloud/v1'.length);
      const view = () => ({ id: 42, name: 'snb-cx43', status: status(), rescue_enabled: w.srv.rescue, server_type: { name: 'cx43', cores: 8 }, location: { name: 'fsn1' }, public_net: { ipv4: { ip: '203.0.113.7' } } });
      if (m === 'GET' && p === '/servers?per_page=50') return res(200, { servers: [view()] });
      if (m === 'GET' && p === '/servers/42') return res(200, { server: view() });
      if (m === 'GET' && p === '/firewalls?name=snb-closed') return res(200, { firewalls: [{ id: 9, name: 'snb-closed', rules: w.rules }] });
      if (m === 'POST' && p === '/firewalls/9/actions/set_rules') { w.rules = JSON.parse(init.body).rules; w.acts.push({ a: 'set_rules', n: w.rules.length, t: w.now }); return res(201, { actions: [{ id: ++w.actN }] }); }
      if (m === 'GET' && p === '/ssh_keys?per_page=50') return res(200, { ssh_keys: w.keys });
      if (m === 'POST' && p === '/ssh_keys') { const k = { id: ++w.keyN, name: JSON.parse(init.body).name }; w.keys.push(k); return res(201, { ssh_key: k }); }
      const dk = p.match(/^\/ssh_keys\/(\d+)$/);
      if (m === 'DELETE' && dk) { w.keys = w.keys.filter((k) => k.id !== +dk[1]); return res(204, null); }
      const act = p.match(/^\/servers\/42\/actions\/([a-z_]+)$/);
      if (m === 'POST' && act) {
        const a = act[1];
        w.acts.push({ a, t: w.now, body: init.body ? JSON.parse(init.body) : {} });
        if (a === 'enable_rescue') w.srv.rescue = true;
        else if (a === 'disable_rescue') w.srv.rescue = false;
        else if (a === 'shutdown') { if (status() === 'running') { w.srv.status = 'stopping'; w.offAt = w.now + 40e3; } }
        else if (a === 'poweroff') w.srv.status = 'off';
        else if (a === 'poweron' && status() === 'off') {
          w.srv.status = 'running';
          w.srv.inRescue = w.srv.rescue; w.srv.rescue = false;   // Rescue = לאתחול הבא בלבד (כמו ב־Hetzner)
          if (!w.srv.inRescue) w.srv.bootAt = w.now;
        }
        return res(201, { action: { id: ++w.actN, status: 'running' } });
      }
      if (m === 'GET' && /^\/actions\/\d+$/.test(p)) return res(200, { action: { status: 'success' } });
      return res(404, {});
    }
    return res(404, {});
  };
  w.deps = {
    fetch, now: () => w.now, sleep: async (ms) => { w.now += ms; },
    myIp: async () => '198.51.100.4',
    keygen: () => ({ path: '/tmp/k', pub: 'ssh-ed25519 AAAA snb-hostfix' }),
    shCheck: (s) => cp.execFileSync('sh', ['-n'], { input: s }),
    ssh(ip, key, script) {
      w.sshScripts.push({ ip, t: w.now, rule: w.rules.find((r) => r.description === 'snb-hostfix') });
      if (o.sshNever || !w.srv.inRescue || status() !== 'running') return { code: 255, out: '' };
      if (script === 'true') return { code: 0, out: '' };
      if (o.scriptFail) return { code: 3, out: 'SNBERR noroot\n' };
      const r = runScript(script, w.root);
      if (r.out.includes('SNBOK')) w.installed = true;
      return r;
    },
  };
  w.names = () => w.acts.map((x) => x.a);
  return w;
}

(async () => {
  // ---------------- הסקריפט עצמו, על דיסק מדומה
  const files = H.loadFiles(ROOT);
  const script = H.rescueScript(files);
  ok(cp.spawnSync('sh', ['-n'], { input: script }).status === 0, 'הסקריפט של ה־Rescue תקין תחבירית');
  // 28/10/2026: compose.ibgw.yaml — רק ב־hostfix (snb-host-apply בתמונת העובד נשאר עם שלושת הקבצים)
  const HA = H.FILES.filter((f) => f[1] !== 'opt/snb/compose.ibgw.yaml');
  ok(JSON.stringify(HA.map((f) => f[1])) === JSON.stringify(['usr/local/lib/snb/common.sh', 'opt/snb/compose.yaml', 'usr/local/sbin/snb-update']), 'אותם יעדים כמו snb-host-apply');
  ok(H.FILES.some((f) => f[0] === 'infra/compose.ibgw.yaml' && f[1] === 'opt/snb/compose.ibgw.yaml' && f[2] === '644'), 'compose.ibgw.yaml מותקן ב־hostfix');
  const ha = read('infra/worker/snb-host-apply');
  ok(HA.every(([src, dst, mode]) => ha.includes(':' + dst + ':' + mode)), 'אותן הרשאות כמו snb-host-apply');
  // הסיסמה של ה־Paper: רק כשיש סודות; 0600; לא נבדקת כסקריפט; ערך לא תקין — עוצרים לפני שנוגעים בשרת
  ok(H.loadFiles(ROOT, {}).every((f) => f.src !== 'secret'), 'בלי סודות IBGW — לא נוגעים ב־ibgw.env');
  const gwf = H.loadFiles(ROOT, { IBGW_PAPER_USER: 'paperusr1', IBGW_PAPER_PASS: 'Abc!def%123' }).find((f) => f.src === 'secret');
  ok(gwf && gwf.dst === 'etc/snb/ibgw.env' && gwf.mode === '600' && String(gwf.body) === 'TWS_USERID=paperusr1\nTWS_PASSWORD=Abc!def%123\n', 'ibgw.env — 0600, שתי שורות');
  let threw = '';
  try { H.loadFiles(ROOT, { IBGW_PAPER_USER: 'paperusr1', IBGW_PAPER_PASS: 'has$dollar1' }); } catch (x) { threw = x.message; }
  ok(/IBGW_PAPER_PASS/.test(threw) && !threw.includes('has$dollar1'), 'סיסמה עם $ — נעצר, והסיסמה לא בהודעה');
  {
    const rr = fakeRoot();
    fs.mkdirSync(path.join(rr, 'etc/snb'), { recursive: true });
    const rs = runScript(H.rescueScript([gwf]), rr);
    ok(rs.code === 0 && (fs.statSync(path.join(rr, 'etc/snb/ibgw.env')).mode & 0o777) === 0o600 && !rs.out.includes('Abc!def'), 'ב־Rescue: ‏ibgw.env נכתב 0600, בלי הסיסמה בפלט');
  }
  let root = fakeRoot();
  let r = runScript(script, root);
  let o = H.parseOut(r.out);
  ok(r.code === 0 && o.ok, 'הסקריפט רץ עד הסוף');
  ok(fs.readFileSync(path.join(root, 'usr/local/sbin/snb-update'), 'utf8') === read('infra/host/snb-update'), 'snb-update החדש הותקן בדיוק');
  ok((fs.statSync(path.join(root, 'usr/local/sbin/snb-update')).mode & 0o777) === 0o755, 'snb-update — 755');
  ok(fs.readFileSync(path.join(root, 'opt/snb/compose.yaml'), 'utf8') === read('infra/compose.yaml'), 'compose.yaml הותקן');
  ok(o.put.includes('/usr/local/sbin/snb-update') && o.same.includes('/usr/local/lib/snb/common.sh'), 'מדווח מה הוחלף ומה היה זהה');
  ok(!fs.readdirSync(path.join(root, 'usr/local/sbin')).some((f) => f.endsWith('.snb-new')), 'בלי קבצים זמניים שנשארו');
  ok(o.du.images >= 300 && o.du.volumes != null && o.du.journal != null && o.img === 3 && o.vol.snb_work != null && o.df && o.df.total > 0, 'מודד: תמונות, תיקיות, יומן, מספר תמונות, הדיסק');
  ok(/תמונות Docker/.test(H.report(o)) && /מספר התמונות: 3/.test(H.report(o)), 'הדוח בעברית, מספרים בלבד');
  r = runScript(script, root);
  ok(H.parseOut(r.out).put.length === 0, 'הרצה שנייה — הכל זהה, לא נוגע');
  // קובץ שבור לא מותקן
  const broken = H.rescueScript([{ dst: 'usr/local/sbin/snb-update', mode: '755', body: Buffer.from('if then fi (\n') }]);
  root = fakeRoot();
  r = runScript(broken, root);
  ok(r.code === 4 && H.parseOut(r.out).err === 'syntax' && fs.readFileSync(path.join(root, 'usr/local/sbin/snb-update'), 'utf8').includes('old'), 'סקריפט עם שגיאת תחביר — לא מותקן, הישן נשאר');
  // בלי המחיצה של השרת
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-empty-'));
  r = runScript(script, empty);
  ok(r.code === 3 && H.parseOut(r.out).err === 'noroot', 'לא נמצאה המחיצה של השרת — לא כותב כלום');
  ok(H.parseOut('SNBDU images 5\nSNBDU x y\nrm -rf /\nSNBPUT /etc/../x\nSNBVOL a;b 4').put.length === 0 && Object.keys(H.parseOut('SNBDU images 5\nSNBDU x y').du).length === 1, 'הפענוח מקבל רק שורות בצורה הקבועה');

  // ---------------- מקצה לקצה
  let w = world({ root: fakeRoot() });
  let res = await H.apply(E, w.deps, { root: ROOT });
  ok(res.out && res.out.ok && w.installed, 'הותקן דרך Rescue');
  const nm = w.names();
  ok(nm.indexOf('enable_rescue') > -1 && nm.indexOf('set_rules') < nm.indexOf('enable_rescue'), 'הכלל בחומת האש לפני Rescue');
  ok(w.sshScripts.every((s) => s.rule && s.rule.source_ips[0] === '198.51.100.4/32' && s.rule.port === '22'), 'SSH רק כשהכלל קיים, ורק מהכתובת של ההרצה (/32)');
  ok(w.rules.length === 0, 'בסוף — חומת האש סגורה שוב (בלי אף כלל נכנס)');
  ok(w.keys.length === 0, 'בסוף — המפתח נמחק מ־Hetzner');
  ok(!w.srv.rescue && !w.srv.inRescue && w.srv.status === 'running', 'בסוף — השרת דולק במערכת הרגילה, Rescue כבוי');
  ok(res.disk0 === 88.9 && res.disk1 === 21.4, 'הדיסק ירד (לפי העובד): 88.9% → 21.4%');
  ok(!w.docs[PROD].p1.paused && !w.docs[STG].s1.paused, 'ההשהיה הוסרה');
  const pauseOffAt = w.calls.filter((c) => c.m === 'PATCH' && /paused/.test(c.url) && c.body && c.body.includes('"booleanValue":false')).map((c) => c.t);
  ok(pauseOffAt.length && pauseOffAt[0] >= w.srv.bootAt + 3 * MIN, 'ההשהיה יורדת רק אחרי ש־snb-update רץ בשרת (לא עבודה בקונטיינר שעוד יוחלף)');

  // עבודה רצה — מחכים לה לפני שנוגעים
  w = world({ root: fakeRoot(), busyUntil: T0 + 40 * MIN });
  res = await H.apply(E, w.deps, { root: ROOT });
  const firstOff = w.acts.find((a) => a.a === 'shutdown');
  ok(res.out.ok && firstOff && firstOff.t >= T0 + 40 * MIN, 'עבודה רצה — הכיבוי רק אחריה');

  // עבודה שלא נגמרת — לא נוגעים בשרת, ההשהיה יורדת
  w = world({ root: fakeRoot(), busyUntil: T0 + 10 * 3600e3 });
  let err = null;
  try { await H.apply(E, w.deps, { root: ROOT }); } catch (x) { err = x; }
  ok(err && err.code === 'busy' && !w.names().includes('shutdown') && !w.names().includes('enable_rescue'), 'עבודה לא נגמרת בשעתיים — בלי כיבוי ובלי Rescue');
  ok(!w.docs[PROD].p1.paused && w.rules.length === 0 && w.keys.length === 0, '…וההשהיה, הכלל והמפתח לא נשארו');

  // Rescue לא עונה ב־SSH — חוזרים למערכת הרגילה, לא נשארים כבויים
  w = world({ root: fakeRoot(), sshNever: true });
  err = null;
  try { await H.apply(E, w.deps, { root: ROOT }); } catch (x) { err = x; }
  ok(err && err.code === 'no_ssh', 'Rescue לא עונה — שגיאה ברורה');
  ok(w.srv.status === 'running' && !w.srv.inRescue && !w.srv.rescue && w.rules.length === 0 && w.keys.length === 0 && !w.docs[STG].s1.paused, '…והשרת חזר למערכת הרגילה, הכל נוקה');

  // הסקריפט נכשל — אותו דבר
  w = world({ root: fakeRoot(), scriptFail: true });
  err = null;
  try { await H.apply(E, w.deps, { root: ROOT }); } catch (x) { err = x; }
  ok(err && err.code === 'rescue_noroot' && w.srv.status === 'running' && !w.srv.inRescue && w.rules.length === 0, 'הסקריפט נכשל — השרת חוזר למערכת הרגילה');

  // שאריות מריצה שנקטעה — מנוקות (גם ב־clean לבד)
  w = world({ root: fakeRoot(), keyLeft: true, ruleLeft: true });
  const done = await H.clean(E, w.deps);
  ok(w.rules.length === 0 && w.keys.length === 0 && done.includes('fw') && done.includes('key'), 'clean מוחק כלל ומפתח שנשארו');
  w.docs[PROD].p1.paused = true; w.docs[PROD].p1.upz = T0 - MIN;
  await H.clean(E, w.deps);
  ok(!w.docs[PROD].p1.paused, 'clean מסיר השהיה שלנו');
  w.docs[STG].s1.paused = true; delete w.docs[STG].s1.upz;
  await H.clean(E, w.deps);
  ok(w.docs[STG].s1.paused === true, 'השהיה של המנהל (בלי upz) — לא נוגעים');
  // check — בלי שום שינוי
  w = world({ root: fakeRoot() });
  const txt = await H.check(E, w.deps);
  ok(/88\.9%/.test(txt) && w.acts.length === 0 && !w.calls.some((c) => c.m === 'PATCH'), 'check — רק קריאה');

  // ---------------- ה־workflow
  const wf = read('.github/workflows/hostfix.yml');
  ok(/workflow_dispatch/.test(wf) && !/schedule:/.test(wf), 'ידני בלבד');
  ok(/environment:\s*production/.test(wf), 'באישור (סביבה production)');
  ok(/github\.ref == 'refs\/heads\/main'/.test(wf), 'רק מ־main');
  ok(/if: always\(\)[\s\S]*server-hostfix\.js clean/.test(wf), 'צעד ניקוי שתמיד רץ');
  ok(/permissions: \{\}/.test(wf) && /persist-credentials: false/.test(wf), 'בלי הרשאות מיותרות');
  ok(!/HCLOUD_TOKEN \}\}[^\n]*echo/.test(wf) && !/set -x/.test(wf), 'הטוקן לא מודפס');

  console.log('\n' + (n - bad) + '/' + n);
  process.exit(bad ? 1 : 0);
})().catch((x) => { console.error(x); process.exit(1); });
