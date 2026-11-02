// 02/11/2026 (Studio DM סבב 4, ‏11): קוד QR לחלון של התוסף — "להוריד בטלפון". נכתב כאן לפי התקן (ISO/IEC 18004):
// מצב בתים, רמת תיקון M, גרסאות 1–25, שמונת המסכים לפי הניקוד. בלי ספריות ובלי רשת. נבדק מול המפענח של zxing
// (tools/chrome-ext-qr.mjs → testDm/resources/qr, ‏DmQrExtTest).

// לכל גרסה (1–25), רמה M: מילות תיקון לבלוק ומספר הבלוקים
const EC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28];
const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21];
export const MAX_VER = 25;

/** כמה מודולים פנויים לנתונים (בלי התבניות הקבועות) */
function rawModules(v) {
  let n = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const a = Math.floor(v / 7) + 2;
    n -= (25 * a - 10) * a - 55;
    if (v >= 7) n -= 36;
  }
  return n;
}
const totalWords = (v) => Math.floor(rawModules(v) / 8);
const dataWords = (v) => totalWords(v) - EC_PER_BLOCK[v - 1] * BLOCKS[v - 1];

/* ---------- Reed–Solomon מעל GF(256), פולינום 0x11D ---------- */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}

function remainder(data, gen) {
  const n = gen.length - 1;
  const r = new Array(n).fill(0);
  for (const b of data) {
    const f = b ^ r[0];
    r.shift(); r.push(0);
    for (let i = 0; i < n; i++) r[i] ^= mul(gen[i + 1], f);
  }
  return r;
}

/* ---------- הנתונים ---------- */

function codewords(bytes, v) {
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4);                                  // מצב בתים
  put(bytes.length, v <= 9 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataWords(v) * 8;
  put(0, Math.min(4, cap - bits.length));      // סיום
  while (bits.length % 8) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let p = 0; out.length < dataWords(v); p++) out.push(p % 2 ? 0x11 : 0xec);
  // חלוקה לבלוקים, תיקון לכל בלוק, ושזירה
  const nb = BLOCKS[v - 1], ec = EC_PER_BLOCK[v - 1], tot = totalWords(v);
  const shortLen = Math.floor(tot / nb), nShort = nb - (tot % nb);
  const gen = generator(ec);
  const blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const len = shortLen - ec + (i < nShort ? 0 : 1);
    const d = out.slice(k, k + len); k += len;
    blocks.push({ d, e: remainder(d, gen) });
  }
  const res = [];
  for (let i = 0; i <= shortLen - ec; i++) for (const b of blocks) if (i < b.d.length) res.push(b.d[i]);
  for (let i = 0; i < ec; i++) for (const b of blocks) res.push(b.e[i]);
  return res;
}

/* ---------- המטריצה ---------- */

function alignPos(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, size = v * 4 + 17;
  const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p);
  return r;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function build(v, words, mask) {
  const size = v * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }   // תזמון
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = alignPos(v);
  for (const ax of ap) for (const ay of ap) {
    if ((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  format(m, fn, size, 0, set);                 // שמירת המקום (הערך האמיתי בסוף)
  if (v >= 7) {
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const bits = (v << 12) | r;
    for (let i = 0; i < 18; i++) { const d = ((bits >>> i) & 1) === 1, a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, d); set(b, a, d); }
  }
  // הנתונים בזיגזג מלמטה מימין, עמודה 6 בחוץ
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (fn[y][x]) continue;
      if (i < words.length * 8) m[y][x] = ((words[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
      i++;
    }
  }
  const f = MASKS[mask];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && f(x, y)) m[y][x] = !m[y][x];
  format(m, fn, size, mask, set);
  return m;
}

/** תבנית המידע (רמה M = 00, והמסך) עם BCH, בשני העותקים */
function format(m, fn, size, mask, set) {
  const data = (0 << 3) | mask;
  let r = data; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
  const bits = ((data << 10) | r) ^ 0x5412;
  const b = (i) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, b(i));
  set(8, 7, b(6)); set(8, 8, b(7)); set(7, 8, b(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, b(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, b(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, b(i));
  set(8, size - 8, true);
}

/** ניקוד לפי התקן: רצפים, ריבועים, תבניות שדומות לסמן, ואיזון בין כהה לבהיר */
function penalty(m) {
  const n = m.length; let p = 0;
  const lines = [];
  for (let y = 0; y < n; y++) lines.push(m[y]);
  for (let x = 0; x < n; x++) lines.push(m.map((r) => r[x]));
  for (const l of lines) {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && l[i] === l[i - 1]) run++;
      else { if (run >= 5) p += 3 + run - 5; run = 1; }
    }
    const s = l.map((d) => (d ? '1' : '0')).join('');
    for (const pat of ['10111010000', '00001011101']) { let k = s.indexOf(pat); while (k >= 0) { p += 40; k = s.indexOf(pat, k + 1); } }
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
  }
  let dark = 0; for (const r of m) for (const d of r) if (d) dark++;
  p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  return p;
}

/** טקסט → מטריצה (שורות של true = כהה). null כשארוך מדי */
export function qr(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let v = 1;
  while (v <= MAX_VER && 4 + (v <= 9 ? 8 : 16) + bytes.length * 8 > dataWords(v) * 8) v++;
  if (v > MAX_VER) return null;
  const words = codewords(bytes, v);
  let best = null, bp = Infinity;
  for (let k = 0; k < 8; k++) { const m = build(v, words, k), s = penalty(m); if (s < bp) { bp = s; best = m; } }
  return best;
}

/** הקישור שהטלפון מבין (Studio DM, ‏DmScan → DmApi.fromUri): ‏studiodm://add?url=… */
export const phoneLink = (url) => 'studiodm://add?url=' + encodeURIComponent(url);
