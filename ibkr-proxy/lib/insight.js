/* האקדמיה (שלב 5): "שכבת האקדמיה" למכתב — Gemini קורא את הטקסט המלא של המכתב ומחזיר JSON בעברית:
   תקציר, רעיונות מרכזיים, "בעיני השקעות ערך" (קישור לגראהם/פישר/באפט/מאנגר/אקמן ועוד), מונחים ושאלה למחשבה.
   כל הטענות חייבות להישען על הטקסט (ההנחיה אוסרת להמציא מספרים/ציטוטים). מפתח: GEMINI_API_KEY (Vercel בלבד). */
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const { INSIGHT_MODELS: MODELS } = require('./gmodels');
const THINKERS = ['graham', 'fisher', 'buffett', 'munger', 'ackman', 'lynch', 'marks', 'klarman', 'greenblatt', 'pabrai'];

function insightPrompt(title, text) {
  const sys = 'You are a professor of value investing in the tradition of Benjamin Graham, Philip Fisher, Warren Buffett and Charlie Munger. ' +
    'Read the FULL letter below and write study notes IN HEBREW for a serious Israeli reader. Ground every statement in the letter itself: ' +
    'do not invent numbers, names, events or quotes that are not in the text; when you quote, quote the letter exactly. ' +
    'summary: 3-4 sentences on what this letter is really about. ideas: 4-6 key lessons, each one self-contained sentence. ' +
    'lens: 2-4 items connecting a lesson of THIS letter to a value-investing thinker (thinker id from the list) and explaining the link in one or two sentences. ' +
    'terms: 3-6 investing terms that appear in the letter, with the Hebrew term, the English term, and a one-sentence explanation of how it is used here. ' +
    'question: one open question for reflection that makes the reader apply the idea to their own investing. Plain text, no markdown.';
  const user = 'TITLE: ' + (title || '-') + '\nLETTER:\n' + text;
  return { sys, user };
}
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    ideas: { type: 'ARRAY', items: { type: 'STRING' } },
    lens: { type: 'ARRAY', items: { type: 'OBJECT', properties: { thinker: { type: 'STRING', enum: THINKERS }, point: { type: 'STRING' } }, required: ['thinker', 'point'] } },
    terms: { type: 'ARRAY', items: { type: 'OBJECT', properties: { he: { type: 'STRING' }, en: { type: 'STRING' }, def: { type: 'STRING' } }, required: ['he', 'def'] } },
    question: { type: 'STRING' },
  },
  required: ['summary', 'ideas', 'question'],
};
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
function cleanInsight(o) {
  if (!o || typeof o.summary !== 'string' || !o.summary.trim()) return null;
  return {
    summary: clip(o.summary, 1200),
    ideas: (o.ideas || []).map((x) => clip(x, 400)).filter(Boolean).slice(0, 6),
    lens: (o.lens || []).filter((x) => x && THINKERS.includes(x.thinker) && x.point).map((x) => ({ thinker: x.thinker, point: clip(x.point, 400) })).slice(0, 4),
    terms: (o.terms || []).filter((x) => x && x.he && x.def).map((x) => ({ he: clip(x.he, 60), en: clip(x.en, 60), def: clip(x.def, 300) })).slice(0, 6),
    question: clip(o.question, 400),
  };
}
async function insight(title, text, fetchImpl, diag = {}) {
  const key = process.env.GEMINI_API_KEY;
  diag.key = !!key;
  if (!key) return { error: 'no_key' };
  const { sys, user } = insightPrompt(title, text);
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: SCHEMA },
  });
  const started = Date.now();
  let q429 = 0, tried = 0;
  for (const model of MODELS()) {
    const left = 52000 - (Date.now() - started);
    if (left < 8000) break;
    tried++;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), left);
    try {
      const r = await (fetchImpl || fetch)(GEMINI_URL + encodeURIComponent(model) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body, signal: ctl.signal,
      });
      diag[model] = r.status;
      if (r.status === 429) { q429++; continue; }      // v333: לכל מודל מכסה נפרדת — ממשיכים ל־Lite
      if (r.status !== 200) continue;
      const j = await r.json();
      const raw = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text || '').join('');
      const out = cleanInsight(JSON.parse(raw));
      if (out) return { insight: Object.assign(out, { model }) };
    } catch (e) { diag[model + ':ex'] = String(e && e.message || e).slice(0, 60); } finally { clearTimeout(to); }
  }
  return { error: q429 && q429 === tried ? 'quota' : 'ai_failed' };
}
module.exports = { insight, insightPrompt, cleanInsight, THINKERS };
