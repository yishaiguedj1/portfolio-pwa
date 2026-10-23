package io.github.yishaiguedj1.snowball

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.os.PersistableBundle

/**
 * 23/10/2026: ההורדה באנדרואיד 14+ = משימת העברת נתונים שהמשתמש התחיל (User-Initiated Data Transfer).
 * זו הדרך ש־Google ממליצה עליה להורדה ארוכה: בלי מגבלת 6 השעות של שירות dataSync (targetSdk 35) ובלי מכסות
 * ה־jobs של אנדרואיד 16. אפשר לתזמן אותה רק כשהאפליקציה גלויה — DlActivity פתוח ברגע הלחיצה.
 * המערכת עצרה באמצע (רשת, משתמש, זיכרון) → onStopJob מבקש לתזמן שוב, ו־yt-dlp ממשיך מאותו מקום.
 */
class DlJob : JobService() {
    @Volatile private var stopped = false

    override fun onStartJob(params: JobParameters): Boolean {
        val r = reqOf(params.extras) ?: return false
        stopped = false
        setNotification(params, DlWork.N_ID, DlWork.progress(this, r.title, getString(R.string.dlPrep), -1),
            JOB_END_NOTIFICATION_POLICY_REMOVE)
        Thread { DlWork.run(this, r, { stopped }) { finished -> jobFinished(params, !finished) } }.start()
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        stopped = true
        DlState.id?.let { DlEngine.cancel(it) }
        return true   // לתזמן שוב — ממשיכים מאותו מקום
    }

    companion object {
        private const val JOB_ID = 4100

        /** true = תוזמן (אנדרואיד 14+); false = להשתמש ב־DlService */
        fun schedule(ctx: Context, r: DlWork.Req): Boolean {
            if (android.os.Build.VERSION.SDK_INT < 34) return false
            val b = PersistableBundle().apply {
                putString("id", r.id); putString("u", r.url); putString("ref", r.ref); putString("t", r.title)
                putString("v", r.pick.v); putString("a", r.pick.a); putInt("h", r.pick.h); putInt("s0", r.pick.s0); putInt("s1", r.pick.s1)
            }
            val info = JobInfo.Builder(JOB_ID, ComponentName(ctx, DlJob::class.java))
                .setUserInitiated(true)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setExtras(b)
                .build()
            return try {
                (ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler).schedule(info) == JobScheduler.RESULT_SUCCESS
            } catch (e: Throwable) { false }   // למשל האפליקציה לא גלויה — נופלים לשירות
        }

        private fun reqOf(b: PersistableBundle?): DlWork.Req? {
            b ?: return null
            val id = b.getString("id") ?: return null
            return DlWork.Req(id, b.getString("u") ?: "", b.getString("ref") ?: "", b.getString("t") ?: "",
                DlEngine.Pick(b.getString("v") ?: "", b.getString("a") ?: "", b.getInt("h"), b.getInt("s0"), b.getInt("s1")))
        }
    }
}
