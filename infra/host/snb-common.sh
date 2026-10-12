# פונקציות משותפות לכלי השרת (snb-update / snb-maint / snb-status / snb-setup). נטען עם ". /usr/local/lib/snb/common.sh".
# shellcheck disable=SC2034  # המשתנים בשימוש בכלים שטוענים את הקובץ
SNB_DIR=/opt/snb
SNB_ENV=/etc/snb/worker.env
SNB_IMG=ghcr.io/yishaiguedj1/snb-worker
# הזהות היחידה שמותר לה לחתום על התמונה: ה־workflow שבונה אותה, מהענף הראשי של הריפו (חתימה בלי מפתח — Sigstore)
SNB_SIGNER='^https://github\.com/yishaiguedj1/portfolio-pwa/\.github/workflows/worker-image\.yml@refs/heads/main$'
# שלב 2ב: השרתון כקונטיינר (חדר האפליקציה) — תמונה נפרדת, נחתמת ב־workflow משלה
SNB_APP_IMG=ghcr.io/yishaiguedj1/snb-app
SNB_APP_SIGNER='^https://github\.com/yishaiguedj1/portfolio-pwa/\.github/workflows/app-image\.yml@refs/heads/main$'
SNB_ISSUER=https://token.actions.githubusercontent.com

snb_log() { logger -t snb "$*" 2>/dev/null || true; echo "$*"; }

# גבולות הקונטיינר לפי השרת בפועל (CX43/CAX31 = 8 ליבות ו־16GB, CAX21 = 4 ו־8GB): חצי ליבה וג׳יגה אחד נשארים למערכת.
# compose.yaml קורא אותם (SNB_CPUS / SNB_MEM) — מספר קבוע גדול ממה שיש בשרת = הקונטיינר לא עולה בכלל.
# שלב 2ב: כשיש גם חדרי ניסוי — השרתון וה־Tunnel לוקחים כ־0.8GB, ועובד הניסוי 3GB וליבה וחצי (סרטונים קצרים).
# עובד ניסוי לבד בשרת — מקבל את כל מה שהעובד של הייצור היה מקבל.
snb_limits() {
	snb_rooms
	n=$(nproc 2>/dev/null || echo 2)
	kb=$(awk '/^MemTotal:/{print $2}' /proc/meminfo 2>/dev/null || echo 0)
	c=$(awk -v n="$n" 'BEGIN{printf "%.1f", (n > 1 ? n - 0.5 : n)}')
	m=$((kb / 1024 - 1024))
	case ",$COMPOSE_PROFILES," in *,stg,*|*,tunnel,*) m=$((m - 800)) ;; esac
	[ "$m" -ge 1024 ] || m=1024
	SNB_CPUS=$c SNB_MEM=${m}m SNB_CPUS_STG=$c SNB_MEM_STG=${m}m
	case ",$COMPOSE_PROFILES," in *,prod,*,stg-worker,*|*,prod,stg-worker,*)
		SNB_CPUS_STG=1.5; SNB_MEM_STG=3072m
		SNB_CPUS=$(awk -v c="$c" 'BEGIN{printf "%.1f", (c > 2.5 ? c - 1.5 : 1)}')
		m=$((m - 3072)); [ "$m" -ge 1024 ] || m=1024; SNB_MEM=${m}m ;;
	esac
	export SNB_CPUS SNB_MEM SNB_CPUS_STG SNB_MEM_STG
}

# החדרים — לפי קובצי הסודות שיש בשרת (compose.yaml: profiles). בלי קובץ = החדר כבוי.
# snb_rooms_wanted: מה שהוגדר (snb-update מושך לו תמונה). snb_rooms: רק חדרים שכבר יש להם תמונה מאומתת ב־.env —
# כך חדר שהתמונה שלו עוד לא ירדה (למשל החבילה עוד פרטית ב־GHCR) לא מפיל את ההפעלה של כל השאר.
snb_rooms_wanted() {
	r=''
	[ -s /etc/snb/worker.env ] && r="$r,prod"
	[ -s /etc/snb/tunnel.env ] && r="$r,tunnel"
	[ -s /etc/snb/app-stg.env ] && r="$r,stg"
	[ -s /etc/snb/worker-stg.env ] && r="$r,stg-worker"
	SNB_WANTED=${r#,}
}
snb_rooms() {
	snb_rooms_wanted
	r=''
	for x in $(echo "$SNB_WANTED" | tr ',' ' '); do
		case $x in prod) v=SNB_IMAGE ;; stg) v=SNB_APP_STG ;; stg-worker) v=SNB_IMAGE_STG ;; *) v='' ;; esac
		if [ -z "$v" ] || grep -q "^$v=" "$SNB_DIR/.env" 2>/dev/null; then r="$r,$x"; fi
	done
	COMPOSE_PROFILES=${r#,}
	export COMPOSE_PROFILES
}
snb_room_on() { snb_rooms_wanted; case ",$SNB_WANTED," in *",$1,"*) return 0 ;; esac; return 1; }

# ת2 (10/10/2026): gVisor (runsc) — ליבה מדומה סביב קופסת העובד, שמעבדת תוכן לא מהימן (תמלילים, סרטונים).
# נמדד על 5 דק׳ TED: תמלול +6%, יישור +26–39%, זיכרון בשיא +0.45GB. מ־10/10/2026 (שלב 4.1, היישור ב־ONNX INT8)
# שיא היישור תחת gVisor 4.2GB (היה 6.5GB) — לכן אוטומטית גם בשרת של 8GB (MemTotal ~7.6GB; הגבול של הקונטיינר ~6.6GB). כפייה: /etc/snb/runtime = runsc / runc.
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
		if [ "$kb" -ge 7000000 ]; then want=runsc; else want=runc; SNB_ISO_WHY=mem; fi
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

# עבודה רצה עכשיו? (הסוכן כותב /work/.busy בזמן עבודה). בלי ארגומנט — כל עובד; stg — רק עובד הניסוי; prod — רק הייצור.
snb_busy() {
	case "${1:-all}" in prod) vols=snb_work ;; stg) vols=snb_work-stg ;; *) vols='snb_work snb_work-stg' ;; esac
	for v in $vols; do
		w=$(docker volume inspect -f '{{.Mountpoint}}' "$v" 2>/dev/null) || continue
		[ -n "$w" ] && [ -e "$w/.busy" ] && return 0
	done
	return 1
}
