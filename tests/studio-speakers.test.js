// studio-speakers.test.js — דוברים בכל תמליל (16/11/2026; המשתמש: "לכל דובר — מי הוא, המגדר שלו ובאיזו שפה הוא מדבר;
// צבע שונה לכל דובר, בממשק נקי בזכוכית"). studiospk.js: הפלטה (וההתאמה ל־CSS ולניגודיות), צבע לכל דובר, ראשי תיבות,
// שורת הפרטים, מה ששינית (vsp); העורך: normSp (זהה ל־peaks.py), cueHead, spkColors; החיבור במטמון ובמחרוזות.
// הדף עצמו (כרטיס, תורות, גיליון, סינון) — ב־studio-vi-page.test.js, סעיף 5.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const SK = await import(path.join(root, 'studiospk.js'));
  const SB = await import(path.join(root, 'studiosubs.js'));
  const T = (k, o) => k + (o ? JSON.stringify(o) : '');
  const css = read('studio.css'), spk = read('studiospk.js'), sj = read('studio.js'), app = read('app.js');

  /* ---------- 1. הפלטה ---------- */
  ok(SK.SPK_BASE.length === 6 && SK.SPK_INK.length === 6 && SK.SPK_N === 6 && [...SK.SPK_ORDER].sort().join() === '0,1,2,3,4,5', 'שישה גוונים, והסדר הוא תמורה שלהם');
  ok(SK.SPK_BASE.every((c, i) => css.includes('[data-spk="' + i + '"] { --sb: ' + c + '; --sk: ' + SK.SPK_INK[i] + '; }')), 'הפלטה ב־CSS = הפלטה בקוד (בסיס ודיו לכל data-spk)');
  ok(/:is\(\[data-theme="dark"\], \.st-dark\) \[data-spk\] \{ --si: var\(--sk\); \}/.test(css) && /prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\) \[data-spk\] \{ --si: var\(--sk\); \}/.test(css)
    && /\[data-spk\] \{ --si: var\(--sb\); \}/.test(css), 'בבהיר הדיו = הבסיס; בכהה ובעורך — הדיו הבהיר');
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  ok(SK.SPK_BASE.every((c) => cr('#FFFFFF', c) >= 4.5 && cr(c, '#F2F2F7') >= 4.5), 'הבסיס: ראשי תיבות לבנים והשם על הרקע הבהיר — 4.5:1 לפחות');
  ok(SK.SPK_INK.every((c) => cr(c, '#2C2C2E') >= 4.5 && cr(c, '#000000') >= 4.5), 'הדיו: על הכרטיס הכהה ועל השחור — 4.5:1 לפחות');
  ok(SB.SPK_COLORS === SK.SPK_INK, 'העורך (כהה תמיד) והציר — הדיו');

  /* ---------- 2. צבע לכל דובר ---------- */
  const m = SK.spkIdx(['a', 'b', 'c', 'd', 'e', 'f', 'g'], {});
  ok([...m.values()].slice(0, 6).join() === SK.SPK_ORDER.join() && m.get('g') === SK.SPK_ORDER[0], 'ברירת המחדל לפי SPK_ORDER; מעבר לשישה — במעגל');
  const m2 = SK.spkIdx(['a', 'b', 'c'], { b: 0 });
  ok(m2.get('b') === 0 && m2.get('a') === 2 && m2.get('c') === 4, 'בחירה נשמרת, והשאר — הגוון הפנוי הבא (כל דובר בצבע אחר)');
  const m3 = SK.spkIdx(['a', 'b'], { a: 3, b: 3 });
  ok(m3.get('a') === 3 && m3.get('b') === 0, 'שתי בחירות זהות — הראשון בסדר שומר, השני מקבל גוון פנוי');
  ok(SK.spkIdx(['a'], { a: 9 }).get('a') === 0 && SK.spkIdx(['a'], { a: 1.5 }).get('a') === 0 && SK.spkIdx(['a'], null).get('a') === 0, 'מספר לא תקין — ברירת המחדל');
  const sk = [{ spk: 'S1' }, { spk: 'S2' }, { spk: 'S1' }, { spk: 'S3' }];
  const col = SB.spkColors(sk, { S3: 0 });
  ok(col.get('S3') === SK.SPK_INK[0] && col.get('S1') === SK.SPK_INK[2] && col.get('S2') === SK.SPK_INK[4], 'העורך: אותו כלל (spkIdx), בצבעי הדיו');

  /* ---------- 3. ראשי תיבות, שם ושורת הפרטים ---------- */
  ok(SK.initials('Dana Levi', 1) === 'DL' && SK.initials('daniel', 1) === 'D' && SK.initials('נועה', 1) === 'נ' && SK.initials('דנה לוי', 1) === 'ד'
    && SK.initials('', 3) === '3' && SK.initials('"Dr. Who"', 1) === 'DW' && SK.initials('Dana לוי', 1) === 'D', 'ראשי תיבות: לטינית — עד שתיים, כתב אחר — אחת, בלי שם — המספר');
  const s = SK.spkView(T, { k: 'S2', name: '', role: '', g: 'x', lg: [{ lg: 'en', sh: 0.9 }, { lg: 'he', sh: 0.04 }, { lg: 'fr', sh: 0.06 }] }, 2, 4);
  ok(s.name === 'studioSpkN{"n":2}' && !s.named && s.ini === '2' && s.g === 'u' && s.c === 4 && s.k === 'S2', 'בלי שם — "דובר N", המספר בעיגול, מגדר לא ידוע');
  ok(SK.spkLine(T, s, (c) => c.toUpperCase()) === 'studioSpkGU · EN, FR', 'שורת הפרטים: מגדר ושפות מ־5% (לפי החלק)');
  const s2 = SK.spkView(T, { k: 'S1', name: 'Dana Levi', role: 'מרצה', g: 'f', lg: [{ lg: 'en', sh: 1 }] }, 1, 0);
  ok(SK.spkLine(T, s2, (c) => c) === 'מרצה' && s2.named && s2.ini === 'DL', 'ידוע מי הוא — רק מי הוא (המגדר והשפות בגיליון)');
  /* 17/11/2026 (מי מדבר): התואר · התפקיד בסרטון · "בגילום X"; kb רק כשהוא 1 */
  const s3 = SK.spkView(T, { k: 'S1', name: 'ג׳נסן הואנג', role: 'מרואיין', ttl: 'מנכ״ל NVIDIA', orig: 'Jensen Huang', kb: 1, g: 'm', lg: [] }, 1, 0);
  ok(SK.spkLine(T, s3, (c) => c) === 'מנכ״ל NVIDIA · מרואיין' && SK.spkWho(T, s3) === 'מנכ״ל NVIDIA · מרואיין' && s3.kb && s3.orig === 'Jensen Huang', 'תואר · תפקיד');
  const s4 = SK.spkView(T, { k: 'S2', name: 'טוני סטארק', role: 'דמות', act: 'רוברט דאוני ג׳וניור', kb: true, lg: [] }, 2, 1);
  ok(SK.spkLine(T, s4, (c) => c) === 'דמות · studioSpkAct{"n":"רוברט דאוני ג׳וניור"}' && !s4.kb, 'סרט/סדרה — הדמות, ו"בגילום" השחקן; kb רק 1');
  const s5 = SK.spkView(T, { k: 'S3', name: '', role: 'שואל מהקהל', lg: [] }, 3, 2);
  ok(SK.spkLine(T, s5, (c) => c) === 'שואל מהקהל' && s5.name === 'studioSpkN{"n":3}', 'בלי שם — "דובר 3" ומה הוא בסרטון');
  ok(SK.mainLg(s) === 'en' && SK.mainLg({ lg: [] }) === '' && SK.pctOf(0.712) === 71, 'השפה העיקרית והאחוז');

  /* ---------- 4. מה ששינית (store.vsp) ---------- */
  const id = 'j' + 'a'.repeat(20);
  const v0 = SK.normVsp({ [id]: { S1: { n: '  Dana \n  Levi ', r: 'x'.repeat(60), g: 'f', c: 2, z: 1 }, S2: { g: 'q', c: 9 }, ['x'.repeat(21)]: { n: 'a' }, S3: [] }, bad: { S1: { n: 'a' } } });
  ok(same(v0, { [id]: { S1: { n: 'Dana Levi', r: 'x'.repeat(40), g: 'f', c: 2 } } }), 'normVsp: מזהה עבודה, מפתח עד 20, שם ותפקיד עד 40, מגדר וצבע תקינים בלבד');
  ok(same(SK.normVsp(null), {}) && same(SK.normVsp([1]), {}) && same(SK.normVsp({ [id]: { S1: { n: '' } } }), { [id]: { S1: { n: '' } } }), 'קלט לא תקין — ריק; שם ריק נשמר ("מחקתי")');
  const ids = Array.from({ length: SK.VSP_MAX + 5 }, (_, i) => 'j' + String(i).padStart(20, '0'));
  let all = {};
  for (const x of ids) all = SK.vspSet(all, x, 'S1', { g: 'm' });
  all = SK.vspSet(all, ids[ids.length - 1], 'S1', { r: 'מנחה' });
  ok(Object.keys(all).length === SK.VSP_MAX && !all[ids[0]] && same(all[ids[ids.length - 1]].S1, { r: 'מנחה', g: 'm' }), 'vspSet: עד VSP_MAX עבודות (האחרונות), שינוי מתמזג');
  const mv = SK.vspMove({ [id]: { S1: { r: 'מנחה', g: 'f' } } }, id, 'S1', 'Dana');
  ok(mv[id].Dana.r === 'מנחה' && !mv[id].S1 && SK.vspMove(mv, id, 'zz', 'y') === mv, 'vspMove: שינוי שם בעורך — מה ששמרת עובר לשם החדש');
  ok(/vsp: normVsp\(src\.vsp\)/.test(sj) && /spkOv: \(\) => \(store\.vsp \|\| \{\}\)\[rec\.id\] \|\| \{\}/.test(sj) && /onSpkMove: \(from, to\) => \{ store\.vsp = vspMove\(/.test(sj),
    'הסטודיו: מה ששינית בדובר — ב־store (pwa_studio_v1, ב־ACCOUNT_KEYS), לכל עבודה');
  ok(/function spkColorSet\(id, key, i\) \{\n\s*if \(LABEL_RE\.test\(key\)\) \{ store\.vsp = vspSet\(store\.vsp, id, key, \{ c: i \}\); save\(\); \}\n\s*else spkcSet\(key, i\);/.test(sj),
    'צבע: לדובר עם שם — לפי השם (כל העבודות), לתווית — לעבודה הזו בלבד');

  /* ---------- 5. העורך: המידע מהעובד וראש הכתובית ---------- */
  const sp = SB.normSp({ S1: { n: ' Dana\n Levi ', r: 'מנחה', g: 'f', gs: 'text' }, S2: { g: 'x', gs: 'voice' }, S3: { g: 'm', gs: 'zzz' }, bad: { n: 'x' }, S4: 'x' });
  ok(same(sp, { S1: { n: 'Dana Levi', r: 'מנחה', g: 'f', gs: 'text' }, S3: { g: 'm' } }), 'normSp: תוויות בלבד, מגדר m/f, המקור רק עם מגדר');
  const meta = SB.normMeta({ v: 1, r: 20, pk: 'AAAA', sh: [], sp: { S1: { n: 'Dana' } } });
  ok(meta && meta.sp.S1.n === 'Dana' && same(SB.normMeta({ v: 1, r: 20, pk: 'AAAA' }).sp, {}), 'normMeta מעביר את הדוברים (עבודה ישנה — ריק)');
  const pk = read('translator/peaks.py');
  ok(new RegExp('^SP_MAX = ' + SB.SP_MAX + '\\b', 'm').test(pk) && new RegExp('^SP_LEN = ' + SB.SP_LEN + '\\b', 'm').test(pk), 'SP_MAX / SP_LEN — זהים ל־peaks.py');
  const sx = { lg: [{ lg: 'en', sh: 0.8 }, { lg: 'he', sh: 0.2 }] }, one = { lg: [{ lg: 'en', sh: 1 }] };
  const c1 = { spk: 'S1' }, c2 = { spk: 'S1', lg: 'he' }, c3 = { spk: 'S2' };
  ok(SB.cueHead(c1, null, sx, false).turn && !SB.cueHead(c2, c1, sx, false).turn && SB.cueHead(c2, c1, sx, false).tag === 'he' && SB.cueHead(c3, c2, one, false).turn,
    'cueHead: תחילת תור כשהדובר מתחלף; תג לשפה שאינה העיקרית');
  ok(SB.cueHead(c2, c1, sx, true).turn && SB.cueHead(c1, c1, one, false).tag === '' && !SB.cueHead(c1, c1, one, false).turn, 'בסינון — ראש בכל שורה; דובר בשפה אחת — בלי תג');

  /* ---------- 6. בלי HTML, ובלי שם מוצר ---------- */
  ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(spk), 'studiospk.js — שמות מהמודל ומהמשתמש כטקסט בלבד');
  ok(/לפי ת־עיצוב/.test(spk) && /לפי ת־עיצוב/.test(css.slice(css.indexOf('דוברים בכל תמליל'))), 'לפי ת־עיצוב (בלי שם מוצר)');

  /* ---------- 6ב. ממצאי הבדיקה בעין (צילומים בבהיר ובכהה, 16/11/2026) ---------- */
  const rowSrc = spk.slice(spk.indexOf('export function spkRow'), spk.indexOf('export function spkSheet'));
  ok(!/dir = 'auto'/.test(rowSrc) && (spk.match(/h\('bdi', null, s\.name\)/g) || []).length === 2, 'שם לועזי בשורה ובכותרת הגיליון — בתוך bdi, לא dir=auto על הבלוק (נשאר מיושר לימין)');
  ok(/ttlN\.textContent = s\.name/.test(spk) && !/ttl\.textContent/.test(spk), 'רענון הכותרת אחרי שינוי שם — לא מוחק את ה־bdi');
  ok(/chev: icon\('chev', 'st-chev'\)/.test(read('studiosubs.js')), 'החץ בשורות הדוברים בעורך — עם st-chev (בלי מחלקה ה־SVG ממלא את השורה)');
  ok(/\.st-root, \.st-rs \{ --sg-track:/.test(css) && /\[data-theme="dark"\] :is\(\.st-root, \.st-rs\) \{ --sg-track-sh:/.test(css), 'בורר המגדר בגיליון (.st-rs נוסף ל־body) — משתני המסילה והעדשה מוגדרים גם שם, בבהיר ובכהה');

  /* ---------- 7. החיבור: מטמון, טעינה מוקדמת, מחרוזות ---------- */
  const sw = read('sw.js'), cg = read('tools/coregen.js'), html = read('studio.html');
  ok(/STUDIO_SHELL = \[[^\]]*'\.\/studiospk\.js'/.test(sw) && /"\.\/studiospk\.js": "[0-9a-f]{32}"/.test(sw), 'studiospk.js במטמון (STUDIO_SHELL + טביעה)');
  ok(/studio: \[[^\]]*'studiospk\.js'/.test(cg) && /share: \[[^\]]*'studiospk\.js'/.test(cg) && html.includes('<link rel="modulepreload" href="studiospk.js">'), 'המחרוזות — בסטודיו ובדף השיתוף; modulepreload');
  const keys = new Set();
  for (const f of ['studiospk.js', 'studiovi.js', 'studiosubs.js']) for (const x of read(f).matchAll(/T\('(studioSpk[A-Za-z]*)'/g)) keys.add(x[1]);
  const missing = [...keys].filter((k) => (app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length !== 2);
  ok(keys.size >= 15 && !missing.length, 'כל מחרוזות הדוברים — בעברית ובאנגלית' + (missing.length ? ' (חסר: ' + missing.join(', ') + ')' : ''));
  for (const f of ['strings-studio.js', 'strings-share.js']) ok(read(f).includes('studioSpkOnly'), f + ' — כולל את מחרוזות הדוברים');

  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
