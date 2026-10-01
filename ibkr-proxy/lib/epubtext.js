/* האקדמיה (שלב 5): טקסט רציף מקובץ EPUB — בלי ספריות: קורא את ה־ZIP (central directory), פותח עם zlib,
   ומחבר את הפרקים לפי סדר ה־spine של ה־OPF. משמש רק לניתוח המכתב (תקציר/רעיונות) — לא נשמר בשום מקום. */
const zlib = require('zlib');

function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not_zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    files.set(name, { method, csize, off });
    p += 46 + nlen + xlen + clen;
  }
  return (name) => {
    const f = files.get(name); if (!f) return null;
    const lh = f.off, start = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
    const raw = buf.subarray(start, start + f.csize);
    return (f.method === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8');
  };
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function htmlText(s) {
  return String(s)
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] || ' '))
    .replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();
}
function dirOf(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); }
function joinPath(base, rel) {
  const parts = (base + decodeURIComponent(rel.split('#')[0])).split('/'); const out = [];
  for (const x of parts) { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); }
  return out.join('/');
}
/* מחזיר { title, text } — הטקסט חתוך ל־max תווים (ברירת מחדל 150 אלף) */
function epubText(buf, max = 150000) {
  const get = readZip(buf);
  const container = get('META-INF/container.xml') || '';
  const opfPath = (container.match(/full-path="([^"]+)"/) || [])[1];
  const opf = opfPath && get(opfPath);
  if (!opf) throw new Error('no_opf');
  const base = dirOf(opfPath);
  const items = {};
  opf.replace(/<item\b[^>]*>/g, (tag) => {
    const id = (tag.match(/\bid="([^"]+)"/) || [])[1], href = (tag.match(/\bhref="([^"]+)"/) || [])[1];
    if (id && href) items[id] = href;
    return '';
  });
  const title = htmlText((opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/) || [])[1] || '');
  let text = '';
  const re = /<itemref\b[^>]*idref="([^"]+)"[^>]*>/g;
  for (let m; (m = re.exec(opf)) && text.length < max;) {
    const href = items[m[1]]; if (!href) continue;
    const doc = get(joinPath(base, href)); if (!doc) continue;
    text += htmlText(doc) + '\n';
  }
  return { title, text: text.slice(0, max) };
}
module.exports = { epubText, htmlText, readZip };
