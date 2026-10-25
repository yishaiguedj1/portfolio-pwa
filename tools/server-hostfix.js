#!/usr/bin/env node
/* התקנת קובצי המארח בשרת בלי המסוף של Hetzner — workflow ‏hostfix.yml. 26/10/2026, בקשת המשתמש ("בוא באמת נבצע את
 * הפינוי מקום באחסון של hetzner").
 *
 * למה: שינוי ב־snb-update / common.sh / compose.yaml מגיע לשרת קיים רק דרך snb-host-apply במסוף של Hetzner. המסוף לא
 * מעביר Shift (20/10/2026: ':'→';', '_'→'-') — וגם סיסמת root מתאפסת לסיסמה עם אותיות גדולות שאי אפשר להקליד בו.
 * כך נתקע מ־24/10 ה־snb-update שמוחק מיד תמונות שלא בשימוש, והדיסק הגיע ל־89% (כל תמונת עובד ~4.3GB).
 *
 * איך — בלי לפתוח שום דבר קבוע בשרת (בלי SSH, בלי עדכון אוטומטי של המארח — החלטת המשתמש 16/10 נשמרת):
 *   1. השהיית שרתי הסטודיו והמתנה לסוף העבודות (אותו קוד של השדרוג — server-upgrade.js).
 *   2. מפתח SSH חד־פעמי (נוצר בהרצה, נמחק בסוף) + כלל זמני בחומת האש snb-closed: פורט 22 רק מהכתובת של ההרצה (/32).
 *   3. מצב Rescue של Hetzner (מערכת נפרדת שעולה מהרשת — ה־sshd הכבוי וה־nftables של השרת לא רלוונטיים לה) ואתחול.
 *   4. ב־Rescue: מוצאים את המחיצה של השרת (יש בה /opt/snb), מתקינים את שלושת הקבצים (אותה רשימה ואותם הרשאות של
 *      snb-host-apply, החלפה אטומית), ומודדים מה תופס את הדיסק (du — רק מספרים).
 *   5. אתחול רגיל. snb-update (OnBootSec=2min) רץ בגרסה החדשה ומוחק מיד כל תמונה שלא בשימוש.
 *   6. תמיד (finally + צעד always ב־workflow): הכלל בחומת האש נמחק, המפתח נמחק, Rescue כבוי, השרת דולק, ההשהיה יורדת.
 *
 * הקבצים — מהקומיט של main שה־workflow רץ ממנו, אחרי אישור בסביבה production (כמו תמונת העובד).
 *
 * פקודות:
 *   check — בלי שום שינוי: השרת, הדיסק לפי הדופק של העובד, מה רץ, האם נשאר משהו מריצה קודמת.
 *   apply — הכל. GITHUB_OUTPUT: done=1 | stopped=<קוד>.
 *   clean — רק הניקוי (כלל, מפתח, Rescue, השהיה) — צעד always.
 * כל ערך סודי — רק בזיכרון. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const P = require('./server-provision.js');
const U = require('./server-upgrade.js');

const HF = {
  DRAIN: 2 * 3600e3,          // המתנה לסוף העבודות
  SSH_MAX: 8 * 60e3,          // Rescue עולה ועונה ב־SSH
  BACK_MAX: 20 * 60e3,        // השרתונים עונים אחרי האתחול הרגיל
  SRV_MAX: 15 * 60e3,         // העובדים מדווחים שוב
  DISK_MAX: 12 * 60e3,        // snb-update החדש רץ ומוחק תמונות — מחכים שהדיסק ירד
  TAG: 'snb-hostfix',         // שם המפתח והתיאור של הכלל — כך ריצה הבאה מוצאת שאריות
};
/* אותה רשימה כמו ב־infra/worker/snb-host-apply: מקור בריפו → יעד בשרת, הרשאות */
const FILES = [
  ['infra/host/snb-common.sh', 'usr/local/lib/snb/common.sh', '644'],
  ['infra/compose.yaml', 'opt/snb/compose.yaml', '644'],
  ['infra/host/snb-update', 'usr/local/sbin/snb-update', '755'],
];
/* מה מודדים בדיסק (du -sk). שמות קבועים — המפתחות בתשובה */
const DU = [
  ['images', 'var/lib/docker/overlay2'],
  ['volumes', 'var/lib/docker/volumes'],
  ['logs', 'var/lib/docker/containers'],
  ['build', 'var/lib/docker/buildkit'],
  ['journal', 'var/log/journal'],
  ['apt', 'var/cache/apt'],
];
const IP4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
function fail(code, msg) { const e = new Error(msg || code); e.code = code; throw e; }

/* ---------------------------------------------------------------- הסקריפט שרץ ב־Rescue */

/* טהורה: הסקריפט (sh) עם הקבצים בתוכו (base64). SNB_TEST_ROOT = תיקייה במקום מחיצה (בדיקות) */
function rescueScript(files) {
  const L = [
    'set -eu',
    'R=/mnt/snbroot',
    'if [ -n "${SNB_TEST_ROOT:-}" ]; then R=$SNB_TEST_ROOT; else',
    '  mkdir -p $R',
    '  for d in $(lsblk -lnpo NAME,FSTYPE | awk \'$2=="ext4"{print $1}\'); do',
    '    mount "$d" $R 2>/dev/null || continue',
    '    if [ -d $R/opt/snb ] && [ -d $R/usr/local/lib/snb ]; then break; fi',
    '    umount $R',
    '  done',
    'fi',
    '[ -d $R/opt/snb ] && [ -d $R/usr/local/lib/snb ] || { echo "SNBERR noroot"; exit 3; }',
    'for v in snb_work snb_work-stg; do [ -e "$R/var/lib/docker/volumes/$v/_data/.busy" ] && echo "SNBBUSY $v"; done',
    'put() {',
    '  base64 -d > "$R/$1.snb-new"',
    '  case "$1" in *.yaml) ;; *) sh -n "$R/$1.snb-new" || { rm -f "$R/$1.snb-new"; echo "SNBERR syntax $1"; exit 4; } ;; esac',
    '  if cmp -s "$R/$1.snb-new" "$R/$1"; then rm -f "$R/$1.snb-new"; echo "SNBSAME /$1"; return 0; fi',
    '  chmod "$2" "$R/$1.snb-new"',
    '  mv -f "$R/$1.snb-new" "$R/$1"',
    '  echo "SNBPUT /$1"',
    '}',
  ];
  for (const f of files) {
    L.push('put ' + f.dst + ' ' + f.mode + " <<'SNBEOF'");
    L.push(...Buffer.from(f.body).toString('base64').match(/.{1,76}/g));
    L.push('SNBEOF');
  }
  for (const [k, p] of DU) L.push('[ -d "$R/' + p + '" ] && echo "SNBDU ' + k + ' $(du -sk "$R/' + p + '" 2>/dev/null | cut -f1)" || true');
  L.push('[ -d "$R/var/lib/docker/volumes" ] && for v in "$R"/var/lib/docker/volumes/*/; do n=$(basename "$v"); case "$n" in *[!A-Za-z0-9_.-]*) continue ;; esac; echo "SNBVOL $n $(du -sk "$v" 2>/dev/null | cut -f1)"; done || true');
  L.push('[ -d "$R/var/lib/docker/image/overlay2/imagedb/content/sha256" ] && echo "SNBIMG $(ls "$R/var/lib/docker/image/overlay2/imagedb/content/sha256" | wc -l)" || true');
  L.push('echo "SNBDF $(df -Pk "$R" | awk \'NR==2{print $2" "$3" "$4}\')"');
  L.push('sync');
  L.push('[ -n "${SNB_TEST_ROOT:-}" ] || umount $R || true');
  L.push('echo SNBOK');
  return L.join('\n') + '\n';
}

/* טהורה: הפלט של הסקריפט → מספרים בלבד (שורה שלא בצורה — מתעלמים) */
function parseOut(text) {
  const o = { put: [], same: [], du: {}, vol: {}, img: null, df: null, busy: [], err: '', ok: false };
  for (const line of String(text || '').split('\n')) {
    let m;
    if (line.includes('..')) continue;
    if ((m = /^SNBPUT (\/[a-z0-9/._-]+)$/.exec(line))) o.put.push(m[1]);
    else if ((m = /^SNBSAME (\/[a-z0-9/._-]+)$/.exec(line))) o.same.push(m[1]);
    else if ((m = /^SNBDU ([a-z]+) (\d+)$/.exec(line))) o.du[m[1]] = +m[2];
    else if ((m = /^SNBVOL ([A-Za-z0-9_.-]{1,64}) (\d+)$/.exec(line))) o.vol[m[1]] = +m[2];
    else if ((m = /^SNBIMG (\d+)$/.exec(line))) o.img = +m[1];
    else if ((m = /^SNBDF (\d+) (\d+) (\d+)$/.exec(line))) o.df = { total: +m[1], used: +m[2], free: +m[3] };
    else if ((m = /^SNBBUSY ([a-z_-]+)$/.exec(line))) o.busy.push(m[1]);
    else if ((m = /^SNBERR ([a-z]+)/.exec(line))) o.err = m[1];
    else if (line === 'SNBOK') o.ok = true;
  }
  return o;
}

const gb = (kb) => (kb == null ? '?' : (kb / 1048576).toFixed(1) + 'GB');
function report(o) {
  const L = [];
  if (o.df) L.push('הדיסק: ' + gb(o.df.used) + ' תפוס מתוך ' + gb(o.df.total) + ' (' + Math.round(100 * o.df.used / o.df.total) + '%), פנוי ' + gb(o.df.free));
  const names = { images: 'תמונות Docker', volumes: 'תיקיות עבודה ומטמון', logs: 'יומני קונטיינרים', build: 'מטמון בנייה', journal: 'יומן המערכת', apt: 'מטמון חבילות' };
  for (const [k] of DU) if (o.du[k] != null) L.push('  ' + names[k] + ': ' + gb(o.du[k]));
  for (const [k, v] of Object.entries(o.vol)) L.push('    ' + k + ': ' + gb(v));
  if (o.img != null) L.push('  מספר התמונות: ' + o.img);
  L.push('הותקנו: ' + (o.put.join(', ') || 'אין (כבר מעודכן)') + (o.same.length ? ' · זהים: ' + o.same.length : ''));
  return L.join('\n');
}

/* ---------------------------------------------------------------- Hetzner */

/* פעולה שמחזירה כמה פעולות (set_rules) — מחכים לכולן */
async function actionsWait(e, deps, j) {
  for (const a of (j.actions || []).concat(j.action ? [j.action] : [])) {
    const until = deps.now() + 5 * 60e3;
    for (;;) {
      const cur = (await U.soft(deps, () => P.hc(deps, e, 'GET', '/actions/' + a.id))).action || {};
      if (cur.status === 'success') break;
      if (cur.status === 'error') fail('action_error', 'פעולה נכשלה ב־Hetzner (' + ((cur.error || {}).code || '?') + ')');
      if (deps.now() >= until) fail('action_timeout', 'פעולה לא הסתיימה בזמן');
      await deps.sleep(5e3);
    }
  }
}

async function firewall(e, deps) {
  const fw = ((await P.hc(deps, e, 'GET', '/firewalls?name=snb-closed')).firewalls || [])[0];
  if (!fw) fail('no_fw', 'חומת האש snb-closed לא נמצאה');
  return fw;
}
/* הכללים בלי מה שאנחנו הוספנו (לפי התיאור) */
const ours = (r) => r && r.description === HF.TAG;
async function setRules(e, deps, fw, rules) {
  await actionsWait(e, deps, await P.hc(deps, e, 'POST', '/firewalls/' + fw.id + '/actions/set_rules', { rules }));
}

/* ניקוי — בטוח לקרוא תמיד ובכל מצב: הכלל, המפתחות, Rescue, השרת דולק, ההשהיה */
async function clean(e, deps, o = {}) {
  const done = [];
  const step = async (name, fn) => { try { if (await fn()) done.push(name); } catch (x) { done.push(name + ':✗' + (x.code || '')); } };
  await step('fw', async () => {
    const fw = await firewall(e, deps);
    const rules = fw.rules || [];
    if (!rules.some(ours)) return false;
    await setRules(e, deps, fw, rules.filter((r) => !ours(r)));
    return true;
  });
  await step('key', async () => {
    const keys = (await P.hc(deps, e, 'GET', '/ssh_keys?per_page=50')).ssh_keys || [];
    let n = 0;
    for (const k of keys) if (String(k.name || '').startsWith(HF.TAG)) { await P.hc(deps, e, 'DELETE', '/ssh_keys/' + k.id); n++; }
    return n > 0;
  });
  const srv = await U.theServer(e, deps).catch(() => null);
  if (srv) {
    await step('rescue', async () => {
      const full = (await P.hc(deps, e, 'GET', '/servers/' + srv.id)).server || {};
      if (!full.rescue_enabled) return false;
      await U.action(e, deps, '/servers/' + srv.id + '/actions/disable_rescue', null, 5 * 60e3);
      return true;
    });
    await step('on', async () => { if ((await U.serverNow(e, deps, srv.id)).status === 'running') return false; await U.powerUp(e, deps, srv.id); return true; });
  }
  if (!o.keep) await step('release', async () => (await U.release(e, deps)) > 0);
  return done;
}

/* ---------------------------------------------------------------- ההרצה */

function loadFiles(root) {
  return FILES.map(([src, dst, mode]) => {
    const body = fs.readFileSync(path.join(root, src));
    if (!body.length) fail('empty', 'קובץ ריק: ' + src);
    return { src, dst, mode, body };
  });
}

/* דיסק לפי הדופק של העובדים (אחוז) — הגבוה מבין השרתים המחוברים */
async function diskNow(e, deps) {
  let d = null;
  for (const env of U.ENVS()) for (const s of await U.servers(e, deps, env)) {
    const hb = s.hb && typeof s.hb === 'object' ? s.hb : {};
    if (deps.now() - (s.seen || 0) < 5 * 60e3 && typeof hb.disk === 'number') d = Math.max(d == null ? 0 : d, hb.disk);
  }
  return d;
}

async function apply(e, deps, opts = {}) {
  const files = loadFiles(opts.root || path.join(__dirname, '..'));
  const script = rescueScript(files);
  deps.shCheck(script);                                     // תחביר — לפני שנוגעים בשרת
  const left = await clean(e, deps);                        // שאריות מריצה שנקטעה
  const srv = await U.theServer(e, deps);
  const full = (await P.hc(deps, e, 'GET', '/servers/' + srv.id)).server || {};
  const ip = full.public_net && full.public_net.ipv4 && full.public_net.ipv4.ip;
  if (!IP4_RE.test(String(ip || ''))) fail('no_ip', 'לשרת אין כתובת IPv4');
  const me = String(await deps.myIp()).trim();
  if (!IP4_RE.test(me)) fail('no_runner_ip', 'לא ידועה הכתובת של ההרצה');
  const disk0 = await diskNow(e, deps).catch(() => null);
  const snap = await U.snapshot(e, deps);
  let out = null, rescueOn = false, booted = false;
  try {
    await U.cordon(e, deps, snap.srv);
    let s = snap;
    const drainBy = deps.now() + HF.DRAIN;
    while (s.busy.length) {
      if (deps.now() >= drainBy) fail('busy', 'עבודות לא הסתיימו בשעתיים (' + s.busy.length + ') — לא נוגעים בשרת');
      await deps.sleep(30e3);
      s = await U.snapshot(e, deps);
    }
    // מפתח חד־פעמי, כלל זמני, Rescue
    const key = deps.keygen();
    const k = (await P.hc(deps, e, 'POST', '/ssh_keys', { name: HF.TAG + '-' + deps.now(), public_key: key.pub })).ssh_key;
    if (!k || !k.id) fail('key', 'Hetzner לא שמר את המפתח');
    const fw = await firewall(e, deps);
    await setRules(e, deps, fw, (fw.rules || []).filter((r) => !ours(r)).concat([{ direction: 'in', protocol: 'tcp', port: '22', source_ips: [me + '/32'], description: HF.TAG }]));
    rescueOn = true;                                        // לפני הבקשה: גם תשובה שאבדה = לכבות בסוף
    await U.action(e, deps, '/servers/' + srv.id + '/actions/enable_rescue', { type: 'linux64', ssh_keys: [k.id] }, 5 * 60e3);
    booted = true;
    await U.powerDown(e, deps, srv);
    await U.powerUp(e, deps, srv.id);
    // SSH ל־Rescue
    const until = deps.now() + HF.SSH_MAX;
    let r = null;
    while (deps.now() < until) {
      r = deps.ssh(ip, key.path, 'true');
      if (r.code === 0) break;
      await deps.sleep(15e3);
    }
    if (!r || r.code !== 0) fail('no_ssh', 'Rescue לא ענה ב־SSH');
    r = deps.ssh(ip, key.path, script);
    out = parseOut(r.out);
    if (!out.ok) fail(out.err ? 'rescue_' + out.err : 'rescue_fail', 'הסקריפט ב־Rescue נכשל (' + (out.err || r.code) + ')');
  } finally {
    // יציאה מ־Rescue: כיבוי Rescue → אתחול רגיל. תמיד — גם בכישלון (השרת לא נשאר ב־Rescue ולא כבוי)
    if (rescueOn) await U.action(e, deps, '/servers/' + srv.id + '/actions/disable_rescue', null, 5 * 60e3).catch(() => {});
    if (booted) await U.powerDown(e, deps, srv).catch(() => {});
    await U.powerUp(e, deps, srv.id).catch(() => {});
    // הכלל והמפתח. ההשהיה — רק בכישלון; בהצלחה היא יורדת בסוף, אחרי ש־snb-update בנה את הקונטיינרים מחדש
    // (compose.yaml חדש) — כך עבודה לא מתחילה בקונטיינר שעוד יוחלף
    await clean(e, deps, { keep: !!out }).catch(() => {});
  }
  // אחרי האתחול: השרתונים, העובדים, והדיסק יורד (snb-update החדש)
  const bad = await U.healthWait(deps, HF.BACK_MAX);
  if (bad) fail('no_health', 'השרתון לא עונה אחרי האתחול (' + bad + ')');
  const t0 = deps.now();
  let disk1 = null;
  while (deps.now() - t0 < HF.DISK_MAX) {
    disk1 = await diskNow(e, deps).catch(() => null);
    if (disk1 != null && (disk0 == null || disk1 < disk0 - 5)) break;
    await deps.sleep(30e3);
  }
  await U.soft(deps, () => U.release(e, deps)).catch(() => {});   // נכשל — צעד always ב־workflow (clean)
  return { out, disk0, disk1, left };
}

async function check(e, deps) {
  const srv = await U.theServer(e, deps);
  const full = (await P.hc(deps, e, 'GET', '/servers/' + srv.id)).server || {};
  const fw = await firewall(e, deps);
  const keys = ((await P.hc(deps, e, 'GET', '/ssh_keys?per_page=50')).ssh_keys || []).filter((k) => String(k.name || '').startsWith(HF.TAG));
  const s = await U.snapshot(e, deps);
  const d = await diskNow(e, deps).catch(() => null);
  return [
    'שרת: ' + srv.name + ' · ' + srv.type + ' · ' + srv.status + (full.rescue_enabled ? ' · ⚠ Rescue דולק' : ''),
    'הדיסק (לפי העובד): ' + (d == null ? '?' : d + '%'),
    'שרתי סטודיו מחוברים: ' + s.srv.length + ' · עבודות רצות: ' + s.busy.length,
    'שאריות: ' + ((fw.rules || []).some(ours) ? 'כלל בחומת האש · ' : '') + (keys.length ? keys.length + ' מפתחות · ' : '') + 'בלי',
  ].join('\n');
}

/* ---------------------------------------------------------------- הרצה אמיתית */

function realDeps() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hostfix-'));
  const kh = path.join(dir, 'known_hosts');
  return {
    fetch: (...x) => fetch(...x), now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    myIp: async () => (await (await fetch('https://api.ipify.org')).text()),
    keygen() {
      const p = path.join(dir, 'k');
      cp.execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', HF.TAG, '-f', p]);
      return { path: p, pub: fs.readFileSync(p + '.pub', 'utf8').trim() };
    },
    ssh(ip, keyPath, script) {
      const r = cp.spawnSync('ssh', ['-i', keyPath, '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'ConnectTimeout=10',
        '-o', 'StrictHostKeyChecking=accept-new', '-o', 'UserKnownHostsFile=' + kh, 'root@' + ip, 'sh -s'],
      { input: script, encoding: 'utf8', timeout: 15 * 60e3, maxBuffer: 4 << 20 });
      return { code: r.status == null ? -1 : r.status, out: r.stdout || '' };
    },
    shCheck(script) { cp.execFileSync('sh', ['-n'], { input: script }); },
  };
}

if (require.main === module) {
  const cmd = process.argv[2];
  const out = (k, v) => { if (process.env.GITHUB_OUTPUT && /^[a-z]+$/.test(k) && /^[A-Za-z0-9._-]{1,60}$/.test(String(v))) fs.appendFileSync(process.env.GITHUB_OUTPUT, k + '=' + v + '\n'); };
  const deps = realDeps();
  (async () => {
    if (cmd === 'check') { console.log(await check(process.env, deps)); return; }
    if (cmd === 'clean') { console.log('ניקוי: ' + ((await clean(process.env, deps)).join(', ') || 'לא נשאר כלום')); return; }
    if (cmd === 'apply') {
      const r = await apply(process.env, deps);
      out('done', '1');
      console.log('✓ קובצי המארח הותקנו והשרת חזר לעבוד');
      console.log(report(r.out));
      console.log('הדיסק לפי העובד: ' + (r.disk0 == null ? '?' : r.disk0 + '%') + ' → ' + (r.disk1 == null ? '?' : r.disk1 + '%'));
      return;
    }
    fail('cmd', 'פקודה לא מוכרת');
  })().catch((err) => {
    out('stopped', String(err.code || 'error').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60));
    console.error('✗ ' + (err.message || err.code));
    process.exit(1);
  });
}

module.exports = { HF, FILES, DU, rescueScript, parseOut, report, clean, apply, check, loadFiles };
