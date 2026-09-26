// ui-v151.test.js — פרויקט יישור עיצובי, שלבים 1+2: באגים חזותיים ואחידות.
// בלי שינוי צבעים/מבנה — רק מה שנשבר בעין או נראה שונה מהמקביל שלו.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const rule = (sel) => { const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')); return m ? m[1] : ''; };

const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) },
  window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('x')), setTimeout, clearTimeout, console };
vm.createContext(sb); vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);

// 1. כרטיס מניה: שם ארוך לא דוחף את המחיר
ok(/minmax\(0, 1fr\) auto/.test(rule('.stock-head')), 'כותרת כרטיס: עמודת המחיר auto, התוכן minmax(0,1fr)');
ok(/grid-row:\s*2/.test(rule('.stock-name')) && /text-overflow:\s*ellipsis/.test(rule('.stock-name')) && /nowrap/.test(rule('.stock-name')), 'שם החברה בשורה 2, שורה אחת עם שלוש נקודות');
ok((css.match(/^\.stock-id\s*\{/gm) || []).length === 1, '.stock-id מוגדר פעם אחת (הכפילות הוסרה)');
// 2. תוויות גרף המניה
ok(/function drawStockChart[\s\S]{0,2500}padR = Math\.ceil\(Math\.max\(ctx\.measureText/.test(src), 'גרף מניה: רוחב התוויות נמדד');
// 3. פנסיה
ok(/\(num\(f\.ils\) \|\| 0\) \/ state\.fx/.test(src) && /const totCur = /.test(src), 'פנסיה: אריחים וסך ממירים לפי השער');
// 4. אפס ניטרלי
ok(/Math\.abs\(v\) < 0\.005 \? '' : v >= 0 \? 'pos' : 'neg'/.test(src) && /Math\.abs\(m\.dayChg\) < 0\.005 \? 0 : m\.dayChg/.test(src), 'שינוי יומי 0.00% בלי צבע (v166: stockSubHTML)');
// 5+9. סכומים
const dep = A('depositAmountHTML');
ok(/−₪1,000/.test(dep(1000)) && /class="r-amt in"/.test(dep(1000)), 'משיכה: −₪ (לא +₪ ירוק)');
ok(/₪2,000/.test(dep(-2000)) && !/−/.test(dep(-2000)), 'הפקדה: ללא סימן');
ok(/direction:\s*ltr/.test(rule('.rows .r-amt')), 'סימן תמיד לפני המספר');
ok(/--on-surface-var/.test(rule('.rows .r-amt.in')), 'משיכה באפור, ירוק שמור לרווח');
// 6. מעקב
ok(/border-radius:\s*(16px|var\(--radius-sm\))/.test(rule('.form-row input[type="text"]')) && /font-size:\s*17px/.test(rule('.form-row input[type="text"]')), 'שדות המעקב כמו שאר הטפסים');
ok(/mini-btn danger wl-del/.test(src) && !/wl-del[^>]*>✕/.test(src), 'מעקב: כפתור "מחק" כמו בשאר הטאבים');
// 7. התחברות
ok(/#0F7A5A/.test(rule('.login-overlay')) && !/#1a73e8/i.test(css), 'מסך התחברות בירוק המותג');
// 8. חיבור IBKR
ok(/grid-template-columns:\s*1fr;/.test(rule('#ibkrConnDetails .form-grid')), 'שדות חיבור בעמודה אחת');
ok(/transparent/.test(rule('#ibkrDisconnect.danger-btn')), 'ניתוק = מתאר אדום (משני)');
// 10. פעולות שורה
ok(/el\('button', 'mini-btn', t\('btnEditRow'\)\)/.test(src) && /el\('button', 'mini-btn danger', t\('btnDeleteRow'\)\)/.test(src), 'עסקאות: ערוך/מחק באותו סגנון כמו הפקדות');
// 11. אריחי סקירה
ok(/flex-direction:\s*column/.test(rule('.cards-3 .card')) && /margin-top:\s*auto/.test(rule('.cards-3 .stat-sub')), 'אריחי הסקירה באותו גובה');
// 12. מקרא עוגה
ok(/'<span class="lg-name"><bdi dir="ltr" class="lg-sym">' \+ esc\(s\.sym\) \+ '<\/bdi>' \+/.test(src), 'מקרא: סימבול ראשון, עם esc() ובידוד LTR (v168: "207.TA"; v169: שם מלא מתחת)');
// 13. תאריכים
ok((src.match(/type="date" lang="he-IL"/g) || []).length >= 3, 'שדות תאריך: he-IL');

const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
console.log('\n' + n + ' בדיקות עברו');
