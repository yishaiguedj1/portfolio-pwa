// 02/11/2026 — סבב קפיצות 9: הבזק בהקשה ב־Invest, כניסה מ־opacity 0, ורקע ריק בפתיחת Studio מהתפריט
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL - ' + m); } else console.log('ok - ' + m); };
const app = R('app.js'), css = R('styles.css'), st = R('studio.js'), boot = R('studio-app.js'), page = R('studio.html'), qa = R('tools/qa-sweep.js');

// 1. הקשה ב־Invest: שכבת GPU שנוצרת כשהעמוד כבר גלוי = פריים ריק בכרום בטלפון. השכבה קיימת מראש — transform, לא opacity
ok(/\.tabpage\.active \{ will-change: transform; \}/.test(css), 'העמוד הפעיל — שכבה קבועה (will-change: transform)');
ok(!/\.tabpage\.active \{[^}]*will-change:[^}]*opacity/.test(css), 'לא opacity — הוא שורש רקע ושובר את הטשטוש של הזכוכית בילדים');
// transform = בלוק מכיל ל־fixed: הגרירה מחשבת את ההיסט מחדש בזמן גלילה
ok(/get x\(\) \{ return x \+ pg\.getBoundingClientRect\(\)\.left - l0; \}/.test(app) && /get y\(\) \{ return y \+ pg\.getBoundingClientRect\(\)\.top - t0; \}/.test(app), 'dragLift: ההיסט של הבלוק המכיל — חי (גלילה אוטומטית בגרירה)');

// 2. הציור הראשון של רשימה — בלי אנימציית כניסה מ־opacity 0
const cnt = (app.match(/const first = !list\._painted; list\._painted = true;/g) || []).length;
ok(cnt === 2, 'renderStocks ו־renderWishlist: הציור הראשון מסומן (' + cnt + ')');
ok(/const wasEmpty = !first && /.test(app) && /const wasEmpty = !!dir \|\| \(!first && /.test(app), 'wasEmpty רק אחרי הציור הראשון');

// 3. Studio: הבית בציור הראשון — הסקריפטים בראש הדף, המודול חוסם ציור, האתחול סינכרוני
const head = page.slice(0, page.indexOf('</head>'));
ok(/<script type="module" src="studio-app\.js" blocking="render"><\/script>/.test(head), 'studio.html: המודול בראש הדף עם blocking="render"');
ok(!/<script[^>]+src=/.test(page.slice(page.indexOf('<body'))), 'studio.html: אין סקריפטים בגוף הדף');
ok(['firebase-config.js', 'strings-studio.js', 'core.js', 'auth.js'].every((f) => head.includes('<script src="' + f + '" defer></script>')), 'הסקריפטים הרגילים — defer, באותו סדר');
ok(!/thumbsReady/.test(boot) && /Promise\.resolve\(openStudio\(\{/.test(boot), 'האתחול לא מחכה ל־IndexedDB — openStudio מיד');
ok(/'pwa_stthumb_v1'/.test(app.slice(app.indexOf('ACCOUNT_KEYS'), app.indexOf('ACCOUNT_KEYS') + 4000)), 'pwa_stthumb_v1 ב־ACCOUNT_KEYS (מתנקה בהחלפת חשבון)');
ok(/if \(!kaTab && !viTab\) thumbsTopSave\(jobs\.map\(\(rec\) => rec\.id\)\);/.test(st) && /if \(thumbsTop\.includes\(id\)\) thumbsTopSave\(\);/.test(st), 'הבית ו־thumbSet מעדכנים את המטמון');

// התנהגות: טעינה ושמירה של התמונות שבראש הבית
const a = st.indexOf('export const LS_THUMBS'), b = st.indexOf("if (typeof localStorage !== 'undefined') thumbsTopLoad();");
const code = st.slice(a, b).replace('export const', 'const') + '\nthis.load = thumbsTopLoad; this.save = thumbsTopSave;';
const mk = (init) => { const ls = { s: Object.assign({}, init), w: 0, getItem(k) { return k in this.s ? this.s[k] : null; }, setItem(k, v) { this.w++; this.s[k] = String(v); }, removeItem(k) { this.w++; delete this.s[k]; } };
  const c = { localStorage: ls, thumbs: new Map(), els: [], thumbEl(id, u) { c.els.push(id); } }; vm.createContext(c); vm.runInContext(code, c); return c; };
const img = (x) => 'data:image/jpeg;base64,' + x;
{ const c = mk({ pwa_stthumb_v1: JSON.stringify({ j1: img('AA'), j2: 'javascript:x', j3: img('CC') }) }); c.load();
  ok(c.thumbs.get('j1') === img('AA') && c.thumbs.get('j3') === img('CC') && !c.thumbs.has('j2') && c.els.join() === 'j1,j3', 'טעינה: רק data:image — לתוך המפה ולתמונות שבדף');
  c.save(['j1', 'j3']); ok(c.localStorage.w === 0, 'אותן תמונות — בלי כתיבה'); }
{ const c = mk({}); c.load(); for (let i = 1; i <= 6; i++) c.thumbs.set('j' + i, img('X' + i));
  c.save(['j1', 'j2', 'j3', 'j4', 'j5', 'j6']); const o = JSON.parse(c.localStorage.s.pwa_stthumb_v1);
  ok(Object.keys(o).join() === 'j1,j2,j3,j4' && c.localStorage.w === 1, 'שמירה: רק 4 העליונות');
  c.thumbs.set('j2', img('NEWER')); c.save(); ok(JSON.parse(c.localStorage.s.pwa_stthumb_v1).j2 === img('NEWER') && c.localStorage.w === 2, 'תמונה שהוחלפה לאותה עבודה — נשמרת מחדש');
  c.save(['j9']); ok(!('pwa_stthumb_v1' in c.localStorage.s), 'בלי תמונות לראש הבית — המפתח נמחק'); }
{ const c = mk({ pwa_stthumb_v1: '{bad' }); c.load(); ok(c.thumbs.size === 0, 'JSON פגום — בלי קריסה'); }

// 4. הגלאים ב־qa-sweep (נבדקו מול הקוד הישן: 38 / 1 / 360ms)
ok(/data-qa-vis/.test(qa) && /r\.kind === 'shown'/.test(qa), 'qa-sweep: שכבה שנוצרת על אלמנט גלוי');
ok(/animationstart/.test(qa) && /אנימציית כניסה מ־opacity 0/.test(qa), 'qa-sweep: כניסה מ־opacity 0');
ok(/first-paint/.test(qa) && /ציור ראשון בלי תוכן/.test(qa), 'qa-sweep: ציור ראשון בלי תוכן');

console.log('\n' + n + ' בדיקות, ' + bad + ' נכשלו');
process.exit(bad ? 1 : 0);
