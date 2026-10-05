/* האקדמיה (שלב 1): POST /api/translate  { text, context?, title?, to? }  ->  { ok, translation, note?, engine }
   תרגום בהקשר (בקשת המשתמש): מודל שפה מקבל את הקטע שסומן + המשפט/הפסקה שסביבו + שם הספר, ומתרגם את
   הקטע כפי שהוא משמש שם — לא מילה מבודדת כמו מילון. למונח מקצועי (float, moat…) מוחזר גם הסבר קצר.
   מנוע: Gemini Flash (רמת החינם של Google AI Studio — בחירת המשתמש), מפתח ב־GEMINI_API_KEY (משתנה סביבה
   ב־Vercel, לעולם לא בקוד). בלי מפתח / כשהמכסה נגמרה — גיבוי תרגום מילולי (MyMemory) עם engine:'basic',
   והאפליקציה מציינת שזה תרגום בסיסי. רק טקסט מהספר — שום נתון של המשתמש. */
const { guard } = require('../lib/ibkr');
const { TRANSLATE_MODELS, badScript, fixScript } = require('../lib/gmodels');
const { mistralJSON, mistralProbe } = require('../lib/mistral');
const { createAiStore } = require('../lib/aicache');
const { verifyIdToken } = require('../lib/gauth');
const aiStore = createAiStore();
const deps = {};                                 // בדיקות: store / verify מדומים

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
    'For an ordinary word give the article about its base concept (for example "wished" -> "Wish", "ethos" -> "Ethos"); ' +
    'leave it empty only for function words (articles, prepositions, pronouns, conjunctions). ' +
    'Reply only with a JSON object with the fields "translation", "note" and "wiki".';
  const user = 'TITLE: ' + (title || '-') + '\nCONTEXT: ' + (context || '-') + '\nSELECTED: ' + text;
  return { sys, user };
}

async function gemini(text, context, title, lang, diag, models) {
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
  let q429 = 0, tried = 0, mended = null;
  for (const model of models || MODELS()) {
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
      const um = j.usageMetadata || {};          // v339: מדידת טוקנים (קלט, פלט, חשיבה) — לבחירת הדגם לפי עלות אמיתית
      diag[model + ':tok'] = [um.promptTokenCount || 0, um.candidatesTokenCount || 0, um.thoughtsTokenCount || 0];
      const raw = (((j.candidates || [])[0] || {}).content || {}).parts;
      const txt = (raw || []).map((p) => p.text || '').join('');
      const out = JSON.parse(txt);
      if (badScript(out && out.translation, lang) || badScript(out && out.note, lang)) { diag[model + ':err'] = 'mixed_script'; diag[model + ':txt'] = clean((out.translation || '') + ' | ' + (out.note || ''), 160);
        const t2 = fixScript(out.translation), n2 = fixScript(out.note);
        if (!mended && t2.trim() && !badScript(t2, lang) && !badScript(n2, lang)) mended = { translation: clean(t2, 2000), note: clean(n2, 600), wiki: clean(out.wiki || '', 120), engine: 'ai', provider: 'gemini', model };
        continue; }
      if (out && typeof out.translation === 'string' && out.translation.trim()) {
        return { translation: clean(out.translation, 2000), note: clean(out.note || '', 600), wiki: clean(out.wiki || '', 120), engine: 'ai', provider: 'gemini', model };
      }
    } catch (e) { diag[model + ':ex'] = String(e && e.message || e).slice(0, 80); } finally { clearTimeout(to); }
  }
  if (mended) return mended;                                 // v335: כולם החזירו אות ערבית — הגרסה המתוקנת, עם ויקיפדיה
  return q429 && q429 === tried ? { quota: true } : null;   // "מכסה" רק כשכל המודלים החזירו 429
}

/* v333: תרגום מהיר כמו הכרטיס של Google Translate — אותה נקודה שתוסף המילון של Chrome משתמש בה: תרגום,
   חלקי דיבר ותרגומים חלופיים, בלי מפתח ובלי מכסה. האפליקציה פונה אליה ישירות מהטלפון (מהיר יותר);
   כאן — גיבוי כשהפנייה הישירה נכשלה. */
const GT_URL = 'https://clients5.google.com/translate_a/single?client=dict-chrome-ex&dt=t&dt=bd&dt=md&dt=ss&dt=rm&dj=1';
const NIQQUD = /[\u0591-\u05C7]/g;
const gtClip = clean;
function parseGt(j) {               // תשובת Google → תרגום + מילון (חלקי דיבר, הגדרה, דוגמה, נרדפות, הגייה) — טהורה (זהה בשרתון ובאפליקציה)
  if (!j || !Array.isArray(j.sentences)) return null;
  // v334: הניקוד נשאר — בלעדיו כתיב מנוקד נשבר ("מְתַוֵךְ" → "מתוך"); בטקסט רציף Google לא מנקד ממילא
  const tr = j.sentences.map((x) => x.trans || '').join('').trim();
  if (!tr) return null;
  const tl = j.sentences.find((x) => x.src_translit) || {};
  const orig = j.sentences.map((x) => x.orig || '').join('').trim().toLowerCase();
  const defs = {};
  (j.definitions || []).forEach((d) => { const e = (d.entry || [])[0]; if (e && !defs[d.pos]) defs[d.pos] = { gloss: gtClip(e.gloss, 220), ex: gtClip(String(e.example || '').replace(/<\/?b>/g, ''), 160) }; });
  const dict = (j.dict || []).slice(0, 2).map((d) => {
    const ents = d.entry || [];
    const terms = [...new Set((d.terms || ents.map((e) => e.word)).map((t) => gtClip(t, 40)))].filter(Boolean).slice(0, 3);
    const back = [...new Set([].concat(...ents.map((e) => e.reverse_translation || [])).map((t) => gtClip(t, 40)))].filter(Boolean).slice(0, 6);
    const df = defs[d.pos] || {};
    return { pos: gtClip(d.pos, 30), terms, back, def: df.gloss || '', ex: df.ex || '' };
  }).filter((d) => d.terms.length);
  Object.keys(defs).forEach((pos) => { if (dict.length < 2 && !dict.some((d) => d.pos === pos)) dict.push({ pos: gtClip(pos, 30), terms: [], back: [], def: defs[pos].gloss, ex: defs[pos].ex }); });
  const syn = [];
  // נרדפות: בלי משלב מסומן (סלנג/לא רשמי) ובלי צירופים שמכילים את המילה עצמה
  ((j.synsets || [])[0] || { entry: [] }).entry.forEach((e) => { if (!e.label_info) (e.synonym || []).forEach((s) => { if (syn.length < 4 && !syn.includes(s) && s.length < 24 && !(orig && s.toLowerCase().includes(orig))) syn.push(s); }); });
  return { translation: gtClip(tr, 2000), dict, src: gtClip(j.src, 8), ipa: gtClip(tl.src_translit, 60), syn };
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
  if (body.mode === 'mistralProbe') {          // v338: אבחון חשבון Mistral; models = עד 6 שמות מודל לבדיקה
    const ms = Array.isArray(body.models) ? body.models.filter((m) => /^[a-z0-9.-]{3,40}$/.test(m)).slice(0, 6) : null;
    return res.status(200).json(Object.assign({ ok: true }, await mistralProbe(ms && ms.length ? { models: ms } : {})));
  }   // v338: אבחון חשבון Mistral
  if (body.mode === 'storeProbe') return res.status(200).json(Object.assign({ ok: true }, await (deps.store || aiStore).probe()));   // v339: אבחון המטמון המשותף
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
  const key = lang + '|' + text + '|' + context + '|' + only + '|' + (Array.isArray(body.gmodels) ? body.gmodels.join(',') : '');   // השוואה: גם לפי הדגם
  const hit = cache.get(key);
  if (hit) return res.status(200).json(hit);
  // v339: מטמון משותף (Firestore) — תשובה שכבר חושבה לקורא אחר, בלי לפנות ל־AI ובלי לספור במכסה
  const store = deps.store || aiStore;
  const sk = [lang, text, context];
  const shared = only ? null : await store.get('ctx', sk);
  if (shared) { const v = Object.assign({ ok: true, quota: false }, shared, { cached: true }); cache.set(key, v); return res.status(200).json(v); }
  // v339: מפסק יומי + מגבלה לכל קורא (מחובר — לפי uid; לא מחובר — לפי כתובת, תקרה נמוכה)
  let who = 'ip:' + ip;
  if (body.idToken) { try { const u = await verifyIdToken(body.idToken, deps.verify || {}); if (u && u.uid) who = u.uid; } catch (e) {} }
  const gate = await store.allow(who, 'ctx');
  if (!gate.ok) {
    const b = await basic(text, lang);
    return res.status(200).json(Object.assign({ ok: true, quota: false, limited: gate.why }, b || { translation: '', note: '', engine: 'none' }));
  }
  const diag = {};
  // השוואה: gmodels = רשימת דגמי Gemini לבדיקה (רק עם only=gemini, עד 4, שמות תקינים)
  const gm = only === 'gemini' && Array.isArray(body.gmodels) ? body.gmodels.filter((m) => /^gemini-[a-z0-9.-]{3,40}$/.test(m)).slice(0, 4) : null;
  // v339: Gemini Flash-Lite ראשון (מדויק יותר במונחים — השוואה חיה 05/10/2026), Ministral (חינמי) גיבוי
  let gq = false, mq = false, out = null;
  if (only !== 'mistral') { out = await gemini(text, context, title, lang, diag, gm && gm.length ? gm : null); gq = !!(out && out.quota); if (gq) out = null; }
  if (!out && only !== 'gemini') { out = await mistral(text, context, title, lang, diag); mq = !!(out && out.quota); if (mq) out = null; }
  // "מכסה" רק כשכל הספקים שנוסו החזירו מכסה (בלי מפתח — לא נחשב)
  const quota = !out && (only === 'mistral' ? mq : only === 'gemini' ? gq : gq && (mq || !diag.mistralKey));
  if (!out) out = await basic(text, lang);
  if (!out) return res.status(502).json({ ok: false, error: 'translate_failed' });
  const v = Object.assign({ ok: true, quota }, out, { diag });
  if (!only && out.engine === 'ai') await store.set('ctx', sk, { translation: out.translation, note: out.note || '', wiki: out.wiki || '', engine: 'ai', provider: out.provider, model: out.model });
  cache.set(key, v);
  if (cache.size > 500) cache.clear();
  return res.status(200).json(v);
};

module.exports._prompt = prompt;
module.exports._deps = deps;
module.exports._parseGt = parseGt;
module.exports._cache = cache;
module.exports._hits = hits;
