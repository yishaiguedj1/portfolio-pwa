/* epubkit.js — עבודה עם קבצי ספרים בדפדפן, בלי תלויות (ES module). מחקר 06, גרסה מאומתת 11/10/2026.
   נבדק ב־node 22 (עם xmldom לבדיקות) וב־Chromium תחת ה־CSP המדויק של האפליקציה; כל קובץ שהמודול כותב עובר epubcheck 5.3.0.
   מה יש כאן:
   1. ZIP: קריאת התיקייה המרכזית מתוך Blob (בלי לטעון את הקובץ לזיכרון), פריסת רשומה עם תקרה, בדיקת גודל ו־CRC.
   2. כתיבה מחדש "לפי ת־קורא" (do_replace): רק מה שהשתנה נדחס מחדש, כל השאר מועתק כבייטים דחוסים (Blob.slice — הפניה,
      בלי זיכרון ובלי משימות ארוכות). mimetype תמיד ראשון, לא דחוס, בלי extra field ובלי data descriptor;
      שם קובץ בעברית מקבל את דגל UTF-8 (בלעדיו ה־zip.js של foliate מפענח CP437 והספר לא נפתח בכלל).
   3. זיהוי סוג לפי חתימה + epubcheck-lite: פצצות zip, רשומות חופפות, DRM, מבנה OCF/OPF, ומה שכתיבה מחדש מתקנת (repair).
   4. OPF: קריאה וכתיבה של פרטים (EPUB 2 + 3) — בלי לגעת במזהה הייחודי, ב־spine ובמבנה קבצי התוכן (ה־CFI של ההדגשות נשמר).
   5. MOBI/AZW3 ו־FB2: מה ש־foliate לא נותן (מזהה יציב, ISBN, DRM; סדרה וכריכה של FB2 — הכריכה של foliate נחסמת ב־CSP).
   6. גיבוב: SHA-256 (WebCrypto), MD5 מצטבר (ETag של R2 / md5Checksum של Drive), טביעת תוכן בלי פרטים, MinHash.
   7. תמונות וכריכות (דפדפן בלבד): מידות מהכותרת (הגנה מפצצת פיקסלים), הקטנה, ממוזערת WebP, כריכה טיפוגרפית 2:3.
   רק API של DOM Level 2 (getElementsByTagNameNS, childNodes…) — כך אותו קוד רץ גם ב־node עם xmldom.
   לא משתמשים כאן ב־Worker מ־blob:, ב־WASM או ב־fetch ל־blob:/data: — ה־CSP של האפליקציה חוסם את שלושתם (נבדק). */

export class EpubError extends Error {
  constructor(code, info) { super(code); this.code = code; this.info = info; }
}
const fail = (code, info) => { throw new EpubError(code, info); };

/* ---------------- 1. בסיס: CRC32, זמן DOS, UTF-8, עזרים ---------------- */
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(u8, crc = 0) {               // אפשר להמשיך חישוב: crc32(b, crc32(a))
  crc = ~crc;
  for (let i = 0; i < u8.length; i++) crc = CRC_T[(crc ^ u8[i]) & 255] ^ (crc >>> 8);
  return ~crc >>> 0;
}
function dosTime(d = new Date()) {
  const y = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}
const enc = new TextEncoder();
const UTF8 = new TextDecoder('utf-8'), UTF8_STRICT = new TextDecoder('utf-8', { fatal: true });
const u8of = async (blob) => new Uint8Array(await blob.arrayBuffer());
const dv = (u8) => new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
const hasHigh = (u8) => u8.some((b) => b > 0x7f);
export const isUtf8 = (u8) => { try { UTF8_STRICT.decode(u8); return true; } catch (e) { return false; } };
const yieldNow = () => (globalThis.scheduler && scheduler.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0)));
const pacer = (budget = 10) => { let t = performance.now(); return async () => { if (performance.now() - t > budget) { await yieldNow(); t = performance.now(); } }; };   // ויתור כל ~10ms עבודה

/* ---------------- 2. קריאת ZIP מתוך Blob ---------------- */
const SIG_LFH = 0x04034b50, SIG_CEN = 0x02014b50, SIG_EOCD = 0x06054b50;
const F_ENC = 0x0001, F_DD = 0x0008, F_UTF8 = 0x0800;

export async function readZip(blob, { maxEntries = 10000 } = {}) {
  const size = blob.size;
  if (size < 22) fail('not_zip');
  const tailLen = Math.min(size, 22 + 0xffff);              // ה־EOCD בסוף, אחרי הערה של עד 64KB
  const tail = dv(await u8of(blob.slice(size - tailLen)));
  let p = -1;
  for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === SIG_EOCD && i + 22 + tail.getUint16(i + 20, true) <= tailLen) { p = i; break; }
  if (p < 0) fail('no_eocd');
  const count = tail.getUint16(p + 10, true), cdSize = tail.getUint32(p + 12, true), cdOff = tail.getUint32(p + 16, true);
  if (tail.getUint16(p + 4, true) || tail.getUint16(p + 6, true)) fail('multidisk');
  if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) fail('zip64');   // לא צפוי בספר; לא עורכים
  if (count > maxEntries) fail('too_many_entries', { count });
  const eocdOff = size - tailLen + p;
  if (cdOff + cdSize > eocdOff) fail('bad_cd');
  const cdU8 = await u8of(blob.slice(cdOff, cdOff + cdSize)), cd = dv(cdU8), entries = [], pace = pacer();
  let q = 0;
  for (let i = 0; i < count; i++) {
    if ((i & 255) === 255) await pace();                // אלפי רשומות (קומיקס) — בלי משימה ארוכה
    if (q + 46 > cdSize || cd.getUint32(q, true) !== SIG_CEN) fail('bad_cd');
    const n = cd.getUint16(q + 28, true), x = cd.getUint16(q + 30, true), c = cd.getUint16(q + 32, true);
    if (q + 46 + n + x + c > cdSize) fail('bad_cd');
    const nameBytes = cdU8.slice(q + 46, q + 46 + n);
    const e = {
      name: UTF8.decode(nameBytes), nameBytes, hi: hasHigh(nameBytes),
      vmade: cd.getUint16(q + 4, true), vneed: cd.getUint16(q + 6, true), flags: cd.getUint16(q + 8, true),
      method: cd.getUint16(q + 10, true), time: cd.getUint16(q + 12, true), date: cd.getUint16(q + 14, true),
      crc: cd.getUint32(q + 16, true), csize: cd.getUint32(q + 20, true), usize: cd.getUint32(q + 24, true),
      iattr: cd.getUint16(q + 36, true), eattr: cd.getUint32(q + 38, true), lho: cd.getUint32(q + 42, true),
    };
    e.nameUtf8 = !e.hi || isUtf8(nameBytes);            // EPUB מחייב UTF-8; שם לא תקין = כנראה CP437 ישן
    if (e.csize === 0xffffffff || e.usize === 0xffffffff || e.lho === 0xffffffff) fail('zip64', { name: e.name });   // גדלים ב־extra של ZIP64
    entries.push(e);
    q += 46 + n + x + c;
  }
  return { size, entries, byName: new Map(entries.map((e) => [e.name, e])), cdOff, cdSize, eocdOff };
}

/* הכותרת המקומית של רשומה: איפה הנתונים הדחוסים מתחילים. השם המקומי חייב להיות זהה לשם במרכז (Fifield: אי־התאמה = סימן לקובץ זדוני) */
function setRange(blob, e, h, o) {                  // h = חוצץ שמכיל את הכותרת המקומית בהיסט o
  if (o < 0 || o + 30 > h.length || dv(h).getUint32(o, true) !== SIG_LFH) fail('bad_lfh', { name: e.name });
  const v = dv(h), n = v.getUint16(o + 26, true), x = v.getUint16(o + 28, true);
  if (n !== e.nameBytes.length || o + 30 + n > h.length || h.subarray(o + 30, o + 30 + n).some((b, i) => b !== e.nameBytes[i])) fail('lfh_mismatch', { name: e.name });
  const start = e.lho + 30 + n + x;
  if (start + e.csize > blob.size) fail('bad_range', { name: e.name });
  e._lfh = h.slice(o, o + 30 + n);                  // הכותרת המקורית — להעתקת רצפים שלמים בכתיבה מחדש
  return (e._range = { start, end: start + e.csize, lfhExtra: x, lfhMethod: v.getUint16(o + 8, true) });
}
export async function entryRange(blob, e) {
  return e._range || setRange(blob, e, await u8of(blob.slice(e.lho, e.lho + 30 + e.nameBytes.length)), 0);
}

/* כל הכותרות המקומיות בחלונות של 256KB (כמה כותרות בקריאה אחת), 8 חלונות במקביל.
   קריאה + Blob.slice לכל רשומה בנפרד: ספר עם 3,000 רשומות נכתב ב־3.7 שנ׳ (×4: ‏24 שנ׳); עם חלונות ורצפים — 0.07 שנ׳ (נמדד) */
export async function prefetchRanges(blob, entries, { win = 256 << 10, conc = 8 } = {}) {
  const todo = entries.filter((e) => !e._range).sort((a, b) => a.lho - b.lho), wins = [];
  for (let i = 0; i < todo.length;) {
    const s0 = todo[i].lho; let j = i + 1;
    while (j < todo.length && todo[j].lho + 30 + todo[j].nameBytes.length - s0 <= win) j++;
    wins.push(todo.slice(i, j)); i = j;
  }
  let k = 0;
  const run = async () => {
    while (k < wins.length) {
      const w = wins[k++], s0 = w[0].lho, last = w[w.length - 1];
      const h = await u8of(blob.slice(s0, last.lho + 30 + last.nameBytes.length));
      for (const e of w) setRange(blob, e, h, e.lho - s0);
    }
  };
  await Promise.all(Array.from({ length: Math.min(conc, wins.length) }, run));
}

/* פריסת רשומה לזיכרון — עם תקרה, בדיקה שהגודל בפועל = המוצהר (פצצות שמשקרות בגודל) ובדיקת CRC.
   DecompressionStream מקורי: בלי WASM ובלי Worker, ובלי משימות ארוכות (נמדד) */
export async function readEntry(blob, e, { max = 32 << 20, checkCrc = true } = {}) {
  if (e.flags & F_ENC) fail('zip_encrypted', { name: e.name });
  if (e.usize > max) fail('entry_too_big', { name: e.name, usize: e.usize });
  const { start, end } = await entryRange(blob, e);
  let out;
  if (e.method === 0) {
    if (e.csize !== e.usize) fail('size_mismatch', { name: e.name });
    out = await u8of(blob.slice(start, end));
  } else if (e.method === 8) {
    const reader = blob.slice(start, end).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const parts = []; let n = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        n += value.length;
        if (n > e.usize) { reader.cancel().catch(() => {}); fail('size_mismatch', { name: e.name }); }
        parts.push(value);
      }
    } catch (x) { if (x instanceof EpubError) throw x; fail('bad_deflate', { name: e.name }); }
    if (n !== e.usize) fail('size_mismatch', { name: e.name });
    out = new Uint8Array(n); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
  } else fail('bad_method', { name: e.name, method: e.method });
  if (checkCrc && crc32(out) !== e.crc) fail('bad_crc', { name: e.name });
  return out;
}
export const readText = async (blob, e, max = 4 << 20) => UTF8.decode(await readEntry(blob, e, { max }));

export async function deflateRaw(u8) {           // CompressionStream מקורי (Chrome 103+, Safari 16.4+). 8MB טקסט: 28ms, בלי משימה ארוכה (נמדד)
  const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/* ---------------- 3. כתיבה מחדש עם העתקה גולמית ----------------
   put: Map(שם → Uint8Array|Blob) — החלפה או הוספה; del: Set(שם). הסדר המקורי נשמר; חדשים בסוף.
   התוצאה: Blob שרוב הבייטים שלו הם הפניות לקובץ המקורי. נמדד (Chromium, ×4 = מעבד איטי פי 4 ≈ טלפון ביניים):
   ספר 50MB — הטמעת פרטים 0.15–0.2 שנ׳ (×4: ~1.1 שנ׳), ‏+0.2MB זיכרון, אפס משימות ארוכות; 3,000 רשומות — 0.07 שנ׳ (×4: 0.24 שנ׳).
   (fflate סינכרוני שפורס ודוחס הכל: משימה אחת של 0.34 שנ׳, ×4: ‏1.5 שנ׳, ו־+100MB.) */
const STORE_EXT = /\.(jpe?g|png|gif|webp|avif|woff2?|mp3|mp4|m4a|ogg|zip)$/i;   // כבר דחוסים — נשמרים בלי דחיסה
export async function rewriteZip(blob, zip, { put = new Map(), del = new Set(), now = new Date(), merge = true } = {}) {
  let parts = [], run = null;                                  // run = רצף רשומות מקוריות שמועתק כפרוסה אחת
  const groups = [], cen = [];                                 // Blob של Blobs בקבוצות + ויתור על השרשור כל ~10ms: בלי משימה ארוכה (נמדד)
  const flushRun = () => { if (run) { parts.push(blob.slice(run.s, run.e)); run = null; } };
  let off = 0;
  const { time, date } = dosTime(now);
  const pushEntry = (h, data, dataLen, raw) => {
    const nb = h.nameBytes;
    const utf8 = hasHigh(nb) && isUtf8(nb);                                  // OCF: שמות ב־UTF-8 — מסמנים (Calibre ו־Python עושים כך)
    const flags = (h.flags & ~(F_DD | F_ENC | F_UTF8)) | (utf8 ? F_UTF8 : 0);  // בלי data descriptor (הגדלים ידועים), בלי הצפנת ZIP
    const minNeed = h.method === 8 ? 20 : 10;                                // EPUB 3.3 OCF: 10 / 20 / 45 — ערך מקורי חוקי נשמר (fflate כותב 20 גם ללא דחוס)
    const vneed = raw && (h.vneed === 10 || h.vneed === 20 || h.vneed === 45) && h.vneed >= minNeed ? h.vneed : minNeed;
    const lfh = new Uint8Array(30 + nb.length), l = dv(lfh);
    l.setUint32(0, SIG_LFH, true); l.setUint16(4, vneed, true); l.setUint16(6, flags, true); l.setUint16(8, h.method, true);
    l.setUint16(10, h.time, true); l.setUint16(12, h.date, true); l.setUint32(14, h.crc, true);
    l.setUint32(18, dataLen, true); l.setUint32(22, h.usize, true); l.setUint16(26, nb.length, true); l.setUint16(28, 0, true);
    lfh.set(nb, 30);
    const c = new Uint8Array(46 + nb.length), w = dv(c);
    w.setUint32(0, SIG_CEN, true); w.setUint16(4, h.vmade || 20, true); w.setUint16(6, vneed, true); w.setUint16(8, flags, true);
    w.setUint16(10, h.method, true); w.setUint16(12, h.time, true); w.setUint16(14, h.date, true); w.setUint32(16, h.crc, true);
    w.setUint32(20, dataLen, true); w.setUint32(24, h.usize, true); w.setUint16(28, nb.length, true);
    w.setUint16(36, h.iattr || 0, true); w.setUint32(38, h.eattr || 0, true); w.setUint32(42, off, true);
    c.set(nb, 46);
    cen.push(c);
    // Blob.slice עולה ~0.25ms (×4: ‏1ms) — 3,000 רשומות = שניות. כשהכותרת המקורית זהה לבייט למה שהיינו כותבים, מאריכים רצף אחד
    if (raw && merge && h._lfh && h._lfh.length === lfh.length && h._lfh.every((b, i) => b === lfh[i])) {
      if (run && run.e === h.lho) run.e = h._range.end; else { flushRun(); run = { s: h.lho, e: h._range.end }; }
    } else { flushRun(); parts.push(lfh, data || blob.slice(h._range.start, h._range.end)); }
    off += lfh.length + dataLen;
    if (off > 0xfffffff0) fail('too_large_for_zip32');
  };
  const writeNew = async (name, body, base) => {
    const u8 = body instanceof Uint8Array ? body : await u8of(body);
    const nameBytes = enc.encode(name);
    const store = name === 'mimetype' || STORE_EXT.test(name) || u8.length < 64;
    const data = store ? u8 : await deflateRaw(u8);
    pushEntry({ nameBytes, method: store ? 0 : 8, crc: crc32(u8), usize: u8.length, time, date,
      vmade: base ? base.vmade : 20, iattr: 0, eattr: base ? base.eattr : 0, flags: 0 }, data, data.length);
  };
  await prefetchRanges(blob, zip.entries.filter((e) => !put.has(e.name) && !del.has(e.name)));
  const pace = pacer();
  await writeNew('mimetype', enc.encode('application/epub+zip'));   // תמיד ראשון ותקין — מתקן גם קובץ שבו הוא דחוס/לא ראשון (PKG-006)
  const pending = new Map(put);
  for (const e of zip.entries) {
    if (e.name === 'mimetype' || del.has(e.name)) continue;
    if (pending.has(e.name)) { await writeNew(e.name, pending.get(e.name), e); pending.delete(e.name); continue; }
    if (e.flags & F_ENC) fail('zip_encrypted', { name: e.name });
    if (e.method !== 0 && e.method !== 8) fail('bad_method', { name: e.name });
    await entryRange(blob, e);
    pushEntry(e, null, e.csize, true);                      // העתקה גולמית: הנתונים הדחוסים כמו שהם, ה־CRC והגדלים מהתיקייה המרכזית
    if (parts.length >= 64) { groups.push(new Blob(parts)); parts = []; }
    await pace();
  }
  for (const [name, body] of pending) await writeNew(name, body, null);
  flushRun();
  if (cen.length > 0xfffe) fail('too_many_entries');
  const cdSize = cen.reduce((a, c) => a + c.length, 0), tail = new Uint8Array(cdSize + 22);   // התיקייה המרכזית + EOCD בחוצץ אחד
  let o = 0; for (const c of cen) { tail.set(c, o); o += c.length; }
  const z = dv(tail.subarray(cdSize));
  z.setUint32(0, SIG_EOCD, true); z.setUint16(8, cen.length, true); z.setUint16(10, cen.length, true);
  z.setUint32(12, cdSize, true); z.setUint32(16, off, true);
  await yieldNow();
  return new Blob([...groups, ...parts, tail], { type: 'application/epub+zip' });
}

/* ---------------- 4. זיהוי סוג לפי חתימה ---------------- */
export async function sniff(blob) {
  const h = await u8of(blob.slice(0, 1024));
  const s = (a, b) => String.fromCharCode(...h.subarray(a, b));
  if (h[0] === 0x50 && h[1] === 0x4b && h[2] === 0x03 && h[3] === 0x04) return s(30, 58) === 'mimetypeapplication/epub+zip' ? 'epub' : 'zip';
  if (s(60, 68) === 'BOOKMOBI') return 'mobi';                // MOBI / AZW / AZW3 (KF8) — foliate פותח
  if (s(60, 68) === 'TEXtREAd') return 'palmdoc';
  if (s(0, 3) === 'TPZ') return 'topaz';                      // Amazon Topaz — לא נתמך
  if (h[0] === 0xea && s(1, 7) === 'DRMION') return 'kfx-drm';  // KFX מוצפן (Calibre: \xeaDRMION\xee)
  if (s(0, 4) === 'CONT') return 'kfx';                       // מיכל KFX — לא נתמך
  if (s(0, 4) === 'Rar!') return 'rar';                       // CBR
  if (s(0, 6) === '7z\xbc\xaf\x27\x1c') return '7z';
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return 'jpeg';
  if (s(0, 8) === '\x89PNG\r\n\x1a\n') return 'png';
  if (s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') return 'webp';
  if (s(0, 6) === 'GIF87a' || s(0, 6) === 'GIF89a') return 'gif';
  if (s(0, 1024).includes('%PDF-')) return 'pdf';              // מותר זבל לפני הכותרת (עד 1KB)
  let txt;                                                      // טקסט: BOM של UTF-8 / UTF-16
  if (h[0] === 0xef && h[1] === 0xbb && h[2] === 0xbf) txt = UTF8.decode(h.subarray(3));
  else if (h[0] === 0xff && h[1] === 0xfe) txt = new TextDecoder('utf-16le').decode(h.subarray(2));
  else if (h[0] === 0xfe && h[1] === 0xff) txt = new TextDecoder('utf-16be').decode(h.subarray(2));
  else txt = UTF8.decode(h);
  if (/<FictionBook[\s>]/.test(txt)) return 'fb2';
  if (/^\s*<\?xml/.test(txt)) return 'xml';
  if (/^\s*<(!doctype html|html)/i.test(txt)) return 'html';
  return 'unknown';
}
/* קובץ ZIP: מה הוא באמת (לפי רשימת הקבצים, בלי לפרוס) */
export function zipKind(zip) {
  if (zip.byName.has('META-INF/container.xml')) return 'epub';
  const files = zip.entries.map((e) => e.name).filter((n) => !n.endsWith('/'));
  if (zip.byName.has('[Content_Types].xml')) return files.some((n) => n.startsWith('word/')) ? 'docx' : 'ooxml';
  if (files.some((n) => /\.fb2$/i.test(n))) return 'fbz';
  if (files.length && files.every((n) => /\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(n) || /(^|\/)(comicinfo\.xml|thumbs\.db|\.ds_store)$/i.test(n))) return 'cbz';
  return 'zip';
}
export async function classify(blob) {           // הסוג לפי התוכן, לא לפי הסיומת
  const k = await sniff(blob);
  if (k !== 'zip' && k !== 'epub') return k;
  try { return zipKind(await readZip(blob)); } catch (e) { return 'bad_zip'; }
}

/* ---------------- 5. epubcheck-lite ---------------- */
const NS = {
  OPF: 'http://www.idpf.org/2007/opf', DC: 'http://purl.org/dc/elements/1.1/', CON: 'urn:oasis:names:tc:opendocument:xmlns:container',
  ENC: 'http://www.w3.org/2001/04/xmlenc#', XLINK: 'http://www.w3.org/1999/xlink',
};
const OBFUSCATION = new Set(['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC']);   // לפי ת־קורא: כל אלגוריתם אחר = DRM

export function parseXml(text, DOMParserImpl = globalThis.DOMParser) {
  if (/<!ENTITY/i.test(text)) fail('xml_entities');             // בלי ישויות מוגדרות (billion laughs) — כמו safe_xml_fromstring של Calibre
  let doc;
  try { doc = new DOMParserImpl().parseFromString(text, 'application/xml'); } catch (e) { fail('bad_xml'); }   // xmldom זורק; הדפדפן מחזיר parsererror
  if (!doc || !doc.documentElement || doc.getElementsByTagName('parsererror').length) fail('bad_xml');
  return doc;
}
const kids = (el, ns, name) => Array.from(el ? el.childNodes : []).filter((n) => n.nodeType === 1 && n.localName === name && (!ns || n.namespaceURI === ns));
const textOf = (el) => (el && el.textContent || '').replace(/[\t\n\f\r ]+/g, ' ').trim();
export function resolvePath(base, href) {        // נתיב יחסי לקובץ ה־OPF → שם הרשומה ב־ZIP
  let path;
  try { path = decodeURIComponent(String(href).split('#')[0]); } catch (e) { path = String(href).split('#')[0]; }
  const parts = (base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '').concat(path).split('/');
  const out = [];
  for (const p of parts) { if (p === '..') { if (!out.length) return null; out.pop(); } else if (p && p !== '.') out.push(p); }
  return out.join('/');
}

/* ספים לספרייה בטלפון. maxBytes = MAX_BOOK של השרתון (07). ממצא = { code, ...פרטים } ב־errors (חוסם) או warnings (מתועד).
   repair = מה ש־rewriteZip מתקן בלי לגעת בתוכן (mimetype, דגל UTF-8). */
export const LIMITS = { maxBytes: 100 << 20, maxEntries: 5000, maxEntry: 64 << 20, maxTotal: 512 << 20, maxRatio: 100, ratioGrace: 1 << 20 };
export async function inspectEpub(blob, { limits = LIMITS, DOMParserImpl } = {}) {
  const r = { ok: false, kind: await sniff(blob), errors: [], warnings: [], repair: [], drm: null };
  const err = (code, info) => r.errors.push(Object.assign({ code }, info)), warn = (code, info) => r.warnings.push(Object.assign({ code }, info));
  if (blob.size > limits.maxBytes) { err('file_too_big', { size: blob.size }); return r; }
  if (r.kind !== 'epub' && r.kind !== 'zip') { err('not_epub', { kind: r.kind }); return r; }   // MOBI/FB2: דרך foliate + mobiInfo/fb2Meta
  let zip;
  try { zip = await readZip(blob, { maxEntries: limits.maxEntries }); } catch (e) { err(e.code || 'bad_zip'); return r; }
  r.zip = zip;
  if (r.kind === 'zip') { const zk = zipKind(zip); if (zk !== 'epub') { r.kind = zk; err('not_epub', { kind: zk }); return r; } }
  // פצצות ותקינות מבנה — רק מהתיקייה המרכזית (זול)
  let total = 0, noFlag = 0; const seen = new Set(), seenFold = new Set();
  const byOff = zip.entries.slice().sort((a, b) => a.lho - b.lho);
  for (let i = 0; i < byOff.length; i++) {                  // רשומות חופפות = פצצת zip מסוג Fifield (epubcheck 5.3 לא תופס — נבדק)
    const e = byOff[i], next = byOff[i + 1];
    if (e.lho + 30 + e.nameBytes.length + e.csize > (next ? next.lho : zip.cdOff)) { err('overlap', { name: e.name }); break; }
  }
  for (const e of zip.entries) {
    if (e.flags & F_ENC) err('zip_encrypted', { name: e.name });
    if (e.method !== 0 && e.method !== 8) err('bad_method', { name: e.name, method: e.method });
    if (e.usize > limits.maxEntry) err('entry_too_big', { name: e.name, usize: e.usize });
    if (e.usize > limits.ratioGrace && e.usize > e.csize * limits.maxRatio) err('ratio', { name: e.name, ratio: Math.round(e.usize / Math.max(1, e.csize)) });
    total += e.usize;
    if (seen.has(e.name)) err('dup_name', { name: e.name }); else seen.add(e.name);
    const fold = e.name.normalize('NFC').toLowerCase();
    if (seenFold.has(fold) && !r.errors.some((x) => x.name === e.name)) warn('dup_name_case', { name: e.name }); else seenFold.add(fold);
    if (/^\/|(^|\/)\.\.(\/|$)|\\|[\u0000-\u001f]/.test(e.name)) err('bad_path', { name: e.name });
    if (e.hi && !e.nameUtf8) warn('name_not_utf8', { name: e.name });
    else if (e.hi && !(e.flags & F_UTF8)) noFlag++;
  }
  if (total > limits.maxTotal) err('total_too_big', { total });
  if (r.errors.length) return r;
  if (noFlag) { warn('utf8_flag_missing', { count: noFlag }); r.repair.push('utf8_flag'); }   // foliate לא פותח כזה ספר (נבדק); epubcheck לא מתלונן
  // mimetype (EPUB 3.3 §4.3) — מתוקן בכתיבה מחדש, לכן רק אזהרה
  const first = zip.entries[0], mt = zip.byName.get('mimetype');
  if (!first || first.name !== 'mimetype') warn('mimetype_not_first');
  if (!mt) warn('mimetype_missing');
  else {
    if (mt.method !== 0) warn('mimetype_compressed');
    try {
      if ((await entryRange(blob, mt)).lfhExtra) warn('mimetype_extra_field');
      if (UTF8.decode(await readEntry(blob, mt, { max: 64 })) !== 'application/epub+zip') warn('mimetype_content');
    } catch (e) { warn('mimetype_content'); }
  }
  if (r.warnings.some((w) => /^mimetype_/.test(w.code))) r.repair.push('mimetype');
  // container.xml → OPF
  const xml = async (name) => parseXml(await readText(blob, zip.byName.get(name)), DOMParserImpl || globalThis.DOMParser);
  const xmlErr = (e, code) => err(e && e.code === 'xml_entities' ? 'xml_entities' : code);
  if (!zip.byName.has('META-INF/container.xml')) { err('no_container'); return r; }
  let opfPath;
  try {
    const c = await xml('META-INF/container.xml');
    const rf = Array.from(c.getElementsByTagNameNS(NS.CON, 'rootfile')).find((x) => x.getAttribute('media-type') === 'application/oebps-package+xml');
    opfPath = rf && rf.getAttribute('full-path');
  } catch (e) { xmlErr(e, 'bad_container'); return r; }
  if (!opfPath || !zip.byName.has(opfPath)) { err('no_opf', { opfPath }); return r; }
  r.opfPath = opfPath;
  // DRM (לפני ה־OPF: ספר מוצפן לא נכנס לספרייה בכלל). foliate עצמו רק מדפיס אזהרה ומציג זבל (נבדק בקוד)
  if (zip.byName.has('META-INF/encryption.xml')) {
    try {
      const e = await xml('META-INF/encryption.xml');
      const algs = Array.from(e.getElementsByTagNameNS(NS.ENC, 'EncryptionMethod')).map((m) => m.getAttribute('Algorithm') || '');
      const bad = algs.filter((a) => !OBFUSCATION.has(a));
      if (bad.length) r.drm = zip.byName.has('META-INF/license.lcpl') ? 'lcp' : zip.byName.has('META-INF/rights.xml') ? 'adobe' : 'encrypted';
      else if (algs.length) r.info = Object.assign(r.info || {}, { obfuscatedFonts: algs.length });
    } catch (x) { r.drm = 'encrypted'; }
  }
  if (!r.drm && zip.byName.has('META-INF/license.lcpl')) r.drm = 'lcp';
  if (!r.drm && zip.byName.has('META-INF/sinf.xml')) r.drm = 'apple';          // Apple FairPlay (מוסכמה ידועה)
  // OPF
  let opf;
  try { opf = await xml(opfPath); } catch (e) { xmlErr(e, 'bad_opf'); return r; }
  const pkg = opf.documentElement;
  r.version = pkg.getAttribute('version') || '';
  const md = kids(pkg, NS.OPF, 'metadata')[0], man = kids(pkg, NS.OPF, 'manifest')[0], spine = kids(pkg, NS.OPF, 'spine')[0];
  if (!md || !man || !spine) { err('opf_structure'); return r; }
  const uidAttr = pkg.getAttribute('unique-identifier');
  r.uid = textOf(kids(md, NS.DC, 'identifier').find((x) => x.getAttribute('id') === uidAttr));
  if (!r.uid) warn('no_unique_identifier');                 // foliate ייקח את ה־dc:identifier הראשון; אין בכלל → מזהה מהקטלוג
  if (!kids(md, NS.DC, 'title').length) warn('no_title');
  if (!kids(md, NS.DC, 'language').length) warn('no_language');
  const items = kids(man, NS.OPF, 'item'), byId = new Map(), listed = new Set([opfPath]);
  for (const it of items) {
    const id = it.getAttribute('id'), href = it.getAttribute('href') || '', type = it.getAttribute('media-type') || '';
    if (byId.has(id)) err('dup_item_id', { id });
    byId.set(id, it);
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) { warn('remote_resource', { href }); continue; }
    const p = resolvePath(opfPath, href);
    listed.add(p);
    if (!p || !zip.byName.has(p)) it._missing = true;
    if (/javascript|ecmascript/.test(type) || /\bscripted\b/.test(it.getAttribute('properties') || '')) r.scripted = true;   // ה־CSP חוסם בכל מקרה (נבדק)
  }
  const refs = kids(spine, NS.OPF, 'itemref');
  if (!refs.length) err('empty_spine');
  for (const ref of refs) {
    const it = byId.get(ref.getAttribute('idref'));
    if (!it) err('spine_idref', { idref: ref.getAttribute('idref') });
    else if (it._missing) err('spine_missing_file', { href: it.getAttribute('href') });
  }
  for (const it of items) if (it._missing && !refs.some((x) => x.getAttribute('idref') === it.getAttribute('id'))) warn('missing_file', { href: it.getAttribute('href') });
  const hasNav = items.some((it) => /\bnav\b/.test(it.getAttribute('properties') || ''));
  const hasNcx = items.some((it) => it.getAttribute('media-type') === 'application/x-dtbncx+xml');
  if (!hasNav && !hasNcx) warn('no_toc');
  const unlisted = zip.entries.filter((e) => !e.name.endsWith('/') && e.name !== 'mimetype' && !e.name.startsWith('META-INF/') && !listed.has(e.name));
  if (unlisted.length) warn('not_in_manifest', { count: unlisted.length, first: unlisted[0].name });
  // Kobo (כמו check_for_kobo_drm של Calibre): rights.xml בשורש + הפרק הראשון לא נראה כמו XML/HTML ובלי koboSpan
  if (!r.drm && zip.byName.has('rights.xml') && zip.byName.get('rights.xml').usize > 0) {
    const it = byId.get(refs[0] && refs[0].getAttribute('idref')), e = it && zip.byName.get(resolvePath(opfPath, it.getAttribute('href')));
    if (e) {
      const head = UTF8.decode((await readEntry(blob, e, { max: limits.maxEntry, checkCrc: false })).subarray(0, 8192));
      if (!head.includes('<?xml') && !head.includes('<html') && !head.includes('koboSpan')) r.drm = 'kobo';
    }
  }
  if (r.drm) err('drm', { drm: r.drm });
  r.opf = opf;
  r.ok = !r.errors.length;
  return r;
}

/* בדיקה עמוקה (אופציונלית, בהעלאה לספרייה המשותפת): פריסה מלאה של כל רשומה — גודל בפועל ו־CRC. 50MB: ‏0.6–0.7 שנ׳, ×4: ‏3–3.6 שנ׳ */
export async function deepCheck(blob, zip, { maxEntry = LIMITS.maxEntry, onProgress } = {}) {
  let i = 0;
  for (const e of zip.entries) {
    if (!e.name.endsWith('/')) await readEntry(blob, e, { max: maxEntry });    // זורק size_mismatch / bad_crc / bad_deflate
    if (onProgress) onProgress(++i, zip.entries.length);
  }
  return true;
}

/* תיקון מיכל בלבד (בלי לגעת בתוכן): mimetype + דגל UTF-8. לעשות בייבוא — לפני ההעלאה הראשונה אף קורא לא מחזיק את הקובץ */
export async function repairEpub(blob, rep, { now } = {}) {
  if (!rep || !rep.zip || !rep.repair.length) return { blob, fixed: [] };
  return { blob: await rewriteZip(blob, rep.zip, { now }), fixed: rep.repair.slice() };
}

/* ---------------- 6. MOBI/AZW3 ו־FB2: מה ש־foliate לא נותן ---------------- */
/* foliate: metadata.identifier של MOBI = mobi.uid — אקראי בכל המרה (נבדק: אותו ספר, 305419896 ו־195948557). מזהה יציב מ־EXTH:
   112 = "calibre:<uuid>" (Calibre בעדכון פרטים), 113 = ASIN, ובהמרה של Calibre — ה־uuid של הספר (exth.py), אחרת ISBN */
export function mobiInfo(book) {
  const h = book && book.mobi && book.mobi.headers;
  if (!h) return null;
  const ex = h.exth || {};
  const src = [].concat(ex.source || []).find((s) => /^calibre:/i.test(s));
  const isbn = normIsbn(ex.isbn);
  return {
    drm: h.palmdoc && h.palmdoc.encryption ? 'mobi' : null,   // 0 = בלי, 1/2 = Mobipocket DRM. foliate לא עוצר על זה (נבדק)
    stableId: src ? 'urn:uuid:' + src.slice(8) : ex.asin ? 'asin:' + ex.asin : isbn ? 'urn:isbn:' + isbn : null,
    isbn: isbn || null, asin: ex.asin || null, kf8: !!h.kf8,
  };
}
/* FB2: foliate מתעלם מ־<sequence> (סדרה) ומ־ISBN, והכריכה שלו היא fetch ל־data: — שה־connect-src שלנו חוסם (נבדק: "Failed to fetch") */
export function fb2Meta(doc) {
  const q = (root, name) => (root ? Array.from(root.getElementsByTagNameNS('*', name)) : []);
  const ti = q(doc, 'title-info')[0], pi = q(doc, 'publish-info')[0], di = q(doc, 'document-info')[0];
  const seq = q(ti, 'sequence')[0];
  let cover = null;
  const img = q(q(ti, 'coverpage')[0], 'image')[0];
  const href = img ? (img.getAttributeNS(NS.XLINK, 'href') || img.getAttribute('l:href') || img.getAttribute('xlink:href') || '') : '';
  if (href.startsWith('#')) {
    const bin = q(doc, 'binary').find((b) => b.getAttribute('id') === href.slice(1));
    if (bin) cover = { type: bin.getAttribute('content-type') || 'image/jpeg', b64: bin.textContent.replace(/\s+/g, '') };
  }
  return { series: seq ? (seq.getAttribute('name') || '').trim() : '', seriesIndex: seq ? (seq.getAttribute('number') || '').trim() : '',
    isbn: normIsbn(textOf(q(pi, 'isbn')[0])), id: textOf(q(di, 'id')[0]), cover };
}
export function b64ToBytes(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

/* ---------------- 7. OPF: קריאה וכתיבה של פרטים ----------------
   meta = { title, subtitle, titleSort, authors:[{name, sort}], publisher, date, lang, series, seriesIndex, isbn, tags:[], description }
   שדה undefined = לא נוגעים; מחרוזת ריקה / מערך ריק = מוחקים. לא נוגעים ב־unique-identifier, ב־spine ובקבצי התוכן. */
const MARC = 'marc:relators';
export function opfVersion(opf) { return parseFloat(opf.documentElement.getAttribute('version') || '2') >= 3 ? 3 : 2; }
function metadataEl(opf) { return kids(opf.documentElement, NS.OPF, 'metadata')[0] || fail('opf_structure'); }
function refinesOf(md, el) {                          // meta refines="#id" של אלמנט
  const id = el.getAttribute('id');
  return id ? kids(md, NS.OPF, 'meta').filter((m) => m.getAttribute('refines') === '#' + id) : [];
}
function propOf(md, el, prop) { const m = refinesOf(md, el).find((x) => x.getAttribute('property') === prop); return m ? textOf(m) : ''; }
function removeNode(el) {                           // יחד עם הרווח שלפניו — בלי שורות ריקות שמצטברות
  const prev = el.previousSibling;
  if (prev && prev.nodeType === 3 && !prev.nodeValue.trim()) prev.parentNode.removeChild(prev);
  el.parentNode.removeChild(el);
}
function removeWithRefines(md, el) { refinesOf(md, el).forEach(removeNode); removeNode(el); }
function findById(opf, id) { const all = opf.getElementsByTagName('*'); for (let i = 0; i < all.length; i++) if (all[i].getAttribute('id') === id) return all[i]; return null; }
function newId(opf, base) { let i = 1; while (findById(opf, base + i)) i++; return base + i; }
function addEl(opf, md, ns, qname, text, attrs = {}) {
  const el = opf.createElementNS(ns, qname);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('opf:')) el.setAttributeNS(NS.OPF, k, v); else el.setAttribute(k, v);
  }
  if (text != null) el.appendChild(opf.createTextNode(String(text)));
  const last = md.lastChild;                          // רווח הסיום של <metadata> יוצא, ונכתב שוב בסוף writeOpfMeta
  if (last && last.nodeType === 3 && !last.nodeValue.trim()) md.removeChild(last);
  md.appendChild(opf.createTextNode('\n    '));
  md.appendChild(el);
  return el;
}
const setText = (opf, el, val) => { while (el.firstChild) el.removeChild(el.firstChild); el.appendChild(opf.createTextNode(String(val))); };
const refine = (opf, md, el, prop, val, extra = {}) => {
  if (!el.getAttribute('id')) el.setAttribute('id', newId(opf, el.localName));
  return addEl(opf, md, NS.OPF, 'meta', val, Object.assign({ refines: '#' + el.getAttribute('id'), property: prop }, extra));
};
const legacyMeta = (md, name) => kids(md, NS.OPF, 'meta').filter((m) => m.getAttribute('name') === name);
const setLegacy = (opf, md, name, val) => {
  legacyMeta(md, name).forEach(removeNode);
  if (val) addEl(opf, md, NS.OPF, 'meta', null, { name, content: String(val) });
};
const opfAttr = (el, name) => el.getAttributeNS(NS.OPF, name) || el.getAttribute('opf:' + name) || '';
const roleOf = (md, el) => propOf(md, el, 'role') || opfAttr(el, 'role');
const isAuthor = (md, el) => { const r = roleOf(md, el); return !r || r === 'aut'; };
const dateEvent = (el) => opfAttr(el, 'event').toLowerCase();

/* ISBN: ספרות בלבד + ספרת ביקורת תקינה (ISBN-10 mod 11, ISBN-13 mod 10). מחזיר '' כשלא תקין */
export function normIsbn(s) {
  const d = String(s || '').replace(/^(urn:)?isbn:/i, '').replace(/[^0-9Xx]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(d)) { let t = 0; for (let i = 0; i < 10; i++) t += (10 - i) * (d[i] === 'X' ? 10 : +d[i]); return t % 11 === 0 ? d : ''; }
  if (/^97[89]\d{10}$/.test(d)) { let t = 0; for (let i = 0; i < 13; i++) t += (i % 2 ? 3 : 1) * +d[i]; return t % 10 === 0 ? d : ''; }
  return '';
}
export function isbn10to13(s) {
  const d = normIsbn(s);
  if (d.length !== 10) return d;
  const b = '978' + d.slice(0, 9); let t = 0;
  for (let i = 0; i < 12; i++) t += (i % 2 ? 3 : 1) * +b[i];
  return b + ((10 - (t % 10)) % 10);
}
/* מזהה → { scheme, value }. Calibre כותב ב־EPUB 3 "isbn:…", "amazon:…" ו־"urn:uuid:…"; ב־EPUB 2 ‏opf:scheme */
function parseIdent(md, el) {
  const v = textOf(el), sch = opfAttr(el, 'scheme');
  const typ = propOf(md, el, 'identifier-type');               // ONIX codelist 5: ‏02 = ISBN-10, ‏15 = ISBN-13
  if (typ === '02' || typ === '15') return { scheme: 'isbn', value: v };
  if (sch) return { scheme: sch.toLowerCase(), value: v.replace(new RegExp('^(urn:)?' + sch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':', 'i'), '') };
  const m = v.match(/^urn:([a-z0-9-]+):(.+)$/i) || v.match(/^([a-z][a-z0-9_-]{1,20}):(?!\/\/)(.+)$/i);
  return m ? { scheme: m[1].toLowerCase(), value: m[2] } : { scheme: '', value: v };
}
const isIsbnId = (md, el) => parseIdent(md, el).scheme === 'isbn';

export function readOpfMeta(opf) {
  const md = metadataEl(opf), v = opfVersion(opf), pkg = opf.documentElement, uidAttr = pkg.getAttribute('unique-identifier');
  const titles = kids(md, NS.DC, 'title');
  const main = titles.find((t) => propOf(md, t, 'title-type') === 'main') || titles[0];
  const sub = titles.find((t) => t !== main && propOf(md, t, 'title-type') === 'subtitle');
  const creators = kids(md, NS.DC, 'creator');
  let series = '', seriesIndex = '';
  // שם הסדרה מ־EPUB 3 — כאן foliate מפספס: `a ?? b ? {...} : null` מתפרש כ־`(a ?? b) ? {legacy} : null` → שם ריק, מספר NaN (נבדק; גם ב־main של foliate)
  const coll = kids(md, NS.OPF, 'meta').find((m) => m.getAttribute('property') === 'belongs-to-collection' && propOf(md, m, 'collection-type') === 'series');
  if (coll) { series = textOf(coll); seriesIndex = propOf(md, coll, 'group-position'); }
  if (!series) { const s = legacyMeta(md, 'calibre:series')[0], i = legacyMeta(md, 'calibre:series_index')[0]; series = s ? s.getAttribute('content') || '' : ''; seriesIndex = i ? i.getAttribute('content') || '' : ''; }
  const idents = kids(md, NS.DC, 'identifier').map((el) => Object.assign(parseIdent(md, el), el.getAttribute('id') === uidAttr && uidAttr ? { uid: true } : {}));
  const isbnId = idents.find((x) => x.scheme === 'isbn' && normIsbn(x.value)) || idents.find((x) => !x.scheme && normIsbn(x.value) && /^97[89]/.test(normIsbn(x.value)));
  const dates = kids(md, NS.DC, 'date');
  const pub = dates.find((d) => dateEvent(d) === 'publication') || dates.find((d) => !dateEvent(d)) || dates.find((d) => !/modification|creation/.test(dateEvent(d)));
  const lsort = legacyMeta(md, 'calibre:title_sort')[0];
  return {
    version: v, uid: textOf(kids(md, NS.DC, 'identifier').find((x) => x.getAttribute('id') === uidAttr)),
    title: textOf(main), subtitle: textOf(sub),
    titleSort: (main && (propOf(md, main, 'file-as') || opfAttr(main, 'file-as'))) || (lsort ? lsort.getAttribute('content') || '' : ''),
    authors: creators.filter((c) => isAuthor(md, c)).map((c) => ({ name: textOf(c), sort: propOf(md, c, 'file-as') || opfAttr(c, 'file-as') })),
    contributors: creators.concat(kids(md, NS.DC, 'contributor')).filter((c) => !isAuthor(md, c) || c.localName === 'contributor').map((c) => ({ name: textOf(c), role: roleOf(md, c) })),
    publisher: textOf(kids(md, NS.DC, 'publisher')[0]), date: textOf(pub),
    lang: textOf(kids(md, NS.DC, 'language')[0]), series, seriesIndex,
    isbn: isbnId ? normIsbn(isbnId.value) : '', identifiers: idents,
    tags: kids(md, NS.DC, 'subject').map(textOf).filter(Boolean), description: textOf(kids(md, NS.DC, 'description')[0]),
  };
}

export function writeOpfMeta(opf, meta, { now = new Date() } = {}) {
  const md = metadataEl(opf), v = opfVersion(opf), pkg = opf.documentElement;
  const uidId = pkg.getAttribute('unique-identifier');
  const set = (k) => meta[k] !== undefined;
  // כותר + כותר משנה + שם למיון. שם למיון קיים נשמר כשלא ביקשו לשנות אותו
  if (set('title') || set('subtitle') || set('titleSort')) {
    const titles = kids(md, NS.DC, 'title');
    let main = titles.find((t) => propOf(md, t, 'title-type') === 'main') || titles[0];
    if (set('title') && meta.title) { if (!main) main = addEl(opf, md, NS.DC, 'dc:title', meta.title); else setText(opf, main, meta.title); }
    if (main && v === 3) {
      if (set('subtitle')) titles.filter((t) => t !== main && propOf(md, t, 'title-type') === 'subtitle').forEach((t) => removeWithRefines(md, t));
      if (set('subtitle') && meta.subtitle) { const st = addEl(opf, md, NS.DC, 'dc:title', meta.subtitle); refine(opf, md, st, 'title-type', 'subtitle'); }
      if (kids(md, NS.DC, 'title').length > 1 && propOf(md, main, 'title-type') !== 'main') refine(opf, md, main, 'title-type', 'main');
      if (set('titleSort')) {
        refinesOf(md, main).filter((m) => m.getAttribute('property') === 'file-as').forEach(removeNode);
        if (meta.titleSort) refine(opf, md, main, 'file-as', meta.titleSort);
        setLegacy(opf, md, 'calibre:title_sort', '');
      }
    }
    if (set('titleSort') && v === 2) setLegacy(opf, md, 'calibre:title_sort', meta.titleSort);   // EPUB 2: אין file-as לכותר בתקן — המוסכמה של Calibre
  }
  // כותבים (dc:creator עם תפקיד aut או בלי תפקיד) — נמחקים ונכתבים מחדש בסדר; מתרגם/מאייר נשארים
  if (set('authors')) {
    kids(md, NS.DC, 'creator').filter((c) => isAuthor(md, c)).forEach((c) => removeWithRefines(md, c));
    for (const a of meta.authors || []) {
      if (!a || !a.name) continue;
      if (v === 3) {
        const c = addEl(opf, md, NS.DC, 'dc:creator', a.name);
        refine(opf, md, c, 'role', 'aut', { scheme: MARC });
        if (a.sort) refine(opf, md, c, 'file-as', a.sort);
      } else addEl(opf, md, NS.DC, 'dc:creator', a.name, Object.assign({ 'opf:role': 'aut' }, a.sort ? { 'opf:file-as': a.sort } : {}));
    }
  }
  const simple = (key, local, filter, attrs) => {
    if (!set(key)) return;
    kids(md, NS.DC, local).filter(filter || (() => true)).forEach((el) => removeWithRefines(md, el));
    const vals = Array.isArray(meta[key]) ? meta[key] : [meta[key]];
    for (const x of vals) if (x) addEl(opf, md, NS.DC, 'dc:' + local, x, attrs || {});
  };
  simple('publisher', 'publisher');
  // תאריך: ב־EPUB 3 מותר אחד בלבד; ב־EPUB 2 תאריכי creation/modification נשארים
  simple('date', 'date', v === 2 ? (d) => !dateEvent(d) || dateEvent(d) === 'publication' : null, v === 2 ? { 'opf:event': 'publication' } : {});
  simple('tags', 'subject');
  simple('description', 'description');
  if (set('lang') && meta.lang) {                       // השפה הראשונה מוחלפת; שפות נוספות נשמרות
    const l = kids(md, NS.DC, 'language')[0];
    if (l) setText(opf, l, meta.lang); else addEl(opf, md, NS.DC, 'dc:language', meta.lang);
  }
  // ISBN — מזהה נוסף; אף פעם לא האלמנט של unique-identifier (מפתח ההתקדמות שלנו + מפתח ערפול הגופנים)
  if (set('isbn')) {
    if (meta.isbn && !normIsbn(meta.isbn)) fail('bad_isbn', { isbn: meta.isbn });   // ספרת ביקורת שגויה — לא מוחקים בשקט את הקיים
    kids(md, NS.DC, 'identifier').filter((el) => el.getAttribute('id') !== uidId && isIsbnId(md, el)).forEach((el) => removeWithRefines(md, el));
    const isbn = normIsbn(meta.isbn);
    if (isbn) addEl(opf, md, NS.DC, 'dc:identifier', v === 3 ? 'urn:isbn:' + isbn : isbn, v === 3 ? {} : { 'opf:scheme': 'ISBN' });
  }
  // סדרה: EPUB 3 = belongs-to-collection; תמיד גם calibre:series — foliate המקובע (וקוראים ישנים) קוראים רק אותו (באג הקדימות)
  if (set('series') || set('seriesIndex')) {
    kids(md, NS.OPF, 'meta').filter((m) => m.getAttribute('property') === 'belongs-to-collection' && propOf(md, m, 'collection-type') === 'series')
      .forEach((m) => removeWithRefines(md, m));
    const idx = String(meta.seriesIndex == null ? '' : meta.seriesIndex).trim();
    const okIdx = /^\d+(\.\d+)*$/.test(idx) ? idx : '';
    if (v === 3 && meta.series) {
      const c = addEl(opf, md, NS.OPF, 'meta', meta.series, { property: 'belongs-to-collection', id: newId(opf, 'series') });
      refine(opf, md, c, 'collection-type', 'series');
      if (okIdx) refine(opf, md, c, 'group-position', okIdx);
    }
    setLegacy(opf, md, 'calibre:series', meta.series || '');
    setLegacy(opf, md, 'calibre:series_index', meta.series ? (okIdx || '1') : '');
  }
  if (v === 3) {                                       // dcterms:modified — חובה אחד בדיוק (EPUB 3.3)
    const mods = kids(md, NS.OPF, 'meta').filter((m) => m.getAttribute('property') === 'dcterms:modified' && !m.getAttribute('refines'));
    mods.slice(1).forEach(removeNode);
    const stamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
    if (mods[0]) setText(opf, mods[0], stamp); else addEl(opf, md, NS.OPF, 'meta', stamp, { property: 'dcterms:modified' });
  }
  const last = md.lastChild;
  if (!(last && last.nodeType === 3 && !last.nodeValue.trim())) md.appendChild(opf.createTextNode('\n  '));
  return opf;
}

/* ---------------- 8. כריכות בתוך ה־EPUB ----------------
   לפי ת־קורא: כריכת JPEG/PNG קיימת מוחלפת במקום (אותו נתיב, אותו פורמט — להמיר קודם ב־imageTo); בלי עמוד כריכה חדש ב־spine (משנה CFI).
   עמוד כריכה לפי ת־קורא (‏<svg viewBox="0 0 W H"><image width/height>) מקבל את המידות החדשות — אחרת כריכה ביחס אחר נמתחת. */
export function coverItem(opf) {
  const man = kids(opf.documentElement, NS.OPF, 'manifest')[0], md = metadataEl(opf);
  const items = kids(man, NS.OPF, 'item');
  return items.find((it) => /\bcover-image\b/.test(it.getAttribute('properties') || ''))
    || (() => { const m = legacyMeta(md, 'cover')[0]; const id = m && m.getAttribute('content'); return items.find((it) => it.getAttribute('id') === id); })()
    || null;
}
export function addCoverItem(opf, href, mediaType) {
  const man = kids(opf.documentElement, NS.OPF, 'manifest')[0], md = metadataEl(opf);
  const id = newId(opf, 'cover-image-');
  const it = opf.createElementNS(NS.OPF, 'item');
  it.setAttribute('id', id); it.setAttribute('href', href); it.setAttribute('media-type', mediaType);
  if (opfVersion(opf) === 3) it.setAttribute('properties', 'cover-image');
  man.appendChild(opf.createTextNode('\n    ')); man.appendChild(it);
  setLegacy(opf, md, 'cover', id);
  return it;
}
/* מידות תמונה מהכותרת בלבד (JPEG/PNG/GIF/WebP) — לפני פענוח: הגנה מפצצת פיקסלים, ויחס הכריכה */
export function imageSize(u8) {
  const v = dv(u8), s = (a, b) => String.fromCharCode(...u8.subarray(a, b));
  if (u8.length >= 24 && s(1, 4) === 'PNG') return { type: 'image/png', w: v.getUint32(16), h: v.getUint32(20) };
  if (u8.length >= 10 && s(0, 3) === 'GIF') return { type: 'image/gif', w: v.getUint16(6, true), h: v.getUint16(8, true) };
  if (u8.length >= 30 && s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') {
    const c = s(12, 16);
    if (c === 'VP8 ') return { type: 'image/webp', w: v.getUint16(26, true) & 0x3fff, h: v.getUint16(28, true) & 0x3fff };
    if (c === 'VP8L') { const b = v.getUint32(21, true); return { type: 'image/webp', w: (b & 0x3fff) + 1, h: ((b >>> 14) & 0x3fff) + 1 }; }
    if (c === 'VP8X') return { type: 'image/webp', w: 1 + (u8[24] | (u8[25] << 8) | (u8[26] << 16)), h: 1 + (u8[27] | (u8[28] << 8) | (u8[29] << 16)) };
  }
  if (u8[0] === 0xff && u8[1] === 0xd8) {
    let p = 2;
    while (p + 9 < u8.length) {
      if (u8[p] !== 0xff) { p++; continue; }
      const m = u8[p + 1];
      if (m === 0xff) { p++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { p += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: 'image/jpeg', w: v.getUint16(p + 7), h: v.getUint16(p + 5) };
      p += 2 + v.getUint16(p + 2);
    }
  }
  return null;
}
/* עמוד כריכה: עדכון כירורגי של viewBox ו־width/height ב־<svg> שמציג את הכריכה (טקסט בלבד — בלי DOMParser/XMLSerializer) */
export function fixCoverPage(src, imgName, w, h) {
  return String(src).replace(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi, (m, attrs, inner) => {
    const im = inner.match(/<image\b[^>]*?\b(?:xlink:)?href\s*=\s*["']([^"']+)["'][^>]*>/i);
    let base = im ? im[1].split('#')[0].split('/').pop() : '';
    try { base = decodeURIComponent(base); } catch (e) { /* כמו שהוא */ }
    if (!im || base !== imgName) return m;
    const a2 = attrs.replace(/\bviewBox\s*=\s*["'][^"']*["']/i, `viewBox="0 0 ${w} ${h}"`);
    const img2 = im[0].replace(/\bwidth\s*=\s*["'][^"']*["']/i, `width="${w}"`).replace(/\bheight\s*=\s*["'][^"']*["']/i, `height="${h}"`);
    return `<svg${a2}>${inner.replace(im[0], img2)}</svg>`;
  });
}

/* ---------------- 9. עברית/RTL — מה בטוח לגעת בו ---------------- */
/* כיוון קריאה: מאפיין על ה־spine בלבד (לא מוסיף/מסיר itemref — ה־CFI לא זז). רק EPUB 3 — ב־EPUB 2.0.1 המאפיין לא קיים (RSC-005) */
export function setSpineDirection(opf, dir) {
  if (opfVersion(opf) !== 3) return false;
  const spine = kids(opf.documentElement, NS.OPF, 'spine')[0];
  if (!spine || spine.getAttribute('page-progression-direction')) return false;
  spine.setAttribute('page-progression-direction', dir);
  return true;
}
/* lang/dir על <html> של מסמך תוכן — עריכה כירורגית של תג הפתיחה בלבד (בלי DOMParser+XMLSerializer, שעלולים לשבור &nbsp;
   או לשנות את הקובץ כולו). רק מוסיף מאפיין חסר; אף פעם לא דורס. lang ו־xml:lang חייבים להיות זהים (epubcheck) — כשאחד קיים,
   השני מקבל את הערך שלו. מאפיינים לא משנים מיקום אלמנטים — ה־CFI נשמר */
export function ensureHtmlLangDir(src, { lang, dir } = {}) {
  return String(src).replace(/<html\b([^>]*)>/i, (m, attrs) => {
    if (/\/\s*$/.test(attrs)) return m;
    const val = (re) => { const x = attrs.match(re); return x ? x[2] : null; };
    const xl = val(/\sxml:lang\s*=\s*(["'])(.*?)\1/), hl = val(/\slang\s*=\s*(["'])(.*?)\1/);
    let a = attrs;
    if (xl == null && (hl != null || lang)) a += ` xml:lang="${hl != null ? hl : lang}"`;
    if (hl == null && (xl != null || lang)) a += ` lang="${xl != null ? xl : lang}"`;
    if (dir && !/\sdir\s*=/.test(a)) a += ` dir="${dir}"`;
    return '<html' + a + '>';
  });
}
/* Polish עברי בטוח: כיוון ב־spine (EPUB 3), dc:language כשחסר, ו־lang/dir חסרים במסמכי ה־spine. בלי לגעת בתוכן, במבנה ובמזהה */
export async function polishHebrew(blob, { DOMParserImpl, XMLSerializerImpl, now = new Date() } = {}) {
  const rep = await inspectEpub(blob, { DOMParserImpl });
  if (!rep.ok) fail('not_editable', { errors: rep.errors });
  const opf = rep.opf, pkg = opf.documentElement, md = metadataEl(opf), put = new Map();
  let opfChanged = setSpineDirection(opf, 'rtl');
  if (!kids(md, NS.DC, 'language').length) { writeOpfMeta(opf, { lang: 'he' }, { now }); opfChanged = true; }
  const man = kids(pkg, NS.OPF, 'manifest')[0], byId = new Map(kids(man, NS.OPF, 'item').map((it) => [it.getAttribute('id'), it]));
  for (const ref of kids(kids(pkg, NS.OPF, 'spine')[0], NS.OPF, 'itemref')) {
    const it = byId.get(ref.getAttribute('idref'));
    if (!it || !/xhtml|html/.test(it.getAttribute('media-type') || '')) continue;
    const p = resolvePath(rep.opfPath, it.getAttribute('href')), e = p && rep.zip.byName.get(p);
    if (!e) continue;
    const src = await readText(blob, e), out = ensureHtmlLangDir(src, { lang: 'he', dir: 'rtl' });
    if (out !== src) put.set(p, enc.encode(out));
  }
  if (opfChanged) {
    if (opfVersion(opf) === 3) writeOpfMeta(opf, {}, { now });          // dcterms:modified
    const xmlText = new (XMLSerializerImpl || globalThis.XMLSerializer)().serializeToString(opf);
    put.set(rep.opfPath, enc.encode(/^<\?xml/.test(xmlText) ? xmlText : '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlText));
  }
  return put.size ? rewriteZip(blob, rep.zip, { put, now }) : blob;
}

/* ---------------- 10. ייצוא: כתיבת הפרטים לתוך הקובץ ----------------
   רק בייצוא/הורדה למכשיר אחר (Calibre/קינדל) — לא בכל עריכה: md5 חדש = כל קורא מוריד שוב (ראו הדוח).
   cover: Blob. JPEG/PNG באותו media-type של הכריכה הקיימת → מוחלף במקום (+ עמוד ה־SVG מתעדכן). אחרת פריט חדש, ו־cover-image עובר אליו */
export async function embedMetadata(blob, meta, { cover, hebrew, DOMParserImpl, XMLSerializerImpl, now = new Date() } = {}) {
  const rep = await inspectEpub(blob, { DOMParserImpl });
  if (!rep.ok) fail('not_editable', { errors: rep.errors });
  const zip = rep.zip, opf = rep.opf, put = new Map();
  writeOpfMeta(opf, meta, { now });
  if (hebrew) setSpineDirection(opf, 'rtl');
  if (cover) {
    const old = coverItem(opf), bytes = new Uint8Array(await cover.arrayBuffer());
    const oldType = old && old.getAttribute('media-type');
    if (old && oldType === cover.type && /^image\/(jpeg|png)$/.test(oldType) && !/^[a-z]+:/i.test(old.getAttribute('href'))) {
      const path = resolvePath(rep.opfPath, old.getAttribute('href'));
      put.set(path, bytes);
      const dim = imageSize(bytes), name = path.split('/').pop();
      if (dim) {                                      // עמודי כריכה אפשריים: הפניית guide מסוג cover + הפריט הראשון ב־spine
        const pkg = opf.documentElement, man = kids(pkg, NS.OPF, 'manifest')[0], spine = kids(pkg, NS.OPF, 'spine')[0];
        const guide = kids(pkg, NS.OPF, 'guide')[0], cands = new Set();
        kids(guide, NS.OPF, 'reference').filter((r) => /cover/i.test(r.getAttribute('type') || '')).forEach((r) => cands.add(resolvePath(rep.opfPath, r.getAttribute('href') || '')));
        const first = kids(spine, NS.OPF, 'itemref')[0], it = first && kids(man, NS.OPF, 'item').find((x) => x.getAttribute('id') === first.getAttribute('idref'));
        if (it) cands.add(resolvePath(rep.opfPath, it.getAttribute('href')));
        for (const p of cands) {
          const e = p && zip.byName.get(p);
          if (!e || !/\.x?html?$/i.test(p)) continue;
          const src = await readText(blob, e), out = fixCoverPage(src, name, dim.w, dim.h);
          if (out !== src) put.set(p, enc.encode(out));
        }
      }
    } else {
      if (old) {
        const p = (old.getAttribute('properties') || '').replace(/\bcover-image\b/, '').trim();
        if (p) old.setAttribute('properties', p); else old.removeAttribute('properties');
      }
      const ext = cover.type === 'image/png' ? '.png' : cover.type === 'image/webp' ? '.webp' : '.jpg';
      const it = addCoverItem(opf, 'cover-' + now.getTime().toString(36) + ext, cover.type || 'image/jpeg');
      put.set(resolvePath(rep.opfPath, it.getAttribute('href')), bytes);
    }
  }
  const xmlText = new (XMLSerializerImpl || globalThis.XMLSerializer)().serializeToString(opf);
  put.set(rep.opfPath, enc.encode(/^<\?xml/.test(xmlText) ? xmlText : '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlText));
  return rewriteZip(blob, zip, { put, now });
}

/* ---------------- 11. גיבוב וטביעות ---------------- */
const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
export async function sha256Hex(data) {             // WebCrypto לא זורם — כל הקובץ בזיכרון לרגע; ספר עד 100MB — בסדר. רץ מחוץ לשרשור הראשי (נמדד)
  const buf = data instanceof Blob ? await data.arrayBuffer() : data;
  return hex(await crypto.subtle.digest('SHA-256', buf));
}
/* MD5 מצטבר (RFC 1321) — WebCrypto לא תומך ב־MD5. ל־Content-MD5, ל־ETag של R2 ול־md5Checksum של Drive (מפתח הקבצים בקטלוג) */
const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Int32Array.from({ length: 64 }, (_, i) => (Math.abs(Math.sin(i + 1)) * 2 ** 32) | 0);
export class MD5 {
  constructor() { this.h = Int32Array.of(0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476); this.buf = new Uint8Array(64); this.n = 0; this.len = 0; this.w = new Int32Array(16); }
  block(b, o) {                                     // ארבעה סבבים כלולאות נפרדות: ~150MB/s ב־node; בדפדפן 50MB ב־0.43 שנ׳ (×4: ‏2 שנ׳)
    const w = this.w, h = this.h, K = MD5_K, S = MD5_S;
    for (let i = 0; i < 16; i++, o += 4) w[i] = b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
    let a = h[0], bb = h[1], c = h[2], d = h[3], f, t, x;
    for (let i = 0; i < 16; i++) { f = d ^ (bb & (c ^ d)); x = a + f + K[i] + w[i]; t = S[i & 3]; a = d; d = c; c = bb; bb = (bb + ((x << t) | (x >>> (32 - t)))) | 0; }
    for (let i = 16; i < 32; i++) { f = c ^ (d & (bb ^ c)); x = a + f + K[i] + w[(5 * i + 1) & 15]; t = S[4 + (i & 3)]; a = d; d = c; c = bb; bb = (bb + ((x << t) | (x >>> (32 - t)))) | 0; }
    for (let i = 32; i < 48; i++) { f = bb ^ c ^ d; x = a + f + K[i] + w[(3 * i + 5) & 15]; t = S[8 + (i & 3)]; a = d; d = c; c = bb; bb = (bb + ((x << t) | (x >>> (32 - t)))) | 0; }
    for (let i = 48; i < 64; i++) { f = c ^ (bb | ~d); x = a + f + K[i] + w[(7 * i) & 15]; t = S[12 + (i & 3)]; a = d; d = c; c = bb; bb = (bb + ((x << t) | (x >>> (32 - t)))) | 0; }
    h[0] += a; h[1] += bb; h[2] += c; h[3] += d;
  }
  update(u8) {
    let i = 0; this.len += u8.length;
    if (this.n) { while (this.n < 64 && i < u8.length) this.buf[this.n++] = u8[i++]; if (this.n === 64) { this.block(this.buf, 0); this.n = 0; } }
    for (; i + 64 <= u8.length; i += 64) this.block(u8, i);
    while (i < u8.length) this.buf[this.n++] = u8[i++];
    return this;
  }
  digest() {
    const bits = this.len * 8, pad = new Uint8Array(((this.n < 56 ? 56 : 120) - this.n) + 8);
    pad[0] = 0x80;
    const v = dv(pad); v.setUint32(pad.length - 8, bits >>> 0, true); v.setUint32(pad.length - 4, Math.floor(bits / 2 ** 32), true);
    this.update(pad);
    return new Uint8Array(this.h.buffer.slice(0));
  }
}
export async function md5Blob(blob, chunk = 1 << 20) {      // זורם, 1MB בכל פעם + ויתור על השרשור — בלי משימות ארוכות
  const m = new MD5();
  for (let o = 0; o < blob.size; o += chunk) { m.update(await u8of(blob.slice(o, o + chunk))); await yieldNow(); }
  return hex(m.digest());
}
/* ה־ETag ש־R2 יחזיר: PUT יחיד = MD5; multipart = MD5 של צירוף ה־MD5 הבינאריים + "-N" (אומת מול הדוגמה בתיעוד של Cloudflare) */
export async function r2ExpectedEtag(blob, partSize) {
  if (!partSize || blob.size <= partSize) return md5Blob(blob);
  const all = new MD5(); let n = 0;
  for (let o = 0; o < blob.size; o += partSize, n++) {
    const part = new MD5();
    for (let p = o; p < Math.min(o + partSize, blob.size); p += 1 << 20) { part.update(await u8of(blob.slice(p, Math.min(p + (1 << 20), o + partSize)))); await yieldNow(); }
    all.update(part.digest());
  }
  return hex(all.digest()) + '-' + n;
}

/* טביעת טקסט: אותו ספר עם פרטים/כריכה/אריזה אחרים → אותה טביעה. הקלט: הטקסט של הפרקים (docText של indexBook) */
export function normText(t) {
  return String(t).normalize('NFKD').replace(/[\p{M}\p{Cf}]/gu, '')     // ניקוד/טעמים/אקצנטים + מקף רך, ZWJ, סימני כיווניות
    .replace(/[םןץףך]/g, (c) => ({ 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ' })[c])
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export async function textFingerprint(sections) {   // נרמול לפי פרק עם ויתור על השרשור; זהה ל־normText(sections.join(' '))
  const parts = [];
  for (const sec of sections) { const t = normText(sec); if (t) parts.push(t); await yieldNow(); }
  return sha256Hex(enc.encode(parts.join(' ')));
}
/* גיבוב מסמכי התוכן בלבד (לפי סדר ה־spine), בלי OPF/NCX/תמונות: "אותו ספר — רק הפרטים או הכריכה השתנו".
   מדויק וזול — אין DOM, רק פריסה וגיבוב. rep = התוצאה של inspectEpub */
export async function spineHash(blob, rep) {
  const pkg = rep.opf.documentElement, man = kids(pkg, NS.OPF, 'manifest')[0], spine = kids(pkg, NS.OPF, 'spine')[0];
  const byId = new Map(kids(man, NS.OPF, 'item').map((it) => [it.getAttribute('id'), it]));
  const digests = [];
  for (const ref of kids(spine, NS.OPF, 'itemref')) {
    if (ref.getAttribute('linear') === 'no') continue;
    const it = byId.get(ref.getAttribute('idref')), e = it && rep.zip.byName.get(resolvePath(rep.opfPath, it.getAttribute('href')));
    if (e) digests.push(new Uint8Array(await crypto.subtle.digest('SHA-256', await readEntry(blob, e))));
  }
  const all = new Uint8Array(digests.length * 32); digests.forEach((d, i) => all.set(d, i * 32));
  return sha256Hex(all);
}
/* MinHash על רצפים של k מילים — דמיון ז'קאר משוער בין ספרים (מהדורות/המרות שונות). חתימה קטנה: n×4 בתים */
function fnv1a(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
function mix(h, seed) { h ^= seed; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; }
export function minhash(text, { k = 5, n = 64 } = {}) {
  const w = normText(text).split(' ').filter(Boolean);
  const sig = new Uint32Array(n).fill(0xffffffff), seeds = Uint32Array.from({ length: n }, (_, i) => mix(i + 1, 0x9e3779b9));
  for (let i = 0; i + k <= w.length; i++) {
    const h = fnv1a(w.slice(i, i + k).join(' '));
    for (let j = 0; j < n; j++) { const x = mix(h, seeds[j]); if (x < sig[j]) sig[j] = x; }
  }
  return sig;
}
/* אותו MinHash לפי פרקים, עם ויתור על השרשור (ספר של 1.2M תווים: משימה של 1 שנ׳ במעבד איטי — בלי זה). הרצפים חוצים גבולות פרק כמו בגרסה הסינכרונית */
export async function minhashSections(sections, { k = 5, n = 64 } = {}) {
  const sig = new Uint32Array(n).fill(0xffffffff), seeds = Uint32Array.from({ length: n }, (_, i) => mix(i + 1, 0x9e3779b9));
  let tail = [];
  for (const sec of sections) {
    const w = tail.concat(normText(sec).split(' ').filter(Boolean));
    for (let i = 0; i + k <= w.length; i++) {
      const h = fnv1a(w.slice(i, i + k).join(' '));
      for (let j = 0; j < n; j++) { const x = mix(h, seeds[j]); if (x < sig[j]) sig[j] = x; }
      if ((i & 0x1fff) === 0x1fff) await yieldNow();
    }
    tail = w.slice(Math.max(0, w.length - (k - 1)));
    await yieldNow();
  }
  return sig;
}
export const similarity = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) if (a[i] === b[i]) s++; return s / a.length; };

/* ---------------- 12. תמונות וכריכות (דפדפן בלבד) ---------------- */
/* המרה לפורמט/גודל: JPEG/PNG לתוך EPUB (WebP הוא core media type רק מ־EPUB 3.3 — קוראים ישנים וקינדל לא);
   WebP רק לממוזערת שלנו (קטנה ב־30% מ־JPEG בבדיקה). Safari לא מקודד WebP בקנבס (מחזיר PNG) — לכן בודקים את הסוג שחזר.
   maxPixels: תמונה קטנה בבייטים שמתפרסת לג'יגה־בייטים (פצצת פיקסלים) — נדחית לפי הכותרת, לפני פענוח */
export async function imageTo(blob, { type = 'image/jpeg', quality = 0.85, maxW = 1600, maxH = 2400, maxPixels = 40e6 } = {}) {
  const dim = imageSize(await u8of(blob.slice(0, 256 << 10)));
  if (dim && dim.w * dim.h > maxPixels) fail('image_too_big', dim);
  let bmp;
  try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(blob); }   // EXIF של צילום מהטלפון
  const s = Math.min(1, maxW / bmp.width, maxH / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
  const cv = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = cv.getContext('2d');
  if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }   // JPEG בלי שקיפות: רקע לבן (אחרת שחור)
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  const out = cv.convertToBlob ? await cv.convertToBlob({ type, quality }) : await new Promise((r) => cv.toBlob(r, type, quality));
  if (!out || out.type !== type) fail('encode_unsupported', { type, got: out && out.type });
  return { blob: out, w, h };
}
export const thumbOf = (blob) => imageTo(blob, { type: 'image/webp', quality: 0.8, maxW: 480, maxH: 720 })
  .catch((e) => (e && e.code === 'image_too_big' ? Promise.reject(e) : imageTo(blob, { type: 'image/jpeg', quality: 0.82, maxW: 480, maxH: 720 })));

/* כריכה טיפוגרפית 2:3 (1200×1800, ~53KB) לספר בלי כריכה, בגופן שכבר באפליקציה. wrap = פונקציית שבירת שורות (wrapQuote ב־library.js) */
export async function typoCover({ title, author = '', w = 1200, h = 1800, bg = '#1f3b2d', fg = '#f4efe3', font = 'Noto Sans Hebrew', wrap }) {
  await document.fonts.load(`700 96px "${font}"`, title);
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.textAlign = 'center'; g.direction = /[֐-׿]/.test(title) ? 'rtl' : 'ltr';
  let size = 112, lines;
  do { g.font = `700 ${size}px "${font}"`; lines = wrap(title, w * 0.8, (t) => g.measureText(t).width, 5); size -= 8; }
  while (lines.length > 4 && size > 56);
  const lh = size * 1.3, y0 = h * 0.42 - (lines.length * lh) / 2;
  lines.forEach((l, i) => g.fillText(l, w / 2, y0 + i * lh));
  g.font = `400 54px "${font}"`; g.globalAlpha = 0.85; g.fillText(author, w / 2, h * 0.78);
  return new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.9));
}

/* ---------------- 13. ליטוש ובדיקת הספר (Academy Pro, גל 1 — B1–B10, H3, H4, A10) ----------------
   עקרונות: עותק חדש של הקובץ (הקודם נשמר אצל הקורא לביטול), dc:identifier לא משתנה, ובתוכן — רק החלפה של תו בתו
   (״ ׳ ־ וסוגריים), כדי שה־CFI של ההדגשות לא יזוז. היוצא מן הכלל: הסרת תווי כיוון מיותרים (תו אחד פחות בפסקה).
   הכל מחרוזות (בלי DOMParser+XMLSerializer על מסמכי התוכן) — רק ה־OPF וה־NCX עוברים דרך DOM, כמו בשאר הקובץ. */
const HEL = '[\\u05D0-\\u05EA][\\u0591-\\u05C7]*';                       // אות עברית + ניקוד/טעמים אחריה
const RE_MAQAF = new RegExp('(' + HEL + ')-(?=[\\u05D0-\\u05EA0-9])', 'g');   // בית-ספר → בית־ספר, ב-1965 → ב־1965
/* H3: פיסוק עברי — מעבר אחד משמאל לימין על " ו־' (גם המסולסלים):
   - בין שתי אותיות: גרשיים/גרש (צה"ל, ג'ירפה) — אלא אם לפניו רק אותיות שימוש (ו, ה, ש…) והמילה שאחריו נסגרת באותו סימן:
     ו"המכתב" / ה'לא' = מירכאות, לא נוגעים. ב־" גם: יותר משתי אותיות אחרי הסימן = כנראה מירכאות (לא נוגעים).
   - אחרי מילה (' בלבד): סגירת ציטוט אם נפתח ציטוט, אחרת גרש (ג׳, עמ׳, פרופ׳).
   מירכאות של ציטוט ("שלום") לא משתנות. כל החלפה = תו אחד בתו אחד (ה־CFI לא זז) */
export function hebrewPunct(text) {
  let n = 0;
  const heb = (c) => c >= '\u05D0' && c <= '\u05EA', mark = (c) => c >= '\u0591' && c <= '\u05C7';
  const open = { '"': false, "'": false };
  let t = String(text).replace(/["'\u201C\u201D\u2018\u2019]/g, (m, off, str) => {
    const dbl = m === '"' || m === '\u201C' || m === '\u201D', key = dbl ? '"' : "'";
    let j = off - 1;
    while (j >= 0 && mark(str[j])) j--;
    const pv = j >= 0 && heb(str[j]), nx = heb(str[off + 1] || ''), nxw = /\w/.test(str[off + 1] || '');
    if (pv && nx) {
      let s0 = j; while (s0 > 0 && (heb(str[s0 - 1]) || mark(str[s0 - 1]))) s0--;
      const before = str.slice(s0, j + 1).replace(/[\u0591-\u05C7]/g, '');
      let e = off + 1; while (e < str.length && (heb(str[e]) || mark(str[e]))) e++;
      const after = str.slice(off + 1, e).replace(/[\u0591-\u05C7]/g, ''), close = str[e] || '';
      const closes = dbl ? /["\u201C\u201D]/.test(close) : /['\u2018\u2019]/.test(close);
      if (/^[בהוכלמש]{1,3}$/.test(before) && closes) { open[key] = true; return m; }
      if (dbl && after.length > 2) return m;
      n++; return dbl ? '\u05F4' : '\u05F3';
    }
    if (pv && !nxw) {
      if (open[key]) { open[key] = false; return m; }
      if (dbl) return m;
      n++; return '\u05F3';
    }
    if (!pv && nx) open[key] = true;
    return m;
  });
  t = t.replace(RE_MAQAF, (m, l) => { n++; return l + '\u05BE'; });
  return { text: t, n };
}
/* H4: כיווניות. תווי הטבעה/דריסה ישנים (U+202A–202E) נמחקים; סימן כיוון ליד אות באותו כיוון לא משנה כלום ונמחק; רצף סימנים → אחד;
   סוגריים הפוכים מהמרה חזותית — ")עמ' 42(" → "(עמ' 42)" — רק כשאין בקטע סוגר פותח לפני הסוגר הראשון */
export function bidiFix(text) {
  let n = 0;
  let t = text.replace(/[‪-‮]/g, () => { n++; return ''; });
  t = t.replace(/([‎‏])[‎‏]+/g, (m, a) => { n += m.length - 1; return a; });
  t = t.replace(/‏(?=[א-ת])|(?<=[א-ת֑-ׇ])‏/g, () => { n++; return ''; });
  t = t.replace(/‎(?=[A-Za-z])|(?<=[A-Za-z])‎/g, () => { n++; return ''; });
  const o = t.indexOf('('), c = t.indexOf(')');
  if (c >= 0 && (o < 0 || c < o) && /[א-ת]/.test(t)) t = t.replace(/\)([^()\n]{1,120})\(/g, (m, x) => { n++; return '(' + x + ')'; });
  return { text: t, n };
}
/* הטקסט של מסמך XHTML בלבד (אחרי <body>, בלי script/style/pre/code/svg/math), עם fn על כל קטע טקסט.
   &quot; ו־&apos; בטקסט = " ו־' (מותר כתו רגיל בטקסט של XML), כדי שצה&quot;ל ייתפס. קטע שלא השתנה נשאר בדיוק כמו שהיה */
const SKIP_TEXT = /^(script|style|pre|code|kbd|samp|tt|svg|math|head)$/i;
const TAG_RE = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(?:[^>"']|"[^"]*"|'[^']*')*>/g;
export function mapText(src, fn) {
  const s = String(src), bm = /<body\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(s);
  if (!bm) return s;
  const start = bm.index + bm[0].length;
  let out = s.slice(0, start), last = start, skip = 0, m;
  const seg = (x) => {
    if (skip || !/\S/.test(x)) return x;
    const d = x.replace(/&(quot|#34|#x22);/gi, '"').replace(/&(apos|#39|#x27);/gi, "'");
    const r = fn(d);
    return r === d ? x : r;
  };
  TAG_RE.lastIndex = start;
  while ((m = TAG_RE.exec(s))) {
    if (m.index > last) out += seg(s.slice(last, m.index));
    const t = m[0], tm = /^<(\/?)([\w:.-]+)/.exec(t);
    if (tm && SKIP_TEXT.test(tm[2].split(':').pop())) { if (tm[1]) skip = Math.max(0, skip - 1); else if (!/\/\s*>$/.test(t)) skip++; }
    out += t; last = TAG_RE.lastIndex;
  }
  if (last < s.length) out += seg(s.slice(last));
  return out;
}

/* CSS: סורק קטן (הערות, מחרוזות, סוגריים, בלוקים מקוננים). keepSel(sel) → בורר מסונן או '' למחיקה;
   keepDecl(prop, value, sel) → false למחיקה; dropAt(name) → true = מחיקת כל הבלוק (למשל @page). כלל שהתרוקן — נמחק */
export function cssTransform(css, { keepSel, keepDecl, dropAt } = {}) {
  const src = String(css), n = src.length;
  let i = 0;
  const skipStr = () => { const q = src[i]; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } };
  const scanTo = (stops) => {                     // i נעצר על התו שנמצא (או n)
    let p = 0;
    for (; i < n; i++) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n - 1 : e + 1; continue; }
      if (c === '"' || c === "'") { skipStr(); continue; }
      if (c === '(') p++; else if (c === ')') { if (p) p--; } else if (!p && stops.includes(c)) return c;
    }
    return '';
  };
  const rawBlock = () => {                         // i אחרי '{' → i אחרי ה־'}' התואם
    let d = 1;
    for (; i < n && d; i++) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n - 1 : e + 1; continue; }
      if (c === '"' || c === "'") { skipStr(); continue; }
      if (c === '{') d++; else if (c === '}') d--;
    }
  };
  const splitDecl = (body) => {                    // ';' מחוץ למחרוזות ולסוגריים (url(data:…;base64,…))
    const out = []; let p = 0, s = 0;
    for (let j = 0; j < body.length; j++) {
      const c = body[j];
      if (c === '"' || c === "'") { const q = c; j++; while (j < body.length && body[j] !== q) { if (body[j] === '\\') j++; j++; } continue; }
      if (c === '(') p++; else if (c === ')') { if (p) p--; } else if (c === ';' && !p) { out.push(body.slice(s, j)); s = j + 1; }
    }
    out.push(body.slice(s));
    return out;
  };
  const stripC = (x) => x.replace(/\/\*[\s\S]*?\*\//g, '');
  const list = (nested) => {
    let out = '';
    while (i < n) {
      const s = i, c = scanTo('{;}'), pre = src.slice(s, i);
      if (c === '}') { i++; if (nested) return out + pre; out += pre + '}'; continue; }
      if (c !== '{') { out += pre + (c ? ';' : ''); i++; continue; }
      i++;
      const lead = pre.match(/^\s*/)[0], head = stripC(pre).trim(), at = /^@([\w-]+)/.exec(head);
      if (at) {
        const name = at[1].toLowerCase();
        if (/^(media|supports|document|-moz-document|layer|container)$/.test(name)) {
          const inner = list(true);
          if (stripC(inner).trim()) out += pre + '{' + inner + '}';
          continue;
        }
        rawBlock();
        if (!(dropAt && dropAt(name))) out += src.slice(s, i);
        continue;
      }
      const b0 = i; rawBlock();
      const body = src.slice(b0, i - 1);
      const sel = keepSel ? keepSel(head) : head;
      if (!sel) continue;
      let nb = body;
      if (keepDecl) {
        const parts = splitDecl(body), kept = parts.filter((d) => {
          const k = stripC(d), ix = k.indexOf(':');
          if (ix < 0) return !!k.trim();
          return keepDecl(k.slice(0, ix).trim().toLowerCase(), k.slice(ix + 1).trim(), head);
        });
        if (kept.length !== parts.length) {
          if (!kept.some((d) => stripC(d).trim())) continue;
          nb = kept.join(';');
        }
      }
      out += lead + (sel === head ? pre.slice(lead.length) : sel + ' ') + '{' + nb + '}';
    }
    return out;
  };
  return list(false);
}
/* B3: בורר שלא יכול להתאים לשום אלמנט בספר — מחלקה או id שלא מופיעים באף מסמך. :is/:where/:has ו־escape — נשארים (זהירות) */
export function selectorUsed(sel, used) {
  const keep = [];
  for (const one of splitTop(sel)) {
    const s = one.trim();
    if (!s) continue;
    if (/\\|:(is|where|has|matches|-webkit-any|-moz-any)\(/i.test(s)) { keep.push(one); continue; }
    const bare = s.replace(/\[[^\]]*\]/g, '').replace(/:not\((?:[^()]|\([^()]*\))*\)/gi, '');
    const cls = [...bare.matchAll(/\.(-?[_a-zA-Z -￿][\w -￿-]*)/g)].map((x) => x[1]);
    const ids = [...bare.matchAll(/#(-?[_a-zA-Z -￿][\w -￿-]*)/g)].map((x) => x[1]);
    if (cls.every((c) => used.cls.has(c)) && ids.every((x) => used.ids.has(x))) keep.push(one);
  }
  return keep.length ? keep.map((x) => x.trim()).join(', ') : '';
}
function splitTop(sel) {                            // פסיקים ברמה העליונה בלבד
  const out = []; let p = 0, s = 0;
  for (let j = 0; j < sel.length; j++) { const c = sel[j]; if (c === '(' || c === '[') p++; else if (c === ')' || c === ']') p--; else if (c === ',' && !p) { out.push(sel.slice(s, j)); s = j + 1; } }
  out.push(sel.slice(s));
  return out;
}
/* B4: עיצוב כפוי. parts = { font, color, size, margin }. שוליים — רק על html/body (שוליי העמוד של המו״ל) ו־@page */
const ABS_UNIT = /\d(\.\d+)?\s*(px|pt|pc|cm|mm|in)\b/i;
export function forcedFilter(parts) {
  return (prop, val, sel) => {
    if (parts.font && prop === 'font-family') return false;
    if ((parts.font || parts.size) && prop === 'font') return false;
    if (parts.color && (prop === 'color' || prop === 'background-color' || (prop === 'background' && !/url\(/i.test(val)))) return false;
    if (parts.size && (prop === 'font-size' || prop === 'line-height') && ABS_UNIT.test(val)) return false;
    if (parts.margin && /^(margin|padding)(-|$)/.test(prop) && /(^|[\s,>+~(])(html|body)(?![\w-])/i.test(sel || '')) return false;
    return true;
  };
}
/* style="" במסמכי התוכן — אותו מסנן (בלי שוליים: אין בורר) */
function filterStyleAttrs(src, keepDecl) {
  return String(src).replace(/(\sstyle\s*=\s*)(["'])([^"']*)\2/gi, (m, pre, q, v) => {
    const parts = v.split(';'), kept = parts.filter((d) => { const ix = d.indexOf(':'); return ix < 0 ? !!d.trim() : keepDecl(d.slice(0, ix).trim().toLowerCase(), d.slice(ix + 1).trim(), ''); });
    if (kept.length === parts.length) return m;
    return kept.some((d) => d.trim()) ? pre + q + kept.join(';') + q : '';
  });
}
export function relPath(fromFile, toPath) {         // נתיב ב־ZIP → href יחסי למסמך fromFile
  const a = fromFile.split('/').slice(0, -1), b = toPath.split('/');
  let k = 0;
  while (k < a.length && k < b.length - 1 && a[k] === b[k]) k++;
  return '../'.repeat(a.length - k) + b.slice(k).map(encodeURIComponent).join('/');
}
const escX = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HYPH_MARK = '/* snb-hyphens */';
const HYPH_CSS = '\n' + HYPH_MARK + '\np, li, blockquote, dd { -webkit-hyphens: auto; hyphens: auto; }\n';
const FONT_RE = /font|opentype|truetype|woff|sfnt/i, FONT_EXT = /\.(ttf|otf|woff2?|eot)$/i;
const opfBytes = (opf, Ser) => { const x = new (Ser || globalThis.XMLSerializer)().serializeToString(opf); return enc.encode(/^<\?xml/.test(x) ? x : '<?xml version="1.0" encoding="UTF-8"?>\n' + x); };
export const POLISH_ALL = { punct: true, bidi: true, css: true, forced: { font: true, color: true, size: true, margin: true }, epub3: true, kindle: true, hyph: true };
export const POLISH_DEFAULT = { punct: true, bidi: true, css: true, forced: { font: true, color: true, size: false, margin: false }, epub3: true, kindle: true, hyph: true };

/* B1: ליטוש בפעולה אחת. dry = רק ספירה (לחלון — "כמה מקומות", "כמה KB"), בלי לכתוב קובץ.
   מחזיר { blob, stats, issues, info }. issues = A10: { code, n, first, fix } — fix: 'auto' (כל ליטוש) / 'kindle' / 'epub3' / null (ידני) */
export async function polishBook(blob, opts = {}, { dry = false, DOMParserImpl, XMLSerializerImpl, now = new Date(), meta, cover } = {}) {
  const rep = await inspectEpub(blob, { DOMParserImpl });
  if (!rep.ok) fail('not_editable', { errors: rep.errors });
  const DP = DOMParserImpl || globalThis.DOMParser;
  const zip = rep.zip, opf = rep.opf, pkg = opf.documentElement, md = metadataEl(opf), opfPath = rep.opfPath;
  const man = kids(pkg, NS.OPF, 'manifest')[0], spine = kids(pkg, NS.OPF, 'spine')[0];
  const items = kids(man, NS.OPF, 'item');
  const put = new Map(), del = new Set();
  const st = { punct: 0, bidi: 0, cssBytes: 0, forcedBytes: 0, hyph: 0, fontsRemoved: 0, fontBytes: 0, missingRemoved: 0, tocFixed: 0, upgraded: false, langAdded: false, docs: 0 };
  const issues = [];
  const issue = (code, fix, n = 1, first = '') => { const x = issues.find((y) => y.code === code); if (x) { x.n += n; return; } issues.push({ code, n, first, fix }); };
  let opfChanged = false;
  const pathOf = (it) => { const h = it.getAttribute('href') || ''; return /^[a-z][a-z0-9+.-]*:/i.test(h) ? null : resolvePath(opfPath, h); };
  const isDoc = (it) => /xhtml|html/.test(it.getAttribute('media-type') || '');
  const isCss = (it) => (it.getAttribute('media-type') || '') === 'text/css' || /\.css$/i.test(it.getAttribute('href') || '');
  const isFont = (it) => FONT_RE.test(it.getAttribute('media-type') || '') || FONT_EXT.test(it.getAttribute('href') || '');
  const docs = [], csss = [];
  for (const it of items) {
    const p = pathOf(it), e = p && zip.byName.get(p);
    if (!e) continue;
    if (isDoc(it)) docs.push({ it, p, src: await readText(blob, e, 16 << 20) });
    else if (isCss(it)) csss.push({ it, p, src: await readText(blob, e, 8 << 20) });
    if (docs.length % 20 === 0) await yieldNow();
  }
  st.docs = docs.length;
  // A10 — מה שה־inspect כבר מצא
  for (const w of rep.warnings) {
    if (/^mimetype_|^utf8_flag/.test(w.code)) issue('container', 'auto');
    else if (w.code === 'missing_file') issue('missing_file', 'kindle', 1, w.href || '');
    else if (w.code === 'no_language') issue('no_language', 'kindle');
    else if (w.code === 'no_toc') issue('no_toc', 'epub3');
    else if (w.code === 'remote_resource') issue('remote_resource', null, 1, w.href || '');
    else if (w.code === 'no_title') issue('no_title', null);
  }
  try { await deepCheck(blob, zip); } catch (e) { issue('corrupt', null, 1, (e && e.code) || ''); }
  // שפה וכיוון: לפי dc:language, ואם אין — לפי הטקסט
  const langEl = kids(md, NS.DC, 'language')[0];
  let lang = textOf(langEl).toLowerCase();
  if (!lang) {
    const sample = docs.slice(0, 6).map((d) => d.src.replace(/<[^>]*>/g, ' ')).join(' ').slice(0, 40000);
    const he = (sample.match(/[א-ת]/g) || []).length, la = (sample.match(/[A-Za-z]/g) || []).length;
    lang = he > la ? 'he' : la ? 'en' : '';
  }
  const hebrew = /^(he|iw)\b/.test(lang);
  const v = opfVersion(opf);
  // מה שמשמש בספר: מחלקות, id, וקבצים שמוזכרים (תמונות, גופנים)
  const used = { cls: new Set(), ids: new Set() }, refd = new Set();
  const addRefs = (text, base) => {
    for (const m of String(text).matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) { const p = resolvePath(base, m[2].trim()); if (p) refd.add(p); }
    for (const m of String(text).matchAll(/\s(?:src|href|xlink:href)\s*=\s*(["'])([^"']+)\1/gi)) { if (!/^[a-z][a-z0-9+.-]*:|^#/i.test(m[2])) { const p = resolvePath(base, m[2]); if (p) refd.add(p); } }
  };
  for (const d of docs) {
    for (const m of d.src.matchAll(/\sclass\s*=\s*(["'])([^"']*)\1/gi)) m[2].split(/\s+/).forEach((c) => c && used.cls.add(c));
    for (const m of d.src.matchAll(/\sid\s*=\s*(["'])([^"']*)\1/gi)) used.ids.add(m[2]);
    addRefs(d.src, d.p);
    for (const m of d.src.matchAll(/<(?:img|image)\b[^>]*?\s(?:src|xlink:href)\s*=\s*(["'])([^"']+)\1/gi)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(m[2])) continue;
      const p = resolvePath(d.p, m[2]);
      if (p && !zip.byName.has(p)) issue('missing_img', null, 1, m[2]);
    }
  }
  for (const c of csss) addRefs(c.src, c.p);
  // מסמכי התוכן: עברית, כיווניות, עיצוב כפוי ב־style=""
  const forced = opts.forced && Object.values(opts.forced).some(Boolean) ? forcedFilter(opts.forced) : null;
  for (const d of docs) {
    let out = d.src;
    if (hebrew && (opts.punct || opts.bidi)) {
      const sample = (t, x) => {                       // דוגמה ל"לפני/אחרי" בחלון — מהספר עצמו
        let k = 0; while (k < t.length && t[k] === x[k]) k++;
        const s0 = Math.max(0, k - 60), e0 = Math.min(t.length, k + 110), dl = x.length - t.length, ws = (y) => y.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ');   // תווי כיוון לא נראים — בלעדיהם ההדגשה תו מול תו
        st.sample = { b: ws(t.slice(s0, e0)), a: ws(x.slice(s0, e0 + dl)) };
      };
      out = mapText(out, (t) => {
        let x = t, pn = 0, bn = 0;
        if (opts.punct) { const r = hebrewPunct(x); st.punct += pn = r.n; x = r.text; }
        if (opts.bidi) { const r = bidiFix(x); st.bidi += bn = r.n; x = r.text; }
        /* הדוגמה מראה את התוצאה המלאה של הקטע — הקטע עם הכי הרבה תיקונים (הראשון בתיקו) */
        if ((pn || bn) && (!st.sample || pn + bn > st.sample.n)) { sample(t, x); st.sample.n = pn + bn; }
        return x;
      });
    }
    if (hebrew && opts.bidi) { const o2 = ensureHtmlLangDir(out, { lang: 'he', dir: 'rtl' }); if (o2 !== out) { st.bidi++; out = o2; } }
    if (!hebrew && opts.hyph && lang) out = ensureHtmlLangDir(out, { lang });
    if (forced) { const o2 = filterStyleAttrs(out, forced); st.forcedBytes += out.length - o2.length; out = o2; }
    if (out !== d.src) put.set(d.p, enc.encode(out));
    d.out = out;
  }
  await yieldNow();
  // קבצי CSS: לא בשימוש (B3), עיצוב כפוי (B4), חלוקת מילים (B8)
  for (const c of csss) {
    let out = c.src;
    if (opts.css && !rep.scripted) { const o2 = cssTransform(out, { keepSel: (s) => selectorUsed(s, used) }); st.cssBytes += out.length - o2.length; out = o2; }
    if (forced) { const o2 = cssTransform(out, { keepDecl: forced, dropAt: (name) => !!(opts.forced.margin && name === 'page') }); st.forcedBytes += out.length - o2.length; out = o2; }
    if (opts.hyph && !hebrew && lang && !out.includes(HYPH_MARK)) { out += HYPH_CSS; st.hyph++; }
    if (out !== c.src) put.set(c.p, enc.encode(out));
  }
  // B10 — מוכן לכל קורא: פריטים חסרים ב־manifest, גופנים שלא בשימוש, שפה חסרה, תוכן עניינים שבור (NCX)
  const ncxIt = items.find((it) => (it.getAttribute('media-type') || '') === 'application/x-dtbncx+xml');
  const ncxPath = ncxIt && pathOf(ncxIt);
  let ncx = null;
  if (ncxPath && zip.byName.has(ncxPath)) { try { ncx = parseXml(await readText(blob, zip.byName.get(ncxPath)), DP); } catch (e) { issue('bad_toc', null); } }
  const navPoints = ncx ? Array.from(ncx.getElementsByTagName('*')).filter((x) => x.localName === 'navPoint') : [];
  const broken = navPoints.filter((np) => {
    const c = kids(np, null, 'content')[0], src = c && c.getAttribute('src');
    const p = src && resolvePath(ncxPath, src);
    return !p || !zip.byName.has(p);
  });
  if (broken.length) issue('broken_toc', 'kindle', broken.length, (kids(kids(broken[0], null, 'navLabel')[0], null, 'text')[0] || {}).textContent || '');
  const encrypted = zip.byName.has('META-INF/encryption.xml');
  const unusedFonts = encrypted ? [] : items.filter((it) => { const p = pathOf(it); return p && isFont(it) && zip.byName.has(p) && !refd.has(p); });
  if (unusedFonts.length) issue('unused_font', 'kindle', unusedFonts.length, (pathOf(unusedFonts[0]) || '').split('/').pop());
  if (opts.kindle) {
    for (const it of items) {
      const p = pathOf(it), inSpine = kids(spine, NS.OPF, 'itemref').some((r) => r.getAttribute('idref') === it.getAttribute('id'));
      if (p && !zip.byName.has(p) && !inSpine) { removeNode(it); st.missingRemoved++; opfChanged = true; }
    }
    for (const it of unusedFonts) { const p = pathOf(it); st.fontBytes += zip.byName.get(p).csize || 0; del.add(p); removeNode(it); st.fontsRemoved++; opfChanged = true; }
    if (!langEl && lang) { writeOpfMeta(opf, { lang }, { now }); st.langAdded = true; opfChanged = true; }
    if (broken.length) {
      for (const np of broken) if (!kids(np, null, 'navPoint').length && np.parentNode) { np.parentNode.removeChild(np); st.tocFixed++; }
      if (st.tocFixed) put.set(ncxPath, opfBytes(ncx, XMLSerializerImpl));
    }
  }
  // B5 — שדרוג ל־EPUB 3: גרסה, תוכן עניינים nav (מה־NCX או מהפרקים), מאפייני opf: ישנים → refines, cover-image
  if (opts.epub3 && v === 2) {
    st.upgraded = true; opfChanged = true;
    pkg.setAttribute('version', '3.0');
    for (const el of [...kids(md, NS.DC, 'creator'), ...kids(md, NS.DC, 'contributor')]) {
      const role = opfAttr(el, 'role'), fa = opfAttr(el, 'file-as');
      if (role) refine(opf, md, el, 'role', role, { scheme: MARC });
      if (fa) refine(opf, md, el, 'file-as', fa);
      ['role', 'file-as'].forEach((a) => { el.removeAttributeNS(NS.OPF, a); el.removeAttribute('opf:' + a); });
    }
    const uidId = pkg.getAttribute('unique-identifier');
    for (const el of kids(md, NS.DC, 'identifier')) {
      const sch = opfAttr(el, 'scheme').toLowerCase();
      if (sch === 'isbn' && el.getAttribute('id') !== uidId && normIsbn(textOf(el))) setText(opf, el, 'urn:isbn:' + normIsbn(textOf(el)));
      el.removeAttributeNS(NS.OPF, 'scheme'); el.removeAttribute('opf:scheme');
    }
    const dates = kids(md, NS.DC, 'date');
    const keepD = dates.find((d) => !dateEvent(d) || dateEvent(d) === 'publication') || dates[0];
    for (const d of dates) { if (d !== keepD) removeNode(d); else { d.removeAttributeNS(NS.OPF, 'event'); d.removeAttribute('opf:event'); } }
    const cm = legacyMeta(md, 'cover')[0], cid = cm && cm.getAttribute('content');
    const cit = cid && items.find((it) => it.getAttribute('id') === cid);
    if (cit && !/\bcover-image\b/.test(cit.getAttribute('properties') || '') && /^image\//.test(cit.getAttribute('media-type') || '')) cit.setAttribute('properties', ((cit.getAttribute('properties') || '') + ' cover-image').trim());
    if (!items.some((it) => /\bnav\b/.test(it.getAttribute('properties') || ''))) {
      const dir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
      let name = 'nav.xhtml', k = 1;
      while (zip.byName.has(dir + name)) name = 'nav' + (k++) + '.xhtml';
      const navPath = dir + name;
      const li = (label, p) => '<li><a href="' + escX(relPath(navPath, p)) + '">' + escX(label || p.split('/').pop()) + '</a>';
      const walk = (parent) => {
        const pts = kids(parent, null, 'navPoint').filter((np) => np.parentNode);
        if (!pts.length) return '';
        return '<ol>' + pts.map((np) => {
          const c = kids(np, null, 'content')[0], src = (c && c.getAttribute('src')) || '';
          const p = resolvePath(ncxPath, src.split('#')[0]), frag = src.includes('#') ? '#' + src.split('#')[1] : '';
          const label = textOf(kids(kids(np, null, 'navLabel')[0], null, 'text')[0]);
          return (p ? li(label, p).replace('">', frag ? escX(frag) + '">' : '">') : '<li><span>' + escX(label) + '</span>') + walk(np) + '</li>';
        }).join('') + '</ol>';
      };
      let ol = ncx ? walk(kids(ncx.documentElement, null, 'navMap')[0]) : '';
      if (!ol) {
        const byId = new Map(items.map((it) => [it.getAttribute('id'), it]));
        ol = '<ol>' + kids(spine, NS.OPF, 'itemref').map((r) => {
          const it = byId.get(r.getAttribute('idref')), d = it && docs.find((x) => x.it === it);
          if (!d) return '';
          const h = /<(h[1-3]|title)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(d.src), label = h ? h[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
          return li(label, d.p) + '</li>';
        }).join('') + '</ol>';
      }
      const l = lang || 'und', title = textOf(kids(md, NS.DC, 'title')[0]) || 'Contents';
      const nav = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="' + escX(l) + '" xml:lang="' + escX(l) + '"' + (hebrew ? ' dir="rtl"' : '') + '>\n<head><meta charset="utf-8"/><title>' + escX(title) + '</title></head>\n<body><nav epub:type="toc" id="toc">' + ol + '</nav></body>\n</html>\n';
      put.set(navPath, enc.encode(nav));
      const it = opf.createElementNS(NS.OPF, 'item');
      it.setAttribute('id', newId(opf, 'nav')); it.setAttribute('href', relPath(opfPath, navPath)); it.setAttribute('media-type', 'application/xhtml+xml'); it.setAttribute('properties', 'nav');
      const tail = man.lastChild && man.lastChild.nodeType === 3 && !man.lastChild.nodeValue.trim() ? man.lastChild : null;
      man.insertBefore(opf.createTextNode('\n    '), tail); man.insertBefore(it, tail);
    }
    if (hebrew) setSpineDirection(opf, 'rtl');
  } else if (hebrew && opts.bidi && setSpineDirection(opf, 'rtl')) { opfChanged = true; st.bidi++; }
  // B6 — הפרטים מהספרייה לתוך הקובץ (רק שדות שיש בהם ערך — לא מוחקים מה שבקובץ)
  if (meta) {
    const m = {};
    for (const [k, val] of Object.entries(meta)) if (val != null && val !== '' && !(Array.isArray(val) && !val.length)) m[k] = val;
    if (m.isbn && !normIsbn(m.isbn)) delete m.isbn;
    if (Object.keys(m).length) { writeOpfMeta(opf, m, { now }); opfChanged = true; st.meta = Object.keys(m).length; }
  }
  if (opfChanged || put.size || del.size) {
    if (opfVersion(opf) === 3) writeOpfMeta(opf, {}, { now });     // dcterms:modified
    put.set(opfPath, opfBytes(opf, XMLSerializerImpl));
  }
  const info = { version: v, lang, hebrew, size: blob.size, scripted: !!rep.scripted, hasNcx: !!ncx, cssFiles: csss.length };
  if (dry) return { blob, stats: st, issues, info };
  let out = put.size || del.size || rep.repair.length ? await rewriteZip(blob, zip, { put, del, now }) : blob;
  if (cover && meta) out = await embedMetadata(out, {}, { cover, DOMParserImpl, XMLSerializerImpl, now });
  return { blob: out, stats: st, issues, info };
}
