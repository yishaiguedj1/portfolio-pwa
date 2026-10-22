package io.github.yishaiguedj1.snowball

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper

/**
 * 22/10/2026: ההורדה רצה כשירות בחזית (התראה עם התקדמות, כמו כל מנהל הורדות) — ממשיכה גם כשיוצאים מהמסך.
 * הורדה אחת בכל פעם. בסוף: הקובץ ב־Movies/Studio, ואז הוא עובר לאתר (DlState.handoff) — מהמסך אם הוא פתוח,
 * אחרת מההתראה (אנדרואיד לא נותן לשירות לפתוח מסך מהרקע).
 */
class DlService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val i = intent ?: return START_NOT_STICKY
        if (i.action == ACT_CANCEL) { DlState.id?.let { DlEngine.cancel(it) }; return START_NOT_STICKY }
        val id = i.getStringExtra(X_ID) ?: return START_NOT_STICKY
        if (DlState.busy() && DlState.id != id) return START_NOT_STICKY   // הורדה אחת בכל פעם (המסך כבר סימן את זו)
        val url = i.getStringExtra(X_URL) ?: ""
        val title = i.getStringExtra(X_TITLE) ?: ""
        val pick = DlEngine.Pick(i.getStringExtra(X_V) ?: "", i.getStringExtra(X_A) ?: "", i.getIntExtra(X_H, 0),
            i.getIntExtra(X_S0, 0), i.getIntExtra(X_S1, 0))
        val ref = i.getStringExtra(X_REF) ?: ""
        DlState.start(id, title)
        startFg(notif(title, getString(R.string.dlPrep), -1))
        Thread {
            var last = 0L
            try {
                val f = DlEngine.download(this, url, ref, pick, id) { p, _ ->
                    DlState.progress(p)
                    val now = System.currentTimeMillis()
                    if (now - last > 1000) { last = now; nm().notify(N_ID, notif(title, getString(R.string.dlPct, p.toInt().coerceIn(0, 100)), p.toInt())) }
                }
                DlState.phase("save")
                nm().notify(N_ID, notif(title, getString(R.string.dlSaving), -1))
                val uri = DlEngine.publish(this, f)
                main.post {
                    DlState.done(uri)
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    if (!DlState.watched()) nm().notify(N_DONE, doneNotif(title, uri, id))
                    stopSelf()
                }
            } catch (e: Throwable) {
                val code = (e as? IllegalArgumentException)?.message ?: "fail"
                main.post {
                    DlState.fail(code)
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    if (code != "cancel" && !DlState.watched()) nm().notify(N_DONE, errNotif(title, id, code))
                    stopSelf()
                }
            }
        }.start()
        return START_NOT_STICKY
    }

    private val main = Handler(Looper.getMainLooper())
    private fun nm() = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private fun startFg(n: Notification) {
        if (Build.VERSION.SDK_INT >= 29) startForeground(N_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC) else startForeground(N_ID, n)
    }

    private fun chan() {
        if (Build.VERSION.SDK_INT >= 26) nm().createNotificationChannel(NotificationChannel(CH, getString(R.string.dlChannel), NotificationManager.IMPORTANCE_LOW))
    }

    private fun builder(): Notification.Builder { chan(); return if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CH) else Notification.Builder(this) }

    private fun notif(title: String, text: String, pct: Int): Notification {
        val open = PendingIntent.getActivity(this, 1, Intent(this, DlActivity::class.java).setAction(DlActivity.ACT_SHOW), PendingIntent.FLAG_IMMUTABLE)
        val cancel = PendingIntent.getService(this, 2, Intent(this, DlService::class.java).setAction(ACT_CANCEL), PendingIntent.FLAG_IMMUTABLE)
        return builder().setSmallIcon(android.R.drawable.stat_sys_download).setContentTitle(title.ifEmpty { getString(R.string.dlTitle) })
            .setContentText(text).setOngoing(true).setOnlyAlertOnce(true).setContentIntent(open)
            .setProgress(100, pct.coerceAtLeast(0), pct < 0)
            .addAction(Notification.Action.Builder(null, getString(R.string.dlCancel), cancel).build()).build()
    }

    private fun doneNotif(title: String, uri: Uri, id: String): Notification {
        val pi = PendingIntent.getActivity(this, 3, DlState.handoffIntent(this, uri, id), PendingIntent.FLAG_IMMUTABLE)
        return builder().setSmallIcon(android.R.drawable.stat_sys_download_done).setContentTitle(getString(R.string.dlDone))
            .setContentText(title.ifEmpty { getString(R.string.dlTapContinue) }).setSubText(getString(R.string.dlTapContinue))
            .setAutoCancel(true).setContentIntent(pi).build()
    }

    private fun errNotif(title: String, id: String, code: String): Notification {
        val pi = PendingIntent.getActivity(this, 4, DlState.errIntent(this, id, code), PendingIntent.FLAG_IMMUTABLE)
        return builder().setSmallIcon(android.R.drawable.stat_notify_error).setContentTitle(getString(R.string.dlFailed))
            .setContentText(title).setAutoCancel(true).setContentIntent(pi).build()
    }

    companion object {
        const val ACT_CANCEL = "app.thesnowball.studio.DL_CANCEL"
        const val X_ID = "id"; const val X_URL = "u"; const val X_REF = "ref"; const val X_TITLE = "t"
        const val X_V = "v"; const val X_A = "a"; const val X_H = "h"; const val X_S0 = "s0"; const val X_S1 = "s1"
        private const val CH = "dl"
        private const val N_ID = 41
        private const val N_DONE = 42
    }
}

/** מצב ההורדה הנוכחית — המסך (DlActivity) מאזין, השירות מעדכן. הכל על ה־main thread */
object DlState {
    @Volatile var id: String? = null; private set
    @Volatile var title = ""; private set
    @Volatile var phase = "idle"; private set      // idle · dl · save · done · err
    @Volatile var pct = 0f; private set
    @Volatile var uri: Uri? = null; private set
    @Volatile var err = ""; private set
    private val listeners = LinkedHashSet<() -> Unit>()
    private val main = Handler(Looper.getMainLooper())

    fun busy() = phase == "dl" || phase == "save"
    fun watched() = listeners.isNotEmpty()
    fun listen(l: () -> Unit) { listeners.add(l) }
    fun unlisten(l: () -> Unit) { listeners.remove(l) }
    private fun fire() { main.post { listeners.toList().forEach { it() } } }

    fun start(i: String, t: String) { id = i; title = t; phase = "dl"; pct = 0f; uri = null; err = ""; fire() }
    fun progress(p: Float) { pct = p; fire() }
    fun phase(p: String) { phase = p; fire() }
    fun done(u: Uri) { uri = u; phase = "done"; fire() }
    fun fail(c: String) { err = c; phase = "err"; fire() }
    fun clear() { phase = "idle"; id = null; uri = null }

    /** הקובץ עובר לאתר: "שיתוף" פנימי ל־MainActivity עם הקובץ → Chrome שולח אותו ל־/share-file (sw.js) */
    fun handoffIntent(ctx: Context, u: Uri, id: String): Intent =
        Intent(ctx, MainActivity::class.java).setAction(Intent.ACTION_SEND).setType("video/*")
            .putExtra(Intent.EXTRA_STREAM, u).putExtra(Intent.EXTRA_TEXT, "snbdl:$id")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            .also { it.clipData = ClipData.newRawUri("", u) }

    /** שגיאה בהורדה → האתר מציג אותה (‎#dle=<מזהה>.<קוד>) */
    fun errIntent(ctx: Context, id: String, code: String): Intent =
        Intent(Intent.ACTION_VIEW, Uri.parse(ctx.getString(R.string.launchUrl) + "#dle=" + id + "." + code), ctx, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
