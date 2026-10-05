// v331: ציר ההתקדמות בקורא (בקשת המשתמש, Apple + רעיונות קינדל): סימניות על הציר, עצירה "מגנטית" עם רטט עדין,
// תצוגה מקדימה קטנה מעל האגודל (כמו YouTube), קפיצה מדויקת לעמוד המסומן, "חזרה ל־X%" (קינדל), והציר בכיוון הספר
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pure = (name) => new Function(lib.match(new RegExp('export function ' + name + '[\\s\\S]*?\\n}\\n'))[0].replace('export ', '') + ';return ' + name + ';')();

// ---------- פונקציות טהורות ----------
const readingDir = pure('readingDir');
ok(readingDir({ dir: 'rtl' }) === 'rtl' && readingDir({ dir: 'ltr', metadata: { language: 'he' } }) === 'ltr', 'כיוון: מה־OPF קודם');
ok(readingDir({ metadata: { language: 'en' } }, 'Gut') === 'ltr' && readingDir({ metadata: { language: ['he-IL'] } }) === 'rtl' && readingDir({ metadata: { language: 'ar' } }) === 'rtl', 'בלי כיוון ב־OPF — לפי השפה (הבאג בצילום: ספר אנגלי עם ציר מימין לשמאל)');
ok(readingDir({ metadata: { language: 'hu' } }) === 'ltr', 'שפה שמתחילה באותיות דומות (hu) — לא נחשבת עברית');
ok(readingDir({}, 'קיצור תולדות האנושות') === 'rtl' && readingDir({}, 'Gut') === 'ltr', 'בלי שפה — לפי השם');

const sectionAt = pure('sectionAt');
const fr = [0, 0.1, 0.1, 0.6, 1];          // פרק 1 בגודל אפס (לא ליניארי)
ok(JSON.stringify(sectionAt(fr, 0.05)) === JSON.stringify({ i: 0, w: 0.5 }), 'מיקום בספר → פרק ומיקום יחסי בתוכו');
ok(sectionAt(fr, 0.1).i === 2 && sectionAt(fr, 0.35).i === 2 && Math.abs(sectionAt(fr, 0.35).w - 0.5) < 1e-9, 'פרק בגודל אפס מדולג');
ok(sectionAt(fr, 1).i === 3 && sectionAt(fr, 1).w === 1 && sectionAt(null, 0.3) === null, 'קצה הספר; בלי גבולות — null');

const scrubSnap = pure('scrubSnap');
const bms = [{ id: 'a', f: 0.25 }, { id: 'b', f: 0.6 }];
ok(scrubSnap(255, bms, 346, null).id === 'a', '3.5px מהסימנייה — נתפס (עד 10px)');
ok(scrubSnap(285, bms, 346, null) === null, '12px — עוד לא נתפס');
ok(scrubSnap(285, bms, 346, 'a').id === 'a' && scrubSnap(300, bms, 346, 'a') === null, 'היסטרזיס: כבר על הסימנייה — משתחררים רק אחרי 15px (בלי ריצוד בגבול)');
ok(scrubSnap(500, [], 346, null) === null, 'בלי סימניות — אין עצירה');

const scrubSnippet = pure('scrubSnippet');
const txt = 'משפט ראשון כאן. משפט שני ארוך יותר שממשיך הלאה. משפט שלישי.\nפסקה חדשה מתחילה כאן ועוד מילים רבות שממלאות את השורה.';
const s1 = scrubSnippet(txt, 0.3);
ok(/^משפט (שני|שלישי)/.test(s1), 'התצוגה המקדימה מתחילה בתחילת משפט קרוב: "' + s1.slice(0, 20) + '"');
ok(scrubSnippet(txt, 0.75).startsWith('פסקה חדשה'), 'או בתחילת פסקה');
const longT = 'מילה '.repeat(200);
const s2 = scrubSnippet(longT, 0.5, 60);
ok(s2.endsWith('…') && s2.length <= 62 && !/\s…$/.test(s2), 'נחתך בסוף מילה עם "…"');
ok(scrubSnippet('', 0.5) === '' && scrubSnippet('abc', 0) === 'abc', 'מקרי קצה');

// ---------- מבנה ----------
ok(/const scrub = h\('div', 'rd-scrub'\); const track = h\('div', 'rd-track'\); const marks = h\('div', 'rd-bmarks'\)/.test(lib) && /scrub\.append\(track, marks, slider, prev\);/.test(lib) && /botBar\.append\(chap, scrub, nums\);/.test(lib), 'ציר: סימניות מתחת לאגודל, תצוגה מקדימה מעליו');
ok(/scrub\.dir = readingDir\(rd\.book, rec\.title\);/.test(lib), 'הציר בכיוון הספר (הממשק נשאר בעברית)');
ok(/rd\.els\.bmBtn\.classList\.toggle\('on', on\);\s*renderBmMarks\(\);/.test(lib) && /if \(m\._key === key\) return;/.test(lib), 'הסימניות על הציר מתעדכנות עם כל שינוי — ובלי לבנות מחדש כשאין שינוי');
ok(/const hit = rd\.scrubbing \? scrubSnap\(/.test(lib), 'עצירה מגנטית רק בגרירה באצבע (במקלדת צעד קטן היה "נתקע")');
ok(/if \(hit\) \{ try \{ if \(navigator\.vibrate\) navigator\.vibrate\(10\); \} catch \(e\) \{\} \}/.test(lib), 'רטט עדין בכניסה לסימנייה (פעם אחת לכל כניסה)');
ok(/if \(hit && hit\.c\) rd\.view\.goTo\(hit\.c\)\.catch\(\(\) => rd\.view\.goToFraction\(v\)\);/.test(lib), 'שחרור על סימנייה — בדיוק לעמוד המסומן (CFI), לא "בערך"');
ok(/if \(hit\.t === 'bm'\) el\.pvTx\.textContent = hit\.x;/.test(lib) && /secText\(at\.i\)\.then/.test(lib), 'תצוגה מקדימה: על סימנייה — הקטע שלה; אחרת — שורות הפתיחה מהפרק');
ok(/function preloadSecText\(rec\)/.test(lib) && /tx\('text', 'readonly', \(st\) => reqP\(st\.get\(rec\.id\)\)\)/.test(lib) && /function docText\(doc\)/.test(lib) && /const t = docText\(await sec\.createDocument\(\)\);/.test(lib), 'טקסט התצוגה: מהאינדקס של החיפוש כשקיים, אחרת מהפרק (חילוץ משותף)');
ok(/if \(rd && rd\.pvSeq === seq\)/.test(lib), 'טקסט שמגיע באיחור לא דורס מיקום חדש יותר');
ok(/if \(from && from\.cfi && Math\.abs\(from\.f - v\) > 0\.004 && !rd\.back\)/.test(lib) && /rd\.view\.goTo\(b\.cfi\)/.test(lib) && /\+\+rd\.back\.turns > 3/.test(lib), 'קינדל: "חזרה ל־X%" למקום שלפני הקפיצה הראשונה; נעלם אחרי כמה עמודים');
ok(/if \(!slider\.matches\(':active'\) && !rd\.scrubbing\)/.test(lib), 'דפדוף לא מזיז את האגודל באמצע גרירה');
ok(/slider\.setAttribute\('aria-label', T\('rdProgress'\)\)/.test(lib) && /aria-valuetext/.test(lib), 'נגישות: תווית + ערך באחוזים');

// ---------- עיצוב ----------
ok(/\.rd-slider::-webkit-slider-thumb \{[^}]*width: 22px; height: 22px;[^}]*border-radius: 50%; background: #fff;/.test(css) && /const SCRUB_THUMB = 22;/.test(lib), 'אגודל לבן עגול (Apple), והחישוב משתמש באותו רוחב');
ok(/\.rd-scrub\[dir="rtl"\] \.rd-track \{ background: linear-gradient\(to left/.test(css), 'המסילה מתמלאת בכיוון הספר (מ־v332 — שכבה משלה מתחת לסימונים)');
ok(/\.rd-bmark \{[^}]*inset-inline-start: calc\(11px \+ var\(--f\) \* \(100% - 22px\)\)/.test(css), 'סימנייה על הציר בדיוק במרכז האגודל באותו מיקום');
ok(/\.rd-bmark\.hit \{ transform: translateY\(-5px\) scale\(1\.55\)/.test(css), 'סימנייה שהאגודל עליה — מתרוממת מעליו');
ok(/\.rd-prev \{[^}]*background: var\(--rd-page\)/.test(css) && /\.rd\[data-dark="1"\] \.rd-prev \{ background: #1C1C1E;/.test(css) && /\.rd-prev\.bm \{[^}]*rgba\(48,209,88/.test(css), 'תצוגה מקדימה = עמוד קטן בצבעי הקורא; בכהה משטח מוגבה; טבעת ירוקה על סימנייה');
ok(/@media \(prefers-reduced-motion: reduce\) \{ \.rd-prev, \.rd-bmark/.test(css), 'reduced-motion');
ok((app.match(/\brdBackTo: '/g) || []).length === 2 && (app.match(/\brdProgress: '/g) || []).length === 2, 'מחרוזות בעברית ובאנגלית');
console.log('# ' + n + ' בדיקות עברו');
