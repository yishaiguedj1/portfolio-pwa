/* האקדמיה (שלב 1): POST /api/translate  { text, context?, title?, to? }  ->  { ok, translation, note?, engine }
   תרגום בהקשר (בקשת המשתמש): מודל שפה מקבל את הקטע שסומן + המשפט/הפסקה שסביבו + שם הספר, ומתרגם את
   הקטע כפי שהוא משמש שם — לא מילה מבודדת כמו מילון. למונח מקצועי (float, moat…) מוחזר גם הסבר קצר.
   מנוע: Gemini Flash (רמת החינם של Google AI Studio — בחירת המשתמש), מפתח ב־GEMINI_API_KEY (משתנה סביבה
   ב־Vercel, לעולם לא בקוד). בלי מפתח / כשהמכסה נגמרה — גיבוי תרגום מילולי (MyMemory) עם engine:'basic',
   והאפליקציה מציינת שזה תרגום בסיסי. רק טקסט מהספר — שום נתון של המשתמש. */
const { guard } = require('../lib/ibkr');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
// הכינוי "latest" מצביע תמיד ל־Flash העדכני; אם הוא לא זמין — הגרסה הקבועה ואז Flash-Lite
const MODELS = () => [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'].filter(Boolean);
const AI_MS = 9000;
const BASIC_MS = 5000;
const MAX_TEXT = 400;
const MAX_CTX = 1600;
const LANGS = { he: 'עברית', en: 'English', ar: 'العربية', ru: 'Русский', fr: 'Français', es: 'Español', de: 'Deutsch' };

const cache = new Map();
const hits = new Map();
function limited(ip) { // סימון ותרגום = פעולה ידנית; 30 בדקה זה הרבה מעבר לקריאה רגילה
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 30;
}
const clean = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);

function prompt(text, context, title, lang) {
  const target = LANGS[lang] || LANGS.he;
  const sys = 'You are a literary and financial translator. Translate the SELECTED text into ' + target + ' exactly as it is used in its CONTEXT ' +
    '(the surrounding sentence/paragraph of the book named in TITLE). Choose the sense that fits the context, keep the author\'s tone, ' +
    'keep names, tickers and numbers as they are. If the selection is already in ' + target + ', explain it briefly in ' + target + ' instead. ' +
    'If the selection is a professional term or idiom (finance, accounting, insurance, law), add one short sentence in ' + target +
    ' explaining what it means here; otherwise leave "note" empty. Reply only with the JSON fields.';
  const user = 'TITLE: ' + (title || '-') + '\nCONTEXT: ' + (context || '-') + '\nSELECTED: ' + text;
  return { sys, user };
}

async function gemini(text, context, title, lang, diag) {
  const key = process.env.GEMINI_API_KEY;
  diag.key = !!key; // אבחון בלי לחשוף את המפתח: האם קיים, ומה החזיר כל מודל
  if (!key) return null;
  const { sys, user } = prompt(text, context, title, lang);
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.2, maxOutputTokens: 600, responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties: { translation: { type: 'STRING' }, note: { type: 'STRING' } }, required: ['translation'] },
    },
  });
  for (const model of MODELS()) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), AI_MS);
    try {
      const r = await fetch(GEMINI_URL + encodeURIComponent(model) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body, signal: ctl.signal,
      });
      diag[model] = r.status;
      if (r.status === 404 || r.status === 400) { try { diag[model + ':err'] = String(((await r.json()).error || {}).message || '').slice(0, 160); } catch (e) {} continue; } // המודל לא קיים/לא זמין — הבא ברשימה
      if (r.status === 429) return { quota: true };        // מכסת החינם נגמרה — גיבוי בסיסי
      if (r.status !== 200) continue;
      const j = await r.json();
      const raw = (((j.candidates || [])[0] || {}).content || {}).parts;
      const txt = (raw || []).map((p) => p.text || '').join('');
      const out = JSON.parse(txt);
      if (out && typeof out.translation === 'string' && out.translation.trim()) {
        return { translation: clean(out.translation, 2000), note: clean(out.note || '', 600), engine: 'ai', model };
      }
    } catch (e) { diag[model + ':ex'] = String(e && e.message || e).slice(0, 80); } finally { clearTimeout(to); }
  }
  return null;
}

async function basic(text, lang) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), BASIC_MS);
  try {
    const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' +
      encodeURIComponent('en|' + (LANGS[lang] ? lang : 'he')), { signal: ctl.signal });
    if (r.status !== 200) return null;
    const j = await r.json();
    const t = j && j.responseData && j.responseData.translatedText;
    return t ? { translation: clean(t, 2000), note: '', engine: 'basic' } : null;
  } catch (e) { return null; } finally { clearTimeout(to); }
}

module.exports = async (req, res) => {
  if (guard(req, res)) return;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const text = clean(body.text, MAX_TEXT);
  const context = clean(body.context, MAX_CTX);
  const title = clean(body.title, 120);
  const lang = LANGS[body.to] ? body.to : 'he';
  if (!text) return res.status(400).json({ ok: false, error: 'bad_params' });
  const key = lang + '|' + text + '|' + context;
  const hit = cache.get(key);
  if (hit) return res.status(200).json(hit);
  const diag = {};
  let out = await gemini(text, context, title, lang, diag);
  const quota = !!(out && out.quota);
  if (!out || quota) out = await basic(text, lang);
  if (!out) return res.status(502).json({ ok: false, error: 'translate_failed' });
  const v = Object.assign({ ok: true, quota }, out, { diag });
  cache.set(key, v);
  if (cache.size > 500) cache.clear();
  return res.status(200).json(v);
};

module.exports._prompt = prompt;
module.exports._cache = cache;
module.exports._hits = hits;
