// 15/11/2026 — הדר קומפקטי בטלפון (בקשת המשתמש: "לצמצם בגובה, מסודר ונקי, ששמות החגים ייכנסו בכל תרחיש")
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL - ' + m); } else console.log('ok - ' + m); };
const P = 'html:not(.dk):where(:not([data-app="admin"]))';
const i = css.indexOf('@media not ((orientation: landscape) and (max-height: 500px))');
ok(i > 0, 'הכלל הקומפקטי עטוף — טלפון לרוחב נשאר בשורה אחת');
const blk = css.slice(i, css.indexOf('/* ---- Status banner ---- */', i));
ok(blk.includes(P + ' .appbar { --ib: 44px; --pill-h: 44px; --hdr-logo: calc(var(--ib) + 8px + var(--pill-h));'), 'כפתורים ובועות 44, והלוגו = גובה שתי השורות');
ok(!/--logo\b/.test(blk.replace(/--hdr-logo/g, '')), 'לא --logo (תפוס בלוגו החי: כתובת התמונה)');
ok(blk.includes(P + ' .appbar .brand-logo { width: var(--hdr-logo); height: var(--hdr-logo); }'), 'הלוגו בגודל השורות');
ok(blk.includes(P + ' .appbar-row { grid-template-rows: var(--ib) var(--pill-h); row-gap: 8px; }') && blk.includes(P + ' .appbar h1.brand { grid-row: 1 / 3; }'), 'שתי שורות בלבד — בלי שורה שלישית שמוסיפה גובה');
ok(blk.includes(P + ' .appbar-left > .appbar-sub { justify-self: stretch; margin-inline-end: 6px; }') && blk.includes(P + ' .appbar-left > .fx-pill { justify-self: stretch; margin-inline-start: 6px; }'), 'שתי הבועות נמתחות עד הלוגו — אותו רוחב, מקום לשמות החגים');
ok(blk.includes('[dir="ltr"]') , 'באנגלית המרווח בצד של הלוגו (הרשת תמיד rtl)');
ok(blk.includes(P + ' :is(.appbar .fx-pill, .appbar .appbar-sub > *) { width: auto; min-height: 0; height: var(--pill-h); }'), 'שתי הבועות באותו גובה בדיוק');
ok(/@media \(max-width: 360px\)/.test(blk) && /@media \(max-width: 319px\)/.test(blk), 'מסכים צרים — מידות משלהם');
ok(!/html\.dk|\.dk \./.test(blk), 'תצוגת מחשב בלי שינוי');
console.log(`\n${n - bad}/${n}`); if (bad) process.exit(1);
