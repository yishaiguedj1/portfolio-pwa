/* האקדמיה (שלב 1): POST /api/translate  { text, context?, title?, to? }  ->  { ok, translation, note?, engine }
   תרגום בהקשר (בקשת המשתמש): מודל שפה מקבל את הקטע שסומן + המשפט/הפסקה שסביבו + שם הספר, ומתרגם את
   הקטע כפי שהוא משמש שם — לא מילה מבודדת כמו מילון. למונח מקצועי (float, moat…) מוחזר גם הסבר קצר.
   מנוע: Gemini Flash (רמת החינם של Google AI Studio — בחירת המשתמש), מפתח ב־GEMINI_API_KEY (משתנה סביבה
   ב־Vercel, לעולם לא בקוד). בלי מפתח / כשהמכסה נגמרה — גיבוי תרגום מילולי (MyMemory) עם engine:'basic',
   והאפליקציה מציינת שזה תרגום בסיסי. רק טקסט מהספר — שום נתון של המשתמש. */
const { guard } = require('../lib/ibkr');
const { TRANSLATE_MODELS, badScript } = require('../lib/gmodels');
const { mistralJSON } = require('../lib/mistral');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MODELS = TRANSLATE_MODELS;
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
    'keep names, tickers and numbers as they are. Write only in the script of ' + target + ' (never mix in letters of other alphabets). If the selection is already in ' + target + ', explain it briefly in ' + target + ' instead. ' +
    'If the selection is a professional term or idiom (finance, accounting, insurance, law), add one short sentence in ' + target +
    ' explaining what it means here; otherwise leave "note" empty. ' +
    'Also return "wiki": the exact title of the English Wikipedia article about the concept as it is used HERE (for example "moat" in an investing letter -> "Economic moat"; a company or person -> its article), ' +
    'or an empty string when the selection is an ordinary word that does not merit an encyclopedia article. ' +
    'Reply only with a JSON object with the fields "translation", "note" and "wiki".';
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
      temperature: 0.2, maxOutputTokens: 2048,   // v333: במודלי "חשיבה" טוקני החשיבה נספרים כאן — 600 חתך את ה־JSON (נמדד חי)
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties: { translation: { type: 'STRING' }, note: { type: 'STRING' }, wiki: { type: 'STRING' } }, required: ['translation'] },
    },
  });
  let q429 = 0, tried = 0;
  for (const model of MODELS()) {
    tried++;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), AI_MS);
    try {
      const r = await fetch(GEMINI_URL + encodeURIComponent(model) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body, signal: ctl.signal,
      });
      diag[model] = r.status;
      if (r.status === 404 || r.status === 400) { try { diag[model + ':err'] = String(((await r.json()).error || {}).message || '').slice(0, 160); } catch (e) {} continue; } // המודל לא קיים/לא זמין — הבא ברשימה
      if (r.status === 429) { q429++; continue; }        // v333: למודל הזה נגמרה המכסה — לכל מודל מכסה נפרדת, ממשיכים
      if (r.status !== 200) continue;
      const j = await r.json();
      const raw = (((j.candidates || [])[0] || {}).content || {}).parts;
      const txt = (raw || []).map((p) => p.text || '').join('');
      const out = JSON.parse(txt);
      if (badScript(out && out.translation, lang) || badScript(out && out.note, lang)) { diag[model + ':err'] = 'mixed_script'; diag[model + ':txt'] = clean((out.translation || '') + ' | ' + (out.note || ''), 160); continue; }
      if (out && typeof out.translation === 'string' && out.translation.trim()) {
        return { translation: clean(out.translation, 2000), note: clean(out.note || '', 600), wiki: clean(out.wiki || '', 120), engine: 'ai', provider: 'gemini', model };
      }
    } catch (e) { diag[model + ':ex'] = String(e && e.message || e).slice(0, 80); } finally { clearTimeout(to); }
  }
  return q429 && q429 === tried ? { quota: true } : null;   // "מכסה" רק כשכל המודלים החזירו 429
}

/* v333: תרגום מהיר כמו הכרטיס של Google Translate — אותה נקודה שתוסף המילון של Chrome משתמש בה: תרגום,
   חלקי דיבר ותרגומים חלופיים, בלי מפתח ובלי מכסה. האפליקציה פונה אליה ישירות מהטלפון (מהיר יותר);
   כאן — גיבוי כשהפנייה הישירה נכשלה. */
const GT_URL = 'https://clients5.google.com/translate_a/single?client=dict-chrome-ex&dt=t&dt=bd&dj=1';
const NIQQUD = /[\u0591-\u05C7]/g;
function parseGt(j) {
  if (!j || !Array.isArray(j.sentences)) return null;
  const tr = j.sentences.map((x) => x.trans || '').join('').replace(NIQQUD, '').trim();
  if (!tr) return null;
  const dict = (j.dict || []).slice(0, 3).map((d) => ({ pos: clean(d.pos, 30), terms: [...new Set((d.terms || []).map((t) => clean(t, 40).replace(NIQQUD, '')))].filter(Boolean).slice(0, 4) })).filter((d) => d.terms.length);
  return { translation: clean(tr, 2000), dict, src: clean(j.src, 8) };
}
async function quick(text, lang) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), BASIC_MS);
  try {
    const r = await fetch(GT_URL + '&sl=auto&tl=' + lang + '&hl=' + lang + '&q=' + encodeURIComponent(text), { signal: ctl.signal });
    if (r.status !== 200) return null;
    const out = parseGt(await r.json());
    return out ? Object.assign(out, { engine: 'google' }) : null;
  } catch (e) { return null; } finally { clearTimeout(to); }
}

/* v334: "בהקשר הזה" — Mistral ראשון (מכסה גדולה), Gemini גיבוי. אותה הנחיה, אותו מבנה, ואותה פסילה של כתב מעורב */
async function mistral(text, context, title, lang, diag) {
  const { sys, user } = prompt(text, context, title, lang);
  const r = await mistralJSON(sys, user, diag);
  if (!r.out) return r.error === 'quota' ? { quota: true } : null;
  const o = r.out;
  if (typeof o.translation !== 'string' || !o.translation.trim()) return null;
  if (badScript(o.translation, lang) || badScript(o.note, lang)) { diag['mistral:' + r.model + ':err'] = 'mixed_script'; return null; }
  return { translation: clean(o.translation, 2000), note: clean(o.note || '', 600), wiki: clean(o.wiki || '', 120), engine: 'ai', provider: 'mistral', model: r.model };
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
  if (body.mode === 'quick') {
    const qk = 'q|' + lang + '|' + text;
    if (cache.has(qk)) return res.status(200).json(cache.get(qk));
    const q = await quick(text, lang);
    if (!q) return res.status(502).json({ ok: false, error: 'translate_failed' });
    const v = Object.assign({ ok: true }, q);
    cache.set(qk, v);
    return res.status(200).json(v);
  }
  const only = body.only === 'mistral' || body.only === 'gemini' ? body.only : '';   // השוואת איכות (שלב 2) — ספק אחד בלבד
  const key = lang + '|' + text + '|' + context + '|' + only;
  const hit = cache.get(key);
  if (hit) return res.status(200).json(hit);
  const diag = {};
  let out = only === 'gemini' ? null : await mistral(text, context, title, lang, diag);
  const mq = !!(out && out.quota);
  if (mq) out = null;
  let gq = false;
  if (!out && only !== 'mistral') { out = await gemini(text, context, title, lang, diag); gq = !!(out && out.quota); if (gq) out = null; }
  // "מכסה" רק כשכל הספקים שנוסו החזירו מכסה (בלי מפתח — לא נחשב)
  const quota = !out && (only === 'mistral' ? mq : only === 'gemini' ? gq : (mq || !diag.mistralKey) && gq);
  if (!out) out = await basic(text, lang);
  if (!out) return res.status(502).json({ ok: false, error: 'translate_failed' });
  const v = Object.assign({ ok: true, quota }, out, { diag });
  cache.set(key, v);
  if (cache.size > 500) cache.clear();
  return res.status(200).json(v);
};

module.exports._prompt = prompt;
module.exports._parseGt = parseGt;
module.exports._cache = cache;
module.exports._hits = hits;
