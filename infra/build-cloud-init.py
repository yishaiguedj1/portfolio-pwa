#!/usr/bin/env python3
"""מחולל infra/cloud-init.yaml — ההגדרה הראשונית של השרת, מתוך הקבצים ב־infra/host ו־infra/compose.yaml.

בריפו הקובץ בלי אף סוד. את "קוד ההקמה" מרכיבה האפליקציה (סטודיו ← השרת ← הוספת שרת): היא מחליפה את שורת
הסימון MARK ברשומה של /etc/snb/worker.env (מפתח Anthropic + טוקן השרת), בטלפון בלבד, והמשתמש מדביק אותו ב־Hetzner
("Cloud config"). כך אין צורך בקונסולה (שלא מעבירה הדבקה ולא מציגה עברית). מה שב־user-data זמין לשירות המטא־דאטה
של Hetzner לכל חיי השרת — רק ל־root בשרת: הקונטיינר חסום ממנו בחומת האש (nftables).

הרצה:  python3 infra/build-cloud-init.py            (כותב את הקובץ)
       python3 infra/build-cloud-init.py --check    (הבדיקות: נכשל אם הקובץ לא מעודכן)
"""
import base64
import gzip
import re
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
# בריפו בלי סודות. את המפתחות מוסיפה האפליקציה במקום שורת הסימון ("קוד ההקמה").
package_update: true
package_upgrade: true
# חבילות במפורש, גם "מומלצות": בתמונות של Hetzner Install-Recommends כבוי, וב־Debian 13 הפקודה docker
# בחבילה נפרדת (docker-cli, רק "מומלצת" של docker.io). לקח 09/10/2026: השירות הותקן בלי הפקודה, ו־snb-update נכשל בשקט.
packages:
  - docker.io
  - docker-cli
  - docker-compose
  - cosign
  - nftables
  - unattended-upgrades
  - apt-listchanges
  # ת2: gVisor — ליבה מדומה לקופסת העובד (מהמאגר החתום שלמטה; snb_runtime מחליט מתי להפעיל)
  - runsc
ssh_pwauth: false
""" + '{APT}' + """write_files:
"""

# שורת הסימון: האפליקציה מחליפה אותה ברשומה של /etc/snb/worker.env (studio.js — cloudInitWithSecrets)
MARK = '  # SNB_SECRETS'

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
  # יש מפתחות (קוד ההקמה מהאפליקציה, או "הקמת שרת" מ־GitHub עם חדרי הניסוי) — מתחילים מיד, בלי לחכות רבע שעה לטיימר
  - if ls /etc/snb/*.env >/dev/null 2>&1; then chmod 600 /etc/snb/*.env; systemctl start --no-block snb-update.service; fi
"""



# המאגר של gVisor: חתום במפתח הרשמי (טביעה 6F1DF85E3A71C24918E727D56FC6D554E32BD943 — נבדק מול InRelease
# ו־sha256 של החבילה ב־10/10/2026). המפתח בקובץ בריפו (host/gvisor.key) — לא מורידים אותו בזמן ההקמה.
GVISOR_FPR = '6F1DF85E3A71C24918E727D56FC6D554E32BD943'


def apt_block() -> str:
    key = (HERE / 'host' / 'gvisor.key').read_text(encoding='utf-8').strip().split('\n')
    return ('apt:\n  sources:\n    gvisor:\n'
            '      source: "deb [arch=amd64,arm64 signed-by=$KEY_FILE] https://storage.googleapis.com/gvisor/releases release main"\n'
            '      key: |\n' + ''.join('        ' + ln + '\n' if ln else '\n' for ln in key))


def packed(data: bytes) -> str:
    """gzip (mtime=0 — אותו פלט בכל הרצה) + base64. שלב 2ב: עם חדרי הניסוי הקבצים עברו את 32KB של Hetzner
    ל־user-data; cloud-init פותח לבד (encoding: gz+b64). המקור הקריא — בקבצים ב־infra/."""
    return base64.b64encode(gzip.compress(data, compresslevel=9, mtime=0)).decode()


def render() -> str:
    out = [HEAD.replace('{APT}', apt_block())]
    for src, dst, mode in FILES:
        data = (HERE / src).read_bytes()
        out.append(f'  # infra/{src}\n  - path: {dst}\n    permissions: "{mode}"\n    owner: root:root\n'
                   f'    encoding: gz+b64\n    content: {packed(data)}\n')
    out.append(MARK + '\n')
    out.append(TAIL)
    return ''.join(out)


def unpacked(text: str) -> str:
    """להשוואה: כל תוכן דחוס נפתח. הבתים של gzip תלויים בגרסת zlib (ב־CI יצא שונה מאותו מקור) — התוכן לא."""
    return re.sub(r'(?m)^(    content: )([A-Za-z0-9+/=]{20,})$',
                  lambda m: m.group(1) + repr(gzip.decompress(base64.b64decode(m.group(2)))), text)


def main() -> int:
    text = render()
    if '--check' in sys.argv:
        if not OUT.exists() or unpacked(OUT.read_text(encoding='utf-8')) != unpacked(text):
            print('✗ infra/cloud-init.yaml לא מעודכן — להריץ: python3 infra/build-cloud-init.py')
            return 1
        print('✓ cloud-init.yaml מעודכן')
        return 0
    OUT.write_text(text, encoding='utf-8')
    print(f'✓ נכתב {OUT.name} ({len(text.encode())} בתים)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
