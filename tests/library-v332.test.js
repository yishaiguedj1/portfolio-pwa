// v332 (בקשת המשתמש): גם הדגשות והערות על ציר ההתקדמות — כל סוג בצורה משלו (סימנייה = סרט, הערה = נקודה, הדגשה = קו),
// באותה עצירה מגנטית, רטט ותצוגה מקדימה כמו הסימניות; בעיצוב נקי של Apple
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const pure = (name, pre) => new Function((pre || '') + lib.match(new RegExp('export function ' + name + '[\\s\\S]*?\\n}\\n'))[0].replace('export ', '') + ';return ' + name + ';')();

const C = { y: '#FFD60A', g: '#30D158', b: '#64D2FF', p: '#FF6482' };
const scrubMarks = pure('scrubMarks', "const MK_RANK = { bm: 0, note: 1, hl: 2 };");
const ann = [
  { id: 'h1', c: 'x', x: 'קטע', k: 'b', f: 0.4 },
  { id: 'n1', c: 'y', x: 'קטע 2', k: 'p', n: ' רעיון ', f: 0.2 },
  { id: 'b1', c: 'z', x: 'עמוד', b: 1, f: 0.6 },
  { id: 'd1', c: 'w', x: 'נמחק', k: 'y', f: 0.3, d: 1 },
  { id: 'e1', c: 'v', x: 'בלי מיקום', k: 'y' },
  { id: 'h2', c: 'u', x: 'כפול', k: 'b', f: 0.4012 },
  { id: 'h3', c: 't', x: 'צבע אחר', k: 'y', f: 0.4012 },
  { id: 's1', c: 's', x: 'הערה ריקה', k: 'g', n: '   ', f: 0.9 },
];
const mk = scrubMarks(ann, C);
ok(mk.map((m) => m.id).join() === 'n1,h1,h3,b1,s1', 'מיון לפי מיקום; מחוקים ובלי מיקום בחוץ; כפול מאותו סוג וצבע באותה נקודה — פעם אחת (צבע אחר נשאר)');
ok(mk[0].t === 'note' && mk[0].n === 'רעיון' && mk[0].col === C.p, 'הערה: סוג, טקסט ההערה וצבע ההדגשה שלה');
ok(mk[1].t === 'hl' && mk[1].col === C.b && mk[3].t === 'bm' && mk[3].col === '', 'הדגשה בצבע שלה; סימנייה בלי צבע (ירוק קבוע)');
ok(mk[4].t === 'hl', 'הערה ריקה (רווחים) = הדגשה רגילה');

const scrubSnap = pure('scrubSnap');
const W = 346;
ok(scrubSnap(400, mk, W, null).id === 'h1', 'עצירה גם על הדגשה');
ok(scrubSnap(200, mk, W, null).id === 'n1', 'וגם על הערה');
const same = [{ id: 'h', f: 0.5, r: 2 }, { id: 'n', f: 0.5, r: 1 }, { id: 'b', f: 0.5, r: 0 }];
ok(scrubSnap(500, same, W, null).id === 'b' && scrubSnap(500, same.slice(0, 2), W, null).id === 'n', 'באותה נקודה: סימנייה לפני הערה לפני הדגשה');
ok(scrubSnap(502, [{ id: 'h', f: 0.5, r: 2 }, { id: 'b', f: 0.51, r: 0 }], W, null).id === 'h', 'העדיפות לא גוברת על קרבה אמיתית (סימון קרוב יותר מנצח)');
ok(scrubSnap(285, [{ id: 'a', f: 0.25 }], W, null) === null && scrubSnap(285, [{ id: 'a', f: 0.25 }], W, 'a').id === 'a', 'אותם ספי כניסה/יציאה (10/15px) כמו בסימניות');

// ---------- חיבור ----------
ok(/const scrubBms = \(\) => \(rd && rd\.mk\) \|\| \[\];/.test(lib) && /rd\.mk = mk;\s*if \(m\._key === key\) return;/.test(lib), 'רשימת הסימונים מחושבת פעם אחת לכל שינוי — לא בכל תזוזה של האצבע');
ok(/for \(const t of \['hl', 'note', 'bm'\]\)/.test(lib) && /document\.createDocumentFragment\(\)/.test(lib), 'שכבות: הדגשות למטה, הערות מעליהן, סימניות למעלה; בנייה בבת אחת');
ok(/renderBmMarks\(\); \}\s*else markBookmark\(true\);/.test(lib), 'הדגשה/הערה שנוספה, השתנתה או נמחקה — מתעדכנת על הציר מיד');
ok(/rd\.scrubHitEl = hit \? el\.marks\.querySelector\('\[data-id="' \+ hit\.id \+ '"\]'\) : null;/.test(lib), 'בלי סריקת כל הסימונים בכל כניסה — רק הקודם והחדש');
ok(/el\.scrub\.dataset\.hit = hit\.t; el\.scrub\.style\.setProperty\('--hit', hit\.col \|\| '#30D158'\)/.test(lib), 'האגודל מקבל טבעת בצבע הסימון שעליו');
ok(/if \(hit\) \{ try \{ if \(navigator\.vibrate\) navigator\.vibrate\(10\); \} catch \(e\) \{\} \}/.test(lib), 'אותו רטט עדין לכל סוג');
ok(/h\('span', 'rd-prev-note', hit\.n\)/.test(lib) && /h\('span', 'rd-prev-mk', hit\.x\)/.test(lib), 'תצוגה מקדימה: ההערה, ומתחתיה הקטע במרקר בצבע שלו');
ok(/T\('annBmLabel'\) : t === 'note' \? T\('hlNote'\) : T\('hlColor'\)/.test(lib), 'תווית הסוג: סימנייה / הערה / הדגשה');
ok(/\/\/ על סימון — בדיוק לעמוד המסומן/.test(lib), 'שחרור על כל סימון — קפיצה מדויקת אליו');

// ---------- עיצוב ----------
ok(/\.rd-track \{[^}]*inset-inline: 11px;/.test(css) && /\.rd-slider::-webkit-slider-runnable-track \{[^}]*background: transparent; \}/.test(css), 'מסילה בשכבה משלה מתחת לסימונים (בין מרכזי האגודל בשני הקצוות)');
ok(/\.rd-hlmark \{[^}]*width: 3px; height: 12px;[^}]*background: var\(--c\); box-shadow: 0 0 0 1px var\(--rd-page\)/.test(css), 'הדגשה = קו דק בצבע שלה עם מתאר בצבע הסרגל');
ok(/\.rd-hlmark\.note \{[^}]*width: 10px; height: 10px;[^}]*border-radius: 50%/.test(css), 'הערה = נקודה');
ok(/\.rd-scrub\[data-hit\] \.rd-slider::-webkit-slider-thumb \{ box-shadow: 0 0 0 3px var\(--hit\)/.test(css), 'טבעת צבע על האגודל');
ok(/\.rd-prev\.mk \{[^}]*var\(--hc\)/.test(css) && /\.rd\[data-dark="1"\] \.rd-prev-mk/.test(css), 'תצוגה מקדימה בטבעת ובמרקר בצבע ההדגשה, גם בכהה');
ok(/prefers-reduced-motion: reduce\) \{ \.rd-prev, \.rd-bmark, \.rd-hlmark/.test(css), 'reduced-motion');
ok(/\.rd\[data-dark="1"\] \.rd-prev-bm\[data-k="note"\] \{ color: var\(--rd-ink\); \}/.test(css), 'במצב כהה תווית הדגשה/הערה לא נצבעת בירוק של הסימנייה');
console.log('# ' + n + ' בדיקות עברו');
