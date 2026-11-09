package io.github.yishaiguedj1.snowball.upd

import android.app.job.JobParameters
import android.app.job.JobService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/* 08/11/2026: החלקים של Upd שהמערכת מפעילה (ההסבר המלא ב־Upd.kt) */

/** הבדיקה היומית (JOB_CHECK) וההורדה + ההתקנה (JOB_DL) — בתהליכון, לא על ה־main thread.
    שירות אחד מריץ כמה ג'ובים במקביל — לכן דגל עצירה לכל ג'וב */
class UpdJob : JobService() {
    private val stopped = java.util.concurrent.ConcurrentHashMap<Int, Boolean>()
    override fun onStartJob(p: JobParameters): Boolean {
        val c = applicationContext
        stopped[p.jobId] = false
        Thread {
            var again = false
            try {
                if (p.jobId == Upd.JOB_DL) again = Upd.download(c) { stopped[p.jobId] == true }
                else if (Upd.check(c)) Upd.announce(c)
            } catch (e: Exception) {}
            if (stopped[p.jobId] != true) jobFinished(p, again)
        }.start()
        return true
    }
    /** המערכת עצרה (רשת נפלה / תם הזמן): ההורדה נשמרה עד המקום שהגיעה — מתזמנים שוב וממשיכים משם */
    override fun onStopJob(p: JobParameters): Boolean { stopped[p.jobId] = true; return p.jobId == Upd.JOB_DL }
}

/** התשובה של PackageInstaller (לא מיוצא — רק ה־PendingIntent שלנו) */
class UpdStatus : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        when (i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_SUCCESS -> Upd.done(c)
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                // המערכת בכל זאת מבקשת אישור (אנדרואיד 11 ומטה, או שהתנאים לא התקיימו): מהמסך — מיד; ברקע — בהתראה
                val ask = (if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                    else @Suppress("DEPRECATION") i.getParcelableExtra(Intent.EXTRA_INTENT)) ?: return
                ask.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (UpdActivity.shown) try { c.startActivity(ask); return } catch (e: Exception) {}
                UpdActivity.pendingAsk = ask
                Upd.res(c).let { r -> Upd.notify(c, r.getString(io.github.yishaiguedj1.snowball.R.string.updAskTitle), r.getString(io.github.yishaiguedj1.snowball.R.string.updAskText), true) }
            }
            else -> Upd.fail(c, "inst")
        }
    }
}

/** הגרסה החדשה הותקנה (המערכת מפעילה את הגרסה החדשה) → "עודכנה לגרסה X" + הבדיקה היומית מחדש */
class UpdDone : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        if (i.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        Upd.done(c)
        Upd.schedule(c)
    }
}
