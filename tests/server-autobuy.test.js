/* הזמנה אוטומטית של CX53 (12/10/2026): tools/server-autobuy.js + .github/workflows/autobuy.yml.
   Hetzner, Vercel, Firestore ו־Google OAuth מדומים — בלי רשת, בלי סודות אמיתיים ובלי הזמנה אמיתית. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const A = require('../tools/server-autobuy.js');

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { bad++; console.log('not ok - ' + m); } };
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const SA = (p) => JSON.stringify({ type: 'service_account', project_id: p, client_email: 'x@' + p + '.iam.gserviceaccount.com', private_key: pem, token_uri: 'https://oauth2.googleapis.com/token' });
const E = {
  HCLOUD_TOKEN: 'H'.repeat(64),
  STG_FIREBASE_SA: SA('snowball-staging-758f6'),
  STG_TUNNEL_TOKEN: 'eyJ' + 'A'.repeat(180),
  STG_R2_ACCESS_KEY_ID: 'a'.repeat(32),
  STG_R2_SECRET_ACCESS_KEY: 'b'.repeat(64),
  STG_ANTHROPIC_KEY: 'sk-ant-api03-' + 'K'.repeat(80),
  STG_ADMIN_EMAIL: 'admin@example.com',
  CLOUDFLARE_ACCOUNT_ID: 'c'.repeat(32),
  PROD_FIREBASE_SA: SA('yishaiguedj1-c786e'),
  PROD_ANTHROPIC_KEY: 'sk-ant-api03-' + 'P'.repeat(80),
  PROD_TUNNEL_TOKEN: 'eyJ' + 'B'.repeat(180),
  VERCEL_TOKEN: 'v'.repeat(24),
  SNB_AUTOBUY_MAX: '20',
};

/* avail: רשימת מצבים לפי סדר הבדיקות — כל בדיקה לוקחת את הבא (האחרון חוזר). create: קודי שגיאה לפי סדר */
function mock(o = {}) {
  const calls = [], docs = {};
  let t = 1_000_000, checks = 0;
  const creates = (o.create || []).slice();
  const res = (status, j) => ({ status, json: async () => j, text: async () => JSON.stringify(j) });
  const fetch = async (url, init = {}) => {
    const m = init.method || 'GET';
    calls.push({ url, m, body: init.body });
    if (url === 'https://oauth2.googleapis.com/token') return res(200, { access_token: 'ya29.t', expires_in: 3600 });
    if (url.startsWith('https://firestore.googleapis.com/')) {
      const id = url.split('/documents/')[1].split('?')[0];
      if (m === 'PATCH') { docs[id] = 1; return res(200, {}); }
      if (m === 'DELETE') { delete docs[id]; return res(200, {}); }
      return res(404, {});
    }
    if (url.startsWith('https://api.vercel.com/')) {
      return res(200, { envs: [{ id: 'env_1', key: 'GDRIVE_SA_KEY', value: SA('yishaiguedj1-c786e'), type: 'encrypted', target: ['production'], decrypted: true }] });
    }
    if (url.startsWith('https://api.hetzner.cloud/v1')) {
      const p = url.slice('https://api.hetzner.cloud/v1'.length);
      if (p.startsWith('/server_types?name=') && o.typeFail && o.typeFail.length) {
        const s = o.typeFail.shift();
        if (s) return res(s, { error: { code: s === 401 ? 'unauthorized' : 'unavailable' } });
      }
      if (p.startsWith('/servers?name=') && o.listFail) return res(o.listFail, { error: { code: 'unavailable' } });
      if (p.startsWith('/server_types?name=')) {
        const name = decodeURIComponent(p.split('=')[1]);
        let av = {};
        if (name === 'cx53') { const list = o.avail || [{}]; av = list[Math.min(checks, list.length - 1)]; checks++; }
        const price = (name === 'cx53' ? (o.price || '17.49') : '24.49');
        return res(200, { server_types: [{ id: 99, name, memory: 16, prices: ['fsn1', 'nbg1'].map((l) => ({ location: l, price_monthly: { net: price, gross: price } })),
          locations: ['fsn1', 'nbg1', 'hel1'].map((l) => ({ name: l, available: !!av[l] })) }] });
      }
      if (p === '/pricing') return res(200, { pricing: { currency: 'USD', primary_ips: [{ type: 'ipv4', prices: [{ location: 'fsn1', price_monthly: { gross: '0.50' } }, { location: 'nbg1', price_monthly: { gross: '0.50' } }] }] } });
      if (p.startsWith('/servers?name=')) return res(200, { servers: o.exists ? [{ id: 1 }] : [] });
      if (p === '/firewalls?name=snb-closed') return res(200, { firewalls: [{ id: 7, rules: [] }] });
      if (p === '/servers' && m === 'POST') {
        const c = creates.shift();
        if (c) return res(c === 'resource_unavailable' ? 412 : 422, { error: { code: c } });
        return res(201, { server: { id: 555 } });
      }
      if (p.startsWith('/datacenters')) return res(410, { error: { code: 'gone' } });
    }
    return res(404, {});
  };
  return { calls, docs, deps: { fetch, now: () => t, sleep: async (ms) => { t += ms; } }, checks: () => checks };
}
const posts = (M) => M.calls.filter((c) => c.m === 'POST' && c.url.endsWith('/v1/servers'));

(async () => {
  /* ---------- check: מחיר, מלאי וסודות — בלי הזמנה ---------- */
  {
    const M = mock({ avail: [{ fsn1: true }] });
    const out = await A.check(E, M.deps);
    ok(out.includes('cx53 · fsn1 · 17.99 USD לחודש (כולל IPv4) · במלאי עכשיו') && out.includes('cx53 · nbg1 · 17.99 USD') && out.includes('אזל'),
      'check: המחיר במטבע של החשבון (שרת + IPv4) והמלאי לכל מיקום');
    ok(out.includes('cax31 · fsn1 · 24.99 USD'), 'check: גם המחיר של CAX31 — להשוואה');
    ok(out.includes('הסודות: תקינים'), 'check: הסודות נבדקו (בלי ערכים)');
    ok(!posts(M).length && !M.calls.some((c) => c.url.includes('firestore') && c.m === 'PATCH'), 'check: בלי הזמנה ובלי רישום טוקנים');
    ok(!M.calls.some((c) => c.url.includes('/datacenters')), 'הזמינות מ־server_types.locations — לא מ־/datacenters (410 מ־1/10/2026)');
    const bad2 = await A.check(Object.assign({}, E, { PROD_TUNNEL_TOKEN: '' }), mock().deps);
    ok(bad2.includes('הסודות: ✗') && bad2.includes('PROD_TUNNEL_TOKEN') && !bad2.includes(E.PROD_ANTHROPIC_KEY), 'check: סוד חסר — השם בלבד');
  }

  /* ---------- watch: בלי תקרה = לא מזמינים ---------- */
  {
    const M = mock({ avail: [{ fsn1: true }] });
    const r = await A.watch(Object.assign({}, E, { SNB_AUTOBUY_MAX: '' }), M.deps, { minutes: 5 });
    ok(r.stop === 'no_max' && !posts(M).length, 'בלי SNB_AUTOBUY_MAX — לא מזמינים כלום');
  }

  /* ---------- watch: אין מלאי, ואז יש ב־fsn1 — הזמנה אחת ---------- */
  {
    const M = mock({ avail: [{}, {}, {}, { fsn1: true, nbg1: true }] });
    const r = await A.watch(E, M.deps, { minutes: 60 });
    ok(r.bought && r.bought.location === 'fsn1' && r.bought.server === 555 && M.deps.now() === 1_000_000 + 3 * 60e3, 'שלוש דקות בלי מלאי, ובבדיקה הרביעית מזמינים — ב־fsn1 (קודם)');
    const b = JSON.parse(posts(M)[0].body);
    ok(posts(M).length === 1 && b.name === 'snb-cx53' && b.server_type === 'cx53' && b.firewalls[0].firewall === 7 && b.labels.snb === 'all',
      'הזמנה אחת: השם הקבוע, CX53, חומת האש הסגורה, תוכנית all');
    ok(b.user_data.includes('path: /etc/snb/app.env') && b.user_data.includes('path: /etc/snb/worker.env') && b.user_data.includes('path: /etc/snb/app-stg.env'),
      'קוד ההקמה: כל החדרים (ייצור + ניסוי + השרתון של הייצור)');
    ok(Object.keys(M.docs).filter((k) => k.startsWith('studioServers/')).length === 2 && r.bought.sid && r.bought.sidp, 'טוקן שרת לכל סביבה נרשם');
    ok(r.bought.price === 17.99 && r.bought.currency === 'USD', 'המחיר שהוזמן בו — מוחזר לדיווח');
  }

  /* ---------- המלאי נגמר באמצע: fsn1 → nbg1, ואם גם שם — ממשיכים לחכות, בלי טוקנים יתומים ---------- */
  {
    const M = mock({ avail: [{ fsn1: true, nbg1: true }, {}], create: ['resource_unavailable'] });
    const r = await A.watch(E, M.deps, { minutes: 10 });
    ok(r.bought && r.bought.location === 'nbg1' && posts(M).length === 2, 'fsn1 נגמר תוך כדי (resource_unavailable) — nbg1');
    const M2 = mock({ avail: [{ fsn1: true, nbg1: true }, {}], create: ['resource_unavailable', 'resource_unavailable'] });
    const r2 = await A.watch(E, M2.deps, { minutes: 5 });
    ok(r2.timeout && !Object.keys(M2.docs).some((k) => k.startsWith('studioServers/')), 'נגמר בשניהם — ממשיכים לחכות, והרישומים נמחקו');
  }

  /* ---------- עצירות ---------- */
  {
    const M = mock({ avail: [{ fsn1: true }], exists: true });
    const r = await A.watch(E, M.deps, { minutes: 5 });
    ok(r.stop === 'exists' && !posts(M).length, 'השרת כבר קיים — לא מזמינים שוב');
    const M2 = mock({ avail: [{ fsn1: true }], price: '29.99' });
    const r2 = await A.watch(E, M2.deps, { minutes: 5 });
    ok(r2.stop === 'price' && !posts(M2).length && r2.why.includes('30.49'), 'המחיר עלה מעל התקרה שאושרה — לא מזמינים');
    const M3 = mock({ avail: [{ fsn1: true }], create: ['resource_limit_exceeded'] });
    let code = '';
    try { await A.watch(E, M3.deps, { minutes: 5 }); } catch (x) { code = x.hcode; }
    ok(code === 'resource_limit_exceeded' && !Object.keys(M3.docs).some((k) => k.startsWith('studioServers/')), 'שגיאה אחרת — עוצרים (לא בלולאה), בלי טוקנים יתומים');
    const M4 = mock({ avail: [{ hel1: true }] });
    const r4 = await A.watch(E, M4.deps, { minutes: 3 });
    ok(r4.timeout && !posts(M4).length, 'מלאי רק ב־hel1 — לא מזמינים (fsn1 ו־nbg1 בלבד)');
    let sec = '';
    try { await A.watch(Object.assign({}, E, { VERCEL_TOKEN: '' }), mock({ avail: [{ fsn1: true }] }).deps, { minutes: 5 }); } catch (x) { sec = x.code; }
    ok(sec === 'vercel_token', 'סוד חסר — נכשל כבר בהתחלה, לפני שיש מלאי');
    const M5 = mock({ avail: [{}] });
    const r5 = await A.watch(E, M5.deps, { minutes: 30 });
    ok(r5.timeout && r5.checks === 30, 'בדיקה כל דקה עד הדדליין');
    const hz = (s) => M5.calls.filter((c) => c.url.includes('api.hetzner.cloud/v1' + s)).length;
    ok(hz('/server_types?name=cx53') === 30 && hz('/pricing') === 1 && hz('/servers?name=') === 1,
      'קריאה אחת ל־Hetzner בדקה: המחירון פעם אחת לריצה, "השרת קיים" רק בהתחלה וכשיש מלאי');

    /* תקלה רגעית — ממשיכים; תקלה קבועה — עוצרים (ה־workflow מכבה ומודיע) */
    const M6 = mock({ typeFail: [503, 429, 0], avail: [{}, {}, { fsn1: true }] });
    const r6 = await A.watch(E, M6.deps, { minutes: 10 });
    ok(r6.bought && r6.bought.location === 'fsn1', '503 ו־429 של Hetzner — ממשיכים לחכות, לא נעצרים');
    let c7 = '';
    try { await A.watch(E, mock({ typeFail: [401] }).deps, { minutes: 5 }); } catch (x) { c7 = x.code; }
    ok(c7 === 'hcloud_401', '401 (טוקן לא תקין) — עצירה סופית');
    const M8 = mock({ listFail: 503, avail: [{ fsn1: true }] });
    const r8 = await A.watch(E, M8.deps, { minutes: 3 });
    ok(r8.timeout && !posts(M8).length, '"השרת קיים" לא ידוע (503) — לא מזמינים בעיוורון, מנסים בדקה הבאה');
    ok(A.transient({ code: 'hcloud_502' }) && A.transient(new TypeError('fetch failed')) && !A.transient({ code: 'hcloud_403' }) && !A.transient({ code: 'vercel_token' }),
      'מה נחשב תקלה רגעית');
  }

  /* ---------- הקבועים ---------- */
  ok(A.AUTOBUY.type === 'cx53' && A.AUTOBUY.locations.join(',') === 'fsn1,nbg1' && A.AUTOBUY.name === 'snb-cx53' && A.AUTOBUY.every === 60e3,
    'CX53 בלבד, fsn1 ואז nbg1, שם קבוע, כל דקה');

  /* ---------- ה־workflow ---------- */
  {
    const w = read('.github/workflows/autobuy.yml');
    ok(/^permissions: \{\}$/m.test(w) && /github\.ref == 'refs\/heads\/main'/.test(w), 'workflow: בלי הרשאות ברירת מחדל, רק מ־main');
    ok(/vars\.SNB_AUTOBUY == 'on' && \(github\.event_name == 'schedule' \|\| inputs\.mode == 'watch'\)/.test(w), 'workflow: מזמין רק כשהמשתמש הדליק (SNB_AUTOBUY=on)');
    ok(/SNB_AUTOBUY_MAX: \$\{\{ vars\.SNB_AUTOBUY_MAX \}\}/.test(w), 'workflow: תקרת המחיר מהמשתמש');
    ok(/if: steps\.buy\.outputs\.server != ''\n\s+env:\n\s+GH_TOKEN: \$\{\{ github\.token \}\}\n\s+run: gh workflow disable autobuy\.yml/.test(w), 'workflow: אחרי הזמנה — מכבה את עצמו');
    for (const u of w.match(/uses:\s*\S+/g) || []) ok(/@[0-9a-f]{40}$/.test(u), 'workflow: action נעול ל־SHA: ' + u);
    const runs = w.split('\n').filter((l) => /^\s+run:|^\s{10}\S/.test(l)).join('\n');
    ok(!/\$\{\{/.test(runs.replace(/^\s+[A-Z0-9_]+: \$\{\{[^}]+\}\}$/gm, '')), 'workflow: בלי ביטויים בתוך פקודות');
    ok(/if: always\(\) && steps\.buy\.outputs\.stopped != ''[\s\S]{0,200}gh workflow disable autobuy\.yml[\s\S]{0,120}gh issue create/.test(w),
      'workflow: עצירה סופית (תקרה, שם קיים, הרשאה, שגיאה) — מכבה ופותח Issue');
    // 15/10/2026: ה־Issue נפתח בשם הבוט — בלי אזכור GitHub לא שולח התראה, וההזמנה של 14/10 עברה בשקט
    ok((w.match(/gh issue create[^\n]*--body "@\$GITHUB_REPOSITORY_OWNER /g) || []).length === 2, 'workflow: שני ה־Issues מזכירים את בעל הריפו (התראה ומייל)');
    // ריצה מתוזמנת שמצאה את השרת שכבר הוזמן: האוטומציה כבר כבויה — בלי ריצה אדומה ובלי Issue כפול
    ok(/gh workflow disable autobuy\.yml --repo "\$GITHUB_REPOSITORY" \|\| true\n\s+\[ "\$WHY" = exists \] && exit 0/.test(w), 'workflow: "השרת כבר קיים" — בלי כישלון ובלי Issue נוסף');
    ok(/catch\(\(err\) => \{\s*\/\/[^\n]*\n\s*out\('stopped'/.test(read('tools/server-autobuy.js')), 'הכלי: שגיאה = stopped ל־GITHUB_OUTPUT');
    ok(!/environment: production/.test(w), 'workflow: בלי שלב אישור (החלטת המשתמש — אוטומטי לגמרי, עם תקרה)');
    // 14/10/2026: ההזמנה האוטומטית בונה את אותו קוד הקמה (planFiles) — כל סוד שההקמה הידנית מעבירה לקוד ההקמה
    // חייב לעבור גם כאן (עד היום חסרו STG_GDRIVE_* — שרת שהוזמן לבד היה עולה בלי הגיבוי ל־Drive בניסוי)
    const sec = (t) => new Set((t.match(/secrets\.([A-Z0-9_]+)/g) || []).map((x) => x.slice(8)));
    const srv = sec(read('.github/workflows/server.yml')), auto = sec(w);
    const miss = [...srv].filter((k) => !auto.has(k));
    ok(!miss.length, 'workflow: כל הסודות של "הקמת שרת" עוברים גם בהזמנה האוטומטית' + (miss.length ? ' (חסרים: ' + miss.join(', ') + ')' : ''));
    const src = read('tools/server-autobuy.js');
    ok(!/console\.(log|error)\([^)]*(token|user_data|ud\b|E\.|HCLOUD)/.test(src) && !/writeFileSync\([^)]*ud/.test(src), 'הכלי לא מדפיס ולא כותב לדיסק את קוד ההקמה או סודות');
  }

  console.log('# ' + (n - bad) + ' בדיקות עברו' + (bad ? ', ' + bad + ' נכשלו' : ''));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
