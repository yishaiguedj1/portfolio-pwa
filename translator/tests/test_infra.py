"""השרת כקוד (infra/) — בדיקות סטטיות לתכונות האבטחה, כדי ששינוי עתידי לא יחליש אותן בשקט.

לא מריצות Docker או שרת: קוראות את הקבצים ובודקות את מה שחייב להישאר נכון.
הרצה: python3 -m unittest tests.test_infra   (מתוך translator/)
"""
import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INFRA = ROOT / 'infra'


def read(p):
    return (ROOT / p).read_text(encoding='utf-8')


class CloudInit(unittest.TestCase):
    def test_generated_file_in_sync(self):
        r = subprocess.run([sys.executable, str(INFRA / 'build-cloud-init.py'), '--check'], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_no_secrets_and_no_ssh(self):
        ci = read('infra/cloud-init.yaml')
        self.assertNotRegex(ci, r'sk-ant-[A-Za-z0-9]', 'אין מפתחות ב־user-data (נשאר זמין בשירות המטא־דאטה לכל חיי השרת)')
        self.assertNotRegex(ci, r'(?m)^\s*(ANTHROPIC_API_KEY|SNB_WORKER_TOKEN)=\S')
        self.assertIn('ssh_pwauth: false', ci)
        self.assertIn('systemctl disable --now ssh.socket ssh.service', ci)
        self.assertLess(len(ci.encode()), 32 * 1024, 'Hetzner מגביל user-data ל־32KB')


class Firewall(unittest.TestCase):
    def test_inbound_closed_and_metadata_blocked(self):
        nf = '\n'.join(ln for ln in read('infra/host/nftables.conf').splitlines() if not ln.lstrip().startswith('#'))
        self.assertRegex(nf, r'hook input priority 0; policy drop;')
        self.assertIn('ip daddr 169.254.0.0/16 drop', nf, 'הקונטיינרים לא מגיעים לשירות המטא־דאטה')
        self.assertNotIn('flush ruleset', nf, 'טעינה מחדש לא מוחקת את הכללים של Docker')
        accepts = [ln.strip() for ln in nf.splitlines() if 'dport' in ln and 'accept' in ln]
        self.assertEqual(accepts, ['udp sport 67 udp dport 68 accept', 'iifname "tailscale0" tcp dport 22 accept'],
                         'אין פורט פתוח לאינטרנט (רק תשובות DHCP, ו־SSH רק ברשת הפרטית)')


class Compose(unittest.TestCase):
    def test_worker_hardening(self):
        c = read('infra/compose.yaml')
        self.assertNotRegex(c, r'(?m)^\s*ports\s*:', 'בלי פורטים')
        self.assertNotRegex(c, r'(?m)^\s*(privileged|cap_add|pid|ipc)\s*:', 'בלי הרשאות מיוחדות')
        modes = re.findall(r'(?m)^\s*network_mode:\s*(\S+)', c)
        self.assertEqual(modes, ['bridge', 'bridge'], 'רק העובדים, ורק ב־bridge של Docker (לא host)')
        for need in ('read_only: true', 'cap_drop: [ALL]', 'no-new-privileges:true', 'user: "10001:10001"',
                     '/etc/snb/worker.env', 'healthcheck:', 'mem_limit:', 'pids_limit:'):
            self.assertIn(need, c)
        self.assertNotIn('docker.sock', c, 'אסור לחשוף את Docker לקונטיינר (= root על השרת)')
        # גבולות לפי גודל השרת בפועל — קבוע גדול מהשרת (cpus 7.5 בשרת של 4 ליבות) = הקונטיינר לא עולה
        self.assertIn('cpus: ${SNB_CPUS:-', c)
        self.assertIn('mem_limit: ${SNB_MEM:-', c)
        # 16/10/2026: בעומס — חלוקה לפי משקל (שני העובדים שווים, השרתונים קודמים); בלי עומס — עבודה מקבלת הכל
        self.assertEqual(c.count('cpu_shares: 1024'), 1, 'הייצור')
        self.assertEqual(c.count('cpu_shares: 512'), 1, 'הניסוי — אחרי הייצור בעומס')
        self.assertEqual(c.count('mem_reservation:'), 2, 'שריון זיכרון לכל עובד')
        self.assertIn('oom_score_adj: 300', c)
        self.assertEqual(c.count('nice: 20'), 2, 'ladder_boost: העובדים יכולים לצאת מ־SCHED_IDLE (עד nice 0)')
        self.assertGreaterEqual(c.count('cpu_shares: 2048'), 3, 'השרתונים וה־Tunnel קודמים לעבודת רקע')
        common = read('infra/host/snb-common.sh')
        self.assertLess(common.index('snb_compose() {'), common.index('\tsnb_limits\n'), 'כל הפעלה מחשבת את הגבולות')


class Image(unittest.TestCase):
    def test_dockerfile(self):
        d = read('infra/worker/Dockerfile')
        self.assertRegex(d, r'ARG PY_IMAGE=python:[\w.-]+@sha256:[0-9a-f]{64}', 'בסיס נעול ב־digest')
        self.assertIn('--require-hashes', d)
        self.assertIn('sha256sum -c', d, 'ffmpeg נבדק לפני שנפתח')
        self.assertRegex(d, r'(?m)^USER 10001:10001$')
        self.assertIn('SNB_SETUP=/bin/false', d, 'אין התקנות בזמן ריצה בתוך הקופסה')
        self.assertNotRegex(d, r'(?m)^(ENV|ARG)\s.*(ANTHROPIC|WORKER_TOKEN)', 'בלי סודות בתמונה')
        # אבטחת הצריבה: CVE-2026-61626/7 — כתיבה מחוץ לגבולות ב־libass על ASS זדוני, בדיוק הווקטור
        # שלנו. ffmpeg ≥ 8 (ענף n8.1 של BtbN מגיע עם libass מתוקן); הורדת גרסה = להיכשל כאן בכוונה.
        m = re.search(r'ffmpeg-n(\d+)\.(\d+)', d)
        self.assertIsNotNone(m, 'גרסת ffmpeg מוצהרת ב־Dockerfile')
        self.assertGreaterEqual((int(m.group(1)), int(m.group(2))), (8, 1), 'ffmpeg לפחות 8.1 (libass מתוקן)')
        self.assertIn("--enable-libass", d, 'libass חובה בבנייה')
        self.assertIn('MALLOC_ARENA_MAX=2', d, 'בלי arenas של glibc לכל ליבה — היישור צמוד לתקרת הזיכרון')

    def test_lockfile_all_hashed_cpu_only(self):
        lock = read('infra/worker/requirements.lock')
        reqs = re.findall(r'(?m)^([A-Za-z0-9_.\-\[\], ]+)==(\S+)', lock)
        self.assertGreater(len(reqs), 20)
        blocks = re.split(r'(?m)^(?=[A-Za-z])', lock)
        for b in blocks:
            if re.match(r'[A-Za-z]', b):
                self.assertIn('--hash=sha256:', b, 'לכל חבילה hash: ' + b.split()[0])
        names = {n.split('[')[0].lower() for n, _ in reqs}
        self.assertFalse({n for n in names if n.startswith('nvidia') or n == 'triton'}, 'בלי CUDA')
        self.assertIn(('torch', '2.11.0+cpu'), [(n.lower(), v) for n, v in reqs])
        self.assertIn('anthropic', names)

    def test_two_architectures_same_versions(self):
        # שרתי Arm (CAX) כשאין CX במלאי: אותה תמונה לשתי הארכיטקטורות, ואותן גרסאות בדיוק
        pins = lambda f: re.findall(r'(?m)^([A-Za-z0-9_.\-\[\], ]+==\S+)', read(f))
        self.assertEqual(pins('infra/worker/requirements.lock'), pins('infra/worker/requirements-arm64.lock'))
        arm = read('infra/worker/requirements-arm64.lock')
        self.assertIn('--python-platform aarch64-manylinux_2_28', arm)
        for b in re.split(r'(?m)^(?=[A-Za-z])', arm):
            if re.match(r'[A-Za-z]', b):
                self.assertIn('--hash=sha256:', b, 'לכל חבילה hash: ' + b.split()[0])
        d = read('infra/worker/Dockerfile')
        self.assertIn('requirements-arm64.lock', d)
        self.assertIn('arm64) f=linuxarm64; s="$FFMPEG_SHA256_ARM64"', d, 'ffmpeg של Arm, מאומת')
        w = read('.github/workflows/worker-image.yml')
        self.assertIn('ubuntu-24.04-arm', w, 'בנייה על מכונת Arm אמיתית, בלי אמולציה')
        self.assertIn('[ "$archs" = "amd64 arm64" ]', w, 'לא נחתמת תמונה שחסרה בה ארכיטקטורה')

    def test_dockerignore_keeps_context_small(self):
        di = read('.dockerignore').splitlines()
        self.assertEqual(di[1], '*', 'ברירת המחדל: שום דבר לא נכנס')
        self.assertIn('!translator/', di)
        for f in ('requirements.lock', 'requirements-arm64.lock'):
            self.assertIn('!infra/worker/' + f, di, 'קובץ שה־Dockerfile מעתיק חייב להיכנס להקשר: ' + f)


class Pipeline(unittest.TestCase):
    def test_workflow_pinned_minimal_and_gated(self):
        w = read('.github/workflows/worker-image.yml')
        for u in re.findall(r'uses:\s*(\S+)', w):
            self.assertRegex(u, r'@[0-9a-f]{40}$', 'action נעול ל־SHA: ' + u)
        self.assertRegex(w, r'(?m)^permissions: \{\}$')
        self.assertRegex(w, r'environment: production', 'פרודקשן רק באישור')
        self.assertIn('cosign sign --yes', w)
        self.assertIn('--new-bundle-format=false', w, 'חתימה גם בפורמט שה־cosign של Debian בשרת מכיר')
        self.assertIn('imagetools create -t "$IMAGE:prod" "$ref"', w, 'קידום = אותו digest, בלי בנייה מחדש')
        self.assertIn('unittest discover', w, 'בלי בדיקות ירוקות אין תמונה')
        self.assertNotRegex(w, r'(?m)^concurrency:', 'בלי קבוצה ל־workflow כולו — קידום שמחכה לאישור עצר כל בנייה אחריו')
        self.assertIn('group: worker-image-promote', w)

    def test_signer_identity_same_in_ci_and_server(self):
        w = read('.github/workflows/worker-image.yml')
        common = read('infra/host/snb-common.sh')
        ident = re.search(r"SNB_SIGNER='([^']+)'", common).group(1)
        self.assertIn("'" + ident + "'", w)
        self.assertTrue(ident.startswith('^') and ident.endswith('$'), 'התאמה מלאה, לא חלקית')

    def test_update_verifies_before_switching(self):
        u = read('infra/host/snb-update')
        self.assertLess(u.index('cosign verify'), u.index('.env.tmp'), 'קודם חתימה, אחר כך החלפת גרסה')
        self.assertIn('snb_busy', u, 'לא מעדכנים באמצע עבודה')
        self.assertIn('resolve "$SNB_IMG" prod "$SNB_SIGNER" SNB_IMAGE prod', u, 'הייצור רק מ־prod (אחרי אישור)')
        self.assertNotRegex(u, r'SNB_IMG"? dev [^\n]* SNB_IMAGE prod', 'dev אף פעם לא לעובד של הייצור')

    def test_packages_explicit(self):
        # Debian 13: הפקודה docker בחבילה נפרדת, ו־Hetzner לא מתקינה "מומלצות" — חייבת להופיע במפורש
        ci = read('infra/cloud-init.yaml')
        pk = ci[ci.index('packages:'):ci.index('write_files:')]
        for need in ('docker.io', 'docker-cli', 'docker-compose', 'cosign', 'nftables'):
            self.assertIn('  - ' + need + '\n', pk)
        u = read('infra/host/snb-update')
        self.assertLess(u.index('command -v'), u.index('docker pull'), 'כלי חסר נרשם ביומן לפני שמשתמשים בו')

    def test_gvisor(self):
        # ת2 (10/10/2026): gVisor — מאגר חתום במפתח שבריפו, runtime ב־Docker, בדיקה עצמית לכל גרסה, ונפילה גלויה ל־runc
        ci = read('infra/cloud-init.yaml')
        pk = ci[ci.index('packages:'):ci.index('write_files:')]
        self.assertIn('  - runsc\n', pk)
        self.assertIn('signed-by=$KEY_FILE] https://storage.googleapis.com/gvisor/releases release main', ci)
        key = read('infra/host/gvisor.key')
        self.assertTrue(key.startswith('-----BEGIN PGP PUBLIC KEY BLOCK-----'))
        self.assertIn(key.strip().split('\n')[2], ci, 'המפתח עצמו בקוד ההקמה — לא הורדה בזמן ההקמה')
        self.assertIn("GVISOR_FPR = '6F1DF85E3A71C24918E727D56FC6D554E32BD943'", read('infra/build-cloud-init.py'))
        d = json.loads(read('infra/host/daemon.json'))
        self.assertEqual(d['runtimes']['runsc'], {'path': '/usr/bin/runsc', 'runtimeArgs': ['--platform=systrap']})
        c = read('infra/compose.yaml')
        self.assertIn('runtime: ${SNB_RUNTIME:-runc}', c)
        self.assertIn('SNB_ISO_WHY=${SNB_ISO_WHY:-}', c)
        common = read('infra/host/snb-common.sh')
        self.assertLess(common.index('snb_compose() {'), common.index('\tsnb_runtime\n'), 'כל הפעלה בוחרת runtime')
        for need in ('7000000', '/etc/snb/runtime', 'SNB_ISO_WHY=mem', 'SNB_ISO_WHY=missing', 'SNB_ISO_WHY=selftest', 'SNB_ISO_WHY=manual'):
            self.assertIn(need, common)
        u = read('infra/host/snb-update')
        self.assertLess(u.index('--runtime=runsc --network bridge'), u.index('snb_compose up -d'), 'בדיקה עצמית לפני ההפעלה')
        self.assertIn("socket.getaddrinfo('ghcr.io', 443)", u, 'הבדיקה העצמית בודקת גם DNS מתוך gVisor')
        self.assertIn("endswith('gvisor')", u)
        self.assertLess(u.index('cosign verify'), u.index('--runtime=runsc'), 'רק תמונה מאומתת רצה בבדיקה')

    def test_setup_code_marker(self):
        ci = read('infra/cloud-init.yaml')
        self.assertEqual(ci.count('\n  # SNB_SECRETS\n'), 1, 'שורת סימון אחת לקוד ההקמה מהאפליקציה')
        self.assertLess(ci.index('# SNB_SECRETS'), ci.index('\nruncmd:'), 'בתוך write_files')
        self.assertIn('systemctl start --no-block snb-update.service', ci, 'יש מפתחות — מתחילים מיד')
        self.assertIn("CI_MARK = '  # SNB_SECRETS'", read('studio.js'), 'אותו סימון באפליקציה')

    def test_setup_prompts_visible_and_values_clean(self):
        # לקח 09/10/2026: השאלות הודפסו ל־stdout בתוך $(...) — נבלעו במשתנה, המסך ריק והמפתח נפסל
        import subprocess, tempfile
        src = read('infra/host/snb-setup')
        with tempfile.TemporaryDirectory() as d:
            s = src.replace('[ "$(id -u)" = 0 ]', 'true').replace('/etc/snb', d)
            s = re.sub(r'(?m)^systemctl.*$', 'echo DONE', s)
            key, tok = 'sk-ant-' + 'a' * 30, 'abcdefghijkl-' + 'B' * 43
            r = subprocess.run(['sh', '-c', s], input=key + '\n' + tok + '\n\n', capture_output=True, text=True, timeout=20)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn('Anthropic API key', r.stderr, 'השאלה מוצגת על המסך')
            env = open(d + '/worker.env').read()
            self.assertIn('ANTHROPIC_API_KEY=' + key + '\n', env)
            self.assertIn('SNB_WORKER_TOKEN=' + tok + '\n', env)

    def test_setup_secrets_file_private(self):
        s = read('infra/host/snb-setup')
        self.assertIn('umask 077', s)
        self.assertIn('chmod 600', s)
        self.assertIn('stty -echo', s, 'המפתח לא מוצג על המסך')


FAKE_DOCKER = r"""#!/bin/sh
echo "$*" >> "$LOG"
case "$1" in
  pull) img=${3%%:*}; tag=${3##*:}; case " $FAIL_PULL " in *" $3 "*) exit 1 ;; esac; echo "$3" >> "$T/pulled"; exit 0 ;;
  image) [ "$2" = inspect ] && { ref=$(echo "$@" | awk '{print $NF}'); img=${ref%%:*}; tag=${ref##*:}
           h=$(printf '%s' "$tag$(cat "$T/rev-$tag" 2>/dev/null)" | sha256sum | cut -c1-64); echo "$img@sha256:$h"; exit 0; }; exit 0 ;;
  volume) v=$(echo "$@" | awk '{print $NF}'); [ -d "$T/vol/$v" ] && { echo "$T/vol/$v"; exit 0; }; exit 1 ;;
  compose) [ "$2" = version ] && exit 0
           echo "UP profiles=$COMPOSE_PROFILES cpus=$SNB_CPUS mem=$SNB_MEM cpus_stg=$SNB_CPUS_STG mem_stg=$SNB_MEM_STG memr=$SNB_MEMR memr_stg=$SNB_MEMR_STG" >> "$T/compose"; exit 0 ;;
  info) echo '{"runsc":{}}'; exit 0 ;;
  run) exit 0 ;;
esac
exit 0
"""
FAKE_COSIGN = r"""#!/bin/sh
echo "cosign $*" >> "$LOG"
for a in "$@"; do case "$a" in *app-image*) [ -n "$BAD_APP_SIG" ] && exit 1 ;; esac; done
exit 0
"""


class Rooms(unittest.TestCase):
    """שלב 2ב: חדרים לפי קובצי הסודות — snb-update מריץ באמת, עם docker/cosign מדומים."""

    def run_update(self, files, busy=(), fail_pull='', bad_app='', rev=None, now=False, mem_kb=None):
        import os, tempfile, stat
        d = tempfile.mkdtemp()
        etc, opt, lib, binp = (os.path.join(d, x) for x in ('etc', 'opt', 'lib', 'bin'))
        for x in (etc, opt, lib, binp, os.path.join(d, 'var')):
            os.makedirs(x)
        for f in files:
            open(os.path.join(etc, f), 'w').write('X=1\n')
        for v in busy:
            os.makedirs(os.path.join(d, 'vol', v)); open(os.path.join(d, 'vol', v, '.busy'), 'w').write('j')
        for tag, r in (rev or {}).items():
            open(os.path.join(d, 'rev-' + tag), 'w').write(r)
        def sub(t):
            t = t.replace('/etc/snb', etc).replace('/opt/snb', opt).replace('/var/lib/snb', d + '/var')
            t = t.replace('. /usr/local/lib/snb/common.sh', '. ' + lib + '/common.sh')
            if mem_kb:
                t = t.replace("/proc/meminfo", d + '/meminfo')
            return t
        open(lib + '/common.sh', 'w').write(sub(read('infra/host/snb-common.sh')))
        open(d + '/upd', 'w').write(sub(read('infra/host/snb-update')))
        if mem_kb:
            open(d + '/meminfo', 'w').write('MemTotal: %d kB\n' % mem_kb)
        for name, body in (('docker', FAKE_DOCKER), ('cosign', FAKE_COSIGN), ('logger', '#!/bin/sh\nexit 0\n'), ('runsc', '#!/bin/sh\n')):
            p = os.path.join(binp, name); open(p, 'w').write(body); os.chmod(p, 0o755)
        env = dict(os.environ, PATH=binp + ':' + os.environ['PATH'], LOG=d + '/log', T=d, FAIL_PULL=fail_pull, BAD_APP_SIG=bad_app)
        r = subprocess.run(['sh', d + '/upd'] + (['--now'] if now else []), capture_output=True, text=True, env=env, timeout=30)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        rd = lambda f: open(os.path.join(d, f)).read() if os.path.exists(os.path.join(d, f)) else ''
        return {'env': rd('opt/.env'), 'compose': rd('compose'), 'pulled': rd('pulled'), 'out': r.stdout, 'dir': d}

    def test_prod_only_unchanged(self):
        r = self.run_update(['worker.env'])
        self.assertEqual(r['pulled'].split(), ['ghcr.io/yishaiguedj1/snb-worker:prod'])
        self.assertRegex(r['env'], r'^SNB_IMAGE=ghcr.io/yishaiguedj1/snb-worker@sha256:[0-9a-f]{64}\n$')
        self.assertIn('UP profiles=prod ', r['compose'])

    def test_staging_rooms_use_dev(self):
        r = self.run_update(['tunnel.env', 'app-stg.env', 'worker-stg.env'])
        self.assertEqual(sorted(r['pulled'].split()), ['ghcr.io/yishaiguedj1/snb-app:dev', 'ghcr.io/yishaiguedj1/snb-worker:dev'])
        self.assertIn('SNB_APP_STG=ghcr.io/yishaiguedj1/snb-app@sha256:', r['env'])
        self.assertIn('SNB_IMAGE_STG=ghcr.io/yishaiguedj1/snb-worker@sha256:', r['env'])
        self.assertNotIn('SNB_IMAGE=', r['env'])
        self.assertIn('UP profiles=tunnel,stg,stg-worker ', r['compose'])

    def test_app_signer_is_app_workflow(self):
        r = self.run_update(['app-stg.env'])
        log = open(r['dir'] + '/log').read()
        self.assertIn('workflows/app-image\\.yml@refs/heads/main$', log)
        w = read('.github/workflows/app-image.yml')
        ident = re.search(r"SNB_APP_SIGNER='([^']+)'", read('infra/host/snb-common.sh')).group(1)
        self.assertIn('app-image\\.yml', ident)
        self.assertRegex(w, r'(?m)^name: app-image$')
        self.assertLess(w.index('cosign sign --yes'), w.index('-t "$IMAGE:dev"'), 'dev רק אחרי חתימה')

    def test_bad_signature_keeps_room_off_others_up(self):
        r = self.run_update(['tunnel.env', 'app-stg.env', 'worker.env'], bad_app='1')
        self.assertNotIn('SNB_APP_STG=', r['env'], 'תמונה לא חתומה לא נכנסת')
        self.assertIn('SNB_IMAGE=', r['env'])
        self.assertIn('UP profiles=prod,tunnel ', r['compose'], 'חדר בלי תמונה מאומתת כבוי — השאר עולים')

    def test_pull_failure_not_fatal(self):
        r = self.run_update(['worker.env', 'app-stg.env'], fail_pull='ghcr.io/yishaiguedj1/snb-app:dev')
        self.assertIn('SNB_IMAGE=', r['env'])
        self.assertIn('UP profiles=prod ', r['compose'])

    def test_busy_worker_keeps_version_per_room(self):
        import os
        r1 = self.run_update(['worker.env', 'worker-stg.env'])
        d = r1['dir']
        # גרסה חדשה לשני התגים; עובד הניסוי באמצע עבודה — רק הוא נשאר בישנה
        old_stg = re.search(r'SNB_IMAGE_STG=(\S+)', r1['env']).group(1)
        os.makedirs(d + '/vol/snb_work-stg'); open(d + '/vol/snb_work-stg/.busy', 'w').write('j')
        open(d + '/rev-dev', 'w').write('2'); open(d + '/rev-prod', 'w').write('2')
        upd = open(d + '/upd').read()
        env = dict(os.environ, PATH=d + '/bin:' + os.environ['PATH'], LOG=d + '/log', T=d, FAIL_PULL='', BAD_APP_SIG='')
        subprocess.run(['sh', d + '/upd'], check=True, capture_output=True, env=env, timeout=30)
        e2 = open(d + '/opt/.env').read()
        self.assertIn('SNB_IMAGE_STG=' + old_stg + '\n', e2)
        self.assertNotIn(re.search(r'SNB_IMAGE=(\S+)', r1['env']).group(1), e2, 'הייצור לא תלוי בעבודה של הניסוי')

    def test_limits_split_when_both_workers(self):
        import os
        r = self.run_update(['worker.env', 'tunnel.env', 'app-stg.env', 'worker-stg.env'], mem_kb=16 * 1024 * 1024)
        m = re.search(r'cpus=([\d.]+) mem=(\d+)m cpus_stg=([\d.]+) mem_stg=(\d+)m memr=(\d+)m memr_stg=(\d+)m', r['compose'])
        avail = 16 * 1024 - 1024 - 800
        mem, mem_s, res, res_s = (int(m.group(i)) for i in (2, 4, 5, 6))
        n = os.cpu_count() or 2
        full = '%.1f' % (n - 0.5 if n > 1 else n)
        self.assertEqual((m.group(1), m.group(3)), (full, full), 'המעבד — תקרה, לא שריון: כל עובד יכול לקבל את כל הליבות')
        self.assertGreaterEqual(min(res, res_s), 4608, 'שריון ≥ שיא של עבודה (היישור ב־ONNX תחת gVisor — 4.2GB)')
        self.assertEqual(mem + res_s, avail, 'תקרה של הייצור + שריון של הניסוי = כל הזיכרון (בלי OOM כששניהם בשיא)')
        self.assertEqual(mem_s + res, avail, 'וגם הפוך')
        self.assertGreater(mem, res, 'בלי עומס — יותר מהשריון (מטמון קבצים ומודלים)')
        r = self.run_update(['tunnel.env', 'app-stg.env', 'worker-stg.env'], mem_kb=8 * 1024 * 1024)
        m = re.search(r'mem_stg=(\d+)m', r['compose'])
        self.assertEqual(int(m.group(1)), 8 * 1024 - 1024 - 800, 'עובד ניסוי לבד מקבל את כל השרת')
        # שרת גדול (CX53, 32GB): השריון עד 8GB, והשאר פנוי לעבודה שרצה
        r = self.run_update(['worker.env', 'tunnel.env', 'app-stg.env', 'worker-stg.env', 'app.env', 'tunnel-prod.env'],
                            mem_kb=32 * 1024 * 1024)
        m = re.search(r'mem=(\d+)m .* memr=(\d+)m memr_stg=(\d+)m', r['compose'])
        self.assertEqual(int(m.group(2)), 8192)
        self.assertEqual(int(m.group(1)), 32 * 1024 - 1024 - 800 - 1100 - 8192)

    def test_prod_app_room(self):
        # ת3: השרתון של הייצור — snb-app:prod (אחרי אישור), ו־Tunnel נפרד
        r = self.run_update(['worker.env', 'app.env', 'tunnel-prod.env'])
        self.assertEqual(sorted(r['pulled'].split()), ['ghcr.io/yishaiguedj1/snb-app:prod', 'ghcr.io/yishaiguedj1/snb-worker:prod'])
        self.assertIn('SNB_APP=ghcr.io/yishaiguedj1/snb-app@sha256:', r['env'])
        self.assertNotIn('SNB_APP_STG=', r['env'])
        self.assertIn('UP profiles=prod,app,tunnel-prod ', r['compose'])
        r = self.run_update(['app.env', 'tunnel-prod.env'], bad_app='1')
        self.assertNotIn('SNB_APP=', r['env'], 'שרתון לא חתום לא עולה')
        self.assertIn('UP profiles=tunnel-prod ', r['compose'])

    def test_limits_all_rooms(self):
        r = self.run_update(['worker.env', 'tunnel.env', 'app-stg.env', 'worker-stg.env', 'app.env', 'tunnel-prod.env'],
                            mem_kb=16 * 1024 * 1024)
        m = re.search(r'mem=(\d+)m .* memr_stg=(\d+)m', r['compose'])
        self.assertEqual(int(m.group(1)) + int(m.group(2)), 16 * 1024 - 1024 - 800 - 1100, 'השרתון של הייצור וה־Tunnel שלו יורדים מהעובד')

    def test_cloud_init_slim_keeps_code(self):
        # ההערות יורדות מקוד ההקמה (מקום לסודות), הקוד נשאר — ובקבצים אין heredoc שבו שורה עם # היא תוכן
        import base64, gzip
        ci = read('infra/cloud-init.yaml')
        files = dict(re.findall(r'(?m)^  - path: (\S+)\n(?:    .*\n)*?    content: (\S+)$', ci))
        upd = gzip.decompress(base64.b64decode(files['/usr/local/sbin/snb-update'])).decode()
        self.assertTrue(upd.startswith('#!/bin/sh\n'))
        self.assertIn('# shellcheck source=snb-common.sh', upd)
        self.assertNotRegex(upd, r'(?m)^\s*#(?! shellcheck)(?!!)')
        self.assertIn('resolve "$SNB_APP_IMG" prod', upd)
        for f in ('snb-common.sh', 'snb-update', 'snb-maint', 'snb-status', 'snb-setup'):
            self.assertNotIn('<<', read('infra/host/' + f), f + ': heredoc — הסרת ההערות לא בטוחה')
        self.assertLess(len(ci.encode()), 20 * 1024, 'נשאר מקום לסודות (32KB של Hetzner)')

    def test_compose_rooms(self):
        c = read('infra/compose.yaml')
        for svc, prof, envf in (('worker', 'prod', 'worker.env'), ('tunnel', 'tunnel', 'tunnel.env'),
                                ('app-stg', 'stg', 'app-stg.env'), ('worker-stg', 'stg-worker', 'worker-stg.env'),
                                ('app', 'app', 'app.env'), ('tunnel-prod', 'tunnel-prod', 'tunnel-prod.env')):
            block = re.search(r'(?ms)^  ' + re.escape(svc) + r':\n(.*?)(?=^  \S|^\S)', c).group(1)
            self.assertIn('profiles: [' + prof + ']', block)
            self.assertIn('/etc/snb/' + envf, block)
            for need in ('read_only: true', 'cap_drop: [ALL]', 'no-new-privileges:true', 'mem_limit:', 'pids_limit:'):
                self.assertIn(need, block, svc + ': ' + need)
        self.assertRegex(c, r'cloudflare/cloudflared:[\d.]+@sha256:[0-9a-f]{64}', 'ה־Tunnel נעול ב־digest')
        self.assertIn('SNB_SERVER=https://api-staging.thesnowball.app', c)
        self.assertNotRegex(c, r'\$\{SNB_[A-Z_]+:\?', 'חדר כבוי לא דורש תמונה')
        for f in ('tunnel', 'app-stg'):
            block = re.search(r'(?ms)^  ' + f + r':\n(.*?)(?=^  \S|^\S)', c).group(1)
            self.assertIn('networks: [edge]', block)
        # הייצור ברשת משלו — הניסוי לא מגיע לשרתון של הייצור
        for f in ('tunnel-prod', 'app'):
            block = re.search(r'(?ms)^  ' + f + r':\n(.*?)(?=^  \S|^\S)', c).group(1)
            self.assertIn('networks: [edge-prod]', block)
        app = re.search(r'(?ms)^  app:\n(.*?)(?=^  \S|^\S)', c).group(1)
        self.assertIn('SNB_CRON=off', app, 'הקרון נשאר ב־Vercel עד שהמעבר יוכח')
        self.assertIn('${SNB_APP:-snb-none}', app)
        # העובדים ב־bridge של Docker: ב־gVisor אין DNS ברשת של compose (שרת הניסוי, 12/10/2026)
        for w in ('worker', 'worker-stg'):
            block = re.search(r'(?ms)^  ' + re.escape(w) + r':\n(.*?)(?=^  \S|^\S)', c).group(1)
            self.assertRegex(block, r'(?m)^    network_mode: bridge\b', w + ': רשת ה־bridge')
            self.assertNotIn('networks:', block, w + ': לא ברשת של השרתון')
        self.assertIn('"icc": false', read('infra/host/daemon.json'), 'שני העובדים ב־bridge לא מדברים זה עם זה')

    def test_worker_servers_closed_list(self):
        import os
        sys.path.insert(0, str(ROOT / 'translator'))
        import agent, job
        self.assertIn('https://api-staging.thesnowball.app', job.SERVERS)
        old = os.environ.get('SNB_SERVER')
        try:
            for ok in job.SERVERS + ('http://127.0.0.1:8792',):
                os.environ['SNB_SERVER'] = ok
                self.assertEqual(agent.server_url(), ok.rstrip('/'))
            for bad in ('https://api-staging.thesnowball.app.evil.com', 'http://api-staging.thesnowball.app', 'https://evil.com'):
                os.environ['SNB_SERVER'] = bad
                with self.assertRaises(SystemExit):
                    agent.server_url()
        finally:
            if old is None:
                os.environ.pop('SNB_SERVER', None)
            else:
                os.environ['SNB_SERVER'] = old


if __name__ == '__main__':
    unittest.main()


class HostApply(unittest.TestCase):
    """16/10/2026: עדכון ידני של הגדרת השרת מתוך התמונה (snb-host-apply) — בלי שרת חדש, ובלי שום דבר אוטומטי."""

    def setUp(self):
        import tempfile, os
        self.d = tempfile.mkdtemp()
        self.h, self.s = os.path.join(self.d, 'h'), os.path.join(self.d, 's')
        for x in ('opt/snb', 'usr/local/lib/snb'):
            os.makedirs(os.path.join(self.h, x))
        os.makedirs(self.s)
        open(os.path.join(self.h, 'opt/snb/compose.yaml'), 'w').write('old\n')
        open(os.path.join(self.h, 'usr/local/lib/snb/common.sh'), 'w').write('old=1\n')
        open(os.path.join(self.s, 'compose.yaml'), 'w').write(read('infra/compose.yaml'))
        open(os.path.join(self.s, 'snb-common.sh'), 'w').write(read('infra/host/snb-common.sh'))

    def tearDown(self):
        import shutil
        shutil.rmtree(self.d, ignore_errors=True)

    def run_apply(self):
        import os
        env = dict(os.environ, SNB_HOST_ROOT=self.h, SNB_HOST_SRC=self.s)
        return subprocess.run(['sh', str(ROOT / 'infra/worker/snb-host-apply')], capture_output=True, text=True, env=env, timeout=20)

    def test_copies_and_is_idempotent(self):
        import os, stat
        r = self.run_apply()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(open(os.path.join(self.h, 'opt/snb/compose.yaml')).read(), read('infra/compose.yaml'))
        self.assertEqual(open(os.path.join(self.h, 'usr/local/lib/snb/common.sh')).read(), read('infra/host/snb-common.sh'))
        self.assertEqual(stat.S_IMODE(os.stat(os.path.join(self.h, 'opt/snb/compose.yaml')).st_mode), 0o644)
        self.assertIn('Done (2 updated)', r.stdout)
        self.assertIn('Done (0 updated)', self.run_apply().stdout, 'הרצה שנייה — כלום')

    def test_refuses_while_job_runs(self):
        import os
        v = os.path.join(self.h, 'var/lib/docker/volumes/snb_work-stg/_data')
        os.makedirs(v); open(os.path.join(v, '.busy'), 'w').write('j')
        r = self.run_apply()
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(open(os.path.join(self.h, 'opt/snb/compose.yaml')).read(), 'old\n', 'עבודה רצה — לא נוגעים')

    def test_bad_syntax_not_installed(self):
        import os
        open(os.path.join(self.s, 'snb-common.sh'), 'w').write('if then fi (\n')
        r = self.run_apply()
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(open(os.path.join(self.h, 'usr/local/lib/snb/common.sh')).read(), 'old=1\n')

    def test_packaged_as_data_only(self):
        d = read('infra/worker/Dockerfile')
        self.assertIn('COPY --chown=root:root infra/host/snb-common.sh infra/compose.yaml /opt/snb-host/', d)
        self.assertIn('/opt/snb-host/apply', d)
        for f in ('infra/host/snb-update', 'infra/host/snb-common.sh', 'infra/compose.yaml'):
            self.assertNotIn('snb-host', read(f).replace('snb-host-apply', ''), 'שום דבר בשרת לא מריץ את הקבצים לבד: ' + f)
        # 16/10/2026: בנייה ראשונה נכשלה — .dockerignore חסם את הקבצים. כל COPY בתמונה חייב לעבור בו
        ign = read('.dockerignore')
        for line in re.findall(r'(?m)^COPY .+$', d):
            if '--from=' in line:
                continue                        # משלב בנייה קודם, לא מהריפו
            for src in [x for x in line.split()[1:-1] if not x.startswith('--')]:
                if not src.startswith('translator'):
                    self.assertIn('!' + src + '\n', ign, src + ' חסום ב־.dockerignore — הבנייה תיכשל')
        w = read('.github/workflows/worker-image.yml')
        self.assertIn("- 'infra/host/snb-common.sh'", w, 'שינוי בהגדרה בונה תמונה חדשה')
        self.assertIn("- 'infra/compose.yaml'", w)
