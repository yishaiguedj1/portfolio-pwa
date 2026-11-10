// 10/11/2026 — ניתוח סרטונים, גל 1, PR 1.3: מאגר הלמידה של הניתוח (docs/studio-video-analysis-plan.md 7.2–7.13, ‏14.5).
// (1) טהור: normViLx מול ה־fixture המשותף לעובד (translator/tests/fixtures/vi_facts.json), learnViRec, ‏UX_SHAPE vi/vf,
//     המסקנות והגרסאות, scrubVi ו־normViCorpus, ה־DEK וההצפנה.
// (2) השרתון האמיתי (api/studio.js) עם Firestore ו־R2 מדומים: הסכמה לכל מטרה (lat/lau), רק המנהל, התור המוצפן viq/ + vik/,
//     האצווה, יומן הפענוח, "מחק את התרומות שלי" (מחיקה קריפטוגרפית), 24 חודשים, ובדיקות האבטחה של 14.5 — בלי הרשאה,
//     משתמש אחר, שיבוש, העברה ל־lid אחר, שחזור אחרי מחיקה.
// הרצה: node tests/learn-vi.test.js
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ACC } = require('./_r2fake');

(async () => {
  /* ---------- 0. הסביבה (הכספת דרך GDRIVE_SA_KEY, הדלי של המאגר) — לפני הטעינה ---------- */
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, {
    R2L_ACCOUNT_ID: ACC, R2L_ACCESS_KEY_ID: 'AKTEST', R2L_SECRET_ACCESS_KEY: 'sekret/xyz', R2L_BUCKET: 'snb-studio',
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', STUDIO_USERS: 'other@example.com', SNB_SITEWATCH: 'off', SNB_ADMINWATCH: 'off', SNB_FUNDWATCH: 'off',
  });
  for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'IBKR_VAULT_KEY']) delete process.env[k];
  const LR = require(path.join(root, 'ibkr-proxy/lib/studiolearn.js'));
  const VC = require(path.join(root, 'ibkr-proxy/lib/vicorpus.js'));
  const VI = require(path.join(root, 'ibkr-proxy/lib/studiovi.js'));
  const vault = require(path.join(root, 'ibkr-proxy/lib/vault.js'));

  /* ---------- 1. הרשומה המספרית (7.2) ---------- */
  const fx = JSON.parse(fs.readFileSync(path.join(root, 'translator/tests/fixtures/vi_facts.json'), 'utf8'));
  ok(JSON.stringify(LR.normViLx(fx.in)) === JSON.stringify(fx.out), 'normViLx = בדיוק הרשימה המותרת (ה־fixture המשותף לעובד)');
  ok(JSON.stringify(LR.normViLx(fx.out)) === JSON.stringify(fx.out), 'normViLx אידמפוטנטי');
  const flatIn = JSON.stringify(LR.normViLx(fx.in));
  ok(!/SECRET|ownerUid|my-private|Private title|slide text|hello|English|srv1|Dana/.test(flatIn), 'בלי טקסט, שמות, uid או מארח — רק מספרים ו־enum');
  ok(LR.normViLx(null) === null && LR.normViLx([]) === null && LR.normViLx({ foo: 1 }) === null, 'קלט ריק / לא מוכר — null');
  ok(LR.normViLx({ genre: 'sermon', lang: { src: 'fr' }, counts: { cov3: [0.5, 2, 0.1] }, warn: ['x'] }) === null, 'enum מחוץ לרשימה וטווחים לא חוקיים — נזרקים');

  const JID = 'j' + 'A'.repeat(20);
  const vjob = { id: JID, kind: 'tr', uid: 'ownerUid0001', state: 'done', created: Date.UTC(2026, 9, 14, 13, 37), ended: Date.UTC(2026, 9, 14, 14),
    spec: { vi: 1, mode: 'sonnet-medium', from: 'en', to: ['he'], dur: 3600, name: 'my-private-lecture.mp4', xf: ['dual'] }, lx: fx.out,
    use: [{ k: 'vm', m: 'claude-sonnet-5-5', i: 50000, o: 7000, cr: 1000, c5: 200, usd: 0.3 }, { k: 'vs', m: 'claude-opus-5-5', i: 1, o: 1, usd: 0.5 }, { k: 'main', m: 'claude-sonnet-5-5', usd: 9 }],
    ux: { vi: { o: 3, up: 1 }, e: { s: 1 }, vf: [{ id: 'n3', why: 'ts', at: 4 }] } };
  const rec = LR.learnRec(vjob, Date.UTC(2026, 9, 15), null);
  ok(rec && rec.k === 'vi' && rec.id === VC.viLid(JID) && rec.id !== LR.lid(JID) && /^[0-9a-f]{20}$/.test(rec.id), 'learnRec → רשומת ניתוח, המזהה ב־HMAC (לא sha256 הגלוי של התרגום)');
  ok(rec.at === Date.UTC(2026, 9, 14) && rec.m === '2026-10' && !('end' in rec), 'הזמן ביום והחודש — לא שעה');
  ok(rec.roles.vm.in === 50000 && rec.roles.vm.cw === 200 && rec.roles.vm.usd === 0.3 && rec.roles.vm.eff === 'medium' && !rec.roles.main && rec.usd === 0.8 && rec.pr === 1, 'העלות מהשורות שהשרתון תמחר גוברת; main לא תפקיד ניתוח');
  ok(rec.ux && rec.ux.vi.o === 3 && rec.ux.vf.length === 1 && rec.xf.join() === 'dual' && rec.gs === 0, 'ux, xf ו־gs ברשומה');
  ok(!/my-private|ownerUid|"uid"|"name"/.test(JSON.stringify(rec)), 'ברשומה אין uid ושם קובץ');
  ok(LR.learnRec(Object.assign({}, vjob, { kind: 'rr' }), Date.now(), null) === null, 'הפקה מחדש של ניתוח — אין רשומה');
  /* PR 1.6: הרצת זהב — wa ו־vq ברשומה; רשומה רגילה — בלי */
  const gRec = LR.learnRec(Object.assign({}, vjob, { gs: 'jSrcxxxxxxxxxxxxxxxxx', wa: 1, vq: { f5: 0.4, f10: 0.75 }, spec: Object.assign({}, vjob.spec, { xf: ['vwin'] }) }), Date.UTC(2026, 9, 15), null);
  ok(gRec.gs === 1 && gRec.wa === 1 && gRec.vq.f10 === 0.75 && !('wa' in rec) && !('vq' in rec), 'זהב (1.6): מספר הזרוע והציון מול הייחוס — רק בהרצת זהב');
  const gNo = LR.learnRec(Object.assign({}, vjob, { wa: 2, vq: { f5: 1 } }), Date.UTC(2026, 9, 15), null);
  ok(!('wa' in gNo) && !('vq' in gNo), 'זהב (1.6): עבודה רגילה לא נושאת wa/vq גם אם יש בה');
  const GNOW = Date.UTC(2026, 9, 20);
  const vv = LR.viView([Object.assign({}, rec, { at: GNOW - 86400e3 }), Object.assign({}, gRec, { at: GNOW - 86400e3 }), Object.assign({}, gRec, { at: GNOW - 86400e3, vq: { f5: 0.2, f10: 0.25 } }),
    Object.assign({}, gRec, { at: GNOW - 86400e3, mode: 'haiku-high', xf: [], vq: null })], GNOW);
  const arm = (g) => vv.gold.arms.find((x) => x.g === g);
  ok(vv.k.n === 1 && vv.gold.n === 3 && vv.gold.arms.length === 2 && arm(gRec.mode + '|vwin').n === 2 && arm(gRec.mode + '|vwin').f10 === 0.5 && arm(gRec.mode + '|vwin').nq === 2
    && arm('haiku-high|').nq === 0 && arm('haiku-high|').f10 === null, 'זהב (1.6): viView — הזרועות (מצב + דגלים), ממוצע F1 מול הייחוס; הזהב לא במדדים הרגילים');
  /* PR 1.6: חבילת הייחוס snb.vi-ref/1 */
  const R0 = VI.normViRef({ bounds: [{ t0: 300.4, lv: 2, title: 'ב' }, { t0: 0, title: 'א\u0007' }, { t0: -1 }, { t0: 90000 }], units: [{ text: ' יחידה ', w: 3 }, { text: '' }, { text: 'x', w: 7 }],
    qa: [{ q: 'ש', a: 'ת', t: 61, so: 1 }, { q: 'ש' }], slides: [{ t: 5, text: 'שקף' }, { text: 'בלי זמן' }], he: 'קטע', meta: { tier: 'b', genre: 'nope', lic: 'CC' }, extra: 1 });
  ok(R0.v === 'snb.vi-ref/1' && R0.bounds.length === 2 && R0.bounds[0].t0 === 0 && R0.bounds[0].title === 'א' && R0.bounds[1].t0 === 300 && R0.bounds[1].lv === 2
    && R0.units.length === 2 && R0.units[0].text === 'יחידה' && R0.units[1].w === 1 && R0.qa.length === 1 && R0.qa[0].so === 1 && R0.slides.length === 1
    && R0.meta.tier === 'b' && R0.meta.genre === 'other' && !('extra' in R0), 'ייחוס (1.6): normViRef — שדה לא מוכר, זמן מחוץ לטווח, טקסט ריק ותו בקרה נזרקים');
  ok(VI.normViRef({ he: 'רק טקסט' }) === null && VI.normViRef(null) === null && VI.normViRef({ units: Array.from({ length: 80 }, () => ({ text: 'א'.repeat(400) })) }) === null,
    'ייחוס (1.6): ריק (בלי פרקים, יחידות או שאלות) או גדול מ־VR_MAX — null');
  ok(JSON.stringify(VI.viRefBounds(R0)) === '[0]' && JSON.stringify(VI.viRefBounds(null)) === '[]' && JSON.stringify(VI.normVrb([30.6, 'x', -2, 10])) === '[10,31]',
    'ייחוס (1.6): viRefBounds — רק רמה 1; normVrb ממיין ומעגל');
  ok(JSON.stringify(VI.normVq({ f5: 0.33333, f10: 1.2 })) === '{"f5":0.3333,"f10":null}' && VI.normVq({}) === null && VI.normVq('x') === null, 'ייחוס (1.6): normVq — 0..1, ארבע ספרות');
  /* PR 1.6: goldClone/waveClone של ניתוח — התוצרים שלו נשמרים, vg + vrb; של תרגום — כמו קודם (SRT) */
  const SS = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const vsrc = { id: 'jSrcxxxxxxxxxxxxxxxxx', kind: 'tr', state: 'done', folder: 'R2_jSrcxxxxxxxxxxxxxxxxx', fv: { id: 'x' }, gd: { vr: 1, n: 10, at: 1 },
    vrf: VI.normViRef({ bounds: [{ t0: 0 }, { t0: 200 }], units: [{ text: 'u' }] }), spec: { vi: 1, vr: 1, eng: 'api', out: ['vi', 'cues'], mode: 'haiku-high', xf: ['smf'], vg: 1, vrb: [9] } };
  const vc = SS.waveClone(vsrc, 'jNewxxxxxxxxxxxxxxxxx', 'u', 5, { mode: 'haiku-medium', xf: ['vwin'] }, 2);
  ok(JSON.stringify(vc.spec.out) === '["vi","cues"]' && vc.spec.vg === 1 && JSON.stringify(vc.spec.vrb) === '[0,200]' && JSON.stringify(vc.spec.xf) === '["vwin"]' && vc.spec.vr === 1
    && vc.wa === 2 && vc.gs === vsrc.id && vc.gr === '' && !vc.vrf && !vc.gd, 'זהב (1.6): waveClone של ניתוח — התוצרים, vg, ‏vrb מהייחוס, xf של הזרוע; בלי gr ובלי הייחוס עצמו');
  const tc = SS.waveClone({ id: 'jTrxxxxxxxxxxxxxxxxxx', kind: 'tr', folder: 'R2_jTrxxxxxxxxxxxxxxxxxx', fv: { id: 'x' }, gd: { r: 'abcdefghijkl', n: 1, at: 1 }, spec: { out: ['compact'], mode: 'haiku-high' } }, 'jN2xxxxxxxxxxxxxxxxxx', 'u', 5, { mode: 'haiku-high', xf: [] }, 0);
  ok(JSON.stringify(tc.spec.out) === '["srt"]' && !('vg' in tc.spec) && tc.gr === 'abcdefghijkl', 'זהב (1.6): waveClone של תרגום — כמו קודם');
  ok(SS.isViGold(vsrc) && !SS.isViGold(Object.assign({}, vsrc, { vrf: null })) && !SS.isViGold(Object.assign({}, vsrc, { spec: { vi: 1, dry: 1 } })) && SS.goldSources([vsrc]).length === 1
    && SS.publicJob(vsrc).vg === 1 && SS.publicJob(vsrc).gd === null && SS.publicJob(vsrc).vq === null, 'זהב (1.6): isViGold / goldSources / publicJob');
  ok(SS.XF_KEYS.includes('vwin') && JSON.stringify(SS.normXf(['vwin', '-vwin', 'x'])) === '["-vwin","vwin"]', 'זהב (1.6): הדגל vwin ברשימה הסגורה');
  const adm = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8');
  ok(/page\('labVi'/.test(adm) && /page\('viGold'/.test(adm) && /page\('viRef'/.test(adm) && /api\('viRef', \{ job: job\.id, ref: vrParse\(e\) \}\)/.test(adm)
    && /!j\.sm && !isVi\(j\)\), srcs = jobs\.filter/.test(adm) && /XF_KEYS\.filter\(\(k\) => \(k\[0\] === 'v'\) === !!vi\)/.test(adm), 'מרכז הניהול (1.6): labVi, ‏viGold, ‏viRef; עמוד הזהב של התרגום בלי ניתוחים; דגלי v… רק בגל של הניתוח');
  // ⛔ בתשלום — השופט והטיוטה רק דרך askConfirm עם המחיר, ורק עם ok: true (השרתון דוחה בלי)
  ok(/askConfirm\(fmt\(t\('admViJdQ'\), \{ n: v\.np, usd: v\.usd \}\), async \(\) => \{\s*b\.disabled = true;\s*const r = await api\('viJudge', \{ ok: true \}\)/.test(adm)
    && /askConfirm\(fmt\(t\('admViDrQ'\), \{ m: mn, usd \}\), async \(\) => \{\s*b\.disabled = true;\s*const r = await api\('viRef', \{ job: job\.id, draft: dm, ok: true \}\)/.test(adm)
    && (adm.match(/api\('viJudge', \{ ok: true \}\)|draft: dm, ok: true/g) || []).length === 2 && /vjPaint\(p\);/.test(adm) && /vrDraftUi\(p, job, e\);/.test(adm),
    'מרכז הניהול (1.6): השופט בזוגות וטיוטת הייחוס — רק אחרי אישור עם המחיר');
  const apiSrc = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
  ok(/if \(op === 'viRef'\) \{[\s\S]{0,400}if \(!isAdmin\(user\)\) return res\.status\(403\)/.test(apiSrc), 'viRef — מנהל בלבד');
  ok(LR.learnRec(Object.assign({}, vjob, { spec: Object.assign({}, vjob.spec, { vi: 0 }) }), Date.now(), null).k === 'tr', 'עבודת תרגום — כמו קודם');

  /* ---------- 2. אירועי השימוש (7.4) ---------- */
  ok(LR.UX_SHAPE.vi.length === 16 && LR.UX_SHAPE.vf.join() === 'id,why,at', 'UX_SHAPE: vi (16) ו־vf');
  const sj = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
  const shape = JSON.parse(sj.match(/export const UX_SHAPE = (\{[^\n]*\});/)[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":'));
  ok(JSON.stringify(shape.vi) === JSON.stringify(LR.UX_SHAPE.vi) && JSON.stringify(shape.vf) === JSON.stringify(LR.UX_SHAPE.vf), 'vi/vf בטלפון = בשרתון');
  const vf = Array.from({ length: 70 }, (_, i) => ({ id: 'n' + i, why: LR.VF_WHY[i % LR.VF_WHY.length], at: i, txt: 'free text' }));
  const u1 = LR.normUx({ vf: vf.concat([{ id: '<b>', why: 'ts' }, { id: 'n1', why: 'nope' }, { id: 'n1', why: 'ts', at: -4 }]) });
  ok(u1.vf.length === LR.VF_MAX && u1.vf.every((x) => Object.keys(x).join() === 'id,why,at' && LR.VF_WHY.includes(x.why)), 'vf: עד 50 שורות, רק id/why/at, בלי טקסט חופשי');
  const m1 = LR.mergeUx({ vi: { lv: 2, rd: 10, cov: 0.4 }, vf: [{ id: 'n1', why: 'ts', at: 1 }] }, { vi: { lv: 5, rd: 5, cov: 0.2 }, vf: [{ id: 'n1', why: 'ts', at: 9 }, { id: 'c2', why: 'long', at: 3 }] });
  ok(m1.vi.lv === 5 && m1.vi.rd === 15 && m1.vi.cov === 0.4 && m1.vf.length === 2, 'המיזוג: lv האחרון, rd מצטבר, cov המקסימום, אותה שורת משוב פעם אחת');

  /* ---------- 3. המעבדה: מסקנות, גרסאות, זהב (7.7, ‏7.8, ‏7.13) ---------- */
  const NOW0 = Date.UTC(2026, 9, 30);
  const mk = (o) => Object.assign({ v: 1, k: 'vi', id: crypto.randomBytes(10).toString('hex'), at: NOW0 - 3 * 86400e3, st: 'done', err: '', eng: 'api', mode: 'sonnet-medium', dur: 3600, pr: 1, usd: 1,
    genre: 'academic_lecture', lang: { src: 'en', out: 'he' }, counts: { claims: 100, sup: 95, uns: 1, ts_off: 1, kf_total: 10, kf_used: 9, cov3: [0.9, 0.9, 0.9] }, t: { tr: 30 } }, o);
  const good = [1, 2, 3, 4].map(() => mk({}));
  const goodPrev = [1, 2, 3].map(() => mk({ at: NOW0 - 40 * 86400e3 }));
  const lv0 = LR.learnView(good.concat(goodPrev), NOW0);
  ok(lv0.vi && lv0.vi.n === 7 && lv0.vi.k.done === 4 && lv0.vi.k.sup === 0.95 && !lv0.ins.some((x) => /^vi_/.test(x.k)), 'סעיף vi במעבדה; עבודות תקינות — בלי מסקנות');
  ok(lv0.n === 0 && lv0.k.n === 0, 'רשומות הניתוח לא נכנסות לחישובי התרגום');
  const bad = [1, 2, 3, 4, 5].map((i) => mk({ usd: 3, t: { tr: 90 }, lang: { src: i < 4 ? 'he' : 'en', out: 'he' }, scr: { ocr_conf: 0.5 },
    counts: { claims: 100, sup: 70, uns: 12, ts_off: 8, kf_total: 10, kf_used: 9, cov3: [0.9, 0.4, 0.9] }, ux: { vi: { o: 1, dn: 1 } } }));
  const codes = LR.learnView(bad.concat(goodPrev), NOW0).ins.map((x) => x.k).filter((k) => /^vi_/.test(k)).sort();
  ok(codes.join() === ['vi_cost', 'vi_dn', 'vi_mid', 'vi_ocr_he', 'vi_slow', 'vi_ts', 'vi_unsup'].join(), 'כל שבע המסקנות עולות כשצריך: ' + codes.join(' '));
  const gold = bad.map((r) => Object.assign({}, r, { gs: 1 }));
  const lvg = LR.learnView(gold.concat(goodPrev), NOW0);
  ok(!lvg.ins.some((x) => /^vi_/.test(x.k)) && lvg.vi.gold.n === 5 && lvg.vi.k.n === 0, 'עבודות זהב — לא במסקנות ולא במדדים; בנפרד (gold)');
  for (const k of ['vi_unsup', 'vi_ts', 'vi_mid', 'vi_ocr_he', 'vi_cost', 'vi_slow', 'vi_dn']) ok(LR.INS_HE[k], 'INS_HE: ' + k);
  ok(['vp', 'vo', 'vh'].every((d) => LR.VER_DIMS.includes(d)) && ['vsup', 'vcph', 'vmph', 'vkf'].every((k) => LR.VER_MET.some((x) => x[0] === k)), 'VER_DIMS ו־VER_MET — הממדים והמדדים של הניתוח');
  const va = [1, 2, 3, 4].map((i) => mk({ at: NOW0 - 5 * 86400e3 + i, pv: { vp: '2' }, counts: { claims: 100, sup: 70 + i, kf_total: 10, kf_used: 9 } }));
  const vb = [1, 2, 3, 4].map((i) => mk({ at: NOW0 - 20 * 86400e3 + i, pv: { vp: '1' }, counts: { claims: 100, sup: 95 + (i % 2), kf_total: 10, kf_used: 9 } }));
  const ver = LR.versionsView(va.concat(vb)).find((x) => x.d === 'vp');
  ok(ver && ver.a === '2' && ver.b === '1' && ver.v === 'dn' && ver.m.some((x) => x.k === 'vsup' && x.v === 'dn') && !ver.m.some((x) => x.k === 'q'), 'גרסת הפרומפטים: vp 2 גרועה מ־1 (טענות נתמכות), בלי מדדי התרגום');
  ok(!LR.versionsView(va.concat(vb).map((r) => Object.assign({}, r, { gs: 1 }))).some((x) => x.d === 'vp'), 'הגרסאות — בלי עבודות זהב');
  ok(/ניתוח סרטונים \(k:vi\)/.test(LR.learnBrief(lv0, NOW0)), 'החבילה ל־Claude — סעיף הניתוח');

  /* ---------- 4. הקורפוס: ניקוי, רשימה מותרת, הצפנה (7.3, ‏7.11) ---------- */
  ok(VC.scrubVi('mail dana@example.com · 054-1234567 · +972 54 123 4567') === 'mail ⟨מייל⟩ · ⟨טלפון⟩ · ⟨טלפון⟩', 'scrubVi: מייל וטלפונים');
  ok(VC.scrubVi('card 4111 1111 1111 1111, id 000000018') === 'card ⟨כרטיס⟩, id ⟨ת״ז⟩', 'scrubVi: כרטיס (Luhn) ות״ז (ספרת ביקורת) — דוגמאות סינתטיות');
  ok(VC.scrubVi('acct 123456789 · IBAN GB82WEST12345698765432') === 'acct ⟨מספר⟩ · IBAN ⟨IBAN⟩', 'scrubVi: מספר ארוך ו־IBAN');
  ok(VC.scrubVi('https://x.example/p?token=abcdef&x=1 · https://x.example/a/b') === '⟨קישור⟩ · https://x.example/a/b', 'scrubVi: קישור עם אסימון — מוחלף; קישור רגיל — נשאר');
  ok(VC.scrubVi('between 1990 2000 2010 2020, 3 slides, $1,500') === 'between 1990 2000 2010 2020, 3 slides, $1,500', 'scrubVi: שנים, מספרים קצרים וסכומים נשארים');
  const corp = { v: VC.VC_V, uid: 'ownerUid0001', name: 'my-private-lecture.mp4',
    tr: [['e1', 0, 4, 'S1', 'call me at 054-1234567', 0.9], ['e2', 5, 9, 'Dana Levi', 'hi', 0.8], ['x', 1, 2, 'S1', 'bad id']],
    scr: [['s1', 0, 60, 'slide', 2, [['Revenue 2026', 0.9, 'en']]]], ol: [['c1', 0, 600, 1, 'פתיחה', 'e1']],
    it: [['n1', 'claim', 'c1', 'הרווח עלה', ['e1'], '', 'speaker', 'high', 'sup']], led: [['s1', 'n1'], ['e2', 'filler'], ['e9', 'nope']],
    dr: { m0: '{"x":1}', zz: 'drop' }, cf: { genre: 'academic_lecture', st: { vm: ['claude-sonnet-5-5', 'medium'] }, pv: 2, sys_hash: 'ab12' },
    tk: [['vm', 100, 20, 0, 0, 0.01, 900]], cl: [['vm', 'ab12', 'PROMPT', 'ANSWER', 10]] };
  const ci = VC.normViCorpus(corp, '2026-10', false);
  ok(ci && ci.m === '2026-10' && !('uid' in ci) && !('name' in ci) && !('cl' in ci) && ci.tr.length === 2 && ci.tr[0][4] === 'call me at ⟨טלפון⟩' && ci.tr[1][3] === 'S?', 'normViCorpus: רק המותר, מנוקה; שם דובר → S?; בלי יומן הקריאות במצב הרגיל');
  ok(ci.led.length === 2 && !('zz' in (ci.dr || {})), 'הפנקס: רק סיבה מהרשימה; הטיוטות — רק בנקודות VK_STAGES');
  const cf = VC.normViCorpus(corp, '2026-10', true);
  ok(cf.cl && cf.cl[0][2] === 'PROMPT' && cf.tr[0][4] === 'call me at 054-1234567', 'האיסוף המלא (learn_full): בלי ניקוי, עם הפרומפט והתשובה');
  ok(VC.normViCorpus(Object.assign({}, corp, { v: 99 }), '2026-10') === null && VC.normViCorpus(corp, 'x') === null, 'גרסה אחרת / חודש לא תקין — לא נשמר');
  const L1 = VC.viLid(JID), L2 = VC.viLid('j' + 'B'.repeat(20));
  ok(L1 && L1 !== L2 && VC.viLid('bad') === null, 'viLid: HMAC, שונה לכל עבודה, מזהה לא תקין → null');
  const dek = VC.dekNew(), w = VC.dekWrap(dek, L1);
  ok(/^vk1\.[se]\./.test(w) && !w.includes(dek.toString('base64url')) && VC.dekUnwrap(w, L1).equals(dek), 'ה־DEK עטוף ב־KEK, ונפתח רק עם אותו lid');
  ok(VC.dekUnwrap(w, L2) === null && VC.dekUnwrap(w.replace(/^vk1\.[a-z]+/, 'vk1.e'), L1) === null, 'DEK שהועבר ל־lid אחר / kid אחר (מפתח הוחלף) — לא נפתח');
  const sealed = VC.vcSeal(ci, dek, L1);
  ok(sealed.startsWith('vc1.') && !/⟨טלפון⟩|call me|Revenue|הרווח/.test(sealed) && JSON.stringify(VC.vcOpen(sealed, dek, L1)) === JSON.stringify(ci), 'התוכן מוצפן ב־DEK ונפתח בחזרה');
  ok(VC.vcOpen(sealed, dek, L2) === null && VC.vcOpen(sealed, VC.dekNew(), L1) === null, 'AAD = lid: קובץ שהועבר ל־lid אחר / DEK אחר — לא נפתח');
  const tam = sealed.slice(0, -6) + (sealed.slice(-6, -5) === 'A' ? 'B' : 'A') + sealed.slice(-5);
  ok(VC.vcOpen(tam, dek, L1) === null, 'שיבוש בתוכן — לא נפתח (GCM)');
  ok(VC.parseViKey('vic/2026-10/' + L1 + '.bin').month === '2026-10' && VC.parseViKey('vic/../x.bin') === null && VC.parseViKey('c/2026-10/' + L1 + '.bin') === null, 'מפתחות בדלי — רק בצורה שלנו');

  /* ---------- 5. השרתון ---------- */
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
  const OWNER = tok('ownerUid0001', 'owner@example.com'), OTHER = tok('otherUid0002', 'other@example.com');
  const R = fakeR2();
  const db = new Map();
  db.set('sysBackup/cfg', { fields: { uid: { stringValue: 'ownerUid0001' } }, ut: 't0' });   // המנהל = בעל הגיבוי
  db.set('sysCfg/main', { fields: { flOff: { stringValue: 'learn_full' } }, ut: 't0' });   // האיסוף המלא כבוי — המסלול הרגיל (עם scrubVi)
  let utSeq = 0;
  const J = (o, st = 200) => ({ status: st, ok: st < 300, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => null } });
  const fetchAll = async (url, opt = {}) => {
    if (url.includes('.r2.cloudflarestorage.com')) return R.fetch(url, opt);
    if (url.includes('oauth2.googleapis.com/token')) return J({ access_token: 'SA', expires_in: 3600 });
    if (url.endsWith('/documents:runQuery')) {
      const q = JSON.parse(opt.body).structuredQuery, wh = q.where, col = q.from[0].collectionId;
      const fl = !wh ? [] : wh.fieldFilter ? [wh.fieldFilter] : wh.compositeFilter.filters.map((f) => f.fieldFilter);
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
  const apiAs = (who) => (op, b) => call(Object.assign({}, b, { op, idToken: who })).then((r) => r.j);
  const api = apiAs(OWNER), apiO = apiAs(OTHER);
  const spec = { name: 'my-private-lecture.mp4', size: 1000, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'sonnet-medium', out: ['srt'] };
  const newJob = async (who, vi) => {
    const j = await api('create', { spec });   // עבודה של משתמש אחר — נוצרת אצל המנהל ומועברת אליו במסמך (המצב והמנוע נעולים למשתמש רגיל)
    const id = j.job.id, key = crypto.randomBytes(32).toString('base64url'), f = db.get('studioJobs/' + id).fields;
    Object.assign(f, { kh: { stringValue: crypto.createHash('sha256').update(key).digest('hex') }, kx: { integerValue: String(NOW + 3600e3) }, state: { stringValue: 'running' } });
    if (who !== OWNER) f.uid = { stringValue: 'otherUid0002' };
    if (vi) f.spec = { stringValue: JSON.stringify(Object.assign(JSON.parse(f.spec.stringValue), { vi: 1 })) };   // עבודת ניתוח (גל 0 יוצר רק הרצה יבשה עם R2 — כאן ישירות במסמך)
    return { id, key, lid: vi ? VC.viLid(id) : LR.lid(id), put: (lc, k) => call({ op: 'learnPut', job: id, key: k || key, lc }, true).then((r) => r) };
  };
  const body = (o) => zlib.gzipSync(Buffer.from(JSON.stringify(o))).toString('base64');
  const cfgR = R2.config({ R2_ACCOUNT_ID: ACC, R2_ACCESS_KEY_ID: 'AKTEST', R2_SECRET_ACCESS_KEY: 'sekret/xyz', R2_BUCKET: 'snb-studio' });
  const keysIn = async (pre) => (await R2.list(cfgR, { fetch: fetchAll, now: () => NOW }, pre)).map((x) => x.key);
  const obj = (k) => Buffer.from(R.objs.get('snb-studio/' + k) || R.objs.get(k) || '').toString('utf8');
  const setObj = (k, v) => R.objs.set(R.objs.has('snb-studio/' + k) ? 'snb-studio/' + k : k, Buffer.from(v));
  const doc = (k) => (db.get(k) ? require(path.join(root, 'ibkr-proxy/lib/studio.js')).fromFields(db.get(k).fields) : null);
  const corpIn = { v: VC.VC_V, tr: [['e1', 0, 4, 'S1', 'call me at 054-1234567', 0.9]], it: [['n1', 'claim', '', 'הרווח עלה', ['e1'], '', 'speaker', 'high', 'sup']] };

  // הסכמה ומנהל
  const a = await newJob(OWNER, true);
  ok((await a.put(body(corpIn))).j.saved === false, 'בלי הסכמה לתוכן הניתוח (lat) — לא נשמר');
  ok((await call({ op: 'learnPref', ack: true, tv: 3, vi: { lat: true }, idToken: OWNER })).code === 400, 'הסכמה עם נוסח ישן (tv 3) — נדחית, lat לא נרשם');
  const lr0 = (await api('status', {}));
  const pf = await api('learnPref', { ack: true, tv: 5, vi: { lat: true, lau: true, lam: 'yes' } });
  ok(pf.ok && pf.lat > 0 && pf.lau > 0 && !('lam' in pf), 'הנוסח LRN_VV (tv 5): lat ו־lau נרשמו; ערך לא בוליאני — לא');
  ok(!('lrf' in pf) && !('lrt' in pf) && !('lra' in pf), 'ההסכמה לניתוח לא מחזירה/רושמת את ההסכמות של התרגום');
  const st0 = (await api('status', {}));
  ok(st0.lat > 0 && st0.lau > 0 && st0.lam === 0, 'status מחזיר את ההסכמות של הניתוח');
  ok(st0.lrf === lr0.lrf && st0.lrt === lr0.lrt && st0.lrm === lr0.lrm && st0.lra === lr0.lra && st0.lrn === lr0.lrn, 'lra/lrt/lrm/lrf והמתג — בלי שינוי אחרי ההסכמה לניתוח');
  ok((await call({ op: 'learnPref', ack: true, tv: 6, vi: { lat: true }, idToken: OWNER })).code === 400 && (await call({ op: 'learnPref', ack: true, tv: 5, vi: {}, idToken: OWNER })).code === 400, 'נוסח לא מוכר / בלי מטרה — 400');
  const pr = await a.put(body(corpIn));
  ok(pr.j.ok && pr.j.saved === true, 'learnPut (ניתוח, המנהל, lat): נשמר');
  ok((await keysIn('viq/')).join() === 'viq/' + a.lid + '.bin' && (await keysIn('vik/')).join() === 'vik/' + a.lid && (await keysIn('q/')).length === 0, 'בתור viq/<lid> וה־DEK ב־vik/<lid> — לא בתור של התרגום');
  const sq = obj('viq/' + a.lid + '.bin'), sk = obj('vik/' + a.lid);
  ok(sq.startsWith('vc1.') && sk.startsWith('vk1.') && !/054|call me|הרווח|my-private|ownerUid|owner@example/.test(sq + sk), 'בדלי — מוצפן: בלי טקסט, שם קובץ, uid או מייל');
  ok(a.lid !== LR.lid(a.id) && ![...await keysIn('viq/'), ...await keysIn('vik/'), ...await keysIn('q/')].some((k) => k.includes(LR.lid(a.id))), 'המזהה בדלי — HMAC, לא sha256 שאפשר לחשב ממזהה העבודה');
  ok((await a.put(body(corpIn))).j.saved === false, 'פעם אחת לעבודה (lc)');
  ok((await a.put(body(corpIn), 'x'.repeat(43))).code >= 400, 'בלי הרשאה: מפתח עבודה שגוי — נדחה');
  const o1 = await newJob(OTHER, true);
  await apiO('learnPref', { ack: true, tv: 5, vi: { lat: true, lau: true } });
  ok((await o1.put(body(corpIn))).j.saved === false && (await keysIn('viq/')).length === 1, 'משתמש אחר (לא המנהל) — לא נאסף לפני ה7, גם עם הסכמה');
  const t1 = await newJob(OWNER, false);
  await api('learnPref', { ack: true, tv: 2 });
  ok((await t1.put(body({ v: 1, cu: [{ i: 1, s: 0, e: 1, k: 'S1', en: 'x', d: 'א' }] }))).j.saved === true && (await keysIn('q/')).length === 1, 'התרגום — כמו קודם (q/)');

  // הרשומה המספרית ואירועי השימוש
  const ux = (j, uxb, who) => call({ op: 'learnUx', job: j.id, ux: uxb, idToken: who || OWNER }).then((r) => r);
  ok((await ux(a, { vi: { o: 2, rd: 40 }, vf: [{ id: 'n1', why: 'ts', at: 1 }], e: { s: 9 } })).j.ok, 'learnUx (ניתוח, lau)');
  const ja = doc('studioJobs/' + a.id).ux;
  ok(ja.vi && ja.vf && !ja.e, 'בעבודת ניתוח נשמרות רק הקבוצות vi/vf');
  const lr = doc('studioLearn/' + a.lid);
  ok(lr && lr.lr.k === 'vi' && lr.lr.id === a.lid && !db.get('studioLearn/' + LR.lid(a.id)), 'הרשומה המספרית: studioLearn/<viLid>, k:vi');
  ok((await ux(t1, { vi: { o: 1 } })).code === 400, 'בעבודת תרגום — vi/vf נזרקות (בלי שום קבוצה אחרת = 400)');
  ok((await ux(a, { vi: { o: 1 } }, OTHER)).code === 404 || (await ux(a, { vi: { o: 1 } }, OTHER)).code === 403, 'משתמש אחר לא כותב לעבודה שלך');
  await api('learnPref', { ack: true, tv: 5, vi: { lau: false } });
  ok((await ux(a, { vi: { o: 1 } })).j.saved === false, 'בלי lau (בוטל) — אירועי השימוש לא נשמרים');
  ok((await call({ op: 'learnPref', ack: true, tv: 5, vi: { lat: true } })).code === 401, 'learnPref בלי טוקן — 401');

  // המשיכה לניתוח ויומן הפענוח
  const at = await api('atNew', { n: 'vi-test' });
  const tokA = at.token || at.at || at.tok;
  ok((await call({ op: 'learnPull', at: 'x'.repeat(40), vi: 1 }, true)).code === 401, 'learnPull עם טוקן לא קיים — 401');
  const p0 = await call({ op: 'learnPull', at: tokA, vi: 1 }, true);
  ok(p0.j.ok && p0.j.vi.on && p0.j.vi.q === 1 && !p0.j.vi.items.length && !db.get('sysLearn/vilog'), 'learnPull vi: בלי ci — רק ספירות, ולא נפתח כלום (אין רישום ביומן)');
  const p1 = await call({ op: 'learnPull', at: tokA, vi: 1, ci: 5 }, true);
  ok(p1.j.vi.items.length === 1 && p1.j.vi.items[0].q === 1 && p1.j.vi.items[0].tr[0][4] === 'call me at ⟨טלפון⟩' && !/ownerUid|my-private/.test(JSON.stringify(p1.j.vi.items)), 'ci: הפריט נפתח (מנוקה, בלי מזהים)');
  const lgl = JSON.parse((doc('sysLearn/vilog') || {}).vl || 'null');
  ok(lgl && lgl.length === 1 && lgl[0].op === 'pull' && lgl[0].ids === a.lid.slice(0, 8) && /^at:/.test(lgl[0].by) && lgl[0].at === NOW, 'יומן הפענוח: מי (הטוקן), מתי, מה — שורה לכל משיכה');

  // האצווה, שיבוש ושחזור
  const b2 = await newJob(OWNER, true);
  ok((await b2.put(body(corpIn))).j.saved === true, 'עוד עבודת ניתוח בתור');
  const s2 = obj('viq/' + b2.lid + '.bin');
  setObj('viq/' + b2.lid + '.bin', s2.slice(0, -8) + (s2.slice(-8, -7) === 'A' ? 'B' : 'A') + s2.slice(-7));   // שיבוש
  let wch = await call({}, false, true);
  ok(wch.j.ok && wch.j.lc >= 2, 'האצווה רצה');
  ok((await keysIn('viq/')).length === 0 && (await keysIn('vic/')).join() === 'vic/2026-10/' + a.lid + '.bin', 'האצווה: התקין עבר ל־vic/<חודש>/, המשובש נזרק');
  ok((await keysIn('vik/')).join() === 'vik/' + a.lid, 'ה־DEK של הפריט המשובש נמחק איתו');
  setObj('vic/2026-10/' + b2.lid + '.bin', obj('vic/2026-10/' + a.lid + '.bin'));   // העתקה ל־lid אחר
  setObj('vik/' + b2.lid, obj('vik/' + a.lid));
  const p2 = await call({ op: 'learnPull', at: tokA, vi: 1, ci: 5 }, true);
  ok(p2.j.vi.items.length === 1 && p2.j.vi.items[0].id === a.lid, 'פריט ו־DEK שהועתקו ל־lid אחר — לא נפתחים (AAD), רק המקורי');
  R.objs.delete('snb-studio/vic/2026-10/' + b2.lid + '.bin'); R.objs.delete('vic/2026-10/' + b2.lid + '.bin');
  R.objs.delete('snb-studio/vik/' + b2.lid); R.objs.delete('vik/' + b2.lid);

  // "מחק את התרומות שלי" — מחיקה קריפטוגרפית
  const keep = obj('vic/2026-10/' + a.lid + '.bin');   // "גיבוי" שנשאר במקום אחר
  const fg = await api('learnForget', {});
  ok(fg.ok && fg.nc >= 1 && (await keysIn('vic/')).length === 0 && (await keysIn('vik/')).length === 0 && (await keysIn('viq/')).length === 0, 'learnForget: התור, החודשים וה־DEK נמחקו');
  ok(!db.get('studioLearn/' + a.lid), 'learnForget: גם הרשומה המספרית של הניתוח (viLid)');
  setObj('vic/2026-10/' + a.lid + '.bin', keep);
  const p3 = await call({ op: 'learnPull', at: tokA, vi: 1, ci: 5 }, true);
  ok(p3.j.vi.n === 1 && p3.j.vi.items.length === 0, 'שחזור מגיבוי אחרי המחיקה — התוכן לא נפתח (ה־DEK הושמד)');
  R.objs.delete('snb-studio/vic/2026-10/' + a.lid + '.bin'); R.objs.delete('vic/2026-10/' + a.lid + '.bin');

  // 24 חודשים: התוכן וה־DEK
  NOW = Date.UTC(2026, 9, 25, 12); R.now = NOW;
  const c3 = await newJob(OWNER, true);
  ok((await c3.put(body(corpIn))).j.saved === true, 'עבודה חדשה אחרי המחיקה — נשמרת');
  NOW = Date.UTC(2026, 9, 26, 12); R.now = NOW;
  await call({}, false, true);
  ok((await keysIn('vic/')).length === 1 && (await keysIn('vik/')).length === 1, 'עבר לחודש');
  NOW = Date.UTC(2028, 10, 2, 12); R.now = NOW;
  await call({}, false, true);
  ok((await keysIn('vic/')).length === 0 && (await keysIn('vik/')).length === 0, 'אחרי 24 חודשים — התוכן וה־DEK נמחקים');

  // הקוד: הגבלות שלא נבדקות בהתנהגות כאן (R2 של העבודות לא מוגדר ברתמה הזו)
  const src = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
  ok(/if \(op === 'url' && Array\.isArray\(body\.ks\)\) \{[\s\S]{0,200}slice\(0, R2URL_KS\)[\s\S]{0,120}ks\.length !== body\.ks\.length \|\| !ks\.every\(\(k\) => SR\.inFolder\(k, folder\)\)/.test(src), 'r2url ks: עד R2URL_KS, כולם בתיקיית העבודה, כפילות/זר — הכל נדחה');
  ok(/const LRN_VV = 5;/.test(src) && /async function viCorpusPull[\s\S]{0,2500}await viLog\(deps, by, 'pull', opened, now\);/.test(src), 'LRN_VV = 5; כל משיכה שפותחת פריטים — ביומן');
  ok(/job\.spec && job\.spec\.vi === 1\) \|\| !LC\.MEDIA_KINDS/.test(src) && /job\.spec && job\.spec\.vi === 1\) \|\| !sess/.test(src), 'הקול/240p והעריכות של התרגום — לא בעבודת ניתוח');
  ok(VI.VI_ERR.length > 0, 'studiovi נטען');
  // PR 1.6: הקריטריון (6.7) — viDecide = vimetrics.decide בעובד, על אותה פיקסטורה (אותו LCG ואותו סדר חיבור)
  const vdf = require('./fixtures/vi-decide.json');
  ok(vdf.cases.length >= 5 && vdf.cases.every((c) => JSON.stringify(VI.viDecide(c.rows)) === JSON.stringify(c.out)), 'הקריטריון: viDecide זהה ל־vimetrics.decide (הפיקסטורה המשותפת)');
  ok(VI.wilsonLb(0, 0) === null && VI.wilsonLb(8, 10) === 0.4902 && VI.bootLb({}) === null && VI.bootLb({ v: [0.05, 0.05] }) === 0.05, 'הקריטריון: Wilson ו־bootstrap — מקרי קצה');
  ok(VI.normVjd({ p: [{ j: 'j' + 'a'.repeat(20), wa: 0, w: 'Y' }] }) === null && VI.normVjd({ p: [{ j: 'j' + 'a'.repeat(20), wa: 1, w: 'Z', ex: -1, a: { support_rate: 2 } }] }).p[0].w === null
    && VI.normVjd({ p: [{ j: 'j' + 'a'.repeat(20), wa: 1, w: 'X', ex: -1, a: { support_rate: 2 } }] }).p[0].ex === 0, 'השופט: normVjd — זרוע 0 לא נשפטת מול עצמה, ערכים מחוץ לטווח נזרקים');
  void vault;
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
