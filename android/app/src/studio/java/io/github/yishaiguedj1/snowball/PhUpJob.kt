package io.github.yishaiguedj1.snowball

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.PersistableBundle

/**
 * 29/10/2026 — הסרטון לענן (spec.vc) כמשימת העברת נתונים שהמשתמש התחיל (UIDT, אנדרואיד 14+), כמו DlJob: ממשיכה כשהאפליקציה
 * סגורה והמסך כבוי, בלי מגבלת 6 השעות של dataSync, והמערכת מריצה אותה שוב כשהרשת חוזרת. אפשר לתזמן רק כשהאפליקציה גלויה —
 * PhActivity פתוח ברגע הנגיעה ("להתחיל" / "להמשיך"). מתחת ל־14 (או כשהתזמון נכשל) — PhService מעלה אחרי הקול.
 */
class PhUpJob : JobService() {
    @Volatile private var stopped = false

    override fun onStartJob(params: JobParameters): Boolean {
        val pids = pidsOf(params.extras)
        if (pids.isEmpty()) return false
        stopped = false
        val title0 = PhStore.get(this, pids[0])?.optString("name") ?: ""
        setNotification(params, PhWork.N_VID, PhWork.vprogress(this, title0, 0f), JOB_END_NOTIFICATION_POLICY_REMOVE)
        Thread {
            // 20/11/2026: תור עבודות — הסרטונים אחד אחרי השני, לפי סדר ההוספה (כל אחד ברוחב הפס המלא — העבודה שלו מתחילה מוקדם)
            var all = true
            for (pid in pids) {
                if (stopped) break
                val done = try {
                    PhWork.video(this, pid, { stopped }) { n -> runCatching { setNotification(params, PhWork.N_VID, n, JOB_END_NOTIFICATION_POLICY_REMOVE) } }
                } catch (e: Throwable) { false }
                if (!done) all = false
            }
            if (!stopped) jobFinished(params, !all)
        }.start()
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        stopped = true
        // 1/11/2026: למה המערכת עצרה (רשת, מכסה, סוללה…) — נשלח עם הדיווח הבא (vcp.sr), למדידה של ההעלאה ברקע
        if (Build.VERSION.SDK_INT >= 31) pidsOf(params.extras).forEach { pid -> runCatching { PhStore.update(this, pid) { it.put("vSr", params.stopReason) } } }
        return true   // לתזמן שוב — ממשיכים מהחלקים שכבר ב־R2
    }

    companion object {
        private const val JOB_ID = 4300

        /** הסרטונים של המשימה — "pids" (רשימה מופרדת בפסיקים, לפי הסדר), או "pid" של משימה ישנה שכבר תוזמנה */
        fun pidsOf(b: PersistableBundle?): List<String> =
            ((b?.getString("pids") ?: b?.getString("pid") ?: "").split(',')).filter { PhCore.PID_RE.matches(it) }.distinct().take(PhCore.Q_MAX)

        /** הסדר החדש: מה שכבר חיכה במשימה (ועוד לא עלה), ואחריו החדשים — בלי כפילויות. טהורה */
        fun merge(old: List<String>, add: List<String>, pending: (String) -> Boolean): List<String> =
            (old.filter(pending) + add).distinct().take(PhCore.Q_MAX)

        /** true = תוזמן (אנדרואיד 14+, האפליקציה גלויה); false = PhService יעלה אחרי הקול.
         *  20/11/2026 (תקלה: בתור של 9 פרקים רק האחרון עלה ורץ): משימה אחת (JOB_ID קבוע) — תזמון נוסף החליף את הקודם.
         *  עכשיו המשימה נושאת רשימה: מה שעוד לא עלה מהמשימה הקודמת, ואחריו החדשים, ומעלה אותם לפי הסדר */
        fun schedule(ctx: Context, pids: List<String>): Boolean {
            if (Build.VERSION.SDK_INT < 34 || pids.isEmpty()) return false
            val js = ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
            val old = try { pidsOf(js.getPendingJob(JOB_ID)?.extras) } catch (e: Throwable) { emptyList() }
            val l = merge(old, pids) { p -> PhStore.get(ctx, p)?.let { it.optBoolean("vc") && it.optString("vId").isEmpty() && it.optString("vE").isEmpty() } ?: false }
            val left = l.sumOf { maxOf(0L, PhStore.get(ctx, it)?.optLong("size") ?: 0L) }
            val info = JobInfo.Builder(JOB_ID, ComponentName(ctx, PhUpJob::class.java))
                .setUserInitiated(true)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                // 1/11/2026: כמה עולה — המערכת מתזמנת ומעריכה את המשימה לפי זה (בלי — "לא ידוע")
                .apply { if (left > 0) setEstimatedNetworkBytes(0L, left) }
                .setExtras(PersistableBundle().apply { putString("pids", l.joinToString(",")) })
                .build()
            return try { js.schedule(info) == JobScheduler.RESULT_SUCCESS } catch (e: Throwable) { false }
        }
    }
}
