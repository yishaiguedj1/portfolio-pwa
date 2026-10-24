// 24/10/2026: עבודה מהורדה בטלפון התחילה לפני שהשרתון ענה (ui.api עוד לא נטען) ונפלה בשקט ל־Routine.
// במצב השרת / העתק־הדבק ההתחלה מחכה לתשובה, ובלעדיה לא מתחילים.
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const m = src.match(/export const engKnown = [^\n]+/);
ok(m, 'engKnown קיימת');
const engKnown = new Function(m[0].replace(/^export /, '') + '\nreturn engKnown;')();
ok(engKnown('sub', null) === true, 'מנוי — לא צריך את השרתון');
ok(engKnown('api', null) === false, 'שרת בלי תשובה — לא ידוע');
ok(engKnown('copy', null) === false, 'העתק־הדבק בלי תשובה — לא ידוע');
ok(engKnown('api', { online: 1 }) === true, 'שרת עם תשובה — ידוע');

// השמירה בראש startFromForm — לפני כל המסלולים (כתוביות, קישור, קובץ, ההורדה מהטלפון)
const body = src.slice(src.indexOf('function startFromForm()'));
const g = body.indexOf('engKnown(store.settings.conn, ui.api)');
ok(g > 0 && g < body.indexOf('startSubs(f)') && g < body.indexOf('startLink(f)') && g < body.indexOf('apiMode()'), 'נבדק לפני כל מסלול');
ok(/engSettle\(\)\.then\(\(ok\) => \{[\s\S]{0,200}if \(form !== f\) return;[\s\S]{0,120}if \(ok\) startFromForm\(\); else \{ flashSafe\(T\('studioEngWait'\)\)/.test(body), 'אין תשובה — הודעה, בלי Routine');
ok(/function gotFile[\s\S]*?startFromForm\(\)/.test(src), 'ההורדה מהטלפון עוברת דרך startFromForm');
ok(app.split('studioEngWait: "').length === 3, 'המחרוזת בעברית ובאנגלית');
console.log('studio-engwait: ' + n + ' בדיקות עברו');
