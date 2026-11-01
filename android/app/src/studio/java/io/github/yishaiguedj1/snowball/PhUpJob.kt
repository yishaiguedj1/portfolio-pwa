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
        val pid = params.extras?.getString("pid") ?: return false
        if (!PhCore.PID_RE.matches(pid)) return false
        stopped = false
        val title = PhStore.get(this, pid)?.optString("name") ?: ""
        setNotification(params, PhWork.N_VID, PhWork.vprogress(this, title, 0f), JOB_END_NOTIFICATION_POLICY_REMOVE)
        Thread {
            val done = try {
                PhWork.video(this, pid, { stopped }) { n -> runCatching { setNotification(params, PhWork.N_VID, n, JOB_END_NOTIFICATION_POLICY_REMOVE) } }
            } catch (e: Throwable) { false }
            if (!stopped) jobFinished(params, !done)
        }.start()
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        stopped = true
        // 1/11/2026: למה המערכת עצרה (רשת, מכסה, סוללה…) — נשלח עם הדיווח הבא (vcp.sr), למדידה של ההעלאה ברקע
        if (Build.VERSION.SDK_INT >= 31) params.extras?.getString("pid")?.let { pid -> runCatching { PhStore.update(this, pid) { it.put("vSr", params.stopReason) } } }
        return true   // לתזמן שוב — ממשיכים מהחלקים שכבר ב־R2
    }

    companion object {
        private const val JOB_ID = 4300

        /** true = תוזמן (אנדרואיד 14+, האפליקציה גלויה); false = PhService יעלה אחרי הקול */
        fun schedule(ctx: Context, pid: String): Boolean {
            if (Build.VERSION.SDK_INT < 34) return false
            val r = PhStore.get(ctx, pid)
            val left = maxOf(0L, (r?.optLong("size") ?: 0L))
            val info = JobInfo.Builder(JOB_ID, ComponentName(ctx, PhUpJob::class.java))
                .setUserInitiated(true)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                // 1/11/2026: כמה עולה — המערכת מתזמנת ומעריכה את המשימה לפי זה (בלי — "לא ידוע")
                .apply { if (left > 0) setEstimatedNetworkBytes(0L, left) }
                .setExtras(PersistableBundle().apply { putString("pid", pid) })
                .build()
            return try {
                (ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler).schedule(info) == JobScheduler.RESULT_SUCCESS
            } catch (e: Throwable) { false }
        }
    }
}
