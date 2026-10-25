package io.github.yishaiguedj1.snowball

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context

/**
 * 25/10/2026 — תרגום בטלפון: הסרטון נשמר בטלפון לצריבה נוספת עד שהפרויקט נמחק באתר (בקשת המשתמש). המשימה הזו
 * (פעם ב־12 שעות, כשיש רשת) שואלת את השרתון אם כל פרויקט עדיין קיים (op:'phAlive'), ומוחקת רק את מה שנמחק שם
 * (PhStore.gcRemote). בלי ממשק ובלי התראה.
 */
class PhGcJob : JobService() {
    override fun onStartJob(p: JobParameters?): Boolean {
        Thread {
            try { PhStore.gcRemote(applicationContext) } catch (e: Throwable) {}
            if (!PhStore.hasJobs(applicationContext)) cancel(applicationContext)
            jobFinished(p, false)
        }.start()
        return true
    }

    override fun onStopJob(p: JobParameters?): Boolean = true

    companion object {
        private const val ID = 4302

        fun schedule(ctx: Context) {
            val js = ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
            if (js.getPendingJob(ID) != null) return
            js.schedule(JobInfo.Builder(ID, ComponentName(ctx, PhGcJob::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(12 * 3600_000L)
                .setPersisted(false)
                .build())
        }

        fun cancel(ctx: Context) = (ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler).cancel(ID)
    }
}
