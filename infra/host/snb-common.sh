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

# ת2 (10/10/2026): gVisor (runsc) — ליבה מדומה סביב קופסת העובד, שמעבדת תוכן לא מהימן (תמלילים, סרטונים).
# נמדד על 5 דק׳ TED: תמלול +6%, יישור +26–39%, זיכרון בשיא +0.45GB — לכן אוטומטית רק בשרת עם 12GB ומעלה
# (בשרת של 8GB הגבול של הקונטיינר הוא 7GB והיישור מגיע ל־6.5GB). כפייה: /etc/snb/runtime = runsc / runc.
# נפילה ל־runc תמיד גלויה: SNB_ISO_WHY עובר לקונטיינר, והסוכן מדווח אותו למסך השרת באפליקציה.
SNB_RT_OK=/var/lib/snb/runsc-ok
snb_runtime() {
	want=''
	[ -r /etc/snb/runtime ] && want=$(tr -cd 'a-z' </etc/snb/runtime)
	SNB_ISO_WHY=''
	if [ "$want" = runc ]; then
		SNB_ISO_WHY=manual
	elif [ "$want" != runsc ]; then
		kb=$(awk '/^MemTotal:/{print $2}' /proc/meminfo 2>/dev/null || echo 0)
		if [ "$kb" -ge 11500000 ]; then want=runsc; else want=runc; SNB_ISO_WHY=mem; fi
	fi
	if [ "$want" = runsc ] && ! { [ -x /usr/bin/runsc ] && docker info --format '{{json .Runtimes}}' 2>/dev/null | grep -q '"runsc"'; }; then
		want=runc; SNB_ISO_WHY=missing
	fi
	if [ "$want" = runsc ] && [ -e "$SNB_RT_OK.bad" ]; then want=runc; SNB_ISO_WHY=selftest; fi
	SNB_RUNTIME=$want
	export SNB_RUNTIME SNB_ISO_WHY
}

snb_compose() {
	snb_limits
	snb_runtime
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
