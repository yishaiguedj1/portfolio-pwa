"""השרת כקוד (infra/) — בדיקות סטטיות לתכונות האבטחה, כדי ששינוי עתידי לא יחליש אותן בשקט.

לא מריצות Docker או שרת: קוראות את הקבצים ובודקות את מה שחייב להישאר נכון.
הרצה: python3 -m unittest tests.test_infra   (מתוך translator/)
"""
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
        self.assertNotRegex(c, r'(?m)^\s*(privileged|network_mode|cap_add|pid|ipc)\s*:', 'בלי הרשאות מיוחדות')
        for need in ('read_only: true', 'cap_drop: [ALL]', 'no-new-privileges:true', 'user: "10001:10001"',
                     '/etc/snb/worker.env', 'healthcheck:', 'mem_limit:', 'pids_limit:'):
            self.assertIn(need, c)
        self.assertNotIn('docker.sock', c, 'אסור לחשוף את Docker לקונטיינר (= root על השרת)')
        # גבולות לפי גודל השרת בפועל — קבוע גדול מהשרת (cpus 7.5 בשרת של 4 ליבות) = הקונטיינר לא עולה
        self.assertIn('cpus: ${SNB_CPUS:-', c)
        self.assertIn('mem_limit: ${SNB_MEM:-', c)
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
        self.assertIn(':prod', u)

    def test_setup_code_marker(self):
        ci = read('infra/cloud-init.yaml')
        self.assertEqual(ci.count('\n  # SNB_SECRETS\n'), 1, 'שורת סימון אחת לקוד ההקמה מהאפליקציה')
        self.assertLess(ci.index('# SNB_SECRETS'), ci.index('\nruncmd:'), 'בתוך write_files')
        self.assertIn('systemctl start --no-block snb-update.service', ci, 'יש מפתחות — מתחילים מיד')
        self.assertIn("CI_MARK = '  # SNB_SECRETS'", read('studio.js'), 'אותו סימון באפליקציה')

    def test_setup_secrets_file_private(self):
        s = read('infra/host/snb-setup')
        self.assertIn('umask 077', s)
        self.assertIn('chmod 600', s)
        self.assertIn('stty -echo', s, 'המפתח לא מוצג על המסך')


if __name__ == '__main__':
    unittest.main()
