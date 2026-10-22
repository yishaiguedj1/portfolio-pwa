/* 22/10/2026 (שלב 4): רצועות כתוביות בתוך הסרטון — רשימה וחילוץ, בטלפון, בלי ספרייה ובלי רשת.
   MKV/WebM (EBML) ו־MP4/MOV (תיבות). רצועות טקסט (SRT · ASS/SSA · WebVTT · tx3g · wvtt) יוצאות כקובץ כתוביות
   שהמפענח (importSubs) מכיר; רצועות תמונה (PGS · VobSub · DVB) רק מסומנות — OCR בשלב 6.
   הקובץ נקרא בחלונות של 8MB מהדיסק (Blob.slice) — אף פעם לא כולו בזיכרון. */

const CHUNK = 8 * 1024 * 1024;

/* קורא מהקובץ בחלון נע: קריאות קטנות קרובות זו לזו — מאותו חלון */
class Reader {
  constructor(blob) { this.b = blob; this.size = blob.size; this.wp = 0; this.w = new Uint8Array(0); }
  async need(pos, len) {
    if (pos >= this.wp && pos + len <= this.wp + this.w.length) return;
    const end = Math.min(this.size, pos + Math.max(len, CHUNK));
    this.w = new Uint8Array(await this.b.slice(pos, end).arrayBuffer());
    this.wp = pos;
  }
  async bytes(pos, len) {
    if (len > CHUNK) return new Uint8Array(await this.b.slice(pos, pos + len).arrayBuffer());
    await this.need(pos, len);
    return this.w.subarray(pos - this.wp, pos - this.wp + len);
  }
}

const utf8 = (u) => new TextDecoder('utf-8').decode(u);
const uint = (u) => { let v = 0; for (let i = 0; i < u.length; i++) v = v * 256 + u[i]; return v; };
const flt = (u) => { const d = new DataView(u.buffer, u.byteOffset, u.byteLength); return u.length === 4 ? d.getFloat32(0) : u.length === 8 ? d.getFloat64(0) : 0; };

/* קוד שפה של שלוש אותיות (ISO 639-2) → שתיים, לשמות ולבחירת שפת המקור */
const L3 = { eng: 'en', heb: 'he', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', spa: 'es', ita: 'it', por: 'pt', rus: 'ru', ara: 'ar', chi: 'zh', zho: 'zh',
  jpn: 'ja', kor: 'ko', dut: 'nl', nld: 'nl', pol: 'pl', tur: 'tr', swe: 'sv', nor: 'no', nob: 'no', dan: 'da', fin: 'fi', gre: 'el', ell: 'el', hun: 'hu',
  cze: 'cs', ces: 'cs', rum: 'ro', ron: 'ro', ukr: 'uk', hin: 'hi', tha: 'th', vie: 'vi', ind: 'id', may: 'ms', msa: 'ms', per: 'fa', fas: 'fa',
  bul: 'bg', hrv: 'hr', srp: 'sr', slo: 'sk', slk: 'sk', slv: 'sl', est: 'et', lav: 'lv', lit: 'lt', cat: 'ca', baq: 'eu', eus: 'eu', glg: 'gl', ice: 'is', isl: 'is' };
export function lang2(code) {
  const c = String(code || '').toLowerCase().split(/[-_]/)[0];
  if (!c || c === 'und' || c === 'mul' || c === 'zxx') return '';
  return c.length === 2 ? c : L3[c] || c;
}

/* ---------------- זמנים וקבצים ---------------- */
const p2 = (n) => String(n).padStart(2, '0');
const srtT = (ms) => { ms = Math.max(0, Math.round(ms)); return `${p2(Math.floor(ms / 3600e3))}:${p2(Math.floor(ms / 60e3) % 60)}:${p2(Math.floor(ms / 1e3) % 60)},${String(ms % 1e3).padStart(3, '0')}`; };
const vttT = (ms) => srtT(ms).replace(',', '.');
const assT = (ms) => { ms = Math.max(0, Math.round(ms)); return `${Math.floor(ms / 3600e3)}:${p2(Math.floor(ms / 60e3) % 60)}:${p2(Math.floor(ms / 1e3) % 60)}.${p2(Math.floor(ms % 1e3 / 10))}`; };
const clean = (t) => String(t || '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');

/* קטעים {s, e, t, o (סדר קריאה)} → קובץ בפורמט של הרצועה. סדר לפי זמן, ובאותו זמן — לפי סדר הקריאה */
export function cuesToFile(fmt, cues, head) {
  const cs = cues.filter((c) => c.t && c.e > c.s).sort((a, b) => a.s - b.s || (a.o || 0) - (b.o || 0));
  if (fmt === 'vtt') return 'WEBVTT\n\n' + cs.map((c) => `${vttT(c.s)} --> ${vttT(c.e)}\n${clean(c.t)}`).join('\n\n') + '\n';
  if (fmt === 'ass') {
    // הכותרת מהרצועה (סגנונות) בלי [Events] משלה — שורת Format אחת שתואמת את השורות שאנחנו כותבים
    let hd = clean(head || '[Script Info]\nScriptType: v4.00+');
    const k = hd.search(/^\[Events\]/im);
    if (k >= 0) hd = hd.slice(0, k).replace(/\n+$/, '');
    const out = cs.map((c) => {
      const f = String(c.t).replace(/\r?\n/g, '\\N').split(',');
      // בתוך MKV: ReadOrder, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text
      const layer = f[1] || '0', rest = f.slice(2, 8), text = f.slice(8).join(',');
      while (rest.length < 6) rest.push(rest.length >= 2 && rest.length <= 4 ? '0' : '');
      return `Dialogue: ${layer},${assT(c.s)},${assT(c.e)},${rest.join(',')},${text}`;
    });
    return hd + '\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' + out.join('\n') + '\n';
  }
  return cs.map((c, i) => `${i + 1}\n${srtT(c.s)} --> ${srtT(c.e)}\n${clean(c.t)}`).join('\n\n') + '\n';
}

async function inflate(u, kind) {
  if (typeof DecompressionStream !== 'function') throw new Error('no_inflate');
  const ds = new DecompressionStream(kind);
  const out = new Response(new Blob([u]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}

/* ---------------- Matroska / WebM ---------------- */
const ID = { EBML: 0x1A45DFA3, SEGMENT: 0x18538067, INFO: 0x1549A966, TRACKS: 0x1654AE6B, CLUSTER: 0x1F43B675, CUES: 0x1C53BB6B, TAGS: 0x1254C367,
  CHAPTERS: 0x1043A770, ATTACH: 0x1941A469, SEEKHEAD: 0x114D9B74, TC: 0xE7, SIMPLE: 0xA3, GROUP: 0xA0, BLOCK: 0xA1, BDUR: 0x9B };
const SEG_LEVEL = new Set([ID.INFO, ID.TRACKS, ID.CLUSTER, ID.CUES, ID.TAGS, ID.CHAPTERS, ID.ATTACH, ID.SEEKHEAD]);

function vint(u, i, keep) {
  const b = u[i];
  if (b === undefined || b === 0) return null;
  let len = 1, mask = 0x80;
  while (!(b & mask)) { len++; mask >>= 1; }
  if (i + len > u.length) return null;
  let v = keep ? b : b & (mask - 1), ones = (b & (mask - 1)) === mask - 1;
  for (let k = 1; k < len; k++) { v = v * 256 + u[i + k]; if (u[i + k] !== 255) ones = false; }
  return { v, len, unknown: !keep && ones };
}
/* כותרת אלמנט: מזהה, גודל (null = לא ידוע), איפה מתחיל התוכן */
async function head(r, pos) {
  if (pos >= r.size) return null;
  const u = await r.bytes(pos, Math.min(12, r.size - pos));
  const id = vint(u, 0, true);
  if (!id) return null;
  const sz = vint(u, id.len, false);
  if (!sz) return null;
  return { id: id.v, size: sz.unknown ? null : sz.v, data: pos + id.len + sz.len };
}
/* ילדים של אלמנט שכולו בזיכרון */
function kids(u) {
  const out = [];
  let i = 0;
  while (i < u.length) {
    const id = vint(u, i, true); if (!id) break;
    const sz = vint(u, i + id.len, false); if (!sz) break;
    const d = i + id.len + sz.len, end = sz.unknown ? u.length : Math.min(u.length, d + sz.v);
    out.push({ id: id.v, u: u.subarray(d, end) });
    i = end;
  }
  return out;
}
const IMAGE_MKV = /^S_(HDMV\/PGS|VOBSUB|DVBSUB|IMAGE)/;
function mkvTrack(u) {
  const t = { lang: 'eng', def: true, forced: false, sdh: false, name: '', codec: '', type: 0, num: 0, dd: 0, cp: null, comp: null, enc: false };
  for (const k of kids(u)) {
    if (k.id === 0xD7) t.num = uint(k.u);
    else if (k.id === 0x83) t.type = uint(k.u);
    else if (k.id === 0x86) t.codec = utf8(k.u).replace(/\0+$/, '');
    else if (k.id === 0x63A2) t.cp = k.u.slice();
    else if (k.id === 0x22B59C) t.lang = utf8(k.u).replace(/\0+$/, '');
    else if (k.id === 0x22B59D) t.bcp = utf8(k.u).replace(/\0+$/, '');
    else if (k.id === 0x536E) t.name = utf8(k.u).replace(/\0+$/, '');
    else if (k.id === 0x88) t.def = uint(k.u) !== 0;
    else if (k.id === 0x55AA) t.forced = uint(k.u) !== 0;
    else if (k.id === 0x55AB) t.sdh = uint(k.u) !== 0;
    else if (k.id === 0x23E383) t.dd = uint(k.u);
    else if (k.id === 0x6D80) {   // ContentEncodings: דחיסה (zlib / הסרת כותרת), הצפנה — לא נתמכת
      for (const e of kids(k.u)) if (e.id === 0x6240) {
        let type = 0, algo = 0, set = null, comp = false;
        for (const x of kids(e.u)) {
          if (x.id === 0x5033) type = uint(x.u);
          else if (x.id === 0x5034) { comp = true; for (const y of kids(x.u)) { if (y.id === 0x4254) algo = uint(y.u); else if (y.id === 0x4255) set = y.u.slice(); } }
          else if (x.id === 0x5035) t.enc = true;
        }
        if (type === 1) t.enc = true;
        else if (comp) t.comp = { algo, set };
      }
    }
  }
  return t;
}
function mkvFmt(codec) {
  if (codec === 'S_TEXT/UTF8' || codec === 'S_TEXT/ASCII') return 'srt';
  if (codec === 'S_TEXT/ASS' || codec === 'S_TEXT/SSA' || codec === 'S_ASS' || codec === 'S_SSA') return 'ass';
  if (codec === 'S_TEXT/WEBVTT' || codec === 'D_WEBVTT/SUBTITLES') return 'vtt';
  return '';
}

async function mkvScan(r, opt) {
  const want = opt && opt.want ? new Set(opt.want) : null;   // מספרי רצועות לחלץ; בלי — רק הרשימה
  const out = { kind: 'mkv', tracks: [], dur: 0, scale: 1e6, partial: false };
  const h0 = await head(r, 0);
  if (!h0 || h0.id !== ID.EBML) return null;
  let pos = h0.data + (h0.size || 0);
  let seg = await head(r, pos);
  while (seg && seg.id !== ID.SEGMENT) { if (seg.size === null) return out; pos = seg.data + seg.size; seg = await head(r, pos); }
  if (!seg) return out;
  const segEnd = seg.size === null ? r.size : Math.min(r.size, seg.data + seg.size);
  const prog = opt && opt.onProgress;
  const tr = new Map(), cues = new Map(), last = new Map();
  let haveTracks = false, ord = 0, lastP = 0;
  const step = (at) => { if (prog && at - lastP > r.size / 200) { lastP = at; prog(Math.min(1, at / r.size)); } };
  const onBlock = async (u, cl, dur) => {
    const tn = vint(u, 0, false); if (!tn) return;
    const t = tr.get(tn.v);
    if (!t || !cues.has(tn.v)) return;
    const rel = ((u[tn.len] << 8) | u[tn.len + 1]) << 16 >> 16, flags = u[tn.len + 2];
    if (flags & 0x06) { t.laced = (t.laced || 0) + 1; return; }   // שרשור (lacing) — לא קורה בכתוביות טקסט
    let data = u.subarray(tn.len + 3);
    if (t.comp) {
      if (t.comp.algo === 3) { const s = t.comp.set || new Uint8Array(0); const m = new Uint8Array(s.length + data.length); m.set(s); m.set(data, s.length); data = m; }
      else if (t.comp.algo === 0) data = await inflate(data, 'deflate');
      else return;
    }
    const s = (cl + rel) * out.scale / 1e6;
    let e = dur ? s + dur * out.scale / 1e6 : t.dd ? s + t.dd / 1e6 : 0;
    const prev = last.get(tn.v);
    if (prev && !prev.e) prev.e = Math.min(s, prev.s + 6000);   // בלי משך — עד הבא (עד 6 שנ׳)
    const c = { s, e, t: utf8(data).replace(/\0+$/, ''), o: t.fmt === 'ass' ? parseInt(utf8(data), 10) || ord : ord };
    ord++;
    cues.get(tn.v).push(c);
    last.set(tn.v, c);
  };
  pos = seg.data;
  while (pos < segEnd) {
    const el = await head(r, pos);
    if (!el) break;
    const end = el.size === null ? segEnd : Math.min(segEnd, el.data + el.size);
    if (el.id === ID.INFO) {
      for (const k of kids(await r.bytes(el.data, end - el.data))) {
        if (k.id === 0x2AD7B1) out.scale = uint(k.u) || 1e6;
        else if (k.id === 0x4489) out.durRaw = flt(k.u);
      }
    } else if (el.id === ID.TRACKS) {
      for (const k of kids(await r.bytes(el.data, end - el.data))) {
        if (k.id !== 0xAE) continue;
        const t = mkvTrack(k.u);
        if (t.type !== 0x11) continue;   // רק כתוביות
        t.fmt = mkvFmt(t.codec);
        tr.set(t.num, t);
        if (want && want.has(t.num) && t.fmt && !t.enc) cues.set(t.num, []);
      }
      haveTracks = true;
      if (!want) break;   // רשימה בלבד — הרצועות בתחילת הקובץ
    } else if (el.id === ID.CLUSTER && want) {
      let cl = 0, p = el.data;
      while (p < end) {
        const c = await head(r, p);
        if (!c) { p = end; break; }
        if (el.size === null && SEG_LEVEL.has(c.id)) break;   // אשכול בלי גודל — נגמר באלמנט הבא ברמה העליונה
        const ce = c.size === null ? end : Math.min(end, c.data + c.size);
        if (c.id === ID.TC) cl = uint(await r.bytes(c.data, ce - c.data));
        else if (c.id === ID.SIMPLE) {
          const hd = await r.bytes(c.data, Math.min(8, ce - c.data));
          const tn = vint(hd, 0, false);
          if (tn && cues.has(tn.v)) await onBlock((await r.bytes(c.data, ce - c.data)).slice(), cl, 0);
        } else if (c.id === ID.GROUP) {
          const hd = await r.bytes(c.data, Math.min(16, ce - c.data));
          const b0 = vint(hd, 0, true), bs = b0 && vint(hd, b0.len, false);
          const tn = b0 && b0.v === ID.BLOCK && bs && vint(hd, b0.len + bs.len, false);
          if (!tn || cues.has(tn.v)) {
            let blk = null, dur = 0;
            for (const k of kids((await r.bytes(c.data, ce - c.data)).slice())) { if (k.id === ID.BLOCK) blk = k.u; else if (k.id === ID.BDUR) dur = uint(k.u); }
            if (blk) await onBlock(blk, cl, dur);
          }
        }
        p = ce;
        step(p);
      }
      if (el.size === null) { pos = p; continue; }
    }
    step(end);
    if (want && haveTracks && cues.size === 0) break;   // אין מה לחלץ
    pos = end;
  }
  if (out.durRaw) out.dur = Math.round(out.durRaw * out.scale / 1e6);
  delete out.durRaw;
  for (const t of tr.values()) {
    const kind = t.fmt && !t.enc ? 'text' : IMAGE_MKV.test(t.codec) ? 'image' : 'other';
    const item = { id: t.num, codec: t.codec, kind, fmt: kind === 'text' ? t.fmt : '', lang: lang2(t.bcp || t.lang), name: t.name, def: t.def, forced: t.forced, sdh: t.sdh || /\bSDH\b|hearing/i.test(t.name) };
    if (cues.has(t.num)) {
      const cs = cues.get(t.num);
      const l = cs[cs.length - 1];
      if (l && !l.e) l.e = l.s + 3000;
      const head0 = t.fmt === 'ass' && t.cp ? utf8(t.cp) : '';
      item.n = cs.filter((c) => c.t.trim()).length;
      item.text = cuesToFile(t.fmt, cs, head0);
    }
    out.tracks.push(item);
  }
  if (prog) prog(1);
  return out;
}

/* ---------------- MP4 / MOV ---------------- */
async function boxHead(r, pos, end) {
  if (pos + 8 > end) return null;
  const u = await r.bytes(pos, Math.min(16, end - pos));
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let size = dv.getUint32(0), hl = 8;
  const type = String.fromCharCode(u[4], u[5], u[6], u[7]);
  if (size === 1) { if (u.length < 16) return null; size = dv.getUint32(8) * 4294967296 + dv.getUint32(12); hl = 16; }
  else if (size === 0) size = end - pos;
  if (size < hl) return null;
  return { type, start: pos, data: pos + hl, end: Math.min(end, pos + size) };
}
function boxes(u) {
  const out = [];
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let i = 0;
  while (i + 8 <= u.length) {
    let size = dv.getUint32(i), hl = 8;
    const type = String.fromCharCode(u[i + 4], u[i + 5], u[i + 6], u[i + 7]);
    if (size === 1) { size = dv.getUint32(i + 8) * 4294967296 + dv.getUint32(i + 12); hl = 16; } else if (size === 0) size = u.length - i;
    if (size < hl || i + size > u.length) break;
    out.push({ type, u: u.subarray(i + hl, i + size) });
    i += size;
  }
  return out;
}
const child = (u, type) => { const b = boxes(u).find((x) => x.type === type); return b ? b.u : null; };
const path = (u, ...ts) => { for (const t of ts) { if (!u) return null; u = child(u, t); } return u; };
const GENERIC = /^(sub(title)?handler|text\s*handler|handler|apple\s*text\s*media\s*handler|core\s*media\s*text|gpac.*|isomedia.*|l-smash.*)$/i;

function mp4Track(trak, mts) {
  const dvOf = (u) => new DataView(u.buffer, u.byteOffset, u.byteLength);
  const mdia = child(trak, 'mdia'); if (!mdia) return null;
  const hdlr = child(mdia, 'hdlr'), mdhd = child(mdia, 'mdhd');
  if (!hdlr || !mdhd) return null;
  const htype = String.fromCharCode(hdlr[8], hdlr[9], hdlr[10], hdlr[11]);
  if (!['sbtl', 'text', 'subt', 'clcp'].includes(htype)) return null;
  const md = dvOf(mdhd), v = mdhd[0];
  const scale = v === 1 ? md.getUint32(20) : md.getUint32(12);
  const lp = v === 1 ? md.getUint16(32) : md.getUint16(20);
  const lang = String.fromCharCode(((lp >> 10) & 31) + 0x60, ((lp >> 5) & 31) + 0x60, (lp & 31) + 0x60);
  const elng = child(mdia, 'elng');
  const tkhd = child(trak, 'tkhd');
  const id = tkhd ? (tkhd[0] === 1 ? dvOf(tkhd).getUint32(20) : dvOf(tkhd).getUint32(12)) : 0;
  const flags = tkhd ? (tkhd[1] << 16) | (tkhd[2] << 8) | tkhd[3] : 1;
  let name = utf8(hdlr.subarray(24)).replace(/\0+$/, '').replace(/^[\x00-\x1f]+/, '').trim();
  const un = path(trak, 'udta', 'name');
  if (un) name = utf8(un).replace(/\0+$/, '').trim();
  if (GENERIC.test(name)) name = '';
  const stbl = path(mdia, 'minf', 'stbl');
  const stsd = stbl && child(stbl, 'stsd');
  const entry = stsd && stsd.length >= 16 ? String.fromCharCode(stsd[12], stsd[13], stsd[14], stsd[15]) : '';
  const fmt = entry === 'tx3g' || entry === 'text' ? 'srt' : entry === 'wvtt' ? 'vtt' : '';
  const kind = fmt ? 'text' : entry === 'mp4s' ? 'image' : 'other';
  // רשימת העריכה (elst): עריכה ריקה בהתחלה = הרצועה מתחילה מאוחר יותר (ffmpeg כותב כך כתוביות שמתחילות אחרי 0)
  let shift = 0;
  const elst = path(trak, 'edts', 'elst');
  if (elst && mts) {
    const d = dvOf(elst), v1 = elst[0] === 1, n = d.getUint32(4), w = v1 ? 20 : 12;
    for (let i = 0; i < n; i++) {
      const o = 8 + i * w;
      const sd = v1 ? d.getUint32(o) * 4294967296 + d.getUint32(o + 4) : d.getUint32(o);
      const mt = v1 ? d.getInt32(o + 8) * 4294967296 + d.getUint32(o + 12) : d.getInt32(o + 4);
      if (mt === -1) { shift += sd * 1000 / mts; continue; }
      shift -= mt * 1000 / scale;
      break;
    }
  }
  return { id, codec: entry || htype, kind, fmt, lang: lang2(elng ? utf8(elng.subarray(4)).replace(/\0+$/, '') : lang), name, def: !!(flags & 1), forced: false, sdh: /\bSDH\b|hearing/i.test(name), scale, stbl, shift };
}
/* טבלת הדגימות → [{off, size, s, e}] במילישניות */
function mp4Samples(stbl, scale) {
  const dv = (u) => new DataView(u.buffer, u.byteOffset, u.byteLength);
  const stts = child(stbl, 'stts'), stsc = child(stbl, 'stsc'), stsz = child(stbl, 'stsz');
  const stco = child(stbl, 'stco'), co64 = child(stbl, 'co64');
  if (!stts || !stsc || !stsz || !(stco || co64)) return [];
  const sz = dv(stsz), fixed = sz.getUint32(4), n = sz.getUint32(8);
  const size = (i) => fixed || sz.getUint32(12 + i * 4);
  const co = stco ? dv(stco) : dv(co64), nch = co.getUint32(4);
  const chunkOff = (i) => stco ? co.getUint32(8 + i * 4) : co.getUint32(8 + i * 8) * 4294967296 + co.getUint32(12 + i * 8);
  const sc = dv(stsc), nsc = sc.getUint32(4);
  const out = [];
  let si = 0;
  for (let k = 0; k < nsc && si < n; k++) {
    const first = sc.getUint32(8 + k * 12) - 1, per = sc.getUint32(12 + k * 12);
    const next = k + 1 < nsc ? sc.getUint32(8 + (k + 1) * 12) - 1 : nch;
    for (let ch = first; ch < next && si < n; ch++) {
      let off = chunkOff(ch);
      for (let j = 0; j < per && si < n; j++, si++) { out.push({ off, size: size(si) }); off += size(si); }
    }
  }
  const st = dv(stts), ne = st.getUint32(4);
  let t = 0, i = 0;
  for (let k = 0; k < ne; k++) {
    const cnt = st.getUint32(8 + k * 8), d = st.getUint32(12 + k * 8);
    for (let j = 0; j < cnt && i < out.length; j++, i++) { out[i].s = t * 1000 / scale; t += d; out[i].e = t * 1000 / scale; }
  }
  return out.slice(0, i);
}
function tx3gText(u) {
  if (u.length < 2) return '';
  const len = (u[0] << 8) | u[1];
  const b = u.subarray(2, 2 + len);
  if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b.subarray(2));
  return utf8(b);
}
function wvttText(u) {
  const parts = [];
  for (const b of boxes(u)) if (b.type === 'vttc') { const p = child(b.u, 'payl'); if (p) parts.push(utf8(p)); }
  return parts.join('\n');
}
async function mp4Scan(r, opt) {
  const want = opt && opt.want ? new Set(opt.want) : null;
  let pos = 0, moov = null, ftyp = false;
  while (pos < r.size) {
    const b = await boxHead(r, pos, r.size);
    if (!b) break;
    if (b.type === 'ftyp') ftyp = true;
    if (b.type === 'moov') { if (b.end - b.data > 128 * 1024 * 1024) return null; moov = (await r.bytes(b.data, b.end - b.data)).slice(); break; }
    if (!ftyp && pos === 0 && !['ftyp', 'moov', 'mdat', 'free', 'skip', 'wide'].includes(b.type)) return null;
    pos = b.end;
  }
  if (!moov) return ftyp ? { kind: 'mp4', tracks: [], dur: 0 } : null;
  const out = { kind: 'mp4', tracks: [], dur: 0, frag: !!child(moov, 'mvex') };
  const mvhd = child(moov, 'mvhd');
  let mts = 0;
  if (mvhd) { const d = new DataView(mvhd.buffer, mvhd.byteOffset, mvhd.byteLength); const v1 = mvhd[0] === 1; const ts = d.getUint32(v1 ? 20 : 12); mts = ts; const du = v1 ? d.getUint32(24) * 4294967296 + d.getUint32(28) : d.getUint32(16); out.dur = ts ? Math.round(du * 1000 / ts) : 0; }
  const prog = opt && opt.onProgress;
  const tracks = boxes(moov).filter((b) => b.type === 'trak').map((b) => mp4Track(b.u, mts)).filter(Boolean);
  let done = 0;
  for (const t of tracks) {
    const item = { id: t.id, codec: t.codec, kind: t.kind, fmt: t.fmt, lang: t.lang, name: t.name, def: t.def, forced: t.forced, sdh: t.sdh };
    if (want && want.has(t.id) && t.kind === 'text') {
      const ss = mp4Samples(t.stbl, t.scale);
      const cues = [];
      for (let i = 0; i < ss.length; i++) {
        const s = ss[i];
        if (!s.size) continue;
        const u = await r.bytes(s.off, s.size);
        const txt = t.fmt === 'vtt' ? wvttText(u) : tx3gText(u);
        if (txt.trim()) cues.push({ s: s.s + t.shift, e: s.e + t.shift, t: txt, o: i });
        if (prog && i % 200 === 0) prog((done + i / ss.length) / want.size);
      }
      item.n = cues.length;
      item.text = cuesToFile(t.fmt, cues);
      done++;
    }
    out.tracks.push(item);
  }
  if (prog) prog(1);
  return out;
}

/* ---------------- ממשק ---------------- */
/* רשימת רצועות הכתוביות (מהירה — רק תחילת הקובץ ב־MKV, ה־moov ב־MP4). null = לא MKV/MP4 */
export async function listTracks(blob) {
  const r = new Reader(blob);
  try {
    const sig = await r.bytes(0, Math.min(12, r.size));
    if (sig[0] === 0x1A && sig[1] === 0x45 && sig[2] === 0xDF && sig[3] === 0xA3) return await mkvScan(r);
    if (String.fromCharCode(sig[4], sig[5], sig[6], sig[7]).match(/^(ftyp|moov|mdat|free|wide|skip)$/)) return await mp4Scan(r);
  } catch (e) { return null; }
  return null;
}
/* חילוץ הרצועות שנבחרו (ids) — מעבר אחד על הקובץ ב־MKV. כל רצועה: { …, n, text } */
export async function extractTracks(blob, ids, onProgress) {
  const r = new Reader(blob);
  const sig = await r.bytes(0, Math.min(12, r.size));
  const opt = { want: ids, onProgress };
  if (sig[0] === 0x1A && sig[1] === 0x45 && sig[2] === 0xDF && sig[3] === 0xA3) return mkvScan(r, opt);
  return mp4Scan(r, opt);
}
