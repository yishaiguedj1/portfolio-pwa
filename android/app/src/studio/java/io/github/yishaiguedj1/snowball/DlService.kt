package io.github.yishaiguedj1.snowball

import android.app.Notification
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
 * 23/10/2026: מאנדרואיד 14 ההורדה רצה ב־DlJob (UIDT) — כאן רק אנדרואיד 10–13, וכפתור "ביטול" שבהתראה (בשניהם).
 * dataSync מוגבל ל־6 שעות ב־24 (targetSdk 35): onTimeout עוצר יפה, וההורדה ממשיכה בפעם הבאה מאותו מקום.
 * הורדה אחת בכל פעם. העבודה עצמה — DlWork.
 */
class DlService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
    @Volatile private var mine = false
    @Volatile private var timedOut = false

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val i = intent ?: return START_NOT_STICKY
        if (i.action == ACT_CANCEL) { DlState.id?.let { DlEngine.cancel(it) }; if (!mine) stopSelf(); return START_NOT_STICKY }
        val id = i.getStringExtra(X_ID) ?: return START_NOT_STICKY
        if (DlState.busy() && DlState.id != id) return START_NOT_STICKY   // הורדה אחת בכל פעם (המסך כבר סימן את זו)
        val r = reqOf(i) ?: return START_NOT_STICKY
        mine = true
        startFg(DlWork.progress(this, r.title, getString(R.string.dlPrep), -1))
        Thread {
            DlWork.run(this, r, { timedOut }) {
                mine = false
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }.start()
        return START_NOT_STICKY
    }

    /** אנדרואיד 15: נגמרה מכסת ה־6 שעות של dataSync — חייבים לעצור תוך שניות (אחרת קריסה) */
    override fun onTimeout(startId: Int, fgsType: Int) {
        timedOut = true
        DlState.id?.let { DlEngine.cancel(it) }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun startFg(n: android.app.Notification) {
        if (Build.VERSION.SDK_INT >= 29) startForeground(DlWork.N_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC) else startForeground(DlWork.N_ID, n)
    }

    companion object {
        const val ACT_CANCEL = "app.thesnowball.studio.DL_CANCEL"
        const val X_ID = "id"; const val X_URL = "u"; const val X_REF = "ref"; const val X_TITLE = "t"
        const val X_V = "v"; const val X_A = "a"; const val X_H = "h"; const val X_S0 = "s0"; const val X_S1 = "s1"; const val X_ONLY = "o"

        fun reqOf(i: Intent): DlWork.Req? {
            val id = i.getStringExtra(X_ID) ?: return null
            return DlWork.Req(id, i.getStringExtra(X_URL) ?: "", i.getStringExtra(X_REF) ?: "", i.getStringExtra(X_TITLE) ?: "",
                DlEngine.Pick(i.getStringExtra(X_V) ?: "", i.getStringExtra(X_A) ?: "", i.getIntExtra(X_H, 0), i.getIntExtra(X_S0, 0), i.getIntExtra(X_S1, 0)), i.getBooleanExtra(X_ONLY, false))
        }
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
    @Volatile var only = false; private set
    private val listeners = LinkedHashSet<() -> Unit>()
    private val main = Handler(Looper.getMainLooper())

    fun busy() = phase == "dl" || phase == "save"
    fun watched() = listeners.isNotEmpty()
    fun listen(l: () -> Unit) { listeners.add(l) }
    fun unlisten(l: () -> Unit) { listeners.remove(l) }
    private fun fire() { main.post { listeners.toList().forEach { it() } } }

    fun start(i: String, t: String, o: Boolean = false) { id = i; title = t; only = o; phase = "dl"; pct = 0f; uri = null; err = ""; fire() }
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

    /** "רק להוריד": פתיחת הסרטון שנשמר בנגן של הטלפון */
    fun viewIntent(u: Uri): Intent = Intent(Intent.ACTION_VIEW).setDataAndType(u, "video/*")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)

    /** שגיאה בהורדה → האתר מציג אותה (‎#dle=<מזהה>.<קוד>) */
    fun errIntent(ctx: Context, id: String, code: String): Intent =
        Intent(Intent.ACTION_VIEW, Uri.parse(ctx.getString(R.string.launchUrl) + "#dle=" + id + "." + code), ctx, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
