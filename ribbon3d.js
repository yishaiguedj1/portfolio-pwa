// ribbon3d.js — v330 (בקשת המשתמש: "סימנייה כמו בעולם האמיתי, תלת־ממדית, שמתרוממת באוויר עם צל וריאליזם ברמת RTX")
//
// מנוע קטן משלנו, בשיטות של מנועי משחק — בלי ספרייה חיצונית (three.js ≈ 600KB), עובד אופליין ובלי שינוי ב־CSP:
//  1. פיזיקה — סימולציית בד בשיטת Verlet: רשת חלקיקים לאורך הסרט ולרוחבו, אילוצי אורך/רוחב/גזירה/כיפוף, כבידה,
//     גרר אוויר בכיוון הנורמל (בד נופל לאט ומתנפנף), התנגשות בדף וחיכוך. "יד" וירטואלית אוחזת בקצה הסרט ומובילה אותו
//     במסלול קשתי (Bezier) — וכל השאר (קימור, תלייה, נפילה, החלקה, התייצבות) הוא פיזיקה.
//  2. רינדור WebGL — סאטן: ברק אנאיזוטרופי לאורך הסיבים (Kajiya-Kay, שתי אונות), אור עוטף של בד, ברק שוליים בזווית חדה,
//     שוליים ארוגים, אריג עדין, קצה חתוך בחריץ (כמו סרט אמיתי), תאורת סביבה שמוחזרת מהדף, טון־מיפינג ACES ו־gamma.
//  3. צל רך פיזיקלי — כמו צללים ב־ray tracing: 40 דגימות ממקור אור שטחי (מנורה בגודל אמיתי). כל דגימה מטילה את הרשת
//     על הדף בכיוון שלה; סטנסיל מונע ספירה כפולה בתוך דגימה; טשטוש קל מחליק את המעברים. ככל שהסרט גבוה יותר — הצל
//     רחוק, גדול ורך יותר; כשהסרט נוגע בדף — חד וצמוד (contact hardening). ערוץ שני מצל מהחלק המורם על החלק השוכב.
//  4. הסתרה סביבתית (SSAO, כמו במנועי משחק): מפת גובה של הסרט מלמעלה, ולכל נקודה בדף — דגימות בדיסק סביבה: סרט נמוך
//     וקרוב מכהה הרבה, גבוה ורחוק — מעט. זה ה"הילה" הרכה מתחת לסרט שמרחף, וקו המגע הדק כשהוא שוכב.
//
// הקובץ טהור בטעינה (בלי DOM ובלי import) — הסימולציה והמסלולים נבדקים ב־node (tests/library-v330.test.js).

export const RB = {
  NL: 30, NW: 3,          // חלקיקים לאורך / לרוחב
  width: 24,              // רוחב הסרט (CSS px)
  peek: 30, full: 86,     // אורך גלוי: כבוי ("מציץ" מהקצה) / סימנייה פעילה
  notch: 7.5,             // עומק החריץ בקצה
  zRest: 1.2,             // עובי + מרווח אוויר כשהסרט שוכב על הדף
  cam: 1100,              // מרחק המצלמה (פרספקטיבה, כמו perspective ב־CSS)
  hz: 240,                // צעדי סימולציה בשנייה
};

/* ---------------- פיזיקה ---------------- */
export function createSim(opt) {
  const o = opt || {};
  const NL = RB.NL, NW = RB.NW, n = NL * NW;
  const W = o.width || RB.width, gap = W / (NW - 1);
  const s = {
    NL, NW, n, W, gap,
    P: new Float32Array(n * 3), Q: new Float32Array(n * 3), T: new Float32Array(n * 3), N: new Float32Array(n * 3),
    im: new Float32Array(n),            // מסה הפוכה (0 = מקובע)
    C: [],                              // אילוצים: [a, b, סוג, קשיחות]
    len: RB.peek, ax: 80, ay: -2,
    grip: null, gripK: 70, attract: 0, color: 0,
    g: [0, 300, -2600],                 // כבידה: בעיקר לתוך הדף (z−), מעט "למטה" בדף כדי שהסרט יתיישר
    damp: 0.996, aero: 5.5, mu: 0.55, iters: 10, zMin: 1.0,
  };
  const id = (j, i) => j * NW + i;
  const add = (a, b, t, k) => s.C.push([a, b, t, k]);
  for (let j = 0; j < NL; j++) for (let i = 0; i < NW; i++) {
    if (j + 1 < NL) add(id(j, i), id(j + 1, i), 0, 1);                  // אורך
    if (i + 1 < NW) add(id(j, i), id(j, i + 1), 1, 1);                  // רוחב
    if (j + 1 < NL && i + 1 < NW) { add(id(j, i), id(j + 1, i + 1), 2, 1); add(id(j, i + 1), id(j + 1, i), 2, 1); }   // גזירה
    if (j + 2 < NL) add(id(j, i), id(j + 2, i), 3, 0.45);               // כיפוף לאורך — סאטן רך אבל לא סמרטוט (בלי קמטים צפופים)
    if (j + 3 < NL) add(id(j, i), id(j + 3, i), 5, 0.14);               // קשתות חלקות לאורך כל הסרט
  }
  for (let j = 0; j < NL; j++) add(id(j, 0), id(j, NW - 1), 4, 0.9);    // כיפוף לרוחב — הסרט נשאר כמעט שטוח
  for (let k = 0; k < n; k++) s.im[k] = k < NW ? 0 : 1;                 // השורה הראשונה מחוברת לקצה הדף
  simSnap(s, s.len);
  return s;
}

// המצב "השוכב" של הסרט על הדף (גם יעד ההתייצבות): ישר מהקצה העליון למטה, עם קימור עדין לרוחב וגלים זעירים —
// כמו סרט סאטן אמיתי שלא נח שטוח לגמרי (תופס את האור אחרת בכל מקום)
export function simRest(s, len, out) {
  const NL = s.NL, NW = s.NW, seg = len / (NL - 1), mid = (NW - 1) / 2;
  for (let j = 0; j < NL; j++) for (let i = 0; i < NW; i++) {
    const o = (j * NW + i) * 3, ramp = Math.min(1, j / 4);
    out[o] = s.ax + (i - mid) * s.gap + 0.5 * Math.sin(j * 0.31 + 0.4) * ramp;
    out[o + 1] = s.ay + j * seg;
    out[o + 2] = RB.zRest + ((i === mid ? 0.4 : 0) + 0.18 * (0.5 + 0.5 * Math.sin(j * 0.55 + 0.8))) * ramp;   // תמיד מעל הדף (≥ zRest)
  }
  return out;
}
export function simSnap(s, len) {
  s.len = len;
  simRest(s, len, s.P); s.Q.set(s.P);
  s.grip = null; s.attract = 0;
  simNormals(s);
}
export function simNormals(s) {
  const { P, N, NL, NW } = s;
  for (let j = 0; j < NL; j++) for (let i = 0; i < NW; i++) {
    const a = (j * NW + Math.max(0, i - 1)) * 3, b = (j * NW + Math.min(NW - 1, i + 1)) * 3;
    const c = (Math.max(0, j - 1) * NW + i) * 3, d = (Math.min(NL - 1, j + 1) * NW + i) * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[d] - P[c], vy = P[d + 1] - P[c + 1], vz = P[d + 2] - P[c + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const o = (j * NW + i) * 3; N[o] = nx; N[o + 1] = ny; N[o + 2] = nz;
  }
}
export function simTail(s) {             // מרכז השורה האחרונה (הקצה החופשי)
  const o = ((s.NL - 1) * s.NW + (s.NW - 1) / 2) * 3;
  return [s.P[o], s.P[o + 1], s.P[o + 2]];
}
export function simStep(s, dt) {
  const { P, Q, N, im, n, NW, NL } = s;
  const seg = s.len / (NL - 1), gap = s.gap, diag = Math.hypot(seg, gap);
  // בזמן ההתייצבות הכבידה נחלשת — אחרת היא נלחמת ביעד, והסרט רועד בלי סוף מעל הדף
  const gs = 1 - Math.min(1, s.attract / 7);
  const dt2 = dt * dt, gx = s.g[0] * gs, gy = s.g[1] * gs, gz = s.g[2] * gs;
  const drag = Math.min(1, s.aero * dt);
  simNormals(s);
  const tail0 = (NL - 1) * NW;
  for (let k = NW; k < n; k++) {
    const o = k * 3;
    let vx = (P[o] - Q[o]) * s.damp, vy = (P[o + 1] - Q[o + 1]) * s.damp, vz = (P[o + 2] - Q[o + 2]) * s.damp;
    const vn = vx * N[o] + vy * N[o + 1] + vz * N[o + 2];          // גרר אוויר: רק המהירות בניצב לבד נבלמת
    vx -= N[o] * vn * drag; vy -= N[o + 1] * vn * drag; vz -= N[o + 2] * vn * drag;
    Q[o] = P[o]; Q[o + 1] = P[o + 1]; Q[o + 2] = P[o + 2];
    P[o] += vx + gx * dt2; P[o + 1] += vy + gy * dt2; P[o + 2] += vz + gz * dt2;
  }
  // היד: הקצה נמשך אל היעד (קפיץ חזק ומרוסן) והוא "כבד" — האילוצים כמעט לא מזיזים אותו
  if (s.grip) {
    const k = 1 - Math.exp(-s.gripK * dt), mid = (NW - 1) / 2;
    for (let i = 0; i < NW; i++) {
      const o = (tail0 + i) * 3;
      P[o] += (s.grip[0] + (i - mid) * gap - P[o]) * k;
      P[o + 1] += (s.grip[1] - P[o + 1]) * k;
      P[o + 2] += (s.grip[2] - P[o + 2]) * k;
      im[tail0 + i] = 0.12;
    }
  } else for (let i = 0; i < NW; i++) im[tail0 + i] = 1;
  const C = s.C, zMin = s.zMin;
  for (let it = 0; it < s.iters; it++) {
    for (let c = 0; c < C.length; c++) {
      const cc = C[c], a = cc[0] * 3, b = cc[1] * 3, t = cc[2];
      const rest = t === 0 ? seg : t === 1 ? gap : t === 2 ? diag : t === 3 ? 2 * seg : t === 5 ? 3 * seg : 2 * gap;
      const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const wa = im[cc[0]], wb = im[cc[1]], ws = wa + wb;
      if (!ws) continue;
      const f = (d - rest) / d * cc[3] / ws;
      P[a] += dx * f * wa; P[a + 1] += dy * f * wa; P[a + 2] += dz * f * wa;
      P[b] -= dx * f * wb; P[b + 1] -= dy * f * wb; P[b + 2] -= dz * f * wb;
    }
    for (let k = NW; k < n; k++) if (P[k * 3 + 2] < zMin) P[k * 3 + 2] = zMin;   // הדף
  }
  // הקצה המחובר לדף — תמיד במקום
  const mid = (NW - 1) / 2;
  for (let i = 0; i < NW; i++) { const o = i * 3; P[o] = s.ax + (i - mid) * gap; P[o + 1] = s.ay; P[o + 2] = RB.zRest; Q[o] = P[o]; Q[o + 1] = P[o + 1]; Q[o + 2] = P[o + 2]; }
  // חיכוך: חלקיק שנוגע בדף מאבד את רוב המהירות לאורך הדף
  for (let k = NW; k < n; k++) {
    const o = k * 3;
    if (P[o + 2] <= zMin + 0.02) { Q[o] += (P[o] - Q[o]) * s.mu; Q[o + 1] += (P[o + 1] - Q[o + 1]) * s.mu; }
  }
  // התייצבות: אחרי הנחיתה הסרט "מוחלק" בעדינות אל המצב השוכב (כמו אצבע שמיישרת אותו) — מהירות לא מוזרקת
  if (s.attract > 0) {
    const k = 1 - Math.exp(-s.attract * dt);
    simRest(s, s.len, s.T);
    for (let q = NW * 3; q < n * 3; q++) { const dd = (s.T[q] - P[q]) * k; P[q] += dd; Q[q] += dd; }
  }
}
export function simSpeed(s) {            // התזוזה המרבית בצעד (px)
  let m = 0;
  for (let q = 0; q < s.n * 3; q++) { const d = Math.abs(s.P[q] - s.Q[q]); if (d > m) m = d; }
  return m;
}
export function simDelta(s, prev) {      // השינוי המרבי מאז התמונה הקודמת (px) — למדידת התייצבות: מה שהעין רואה
  let m = 0;
  for (let q = 0; q < s.n * 3; q++) { const d = Math.abs(s.P[q] - prev[q]); if (d > m) m = d; prev[q] = s.P[q]; }
  return m;
}

/* ---------------- כוריאוגרפיה: היד שמרימה, נושאת ומשחררת ---------------- */
export const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export function bez3(p0, p1, p2, p3, t) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1], a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2]];
}
// add = הסרט מתרומם מהמצב "המציץ", עף בקשת ונוחת לאורכו על הדף; remove = מתקלף מהדף, מתרומם ומתקפל חזרה אל הקצה
export function ribbonPlan(kind, s) {
  const p0 = simTail(s), ax = s.ax, ay = s.ay, F = RB.full, K = RB.peek;
  if (kind === 'add') return {
    kind, dur: 2.0, rel: 0.78, Lf: s.len, Lt: F, cf: s.color, ct: 1,
    // הקצה מתרומם ונמשך באלכסון במורד הדף (הסרט נראה לכל אורכו באוויר, לא "מכוון למצלמה"), מונמך — ומשתחרר
    path: [p0, [p0[0] + 6, p0[1] + 14, p0[2] + 42], [ax + 9, ay + F * 0.8, 46], [ax - 1, ay + F * 0.99, 8]],
    lw: [0.08, 0.74], cw: [0.02, 0.2], aw: [1.2, 1.8],
  };
  if (kind === 'remove') return {
    kind, dur: 2.1, rel: 0.82, Lf: s.len, Lt: K, cf: s.color, ct: 0,
    // קשת סביב נקודת החיבור: הקצה מתקלף מהדף, עולה ומתקפל אחורה אל הקצה העליון — בלי למתוח את הבד
    path: [p0, [ax - 4, ay + F * 0.84, 38], [ax + 10, ay + F * 0.5, 58], [ax + 3, ay + K * 0.72, 12]],
    lw: [0.16, 0.8], cw: [0.62, 1.0], aw: [1.25, 1.9],
  };
  return null;
}
export function planAt(pl, t, s) {
  const out = { grip: null, len: pl.Lt, color: pl.ct, attract: 0 };
  const sched = pl.Lf + (pl.Lt - pl.Lf) * ease(clamp01((t - pl.lw[0]) / (pl.lw[1] - pl.lw[0])));
  if (t < pl.rel) {
    out.grip = bez3(pl.path[0], pl.path[1], pl.path[2], pl.path[3], ease(t / pl.rel));
    const dist = Math.hypot(out.grip[0] - s.ax, out.grip[1] - s.ay, out.grip[2] - RB.zRest);
    // האורך אף פעם לא קצר מהמרחק ליד (אחרת הבד נמתח) — כשהיד מתקרבת לקצה, הסרט "נאסף" פנימה.
    // בלי "רפיון" נוסף: אורך עודף בזמן שהסרט עוד שוכב מתקמט לגלים (נמדד: גל של 4.5px בתחילת ההסרה)
    out.len = Math.min(Math.max(pl.Lf, pl.Lt) * 1.04, Math.max(sched, dist));
  } else out.len = sched;
  out.color = pl.cf + (pl.ct - pl.cf) * sstep(pl.cw[0], pl.cw[1], t);
  out.attract = 7 * sstep(pl.aw[0], pl.aw[1], t);
  return out;
}

/* ---------------- רשת לרינדור: החלקה של רשת החלקיקים ---------------- */
const RR = 2, RC = 5;   // שורות לכל קטע פיזיקלי, עמודות לרוחב
export function meshSize(s) { return { rows: (s.NL - 1) * RR + 1, cols: RC }; }
export function buildMesh(s, out) {      // out: Float32Array(rows*cols*11) — מיקום, נורמל, משיק, u, אורך
  const { P, NL, NW } = s, rows = (NL - 1) * RR + 1;
  const V = buildMesh._v || (buildMesh._v = new Float32Array(rows * RC * 3));
  const at = (j, i, c) => P[(Math.max(0, Math.min(NL - 1, j)) * NW + i) * 3 + c];
  for (let r = 0; r < rows; r++) {
    const tt = r / RR, j = Math.min(NL - 2, Math.floor(tt)), f = tt - j;
    const f2 = f * f, f3 = f2 * f;
    const col = [];
    for (let i = 0; i < NW; i++) {
      const p = [0, 0, 0];
      for (let c = 0; c < 3; c++) {      // Catmull-Rom לאורך
        const p0 = at(j - 1, i, c), p1 = at(j, i, c), p2 = at(j + 1, i, c), p3 = at(j + 2, i, c);
        p[c] = 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3);
      }
      col.push(p);
    }
    for (let q = 0; q < RC; q++) {        // ריבועי (Lagrange) לרוחב דרך שלוש העמודות
      const u = q / (RC - 1), a = 2 * u * u - 3 * u + 1, b = -4 * u * u + 4 * u, c2 = 2 * u * u - u;
      const o = (r * RC + q) * 3;
      for (let c = 0; c < 3; c++) V[o + c] = col[0][c] * a + col[1][c] * b + col[2][c] * c2;
    }
  }
  let len = 0;
  for (let r = 0; r < rows; r++) {
    if (r > 0) { const a = (r * RC + 2) * 3, b = ((r - 1) * RC + 2) * 3; len += Math.hypot(V[a] - V[b], V[a + 1] - V[b + 1], V[a + 2] - V[b + 2]); }
    for (let q = 0; q < RC; q++) {
      const o = (r * RC + q) * 3, w = (r * RC + q) * 11;
      const ra = (Math.max(0, r - 1) * RC + q) * 3, rb = (Math.min(rows - 1, r + 1) * RC + q) * 3;
      const qa = (r * RC + Math.max(0, q - 1)) * 3, qb = (r * RC + Math.min(RC - 1, q + 1)) * 3;
      let tx = V[rb] - V[ra], ty = V[rb + 1] - V[ra + 1], tz = V[rb + 2] - V[ra + 2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const ux = V[qb] - V[qa], uy = V[qb + 1] - V[qa + 1], uz = V[qb + 2] - V[qa + 2];
      let nx = uy * tz - uz * ty, ny = uz * tx - ux * tz, nz = ux * ty - uy * tx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      out[w] = V[o]; out[w + 1] = V[o + 1]; out[w + 2] = V[o + 2];
      out[w + 3] = nx; out[w + 4] = ny; out[w + 5] = nz;
      out[w + 6] = tx; out[w + 7] = ty; out[w + 8] = tz;
      out[w + 9] = q / (RC - 1); out[w + 10] = len;
    }
  }
  return len;
}
export function meshIndices(s) {
  const rows = (s.NL - 1) * RR + 1, idx = [];
  for (let r = 0; r < rows - 1; r++) for (let q = 0; q < RC - 1; q++) {
    const a = r * RC + q, b = a + 1, c = a + RC, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  return new Uint16Array(idx);
}

/* ---------------- WebGL ---------------- */
const DERIV = '#ifdef GL_OES_standard_derivatives\n#extension GL_OES_standard_derivatives : enable\n#define AAW(x) fwidth(x)\n#else\n#define AAW(x) uAA\n#endif\n';
const PROJ = `
uniform vec4 uCanvas; uniform vec3 uCam;
vec4 toClip(vec2 s, float depth) { return vec4((s.x - uCanvas.x) / uCanvas.z * 2.0 - 1.0, 1.0 - (s.y - uCanvas.y) / uCanvas.w * 2.0, depth, 1.0); }
vec2 persp(vec3 p) { return uCam.xy + (p.xy - uCam.xy) * (uCam.z / (uCam.z - p.z)); }`;
const MASK = `
uniform float uTotal; uniform float uNotch; uniform float uAA;
float ribbonMask(vec2 uv) {      // קצוות הסרט + החריץ בקצה, עם החלקת קצוות (antialias)
  float u = uv.x, e = uTotal - uv.y;
  float wu = max(AAW(u), 0.0005), we = max(AAW(e), 0.02);
  return smoothstep(0.0, wu * 1.3, u) * smoothstep(0.0, wu * 1.3, 1.0 - u) * smoothstep(-we, we, e - uNotch * (1.0 - abs(2.0 * u - 1.0)));
}`;
const VS_RIBBON = PROJ + `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aTan; attribute vec2 aUV;
varying vec3 vPos; varying vec3 vNrm; varying vec3 vTan; varying vec2 vUV;
void main() { vPos = aPos; vNrm = aNrm; vTan = aTan; vUV = aUV; gl_Position = toClip(persp(aPos), clamp(0.5 - aPos.z / 900.0, 0.0, 1.0) * 2.0 - 1.0); }`;
const FS_RIBBON = DERIV + `
precision highp float;
#define PI 3.14159265
varying vec3 vPos; varying vec3 vNrm; varying vec3 vTan; varying vec2 vUV;
uniform vec3 uCam; uniform float uMix;
uniform vec3 uGreen; uniform vec3 uGray; uniform vec3 uPage; uniform vec3 uL1; uniform vec3 uL2;
uniform sampler2D uSh; uniform vec2 uRes;
` + MASK + `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// הנוסחאות של Filament (מנוע ה־PBR הפתוח של Google), כמו במנועי משחק:
// GGX אנאיזוטרופי (Burley) + נראות Smith מתואמת (Heitz) — הברק המוארך של סאטן
float dGGXa(float NoH, float ToH, float BoH, float at, float ab) {
  float a2 = at * ab; vec3 v = vec3(ab * ToH, at * BoH, a2 * NoH); float w2 = a2 / dot(v, v);
  return a2 * w2 * w2 / PI;
}
float vGGXa(float at, float ab, float ToV, float BoV, float ToL, float BoL, float NoV, float NoL) {
  float lv = NoL * length(vec3(at * ToV, ab * BoV, NoV)), ll = NoV * length(vec3(at * ToL, ab * BoL, NoL));
  return 0.5 / max(lv + ll, 1e-4);
}
// ברק בד "Charlie" (Estevez-Kulla) + נראות Neubelt — הקטיפתיות של בד בזווית חדה
float dCharlie(float r, float NoH) { float ia = 1.0 / r; float s2 = max(1.0 - NoH * NoH, 0.0078125); return (2.0 + ia) * pow(s2, ia * 0.5) / (2.0 * PI); }
float vNeubelt(float NoV, float NoL) { return 1.0 / max(4.0 * (NoL + NoV - NoL * NoV), 1e-4); }
float fSchlick(float u, float f0) { float f = pow(1.0 - u, 5.0); return f + f0 * (1.0 - f); }
// הסביבה (במקום מפת סביבה): תקרה בהירה, חלון רך בכיוון המנורה, הדף מלמטה
vec3 env(vec3 R, vec3 L) {
  vec3 c = mix(vec3(0.34, 0.35, 0.37), vec3(0.78, 0.8, 0.84), smoothstep(-0.05, 0.95, R.z));
  c += vec3(1.0, 0.96, 0.9) * 1.4 * pow(max(dot(R, L), 0.0), 48.0);
  return mix(c, uPage * 0.5, smoothstep(0.0, -0.3, R.z));
}
vec3 direct(vec3 N, vec3 T, vec3 B, vec3 V, float NoV, vec3 L, vec3 alb, vec3 shc, float at, float ab) {
  float NoL = dot(N, L), NoLc = max(NoL, 0.0);
  vec3 H = normalize(L + V); float NoH = max(dot(N, H), 0.0);
  float spec = dGGXa(NoH, dot(T, H), dot(B, H), at, ab) * vGGXa(at, ab, dot(T, V), dot(B, V), dot(T, L), dot(B, L), NoV, NoLc) * fSchlick(max(dot(V, H), 0.0), 0.05);
  float sheen = dCharlie(0.5, NoH) * vNeubelt(NoV, NoLc);
  vec3 fd = alb / PI * clamp((NoL + 0.3) / 1.69, 0.0, 1.0);    // מפוזר עם עטיפה: בד דק מעביר מעט אור
  return fd + (vec3(spec) + shc * sheen) * NoLc;
}
// מיפוי טונים Khronos PBR Neutral: צבע הבסיס יוצא בדיוק (הירוק של האפליקציה), רק ברקים נדחסים בעדינות ללבן
vec3 neutral(vec3 c) {
  float x = min(c.r, min(c.g, c.b)), off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= off;
  float pk = max(c.r, max(c.g, c.b));
  if (pk < 0.76) return c;
  float np = 1.0 - 0.0576 / (pk - 0.52);
  c *= np / pk;
  return mix(c, vec3(np), 1.0 - 1.0 / (0.15 * (pk - np) + 1.0));
}
void main() {
  float a = ribbonMask(vUV);
  if (a < 0.004) discard;
  float u = vUV.x, len = vUV.y;
  vec3 V = normalize(uCam - vPos);
  vec3 N = normalize(vNrm), T = normalize(vTan);
  float back = 0.0;
  if (dot(N, V) < 0.0) { N = -N; back = 1.0; }        // הצד האחורי של הסרט (כשהוא מתהפך באוויר) — עמום יותר
  T = normalize(T - N * dot(T, N));
  vec3 B = cross(N, T);
  float NoV = max(dot(N, V), 1e-3);
  vec3 alb = mix(uGray, uGreen, uMix);
  float selv = smoothstep(0.045, 0.06, u) * (1.0 - smoothstep(0.085, 0.10, u)) + smoothstep(0.90, 0.915, u) * (1.0 - smoothstep(0.94, 0.955, u));
  alb *= 1.0 - 0.12 * selv;                              // שוליים ארוגים
  alb *= 0.975 + 0.04 * hash(floor(vec2(u * 46.0, len * 1.4)));   // אריג
  // סאטן: הסיבים הארוכים לאורך הסרט — חלק לאורכם (at), מחוספס לרוחבם (ab)
  float at = 0.075, ab = 0.42;
  vec3 shc = mix(alb, vec3(1.0), 0.4) * 0.35;
  float occ = texture2D(uSh, gl_FragCoord.xy / uRes).g * (1.0 - smoothstep(1.6, 10.0, vPos.z));   // צל מהחלק המורם על החלק השוכב
  vec3 L1 = normalize(uL1), L2 = normalize(uL2);
  vec3 col = direct(N, T, B, V, NoV, L1, alb, shc, at, ab) * vec3(1.0, 0.97, 0.93) * 2.7 * (1.0 - 0.85 * occ)
           + direct(N, T, B, V, NoV, L2, alb, shc, at, ab) * vec3(0.86, 0.92, 1.0) * 0.55;
  // אור הסביבה: מפוזר מחצי כדור (תקרה מול הדף) + השתקפות בנורמל "מעוקם" לכיוון הסיבים (ה־IBL האנאיזוטרופי של Filament)
  vec3 irr = mix(uPage * 0.12, vec3(0.3, 0.31, 0.33), N.z * 0.5 + 0.5);
  vec3 aN = cross(cross(T, V), T);
  vec3 R = reflect(-V, normalize(mix(N, aN, 0.55)));
  col += alb * irr * (1.0 - 0.4 * occ) + env(R, L1) * fSchlick(NoV, 0.05) * 0.9;
  col *= 1.0 - 0.18 * back;
  col *= mix(0.6, 1.0, smoothstep(0.0, 8.0, len));      // יוצא מבין הדפים — מוצל בקצה
  col = neutral(col);
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  gl_FragColor = vec4(col * a, a);
}`;
// צל המנורה: הרשת מוטלת על הדף בכיוון של כל דגימת אור. R = כיסוי, G = כיסוי ע"י חלק גבוה (לצל על הסרט עצמו)
const VS_KEY = PROJ + `
attribute vec3 aPos; attribute vec2 aUV; uniform vec2 uSlope;
varying vec2 vUV; varying float vH;
void main() { vUV = aUV; vH = aPos.z; gl_Position = toClip(aPos.xy - uSlope * aPos.z, 0.0); }`;
const FS_KEY = DERIV + `
precision highp float;
varying vec2 vUV; varying float vH; uniform float uW;
` + MASK + `
void main() { float m = ribbonMask(vUV); if (m < 0.004) discard; gl_FragColor = vec4(uW * m, uW * m * smoothstep(2.5, 9.0, vH), 0.0, 0.0); }`;
// "טביעת הרגל" של הסרט ישר מלמעלה: B = החלק שנוגע בדף — קו מגע כהה ודק לאורך השוליים (הסתרה סביבתית של מגע)
const VS_FOOT = PROJ + `
attribute vec3 aPos; attribute vec2 aUV; varying vec2 vUV; varying float vH;
void main() { vUV = aUV; vH = aPos.z; gl_Position = toClip(aPos.xy, 0.0); }`;
const FS_FOOT = DERIV + `
precision highp float;
varying vec2 vUV; varying float vH;
` + MASK + `
void main() { float m = ribbonMask(vUV); if (m < 0.004) discard; gl_FragColor = vec4(0.0, 0.0, m * (1.0 - smoothstep(1.6, 5.0, vH)), 0.0); }`;
const VS_QUAD = `attribute vec2 aQ; varying vec2 vQ; void main() { vQ = aQ * 0.5 + 0.5; gl_Position = vec4(aQ, 0.0, 1.0); }`;
// טשטוש גאוסי נפרד (אופקי ואז אנכי, σ = 2 צעדים) — מחליק את המעברים בין דגימות האור ואת קו המגע
const FS_BLUR = `precision highp float; varying vec2 vQ; uniform sampler2D uT; uniform vec2 uD;
void main() {
  vec4 c = vec4(0.0);
  for (int i = -4; i <= 4; i++) { float f = float(i); c += texture2D(uT, vQ + uD * f) * exp(-f * f / 8.0); }
  gl_FragColor = c / 4.898;
}`;
// הרכבה: בבהיר — הצל מכפיל את מה שמתחת לקנבס (הדף וגם הטקסט): כהה יותר מאותו גוון, גם על ספיה; גוון קריר קלוש (אור השמיים).
// בכהה (בקשת המשתמש: "הצל נעלם ברקע", ואחרי ניסיון של בריכת אור — "שיהיה בהיר ויבלוט"): על שחור אי אפשר להכהות,
// אז הצל הוא צל בהיר — אפור רך באותה צורה ובאותו היסט (כמו שממשק כהה מבטא גובה). "נקי כמו אפל": רק מהחלקים שבאוויר
// (ערוץ G — בלי קו בהיר סביב סרט שוכב), רך ורחב יותר, ועדין בליבה. אלפא ≥ צבע — premultiplied תקין
const FS_COMP = `precision highp float; varying vec2 vQ; uniform sampler2D uT; uniform vec2 uK; uniform vec4 uLite;
void main() {
  vec4 t = texture2D(uT, vQ);
  float s = clamp((uLite.a > 0.5 ? t.g : t.r) * uK.x + t.b * uK.y, 0.0, 0.92);
  vec3 c = uLite.a > 0.5 ? uLite.rgb * s : vec3(0.012, 0.016, 0.03) * s;
  gl_FragColor = vec4(c, uLite.a > 0.5 ? max(c.r, max(c.g, c.b)) : s);
}`;

// דגימות האור: דיסק בספירלת זהב סביב כיוון המנורה — שיפוע ההטלה על הדף לכל דגימה, ומשקל
const L_KEY = [-0.3, -0.75, 1];           // מנורה מעל הקורא, מלמעלה־משמאל: הצל נופל למטה (כמו בכל ממשק), ועל סרט שטוח אין ברק מסנוור
export function shadowSamples(nKey) {
  const out = [], s0 = [L_KEY[0] / L_KEY[2], L_KEY[1] / L_KEY[2]];
  for (let k = 0; k < nKey; k++) { const r = Math.sqrt((k + 0.5) / nKey) * 0.2, a = k * 2.39996; out.push([s0[0] + r * Math.cos(a), s0[1] + r * Math.sin(a), 1 / nKey]); }
  return out;
}
const lin = (hex) => {                   // צבע sRGB → ליניארי
  const v = String(hex || '#ffffff').replace('#', ''), f = (i) => parseInt(v.length === 3 ? v[i] + v[i] : v.slice(i * 2, i * 2 + 2), 16) / 255;
  return [0, 1, 2].map((i) => { const c = f(i); return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
};

// הקשר WebGL + הידור השיידרים. הידור הוא העבודה הכבדה (נמדד: פריים של ~0.25 שנ׳ בפתיחת הקורא כשהיה סינכרוני) —
// createRibbonAsync מפעיל את כולו במקביל (KHR_parallel_shader_compile) ומחכה בין פריימים, בלי לחסום את התהליך הראשי
const PROGRAMS = () => [[VS_RIBBON, FS_RIBBON], [VS_KEY, FS_KEY], [VS_FOOT, FS_FOOT], [VS_QUAD, FS_BLUR], [VS_QUAD, FS_COMP]];
function makeGL(canvas) {
  try { return canvas.getContext('webgl', { alpha: true, antialias: true, stencil: false, depth: true, premultipliedAlpha: true, powerPreference: 'low-power' }) || null; } catch (e) { return null; }
}
function startPrograms(gl) {                 // מתחיל הידור וקישור של כל התוכניות — בלי לשאול על התוצאה (שאלה = המתנה)
  const hasDer = !!gl.getExtension('OES_standard_derivatives');
  const fix = (src) => (hasDer ? src : src.replace('#ifdef GL_OES_standard_derivatives', '#if 0'));
  return PROGRAMS().map(([vs, fs]) => {
    const p = gl.createProgram(), v = gl.createShader(gl.VERTEX_SHADER), f = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(v, vs); gl.compileShader(v); gl.shaderSource(f, fix(fs)); gl.compileShader(f);
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    return { p, v, f };
  });
}
function finishProgram(gl, x) {
  if (!gl.getProgramParameter(x.p, gl.LINK_STATUS)) throw new Error(gl.getShaderInfoLog(x.v) || gl.getShaderInfoLog(x.f) || gl.getProgramInfoLog(x.p) || 'link');
  const u = {}, n = gl.getProgramParameter(x.p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(x.p, i).name; u[nm] = gl.getUniformLocation(x.p, nm); }
  return { p: x.p, u, a: (nm) => gl.getAttribLocation(x.p, nm) };
}
export function createRibbon(canvas, cfg) {  // סינכרוני (בדיקות וצילום דטרמיניסטי)
  const opt = cfg || {};
  const gl = makeGL(canvas);
  if (!gl) return null;
  let progs;
  try { progs = startPrograms(gl).map((x) => finishProgram(gl, x)); } catch (e) { if (opt.onError) opt.onError(e); return null; }
  return ribbonEngine(canvas, gl, opt, progs);
}
export async function createRibbonAsync(canvas, cfg, nextFrame) {
  const opt = cfg || {};
  const gl = makeGL(canvas);
  if (!gl) return null;
  const wait = () => new Promise((res) => (nextFrame || requestAnimationFrame)(res));
  const ext = gl.getExtension('KHR_parallel_shader_compile');
  let started;
  try { started = startPrograms(gl); } catch (e) { if (opt.onError) opt.onError(e); return null; }
  if (ext) for (let i = 0; i < 240 && !started.every((x) => gl.getProgramParameter(x.p, ext.COMPLETION_STATUS_KHR)); i++) await wait();
  const progs = [];
  for (const x of started) {
    if (gl.isContextLost()) return null;
    try { progs.push(finishProgram(gl, x)); } catch (e) { if (opt.onError) opt.onError(e); return null; }
    if (!ext) await wait();                  // בלי ההרחבה — לפחות תוכנית אחת לכל פריים
  }
  return ribbonEngine(canvas, gl, opt, progs);
}

function ribbonEngine(canvas, gl, opt, progs) {
  const [pr, pk, pf, pb, pc] = progs;
  const s = createSim();
  const { rows, cols } = meshSize(s);
  const verts = new Float32Array(rows * cols * 11);
  const idx = meshIndices(s);
  const vbo = gl.createBuffer(), ibo = gl.createBuffer(), qbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, verts.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, qbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const samples = shadowSamples(64);
  // מטרות רינדור בחצי רזולוציה: הצללים (+ סטנסיל), ושתיים לטשטוש
  const target = (w, h, ds) => {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    let rb = null;
    if (ds) {
      rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, rb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, rb, w, h };
  };
  let tSh = null, tB1 = null, tB2 = null, tW = 0, tH = 0;
  const freeT = (t) => { if (!t) return; gl.deleteFramebuffer(t.fb); gl.deleteTexture(t.tex); if (t.rb) gl.deleteRenderbuffer(t.rb); };
  const ensureTargets = (W, Hh) => {
    if (tSh && tW === W && tH === Hh) return;
    freeT(tSh); freeT(tB1); freeT(tB2);
    tW = W; tH = Hh;
    const hw = Math.max(1, W >> 1), hh = Math.max(1, Hh >> 1);
    tSh = target(hw, hh, true); tB1 = target(hw, hh, false); tB2 = target(hw, hh, false);
  };

  let lay = { w: 210, h: 300, cx: 0, cy: 0, dpr: 1 };
  let pageLin = lin('#ffffff'), dark = false;
  const GREEN = lin('#30D158'), GRAY = lin('#B9B9BE'), GRAY_D = lin('#636366');   // הירוק הראשי של האפליקציה (--primary); אפור נקי (בכהה — כהה יותר, לא מסנוור בלילה)
  let on = false, plan = null, pt = 0, raf = 0, last = 0, acc = 0, still = 0, landed = true, pressing = false, pressT = 0, dead = false;
  const prevP = new Float32Array(s.n * 3);
  const H = 1 / RB.hz;

  const meshAttribs = (pg, full) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const list = [];
    const at = (nm, size, off) => { const l = pg.a(nm); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 44, off); list.push(l); };
    at('aPos', 3, 0); at('aUV', 2, 36);
    if (full) { at('aNrm', 3, 12); at('aTan', 3, 24); }
    return () => list.forEach((l) => gl.disableVertexAttribArray(l));
  };
  const quad = (pg) => {
    const l = pg.a('aQ'); gl.bindBuffer(gl.ARRAY_BUFFER, qbo); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 8, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disableVertexAttribArray(l);
  };
  const common = (pg, total, notch) => {
    gl.uniform4f(pg.u.uCanvas, 0, 0, lay.w, lay.h); if (pg.u.uCam) gl.uniform3f(pg.u.uCam, lay.cx, lay.cy, RB.cam);
    if (pg.u.uTotal) { gl.uniform1f(pg.u.uTotal, total); gl.uniform1f(pg.u.uNotch, notch); gl.uniform1f(pg.u.uAA, 0.02); }
  };

  function draw() {
    if (dead || gl.isContextLost()) return;
    const W = canvas.width, Hh = canvas.height;
    if (!W || !Hh) return;
    ensureTargets(W, Hh);
    const total = buildMesh(s, verts);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    const notch = RB.notch * Math.min(1, total / 30);
    gl.disable(gl.CULL_FACE); gl.disable(gl.DEPTH_TEST);
    // 1. צל המנורה: 64 דגימות של מקור אור שטחי (חצי רזולוציה); סטנסיל — תרומה אחת לכל פיקסל בכל דגימה
    gl.bindFramebuffer(gl.FRAMEBUFFER, tSh.fb); gl.viewport(0, 0, tSh.w, tSh.h);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 0); gl.clearStencil(0); gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.colorMask(true, true, false, false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.enable(gl.STENCIL_TEST); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.useProgram(pk.p); common(pk, total, notch);
    let off = meshAttribs(pk, false);
    for (let k = 0; k < samples.length; k++) {
      gl.stencilFunc(gl.NOTEQUAL, k + 1, 0xff);
      gl.uniform2f(pk.u.uSlope, samples[k][0], samples[k][1]); gl.uniform1f(pk.u.uW, samples[k][2]);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    }
    off(); gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND);
    // 2. טביעת הרגל ישר מלמעלה (קו המגע) לערוץ B
    gl.colorMask(false, false, true, false);
    gl.useProgram(pf.p); common(pf, total, notch);
    off = meshAttribs(pf, false); gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0); off();
    gl.colorMask(true, true, true, true);
    // 3. טשטוש גאוסי: אופקי ואז אנכי (צעדים ביחידות CSS px)
    gl.useProgram(pb.p); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(pb.u.uT, 0);
    const sx = 1 / lay.w, sy = 1 / lay.h;
    gl.bindFramebuffer(gl.FRAMEBUFFER, tB1.fb); gl.viewport(0, 0, tB1.w, tB1.h);
    gl.bindTexture(gl.TEXTURE_2D, tSh.tex);
    const bs = dark ? 2.1 : 0.55;           // בכהה — טשטוש רחב יותר: קצוות רכים ונקיים (σ≈4px)
    gl.uniform2f(pb.u.uD, bs * sx, 0);
    quad(pb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tB2.fb);
    gl.bindTexture(gl.TEXTURE_2D, tB1.tex);
    gl.uniform2f(pb.u.uD, 0, bs * sy);
    quad(pb);
    // 4. הצל על הדף (הכפלה של צבע הדף — כהה יותר מאותו גוון, גם על ספיה)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, Hh);
    gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(pc.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tB2.tex); gl.uniform1i(pc.u.uT, 0);
    gl.uniform2f(pc.u.uK, dark ? 0.95 : 0.44, dark ? 0.05 : 0.3);
    gl.uniform4f(pc.u.uLite, 0.36, 0.36, 0.385, dark ? 1 : 0);   // צל בהיר במצב כהה: אפור רך ועדין (עד ~#58585D בליבה)
    quad(pc);
    // 5. הסרט
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    gl.useProgram(pr.p); common(pr, total, notch);
    gl.uniform1f(pr.u.uMix, s.color);
    gl.uniform3fv(pr.u.uGreen, GREEN); gl.uniform3fv(pr.u.uGray, dark ? GRAY_D : GRAY); gl.uniform3fv(pr.u.uPage, pageLin);
    gl.uniform3fv(pr.u.uL1, L_KEY); gl.uniform3f(pr.u.uL2, 0.55, 0.35, 0.8);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tB2.tex); gl.uniform1i(pr.u.uSh, 0);
    gl.uniform2f(pr.u.uRes, W, Hh);
    off = meshAttribs(pr, true); gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0); off();
    gl.disable(gl.DEPTH_TEST);
  }

  function tick(h) {
    if (plan) {
      pt += h;
      const st = planAt(plan, pt, s);
      s.grip = st.grip; s.len = st.len; s.color = st.color; s.attract = st.attract;
      if (pt >= plan.rel && !landed && simTail(s)[2] < s.zMin + 0.6) { landed = true; if (opt.onLand) opt.onLand(); }
      if (pt >= plan.dur) plan = null;
    } else if (pressing) {
      // הקצה מתרומם בהדרגה בקשת סביב נקודת החיבור (במרחק אורך הסרט) — כך הבד לא נדחס לגלים
      pressT += h;
      const tail = simRest(s, s.len, s.T), o = ((s.NL - 1) * s.NW + 1) * 3;
      const lift = 9 * sstep(0, 0.12, pressT), dz = tail[o + 2] + lift - RB.zRest;
      s.grip = [tail[o], s.ay + Math.sqrt(Math.max(0, s.len * s.len - dz * dz)), tail[o + 2] + lift]; s.gripK = 18;
    }
    simStep(s, h);
  }
  function loop(now) {
    raf = 0;
    if (dead) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : H);
    last = now; acc += dt;
    let steps = 0;
    while (acc >= H && steps < 24) { tick(H); acc -= H; steps++; }
    draw();
    const moving = plan || pressing || simDelta(s, prevP) > 0.01;
    still = moving ? 0 : still + 1;
    if (still < 8) raf = requestAnimationFrame(loop);
    else { s.grip = null; last = 0; acc = 0; }
  }
  const run = () => { if (opt.manual || raf || dead) return; last = 0; raf = requestAnimationFrame(loop); };
  const reduce = () => !!(opt.reduceMotion && opt.reduceMotion());

  return {
    // מיקום: w/h = גודל הקנבס ב־CSS px, ax = מרכז הסרט בקנבס, cx/cy = מרכז המסך ביחס לקנבס (נקודת המגוז של הפרספקטיבה)
    layout(L) {
      lay = Object.assign({}, lay, L);
      const dpr = Math.min(3, L.dpr || 1);
      const w = Math.round(lay.w * dpr), hh = Math.round(lay.h * dpr);
      if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
      const moved = s.ax !== L.ax;
      s.ax = L.ax; s.ay = -2;
      if (moved && !plan) { simSnap(s, on ? RB.full : RB.peek); prevP.set(s.P); }
      draw();
    },
    setPage(hex, isDark) { pageLin = lin(hex); dark = !!isDark; draw(); },
    // מצב הסימנייה. animate = פעולת משתמש (התרוממות, תעופה ונחיתה); אחרת (החלפת עמוד) — מיד במקום
    set(v, animate) {
      v = !!v;
      if (v === on && !animate) { if (!plan) { simSnap(s, on ? RB.full : RB.peek); s.color = on ? 1 : 0; prevP.set(s.P); draw(); } return; }
      on = v;
      if (!animate || reduce()) { plan = null; pressing = false; simSnap(s, on ? RB.full : RB.peek); s.color = on ? 1 : 0; prevP.set(s.P); draw(); return; }
      s.gripK = 70; pressing = false;
      plan = ribbonPlan(on ? 'add' : 'remove', s); pt = 0; landed = false;
      run();
    },
    // אצבע על הסרט: הקצה מתרומם קצת (הצל גדל) — משוב מוחשי לפני הפעולה
    press(down) {
      if (reduce() || plan) return;
      pressing = !!down; pressT = 0;
      if (!down) { s.grip = null; s.gripK = 70; }
      run();
    },
    isOn: () => on,
    busy: () => !!(plan || raf),
    // לבדיקות: התקדמות דטרמיניסטית בזמן הסימולציה (עם manual:true — בלי לולאת rAF)
    _advance(sec) { for (let i = Math.round(sec / H); i > 0; i--) tick(H); draw(); },
    destroy() {
      dead = true; if (raf) cancelAnimationFrame(raf);
      try { const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {}
    },
    _sim: s,
  };
}
