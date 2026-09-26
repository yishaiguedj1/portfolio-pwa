// ui-v169.test.js — עוגת חלוקת התיק: לוגו + סימבול + בועה (אחוז ושווי) בכל פרוסה שיש בה מקום,
// לוגו לבן על אריח כהה, שם מלא במקרא.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const proxy = fs.readFileSync(path.join(root, 'ibkr-proxy/api/quotes.js'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) }, window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(1), setTimeout, clearTimeout, console };
vm.createContext(sb); vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);
const fits = A('pieBoxFits');
const q = Math.PI / 2;
ok(fits(0, -100, 40, 40, -q - 0.5, -q + 0.5, 60, 140, 3), 'מלבן במרכז פרוסה רחבה — נכנס');
ok(!fits(0, -100, 40, 40, -q - 0.1, -q + 0.1, 60, 140, 3), 'פרוסה צרה — לא נכנס (לא דוחסים)');
ok(!fits(0, -100, 40, 100, -q - 0.8, -q + 0.8, 60, 140, 3), 'גבוה מעובי הטבעת — לא נכנס');
ok(fits(0, 100, 30, 30, q - 0.4, q + 0.4, 60, 140, 3) && fits(-100, 0, 30, 30, Math.PI - 0.4, Math.PI + 0.4, 60, 140, 3), 'עובד בכל כיוון (כולל מעבר ±π)');
const sm = A('fmtShortMoney');
ok(sm(13153, 'USD') === '$13K' && sm(9663, 'USD') === '$9.7K' && sm(950, 'USD') === '$950' && sm(2500000, 'ILS') === '₪2.5M' && sm(4000, 'USD') === '$4K', 'שווי מקוצר לבועה: $13K / $9.7K / $950 / ₪2.5M');
vm.runInContext('state.lang = "he"', sb);
const cn = A('companyName');
ok(cn('MSFT') === 'Microsoft' && cn('META') === 'Meta Platforms' && cn('NOW') === 'ServiceNow', 'שם מלא ונקי (בלי Inc./Corp.)');
ok(cn('POLI.TA') === 'הפועלים' && (vm.runInContext('state.lang = "en"', sb), cn('POLI.TA') === 'Bank Hapoalim'), 'ת"א: שם בעברית / באנגלית לפי השפה');
ok(/'longName', 'shortName'\]/.test(proxy) && /longName: meta\.longName \|\| meta\.shortName/.test(src), 'מניה שלא ברשימה: השם מ־Yahoo דרך השרתון');
ok(/return cnt >= 5 && sum \/ cnt > 225;/.test(src) && /e\.light = logoIsLight\(e\.img\)/.test(src), 'לוגו לבן (UNH/UBER/APP) מזוהה');
ok(/ctx\.drawImage\(e\.inv \|\| e\.img,/.test(src) && /pie-leg-logo' \+ \(e && e\.ready && e\.light \? ' inv'/.test(src) && /\.pie-leg-logo\.inv img \{ filter: invert\(1\); background: transparent; \}/.test(css), 'v173: לוגו לבן — מתהפך לשחור על אריח לבן, כמו בטאב המניות (עוגה ומקרא)');
ok(/for \(const sc of \[1, 0\.9, 0\.82\]\)/.test(src) && /R = Math\.max\(R0 \* 0\.6, Math\.min\(R0, rho \+ H \* SC \* 0\.22\)\);/.test(src), 'v173: כל התוויות באותו גודל על מעגל אחד — מעט מניות במרכז הפרוסות, יותר מניות: המעגל מתרחק באחידות');
ok(/const clash = \(p, q\) =>/.test(src) && /placed\.some\(\(o\) => clash\(o, g\)\)/.test(src), 'v173/v187: אין שתי תוויות שנוגעות זו בזו (שרשרת ב־posAt)');
ok(/pctTxt: pct\.toFixed\(1\) \+ '%'/.test(src), 'v172: אחוז עם ספרה עשרונית תמיד (18.1%)');
ok(/ctx\.strokeStyle = surface; ctx\.lineWidth = gap;/.test(src), 'רווח דק בצבע הכרטיס בין הפרוסות');
ok(/\.pie-leg-logo \{[^}]*width: 34px; height: 34px; border-radius: 10px;/.test(css), 'מקרא: לוגו גדול יותר, אריח מעוגל');
ok(/class="lg-full" dir="auto"/.test(src) && /#pieLegend \.lg-full \{ align-self: flex-start; max-width: 100%;/.test(css), 'מקרא: שם מלא מתחת לסימבול, חיתוך בסוף השם');
ok(/data-err="hide-self"/.test(src) && /im\.dataset\.err === 'hide-self'/.test(src), 'לוגו שלא נטען — נשארת האות, לא ריבוע ריק');
ok(/const ordered = slicesUnique\.slice\(\)\.sort\(\(x, y\) => y\.value - x\.value\);/.test(src), 'v170: הפרוסות לפי גודל, מהגדולה ב־12 בשעון עם כיוון השעון');
ok(/\.pie-leg-logo\.inv \.pie-leg-fb \{ display: none; \}/.test(css), 'v174: לוגו לבן מהופך — בלי האות מאחוריו');
ok(/\.pie-wrap \{ display: flex; justify-content: center; margin-inline: -12px; \}/.test(css) && /#pieChart \{ width: 100%; max-width: 520px;/.test(css), 'v175: העוגה כמעט ברוחב הכרטיס');
ok(A('PIE_RANK_PALETTE').slice(0, 4).join() === '#8DC63F,#8FC1E3,#F46A5C,#C95CF5' && /x\.color = PIE_RANK_PALETTE\[i % PIE_RANK_PALETTE\.length\]/.test(src), 'v178: צבעי הפרוסות לפי הדירוג בתיק (ירוק, תכלת, אלמוגי, סגול…)');
const geom = { cx: 100, cy: 100, r: 40, R: 90, segs: [{ sym: 'A', a: -Math.PI / 2, a2: 0 }, { sym: 'B', a: 0, a2: 3 * Math.PI / 2 }] };
ok(A('pieHitSym')(geom, 160, 40) === 'A' && A('pieHitSym')(geom, 40, 160) === 'B' && A('pieHitSym')(geom, 100, 100) === null && A('pieHitSym')(geom, 100, -10) === null, 'v178: זיהוי הפרוסה שנגעו בה (לא במרכז ולא מחוץ לטבעת)');
ok(A('pieShade')('#000000', 0.5) === '#808080' && A('pieShade')('#FFFFFF', -0.5) === '#808080', 'v178: הבהרה/הכהיה של צבע');
ok(/canvas\.addEventListener\('pointerdown'/.test(src) && /navigator\.vibrate\(8\)/.test(src) && /prefers-reduced-motion: reduce/.test(src) && /ctx\.shadowBlur = 22 \* L/.test(src), 'v178: נגיעה מרימה את הפרוסה (צל, רטט קל, מכבד הפחתת תנועה)');
ok(/#pieChart \{ -webkit-tap-highlight-color: transparent;/.test(css), 'v179: בלי הריבוע הכחול בנגיעה');
ok(/const PIE_SPRING = \{ k: 320, c: 20 \};/.test(src) && /ctx\.globalAlpha = dimA;/.test(src) && /ctx\.fillText\(act\.pctTxt, cx,/.test(src), 'v179: אנימציית קפיץ, השאר מתעמעמות, פרטי המניה במרכז');
ok(/const pop = 1 \+ 0\.2 \* gL;/.test(src) && /if \(!g\.chip\) \{ g\.x \+= ox; g\.y \+= oy; \}/.test(src), 'v180: הלוגו והבועה זזים וגדלים יחד עם הפרוסה (אותו קפיץ)');
ok(/#pieLegend li\.active \.pie-leg-logo \{ transform: scale\(1\.18\)/.test(css) && /function pieMarkLegend/.test(src) && /if \(pieAnimRaf && legend\.children && legend\.children\.length\) \{ pieMarkLegend\(legend\); return; \}/.test(src), 'v180: שורת המקרא של הפרוסה מודגשת והלוגו קופץ; בלי בנייה מחדש בזמן אנימציה');
{
  const vals = [77853,46983,35064,27409,27200,17000,15000,12000,11000,11000,10000,9200,7700,5200,4800,3700,3200,3100,2600,2291,1093,1084,1068,1047,601,495,482,400,159];
  const mk = (N) => { const v = vals.slice(0, N), T = v.reduce((a, b) => a + b, 0); let a = -Math.PI / 2; return v.map((x) => { const a2 = a + x / T * 2 * Math.PI; const it = { mid: (a + a2) / 2, span: a2 - a }; a = a2; return it; }); };
  const lay = A('pieCalloutLayout');
  const norm = (t) => { while (t < Math.PI * 5 / 4) t += Math.PI * 2; while (t >= Math.PI * 13 / 4) t -= Math.PI * 2; return t; };
  for (const N of [13, 21, 29]) {
    const its = mk(N), L = lay(its, 340, 510, 54 * 0.76, 44 * 0.76, 12);
    const zone = (z) => L.pos.map((p, i) => ({ p, i })).filter((o) => o.p.zone === z);
    const cnt = { T: zone('T').length, R: zone('R').length, B: zone('B').length, L: zone('L').length };
    const ok1 = L && L.pos.every(Boolean) && L.h <= 510 && L.R >= 0.29 * 340 && cnt.T > 0 && cnt.R > 0 && cnt.B > 0 && cnt.L > 0;
    // v186: לולאה אחת עם כיוון השעון — סדר השבבים בכל צד = סדר הזוויות (T משמאל לימין, R מלמעלה למטה, B מימין לשמאל, L מלמטה למעלה)
    const mono = (z, key) => { const s = zone(z).sort((a, b) => key(a.p) - key(b.p)).map((o) => norm(its[o.i].mid)); return s.every((v, k) => !k || v >= s[k - 1] || s[k - 1] - v > Math.PI); }; // ירידה של ~2π = מעבר דרך נקודת ההתחלה (225°), לא שבירת סדר
    const ok2 = mono('T', (p) => p.x) && mono('R', (p) => p.y) && mono('B', (p) => -p.x) && mono('L', (p) => -p.y);
    // בלי חפיפה בטורים ובשורות
    const gapOk = (z, key, st) => { const s = zone(z).map((o) => key(o.p)).sort((a, b) => a - b); return s.every((v, k) => !k || v - s[k - 1] >= st - 1e-6); };
    const ok3 = gapOk('R', (p) => p.y, 54 * 0.76 + 4) && gapOk('L', (p) => p.y, 54 * 0.76 + 4) && gapOk('T', (p) => p.x, 44 * 0.76 + 6) && gapOk('B', (p) => p.x, 44 * 0.76 + 6);
    // הגדולה (AAPL, מ־12 עם כיוון השעון) — בטור הימני, בחצי העליון
    const big = L.pos[0], ok4 = big.zone === 'R' && big.y < L.cy;
    ok(ok1 && ok2 && ok3 && ok4, 'v186: ' + N + ' מניות — שבבים מסביב לעוגה (' + cnt.T + '/' + cnt.R + '/' + cnt.B + '/' + cnt.L + '), סדר לפי השעון, בלי חפיפה, הגדולה מול הפרוסה שלה, גובה ' + Math.round(L.h) + ', R=' + Math.round(L.R));
  }
  ok(/const OUTER = segs\.length > 12;/.test(src) && /pieCalloutLayout\(items, w, w \* 1\.5, CHIP_H \* sc, colW0 \* sc, 12\)/.test(src) && /canvas\.style\.height = h \+ 'px';/.test(src), 'v183/v186: מעל 12 מניות — שבבים סביב העוגה, הקנבס מתארך לפי הצורך');
  ok(/const CHIP_H = LS \+ 2 \+ BUB_H;/.test(src) && /g\.chipW = Math\.max\(LS, g\.bubW\)/.test(src) && /if \(!g\.chip\) \{ \/\/ סימבול/.test(src) && !/const drawChip = /.test(src), 'v186: שבב אנכי — לוגו מעל בועת אחוז/שווי, בלי סימבול, אותו מצייר כמו במעט מניות');
}
ok(/g\.out = OUTER \|\| rho > \(holeOf\(R\) \+ R\) \/ 2 \+ 6;/.test(src) && /const len = Math\.min\(18, dist - edge - 3\);/.test(src) && /if \(dist <= edge \+ 6\) continue;/.test(src) && /if \(onSlice\) continue;/.test(src), 'v184/v186: במעט מניות — סיכה קצרה (≤18px) מקצה התווית לתוך הפרוסה; בלי קו כשהתווית יושבת בבירור על הפרוסה שלה');
ok(/let R = R0, rho = ringAt\(R0, 0\.62\), ok = false;/.test(src) && /let th = g === segs\[0\] \? g\.mid : Math\.min\(g\.mid, g\.a \+ half\(g\.a\) \/ rho \+ 0\.03\);/.test(src) && /for \(let k = 0; k < 25 && hit\(\); k\+\+\) \{ th \+= 0\.03; put\(th\); \}/.test(src) && /g\.skip = false;/.test(src) && !/g\.skip = shown\.some/.test(src), 'v185/v187: תוויות בחלק החיצוני של הטבעת; שרשרת בסדר השעון — הגדולה מול הפרוסה, כל השאר צמודות לקצה שנגד כיוון השעון ונדחקות רק בנגיעה; אף תווית לא נשמטת');
console.log('\n' + n + ' בדיקות עברו');
