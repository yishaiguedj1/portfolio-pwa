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
// 13/10/2026 (המשתמש: "למה אני צריך לבקש את זה כל פעם, כל יום, כמה פעמים — תפתור לתמיד"): אכיפה בסוף כל תשובה
const runsGuard = (cfg.hooks?.Stop || []).some((g) => (g.hooks || []).some((h) => /hebrew-guard\.js/.test(h.command || '')));
ok(runsGuard, 'השומר רץ בסוף כל תשובה (Stop)');
const G = require(path.join(root, '.claude/hebrew-guard.js'));
const os = require('os');
const tr = (...ents) => { const f = path.join(os.tmpdir(), 'hg-' + process.pid + '-' + n + '.jsonl'); fs.writeFileSync(f, ents.map((e) => JSON.stringify(e)).join('\n') + '\n'); return f; };
const U = (t) => ({ type: 'user', message: { content: t } });
const A = (t) => ({ type: 'assistant', message: { content: [{ type: 'text', text: t }] } });
const TR = { type: 'user', message: { content: [{ type: 'tool_result', content: 'x' }] } };
const EN = 'Found it: the files are updated on the server, but the phone is stuck on the old version. Should I open a PR?';
const HE = 'מצאתי: הקבצים בשרת מעודכנים, אבל הטלפון נשאר על הגרסה הישנה. התיקון ב־`sw.js`, כל הבדיקות עוברות. לפתוח PR?';
const v1 = G.verdict({ transcript_path: tr(U('בדוק'), A(HE), TR, A(EN)) });
ok(v1 && v1.decision === 'block' && /בעברית בלבד/.test(v1.reason), 'תשובה באנגלית — נחסמת, עם הוראה לכתוב מחדש בעברית');
ok(!G.verdict({ transcript_path: tr(U('בדוק'), A(HE), TR, A('עדכנתי את `studio.css` ו־`library.js`: https://github.com/a/b/pull/1 — Studio ‏#FF4656, Academy ‏#4699FF.')) }), 'עברית עם שמות קוד, קבצים וקישורים — עוברת');
ok(!G.verdict({ transcript_path: tr(A(EN), U('תמשיך'), A(HE)) }), 'רק התשובה מאז ההודעה האחרונה של המשתמש נבדקת');
ok(!G.verdict({ transcript_path: tr(U('x'), A(EN)), stop_hook_active: true }), 'כבר נחסם פעם אחת בתור — לא נחסם שוב (בלי לולאה)');
ok(!G.verdict({ transcript_path: tr(U('x'), A('```js\nconst a = "some english code here and more and more text";\n```\nתוקן.')) }), 'בלוק קוד באנגלית — לא נספר');
ok(G.verdict({ last_assistant_message: EN }) && !G.verdict({}), 'בלי יומן — נבדקת ההודעה האחרונה; בלי כלום — לא חוסמים');
{ const { execFileSync } = require('child_process');
  const out = execFileSync('node', [path.join(root, '.claude/hebrew-guard.js')], { input: '{bad json' }).toString();
  ok(out === '', 'קלט פגום — לא חוסמים (לא תוקעים את הסשן)'); }
console.log('# ' + n + ' בדיקות עברו');
