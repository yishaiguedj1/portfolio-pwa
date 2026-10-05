/* v342 (בקשת המשתמש 05/10/2026): אנימציית דפדוף כמו בקינדל — הדף מתקפל מהקצה החופשי, הגב שלו מראה את הטקסט
   הפוך (דף דק), צל רך על הדף שמתגלה ועל הדף שמתחת לכנף. בלי ייבוא ובלי DOM בטעינה (הגאומטריה נבדקת ב־node).

   הגאומטריה ("קיפול" של דף נייר, בקואורדינטות מנורמלות — הקצה החופשי מימין, השדרה משמאל; ספר RTL = שיקוף):
     קו הקיפול עובר דרך M = (W·(1−p), gy) בזווית φ מהאנך; n = נורמל יחידה לכיוון השדרה.
     p = 0 דף שטוח, p = 1 הדף הופך כולו. החלק שבצד השדרה ((X−M)·n > 0) נשאר במקומו,
     והחלק שמעבר לקו מתהפך עליו — שיקוף סביב הקו: X' = X − 2((X−M)·n)·n.
   הדפים: התוכן האמיתי (המנוע) + שני שכפולים של מסמך הפרק (iframe שקט בלי סקריפטים) שנבנים מראש בזמן מנוחה.
     קדימה: המנוע עובר מיד לעמוד הבא (מתחת), שכפול א׳ = העמוד הנוכחי (החלק השטוח), שכפול ב׳ = גב הדף.
     אחורה: המנוע עובר מיד לעמוד הקודם וחתוך לחלק השטוח, שכפול א׳ = העמוד הנוכחי מתחת, ב׳ = גב הדף הקודם. */

export function clipHalf(poly, M, n, s) {          // החלק של מצולע בצד אחד של קו (Sutherland–Hodgman) — טהורה
  const out = [];
  const f = (P) => s * ((P[0] - M[0]) * n[0] + (P[1] - M[1]) * n[1]);
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length], fa = f(A), fb = f(B);
    if (fa >= 0) out.push(A);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
  }
  return out;
}
export function reflectMatrix(M, n) {             // שיקוף סביב הקו (דרך M, נורמל n) כ־matrix() של CSS — טהורה
  const k = 2 * (M[0] * n[0] + M[1] * n[1]);
  return [1 - 2 * n[0] * n[0], -2 * n[0] * n[1], -2 * n[0] * n[1], 1 - 2 * n[1] * n[1], k * n[0], k * n[1]];
}
/* גליל (כמו בקינדל — לא קפל חד): הדף מתגלגל סביב גליל ברדיוס r שהציר שלו על הקו. חומר הדף במרחק d מעבר לציר:
   d ≤ πr — על הגליל (נראה כרצועה אפורה חלקה ברוחב r מעבר לציר, בלי טקסט — דחוס); d > πr — שטוח והפוך מעל הדף,
   במיקום πr − d — כלומר שיקוף סביב קו שמוזז ב־πr/2 מהציר. */
export function curlRadius(W) { return Math.max(14, Math.min(44, W * 0.075)); }
export function curlGeom(W, H, p, phi, gy, rtl, r) {  // מצב הקיפול בקואורדינטות המסך — טהורה
  r = r == null ? curlRadius(W) : r;
  let M = [W * (1 - p), gy], n = [-Math.cos(phi), Math.sin(phi)];
  if (rtl) { M = [W - M[0], M[1]]; n = [-n[0], n[1]]; }
  const rect = [[0, 0], [W, 0], [W, H], [0, H]];
  const turned = clipHalf(rect, M, n, -1);
  const R = [M[0] - n[0] * r, M[1] - n[1] * r], Mf = [M[0] - n[0] * Math.PI * r / 2, M[1] - n[1] * Math.PI * r / 2];
  return { M, n, r, front: clipHalf(rect, M, n, 1), turned, roll: clipHalf(turned, R, n, 1), m: reflectMatrix(Mf, n) };
}
export function curlEnd(W, H, phi) {               // p שבו הדף כולו הפך (הגליל מחוץ למסך) — טהורה
  return 1 + (curlRadius(W) + 6 + Math.abs(Math.tan(phi)) * H) / W;
}
export function curlTilt(p, gy, dy, H) {          // הטיה: אחיזה מתחת לאמצע — הפינה התחתונה מובילה (כמו בקינדל); 0 בשני הקצוות — טהורה
  const a = -0.17 - 0.3 * (gy - H / 2) / (H / 2) - 0.55 * dy / H;
  return Math.max(-0.5, Math.min(0.5, a)) * Math.min(1, 2.2 * Math.sin(Math.PI * Math.max(0, Math.min(1, p))));
}
export function curlProgress(dir, d, W, H) {       // d = התזוזה לכיוון השדרה (פיקסלים) → p — טהורה
  const k = 0.62 / W;
  return dir > 0 ? Math.max(0, d) * k : curlEnd(W, H || W, 0) - Math.max(0, -d) * k;
}
export function curlCommit(dir, p, v) {            // לסיים את הדפדוף? v = מהירות ב־p למילישנייה — טהורה
  if (dir > 0) return (v > 0.0005 && p > 0.008) || (p > 0.2 && v > -0.0004);
  return (v < -0.0005 && p < 1.05) || (p < 0.85 && v < 0.0004);
}
export function gradAt(W, H, M, dir, stops) {      // linear-gradient לאורך dir, המרחקים ב־stops מקו הקיפול — טהורה
  const ang = Math.atan2(dir[0], -dir[1]);
  const L = Math.abs(W * Math.sin(ang)) + Math.abs(H * Math.cos(ang));
  const s0 = (M[0] - W / 2) * dir[0] + (M[1] - H / 2) * dir[1] + L / 2;
  const st = stops.map(([d, c]) => c + ' ' + (s0 + d).toFixed(1) + 'px');
  return 'linear-gradient(' + (ang * 180 / Math.PI).toFixed(2) + 'deg, ' + stops[0][1] + ' 0px, ' + st.join(', ') + ', ' + stops[stops.length - 1][1] + ' ' + (L + 1).toFixed(0) + 'px)';
}
const polyCss = (pts, ox, oy) => (pts.length < 3 ? 'polygon(0 0, 0 0, 0 0)'
  : 'polygon(' + pts.map((q) => (q[0] - (ox || 0)).toFixed(1) + 'px ' + (q[1] - (oy || 0)).toFixed(1) + 'px').join(', ') + ')');
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/* הבקר. env: box (שכבת הקורא), view (foliate-view), foot, frame() → ה־iframe האמיתי, page() → { page, dark },
   canTurn(dir), prevInSection(), jump(dir) → Promise (דפדוף מיידי במנוע), styleKey() */
export function createCurl(env) {
  const doc = env.box.ownerDocument;
  const mk = (cls) => { const e = doc.createElement('div'); e.className = cls; return e; };
  const layer = (cls) => {
    const L = mk(cls), pane = mk('pc-pane'), fr = doc.createElement('iframe');
    fr.setAttribute('sandbox', 'allow-same-origin'); fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
    fr.className = 'pc-frame';
    const extra = mk('pc-extra');
    pane.append(fr, extra);
    return { L, pane, fr, extra, key: '' };
  };
  const A = layer('pc-a'), shade = mk('pc-shade'), roll = mk('pc-roll'), Bw = mk('pc-b'), B = layer('pc-sheet'), tint = mk('pc-tint');
  A.L.append(A.pane);
  B.L.append(B.pane, tint);
  Bw.append(B.L);
  env.box.append(A.L, shade, roll, Bw);
  const off = (on) => { for (const e of [A.L, shade, roll, Bw]) e.style.visibility = on ? 'visible' : 'hidden'; };
  off(false);

  function sync(c) {                                // שכפול מסמך הפרק — רק כשהמסמך/הגודל/העיצוב השתנו
    const real = env.frame();
    if (!real || !real.contentDocument || !real.contentDocument.documentElement) return false;
    const r = real.getBoundingClientRect();
    const key = [env.styleKey(), Math.round(r.width), Math.round(r.height)].join('|');
    if (c.src === real.contentDocument && c.key === key && c.fr.contentDocument && c.fr.contentDocument.body) return true;
    const d = c.fr.contentDocument;
    if (!d) return false;
    d.open(); d.write('<!DOCTYPE html><html></html>'); d.close();
    d.replaceChild(d.importNode(real.contentDocument.documentElement, true), d.documentElement);
    c.src = real.contentDocument; c.key = key;
    return true;
  }
  function place(c, delta, withFoot) {              // מיקום השכפול כך שיראה בדיוק את העמוד (delta = 0 נוכחי, −1 קודם)
    const real = env.frame(), cont = real.parentElement && real.parentElement.parentElement;
    const br = env.box.getBoundingClientRect(), cr = cont.getBoundingClientRect(), rr = real.getBoundingClientRect();
    const shift = delta * cr.width * (env.rtl() ? 1 : -1);
    Object.assign(c.pane.style, { left: cr.left - br.left + 'px', top: cr.top - br.top + 'px', width: cr.width + 'px', height: cr.height + 'px', display: '' });
    Object.assign(c.fr.style, { left: rr.left - cr.left + shift + 'px', top: rr.top - cr.top + 'px', width: rr.width + 'px', height: rr.height + 'px' });
    c.extra.textContent = '';
    for (const el of real.parentElement.children) {  // ההדגשות (שכבת ה־SVG של המנוע)
      if (el === real) continue;
      const er = el.getBoundingClientRect(); if (!er.width) continue;
      const cl = el.cloneNode(true);
      Object.assign(cl.style, { position: 'absolute', margin: '0', left: er.left - cr.left + shift + 'px', top: er.top - cr.top + 'px', width: er.width + 'px', height: er.height + 'px' });
      c.extra.append(cl);
    }
    const old = c.L.querySelector(':scope > .pc-foot'); if (old) old.remove();
    if (withFoot && env.foot) {                      // שורת התחתית מתקפלת עם הדף (כמו "min left in book" בקינדל)
      const fr = env.foot.getBoundingClientRect(), f = env.foot.cloneNode(true);
      f.classList.add('pc-foot');
      Object.assign(f.style, { position: 'absolute', inset: 'auto', left: fr.left - br.left + 'px', top: fr.top - br.top + 'px', width: fr.width + 'px', height: fr.height + 'px', margin: '0' });
      c.L.append(f);
    }
  }

  let g = null, raf = 0, q = Promise.resolve(), busy = false;
  const jump = (dir) => (q = q.then(() => env.jump(dir)).catch(() => {}));
  function draw() {
    if (!g) return;
    const { W, H } = g, th = env.page();
    const G = curlGeom(W, H, g.p, g.phi, g.gy, g.rtl);
    const into = [-G.n[0], -G.n[1]];                 // לכיוון הצד שמתהפך
    const flap = Math.max(0, Math.min(1, g.p * 7, (1.04 - g.p) * 7));
    if (g.dir > 0) A.L.style.clipPath = polyCss(G.front);
    else {
      const vr = env.view.getBoundingClientRect(), br = env.box.getBoundingClientRect();
      env.view.style.clipPath = polyCss(G.front, vr.left - br.left, vr.top - br.top);
    }
    const r = G.r, bg = th.page;
    // צל על הדף שמתגלה — מקצה הגליל והלאה
    const sh = th.dark ? 0.7 : 0.26;
    shade.style.background = gradAt(W, H, G.M, into, [[r, 'rgba(0,0,0,0)'], [r, 'rgba(0,0,0,' + (sh * flap).toFixed(3) + ')'], [r + Math.min(34, W * 0.09), 'rgba(0,0,0,0)']]);
    // הגליל: בהיר בראשו (ליד הציר, ממשיך את גב הדף) וכהה בשפה — האור פוגע מלמעלה
    roll.style.clipPath = polyCss(G.roll);
    roll.style.background = gradAt(W, H, G.M, into, th.dark
      ? [[0, 'rgba(255,255,255,.10)'], [r * 0.55, 'rgba(255,255,255,.06)'], [r * 0.9, 'rgba(255,255,255,.02)'], [r, 'rgba(0,0,0,.4)']]
      : [[0, 'rgba(0,0,0,.03)'], [r * 0.5, 'rgba(0,0,0,.09)'], [r * 0.85, 'rgba(0,0,0,.2)'], [r, 'rgba(0,0,0,.34)']]) + ', ' + bg;
    Bw.style.clipPath = polyCss(G.front);
    B.L.style.transform = 'matrix(' + G.m.map((x) => x.toFixed(5)).join(',') + ')';
    B.L.style.boxShadow = '0 0 ' + (18 * flap).toFixed(1) + 'px rgba(0,0,0,' + ((th.dark ? 0.9 : 0.24) * flap).toFixed(3) + ')';
    // גב הדף השטוח: טקסט הפוך דהוי (נייר דק) + גוון אפור עדין שמתחזק הרחק מהגליל
    const pr = Math.PI * r;
    const wash = th.dark ? 'rgba(0,0,0,.58)' : hexA(bg, 0.62);
    tint.style.background = gradAt(W, H, G.M, into, th.dark
      ? [[pr, 'rgba(255,255,255,.07)'], [pr + W * 0.3, 'rgba(255,255,255,.02)']]
      : [[pr, 'rgba(0,0,0,0)'], [pr + W * 0.3, 'rgba(0,0,0,.07)']]) + ', ' + wash;
  }
  function begin(dir, x, y) {
    if (busy || !env.canTurn(dir)) return false;
    const real = env.frame();
    if (!real || !sync(A) || !sync(B)) return false;
    const br = env.box.getBoundingClientRect();
    const rtl = env.rtl();
    g = { dir, W: br.width, H: br.height, rtl, sx: x, sy: y, gy: Math.max(0, Math.min(br.height, y - br.top)), p: dir > 0 ? 0 : curlEnd(br.width, br.height, 0), phi: 0, v: 0, lt: 0, lp: 0 };
    A.L.style.background = env.page().page;
    B.L.style.background = env.page().page;
    A.L.style.zIndex = dir > 0 ? '3' : '1';
    place(A, 0, true);
    const backContent = dir > 0 || env.prevInSection();
    if (backContent) place(B, dir > 0 ? 0 : -1, dir > 0); else { B.pane.style.display = 'none'; const f = B.L.querySelector(':scope > .pc-foot'); if (f) f.remove(); }
    Object.assign(B.L.style, { width: g.W + 'px', height: g.H + 'px' });
    if (env.foot) env.foot.style.visibility = 'hidden';
    draw();
    off(true);
    busy = true;
    jump(dir);                                       // המנוע עובר מיד לעמוד היעד — מתחת לשכבות, בלי אנימציה משלו
    return true;
  }
  function move(x, y, t) {
    if (!g || g.anim) return;
    const nx = (v) => (g.rtl ? -v : v);
    const d = nx(g.sx - x);
    const p = curlProgress(g.dir, d, g.W, g.H);
    if (g.lt) { const dt = Math.max(1, t - g.lt); g.v = g.v * 0.5 + ((p - g.lp) / dt) * 0.5; }
    g.lt = t; g.lp = p;
    g.p = p; g.phi = curlTilt(p, g.gy, y - g.sy, g.H);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
  }
  function end(force) {                              // force: 'cancel' (צביטה וכו׳)
    if (!g || g.anim) return;
    const go = force === 'cancel' ? false : curlCommit(g.dir, g.p, g.v);
    animateTo(go);
  }
  function animateTo(go) {
    const s = g, p0 = s.p, phi0 = s.phi;
    const target = (go ? s.dir > 0 : s.dir < 0) ? curlEnd(s.W, s.H, phi0) : -0.02 - Math.abs(Math.tan(phi0)) * s.H / s.W;
    const dur = Math.max(220, Math.min(480, 210 + 300 * Math.abs(target - p0)));
    s.anim = { go, t0: 0, dur };
    const step = (now) => {
      if (g !== s) return;
      s.anim.t0 = s.anim.t0 || now;
      const k = Math.min(1, (now - s.anim.t0) / dur), e = easeOut(k);
      s.p = p0 + (target - p0) * e; s.phi = phi0 * (1 - e);
      draw();
      if (k < 1) raf = requestAnimationFrame(step); else finish();
    };
    raf = requestAnimationFrame(step);
  }
  async function finish() {
    const s = g; if (!s) return;
    cancelAnimationFrame(raf);
    g = null;
    const go = s.anim ? s.anim.go : false;
    if (!go) jump(-s.dir);                           // ביטול — המנוע חוזר לעמוד המקורי (עדיין מתחת לשכבות)
    await q;
    off(false);
    env.view.style.clipPath = '';
    A.L.style.clipPath = ''; Bw.style.clipPath = '';
    if (env.foot) env.foot.style.visibility = '';
    busy = false;
    if (env.onDone) env.onDone(go);
  }
  return {
    begin, move, end,
    active: () => !!g,
    busy: () => busy,
    finishNow() { if (g && g.anim) { const s = g; s.p = (s.anim.go ? s.dir > 0 : s.dir < 0) ? curlEnd(s.W, s.H, 0.6) : -0.6; draw(); finish(); } },
    prebuild() { if (!g && !busy) { try { sync(A); sync(B); } catch (e) {} } },
    destroy() { cancelAnimationFrame(raf); g = null; for (const e of [A.L, shade, roll, Bw]) e.remove(); },
    _state: () => (g ? { p: g.p, phi: g.phi, dir: g.dir } : null),
  };
}
function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return 'rgba(255,255,255,' + a + ')';
  const n = parseInt(m[1], 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
