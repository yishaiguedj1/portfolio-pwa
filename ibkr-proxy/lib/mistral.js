/* v334: Mistral — "בהקשר הזה" בכרטיס התרגום (בחירת המשתמש 05/10/2026: מכסה חינמית גדולה, ~מיליארד טוקנים בחודש).
   מפתח: MISTRAL_API_KEY במשתני הסביבה של Vercel בלבד. במסלול החינמי — לכבות "שימוש בנתונים לאימון" בחשבון.
   נשלח רק טקסט מהספר. מחזיר את אותו מבנה כמו Gemini: { translation, note, wiki, model }. */
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODELS = () => [process.env.MISTRAL_MODEL, 'mistral-medium-latest', 'mistral-small-latest'].filter((m, i, a) => m && a.indexOf(m) === i);

async function mistralJSON(sys, user, diag, opt = {}) {
  const key = process.env.MISTRAL_API_KEY;
  diag.mistralKey = !!key;                  // אבחון בלי לחשוף את המפתח
  if (!key) return { error: 'no_key' };
  let q429 = 0, tried = 0;
  for (const model of opt.models || MISTRAL_MODELS()) {
    tried++;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), opt.ms || 9000);
    try {
      const r = await (opt.fetch || fetch)(MISTRAL_URL, {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, temperature: 0.2, max_tokens: opt.maxTokens || 700, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }),
      });
      diag['mistral:' + model] = r.status;
      if (r.status === 429) { q429++; try { const e = await r.json(); diag['mistral:' + model + ':err'] = String(e.message || e.detail || JSON.stringify(e)).slice(0, 160); } catch (e) {} continue; }
      if (r.status !== 200) { try { diag['mistral:' + model + ':err'] = String(((await r.json()).message || '')).slice(0, 120); } catch (e) {} continue; }
      const j = await r.json();
      const txt = (((j.choices || [])[0] || {}).message || {}).content || '';
      const out = JSON.parse(String(txt).replace(/^```(?:json)?\s*|\s*```$/g, ''));
      if (out && typeof out === 'object') return { out, model };
    } catch (e) { diag['mistral:' + model + ':ex'] = String(e && e.message || e).slice(0, 80); } finally { clearTimeout(to); }
  }
  return { error: q429 && q429 === tried ? 'quota' : 'ai_failed' };
}
/* v338: אבחון החשבון (429 "Rate limit exceeded" כבר בבקשה הראשונה) — האם המפתח תקף, אילו מודלים זמינים, ומה המגבלות
   שהשרת מחזיר בכותרות (x-ratelimit*). בלי ערך המפתח ובלי טקסט מהספר. */
async function mistralProbe(opt = {}) {
  const key = process.env.MISTRAL_API_KEY;
  const out = { key: !!key };
  if (!key) return out;
  const f = opt.fetch || fetch;
  const hdrs = (r) => { const o = {}; try { r.headers.forEach((v, k) => { if (/ratelimit|retry-after/i.test(k)) o[k] = String(v).slice(0, 40); }); } catch (e) {} return o; };
  try {
    const r = await f('https://api.mistral.ai/v1/models', { headers: { Authorization: 'Bearer ' + key } });
    out.models = r.status;
    if (r.status === 200) { const j = await r.json(); const ids = ((j && j.data) || []).map((m) => m.id); out.modelCount = ids.length; out.sample = ids.filter((x) => /latest$/.test(x)).slice(0, 12); }
    else { try { out.modelsErr = String((await r.json()).message || '').slice(0, 160); } catch (e) {} }
  } catch (e) { out.modelsEx = String(e && e.message || e).slice(0, 80); }
  out.chat = {};
  for (const model of opt.models || ['mistral-small-latest', 'ministral-8b-latest', 'open-mistral-nemo']) {
    try {
      const r = await f(MISTRAL_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: 'user', content: 'Say OK' }] }) });
      const row = { status: r.status, h: hdrs(r) };
      if (r.status !== 200) { try { const e = await r.json(); row.err = String(e.message || e.detail || JSON.stringify(e)).slice(0, 200); } catch (e) {} }
      out.chat[model] = row;
    } catch (e) { out.chat[model] = { ex: String(e && e.message || e).slice(0, 80) }; }
  }
  return out;
}
module.exports = { mistralJSON, MISTRAL_MODELS, mistralProbe };
