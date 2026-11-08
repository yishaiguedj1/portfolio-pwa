#!/usr/bin/env node
/* 08/11/2026 (עדכון עצמי שקט באנדרואיד): כותב את latest.json לקישור הקבוע (android-latest) — מה שהאפליקציות בודקות
   (android/app/src/main/java/.../upd/UpdCore.kt → parse). ב־android.yml: אחרי העלאת ה־APKים, כך שאפליקציה אף פעם
   לא רואה גרסה שהקובץ שלה עוד לא עלה. שימוש: node tools/apk-latest.js <versionCode> [תיקייה] > latest.json
   הצורה: {"v":1,"code":N,"name":"1.0.N","apps":{"<חבילה>":{"f":"<קובץ>","n":<בתים>,"h":"<sha256>"}}} */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// החבילה (applicationId ב־build.gradle.kts) → שם הקובץ בקישור הקבוע (android.yml, "Rename")
const APKS = {
  'io.github.yishaiguedj1.snowball': 'the-snowball.apk',
  'app.thesnowball.academy': 'the-snowball-academy.apk',
  'app.thesnowball.studio': 'the-snowball-studio.apk',
  'app.thesnowball.bubble': 'the-snowball-bubble.apk',
  'app.thesnowball.admin': 'the-snowball-admin.apk',
  'app.thesnowball.studiodm': 'the-snowball-studio-dm.apk',
  'app.thesnowball.browser': 'the-snowball-browser.apk',
};

function build(code, dir) {
  const n = Number(code);
  if (!Number.isInteger(n) || n <= 0) throw new Error('versionCode לא תקין: ' + code);
  const apps = {};
  for (const [pkg, f] of Object.entries(APKS)) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    const buf = fs.readFileSync(p);
    apps[pkg] = { f, n: buf.length, h: crypto.createHash('sha256').update(buf).digest('hex') };
  }
  if (!Object.keys(apps).length) throw new Error('לא נמצא אף APK ב־' + dir);
  return { v: 1, code: n, name: '1.0.' + n, apps };
}

module.exports = { APKS, build };

if (require.main === module) {
  process.stdout.write(JSON.stringify(build(process.argv[2], process.argv[3] || '.')) + '\n');
}
