package io.github.yishaiguedj1.snowball.br

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Process

/**
 * מעבר בין משתמשים בדפדפן (27/10/2026): כל מה שבזיכרון של התהליך (הסימניות, הסנכרון, העוגיות של WebView) שייך למשתמש
 * שהיה — לכן התהליך מתחיל מחדש. המסך הזה רץ בתהליך נפרד (":br_restart"), מחכה שהתהליך הראשי ייסגר, ופותח את הדפדפן מחדש
 * (כמו ProcessPhoenix). לא מיוצא — רק הדפדפן עצמו פותח אותו.
 */
class BrRestart : Activity() {
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val pid = intent.getIntExtra(PID, -1)
        if (pid > 0 && pid != Process.myPid()) Process.killProcess(pid)
        startActivity(Intent(this, BrowserActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            .putExtra(BrowserActivity.USER_NEW, intent.getBooleanExtra(BrowserActivity.USER_NEW, false)))
        finish()
        Runtime.getRuntime().exit(0)
    }

    companion object {
        private const val PID = "pid"
        fun go(a: Activity, fresh: Boolean) {
            a.startActivity(Intent(a, BrRestart::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(PID, Process.myPid()).putExtra(BrowserActivity.USER_NEW, fresh))
            a.finishAffinity()
            Runtime.getRuntime().exit(0)
        }
    }
}
