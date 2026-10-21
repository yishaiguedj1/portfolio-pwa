// 15/10/2026 — מאגר הלמידה מ׳3: מה קרה אחרי העבודה. (1) ההשוואה בעורך (studiosubs.js editDiff/editStats) — לפי חפיפה בזמן,
// לא לפי מזהים; (2) המדדים (lib/studiolearn.js normUx/mergeUx, כמו בטלפון — UX_SHAPE זהה); (3) השרתון האמיתי:
// cuesSave עם pe (מספרים → job.ux → הרשומה במאגר) ו־pt (הטקסט לפני/אחרי → מוצפן בתור qe/, מצטבר, רק עם ההסכמה),
// op learnUx (צפייה, הורדות, הצעות, AI, מונחים), האצווה qe → e/<חודש>, "מחק את התרומות שלי", learnPull עם העריכות.
// הרצה: node tests/learn-ux.test.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ACC } = require('./_r2fake');

(async () => {
  const E = await import(path.join(root, 'studiosubs.js'));
  const LR = require(path.join(root, 'ibkr-proxy/lib/studiolearn.js'));
  const LC = require(path.join(root, 'ibkr-proxy/lib/learncorpus.js'));
  const cue = (i, s, e, lines, en) => ({ i, s, e, lines, en: en || '', spk: '' });
  const base = [cue(1, 1, 4, ['שלום לכולם וברוכים הבאים'], 'Hello everyone and welcome'), cue(2, 4.2, 6, ['היום נדבר'], 'Today we talk'),
    cue(3, 8, 10, ['על השקעות'], 'about investing'), cue(4, 11, 12, ['סוף']), cue(5, 13, 14, ['למחיקה'])];

  /* ---------- 1. ההשוואה (טהור) ---------- */
  ok(E.editDiff(base, base).length === 0 && E.editDiff(base, base.map((c) => Object.assign({}, c, { i: c.i + 100 }))).length === 0, 'בלי שינוי — כלום (גם כשהמזהים מתחלפים אחרי שמירה)');
  let c = E.setText(base, 1, 'היום נדבר על כסף');
  let d = E.editDiff(base, c);
  ok(d.length === 1 && d[0].t === 'txt' && !d[0].m && d[0].wd === 2 && d[0].en === 'Today we talk' && d[0].b[0].h === 'היום נדבר' && d[0].a[0].h === 'היום נדבר על כסף', 'שינוי טקסט: לפני/אחרי, המקור באנגלית, מרחק במילים');
  c = E.nudge(base, 2, 's', 0.3); d = E.editDiff(base, c);
  ok(d.length === 1 && d[0].t === 'tm' && d[0].cd === 0, 'רק זמן — tm');
  c = E.nudge(E.setText(base, 2, 'על כסף'), 2, 'e', -0.5); d = E.editDiff(base, c);
  ok(d.length === 1 && d[0].t === 'txt' && d[0].m === 1, 'טקסט וזמן יחד — txt עם m');
  c = E.splitCue(base, 0, 9); d = E.editDiff(base, c);
  ok(d.length === 1 && d[0].t === 'sp' && d[0].b.length === 1 && d[0].a.length === 2 && d[0].wd === 0, 'פיצול — sp (אותן מילים)');
  c = E.mergeCues(base, 1); d = E.editDiff(base, c);
  ok(d.length === 1 && d[0].t === 'mg' && d[0].b.length === 2 && d[0].a.length === 1, 'מיזוג — mg');
  c = E.deleteCue(base, 4); d = E.editDiff(base, c);
  ok(d.length === 1 && d[0].t === 'del' && d[0].a.length === 0, 'מחיקה — del');
  d = E.editDiff(base, base.concat([cue(-1, 20, 21, ['חדשה'])]));
  ok(d.length === 1 && d[0].t === 'add', 'כתובית חדשה — add');
  c = E.shiftAll(base, 0.2); d = E.editDiff(base, c);
  ok(d.length === base.length && d.every((x) => x.t === 'tm'), 'הזזה של הכל — כל כתובית tm (לא "מורכב")');
  const many = E.mergeCues(E.setText(E.splitCue(base, 0, 9), 2, 'היום נדבר על כסף'), 3);
  const st = E.editStats(E.editDiff(base, many), many);
  ok(st.n === 3 && st.sp === 1 && st.txt === 1 && st.mg === 1 && st.wd === 2 && st.wa > 10 && st.ca > 30, 'הסיכום: לכל סוג, המרחקים והמכנה (מילים/תווים בגרסה האחרונה)');
  const sj = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
  const shape = JSON.parse(sj.match(/export const UX_SHAPE = (\{[^\n]*\});/)[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":'));
  ok(JSON.stringify(shape) === JSON.stringify(LR.UX_SHAPE), 'UX_SHAPE בטלפון = בשרתון');
  ok(LR.UX_SHAPE.e.filter((k) => E.ED_KINDS.includes(k)).join() === E.ED_KINDS.join() && Object.keys(E.editStats([], [])).every((k) => LR.UX_SHAPE.e.includes(k)), 'כל מה ש־editStats מחזיר — בצורה של השרתון');

  /* ---------- 2. המדדים (טהור) ---------- */
  ok(LR.normUx({ e: { s: 1, wd: 3.4, bad: 9, wa: -1 }, pl: { cov: 1.7, n: 1 }, zz: { a: 1 }, o: 'x' }) && JSON.stringify(LR.normUx({ e: { s: 1, wd: 3.4, bad: 9, wa: -1 }, pl: { cov: 1.7, n: 1 }, zz: { a: 1 } })) === JSON.stringify({ e: { s: 1, wd: 3 }, pl: { n: 1, cov: 1 } }), 'normUx: רק מפתחות ידועים, מספרים חיוביים, cov עד 1');
  ok(LR.normUx({ x: 1 }) === null && LR.normUx('a') === null && LR.normUx([1]) === null, 'normUx: בלי שום דבר ידוע — null');
  const mg = LR.mergeUx({ e: { s: 1, wd: 3, wa: 20 }, pl: { cov: 0.5, n: 1, sec: 30 } }, { e: { s: 1, wd: 2, wa: 22 }, pl: { cov: 0.3, n: 1, sec: 10 }, sg: { a: 1 } });
  ok(mg.e.s === 2 && mg.e.wd === 5 && mg.e.wa === 22 && mg.pl.cov === 0.5 && mg.pl.n === 2 && mg.pl.sec === 40 && mg.sg.a === 1, 'mergeUx: מחבר; cov — המקסימום; wa — האחרון');
  ok(JSON.stringify(LR.mergeUx(null, { zz: 1 })) === 'null' || LR.mergeUx(null, { zz: 1 }) === null, 'mergeUx: תוספת לא תקינה — לא משנה');
  const now0 = Date.UTC(2026, 9, 15);
  const recOf = (ux, st) => ({ v: LR.LR_V, k: 'tr', st: st || 'done', at: now0 - 3600e3, use: [], t: {}, dur: 600, ux });
  const kp = LR.kpis([recOf({ e: { s: 1, wd: 10, wa: 100 }, pl: { n: 1, cov: 0.9 }, sg: { a: 3, r: 1 } }), recOf({ e: { s: 2, wd: 30, wa: 100 }, pl: { n: 2, cov: 0.5 } }), recOf(null)]);
  ok(kp.ht === 0.2 && kp.edr === 0.667 && kp.cov === 0.7 && kp.sga === 0.75, 'המדדים: HTER על מה שנערך, חלק העבודות שנערכו, חציון הצפייה, הצעות שהתקבלו');
  const lrec = LR.learnRec({ id: 'j' + 'A'.repeat(20), kind: 'tr', state: 'done', created: now0, spec: { dur: 600 }, ux: { e: { s: 1, wd: 4 }, o: { dl: 2 } } }, now0, () => ({ state: 'done' }));
  ok(lrec && lrec.ux && lrec.ux.e.wd === 4 && lrec.ux.o.dl === 2, 'הרשומה במאגר כוללת את ux');
  const ssrc = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
  const sjm = +sj.match(/const LRN_MV = (\d+)/)[1], svv = +ssrc.match(/const LRN_MV = (\d+)/)[1];
  ok(sjm === 3 && sjm === svv, 'LRN_MV בטלפון = LRN_MV בשרתון (מ׳4: הנוסח של הקול וה־240p)');
  const sjv = +sj.match(/export const LRN_TV = (\d+)/)[1], svf = +ssrc.match(/const LRN_FV = (\d+)/)[1];
  ok(sjv === 4 && sjv === svf, 'LRN_TV בטלפון = LRN_FV בשרתון (15/10: הנוסח של האיסוף המלא)');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const he = app.match(/studioLrnAckQ: "([^"]*)"/)[1], en = app.match(/studioLrnAckQ: "([^"]*)"/g)[1];
  ok(/טקסט/.test(he) && /שמות הדוברים/.test(he) && /24 חודשים/.test(he) && !/בלי טקסט|רק מספרים/.test(he) && /subtitle text/.test(en) && !/no text/i.test(en), 'ההודעה אומרת שגם הטקסט ושמות הדוברים נשמרים (בעברית ובאנגלית)');
  ok(/\(full \? ui\.lrf : ui\.lrm\) \|\| ui\.access/.test(sj) && /learnPref', \{ ack: true, tv: full \? LRN_TV : LRN_MV \}/.test(sj), 'הטלפון מציג את ההודעה לפי lrm/lrf ושולח את הגרסה');
  const brief = LR.learnBrief(LR.learnView([Object.assign(recOf({ e: { s: 1, wd: 1, wa: 10 } }), { id: 'x', eng: 'api' })], now0), now0);
  ok(/`ux`/.test(brief) && /HTER/.test(brief), 'החבילה לניתוח מסבירה את ux ואת HTER');

  /* ---------- 3. הקורפוס — העריכות (טהור) ---------- */
  const s1 = { ws: 42, ch: E.editDiff(base, E.setText(base, 1, 'כתבו ל־dana@example.com')) };
  const it1 = LC.addEdits(null, s1, '2026-10');
  ok(it1 && it1.k === 'ed' && it1.m === '2026-10' && it1.ss.length === 1 && it1.ss[0].ws === 42 && it1.ss[0].ch[0].a[0].h === 'כתבו ל־⟨מייל⟩', 'addEdits: שמירה ראשונה, מנוקה');
  const it2 = LC.addEdits(it1, { ch: [{ t: 'zz' }, { t: 'del', b: [{ s: 13, e: 14, h: 'x', extra: 1 }], secret: 1 }] }, '2026-12');
  ok(it2.ss.length === 2 && it2.m === '2026-10' && it2.ss[1].ch.length === 1 && !('extra' in it2.ss[1].ch[0].b[0]) && !('secret' in it2.ss[1].ch[0]), 'addEdits: מצטבר, החודש הראשון נשאר, רק שדות מותרים');
  ok(LC.addEdits(it1, { ch: [] }, '2026-10') === null && LC.addEdits(it1, null, '2026-10') === null, 'addEdits: בלי שינויים — לא נשמר');
  let big = null; for (let k = 0; k < 50; k++) big = LC.addEdits(big, { ch: [{ t: 'tm', b: [{ s: k, e: k + 1, h: 'a' }], a: [{ s: k, e: k + 1.5, h: 'a' }] }] }, '2026-10');
  ok(big.ss.length === LC.ED_SS, 'עד ' + LC.ED_SS + ' שמירות — הישנות יוצאות');
  ok(LC.parseKey('qe/' + 'a'.repeat(20) + '.bin').kind === 'qe' && LC.parseKey('e/2026-10/' + 'b'.repeat(20) + '.bin').kind === 'e' && LC.parseKey('e/x/y.bin') === null, 'מפתחות qe/ ו־e/<חודש>/');

  /* ---------- 2. השרתון ---------- */
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, {
    R2L_ACCOUNT_ID: ACC, R2L_ACCESS_KEY_ID: 'AKTEST', R2L_SECRET_ACCESS_KEY: 'sekret/xyz', R2L_BUCKET: 'snb-studio',   // הדלי המדומה היחיד
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', STUDIO_USERS: 'other@example.com', SNB_SITEWATCH: 'off', SNB_ADMINWATCH: 'off',
  });
  delete process.env.IBKR_VAULT_KEY;
  Object.assign(process.env, { R2_ACCOUNT_ID: ACC, R2_ACCESS_KEY_ID: 'AKTEST', R2_SECRET_ACCESS_KEY: 'sekret/xyz', R2_BUCKET: 'snb-studio' });   // גם קבצי העבודה ב־R2 המדומה
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  gauth._reset(); studio._reset(); R2._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const tok = (sub, email) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  const OWNER = tok('ownerUid0001', 'owner@example.com');
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
    const lm = url.match(/\/documents\/([A-Za-z]+)\?(.*)$/);
    if (lm && (opt.method || 'GET') === 'GET') return J({ documents: [] });
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
  let NOW = R.now;
  const deps = () => ({ verify: { keys }, fetch: fetchAll, now: NOW });
  const call = async (body, worker, get) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    const req = { method: get ? 'GET' : 'POST', query: {}, body, headers: worker || get ? {} : { origin: 'https://yishaiguedj1.github.io' }, socket: { remoteAddress: '9.9.9.9' } };
    await studio._handler(req, res, deps());
    return res;
  };
  const api = (op, b) => call(Object.assign({}, b, { op, idToken: OWNER })).then((r) => r.j);
  const spec = { name: 'my-private-lecture.mp4', size: 1000, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'sonnet-medium', out: ['srt'] };
  const newJob = async () => {
    const j = await api('create', { spec });
    const id = j.job.id, key = crypto.randomBytes(32).toString('base64url');
    Object.assign(db.get('studioJobs/' + id).fields, { kh: { stringValue: crypto.createHash('sha256').update(key).digest('hex') }, kx: { integerValue: String(NOW + 3600e3) }, state: { stringValue: 'running' } });
    return { id, put: (lc) => call({ op: 'learnPut', job: id, key, lc }, true).then((r) => r.j) };
  };
  const body = (o) => zlib.gzipSync(Buffer.from(JSON.stringify(o))).toString('base64');
  const keysIn = async (pre) => (await R2.list(R2.config({ R2_ACCOUNT_ID: ACC, R2_ACCESS_KEY_ID: 'AKTEST', R2_SECRET_ACCESS_KEY: 'sekret/xyz', R2_BUCKET: 'snb-studio' }), { fetch: fetchAll, now: () => NOW }, pre)).map((x) => x.key);

  const SR = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const keysIn2 = keysIn;
  ok((await api('learnPref', { ack: true, tv: 2 })).lrt > 0, 'הנוסח שאומר שהטקסט נשמר — נקרא (lrt)');
  const cfgMain = R2.config(), rdm = { fetch: fetchAll, now: () => NOW };
  const mkJob = async () => {
    const j = await api('create', { spec });
    const id = j.job.id, folder = 'R2_' + id;
    const f = (k) => folder + '_' + crypto.randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, 'x').slice(0, 12);
    const cid = f('c'), sid = f('s'), c0 = f('o');
    for (const x of [cid, sid, c0]) await R2.putText(cfgMain, rdm, 'st/ownerUid0001/' + x, '[{"id":1}]', 'application/json');
    Object.assign(db.get('studioJobs/' + id).fields, { state: { stringValue: 'done' }, folder: { stringValue: folder }, ended: { integerValue: String(NOW - 1000) },
      fo: { stringValue: JSON.stringify([{ id: c0, name: 'c', k: 'cues', size: 9 }]) } });
    return { id, cid, sid };
  };
  const J1 = await mkJob();
  const after = E.mergeCues(E.setText(base, 1, 'היום נדבר על כסף — dana@example.com'), 3);
  const diff = E.editDiff(base, after);
  const pe = Object.assign(E.editStats(diff, after), { ws: 120 });
  let r = await api('cuesSave', { job: J1.id, c: J1.cid, s: J1.sid, ev: 0, pe, pt: { ws: 120, ch: diff } });
  ok(r && r.ok, 'cuesSave עם המדדים והטקסט — עובר');
  const jf = SR.fromFields(db.get('studioJobs/' + J1.id).fields);
  ok(jf.ux && jf.ux.e.s === 1 && jf.ux.e.ws === 120 && jf.ux.e.txt === 1 && jf.ux.e.mg === 1 && jf.ux.e.wa === pe.wa, 'job.ux: השמירה נספרת, לכל סוג, זמן העבודה');
  const lr1 = SR.fromFields(db.get('studioLearn/' + LR.lid(J1.id)).fields).lr;
  ok(lr1 && lr1.ux && lr1.ux.e.wd === pe.wd && !/dana|היום נדבר/.test(JSON.stringify(lr1)), 'הרשומה במאגר: המספרים — בלי טקסט');
  let qk = await keysIn2('qe/');
  ok(qk.length === 1 && qk[0] === 'qe/' + LR.lid(J1.id) + '.bin' && jf.le === '2026-10', 'הטקסט — בתור qe/ לפי המזהה המגובב; job.le = החודש');
  const sealedE = Buffer.from(R.objs.get('snb-studio/' + qk[0]) || R.objs.get(qk[0]) || '').toString('utf8');
  ok(sealedE.startsWith('v1.') && !/dana|כסף|ownerUid0001|my-private-lecture/.test(sealedE), 'בדלי — מוצפן');
  r = await api('cuesSave', { job: J1.id, c: J1.sid, s: J1.cid, ev: 1, pe: { n: 1, tm: 1, wa: 30 }, pt: { ws: 5, ch: E.editDiff(after, E.nudge(after, 0, 's', 0.3)) } });
  ok(r && r.ok, 'שמירה שנייה');
  const jf2 = SR.fromFields(db.get('studioJobs/' + J1.id).fields);
  ok(jf2.ux.e.s === 2 && jf2.ux.e.tm === 1 && jf2.ux.e.wa === 30, 'job.ux מצטבר; המכנה — מהשמירה האחרונה');
  /* op learnUx */
  r = await api('learnUx', { job: J1.id, ux: { pl: { n: 1, sec: 300, cov: 0.5 }, o: { dl: 1, sh: 2 }, sg: { a: 2, r: 1 }, ai: { q: 4, a: 3, r: 1 }, gl: { a: 2 } } });
  ok(r && r.ok, 'learnUx — עובר');
  r = await api('learnUx', { job: J1.id, ux: { pl: { n: 1, sec: 100, cov: 0.9 } } });
  const jf3 = SR.fromFields(db.get('studioJobs/' + J1.id).fields);
  ok(jf3.ux.pl.n === 2 && jf3.ux.pl.sec === 400 && jf3.ux.pl.cov === 0.9 && jf3.ux.o.sh === 2 && jf3.ux.ai.a === 3 && jf3.ux.gl.a === 2 && jf3.ux.e.s === 2, 'learnUx: מצטבר יחד עם העריכות');
  r = await call({ op: 'learnUx', idToken: OWNER, job: J1.id, ux: { zz: 1 } });
  ok(r.code === 400, 'learnUx: בלי שום דבר ידוע — 400');
  ok(SR.fromFields(db.get('studioLearn/' + LR.lid(J1.id)).fields).lr.ux.pl.cov === 0.9, 'הרשומה במאגר מתעדכנת');
  /* 21/10/2026: מדידת ההעלאה מהטלפון (op upTel → job.utl) — "הקול לקח 17 דק׳" */
  {
    const before = SR.fromFields(db.get('studioJobs/' + J1.id).fields).updated;
    r = await api('upTel', { job: J1.id, tl: { c2s: 4000, ex: 900000, ab: 80e6, a: 20000, hid: 600000, hn: 3, wl: 2, nt: 2, name: 'x', bad: -5 } });
    ok(r && r.ok, 'upTel — עובר');
    const jt = SR.fromFields(db.get('studioJobs/' + J1.id).fields);
    ok(jt.utl && jt.utl.ex === 900000 && jt.utl.hid === 600000 && jt.utl.wl === 2 && !('name' in jt.utl) && !('bad' in jt.utl), 'upTel: רק מספרים מהרשימה');
    ok(jt.updated === before, 'upTel לא נוגע ב־updated (השעון של "נתקעה")');
    r = await call({ op: 'upTel', idToken: OWNER, job: J1.id, tl: { zz: 1 } });
    ok(r.code === 400, 'upTel: בלי שום דבר ידוע — 400');
    const keysPhone = sj.match(/export const UTL_KEYS = (\[[^\]]*\])/)[1].replace(/'/g, '"');
    ok(keysPhone === JSON.stringify(SR.UTL_KEYS).replace(/,/g, ', '), 'UTL_KEYS בטלפון = בשרתון');
    ok(/utlSend\(id\);\s+\/\/ כבר עכשיו/.test(sj) && /finally \{ utlAdd\(rec, 'ex'/.test(sj) && /utlAdd\(rec, 'hid'/.test(sj), 'הטלפון מודד חילוץ, זמן ברקע, ושולח אחרי הקול ובסוף');
  }
  /* בלי הסכמה לתוכן — המספרים כן, הטקסט לא */
  db.get('studioStats/ownerUid0001').fields.lrt = { integerValue: '0' };   // הנוסח של הטקסט "לא נקרא" — המתג עצמו דולק
  for (const [k, v] of db) if (k.startsWith('studioJobs/') && k !== 'studioJobs/' + J1.id) v.fields.state = { stringValue: 'done' };
  const J2 = await mkJob();
  r = await api('cuesSave', { job: J2.id, c: J2.cid, s: J2.sid, ev: 0, pe, pt: { ws: 120, ch: diff } });
  ok(r.ok && SR.fromFields(db.get('studioJobs/' + J2.id).fields).ux.e.s === 1 && (await keysIn2('qe/')).length === 1, 'בלי ההודעה שנקראה: המספרים נספרים, הטקסט לא נשמר');
  db.get('studioStats/ownerUid0001').fields.lrt = { integerValue: String(NOW) };
  /* האצווה */
  const w = await call({}, false, true);
  ok(w.j.ok && w.j.lc === 1 && (await keysIn2('qe/')).length === 0 && (await keysIn2('e/')).join() === 'e/2026-10/' + LR.lid(J1.id) + '.bin', 'האצווה: qe → e/<חודש>/<מזהה>');
  r = await api('cuesSave', { job: J1.id, c: J1.cid, s: J1.sid, ev: 2, pe: { n: 1, del: 1 }, pt: { ch: [{ t: 'del', b: [{ s: 1, e: 2, h: 'x' }] }] } });
  ok((await keysIn2('qe/')).length === 1 && (await keysIn2('e/')).length === 1, 'שמירה אחרי האצווה: הקיים נפתח מ־e/, החדש לתור');
  const lp = await call({ op: 'learnPull', at: (await api('atNew', { n: 'test' })).token, ci: 5 }, true);
  ok(r.ok && lp.j.corpus.on && (lp.j.corpus.ne + lp.j.corpus.qe) >= 1, 'learnPull: מספר פריטי העריכות');
  /* "מחק את התרומות שלי" */
  const fg = await api('learnForget', {});
  ok(fg.ok && fg.nc >= 2 && (await keysIn2('qe/')).length === 0 && (await keysIn2('e/')).length === 0, '"מחק את התרומות שלי" — גם העריכות בדלי');

  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
