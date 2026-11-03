/* Academy Pro גל 5 (03/11/2026): AI על ספר — X-Ray, "שאל את הספר", תיוג ותקציר, תרגום דו־לשוני.
   op:'bookAi' ב־/api/library, לכל משתמש מחובר (ספרים פרטיים — לא תלוי ברשימת הקוראים).
   מנוע: Gemini Flash-Lite (רמת החינם — כמו התרגום בהקשר), Mistral גיבוי. בלי מפתח / מכסה → שגיאה מסודרת, האפליקציה מסבירה.
   חיסכון (lib/aicache.js): תשובה נשמרת לפי hash של הקלט (בלי הטקסט עצמו — רק התשובה), אותה שאלה על אותו ספר לא נשלחת פעמיים;
   כל בקשה נספרת במכסה היומית של המשתמש ובתקרה הכללית. הטקסט מגיע מהטלפון (הספר נשאר אצל המשתמש), ולא נשמר בשום מקום. */
const { TRANSLATE_MODELS, badScript } = require('./gmodels');
const { mistralJSON } = require('./mistral');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const LANGS = { he: 'Hebrew', en: 'English', ar: 'Arabic', ru: 'Russian', fr: 'French', es: 'Spanish', de: 'German' };
const LIM = { xray: 120000, ask: 14000, tagsum: 14000, bilingual: 9000 };
const s = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').slice(0, max);
const one = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

/* הקלט המנורמל לכל משימה (טהורה) — גם מפתח המטמון נבנה ממנו. null = קלט לא תקין */
function input(task, b) {
  const lang = LANGS[b.lang] ? b.lang : 'he';
  const title = one(b.title, 160), author = one(b.author, 120);
  if (task === 'xray') { const text = s(b.text, LIM.xray); return text.trim().length >= 200 ? { lang, title, author, text } : null; }
  if (task === 'ask') {
    const q = one(b.q, 300);
    const passages = (Array.isArray(b.passages) ? b.passages : []).slice(0, 14).map((p, i) => ({ i: i + 1, t: one(p && p.t, 1400), ch: one(p && p.ch, 80) })).filter((p) => p.t);
    let tot = 0; const ps = passages.filter((p) => (tot += p.t.length) <= LIM.ask);
    return q.length >= 2 && ps.length ? { lang, title, author, q, passages: ps } : null;
  }
  if (task === 'tagsum') { const text = s(b.text, LIM.tagsum); return (text.trim().length >= 200 || one(b.desc, 10)) ? { lang, title, author, desc: one(b.desc, 1500), text } : null; }
  if (task === 'bilingual') {
    const paras = (Array.isArray(b.paras) ? b.paras : []).slice(0, 40).map((p) => one(p, 1500));
    let tot = 0; const ps = []; for (const p of paras) { if ((tot += p.length) > LIM.bilingual) break; ps.push(p); }
    return ps.length && ps.some(Boolean) ? { lang, title, paras: ps } : null;
  }
  return null;
}
function cacheParts(task, x) {
  if (task === 'xray') return [x.lang, x.title, x.text];
  if (task === 'ask') return [x.lang, x.title, x.q, x.passages.map((p) => p.t).join('\u0002')];
  if (task === 'tagsum') return [x.lang, x.title, x.author, x.desc, x.text];
  return [x.lang, x.paras.join('\u0002')];
}

/* ההנחיות (טהורות) — JSON בלבד, בשפת היעד, בלי להמציא */
function prompt(task, x) {
  const L = LANGS[x.lang];
  const book = 'BOOK: ' + (x.title || '-') + (x.author ? ' by ' + x.author : '');
  if (task === 'xray') return {
    sys: 'You build an "X-Ray" index for a reader of the book below (only the part the reader has read so far — never reveal later events). ' +
      'List up to 40 of the most important named people/characters, places, organizations, publicly traded companies and key terms that appear in the TEXT. ' +
      'For each give: "name" exactly as written in the text (the most common form), "kind" (person|place|org|company|term), "desc" one short sentence in ' + L +
      ' about who/what it is IN THIS BOOK based only on the text, "aliases" other spellings used in the text (max 3), and for a publicly traded company its stock "ticker" (else empty). ' +
      'Do not invent anything that is not supported by the text. Reply only with JSON {"items":[...]}.',
    user: book + '\nTEXT:\n' + x.text,
    schema: { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, kind: { type: 'STRING' }, desc: { type: 'STRING' }, aliases: { type: 'ARRAY', items: { type: 'STRING' } }, ticker: { type: 'STRING' } }, required: ['name', 'kind', 'desc'] } } }, required: ['items'] },
    maxOut: 6000,
  };
  if (task === 'ask') return {
    sys: 'Answer the reader\'s QUESTION about the book using ONLY the numbered PASSAGES from it. Write in ' + L + ', 1-5 sentences. ' +
      'Cite the passages you used as [n]. If the passages do not contain the answer, say so plainly and set "found" to false — never guess. ' +
      'Reply only with JSON {"answer": string, "cites": [numbers], "found": boolean}.',
    user: book + '\nQUESTION: ' + x.q + '\nPASSAGES:\n' + x.passages.map((p) => '[' + p.i + ']' + (p.ch ? ' (' + p.ch + ')' : '') + ' ' + p.t).join('\n'),
    schema: { type: 'OBJECT', properties: { answer: { type: 'STRING' }, cites: { type: 'ARRAY', items: { type: 'INTEGER' } }, found: { type: 'BOOLEAN' } }, required: ['answer', 'found'] },
    maxOut: 1500,
  };
  if (task === 'tagsum') return {
    sys: 'You catalogue a book for a personal library. From the DESCRIPTION and the opening TEXT, write in ' + L + ': "summary" (2-3 sentences, what the book is about, no spoilers), ' +
      '"tags" (3-6 short subject tags, one or two words each, like a librarian would use), and "genre" (one or two words). Base everything on the given text only. ' +
      'Reply only with JSON {"summary": string, "tags": [strings], "genre": string}.',
    user: book + '\nDESCRIPTION: ' + (x.desc || '-') + '\nTEXT:\n' + x.text,
    schema: { type: 'OBJECT', properties: { summary: { type: 'STRING' }, tags: { type: 'ARRAY', items: { type: 'STRING' } }, genre: { type: 'STRING' } }, required: ['summary', 'tags'] },
    maxOut: 1200,
  };
  return {
    sys: 'Translate each paragraph of the list into ' + L + ' faithfully, keeping the author\'s tone, names and numbers. Write only in the script of ' + L + '. ' +
      'Return exactly one translation per input paragraph, in the same order (an empty paragraph stays empty). Reply only with JSON {"out": [strings]}.',
    user: book + '\nPARAGRAPHS (JSON): ' + JSON.stringify(x.paras),
    schema: { type: 'OBJECT', properties: { out: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['out'] },
    maxOut: 8000,
  };
}

/* ניקוי התשובה (טהורה) — רק השדות והאורכים שהאפליקציה מצפה להם */
const KINDS = new Set(['person', 'place', 'org', 'company', 'term']);
function shape(task, x, o) {
  if (!o || typeof o !== 'object') return null;
  if (task === 'xray') {
    const seen = new Set();
    const items = (Array.isArray(o.items) ? o.items : []).map((it) => ({
      name: one(it && it.name, 80), kind: KINDS.has(it && it.kind) ? it.kind : 'term', desc: one(it && it.desc, 300),
      aliases: (Array.isArray(it && it.aliases) ? it.aliases : []).map((a) => one(a, 80)).filter(Boolean).slice(0, 3),
      ticker: /^[A-Z][A-Z0-9.\-]{0,9}$/.test(one(it && it.ticker, 12).toUpperCase()) && (it.kind === 'company') ? one(it.ticker, 12).toUpperCase() : '',
    })).filter((it) => it.name && !seen.has(it.name.toLowerCase()) && seen.add(it.name.toLowerCase()) && x.text.includes(it.name)).slice(0, 40);
    return items.length ? { items } : null;
  }
  if (task === 'ask') {
    const answer = one(o.answer, 1500); if (!answer) return null;
    const max = x.passages.length;
    return { answer, found: o.found !== false, cites: [...new Set((Array.isArray(o.cites) ? o.cites : []).map((n) => +n).filter((n) => n >= 1 && n <= max))].slice(0, 8) };
  }
  if (task === 'tagsum') {
    const summary = one(o.summary, 700); if (!summary) return null;
    return { summary, genre: one(o.genre, 40), tags: [...new Set((Array.isArray(o.tags) ? o.tags : []).map((t) => one(t, 30).replace(/[,;]/g, ' ').trim()).filter(Boolean))].slice(0, 6) };
  }
  const out = Array.isArray(o.out) ? o.out.map((t) => one(t, 3000)) : [];
  if (out.length !== x.paras.length || !out.some(Boolean)) return null;
  return { out };
}
function scriptOk(task, x, v) {   // תשובה בכתב מעורב (אותיות ערביות בעברית וכו') — פסולה, כמו בתרגום בהקשר
  const t = task === 'xray' ? v.items.map((i) => i.desc).join(' ') : task === 'ask' ? v.answer : task === 'tagsum' ? v.summary + ' ' + v.tags.join(' ') : v.out.join(' ');
  return !badScript(t, x.lang);
}

async function gemini(task, x, diag, deps) {
  const key = process.env.GEMINI_API_KEY; diag.key = !!key;
  if (!key) return null;
  const P = prompt(task, x);
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: P.sys }] }, contents: [{ role: 'user', parts: [{ text: P.user }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: P.maxOut + 2048, responseMimeType: 'application/json', responseSchema: P.schema } });
  let q429 = 0, tried = 0;
  const t0 = Date.now();
  for (const model of (deps.models || TRANSLATE_MODELS())) {
    if (Date.now() - t0 > 30000) break;               // הפונקציה מוגבלת ל־60 שניות; משאירים זמן לגיבוי
    tried++;
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), task === 'xray' || task === 'bilingual' ? 26000 : 14000);
    try {
      const r = await (deps.fetch || fetch)(GEMINI_URL + encodeURIComponent(model) + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body, signal: ctl.signal });
      diag[model] = r.status;
      if (r.status === 429) { q429++; continue; }
      if (r.status !== 200) continue;
      const j = await r.json();
      const um = j.usageMetadata || {}; diag[model + ':tok'] = [um.promptTokenCount || 0, um.candidatesTokenCount || 0, um.thoughtsTokenCount || 0];
      const txt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text || '').join('');
      const v = shape(task, x, JSON.parse(txt));
      if (v && scriptOk(task, x, v)) return Object.assign(v, { provider: 'gemini', model });
      diag[model + ':err'] = v ? 'mixed_script' : 'bad_json';
    } catch (e) { diag[model + ':err'] = e && e.name === 'AbortError' ? 'timeout' : 'exception'; } finally { clearTimeout(to); }
  }
  return q429 && q429 === tried ? { quota: true } : null;
}
async function mistral(task, x, diag, deps) {
  if (task === 'xray' && x.text.length > 60000) x = Object.assign({}, x, { text: x.text.slice(0, 60000) });   // חלון קטן יותר
  const P = prompt(task, x);
  const r = await mistralJSON(P.sys, P.user, diag, { maxTokens: P.maxOut, ms: 20000, fetch: deps.fetch });
  if (!r.out) return r.error === 'quota' ? { quota: true } : null;
  const v = shape(task, x, r.out);
  return v && scriptOk(task, x, v) ? Object.assign(v, { provider: 'mistral', model: r.model }) : null;
}

/* הבקשה: { task, ... } → { ok, ...תשובה, cached? } או { ok:false, error } */
async function run(body, uid, store, deps = {}) {
  const task = String(body.task || '');
  if (!LIM[task]) return { status: 400, j: { ok: false, error: 'bad_task' } };
  const x = input(task, body);
  if (!x) return { status: 400, j: { ok: false, error: 'bad_params' } };
  const parts = cacheParts(task, x);
  const hit = await store.get('book_' + task, parts);
  if (hit) return { status: 200, j: Object.assign({ ok: true, cached: true }, hit) };
  const gate = await store.allow(uid, 'book');
  if (!gate.ok) return { status: 429, j: { ok: false, error: 'limit', why: gate.why } };
  const diag = {};
  let out = await gemini(task, x, diag, deps), quota = !!(out && out.quota);
  if (!out || out.quota) { const m = await mistral(task, x, diag, deps); out = m && !m.quota ? m : null; quota = quota && (!m || !!m.quota || !diag.mistralKey); }
  if (!out) return { status: 502, j: { ok: false, error: quota ? 'quota' : diag.key === false && !diag.mistralKey ? 'no_key' : 'ai_failed' } };
  const v = Object.assign({}, out); delete v.quota;
  await store.set('book_' + task, parts, v);
  return { status: 200, j: Object.assign({ ok: true }, v) };
}

module.exports = { run, input, prompt, shape, cacheParts, LIM };
