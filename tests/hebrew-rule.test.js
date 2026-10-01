// כלל ברזל: עברית בלבד — ההוק שמזריק את הכלל לכל הודעה לא נמחק בטעות
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8'));
const runs = (ev) => (cfg.hooks?.[ev] || []).some((g) => (g.hooks || []).some((h) => /hebrew-rule\.sh/.test(h.command || '')));
ok(runs('UserPromptSubmit'), 'ההוק רץ בכל הודעה של המשתמש');
ok(runs('SessionStart'), 'ההוק רץ בתחילת סשן ואחרי דחיסת הקשר');
const sh = fs.readFileSync(path.join(root, '.claude/hebrew-rule.sh'), 'utf8');
ok(/עברית בלבד/.test(sh) && /commit/.test(sh), 'הכלל מכסה תשובות ותיעוד');
const md = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
ok(md.indexOf('כלל ברזל מס׳ 0') > -1 && md.indexOf('כלל ברזל מס׳ 0') < 400, 'הכלל בראש CLAUDE.md');
console.log('# ' + n + ' בדיקות עברו');
