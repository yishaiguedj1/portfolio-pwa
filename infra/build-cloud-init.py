#!/usr/bin/env python3
"""מחולל infra/cloud-init.yaml — ההגדרה הראשונית של השרת, מתוך הקבצים ב־infra/host ו־infra/compose.yaml.

את הקובץ שנוצר מדביקים פעם אחת ביצירת השרת ב־Hetzner ("Cloud config"). אין בו אף סוד: המפתחות נכנסים אחר כך
ב־snb-setup מהקונסולה. (כל מה שנמצא ב־user-data נשאר זמין בשירות המטא־דאטה של Hetzner לכל חיי השרת.)

הרצה:  python3 infra/build-cloud-init.py            (כותב את הקובץ)
       python3 infra/build-cloud-init.py --check    (הבדיקות: נכשל אם הקובץ לא מעודכן)
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / 'cloud-init.yaml'

# (קובץ בריפו, יעד בשרת, הרשאות)
FILES = [
    ('host/nftables.conf', '/etc/nftables.conf', '0644'),
    ('host/daemon.json', '/etc/docker/daemon.json', '0644'),
    ('host/sysctl.conf', '/etc/sysctl.d/90-snb.conf', '0644'),
    ('host/20auto-upgrades', '/etc/apt/apt.conf.d/20auto-upgrades', '0644'),
    ('host/journald.conf', '/etc/systemd/journald.conf.d/90-snb.conf', '0644'),
    ('host/motd', '/etc/motd', '0644'),
    ('host/snb-common.sh', '/usr/local/lib/snb/common.sh', '0644'),
    ('host/snb-update', '/usr/local/sbin/snb-update', '0755'),
    ('host/snb-maint', '/usr/local/sbin/snb-maint', '0755'),
    ('host/snb-status', '/usr/local/sbin/snb-status', '0755'),
    ('host/snb-setup', '/usr/local/sbin/snb-setup', '0755'),
    ('host/snb-update.service', '/etc/systemd/system/snb-update.service', '0644'),
    ('host/snb-update.timer', '/etc/systemd/system/snb-update.timer', '0644'),
    ('host/snb-maint.service', '/etc/systemd/system/snb-maint.service', '0644'),
    ('host/snb-maint.timer', '/etc/systemd/system/snb-maint.timer', '0644'),
    ('compose.yaml', '/opt/snb/compose.yaml', '0644'),
]

HEAD = """#cloud-config
# THE SNOWBALL — שרת התרגום (Debian 13). נוצר אוטומטית מ־infra/ ע״י infra/build-cloud-init.py — לא לערוך ביד.
# אין כאן סודות. אחרי שהשרת עולה: הקונסולה של Hetzner → root → snb-setup.
package_update: true
package_upgrade: true
packages:
  - docker.io
  - docker-compose
  - cosign
  - nftables
  - unattended-upgrades
  - apt-listchanges
ssh_pwauth: false
write_files:
"""

TAIL = """runcmd:
  # חומת האש קודם — לפני ש־Docker עולה עם הכללים שלו
  - systemctl enable --now nftables
  - nft -f /etc/nftables.conf
  - sysctl --system
  - systemctl restart systemd-journald
  - systemctl restart docker
  # בלי SSH בכלל: הניהול דרך הקונסולה של Hetzner (או Tailscale — infra/README.md). פחות שירות פתוח = פחות לתקוף.
  - systemctl disable --now ssh.socket ssh.service || true
  - mkdir -p /etc/snb && chmod 700 /etc/snb
  - systemctl daemon-reload
  - systemctl enable --now snb-update.timer snb-maint.timer unattended-upgrades
"""



def render() -> str:
    out = [HEAD]
    for src, dst, mode in FILES:
        text = (HERE / src).read_text(encoding='utf-8')
        out.append(f'  - path: {dst}\n    permissions: "{mode}"\n    owner: root:root\n    content: |\n')
        out.append(''.join(('      ' + ln) if ln.strip() else '\n' for ln in text.splitlines(keepends=True)))
        if not text.endswith('\n'):
            out.append('\n')
    out.append(TAIL)
    return ''.join(out)


def main() -> int:
    text = render()
    if '--check' in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding='utf-8') != text:
            print('✗ infra/cloud-init.yaml לא מעודכן — להריץ: python3 infra/build-cloud-init.py')
            return 1
        print('✓ cloud-init.yaml מעודכן')
        return 0
    OUT.write_text(text, encoding='utf-8')
    print(f'✓ נכתב {OUT.name} ({len(text.encode())} בתים)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
