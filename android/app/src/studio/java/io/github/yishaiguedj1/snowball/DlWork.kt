package io.github.yishaiguedj1.snowball

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper

/**
 * 23/10/2026: העבודה של הורדה אחת — משותפת לשני המנגנונים שמריצים אותה:
 *  · DlJob (אנדרואיד 14+): משימת העברת נתונים שהמשתמש התחיל (UIDT) — הדרך ש־Google ממליצה עליה להורדה ארוכה.
 *    בלי מגבלת 6 השעות של dataSync (targetSdk 35) ובלי מכסות ה־jobs של אנדרואיד 16.
 *  · DlService (אנדרואיד 10–13): שירות בחזית מסוג dataSync, כמו קודם.
 * אם המערכת עוצרת באמצע — yt-dlp ממשיך מאותו מקום (‎--continue, הקובץ החלקי נשאר ב־dl/<מזהה>).
 */
object DlWork {
    const val N_ID = 41
    const val N_DONE = 42
    private const val CH = "dl"
    private val main = Handler(Looper.getMainLooper())

    /** שפות הכתוביות שנכנסות לקובץ (yt-dlp ‎--sub-langs‎; ‏iw = הקוד הישן של עברית ביוטיוב) */
    const val SUBS = "en,en-US,en-GB,he,iw"

    // only = "רק להוריד לטלפון" (23/10/2026, בקשת המשתמש): הקובץ נשאר ב־Movies/Studio ולא עובר לטופס התרגום
    data class Req(val id: String, val url: String, val ref: String, val title: String, val pick: DlEngine.Pick, val only: Boolean = false)

    /** ההורדה עצמה (בתהליכון של הקורא). done(true) = הסתיימה/נכשלה סופית; done(false) = נעצרה באמצע (להמשיך אחר כך) */
    fun run(ctx: Context, r: Req, stopped: () -> Boolean, done: (Boolean) -> Unit) {
        DlState.start(r.id, r.title, r.only)
        var last = 0L
        try {
            // 27/10/2026 (בקשת המשתמש): כתוביות היוצר (באנגלית ובעברית, לא האוטומטיות) בתוך הקובץ — הדף שולף את
            // האנגלית לעזר בהגהה (studio.js tracksFor), כמו בכל קובץ שיש בו כתוביות. כשל בכתוביות לא מפיל את ההורדה
            val f = DlEngine.download(ctx, r.url, r.ref, r.pick, r.id, "", subs = SUBS) { p, _ ->
                DlState.progress(p)
                val now = System.currentTimeMillis()
                if (now - last > 1000) { last = now; nm(ctx).notify(N_ID, progress(ctx, r.title, DlLang.of(ctx).getString(R.string.dlPct, p.toInt().coerceIn(0, 100)), p.toInt())) }
            }
            DlState.phase("save")
            nm(ctx).notify(N_ID, progress(ctx, r.title, DlLang.of(ctx).getString(R.string.dlSaving), -1))
            val uri = DlEngine.publish(ctx, f)
            main.post {
                DlState.done(uri)
                if (!DlState.watched()) nm(ctx).notify(N_DONE, if (r.only) savedNotif(ctx, r.title, uri) else doneNotif(ctx, r.title, uri, r.id))
                done(true)
            }
        } catch (e: Throwable) {
            val code = (e as? IllegalArgumentException)?.message ?: "fail"
            main.post {
                if (stopped()) { done(false); return@post }   // המערכת עצרה — לא שגיאה; ממשיכים כשהיא מחזירה
                DlState.fail(code)
                if (code != "cancel" && !DlState.watched()) nm(ctx).notify(N_DONE, errNotif(ctx, r.title, r.id, code))
                done(true)
            }
        }
    }

    fun nm(ctx: Context) = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private fun builder(ctx: Context): Notification.Builder {
        if (Build.VERSION.SDK_INT >= 26) nm(ctx).createNotificationChannel(NotificationChannel(CH, DlLang.of(ctx).getString(R.string.dlChannel), NotificationManager.IMPORTANCE_LOW))
        return if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CH) else Notification.Builder(ctx)
    }

    fun progress(ctx: Context, title: String, text: String, pct: Int): Notification {
        val open = PendingIntent.getActivity(ctx, 1, Intent(ctx, DlActivity::class.java).setAction(DlActivity.ACT_SHOW), PendingIntent.FLAG_IMMUTABLE)
        val cancel = PendingIntent.getService(ctx, 2, Intent(ctx, DlService::class.java).setAction(DlService.ACT_CANCEL), PendingIntent.FLAG_IMMUTABLE)
        return builder(ctx).setSmallIcon(android.R.drawable.stat_sys_download).setContentTitle(title.ifEmpty { DlLang.of(ctx).getString(R.string.dlTitle) })
            .setContentText(text).setOngoing(true).setOnlyAlertOnce(true).setContentIntent(open)
            .setProgress(100, pct.coerceAtLeast(0), pct < 0)
            .addAction(Notification.Action.Builder(null, DlLang.of(ctx).getString(R.string.dlCancel), cancel).build()).build()
    }

    private fun doneNotif(ctx: Context, title: String, uri: Uri, id: String): Notification {
        val pi = PendingIntent.getActivity(ctx, 3, DlState.handoffIntent(ctx, uri, id), PendingIntent.FLAG_IMMUTABLE)
        return builder(ctx).setSmallIcon(android.R.drawable.stat_sys_download_done).setContentTitle(DlLang.of(ctx).getString(R.string.dlDone))
            .setContentText(title.ifEmpty { DlLang.of(ctx).getString(R.string.dlTapContinue) }).setSubText(DlLang.of(ctx).getString(R.string.dlTapContinue))
            .setAutoCancel(true).setContentIntent(pi).build()
    }

    /* "רק להוריד": נגיעה בהתראה פותחת את הסרטון בנגן של הטלפון */
    private fun savedNotif(ctx: Context, title: String, uri: Uri): Notification {
        // 23/10/2026: איפה הקובץ — בטקסט (אלבום Studio בגלריה), ופעולות "פתיחה" ו"שיתוף" ישר מההתראה
        val pi = PendingIntent.getActivity(ctx, 5, DlState.viewIntent(uri), PendingIntent.FLAG_IMMUTABLE)
        val share = PendingIntent.getActivity(ctx, 6, DlState.shareIntent(ctx, uri), PendingIntent.FLAG_IMMUTABLE)
        return builder(ctx).setSmallIcon(android.R.drawable.stat_sys_download_done).setContentTitle(DlLang.of(ctx).getString(R.string.dlSaved))
            .setContentText(title.ifEmpty { DlLang.of(ctx).getString(R.string.dlSavedS) })
            .setStyle(Notification.BigTextStyle().bigText((if (title.isEmpty()) "" else title + "\n") + DlLang.of(ctx).getString(R.string.dlSavedS)))
            .addAction(Notification.Action.Builder(null, DlLang.of(ctx).getString(R.string.dlOpen), pi).build())
            .addAction(Notification.Action.Builder(null, DlLang.of(ctx).getString(R.string.dlShare), share).build())
            .setAutoCancel(true).setContentIntent(pi).build()
    }

    private fun errNotif(ctx: Context, title: String, id: String, code: String): Notification {
        val pi = PendingIntent.getActivity(ctx, 4, DlState.errIntent(ctx, id, code), PendingIntent.FLAG_IMMUTABLE)
        return builder(ctx).setSmallIcon(android.R.drawable.stat_notify_error).setContentTitle(DlLang.of(ctx).getString(R.string.dlFailed))
            .setContentText(title).setAutoCancel(true).setContentIntent(pi).build()
    }
}
