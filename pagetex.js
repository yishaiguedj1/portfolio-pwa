/* v343 (בקשת המשתמש 05/10/2026): "צייר העמוד" — מצייר עמוד של ספר לקנבס ברזולוציה גבוהה, אחד לאחד מול הפריסה
   האמיתית: המיקום של כל מילה, תמונה, קו ורקע נקרא מהמסמך כפי שהמנוע פרס אותו (Range.getClientRects), והציור
   בגופן, בגודל, בעובי ובצבע המחושבים. משמש לגב הדף בדפדוף התלת־ממדי (pagecurl.js) — טקסט הפוך חד ומדויק כמו בקינדל.
   בלי ייבוא ובלי DOM בטעינה. */

// מילה עם כיוון: עברית/ערבית = RTL; אחרת LTR (מספרים/פיסוק לבד — כיוון האלמנט)
const RTL_CH = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CH = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;
export function runDir(word, elDir) {             // כיוון הציור של מילה — טהורה
  if (RTL_CH.test(word)) return 'rtl';
  if (LTR_CH.test(word)) return 'ltr';
  return elDir === 'rtl' ? 'rtl' : 'ltr';
}
export function fontString(cs) {                  // מחרוזת font לקנבס מסגנון מחושב — טהורה (על אובייקט פשוט)
  const st = cs.fontStyle && cs.fontStyle !== 'normal' ? cs.fontStyle + ' ' : '';
  const wt = cs.fontWeight || '400';
  return st + wt + ' ' + cs.fontSize + ' ' + cs.fontFamily;
}
export function words(text) {                     // מילים עם המיקום שלהן בטקסט (בלי רווחים) — טהורה
  const out = [], re = /\S+/g; let m;
  while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length, m[0]]);
  return out;
}
const isTransparent = (c) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)\s*$/.test(c);

/* doc: מסמך הפרק (אמיתי או שכפול) שה־iframe שלו (frame) מוצג/ממוקם כך שהעמוד נמצא ב־region (קואורדינטות המסך);
   shiftX: הזזה אופקית נוספת (עמוד שכן באותו מסמך). מחזיר קנבס W·dpr × H·dpr בקואורדינטות הקופסה (box). */
export function paintPage(o) {
  const { doc, frame, box, region, W, H, dpr, page, shiftX = 0, foot, overlay, fonts } = o;
  const cv = (o.canvas || document.createElement('canvas'));
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = page; ctx.fillRect(0, 0, W, H);
  const br = box.getBoundingClientRect(), fr = frame.getBoundingClientRect();
  const ox = fr.left - br.left + shiftX, oy = fr.top - br.top;
  const rx0 = region.left - br.left, ry0 = region.top - br.top, rx1 = rx0 + region.width, ry1 = ry0 + region.height;
  ctx.save();
  ctx.beginPath(); ctx.rect(rx0, ry0, region.width, region.height); ctx.clip();
  const win = doc.defaultView, inR = (r) => r.right + ox > rx0 && r.left + ox < rx1 && r.bottom + oy > ry0 && r.top + oy < ry1;
  // 1) רקעים, גבולות ותמונות — רק לאלמנטים שחותכים את העמוד
  const els = doc.body ? doc.body.getElementsByTagName('*') : [];
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const tag = el.localName;
    if (tag === 'script' || tag === 'style' || tag === 'head') continue;
    const rects = el.getClientRects();
    let hit = false;
    for (let k = 0; k < rects.length; k++) if (inR(rects[k])) { hit = true; break; }
    if (!hit) continue;
    const cs = win.getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (!isTransparent(cs.backgroundColor)) { ctx.fillStyle = cs.backgroundColor; for (const r of rects) ctx.fillRect(r.left + ox, r.top + oy, r.width, r.height); }
    for (const [side, dx, dy] of [['Top', 0, 0], ['Bottom', 0, 1], ['Left', 0, 0], ['Right', 1, 0]]) {
      const bw = parseFloat(cs['border' + side + 'Width']);
      if (!bw || cs['border' + side + 'Style'] === 'none' || isTransparent(cs['border' + side + 'Color'])) continue;
      ctx.fillStyle = cs['border' + side + 'Color'];
      for (const r of rects) {
        if (side === 'Top' || side === 'Bottom') ctx.fillRect(r.left + ox, r.top + oy + dy * (r.height - bw), r.width, bw);
        else ctx.fillRect(r.left + ox + dx * (r.width - bw), r.top + oy, bw, r.height);
      }
    }
    if ((tag === 'img' || tag === 'image') && rects[0]) {
      try {
        const r = rects[0];
        if (tag === 'img' && el.complete && el.naturalWidth) ctx.drawImage(el, r.left + ox, r.top + oy, r.width, r.height);
      } catch (e) {}
    }
  }
  // 2) טקסט — מילה מילה במיקום המדויק שלה; מילה שנשברה בין שורות — לפי גרפמות
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const rg = doc.createRange();
  const top = doc.body || doc.documentElement;
  if (!top) { ctx.restore(); return cv; } // v349: המסמך נפרק (הקורא נסגר באמצע הציור) — דף ריק
  let tw;
  try { tw = doc.createTreeWalker(top, 4); } catch (e) { ctx.restore(); return cv; }
  const metr = new Map();
  let n;
  while ((n = tw.nextNode())) {
    const t = n.data; if (!t || !/\S/.test(t)) continue;
    const pe = n.parentElement; if (!pe) continue;
    rg.selectNodeContents(n);
    const all = rg.getClientRects(); let hit = false;
    for (let k = 0; k < all.length; k++) if (inR(all[k])) { hit = true; break; }
    if (!hit) continue;
    const cs = win.getComputedStyle(pe);
    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const font = fontString(cs);
    ctx.font = font;
    ctx.fillStyle = cs.color;
    try { ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing; } catch (e) {}
    let asc = metr.get(font);
    if (asc == null) { const m = ctx.measureText('אAgף'); asc = [m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.9, m.fontBoundingBoxDescent || parseFloat(cs.fontSize) * 0.25]; metr.set(font, asc); }
    const deco = /underline/.test(cs.textDecorationLine || '') ? (cs.textDecorationColor || cs.color) : null;
    for (const [a, b, w] of words(t)) {
      rg.setStart(n, a); rg.setEnd(n, b);
      const rs = rg.getClientRects();
      if (!rs.length) continue;
      if (rs.length === 1) drawRun(w, rs[0]);
      else if (seg) {                         // מילה שנשברה (מקף, שבירת שורה) — כל גרפמה במקומה
        let i = a;
        for (const { segment } of seg.segment(w)) {
          rg.setStart(n, i); rg.setEnd(n, i + segment.length); i += segment.length;
          const r1 = rg.getClientRects()[0]; if (r1) drawRun(segment, r1);
        }
      } else drawRun(w, rs[0]);
    }
    function drawRun(w, r) {
      if (!inR(r)) return;
      const dir = runDir(w, cs.direction);
      ctx.direction = dir;
      ctx.textAlign = dir === 'rtl' ? 'right' : 'left';
      // הבסיס: מלבן הטקסט = אזור התוכן של הגופן (ascent + descent), מיושר לפי היחס
      const k = r.height / (asc[0] + asc[1] || 1);
      const y = r.top + oy + asc[0] * k;
      ctx.fillText(w, (dir === 'rtl' ? r.right : r.left) + ox, y);
      if (deco) { ctx.fillStyle = deco; ctx.fillRect(r.left + ox, y + Math.max(1, asc[1] * 0.35), r.width, Math.max(1, parseFloat(cs.fontSize) / 16)); ctx.fillStyle = cs.color; }
    }
  }
  // 3) הדגשות של הקורא (שכבת ה־SVG של המנוע) — באותו צבע ושקיפות
  if (overlay) for (const el of overlay) {
    for (const r of el.querySelectorAll('rect')) {
      const q = r.getBoundingClientRect(); if (!q.width) continue;
      const cs = getComputedStyle(r), g = r.closest('g');
      ctx.globalAlpha = parseFloat((g && getComputedStyle(g).opacity) || 1) * parseFloat(cs.opacity || 1) * parseFloat(cs.fillOpacity || 1);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = cs.fill || r.getAttribute('fill') || 'yellow';
      ctx.fillRect(q.left - br.left + shiftX, q.top - br.top, q.width, q.height);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
  // 4) שורת התחתית של הקורא ("עוד 3 דק׳ בפרק", אחוזים) — מתקפלת עם הדף, כמו בקינדל
  if (foot) for (const sp of foot.querySelectorAll('span')) {
    const r = sp.getBoundingClientRect(); if (!r.width || !sp.textContent) continue;
    const cs = getComputedStyle(sp);
    ctx.font = fontString(cs); ctx.fillStyle = cs.color;
    const m = ctx.measureText(sp.textContent);
    const dir = runDir(sp.textContent, cs.direction);
    ctx.direction = dir; ctx.textAlign = dir === 'rtl' ? 'right' : 'left';
    ctx.fillText(sp.textContent, (dir === 'rtl' ? r.right : r.left) - br.left, r.top - br.top + (r.height + (m.fontBoundingBoxAscent || 0) - (m.fontBoundingBoxDescent || 0)) / 2);
  }
  void fonts;
  return cv;
}
