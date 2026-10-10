// שלב 4.1: מנוע היישור בדופק של השרת → מסך השרת ("יישור מהיר (ONNX INT8) ✓") — כדי לוודא אחרי פריסה שהגרפים עלו.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const S = require('../ibkr-proxy/lib/studio.js');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
ok(S.normHb({ al: 'o' }).al === 'o' && S.normHb({ al: 't' }).al === 't' && S.normHb({ al: '<b>x' }).al === '', 'השרתון: קוד קבוע בלבד');
const src = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
ok(/al: x\.hb\.al === 'o' \|\| x\.hb\.al === 't' \? x\.hb\.al : ''/.test(src) && /sv\.hb\.al === 'o' \? ' · ' \+ T\('studioAlOnnx'\)/.test(src), 'הטלפון: שורה במסך השרת');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
ok((app.match(/studioAlOnnx: "/g) || []).length === 2, 'מחרוזת בשתי השפות');
const ag = fs.readFileSync(path.join(__dirname, '..', 'translator', 'agent.py'), 'utf8');
ok(/hb\['al'\] = 't' if os\.environ\.get\('SNB_ALIGN', ''\)\.lower\(\) == 'torch' or not os\.path\.isfile/.test(ag), 'העובד: ONNX רק כשיש manifest (כמו align_onnx.onnx_dir)');
console.log('# ' + n + ' בדיקות עברו');
