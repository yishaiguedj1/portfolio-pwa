# פונקציות משותפות לכלי השרת (snb-update / snb-maint / snb-status / snb-setup). נטען עם ". /usr/local/lib/snb/common.sh".
# shellcheck disable=SC2034  # המשתנים בשימוש בכלים שטוענים את הקובץ
SNB_DIR=/opt/snb
SNB_ENV=/etc/snb/worker.env
SNB_IMG=ghcr.io/yishaiguedj1/snb-worker
# הזהות היחידה שמותר לה לחתום על התמונה: ה־workflow שבונה אותה, מהענף הראשי של הריפו (חתימה בלי מפתח — Sigstore)
SNB_SIGNER='^https://github\.com/yishaiguedj1/portfolio-pwa/\.github/workflows/worker-image\.yml@refs/heads/main$'
SNB_ISSUER=https://token.actions.githubusercontent.com

snb_log() { logger -t snb "$*" 2>/dev/null || true; echo "$*"; }

# גבולות הקונטיינר לפי השרת בפועל (CX43/CAX31 = 8 ליבות ו־16GB, CAX21 = 4 ו־8GB): חצי ליבה וג׳יגה אחד נשארים למערכת.
# compose.yaml קורא אותם (SNB_CPUS / SNB_MEM) — מספר קבוע גדול ממה שיש בשרת = הקונטיינר לא עולה בכלל.
snb_limits() {
	n=$(nproc 2>/dev/null || echo 2)
	kb=$(awk '/^MemTotal:/{print $2}' /proc/meminfo 2>/dev/null || echo 0)
	SNB_CPUS=$(awk -v n="$n" 'BEGIN{printf "%.1f", (n > 1 ? n - 0.5 : n)}')
	m=$((kb / 1024 - 1024))
	[ "$m" -ge 1024 ] || m=1024
	SNB_MEM=${m}m
	export SNB_CPUS SNB_MEM
}

snb_compose() {
	snb_limits
	if docker compose version >/dev/null 2>&1; then
		docker compose --project-directory "$SNB_DIR" -f "$SNB_DIR/compose.yaml" "$@"
	else
		docker-compose --project-directory "$SNB_DIR" -f "$SNB_DIR/compose.yaml" "$@"
	fi
}

# עבודה רצה עכשיו? (הסוכן כותב /work/.busy בזמן עבודה)
snb_busy() {
	w=$(docker volume inspect -f '{{.Mountpoint}}' snb_work 2>/dev/null) || return 1
	[ -n "$w" ] && [ -e "$w/.busy" ]
}
