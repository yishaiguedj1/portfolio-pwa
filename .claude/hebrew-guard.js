#!/usr/bin/env node
/* כלל ברזל: עברית בלבד — אכיפה בסוף כל תשובה (Stop hook, 13/10/2026).
   עד היום הכלל רק הוזרק להקשר (hebrew-rule.sh) — ובכל זאת תשובות וסיכומים יצאו באנגלית, והמשתמש ביקש שוב ושוב.
   כאן הבדיקה בפועל: הטקסט שנכתב למשתמש מאז ההודעה האחרונה שלו (בלי קוד, נתיבים וקישורים) —
   קטע שרובו אנגלית = חסימה, ו־Claude חייב לכתוב את התשובה מחדש בעברית.
   כל תקלה בבדיקה = לא חוסמים (לא תוקעים את הסשן). */
'use strict';
const fs = require('fs');

const MIN_LATIN = 40;     // קטע קצר (שם קובץ, פקודה) — לא נבדק
const MAX_LATIN = 0.5;    // יותר ממחצית האותיות לטיניות = אנגלית

/* הטקסט "הנקי": בלי בלוקי קוד, קוד בשורה, קישורים, נתיבים, מזהים ומספרים */
function clean(t) {
  return String(t || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<[^>\n]+>/g, ' ')
    .replace(/\S*[\/\\._#=@:]\S*/g, ' ');
}
function latinShare(t) {
  const s = clean(t);
  const he = (s.match(/[֐-׿]/g) || []).length;
  const la = (s.match(/[A-Za-z]/g) || []).length;
  return { he, la, bad: la >= MIN_LATIN && la / (he + la) > MAX_LATIN };
}
/* הודעה של המשתמש = לא תוצאת כלי */
function isUserPrompt(e) {
  if (!e || e.type !== 'user' || !e.message) return false;
  const c = e.message.content;
  if (typeof c === 'string') return !/^\s*<(task-notification|system-reminder)/.test(c);
  return Array.isArray(c) && c.some((b) => b && b.type === 'text') && !c.some((b) => b && b.type === 'tool_result');
}
/* קטעי הטקסט של Claude מאז ההודעה האחרונה של המשתמש */
function turnTexts(lines) {
  const ents = [];
  for (const l of lines) { try { ents.push(JSON.parse(l)); } catch (e) { /* שורה חלקית */ } }
  let start = 0;
  ents.forEach((e, i) => { if (isUserPrompt(e)) start = i + 1; });
  const out = [];
  for (const e of ents.slice(start)) {
    if (e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
    for (const b of e.message.content) if (b && b.type === 'text' && b.text && b.text.trim()) out.push(b.text);
  }
  return out;
}
/* רק סוף היומן (עד 4MB) — יומן של סשן ארוך שוקל מאות MB, והבדיקה רצה בסוף כל תשובה */
function tail(f, max = 4 * 1024 * 1024) {
  const size = fs.statSync(f).size, n = Math.min(size, max), buf = Buffer.alloc(n);
  const fd = fs.openSync(f, 'r'); try { fs.readSync(fd, buf, 0, n, size - n); } finally { fs.closeSync(fd); }
  const s = buf.toString('utf8');
  return size > n ? s.slice(s.indexOf('\n') + 1) : s;   // השורה הראשונה חתוכה
}
function verdict(input) {
  if (!input || input.stop_hook_active) return null;   // כבר נחסם פעם אחת בתור הזה — לא לולאה
  let texts = [];
  if (input.transcript_path && fs.existsSync(input.transcript_path)) texts = turnTexts(tail(input.transcript_path).split('\n'));
  if (!texts.length && input.last_assistant_message) texts = [input.last_assistant_message];
  const bad = texts.filter((t) => latinShare(t).bad);
  if (!bad.length) return null;
  const sample = clean(bad[bad.length - 1]).replace(/\s+/g, ' ').trim().slice(0, 120);
  return { decision: 'block', reason: 'הפרה של כלל הברזל: ' + bad.length + ' קטעים בתשובה נכתבו באנגלית (למשל: "' + sample + '…"). ' +
    'כתוב עכשיו את כל התשובה למשתמש מחדש בעברית בלבד — כולל הסיכום ושורות הביניים. שמות קוד, קבצים ופקודות נשארים כמו שהם.' };
}
module.exports = { clean, latinShare, isUserPrompt, turnTexts, verdict };

if (require.main === module) {
  let buf = '';
  process.stdin.on('data', (d) => { buf += d; });
  process.stdin.on('end', () => {
    try { const v = verdict(JSON.parse(buf || '{}')); if (v) process.stdout.write(JSON.stringify(v)); } catch (e) { /* לא חוסמים על תקלה */ }
    process.exit(0);
  });
}
