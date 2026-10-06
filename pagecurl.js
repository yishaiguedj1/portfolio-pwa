/* v342–v343 (בקשת המשתמש 05/10/2026): דפדוף כמו בקינדל — הדף מתגלגל סביב גליל (לא קפל חד), הגב שלו מראה את
   הטקסט הפוך (נייר דק), צל רך על הדף שמתגלה ועל הדף שמתחת לכנף. בלי ייבוא ובלי DOM בטעינה (הגאומטריה נבדקת ב־node).

   הגאומטריה (בקואורדינטות מנורמלות — הקצה החופשי מימין, השדרה משמאל; ספר RTL = שיקוף):
     ציר הגליל עובר דרך M = (W·(1−p), gy) בזווית φ מהאנך; n = נורמל יחידה לכיוון השדרה.
     p = 0 דף שטוח, p ≈ 1 הדף הפך כולו. מה שבצד השדרה נשאר שטוח; מה שמעבר לציר — על הגליל (רצועה ברוחב r)
     ומעבר לו שטוח והפוך מעל הדף (שיקוף סביב קו מוזז ב־πr/2), באורך מרבי T (הכנף "מחליקה" עם הגליל).
   v343: המנוע לא זז בזמן המחווה (החלפת מסמך הפרק באמצע נגיעה "בלעה" את האצבע — באג בין פרקים). כל החלקים
   הנעים משכפולים (iframe שקט בלי סקריפטים), והמעבר האמיתי — פעם אחת, רק בסוף דפדוף שהושלם:
     קדימה: המנוע = הדף שמתקפל (חתוך לחלק השטוח); מתחת — שכפול של העמוד הבא; הכנף — שכפול של העמוד הנוכחי.
     אחורה: המנוע = העמוד הנוכחי מתחת; מעליו — שכפול של העמוד הקודם (החלק השטוח) + הכנף מאותו עמוד.
     בין פרקים: השכפול נטען מהפרק השכן מראש (בזמן מנוחה), באותו עיצוב ובאותה פריסה של המנוע. */

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
export function curlRadius(W) { return Math.max(12, Math.min(32, W * 0.052)); }   // סבב 6–7: גליל דק — חצי ההיקף (πr) בולע מעט דף, והכנף מלאה; ברוחב הגליל הנראה בצילומי הקינדל (~5%)
/* v343: רדיוס הגליל לאורך הדפדוף — כמו בקינדל: גליל צר, שגדל מעט באמצע הדפדוף ונסגר בנחיתה.
   (ניסיון של גליל גדול — "דף שעומד גבוה" — נפסל ע״י המשתמש: "לא נראה משהו, שיהיה כמו בקינדל") */
export function curlRadiusAt(W, p) {               // טהורה
  const k = Math.sin(Math.PI * Math.max(0, Math.min(1, p)));
  return Math.max(12, W * (0.05 + 0.02 * k));     // גליל דק כמו בקינדל (רוב הדף בכנף, לא על הגליל)
}
/* T = האורך המרבי של החומר מעבר לציר (גליל + כנף). בקינדל הגליל "גורר" את הדף: בדפדוף אוטומטי הכנף נשארת צרה
   (~חמישית מסך) ועוברת לרוחב העמוד, במקום להתרחב עד שהיא מכסה את כל המסך. מה שמעבר ל־T — "מחליק" עם הגליל:
   הזזה של החומר ב־Δ לכיוון השדרה לפני השיקוף, כך שהקצה החופשי של הדף תמיד בקצה הכנף */
export function curlGeom(W, H, p, phi, gy, rtl, r, T) {  // מצב הקיפול בקואורדינטות המסך — טהורה
  r = r == null ? curlRadius(W) : r;
  let M = [W * (1 - p), gy], n = [-Math.cos(phi), Math.sin(phi)];
  if (rtl) { M = [W - M[0], M[1]]; n = [-n[0], n[1]]; }
  const rect = [[0, 0], [W, 0], [W, H], [0, H]];
  const turned = clipHalf(rect, M, n, -1);
  const R = [M[0] - n[0] * r, M[1] - n[1] * r], Mf = [M[0] - n[0] * Math.PI * r / 2, M[1] - n[1] * Math.PI * r / 2];
  let far = 0;
  for (const X of turned) far = Math.max(far, -((X[0] - M[0]) * n[0] + (X[1] - M[1]) * n[1]));
  const shift = T == null ? 0 : Math.max(0, far - Math.max(T, Math.PI * r));
  const m = reflectMatrix(Mf, n);
  m[4] -= shift * n[0]; m[5] -= shift * n[1];
  return { M, n, r, front: clipHalf(rect, M, n, 1), turned, roll: clipHalf(turned, R, n, 1), m, shift, far: far - shift };
}
/* תאורת הגליל (פיזיקלית): נקודה בגובה s מעבר לציר נמצאת על חלקו העליון של הגליל, בזווית θ = π − asin(s/r);
   הנורמל (s/r, √(1−(s/r)²)); אור רך מלמעלה ומעט מכיוון השדרה (Lambert) + ברק עדין (Blinn). מחזיר עצירות
   של שכבה שקופה מעל צבע הדף: כהה = שחור שקוף, בהיר = לבן שקוף — טהורה */
export function rollStops(r, dark) {
  const L = [-0.32, 0.95], Ln = Math.hypot(L[0], L[1]), lx = L[0] / Ln, lz = L[1] / Ln;
  const Hx = lx, Hz = lz + 1, Hn = Math.hypot(Hx, Hz);
  const out = [];
  for (let i = 0; i <= 14; i++) {
    const u = Math.min(0.999, i / 14), s = u * r, nx = u, nz = Math.sqrt(1 - u * u);
    const diff = Math.max(0, nx * lx + nz * lz), spec = Math.pow(Math.max(0, (nx * Hx + nz * Hz) / Hn), 40);
    const b = 0.5 + 0.5 * diff + 0.12 * spec;             // 1 = בהירות הדף השטוח
    const rim = u > 0.93 ? (u - 0.93) / 0.07 : 0;          // קצה הגליל: הצל העצמי מתחת לקימור
    if (dark) out.push([s, 'rgba(255,255,255,' + Math.max(0, 0.03 + 0.11 * (b - 0.5) - 0.1 * rim).toFixed(3) + ')']);
    else out.push([s, b >= 1 ? 'rgba(255,255,255,' + Math.min(0.5, (b - 1) * 1.6).toFixed(3) + ')' : 'rgba(0,0,0,' + Math.min(0.6, (1 - b) * 0.9 + 0.22 * rim).toFixed(3) + ')']);
  }
  return out;
}
export function shadowStops(a, lam, start) {      // צל רך שדועך אקספוננציאלית מקצה הגליל — טהורה
  const out = [[start, 'rgba(0,0,0,0)']];
  for (const k of [0, 0.35, 0.8, 1.4, 2.2, 3.2, 4.5]) out.push([start + k * lam, 'rgba(0,0,0,' + (a * Math.exp(-k)).toFixed(3) + ')']);
  out.push([start + 5.5 * lam, 'rgba(0,0,0,0)']);
  return out;
}
export function curlEase(k, m0) {                 // מהירות כמעט קבועה כמו בקינדל, ממשיכה ממהירות האצבע ומאטה רק בסוף — טהורה
  const m1 = 0.12;                                // סבב 7: נחיתה רכה — בקינדל הגליל זוחל לאט את הקטע האחרון עד הקצה
  return (k * k * k - 2 * k * k + k) * m0 + (-2 * k * k * k + 3 * k * k) + (k * k * k - k * k) * m1;
}
export function curlEnd(W, H, phi) {               // p שבו הדף כולו הפך (הגליל מחוץ למסך) — טהורה
  return 1 + (curlRadius(W) + 6 + Math.abs(Math.tan(phi)) * H) / W;
}
export function curlTilt(p, gy, dy, H) {          // הטיה: אחיזה מתחת לאמצע — הפינה התחתונה מובילה (כמו בקינדל); 0 בשני הקצוות — טהורה
  const a = -0.05 - 0.22 * (gy - H / 2) / (H / 2) - 0.9 * dy / H;
  return Math.max(-0.5, Math.min(0.5, a)) * Math.min(1, 2.2 * Math.sin(Math.PI * Math.max(0, Math.min(1, p))));
}
export function curlProgress(dir, d, W, H) {       // d = התזוזה לכיוון השדרה (פיקסלים) → p — טהורה
  const k = 0.62 / W;
  return dir > 0 ? Math.max(0, d) * k : curlEnd(W, H || W, 0) - Math.max(0, -d) * k;
}
export function curlCommit(dir, p, v, p1) {        // לסיים את הדפדוף? v = מהירות ב־p למילישנייה; p1 = נקודת ההתחלה של "אחורה" — טהורה
  // כמו בקינדל: האצבע זזה לכיוון הדפדוף — מדפדף (גם בהחלקה קצרה שמאטה בסוף); חזרה אחורה — מבטל; עצירה — לפי המרחק
  const prog = dir > 0 ? p : (p1 == null ? 1 : p1) - p, vel = dir > 0 ? v : -v;
  if (vel < -0.00025) return false;
  if (vel > 0.00012) return prog > 0.012;
  return prog > 0.09;
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

/* ---- v343: המנוע התלת־ממדי (WebGL) — רק החלק המורם של הדף (הגליל והכנף); החלק השטוח נשאר DOM אמיתי (חד וזהה) ----
   רשת צפופה בקואורדינטות החומר של הדף; כל נקודה עם מרחק d מעבר לציר: d < 0 — שטוח (לא מצויר כאן); על הגליל
   (קשת arc = d − shift ≤ πr) — גובה r(1 − cos θ), θ = arc/r; מעבר לו — שטוח והפוך בגובה 2r. מצלמה עם פרספקטיבה מעל
   מרכז המסך — הקצה העליון של הכנף מתעקם כמו בקינדל. בגב הדף — הטקסטורה (צייר העמוד) הפוכה, מעט דהויה (נייר דק),
   ותאורה לכל פיקסל (Lambert + Blinn). צל: מעבר נפרד — הצללית המורמת מוטלת על המישור, בחצי רזולוציה, טשטוש גאוסי. */
const VS = `attribute vec2 a_uv;
uniform vec2 u_size, u_M, u_n, u_C, u_ax; uniform vec3 u_ls; uniform float u_r, u_shift, u_cam, u_shadow, u_kc;
varying vec2 v_uv; varying float v_d, v_arc, v_th, v_z;
void main() {
  vec2 P = a_uv * u_size;
  float d = -dot(P - u_M, u_n), arc = d - u_shift;
  vec2 into = -u_n, Pa = P - into * d;
  // גליל חרוטי (כמו בקינדל): הרדיוס גדל לאורך הציר הרחק מנקודת האחיזה — שם הגלגול חד, ובצד השני הנייר מתרומם
  // ומתעקל, והכנף נוטה (גבוהה יותר בצד הרחב) — הטקסט ההפוך מקוצר בפרספקטיבה
  float rr = u_r * clamp(1.0 + u_kc * dot(P - u_M, u_ax) / u_size.y, 0.6, 3.6);
  float PI = 3.14159265, th = 0.0; vec3 pos;
  if (d < 0.0) pos = vec3(P, 0.0);
  else if (arc < 0.0) pos = vec3(Pa, 0.0);                       // אזור ההחלקה: מתכווץ לקו המגע (בלי משולשים מתוחים)
  else if (arc < PI * rr) { th = arc / rr; pos = vec3(Pa + into * (rr * sin(th)), rr * (1.0 - cos(th))); }
  else { th = PI; pos = vec3(Pa - into * (arc - PI * rr), 2.0 * rr); }
  v_uv = a_uv; v_d = d; v_arc = arc; v_th = th; v_z = pos.z;
  vec2 s;
  if (u_shadow > 0.5) s = u_ls.xy + (pos.xy - u_ls.xy) * (u_ls.z / max(u_ls.z - pos.z, 1.0));   // הצל: הטלה פרספקטיבית מנקודה על מקור האור אל מישור הדף
  else s = u_C + (pos.xy - u_C) * (u_cam / (u_cam - pos.z));     // פרספקטיבה
  gl_Position = vec4(s.x / u_size.x * 2.0 - 1.0, 1.0 - s.y / u_size.y * 2.0, 0.5 - pos.z / (30.0 * u_r + 1.0), 1.0);
}`;
const FS = `precision highp float;
uniform sampler2D u_tex; uniform vec3 u_paper; uniform vec2 u_n; uniform float u_wash, u_dark, u_shadow, u_r, u_hasTex;
varying vec2 v_uv; varying float v_d, v_arc, v_th, v_z;
void main() {
  if (v_d < 0.0 || v_arc < 0.0) discard;
  if (u_shadow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, u_wash); return; }   // תרומה של דגימה אחת (u_wash = 1/N)
  vec3 tex = u_hasTex > 0.5 ? texture2D(u_tex, v_uv).rgb : u_paper;
  vec2 into = -u_n;
  // איזה צד של הנייר פונה לקורא: בחצי התחתון של הגליל (θ < π/2) רואים מלמעלה את הצד הקדמי (קצה דף שמתרומם —
  // טקסט רגיל, מקוצר בפרספקטיבה); מעליו ובכנף — הגב (הטקסט הפוך, דהוי מעט). הנורמל — של הצד הנראה
  vec3 No = v_th > 0.0 ? normalize(vec3(into * sin(v_th), -cos(v_th))) : vec3(0.0, 0.0, 1.0);
  bool frontSide = No.z < 0.0;
  vec3 N = frontSide ? -No : No;
  // דף אחד נקי כמו בקינדל: על הגליל — נייר חלק עם הצללה בלבד (הטקסט שם דחוס מדי ונראה כ"עוד דף"); הטקסט ההפוך
  // מופיע רק על הכנף השטוחה, במעבר רך מראש הגליל
  vec3 back = mix(tex, u_paper, u_wash);
  vec3 col = mix(u_paper, back, smoothstep(2.2, 2.85, v_th));   // הטקסט ההפוך מתחיל כבר בחלק העליון של הגליל — דף מלא, לא חלקי
  vec3 L = normalize(vec3(-0.18, -0.4, 1.0)), H = normalize(L + vec3(0.0, 0.0, 1.0));   // אותו מקור אור של הצל
  float dif = max(dot(N, L), 0.0), spec = pow(max(dot(N, H), 0.0), 48.0);
  float b = 0.5 + 0.56 * dif;                                     // שטוח (N = z) ≈ 1
  vec3 c = u_dark > 0.5 ? col * (0.55 + 0.55 * b) + vec3(0.045 + 0.06 * dif + 0.14 * spec) : col * b + vec3(0.16 * spec);   // כהה: ברק עדין — הנייר המורם נראה על רקע שחור
  gl_FragColor = vec4(c, 1.0);
}`;
const BLUR = `precision mediump float; uniform sampler2D u_t; uniform vec2 u_d; varying vec2 v;
void main() { vec4 s = texture2D(u_t, v) * 0.2270270270;
  s += (texture2D(u_t, v + u_d * 1.3846153846) + texture2D(u_t, v - u_d * 1.3846153846)) * 0.3162162162;
  s += (texture2D(u_t, v + u_d * 3.2307692308) + texture2D(u_t, v - u_d * 3.2307692308)) * 0.0702702703;
  gl_FragColor = s; }`;
const QUAD = `attribute vec2 a; varying vec2 v; void main() { v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;
const COMP = `precision mediump float; uniform sampler2D u_t; uniform float u_k; varying vec2 v; void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, texture2D(u_t, v).a * u_k); }`;
const LIGHT = Array.from({ length: 32 }, (_, i) => {   // דגימות של מקור אור עגול (ספירלת פיבונאצ׳י — פיזור אחיד בלי דפוסים)
  const r = Math.sqrt((i + 0.5) / 32), a = i * 2.399963229728653;
  return [r * Math.cos(a), r * Math.sin(a)];
});
export function createCurlGL(canvas) {
  let gl = null;
  try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: true, preserveDrawingBuffer: false }); } catch (e) {}
  if (!gl) return null;
  const sh = (t, src) => { const x = gl.createShader(t); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; };
  let pm, pb, pc;
  try { pm = prog(VS, FS); pb = prog(QUAD, BLUR); pc = prog(QUAD, COMP); } catch (e) { return null; }
  // רשת: 64 × 96 תאים בקואורדינטות החומר
  const NX = 64, NY = 96, uv = new Float32Array((NX + 1) * (NY + 1) * 2), idx = new Uint16Array(NX * NY * 6);
  for (let j = 0, k = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { uv[k++] = i / NX; uv[k++] = j / NY; }
  for (let j = 0, k = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.set([a, c, b, b, c, d], k); k += 6; }
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const mkTex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  const pageTex = mkTex();
  let hasTex = false, fb = [], fw = 0, fh = 0;
  function fbos(w, h) {                              // שני משטחים בחצי רזולוציה לצל ולטשטוש
    if (w === fw && h === fh) return;
    fw = w; fh = h;
    for (const f of fb) { gl.deleteFramebuffer(f.f); gl.deleteTexture(f.t); if (f.rb) gl.deleteRenderbuffer(f.rb); }
    fb = [0, 1].map((i) => {
      const t = mkTex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      let rb = null;
      if (i === 0) { rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, rb); }
      return { f, t, rb };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function quad(p) { gl.useProgram(p.p); gl.bindBuffer(gl.ARRAY_BUFFER, qb); const a = gl.getAttribLocation(p.p, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
  function mesh(st, shadow, ls, k) {
    const { u } = pm;
    gl.useProgram(pm.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    const a = gl.getAttribLocation(pm.p, 'a_uv'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(u.u_size, st.W, st.H); gl.uniform2f(u.u_M, st.M[0], st.M[1]); gl.uniform2f(u.u_n, st.n[0], st.n[1]);
    gl.uniform2f(u.u_C, st.W / 2, st.H / 2); if (ls) gl.uniform3f(u.u_ls, ls[0], ls[1], ls[2]);
    gl.uniform2f(u.u_ax, st.ax[0], st.ax[1]); gl.uniform1f(u.u_kc, st.kc);
    gl.uniform1f(u.u_r, st.r); gl.uniform1f(u.u_shift, st.shift); gl.uniform1f(u.u_cam, st.cam); gl.uniform1f(u.u_shadow, shadow ? 1 : 0);
    gl.uniform3f(u.u_paper, st.paper[0], st.paper[1], st.paper[2]); gl.uniform1f(u.u_wash, shadow ? k : st.wash); gl.uniform1f(u.u_dark, st.dark ? 1 : 0);
    gl.uniform1f(u.u_hasTex, hasTex ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pageTex); gl.uniform1i(u.u_tex, 0);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
  }
  return {
    setTexture(cv) {
      gl.bindTexture(gl.TEXTURE_2D, pageTex);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cv); hasTex = true; } catch (e) { hasTex = false; }
    },
    clearTexture() { hasTex = false; },
    resize(w, h) { if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } },
    render(st) {                                     // st: W, H, M, n, r, shift, cam, sh (הטלת הצל), shadowK, paper, wash, dark
      const cw = canvas.width, ch = canvas.height, hw = Math.max(1, cw >> 1), hh = Math.max(1, ch >> 1);
      fbos(hw, hh);
      // 1) הצל הרך: מקור אור שטחי (מנורה גדולה מעל המסך), N נקודות דגימה (ספירלת פיבונאצ׳י); מכל נקודה הדף המורם
      //    מוטל במדויק על מישור הדף, וכל פיקסל נספר פעם אחת לכל דגימה (stencil). התוצאה = החלק של המנורה שמוסתר —
      //    חד וכהה במגע של הגליל, רחב ורך ככל שהדף גבוה יותר (צל פיזיקלי, כמו בעיבוד של סרטים)
      gl.disable(gl.DEPTH_TEST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb[0].f); gl.viewport(0, 0, hw, hh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
      const N = LIGHT.length, D = st.H * 1.4, Rl = D * 0.2, Lc = [st.W * 0.5 - 0.18 * D, st.H * 0.5 - 0.4 * D];
      for (let i = 0; i < N; i++) {
        gl.clear(gl.STENCIL_BUFFER_BIT);
        mesh(st, true, [Lc[0] + LIGHT[i][0] * Rl, Lc[1] + LIGHT[i][1] * Rl, D], 1 / N);
      }
      gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND);
      const rad = st.blur / 2;                       // פיקסלים בחצי רזולוציה
      for (const [src, dst, dx, dy] of [[0, 1, rad / hw, 0], [1, 0, 0, rad / hh]]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb[dst].f); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(pb.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fb[src].t); gl.uniform1i(pb.u.u_t, 0); gl.uniform2f(pb.u.u_d, dx, dy);
        quad(pb);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cw, ch);
      gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(pc.p); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fb[0].t); gl.uniform1i(pc.u.u_t, 0); gl.uniform1f(pc.u.u_k, st.shadowK);
      quad(pc);
      // 2) הגליל והכנף — עם עומק (החלק העליון של הגליל מסתיר את התחתון)
      gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
      mesh(st, false);
    },
    destroy() { try { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) {} },
  };
}

/* הבקר. env: box (שכבת הקורא), view (foliate-view), foot, frame() → ה־iframe האמיתי, renderer() → המנוע (page/pages),
   page() → { page, dark }, rtl(), styleKey(), bookCss(), canTurn(dir), adjacent(dir) → אינדקס הפרק השכן או null,
   sectionIndex(), loadSection(i) → Promise<url>, jump(dir) → Promise (מעבר מיידי במנוע) */
export function createCurl(env) {
  const clock = () => (env.now ? env.now() : performance.now());   // זמן (בבדיקות — שעון נשלט: צילום פריים־פריים)
  const doc = env.box.ownerDocument;
  const mk = (cls) => { const e = doc.createElement('div'); e.className = cls; return e; };
  const pane = (L) => {                              // משטח עם iframe משוכפל; משטחים לא פעילים מוסתרים (ולא display:none — שומר פריסה)
    const pn = mk('pc-pane'), fr = doc.createElement('iframe');
    fr.setAttribute('sandbox', 'allow-same-origin'); fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
    fr.className = 'pc-frame';
    const extra = mk('pc-extra');
    pn.append(fr, extra); pn.style.visibility = 'hidden';
    L.append(pn);
    return { pane: pn, fr, extra, src: null, key: '' };
  };
  const A = mk('pc-a'), shade = mk('pc-shade'), roll = mk('pc-roll'), Bw = mk('pc-b'), B = mk('pc-sheet'), tint = mk('pc-tint');
  const P = { acur: pane(A), anext: pane(A), aprev: pane(A), bcur: pane(B), bprev: pane(B) };
  B.append(tint);
  Bw.append(B);
  // המנוע התלת־ממדי: קנבס מעל הכל (מתחת לסימנייה ולסרגלים); בלי WebGL — השכבות של DOM (גליל, כנף, צל)
  const glc = doc.createElement('canvas'); glc.className = 'pc-gl'; glc.setAttribute('aria-hidden', 'true');
  let GL = null;
  try { GL = env.noGL ? null : createCurlGL(glc); } catch (e) { GL = null; }
  env.box.append(A, shade, roll, Bw);
  if (GL) env.box.append(glc);
  const layers = GL ? [A, glc] : [A, shade, roll, Bw];
  const off = (on) => { for (const e of layers) e.style.visibility = on ? 'visible' : 'hidden'; };
  off(false);
  const show = (L, pn) => { for (const k in P) if (P[k].pane.parentNode === L) P[k].pane.style.visibility = P[k] === pn ? 'inherit' : 'hidden'; };

  /* שכפול מסמך — רק כשהמקור/הגודל/העיצוב השתנו */
  function importDoc(c, srcDoc, key) {
    if (c.src === srcDoc && c.key === key && c.fr.contentDocument && c.fr.contentDocument.body) return true;
    const d = c.fr.contentDocument;
    if (!d || !srcDoc || !srcDoc.documentElement) return false;
    d.open(); d.write('<!DOCTYPE html><html></html>'); d.close();
    d.replaceChild(d.importNode(srcDoc.documentElement, true), d.documentElement);
    c.src = srcDoc; c.key = key;
    return true;
  }
  function curKey() { const r = env.frame().getBoundingClientRect(); return [env.styleKey(), Math.round(r.width), Math.round(r.height)].join('|'); }
  function syncCur() {
    const real = env.frame();
    if (!real || !real.contentDocument) return false;
    const k = curKey();
    return importDoc(P.acur, real.contentDocument, k) && importDoc(P.bcur, real.contentDocument, k);
  }
  function geom() {                                  // מלבן התוכן (#container של המנוע) והקופסה, ביחס לשכבת הקורא
    const real = env.frame(), cont = real.parentElement && real.parentElement.parentElement;
    const br = env.box.getBoundingClientRect();
    return { real, cont, br, cr: cont.getBoundingClientRect(), rr: real.getBoundingClientRect() };
  }
  function placeCur(c, delta, withFoot) {            // שכפול של הפרק הנוכחי: delta = 0 נוכחי, ±1 שכן באותו פרק
    const { real, br, cr, rr } = geom();
    const shift = delta * cr.width * (env.rtl() ? 1 : -1);
    Object.assign(c.pane.style, { left: cr.left - br.left + 'px', top: cr.top - br.top + 'px', width: cr.width + 'px', height: cr.height + 'px' });
    Object.assign(c.fr.style, { left: rr.left - cr.left + shift + 'px', top: rr.top - cr.top + 'px', width: rr.width + 'px', height: rr.height + 'px' });
    c.extra.textContent = '';
    for (const el of real.parentElement.children) {  // ההדגשות (שכבת ה־SVG של המנוע)
      if (el === real) continue;
      const er = el.getBoundingClientRect(); if (!er.width) continue;
      const cl = el.cloneNode(true);
      Object.assign(cl.style, { position: 'absolute', margin: '0', left: er.left - cr.left + shift + 'px', top: er.top - cr.top + 'px', width: er.width + 'px', height: er.height + 'px' });
      c.extra.append(cl);
    }
    footFor(c, withFoot);
  }
  function footFor(c, on) {
    const L = c.pane.parentNode, old = L.querySelector(':scope > .pc-foot'); if (old) old.remove();
    if (!on || !env.foot) return;
    const br = env.box.getBoundingClientRect(), fr = env.foot.getBoundingClientRect(), f = env.foot.cloneNode(true);
    f.classList.add('pc-foot');
    Object.assign(f.style, { position: 'absolute', inset: 'auto', left: fr.left - br.left + 'px', top: fr.top - br.top + 'px', width: fr.width + 'px', height: fr.height + 'px', margin: '0', visibility: 'inherit', clipPath: 'none' });
    L.append(f);
  }

  /* הפרק השכן — נטען מראש לשכפול משלו, עם אותו עיצוב (bookCSS) ואותה פריסת עמודות של המנוע, ונמדד כמו במנוע */
  const nb = { prev: { c: P.aprev, idx: null, key: '', pages: 0, rtl: false, ready: false, job: null }, next: { c: P.anext, idx: null, key: '', pages: 0, rtl: false, ready: false, job: null } };
  function neighborKey(i) { return i + '|' + curKey(); }
  function ensureNeighbor(which) {
    const n = nb[which], i = env.adjacent(which === 'next' ? 1 : -1);
    if (i == null) { n.idx = null; n.ready = false; return Promise.resolve(false); }
    const key = neighborKey(i);
    if (n.key === key && (n.ready || n.job)) return n.job || Promise.resolve(true);
    n.key = key; n.idx = i; n.ready = false;
    const job = n.job = (async () => {
      const url = await env.loadSection(i);
      if (n.key !== key) return false;
      const c = n.c, real = env.frame(), rd0 = real.contentDocument;
      await new Promise((res) => { c.fr.addEventListener('load', res, { once: true }); c.fr.src = url; });
      if (n.key !== key) return false;
      const d = c.fr.contentDocument; if (!d || !d.body) return false;
      if (d.head) { const st = d.createElement('style'); st.textContent = env.bookCss(); d.head.append(st); }
      d.documentElement.setAttribute('style', rd0.documentElement.getAttribute('style') || '');
      d.body.style.cssText += ';' + (rd0.body.getAttribute('style') || '');
      const { cr, rr } = geom(), size = cr.width;
      for (const el of d.body.querySelectorAll('img, svg, video')) Object.assign(el.style, { maxHeight: (rr.height - 88) + 'px', maxWidth: '100%', objectFit: 'contain', breakInside: 'avoid' });
      Object.assign(c.fr.style, { width: size + 'px', height: rr.height + 'px' });
      try { await d.fonts.ready; } catch (e) {}
      const cs = d.defaultView.getComputedStyle(d.body);
      n.rtl = d.body.dir === 'rtl' || d.documentElement.dir === 'rtl' || cs.direction === 'rtl';
      const rg = d.createRange(); rg.selectNodeContents(d.body);
      const q = rg.getBoundingClientRect(), root = d.documentElement.getBoundingClientRect();
      const start = n.rtl ? root.right - q.right : q.left - root.left;
      n.pages = Math.max(1, Math.ceil((start + q.width) / size - 0.01));
      c.fr.style.width = n.pages * size + 'px';
      if (n.key !== key) return false;
      n.ready = true; n.src = d;
      return true;
    })().catch(() => false).finally(() => { if (n.job === job) n.job = null; });
    return job;
  }
  function placeNeighbor(c, n, last, withFoot) {    // העמוד הראשון/האחרון של הפרק השכן, באותו מקום כמו עמוד במנוע
    const { br, cr, rr } = geom(), size = cr.width;
    const k = last ? n.pages - 1 : 0;                // אינדקס העמוד בתוך הפרק
    const left = n.rtl ? -(n.pages - 1 - k) * size : -k * size;
    Object.assign(c.pane.style, { left: cr.left - br.left + 'px', top: cr.top - br.top + 'px', width: cr.width + 'px', height: cr.height + 'px' });
    Object.assign(c.fr.style, { left: left + 'px', top: rr.top - cr.top + 'px', height: rr.height + 'px' });
    c.extra.textContent = '';
    footFor(c, withFoot);
  }

  const T_DRAG = 0.55, T_AUTO = 0.2;                 // כנף מרבית בגרירה / בדפדוף אוטומטי (×W) — שכבות ה־DOM
  const T_GL = 0.5;                                  // בתלת־ממד: גליל + כנף עד חצי מסך (כנף ~30% כמו בסרטונים של קינדל; מעוגן בשדרה עד אז)
  // מהירות הגליל ברוחבי מסך לשנייה — בקינדל נמדד ~1.3 (0.7 שנ׳ לעמוד); בקשת המשתמש: קצת יותר לאט, כדי להרגיש את הדפדוף
  const SPEED = 0.62;                               // סבב 6: "עדיין עובר מהר" — ~1.6 שנ׳ לעמוד
  let g = null, raf = 0, q = Promise.resolve(), busy = false;
  const jump = (dir) => (q = q.then(() => env.jump(dir)).catch(() => {}));
  function clipView(pts) {
    const vr = env.view.getBoundingClientRect(), br = env.box.getBoundingClientRect();
    env.view.style.clipPath = pts ? polyCss(pts, vr.left - br.left, vr.top - br.top) : '';
    if (env.foot) {
      const fr = env.foot.getBoundingClientRect();
      env.foot.style.clipPath = pts ? polyCss(pts, fr.left - br.left, fr.top - br.top) : '';
    }
  }
  function draw() {
    if (!g) return;
    const { W, H } = g, th = env.page();
    const G = GL ? curlGeom(W, H, g.p, g.phi, g.gy, g.rtl, curlRadius(W), g.T) : curlGeom(W, H, g.p, g.phi, g.gy, g.rtl, curlRadius(W), g.T);
    const into = [-G.n[0], -G.n[1]];                 // לכיוון הצד שמתהפך
    const pr = Math.PI * G.r;
    // עוצמת הצללים: עולה עם הקיפול ודועכת כשהדף כמעט עבר — בלי "קפיצה" בפריים הראשון/האחרון
    const vis = Math.max(0, Math.min(1, (g.p * W) / (G.r * 1.6), (curlEnd(W, H, 0) - g.p) * W / (G.r * 2.2)));
    if (g.dir > 0) clipView(G.front); else A.style.clipPath = polyCss(G.front);
    if (GL) {
      const dpr = g.dpr;
      GL.resize(Math.round(W * dpr), Math.round(H * dpr));
      const up = g.gy > H / 2;                         // אחיזה בחצי התחתון — הרדיוס גדל כלפי מעלה
      let ax = [-G.n[1], G.n[0]]; if ((ax[1] < 0) !== up) ax = [-ax[0], -ax[1]];
      const kc = (typeof window !== 'undefined' && window.__pcKC != null) ? window.__pcKC : 0.5;   // בדיקות: __pcKC
      GL.render({ W, H, M: G.M, n: G.n, r: G.r, shift: G.shift, cam: H * 2.6, ax, kc,
        shadowK: (typeof window !== 'undefined' && window.__pcShadowK != null ? window.__pcShadowK : 1) * vis * (th.dark ? 0.8 : 0.5), blur: 7 * dpr,   // סבב 7: צל רך ורחב יותר ליד הגליל, כמו בקינדל   // בדיקות: __pcShadowK
        paper: rgb01(th.page), wash: th.dark ? 0.2 : 0.12, dark: th.dark });
      return;
    }
    // צל רך על הדף שמתגלה — מקצה הגליל והלאה, דועך אקספוננציאלית
    shade.style.background = gradAt(W, H, G.M, into, shadowStops((th.dark ? 0.75 : 0.3) * vis, W * 0.03, G.r));
    // הגליל: תאורה פיזיקלית (rollStops) מעל צבע הדף; בלי טקסט — החומר דחוס על הקימור
    roll.style.clipPath = polyCss(G.roll);
    roll.style.background = gradAt(W, H, G.M, into, rollStops(G.r, th.dark)) + ', ' + th.page;
    Bw.style.clipPath = polyCss(G.front);
    B.style.transform = 'matrix(' + G.m.map((x) => x.toFixed(5)).join(',') + ')';
    // הצל שהכנף מטילה על הדף שמתחתיה: רך ורחב + חד וצמוד (מגע)
    B.style.boxShadow = th.dark
      ? '0 0 ' + (16 * vis).toFixed(1) + 'px rgba(0,0,0,' + (0.9 * vis).toFixed(3) + ')'
      : '0 0 ' + (18 * vis).toFixed(1) + 'px rgba(0,0,0,' + (0.2 * vis).toFixed(3) + '), 0 0 ' + (2.5 * vis).toFixed(1) + 'px rgba(0,0,0,' + (0.16 * vis).toFixed(3) + ')';
    // גב הדף: טקסט הפוך (נייר דק — קריא אבל דהוי); ליד הגליל בהיר (ממשיך את ראש הגליל), והולך ומאפיר לכיוון הקצה
    const s0 = pr + G.shift, len = Math.max(1, G.far - pr);
    const wash = th.dark ? 'rgba(0,0,0,.5)' : hexA(th.page, 0.42);
    tint.style.background = gradAt(W, H, G.M, into, th.dark
      ? [[s0, 'rgba(255,255,255,.08)'], [s0 + len * 0.5, 'rgba(255,255,255,.04)'], [s0 + len, 'rgba(255,255,255,.02)']]
      : [[s0, 'rgba(255,255,255,.35)'], [s0 + 3, 'rgba(255,255,255,.2)'], [s0 + len * 0.45, 'rgba(0,0,0,.03)'], [s0 + len, 'rgba(0,0,0,.09)']]) + ', ' + wash;
  }
  function begin(dir, x, y) {                        // false = אי אפשר עכשיו (המתקשר עושה מעבר רגיל בשחרור)
    if (busy || !env.canTurn(dir)) return false;
    const real = env.frame(), r = env.renderer();
    if (!real || !r || !syncCur()) return false;
    const cross = dir > 0 ? r.page + 1 > r.pages - 2 : r.page - 1 < 1;
    const n = nb[dir > 0 ? 'next' : 'prev'];
    if (cross && !(n.ready && n.idx === env.adjacent(dir))) { ensureNeighbor(dir > 0 ? 'next' : 'prev'); return false; }
    if (cross && dir < 0 && !importDoc(P.bprev, n.src, 'nb|' + n.key)) return false;
    const br = env.box.getBoundingClientRect(), th = env.page();
    const s = g = { dir, W: br.width, H: br.height, rtl: env.rtl(), sx: x, sy: y, gy: Math.max(0, Math.min(br.height, y - br.top)), p: dir > 0 ? 0 : curlEnd(br.width, br.height, 0), phi: 0, v: 0, lt: 0, lp: 0, T: br.width * T_DRAG };
    A.style.background = th.page; B.style.background = th.page;
    if (dir > 0) {                                   // מתחת: העמוד הבא; הכנף: העמוד הנוכחי; המנוע — הדף שמתקפל
      A.style.zIndex = '1'; A.style.clipPath = '';
      if (cross) { placeNeighbor(P.anext, n, false, false); show(A, P.anext); } else { placeCur(P.acur, 1, false); show(A, P.acur); }
      placeCur(P.bcur, 0, true); show(B, P.bcur);
    } else {                                         // מעל המנוע: העמוד הקודם (החלק השטוח) + הכנף מאותו עמוד
      A.style.zIndex = '3';
      if (cross) { placeNeighbor(P.aprev, n, true, false); show(A, P.aprev); placeNeighbor(P.bprev, n, true, false); P.bprev.fr.style.width = P.aprev.fr.style.width; show(B, P.bprev); }
      else { placeCur(P.acur, -1, false); show(A, P.acur); placeCur(P.bcur, -1, false); show(B, P.bcur); }
    }
    Object.assign(B.style, { width: g.W + 'px', height: g.H + 'px' });
    g.dpr = Math.min(2.5, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
    if (GL) {                                        // גב הדף: הציור המדויק של העמוד שמתקפל, ברזולוציית המסך
      let cv = null;
      try {
        if (dir > 0) cv = env.paint({ frame: real, shiftX: 0, foot: true, overlay: true, dpr: g.dpr });
        else if (cross) cv = env.paint({ frame: P.aprev.fr, shiftX: 0, foot: false, overlay: false, dpr: g.dpr });
        else cv = env.paint({ frame: real, shiftX: -1 * geom().cr.width * (env.rtl() ? 1 : -1), foot: false, overlay: true, dpr: g.dpr });
      } catch (e) { cv = null; }
      if (cv) GL.setTexture(cv); else GL.clearTexture();
    }
    draw();
    off(true);
    busy = true;
    void s;
    return true;
  }
  function move(x, y) {
    if (!g || g.anim) return;
    const t = clock();
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
    const go = force === 'cancel' ? false : curlCommit(g.dir, g.p, g.v, curlEnd(g.W, g.H, 0));
    animateTo(go);
  }
  function animateTo(go) {
    // כמו בקינדל: הגליל ממשיך במהירות כמעט קבועה, ממשיך את תנופת האצבע ומאט רק בסוף; הכנף מצטמצמת לרצועה צרה
    // שעוברת לרוחב העמוד; ההטיה מתיישרת
    const s = g, p0 = s.p, phi0 = s.phi, T0 = s.T;
    const target = (go ? s.dir > 0 : s.dir < 0) ? curlEnd(s.W, s.H, phi0) : -0.02 - Math.abs(Math.tan(phi0)) * s.H / s.W;
    const dist = Math.abs(target - p0);
    const dur = Math.max(520, Math.min(1700, dist / SPEED * 1000));
    const vTo = Math.sign(target - p0) * s.v;          // מהירות האצבע בכיוון היעד (p למילישנייה)
    const m0 = Math.max(0.9, Math.min(1.25, dist > 0 ? vTo * dur / dist : 1));
    const Tend = s.W * (GL ? T_GL : T_AUTO) + Math.PI * curlRadius(s.W);   // בתלת־ממד הכנף נשארת רחבה ומלאה עד הסוף (כמו בקינדל)
    s.anim = { go, t0: 0, dur };
    const step = () => {
      if (g !== s) return;
      const now = clock();
      s.anim.t0 = s.anim.t0 || now;
      const k = Math.min(1, (now - s.anim.t0) / dur), e = curlEase(k, m0);
      s.p = p0 + (target - p0) * e; s.phi = phi0 * (1 - Math.min(1, k * 1.6));
      s.T = T0 + (Tend - T0) * Math.min(1, k * 2.2);
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
    if (go) await jump(s.dir);                       // המעבר האמיתי — פעם אחת, כשהשכבות מכסות את המסך במצב הסופי
    off(false);
    clipView(null);
    A.style.clipPath = ''; Bw.style.clipPath = '';
    busy = false;
    if (env.onDone) env.onDone(go);
  }
  return {
    begin, move, end,
    active: () => !!g,
    busy: () => busy,
    finishNow() { if (g && g.anim) { const s = g; s.p = (s.anim.go ? s.dir > 0 : s.dir < 0) ? curlEnd(s.W, s.H, 0.6) : -0.6; draw(); finish(); } },
    prebuild() {
      if (g || busy) return;
      try { syncCur(); } catch (e) {}
      ensureNeighbor('next'); ensureNeighbor('prev');
    },
    destroy() { cancelAnimationFrame(raf); g = null; for (const e of [A, shade, roll, Bw, glc]) e.remove(); if (GL) GL.destroy(); },
    gl: () => !!GL,
    _state: () => (g ? { p: g.p, phi: g.phi, dir: g.dir } : null),
    _pose: (p, phi) => { if (g) { g.p = p; if (phi != null) g.phi = phi; draw(); } },   // כלי כיול: תנוחה סטטית
    _nb: () => ({ prev: { idx: nb.prev.idx, ready: nb.prev.ready, pages: nb.prev.pages }, next: { idx: nb.next.idx, ready: nb.next.ready, pages: nb.next.pages } }),
  };
}
function rgb01(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return [1, 1, 1];
  const n = parseInt(m[1], 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return 'rgba(255,255,255,' + a + ')';
  const n = parseInt(m[1], 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
