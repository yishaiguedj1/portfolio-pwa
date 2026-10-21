// 21/10/2026 (צילום המשתמש: "מוציאים את הקול ושולחים אותו קודם" — 17 דק׳, והסרטון המלא עלה אחר כך בדקה וחצי):
// uploadBoth (studionet.js) — הסרטון עולה במקביל לחילוץ, הקול עולה ראשון כשהוא מוכן (הסרטון ממתין), וסרטון שסיים לפני
// החילוץ עוצר אותו. הרצה: node tests/studio-upload-both.test.js
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const N = await import(path.join(__dirname, '..', 'studionet.js'));
  // העלאה מדומה: חתיכות של 10ms, ובין חתיכה לחתיכה — gate (כמו net.upload)
  const fakeUp = (name, chunks, log, gate, signal) => (async () => {
    for (let i = 0; i < chunks; i++) {
      if (gate) await gate();
      if (signal && signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      log.push(name + i);
      await wait(10);
    }
    return { id: name, size: chunks };
  })();
  const run = (o) => {
    const log = [], ev = [];
    const ctl = new AbortController();
    const p = N.uploadBoth(Object.assign({
      signal: ctl.signal, needAudio: true, needVideo: true, pauseMs: 5,
      onPhase: (ph) => ev.push('ph:' + ph),
      extract: (signal) => new Promise((res, rej) => {
        const t = setTimeout(() => (o.exFail ? res({ none: 'codec' }) : res({ blob: { size: 1 }, ext: 'm4a' })), o.exMs);
        signal.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
      }),
      upAudio: () => fakeUp('a', o.aChunks || 3, log, null, ctl.signal),
      upVideo: (gate) => fakeUp('v', o.vChunks, log, gate, ctl.signal),
      audioDone: async () => { ev.push('audioDone'); },
      noAudio: (why, vf) => ev.push('noAudio:' + why + ':' + vf),
      start: async () => { ev.push('start'); },
      videoDone: async () => { ev.push('videoDone'); },
    }, o.over || {}));
    return { p, log, ev, ctl };
  };

  // 1. רשת איטית, חילוץ מהיר: הקול עולה ראשון, והסרטון לא שולח חתיכות בזמן שהקול עולה
  {
    const r = run({ exMs: 15, vChunks: 12 });
    await r.p;
    const ia = r.log.indexOf('a0'), ja = r.log.indexOf('a2');
    const vDuring = r.log.slice(ia, ja + 1).filter((x) => x[0] === 'v');
    ok(ia > 0 && vDuring.length === 0, 'הסרטון התחיל לפני הקול, ונעצר בזמן שהקול עולה');
    ok(r.ev.join() === 'ph:extract,ph:audio,audioDone,start,ph:video,videoDone', 'הסדר: חילוץ → קול → התחלה → סרטון: ' + r.ev.join());
    ok(r.log.filter((x) => x[0] === 'v').length === 12, 'הסרטון עלה כולו (לא התחיל מחדש)');
  }
  // 2. חילוץ איטי, רשת מהירה: הסרטון מסיים לפני החילוץ → החילוץ נעצר, מתחילים מהסרטון
  {
    const r = run({ exMs: 2000, vChunks: 3 });
    const t0 = Date.now();
    await r.p;
    ok(Date.now() - t0 < 500, 'לא מחכים לחילוץ האיטי (' + (Date.now() - t0) + 'ms)');
    ok(r.ev.includes('noAudio:video_first:true') && !r.ev.includes('audioDone') && r.ev.includes('videoDone'), 'video_first: בלי קול, הסרטון רשום: ' + r.ev.join());
  }
  // 3. החילוץ נכשל (קודק) — הסרטון ממשיך כרגיל
  {
    const r = run({ exMs: 10, exFail: true, vChunks: 4 });
    await r.p;
    ok(r.ev.includes('noAudio:codec:false') && r.ev.includes('videoDone'), 'קודק שאי אפשר להעתיק — מהסרטון');
  }
  // 4. ביטול — נזרק AbortError, בלי רישום
  {
    const r = run({ exMs: 500, vChunks: 100 });
    setTimeout(() => r.ctl.abort(), 30);
    let err = null;
    try { await r.p; } catch (e) { err = e; }
    ok(err && err.name === 'AbortError' && !r.ev.includes('videoDone') && !r.ev.includes('audioDone'), 'ביטול — עוצר הכל');
  }
  // 5. "המשך" כשהקול כבר עלה — רק הסרטון
  {
    const r = run({ exMs: 10, vChunks: 2, over: { needAudio: false } });
    await r.p;
    ok(r.ev.join() === 'start,ph:video,videoDone' && !r.log.some((x) => x[0] === 'a'), 'רק הסרטון: ' + r.ev.join());
  }
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
