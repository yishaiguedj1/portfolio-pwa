#!/usr/bin/env node
'use strict';
// מלאי כפתורים: כל מחלקה ראשונה של אלמנט <button> (או role=button) בכל קבצי המקור.
// משמש את tests/snow-buttons.test.js — כל מחלקה חייבת להופיע ב־snow.css: בכדור שלג או ברשימת הפטורים.
// הרצה ידנית: node tools/btn-inventory.js  → מחלקה, מספר, קבצים.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SKIP = /^(core|strings-|sw|firebase-config)/;

function sources() {
  return fs.readdirSync(ROOT).filter((f) => /\.(js|html)$/.test(f) && !SKIP.test(f));
}

function first(cls) {
  const k = String(cls || '').trim().split(/\s+/)[0] || '';
  return /^[a-zA-Z][\w-]*$/.test(k) ? k : '';
}

function scan(src, file, add) {
  let m;
  // ‎<button … class="x"‎ — ב־HTML ובמחרוזות תבנית
  const reTag = /<button\b([^>]*)>/g;
  while ((m = reTag.exec(src))) {
    const c = /class=\\?["']([^"'\\$]*)/.exec(m[1]);
    add(c ? first(c[1]) : '', file);
  }
  // h('button', 'x') / el('button', 'x') / h('button', { class: 'x' })
  const reH = /\b(?:h|el|mk|node)\(\s*['"]button['"]\s*,\s*/g;
  while ((m = reH.exec(src))) {
    const rest = src.slice(reH.lastIndex, reH.lastIndex + 160);
    let c = /^(['"`])([^'"`$]*)/.exec(rest);
    if (c) { add(first(c[2]), file); continue; }
    c = /^\{[^}]*?\bclass(?:Name)?\s*:\s*(['"`])([^'"`$]*)/.exec(rest);
    add(c ? first(c[2]) : '', file);
  }
  // פונקציות עזר: btn('x', …) ב־studio/chart/acclink; ב־move.js המחלקה היא הארגומנט השני
  if (/^(studio|chart|acclink)\.js$/.test(file)) {
    const reB = /\bbtn\(\s*(['"`])([^'"`$]*)/g;
    while ((m = reB.exec(src))) add(first(m[2]), file);
  }
  if (file === 'move.js') {
    const reB = /\bbtn\(\s*[^,()]+,\s*(['"`])([^'"`$]*)/g;
    while ((m = reB.exec(src))) add(first(m[2]), file);
  }
  // createElement('button') ואחריו className
  const reC = /createElement\(\s*['"]button['"]\s*\)/g;
  while ((m = reC.exec(src))) {
    const c = /className\s*=\s*(['"`])([^'"`$]*)/.exec(src.slice(reC.lastIndex, reC.lastIndex + 240));
    add(c ? first(c[2]) : '', file);
  }
  // role="button"
  const reR = /<[a-z]+\b([^>]*role=\\?["']button[^>]*)>/g;
  while ((m = reR.exec(src))) {
    const c = /class=\\?["']([^"'\\$]*)/.exec(m[1]);
    add(c ? first(c[1]) : '', file);
  }
}

function inventory() {
  const map = new Map();
  const add = (k, file) => {
    if (!k) return;
    const e = map.get(k) || { n: 0, files: new Set() };
    e.n++; e.files.add(file); map.set(k, e);
  };
  for (const f of sources()) scan(fs.readFileSync(path.join(ROOT, f), 'utf8'), f, add);
  return map;
}

module.exports = { inventory, scan };

if (require.main === module) {
  const inv = inventory();
  for (const [k, e] of [...inv].sort((a, b) => a[0].localeCompare(b[0]))) console.log(k, e.n, [...e.files].join(','));
}
