// 1/11/2026: תרגום רגיל בשרת, הסרטון עולה דרך האפליקציה (spec.pu) — Studio לאנדרואיד רק מעלה (הקול, ההתחלה והסרטון, UIDT),
// והשרת עושה הכל כמו בעבודה רגילה. השרתון האמיתי מול Firestore ו־R2 מדומים, ובדיקות מקור לאפליקציה ולאתר.
// הרצה: node tests/studio-pu.test.js
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ENV } = require('./_r2fake');

(async () => {
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, ENV, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', STUDIO_USERS: 'other@example.com',
  });
  delete process.env.IBKR_VAULT_KEY;
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
  const SR = require(path.join(root, 'ibkr-proxy/lib/studior2.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  const store = await import(path.join(root, 'studiostore.js'));
  gauth._reset(); studio._reset(); R2._reset();

  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const tok = (sub, email) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  const OWNER = tok('ownerUid0001', 'owner@example.com'), OTHER = tok('otherUid0002', 'other@example.com');

  /* Firestore מדומה (כתיבה חלקית, כתיבה בתנאי, runQuery בשוויונות) + R2 מדומה */
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
    const lm = url.match(/\/documents\/([A-Za-z]+)\?(.*)$/);   // רשימת אוסף (הגיבוי היומי)
    if (lm && (opt.method || 'GET') === 'GET') {
      return J({ documents: [...db.entries()].filter(([k]) => k.startsWith(lm[1] + '/')).map(([k, v]) => ({ name: 'projects/p/databases/(default)/documents/' + k, fields: v.fields, updateTime: v.ut })) });
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
  const deps = () => ({ verify: { keys }, fetch: fetchAll, now: R.now });
  const call = async (body, worker) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    const req = { method: 'POST', query: {}, body, headers: worker ? {} : { origin: 'https://yishaiguedj1.github.io' }, socket: { remoteAddress: '9.9.9.9' } };
    await studio._handler(req, res, deps());
    return res;
  };
  const phone = (who) => (op, b) => call(Object.assign({}, b, { op, idToken: who })).then((r) => r.j);
  const api = phone(OWNER);
  const fs = require('fs');

  /* ---------- 1. הצורה ---------- */
  const base = { name: 'talk.mp4', size: 900e6, type: 'video/mp4', dur: 3600, from: 'en', to: ['he'], mode: 'haiku-high', eng: 'api', cap: 5 };
  const sp = S.normSpec(Object.assign({}, base, { pu: 1, out: ['same', 'mkv'], edl: { k: [[1, 20]], ar: '9:16' } }));
  ok(sp && sp.pu === 1 && sp.vc === 1 && !('ph' in sp) && sp.out.join() === 'same,mkv' && !sp.edl, 'pu: עבודה רגילה עם התוצרים, הסרטון לענן (vc), בלי חיתוך ובלי ph');
  ok(S.normSpec(Object.assign({}, base, { pu: 1, eng: undefined })) === null, 'pu רק במצב השרת');
  ok(S.normSpec(Object.assign({}, base, { pu: 1, ph: 1 })) === null, 'pu לא יחד עם תרגום בטלפון');
  ok(S.normSpec(Object.assign({}, base, { pu: 1, src: 'subs', size: 1000 })) === null, 'pu לא עם קובץ כתוביות');
  ok(!('pu' in S.normSpec(base)) && !('vc' in S.normSpec(Object.assign({}, base, { vc: 1 }))), 'בלי pu — כמו קודם (vc לבד לא נשמר)');
  const v1 = S.normVcp({ p: 0.5, r: 3456789.4, sr: 7 }, 9);
  ok(v1.r === 3456789 && v1.sr === 7 && S.normVcp({ p: 0.5, r: -1, sr: 500 }, 9).r === undefined && S.normVcp({ p: 0.5, sr: 500 }, 9).sr === undefined, 'vcp: הקצב והסיבה לעצירה — רק מספרים בטווח');

  /* ---------- 2. יצירה, מפתח, הקול, ההתחלה ---------- */
  let j = await api('create', { spec: Object.assign({}, base, { pu: 1, out: ['same'] }) });
  ok(j.ok && j.job.spec.pu === 1 && SR.isFolder(j.job.folder), 'עבודת pu נוצרת עם תיקייה ב־R2');
  const PJ = j.job.id, FOLDER = j.job.folder;
  const pk = await api('phKey', { job: PJ });
  ok(pk.ok && S.KEY_RE.test(pk.key), 'מפתח טלפון גם לעבודת pu');
  const ph = (op, b) => call(Object.assign({ op, job: PJ, key: pk.key }, b), true).then((x) => x.j);
  ok((await ph('phStart', {})).error === 'no_files', 'בלי קול ובלי סרטון — לא מתחילים');
  ok((await ph('phBurn', { pbn: { s: 'run', p: 0.1 } })).error === 'not_ph' && (await ph('phClaim', {})).error === 'not_ph' && (await ph('phProg', { ppr: { s: 'asr', p: 0.1 } })).error === 'not_ph',
    'בלי צריבה, שלבים או התקדמות בטלפון');
  const audio = crypto.randomBytes(120000);
  const u = await ph('phUp', { size: audio.length, type: 'audio/mp4', name: 'talk.audio.m4a' });
  ok(u.ok && SR.inFolder(u.id, FOLDER), 'הקול עולה לתיקייה של העבודה');
  await R.fetch(u.urls[1], { method: 'PUT', body: audio });
  ok((await ph('phDone', { id: u.id, up: u.up })).ok, 'ההעלאה נסגרה');
  const m = await ph('phFile', { which: 'm', id: SR.newId(FOLDER) });
  ok(m.ok && m.ignored && !db.get('studioJobs/' + PJ).fields.fph, 'מדידות מ־Studio ישן — מתעלמים (ok), לא נרשמות');
  ok((await ph('phFile', { which: 'w', id: u.id })).error === 'bad_params', 'מילים — לא');
  ok((await ph('phFile', { which: 'a', id: u.id })).ok && db.get('studioJobs/' + PJ).fields.fa, 'הקול נרשם');
  j = await ph('phStart', {});
  ok(j.ok && j.state === 'queued' && (await api('job', { job: PJ })).job.state === 'queued', 'הטלפון התחיל את העבודה בשרת');

  /* ---------- 3. הסרטון לענן (vc) — נרשם כ־fv, והעובד לוקח אותו כמו בעבודה רגילה ---------- */
  ok((await ph('phUp', { v: true, size: 5, type: 'video/mp4', name: 'talk.mp4' })).error === 'file_size', 'סרטון בגודל אחר — לא');
  ok((await ph('phVp', { p: 0.25, r: 2500000, sr: 4 })).ok, 'דיווח התקדמות עם קצב');
  const vj = (await api('job', { job: PJ })).job;
  ok(vj.vcp && vj.vcp.p === 0.25 && vj.vcp.r === 2500000 && vj.vcp.sr === 4, 'בדף העבודה: האחוז, הקצב והסיבה');

  /* ---------- 4. בלי קול (קודק שאי אפשר להעתיק) — מתחילים מהסרטון ---------- */
  const j2 = await api('create', { spec: Object.assign({}, base, { pu: 1, size: 3000 }) });
  const pk2 = await api('phKey', { job: j2.job.id });
  const ph2 = (op, b) => call(Object.assign({ op, job: j2.job.id, key: pk2.key }, b), true).then((x) => x.j);
  const vbuf = crypto.randomBytes(3000);
  const vu = await ph2('phUp', { v: true, size: vbuf.length, type: 'video/mp4', name: 'talk.mp4' });
  await R.fetch(vu.urls[1], { method: 'PUT', body: vbuf });
  ok((await ph2('phDone', { v: true, id: vu.id, up: vu.up })).ok && (await ph2('phFile', { v: true, which: 'v', id: vu.id })).ok, 'הסרטון עלה ונרשם');
  j = await ph2('phStart', {});
  ok(j.ok && j.state === 'queued', 'בלי קול — מתחילים מהסרטון');
  ok((await api('phKey', { job: (await api('create', { spec: base })).job.id })).error === 'state', 'עבודה רגילה מהדפדפן — עדיין בלי מפתח טלפון');

  /* ---------- 5. האפליקציה ---------- */
  const A = (f) => fs.readFileSync(path.join(root, 'android/app/src/studio/java/io/github/yishaiguedj1/snowball', f), 'utf8');
  const act = A('PhActivity.kt'), work = A('PhWork.kt'), pu = A('PhPu.kt'), upj = A('PhUpJob.kt'), pnet = A('PhNet.kt'), core = A('PhCore.kt'), pst = A('PhStore.kt');
  const src = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
  ok(/"phpick" -> pick\(d\.getQueryParameter\("m"\) == "pu"\)/.test(act) && /FLAG_GRANT_PERSISTABLE_URI_PERMISSION/.test(act) && /takePersistableUriPermission\(u, Intent\.FLAG_GRANT_READ_URI_PERMISSION\)/.test(act),
    'הבחירה ל־pu: הרשאה קבועה ל־URI');
  const pp = act.slice(act.indexOf('private fun pickPu'), act.indexOf('private fun copy'));
  ok(pp.length > 100 && !/outputStream|copyTo/.test(pp) && /\.put\("uri", u\.toString\(\)\)\.put\("pu", true\)/.test(pp) && /\.put\("m", "pu"\)/.test(pp), 'pickPu: בלי עותק — הרשומה שומרת את ה־URI, והאתר מקבל m=pu');
  const cap = +(/const val CAP = (\d+)/.exec(core) || [])[1], capW = +(/export const PH_CAP_PU = (\d+)/.exec(src) || [])[1];
  ok(cap === capW && cap === 5, 'CAP של האפליקציה = PH_CAP_PU באתר (5)');
  ok(/if \(r\.optBoolean\("pu"\)\) return upPu\(ctx, pid, stopped\)/.test(work) && /PhPu\.audio\(/.test(work) && /if \(pu\) PhPu\.src\(ctx, r\) else PhNet\.FileSrc/.test(work), 'PhWork: pu — הקול ב־MediaMuxer, הסרטון מה־URI');
  ok(/MUXER_OUTPUT_MPEG_4/.test(pu) && /MUXER_OUTPUT_WEBM/.test(pu) && !/PhFf\./.test(pu), 'PhPu: הקול בלי ffmpeg ובלי קידוד (AAC → MP4, ‏Opus/Vorbis → WebM)');
  const upPu = work.slice(work.indexOf('private fun upPu'), work.indexOf('/* ---------------------------------------------------------------- burn */'));
  ok(!/shots|phFile", JSONObject\(\)\.put\("which", "m"|PhLocal|PhModels/.test(upPu), 'upPu: בלי שוטים, בלי מדידות ובלי תמלול בטלפון');
  ok(/setEstimatedNetworkBytes\(0L, left\)/.test(upj) && /params\.stopReason/.test(upj) && /put\("vSr"/.test(upj) && /put\("sr", sr\)/.test(work), 'PhUpJob: הבתים הצפויים, והסיבה לעצירה נשלחת (sr)');
  ok(/const val BUF = 512 shl 10/.test(pnet) && /fun uploadPar\(f: Src,/.test(pnet) && /catch \(e: Throwable\) \{ 0 \}/.test(pnet), 'PhNet: באפר 512KB, מקור כללי (File / URI), תקלה בחלק לא מפילה את התהליכון');
  ok(/releasePersistableUriPermission/.test(pst), 'מחיקת הרשומה משחררת את ההרשאה ל־URI');
  ok(/R\.string\.phUpVB/.test(work) && /put\("r", rate\.toLong\(\)\)/.test(work), 'ההתראה וה־vcp: MB ומהירות');
  const strs = ['values', 'values-en'].map((d) => fs.readFileSync(path.join(root, 'android/app/src/studio/res', d, 'strings.xml'), 'utf8'));
  ok(['phUpVB', 'phPuSent', 'phPuSentS', 'phPuProbe'].every((k) => strs.every((x) => x.includes('name="' + k + '"'))), 'המחרוזות החדשות בעברית ובאנגלית');

  /* ---------- 6. האתר ---------- */
  const st = await import(path.join(root, 'studio.js')).catch(() => null);
  ok(/if \(puPickOk\(f\)\) \{ puPick\(\); return; \}/.test(src) && /export const puPickOk = \(f\) => phOk\(\) && !!f && !f\.ka;/.test(src), 'בתוך האפליקציה הבחירה הראשית דרכה (לא בשיר)');
  ok(/phIntent\('phpick', \{ m: 'pu' \}\)/.test(src) && /if \(r\.m === 'pu' \|\| ask\) f\.ph\.pu = true;/.test(src), 'm=pu בבקשה; Studio ישן — לפי הבקשה ששמורה (PU_ASK)');
  ok(/const spec = P\.pu \? \{ name: f\.file\.name[^\n]*\n\s*out: OUTS\.filter\(\(k\) => f\.out\[k\]\)[^\n]*pu: 1, eng: 'api'/.test(src) && /if \(!P\.pu\) spec\.vc = 1;/.test(src) && /else if \(rec\.spec\.pu && /.test(src),
    'pu: התוצרים מהטופס, בלי ph, וכרטיס משלו בדף העבודה');
  if (st && st.puLine) {
    const t = st.puLine({ p: 0.5, r: 2 * 1048576 }, 400 * 1048576);
    ok(t.split(' · ').length === 3 && st.puLine({ p: 0.5 }, 400).split(' · ').length === 1 && st.puLine({ p: 1, r: 9 }, 400).split(' · ').length === 2, 'puLine: עלו/מתוך · מהירות · נשאר (בלי קצב — רק כמה עלו)');
    ok(st.puStuck({ created: 0, srv: { vcp: { p: 0.1, at: 1000 } } }, 1000 + 4 * 60e3) && !st.puStuck({ created: 0, srv: { vcp: { p: 0.1, at: 1000 } } }, 1000 + 60e3)
      && !st.puStuck({ srv: { fv: { id: 'x' } } }, 1e13) && st.puStuck({ created: 0, srv: { vcp: { p: 0.1, at: 9e12, e: 'net' } } }, 9e12), 'puStuck: נעצר / לא דיווח / לא התחיל');
    ok(st.parsePhPick('p0123456789abcdef.' + Buffer.from(JSON.stringify({ pid: 'p0123456789abcdef', name: 'a.mp4', size: 9, m: 'pu' })).toString('base64url')).m === 'pu', 'parsePhPick: m=pu');
  }

  /* ---------- 7. ב׳ — הכי מהר בדפדפן ---------- */
  const SS = await import(path.join(root, 'studiostore.js'));
  ok(SS.r2ConcNow(true) === 6 && SS.r2ConcNow(false) === SS.R2_CONC && SS.R2_CONC === 4, 'מקביליות: 6 כשהדף מוסתר, 4 כשהוא מוצג');
  ok(SS.protoCode('h3') === 3 && SS.protoCode('h2') === 2 && SS.protoCode('http/1.1') === 1 && SS.protoCode('') === 0, 'protoCode: h3/h2/http1.1, ריק = לא ידוע');
  const sto = fs.readFileSync(path.join(root, 'studiostore.js'), 'utf8');
  ok(/const dyn = env\.conc == null;/.test(sto) && /if \(k >= concNow\(\)\)/.test(sto) && /length: Math\.min\(concMax, ready\.length\)/.test(sto), 'r2Upload: מספר החלקים בדרך לפי מצב הדף (conc מפורש — קבוע, כמו בבדיקות)');
  ok(/onProto: o\.onProto/.test(fs.readFileSync(path.join(root, 'studionet.js'), 'utf8')) && /onProto: \(c\) => \{ utlOf\(rec\)\.np = c; \}/.test(src) && S.UTL_KEYS.includes('np'), 'הפרוטוקול נמדד (utl.np) — בטלפון ובשרתון');
  if (st && st.bgSlowOf) {
    ok(st.bgSlowOf(30e3, 0, 1e6) === null, 'פחות מדקה ברקע — לא אומרים כלום');
    ok(st.bgSlowOf(120e3, 120e3 * 50, 2e6).r === 50000 && st.bgSlowOf(120e3, 120 * 1.5e6, 2e6) === null, 'דקה ומעלה: איטי (50KB/שנ׳) — כן; קרוב לקצב הגלוי — לא');
    ok(st.bgSlowOf(120e3, 120 * 400e3, 2e6) !== null && st.bgSlowOf(120e3, 120 * 400e3, 1e6) === null, 'הסף: 30% מהקצב הגלוי (ולפחות 150KB/שנ׳)');
  }
  ok(/r\.bgSlow = bgSlowOf\(now - r\.hid0, b, r\.rate\)/.test(src) && /T\('studioBgSlow', \{ v: fmtSize\(run\.bgSlow\.r\) \}\) \+ \(isIOS\(\) \? ' ' \+ T\('studioBgSlowIos'\)/.test(src), 'ההודעה "להשאיר את המסך דלוק" בדף העבודה (באייפון — גם Drive)');

  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
