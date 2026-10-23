// פענוח Dolby בדפדפן לסרטון בלי עותק Opus (22/10/2026)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const P = await import('../studioplay.js');
  // מתי צריך לפענח בעצמנו
  ok(P.needAudioBridge('eac3', () => false) && P.needAudioBridge('ac3', () => false), 'Dolby שלא נתמך — מפענחים');
  ok(!P.needAudioBridge('eac3', () => true), 'הדפדפן מנגן Dolby — לא נוגעים');
  ok(!P.needAudioBridge('aac', () => false) && !P.needAudioBridge('dts', () => false), 'רק AC-3/E-AC-3');
  // התזמון לפי העוגן
  const A = { c: 10, v: 5, lat: 0.1 };
  let w = P.abWhen(A, 6, 1, 10); ok(Math.abs(w.when - 10.9) < 1e-9 && w.off === 0, 'קטע עתידי: עוגן + הפרש − עיכוב הפלט');
  w = P.abWhen(A, 5, 1, 10); ok(w.when === 10 && Math.abs(w.off - 0.1) < 1e-9, 'קטע שעברנו — מתחילים מהיסט');
  w = P.abWhen(A, 7, 2, 0); ok(Math.abs(w.when - 10.9) < 1e-9, 'מהירות 2 — הזמן בסרטון מתקצר');

  // מנוע עם וידאו, AudioContext ו־sink מדומים
  class V extends EventTarget { constructor() { super(); this.paused = true; this.currentTime = 0; this.playbackRate = 1; this.volume = 1; this.muted = false; this.seeking = false; this.ended = false; } }
  const mkCtx = () => {
    const c = { currentTime: 100, outputLatency: 0.05, state: 'running', started: [], stopped: 0, closed: false,
      destination: {}, createGain: () => ({ gain: { value: 1 }, connect() {} }),
      createBufferSource: () => { const n = { playbackRate: { value: 1 }, connect() {}, disconnect() {}, start(a, b) { c.started.push([a, b, n.buffer.ts, n.playbackRate.value]); }, stop() { c.stopped++; } }; return n; },
      resume: async () => {}, close() { c.closed = true; } };
    return c;
  };
  const sink = { buffers: async function* (s) { for (let t = Math.floor(s * 10) / 10; t < 60; t += 0.1) yield { buffer: { duration: 0.1, ts: t }, timestamp: t }; } };
  const tick = () => new Promise((r) => setTimeout(r, 5));
  const v = new V(); let ctx = null;
  const br = P.createAudioBridge(v, async () => sink, () => (ctx = mkCtx()), { sleep: tick });
  ok(br.state().ctx === false, 'בלי ניגון — בלי AudioContext');
  v.paused = false; v.currentTime = 3; v.dispatchEvent(new Event('playing')); await tick(); await tick(); await tick();
  ok(ctx && ctx.started.length >= 20 && ctx.started.length <= 22, 'מתזמנים כ־2 שניות מראש (' + (ctx && ctx.started.length) + ')');
  ok(Math.abs(ctx.started[1][2] - 3) < 0.11 && Math.abs(ctx.started[1][0] - (100 + (ctx.started[1][2] - 3) - 0.05)) < 1e-6 || ctx.started[1][0] === 100, 'הקטע הראשון לפי הזמן בסרטון');
  ok(ctx.started.every((s) => s[2] + 0.1 > 3), 'לא מנגנים קטעים שכבר עברו');
  v.paused = true; v.dispatchEvent(new Event('pause'));
  ok(ctx.stopped >= 20 && br.state().nodes === 0 && !br.state().on, 'עצירה עוצרת את כל מה שתוזמן');
  ctx.started.length = 0; v.paused = false; v.currentTime = 30; v.playbackRate = 1.5; v.dispatchEvent(new Event('ratechange')); await tick(); await tick();
  ok(ctx.started.length > 0 && Math.abs(ctx.started[0][2] - 30) < 0.11 && ctx.started[0][3] === 1.5, 'קפיצה/מהירות — מתחילים מהמקום החדש במהירות החדשה');
  v.muted = true; v.dispatchEvent(new Event('volumechange'));
  br.destroy();
  ok(ctx.closed && br.state().nodes === 0, 'סגירת הנגן סוגרת את הקול');

  // החיבור בנגן ובמה שמוטמע
  const sp = R('studioplay.js');
  ok(/mode !== 'file'/.test(sp) && /audioFix/.test(sp) && /bridge\.destroy\(\)/.test(sp), 'רק במצב קובץ, ונסגר ב־destroy');
  ok(/import\('\.\/vendor\/mediabunny\/mediabunny-ac3\.min\.mjs'\)/.test(sp), 'הפענוח נטען רק כשצריך');
  const ac3 = R('vendor/mediabunny/mediabunny-ac3.min.mjs');
  ok(!/from"mediabunny"/.test(ac3) && /from"\.\/mediabunny\.min\.mjs"/.test(ac3), 'אותו מופע של mediabunny (registerAc3Decoder באותו מודול)');
  ok(/function s\(\)\{return Promise\.resolve\(new Worker\(new URL\('\.\/ac3-worker\.js',import\.meta\.url\)\)\)\}/.test(ac3) && !/[^\w$.]c\(`/.test(ac3) && !/\$\{/.test(ac3.slice(0, 50)), 'Worker מקובץ קבוע — לא blob (CSP)');
  const ver = R('vendor/mediabunny/VERSION');
  for (const f of ['mediabunny-ac3.min.mjs', 'ac3-worker.js']) ok(ver.includes(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', 'vendor/mediabunny', f))).digest('hex')), f + ' = הגרסה שנבדקה (sha256 ב־VERSION)');
  ok(!/ac3-worker|mediabunny-ac3/.test((R('sw.js').match(/STUDIO_SHELL[\s\S]*?\]/) || [''])[0]), 'לא במעטפת');
  console.log(`studio-dolby: ${pass} עברו, ${fail} נכשלו`);
  process.exit(fail ? 1 : 0);
})();
