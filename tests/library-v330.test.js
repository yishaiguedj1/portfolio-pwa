// v330: (1) סימנייה רק בעמוד שסומן — לא גם בעמוד הקודם; (2) מחברת: כרטיסי הדגשה בצבע שלהם + סרט סימנייה;
// (3) סימנייה תלת־ממדית: מנוע פיזיקה (בד Verlet) + רינדור WebGL (נוסחאות Filament, צל רך מאור שטחי);
// (4) פרק בלי <head> — עיצוב הקורא חל בכל זאת
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const r3src = fs.readFileSync(path.join(root, 'ribbon3d.js'), 'utf8');
const pure = (name) => new Function(lib.match(new RegExp('export function ' + name + '[\\s\\S]*?\\n}\\n'))[0].replace('export ', '') + ';return ' + name + ';')();

(async () => {
  // ---------- 1. סימנייה בעמוד אחד בלבד ----------
  const bmOnPage = pure('bmOnPage');
  const num = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  // עמוד 1 = [0,10), עמוד 2 = [10,20): הסוף של עמוד 1 הוא ההתחלה של עמוד 2
  ok(bmOnPage(10, 10, 20, num) && !bmOnPage(10, 0, 10, num), 'סימנייה בתחילת עמוד 2 — רק בעמוד 2, לא בעמוד 1 (הבאג: הופיעה גם בעמוד הקודם)');
  ok(bmOnPage(0, 0, 10, num) && bmOnPage(5, 0, 10, num) && !bmOnPage(20, 10, 20, num) && !bmOnPage(-1, 0, 10, num), 'טווח חצי־פתוח [התחלה, סוף)');
  ok(bmOnPage(7, 7, 7, num) && !bmOnPage(8, 7, 7, num), 'עמוד בנקודה אחת (טווח מתנוון) — עדיין מזוהה');
  const C = await import(path.join(root, 'vendor/foliate-js/epubcfi.js'));
  const p1 = 'epubcfi(/6/4!/4,/2/1:0,/10/1:30)', p2 = 'epubcfi(/6/4!/4,/10/1:30,/18/1:5)';
  const onPage = (b, pg) => bmOnPage(b, C.collapse(pg), C.collapse(pg, true), C.compare);
  const mark = C.collapse(p2);          // סימנייה נשמרת בתחילת הטווח הגלוי של עמוד 2
  ok(onPage(mark, p2) && !onPage(mark, p1), 'עם CFI אמיתי: הסימנייה של עמוד 2 לא נדלקת בעמוד 1');
  ok(/liveAnn\(rd\.rec\.ann, 'bm'\)\.find\(\(b\) => bmOnPage\(b\.c, a, z, CFI\.compare\)\)/.test(lib), 'pageHasBookmark משתמש בכלל החצי־פתוח');

  // ---------- 2. מחברת ----------
  ok(/r\.dataset\.k = a\.k \|\| 'y'/.test(lib) && /h\('span', 'ann-mark', a\.x \|\| '—'\)/.test(lib), 'כרטיס הדגשה: צבע ההדגשה בכרטיס + הטקסט מסומן בצבע שלו');
  ok(/\.ann-row:not\(\.bm\) \{[^}]*background: color-mix\(in srgb, var\(--hl\) 8%, var\(--surface\)\)/.test(css) && /\.ann-row:not\(\.bm\)::before \{[^}]*background: var\(--hl\)/.test(css), 'רקע עדין בצבע ההדגשה + פס צבע מעוגל');
  ok(/\.ann-mark \{[^}]*color-mix\(in srgb, var\(--hl\) 42%/.test(css) && /\[data-theme="dark"\] \.ann-mark/.test(css), 'סימון הטקסט עצמו — גם במצב כהה');
  ok(/rb\.innerHTML = ribbonMiniSVG\(\)/.test(lib) && /function ribbonMiniSVG\(\) \{[\s\S]{0,200}'snbRb' \+ \(\+\+rbSeq\)/.test(lib), 'סימנייה במחברת = אותו סרט ירוק כמו בספר (מזהה גרדיאנט ייחודי לכל כרטיס)');

  // ---------- 3. המנוע התלת־ממדי ----------
  ok(!/^\s*import\s/m.test(r3src) && !/\bdocument\.|\bwindow\./.test(r3src.replace(/\/\/.*$/gm, '')), 'ribbon3d.js: בלי ייבוא ובלי DOM בטעינה (נטען רק בקורא, עובד אופליין)');
  const M = new Function(r3src.replace(/^export /gm, '') + '\nreturn { RB, createSim, simRest, simSnap, simStep, simTail, simDelta, ribbonPlan, planAt, buildMesh, meshSize, meshIndices, shadowSamples, createRibbon, createRibbonAsync, ease, bez3 };')();
  const { RB } = M, H = 1 / RB.hz;
  const s0 = M.createSim();
  ok(s0.n === RB.NL * RB.NW && [0, 1, 2, 3, 4, 5].every((t) => s0.C.some((c) => c[2] === t)), 'רשת חלקיקים ' + RB.NL + '×' + RB.NW + ' עם אילוצי אורך/רוחב/גזירה/כיפוף/קשת');
  const finite = (s) => Array.from(s.P).every(Number.isFinite);
  // מריץ תוכנית כמו ה־tick של המנוע ומודד: גלים לאורך הסרט, מתיחה, גובה שיא, חדירה לדף, התייצבות
  function runPlan(kind) {
    const s = M.createSim(); M.simSnap(s, kind === 'add' ? RB.peek : RB.full); s.color = kind === 'add' ? 0 : 1;
    const pl = M.ribbonPlan(kind, s); const prev = new Float32Array(s.n * 3); prev.set(s.P);
    let t = 0, wave = 0, stretch = 0, peak = 0, minZ = Infinity, anchorOff = 0, settled = null, overGrip = 0;
    for (let i = 0; i < 3 * RB.hz; i++) {
      t += H;
      if (t <= pl.dur) {
        const st = M.planAt(pl, t, s); s.grip = st.grip; s.len = st.len; s.color = st.color; s.attract = st.attract;
        if (st.grip) { const d = Math.hypot(st.grip[0] - s.ax, st.grip[1] - s.ay, st.grip[2] - RB.zRest); if (st.len < Math.min(d, Math.max(pl.Lf, pl.Lt) * 1.04) - 1e-9) overGrip++; }
      } else s.grip = null;
      M.simStep(s, H);
      const z = []; for (let j = 0; j < s.NL; j++) z.push(s.P[(j * s.NW + 1) * 3 + 2]);
      for (let j = 1; j < s.NL - 1; j++) if (z[j] > z[j - 1] && z[j] > z[j + 1]) { let m = z[j]; for (let q = j + 1; q < s.NL; q++) { m = Math.min(m, z[q]); if (z[q] > m + 0.3) break; } wave = Math.max(wave, z[j] - m); }
      peak = Math.max(peak, ...z);
      for (let k = s.NW; k < s.n; k++) minZ = Math.min(minZ, s.P[k * 3 + 2]);
      for (let i2 = 0; i2 < s.NW; i2++) anchorOff = Math.max(anchorOff, Math.abs(s.P[i2 * 3 + 1] - s.ay));
      let L = 0; for (let j = 1; j < s.NL; j++) { const a = ((j - 1) * s.NW + 1) * 3, c = (j * s.NW + 1) * 3; L += Math.hypot(s.P[c] - s.P[a], s.P[c + 1] - s.P[a + 1], s.P[c + 2] - s.P[a + 2]); }
      stretch = Math.max(stretch, L / s.len - 1);
      if (i % 4 === 3) { const d = M.simDelta(s, prev); if (t > pl.rel && d < 0.05) { if (settled === null) settled = t; } else settled = null; }
    }
    return { s, wave, stretch, peak, minZ, anchorOff, settled, overGrip, tail: M.simTail(s) };
  }
  for (const kind of ['add', 'remove']) {
    const r = runPlan(kind), L = kind === 'add' ? RB.full : RB.peek;
    ok(finite(r.s), kind + ': בלי NaN');
    ok(r.minZ >= r.s.zMin - 1e-6, kind + ': הבד אף פעם לא חודר לדף (מינימום ' + r.minZ.toFixed(2) + ')');
    ok(r.anchorOff < 1e-6, kind + ': הקצה העליון נשאר מחובר לדף');
    ok(r.peak > 20 && r.peak < 90, kind + ': מתרומם באמת לאוויר (שיא ' + r.peak.toFixed(0) + 'px) ולא נעלם מעל המסך');
    ok(r.wave < 1, kind + ': בלי קמטים/גלים לאורך הסרט (' + r.wave.toFixed(2) + 'px; היה 4.5px כשהאורך קיבל "רפיון")');
    ok(r.stretch < 0.05, kind + ': הבד לא נמתח (' + (r.stretch * 100).toFixed(1) + '%)');
    ok(r.overGrip === 0, kind + ': האורך אף פעם לא קצר מהמרחק ליד (בתוך התקרה)');
    ok(Math.abs(r.tail[1] - (r.s.ay + L)) < 1.5 && Math.abs(r.tail[0] - r.s.ax) < 1.5 && r.tail[2] < RB.zRest + 1, kind + ': נוחת בדיוק במצב השוכב (' + r.tail.map((v) => v.toFixed(1)).join(',') + ')');
    ok(r.settled !== null && r.settled < 2.6, kind + ': מתייצב (' + (r.settled || 0).toFixed(2) + ' שנ׳)');
    ok(r.s.color === (kind === 'add' ? 1 : 0), kind + ': הצבע הסופי — ירוק בהוספה, אפור בהסרה');
  }
  const pa = M.ribbonPlan('add', (() => { const s = M.createSim(); M.simSnap(s, RB.peek); return s; })());
  const pr = M.ribbonPlan('remove', (() => { const s = M.createSim(); M.simSnap(s, RB.full); return s; })());
  ok(pa.cw[1] <= 0.25 && pr.cw[0] >= 0.5, 'צבע: בהוספה נהיה ירוק מיד (לא "מנטה" חיוור באוויר), בהסרה הופך לאפור רק בנחיתה');
  ok(pa.rel >= 0.7 && pa.rel <= 1 && pr.rel >= 0.7 && pr.rel <= 1, 'קצב טבעי: היד מרימה, נושאת ומניחה ב~0.8 שנ׳ (לא חטוף)');
  ok(/out\.len = Math\.min\(Math\.max\(pl\.Lf, pl\.Lt\) \* 1\.04, Math\.max\(sched, dist\)\)/.test(r3src), 'בלי רפיון נוסף באורך (הסיבה לגלים)');
  // לחיצה: הקצה מתרומם בקשת הדרגתית — בלי גלים
  {
    const s = M.createSim(); M.simSnap(s, RB.full); let wave = 0;
    const src = r3src.match(/\} else if \(pressing\) \{([\s\S]*?)\n    \}/)[1];
    ok(/9 \* sstep\(0, 0\.12, pressT\)/.test(src) && /Math\.sqrt\(Math\.max\(0, s\.len \* s\.len - dz \* dz\)\)/.test(src), 'לחיצה: הרמה הדרגתית בקשת סביב נקודת החיבור');
    let pressT = 0; const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < 0.4 * RB.hz; i++) {
      pressT += H;
      const tail = M.simRest(s, s.len, s.T), o = ((s.NL - 1) * s.NW + 1) * 3, lift = 9 * sstep(0, 0.12, pressT), dz = tail[o + 2] + lift - RB.zRest;
      s.grip = [tail[o], s.ay + Math.sqrt(Math.max(0, s.len * s.len - dz * dz)), tail[o + 2] + lift]; s.gripK = 18;
      M.simStep(s, H);
      const z = []; for (let j = 0; j < s.NL; j++) z.push(s.P[(j * s.NW + 1) * 3 + 2]);
      for (let j = 1; j < s.NL - 1; j++) if (z[j] > z[j - 1] && z[j] > z[j + 1]) { let m = z[j]; for (let q = j + 1; q < s.NL; q++) { m = Math.min(m, z[q]); if (z[q] > m + 0.3) break; } wave = Math.max(wave, z[j] - m); }
    }
    ok(M.simTail(s)[2] > 7 && wave < 0.5, 'לחיצה: הקצה עולה ~9px והבד לא מתקמט (' + wave.toFixed(2) + ')');
  }
  // רשת הרינדור: אורך נכון, נורמלים תקינים
  {
    const s = M.createSim(); M.simSnap(s, RB.full);
    const { rows, cols } = M.meshSize(s), out = new Float32Array(rows * cols * 11);
    const total = M.buildMesh(s, out);
    let unit = true; for (let v = 0; v < rows * cols; v++) { const l = Math.hypot(out[v * 11 + 3], out[v * 11 + 4], out[v * 11 + 5]); if (Math.abs(l - 1) > 1e-3) unit = false; }
    ok(Math.abs(total / RB.full - 1) < 0.03 && unit && Array.from(out).every(Number.isFinite), 'רשת חלקה (Catmull-Rom): אורך ' + total.toFixed(1) + ', נורמלים יחידה');
    ok(M.meshIndices(s).length === (rows - 1) * (cols - 1) * 6 && Math.max(...M.meshIndices(s)) < 65536, 'אינדקסים 16 ביט (WebGL1)');
  }
  const sm = M.shadowSamples(64);
  const wsum = sm.reduce((a, x) => a + x[2], 0), mx = sm.reduce((a, x) => a + x[0], 0) / 64, my = sm.reduce((a, x) => a + x[1], 0) / 64;
  ok(sm.length === 64 && Math.abs(wsum - 1) < 1e-9 && Math.abs(mx + 0.3) < 0.02 && Math.abs(my + 0.75) < 0.02, 'צל רך: 64 דגימות של מקור אור שטחי סביב כיוון המנורה (הצל נופל למטה)');
  ok(M.createRibbon({ getContext: () => null }) === null && M.createRibbon({ getContext: () => { throw new Error('x'); } }) === null, 'בלי WebGL — null (הקורא נשאר עם הסרט השטוח)');
  // השיידרים: נוסחאות Filament + מיפוי טונים Khronos Neutral, בלי ההילה שנפסלה
  ok(/float dGGXa\(/.test(r3src) && /float vGGXa\(/.test(r3src) && /float dCharlie\(/.test(r3src) && /float vNeubelt\(/.test(r3src), 'סאטן פיזיקלי: GGX אנאיזוטרופי + Smith מתואם + ברק בד Charlie + Neubelt (Filament)');
  ok(/vec3 neutral\(vec3 c\)/.test(r3src) && /col = neutral\(col\)/.test(r3src), 'מיפוי טונים Khronos PBR Neutral — הירוק של האפליקציה יוצא מדויק');
  ok(/lin\('#30D158'\)/.test(r3src) && /GRAY_D = lin\('#636366'\)/.test(r3src) && /dark \? GRAY_D : GRAY/.test(r3src), 'צבעים: ירוק --primary, אפור נקי (כהה יותר במצב כהה)');
  ok(/stencilFunc\(gl\.NOTEQUAL, k \+ 1, 0xff\)/.test(r3src) && /shadowSamples\(64\)/.test(r3src) && /FS_BLUR/.test(r3src) && !/FS_AO/.test(r3src), 'צל: דגימה אחת לכל פיקסל בכל דגימת אור (סטנסיל) + טשטוש גאוסי; בלי ה־SSAO שיצר הילה מנוקדת');
  ok(/vec3 c = uLite\.a > 0\.5 \? uLite\.rgb \* s : vec3\(0\.012, 0\.016, 0\.03\) \* s;/.test(r3src) && /gl_FragColor = vec4\(c, uLite\.a > 0\.5 \? max\(c\.r, max\(c\.g, c\.b\)\) : s\);/.test(r3src), 'בבהיר הצל מכפיל את מה שמתחתיו; בכהה — צל בהיר (אלפא ≥ צבע, premultiplied תקין)');
  ok(/\(uLite\.a > 0\.5 \? t\.g : t\.r\)/.test(r3src) && /uK, dark \? 0\.95 : 0\.44, dark \? 0\.05 : 0\.3/.test(r3src), 'מצב כהה "נקי כמו אפל": רק מהחלקים שבאוויר — בלי קו בהיר סביב סרט שוכב');
  ok(/const bs = dark \? 2\.1 : 0\.55;/.test(r3src) && /uLite, 0\.36, 0\.36, 0\.385, dark \? 1 : 0/.test(r3src), 'מצב כהה: צל בהיר רך ומפוזר (טשטוש רחב), עדין בליבה');
  ok(!/uPool/.test(r3src), 'בריכת האור (הניסיון הראשון במצב כהה) הוסרה');
  ok(/if \(opt\.manual \|\| raf \|\| dead\) return;/.test(r3src) && /_advance\(sec\)/.test(r3src), 'מצב ידני לצילום דטרמיניסטי (QA), בלי לולאה כפולה');
  ok(/if \(still < 8\) raf = requestAnimationFrame\(loop\)/.test(r3src), 'הלולאה נעצרת כשהסרט נח (לא מבזבז סוללה)');
  ok(/if \(!animate \|\| reduce\(\)\)/.test(r3src) && /press\(down\) \{\s*if \(reduce\(\) \|\| plan\) return;/.test(r3src), 'reduced-motion: בלי תנועה, רק המצב הסופי');

  // ---------- 3ב. שילוב בקורא ----------
  ok(/mod = await import\('\.\/ribbon3d\.js'\)/.test(lib) && /if \(typeof WebGLRenderingContext === 'undefined'\) return;/.test(lib), 'נטען בעצלתיים רק בקורא, ורק כשיש WebGL');
  ok(/await new Promise\(\(res\) => setTimeout\(res, 900\)\);\s*await new Promise\(\(res\) => \(typeof requestIdleCallback === 'function' \? requestIdleCallback\(res, \{ timeout: 2000 \}\)/.test(lib) && /await mod\.createRibbonAsync\(cv,/.test(lib), 'ההכנה אחרי פתיחת הקורא (0.9 שנ׳ + רגע פנוי), והידור ברקע (היה פריים של 0.25 שנ׳ באמצע הפתיחה)');
  ok(/if \(!eng \|\| !rd \|\| rd\.els\.box !== box\) \{ if \(eng\) eng\.destroy\(\); cv\.remove\(\); return; \}/.test(lib), 'קורא שנסגר בזמן ההכנה — המנוע משתחרר, אין קנבס יתום');
  ok(/KHR_parallel_shader_compile/.test(r3src) && /COMPLETION_STATUS_KHR/.test(r3src) && /if \(!ext\) await wait\(\);/.test(r3src), 'הידור מקבילי (KHR_parallel_shader_compile); בלי ההרחבה — תוכנית אחת לפריים');
  {
    let frames = 0; const fakeGL = null;
    const r = await M.createRibbonAsync({ getContext: () => fakeGL }, {}, (f) => { frames++; f(); });
    ok(r === null && frames === 0, 'גרסה אסינכרונית: בלי WebGL — null מיד');
  }
  ok(/if \(rd\.r3d\) rd\.r3d\.set\(on, !!animate && was !== on\)/.test(lib), 'מצב הסימנייה עובר למנוע — אנימציה רק בפעולת משתמש');
  ok(/if \(rd\.r3d\) rd\.r3d\.setPage\(th\.page, th\.dark\)/.test(lib), 'ערכת הקורא (צבע הדף, כהה) עוברת למנוע');
  ok(/if \(r\.r3dOff\) r\.r3dOff\(\)/.test(lib) && /if \(r\.r3d\) r\.r3d\.destroy\(\)/.test(lib), 'סגירת הקורא משחררת את ההקשר והמאזינים');
  ok(/webglcontextlost/.test(lib) && /box\.classList\.remove\('r3d'\)/.test(lib), 'אובדן הקשר WebGL — חוזרים לסרט השטוח');
  ok(/\.rd\.r3d \.rd-ribbon > svg \{ opacity: 0; transition: opacity/.test(css) && /\.rd-ribbon3d \{[^}]*pointer-events: none; opacity: 0; transition: opacity/.test(css) && /\.rd\.r3d \.rd-ribbon3d \{ opacity: 1; \}/.test(css), 'CSS: הקנבס מחליף את ה־SVG בהצלבה רכה ולא חוסם נגיעות');
  ok(/requestAnimationFrame\(\(\) => \{ if \(rd && rd\.r3d === eng\) box\.classList\.add\('r3d'\); \}\)/.test(lib), 'ההחלפה רק אחרי הציור הראשון של המנוע');

  // ---------- 3ג. מעברי הספרייה: מסך התיק לא מבצבץ ----------
  ok(/html\[data-lib-vt\]::view-transition-group\(lib-root\) \{ background: var\(--bg\); \}/.test(css), 'רקע אטום לקבוצת המעבר של הספרייה — מה שמתחת (מסך התיק) לא נראה באף שלב');
  ok(/html\[data-lib-vt="fade"\]::view-transition-image-pair\(lib-root\) \{ isolation: isolate; \}/.test(css) && /html\[data-lib-vt="fade"\]::view-transition-old\(lib-root\), html\[data-lib-vt="fade"\]::view-transition-new\(lib-root\) \{ mix-blend-mode: plus-lighter; \}/.test(css), 'הצלבה מדויקת (plus-lighter) — בלי "שקע" שקוף באמצע');
  ok(/vtFadeOut \.2s ease both/.test(css) && /vtFadeIn \.2s ease both/.test(css), 'הצלבה: אותו משך ועקומה לישן ולחדש (סכום השקיפויות = 1)');
  ok(!/@keyframes vtOutBack[^}]*opacity/.test(css) && !/@keyframes vtInBack[^}]*opacity/.test(css) && /filter: brightness\(var\(--vt-dim\)\)/.test(css), 'דחיפה/חזרה: הדף שמאחור מוחשך (כמו iOS), לא שקוף');

  // ---------- 3ד. הקורא הולך אחרי בהיר/כהה של האפליקציה (כמו קינדל) ----------
  {
    const THEMES = { white: 1, sepia: 1, green: 1, black: 1 };
    const defaultsSrc = lib.match(/const defaults = \{[^}]*\};/)[0];
    ok(/theme: 'auto'/.test(defaultsSrc), 'ברירת המחדל: ערכה אוטומטית');
    const normSettings = new Function('THEMES', defaultsSrc + '\n' + lib.match(/export function normSettings[\s\S]*?\n}\n/)[0].replace('export ', '') + ';return normSettings;')(THEMES);
    const themeKey = new Function(lib.match(/export function themeKey[^\n]*\n/)[0].replace('export ', '') + ';return themeKey;')();
    ok(normSettings({}).theme === 'auto' && normSettings({ theme: 'white' }).theme === 'auto', 'משתמש קיים שלא בחר ערכה ("לבן" של ברירת המחדל) — עובר לאוטומטי');
    ok(normSettings({ theme: 'white', themeSet: 1 }).theme === 'white' && normSettings({ theme: 'sepia' }).theme === 'sepia' && normSettings({ theme: 'black' }).theme === 'black', 'בחירה ידנית נשמרת (לבן מפורש, ספיה, שחור)');
    ok(normSettings({ theme: 'nope' }).theme === 'auto', 'ערך לא מוכר → אוטומטי');
    ok(themeKey({ theme: 'auto' }, true) === 'black' && themeKey({ theme: 'auto' }, false) === 'white' && themeKey({ theme: 'sepia' }, true) === 'sepia', 'אוטומטי: כהה → שחור (כמו קינדל), בהיר → לבן; ידני גובר');
    ok(/if \(lib\.s && lib\.s\.t > \(S\.t \|\| 0\)\) \{ S = normSettings\(lib\.s\);/.test(lib), 'הגדרות מהענן עוברות את אותה מיגרציה');
    ok((lib.match(/const th = curTheme\(\);/g) || []).length === 3 && !/THEMES\[S\.theme\]/.test(lib), 'כל מקום שמצייר את הקורא משתמש בערכה האפקטיבית');
    ok(/new MutationObserver\(\(\) => \{ if \(rd && S\.theme === 'auto'\) applyReaderStyle\(\); \}\)\.observe\(document\.documentElement, \{ attributes: true, attributeFilter: \['data-theme'\] \}\)/.test(lib), 'האפליקציה מתחלפת בהיר↔כהה — קורא פתוח מתחלף מיד');
    ok(/\[\['auto', 'rdAuto'\], \['white', 'rdWhite'\]/.test(lib) && /S\.themeSet = v === 'auto' \? 0 : 1;/.test(lib), 'Aa: "אוטומטי" ראשון; בחירה ידנית מסומנת');
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    ok((app.match(/\brdAuto: '/g) || []).length === 2, 'מחרוזת "אוטומטי" בעברית ובאנגלית');
    ok(/\.rd-themes button\.auto \{ background: linear-gradient\(135deg, #FFFFFF 0 50%, #000000 50% 100%\)/.test(css) && /\.rd-themes \{ display: grid; grid-template-columns: repeat\(5, 1fr\)/.test(css), 'כפתור "אוטומטי": חצי לבן/חצי שחור, חמישה כפתורים בשורה');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    ok(/var t=r\.theme;if\(!t\|\|t==='auto'\|\|\(t==='white'&&!r\.themeSet\)\)t=d\?'black':'white';/.test(html), 'רענון בתוך ספר — הווילון בצבע הנכון גם באוטומטי');
  }

  // ---------- 4. פרק בלי <head> ----------
  const ensureHead = pure('ensureHead');
  const x1 = '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" lang="he"><body><p>x</p></body></html>';
  ok(/<html[^>]*><head><\/head><body>/.test(ensureHead(x1)), 'פרק בלי head — נוסף head ריק מיד אחרי <html>');
  ok(ensureHead('<html><head><title>t</title></head></html>') === '<html><head><title>t</title></head></html>' && ensureHead('<html><head/></html>') === '<html><head/></html>', 'פרק עם head — לא נוגעים');
  ok(/<head><\/head><body><header>/.test(ensureHead('<html><body><header>h</header></body></html>')), '<header> לא נחשב head');
  ok(/rd\.book\.transformTarget\.addEventListener\('data'/.test(lib) && /ensureHead\(d\)/.test(lib), 'מחובר לטעינת הפרקים של המנוע (לפני הציור הראשון)');

  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + e.message); process.exit(1); });
