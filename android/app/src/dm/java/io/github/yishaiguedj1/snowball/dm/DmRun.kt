package io.github.yishaiguedj1.snowball.dm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import io.github.yishaiguedj1.snowball.R

/**
 * מה שמחזיק את התהליך חי בזמן הורדה (לפי המחקר — "אנדרואיד 14–16 מכתיב UIDT"):
 *  · אנדרואיד 14+: משימת העברה שהמשתמש התחיל (DmJob, UIDT) — בלי מגבלת 6 השעות של dataSync ובלי מכסות ה־jobs.
 *    אפשר לתזמן רק כשהאפליקציה גלויה; כשלא — נופלים לשירות.
 *  · מתחת ל־14 (ומקרה הנפילה): שירות בחזית dataSync (DmService) עם onTimeout שמחזיר הכל לתור.
 * המערכת עוצרת → DmEngine.stopAllSystem: ההתקדמות כבר שמורה, וההורדה ממשיכה מאותו בייט כשחוזרים.
 */
object DmRun {
    private const val JOB_ID = 5100

    fun ensure(ctx: Context) {
        if (Build.VERSION.SDK_INT >= 34 && DmJob.active) return
        if (DmService.active) return
        if (Build.VERSION.SDK_INT >= 34 && scheduleJob(ctx)) return
        runCatching { ctx.startForegroundService(Intent(ctx, DmService::class.java)) }
    }

    fun idle(ctx: Context) {
        DmJob.finish()
        if (DmService.active) runCatching { ctx.stopService(Intent(ctx, DmService::class.java)) }
    }

    private const val LATER_ID = 5101

    /** "אחר כך": משימת מערכת שרצה כשיש Wi‑Fi וטעינה (בפועל — בלילה). בלי הרשאת שעון מדויק. UIDT כשאפשר (אנדרואיד 14+,
     *  האפליקציה גלויה); אחרת משימה רגילה — חלון של כמה דקות, וההורדה ממשיכה מאותו בייט בפעם הבאה */
    fun scheduleLater(ctx: Context) {
        val js = ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
        if (js.getPendingJob(LATER_ID) != null) return
        fun build(ui: Boolean) = JobInfo.Builder(LATER_ID, ComponentName(ctx, DmJob::class.java)).apply {
            if (ui && Build.VERSION.SDK_INT >= 34) setUserInitiated(true)
            setRequiredNetworkType(JobInfo.NETWORK_TYPE_UNMETERED)
            setRequiresCharging(true)
            setPersisted(true)
        }.build()
        val ok = Build.VERSION.SDK_INT >= 34 && runCatching { js.schedule(build(true)) == JobScheduler.RESULT_SUCCESS }.getOrDefault(false)
        if (!ok) runCatching { js.schedule(build(false)) }
    }

    private fun scheduleJob(ctx: Context): Boolean {
        val info = JobInfo.Builder(JOB_ID, ComponentName(ctx, DmJob::class.java))
            .setUserInitiated(true)
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .build()
        return try {
            (ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler).schedule(info) == JobScheduler.RESULT_SUCCESS
        } catch (e: Throwable) { false }
    }
}

class DmJob : JobService() {
    override fun onStartJob(params: JobParameters): Boolean {
        current = this; currentParams = params; active = true
        // משימה רגילה ("אחר כך" בלי UIDT) — בלי התראה של משימה (רק ל־UIDT)
        if (Build.VERSION.SDK_INT >= 34 && params.isUserInitiatedJob) setNotification(params, DmNotif.N_RUN, DmNotif.running(this), JOB_END_NOTIFICATION_POLICY_REMOVE)
        DmEngine.pump(this)
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        active = false; current = null
        DmEngine.stopAllSystem()
        return true   // לתזמן שוב — ממשיכים מאותו בייט
    }

    companion object {
        @Volatile var active = false
        @Volatile private var current: DmJob? = null
        @Volatile private var currentParams: JobParameters? = null

        fun finish() {
            val j = current ?: return
            val p = currentParams ?: return
            active = false; current = null
            runCatching { j.jobFinished(p, false) }
        }

        fun refresh(ctx: Context) {
            val j = current ?: return; val p = currentParams ?: return
            if (Build.VERSION.SDK_INT >= 34) runCatching { j.setNotification(p, DmNotif.N_RUN, DmNotif.running(ctx), JOB_END_NOTIFICATION_POLICY_REMOVE) }
        }
    }
}

class DmService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        active = true
        val n = DmNotif.running(this)
        if (Build.VERSION.SDK_INT >= 34) startForeground(DmNotif.N_RUN, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        else startForeground(DmNotif.N_RUN, n)
        DmEngine.pump(this)
        return START_NOT_STICKY
    }

    /** אנדרואיד 15: נגמרו 6 השעות של dataSync — שומרים, מחזירים לתור, ועוצרים (חובה, אחרת קריסה) */
    override fun onTimeout(startId: Int, fgsType: Int) {
        DmEngine.stopAllSystem()
        DmNotif.waiting(this)
        stopSelf()
    }

    override fun onDestroy() { active = false; super.onDestroy() }

    companion object { @Volatile var active = false }
}

/** כפתור בהתראה (24/10): "לעצור הכל" — בלי לפתוח את האפליקציה. לא מיוצא — רק ההתראה שלנו שולחת אליו */
class DmAct : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        DmStore.init(ctx)
        if (intent.action == PAUSE_ALL) DmEngine.pauseAll(ctx)
    }
    companion object { const val PAUSE_ALL = "app.thesnowball.studiodm.PAUSE_ALL" }
}

/** אחרי אתחול: לא מתחילים ברקע (אנדרואיד 15 אוסר dataSync מ־BOOT_COMPLETED) — התראה "ממתינות", נגיעה = המשך */
class DmBoot : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        DmStore.init(ctx)
        if (DmEngine.hasWork()) DmNotif.waiting(ctx)
    }
}

object DmNotif {
    const val N_RUN = 51
    private const val N_WAIT = 52
    private const val CH = "dm"
    private const val CH_DONE = "dm_done"
    @Volatile private var lastUpd = 0L

    private fun nm(ctx: Context) = ctx.getSystemService(NotificationManager::class.java)

    private fun builder(ctx: Context, ch: String): Notification.Builder {
        nm(ctx).createNotificationChannel(NotificationChannel(CH, ctx.getString(R.string.dmChRun), NotificationManager.IMPORTANCE_LOW))
        nm(ctx).createNotificationChannel(NotificationChannel(CH_DONE, ctx.getString(R.string.dmChDone), NotificationManager.IMPORTANCE_DEFAULT))
        return Notification.Builder(ctx, ch)
    }

    private fun openApp(ctx: Context, req: Int = 0) = PendingIntent.getActivity(ctx, req,
        Intent(ctx, DmActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_IMMUTABLE)

    /** התראה אחת מקובצת לכל מה שרץ: "3 הורדות · 42%" */
    fun running(ctx0: Context): Notification {
        val ctx = DmLang.wrap(ctx0)   // השפה שנבחרה באפליקציה, לא של הטלפון
        val act = DmStore.all().filter { it.state == DmState.RUNNING }
        // 26/10/2026 (דיווח המשתמש: "בהתראה נשאר 0%"): האחוז = אותו של הפס באפליקציה (frac — גם בהורדה מיוטיוב, שבה
        // הבתים לא ידועים עד הסוף), ובהורדה אחת — אותה שורת מצב ("מכין את מנוע ההורדה…", "42 MB מתוך 158 MB · 3 MB/s")
        val fr = act.map { it.frac }
        val pct = if (act.isNotEmpty() && fr.all { it >= 0f }) {
            val tot = act.sumOf { it.total.coerceAtLeast(0) }
            if (act.size > 1 && act.all { it.total > 0 }) (act.sumOf { it.total * it.frac.toDouble() } * 100 / tot).toInt()
            else (fr.average() * 100).toInt()
        } else -1
        val title = if (act.size == 1) act[0].name.ifEmpty { act[0].title } else ctx.getString(R.string.dmNRunning, act.size)
        val sp = DmEngine.speed.values.sum()
        val txt = if (act.size == 1) DmFmt.line(ctx, act[0])
            else listOf(if (pct >= 0) "$pct%" else "", DmFmt.speed(ctx, sp)).filter { it.isNotEmpty() }.joinToString(" · ")
        return builder(ctx, CH).setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(title.ifEmpty { ctx.getString(R.string.app_name) })
            .setContentText(txt)
            .setOngoing(true).setOnlyAlertOnce(true).setContentIntent(openApp(ctx))
            .addAction(0, ctx.getString(R.string.dmPauseAll), PendingIntent.getBroadcast(ctx, 7, Intent(ctx, DmAct::class.java).setAction(DmAct.PAUSE_ALL), PendingIntent.FLAG_IMMUTABLE))
            .setProgress(100, pct.coerceAtLeast(0), pct < 0).build()
    }

    fun update(ctx: Context) {
        val now = System.currentTimeMillis()
        if (now - lastUpd < 900) return
        lastUpd = now
        if (DmStore.all().none { it.state == DmState.RUNNING }) return
        if (DmService.active) nm(ctx).notify(N_RUN, running(ctx))
        DmJob.refresh(ctx)
    }

    fun done(ctx0: Context, t: DmTask) {
        val ctx = DmLang.wrap(ctx0)   // השפה שנבחרה באפליקציה, לא של הטלפון
        val view = Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(t.uri), DmMedia.mimeFor(t.name, t.mime))
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        val pi = PendingIntent.getActivity(ctx, t.id.hashCode(), view, PendingIntent.FLAG_IMMUTABLE)
        val b = builder(ctx, CH_DONE).setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(ctx.getString(if (t.tr) R.string.dmDoneTrN else R.string.dmDoneN)).setContentText(t.name.ifEmpty { t.title })
            .setAutoCancel(true).setContentIntent(pi).setGroup("dm_done")
        // 24/10: סרטון + Studio מותקן — "לתרגם ב־Studio" בהתראה (וכשביקשו "להוריד ולתרגם" — זו הנגיעה הראשית)
        if (isVideo(t) && io.github.yishaiguedj1.snowball.AppRoute.studioInstalled(ctx)) {
            val tr = PendingIntent.getActivity(ctx, t.id.hashCode() + 1, studioSend(t), PendingIntent.FLAG_IMMUTABLE)
            b.addAction(Notification.Action.Builder(null, ctx.getString(R.string.dmTranslate), tr).build())
            if (t.tr) b.setContentIntent(tr)
        }
        nm(ctx).notify(t.id.hashCode(), b.build())
    }

    private fun isVideo(t: DmTask) = if (t.kind == DmKind.YTDL) !t.audioOnly else DmName.cat(t.name, t.mime) == DmName.Cat.VIDEO

    /** אותו Intent של AppRoute.fileToStudio — בתוך התראה (PendingIntent של DM מעביר את הרשאת הקריאה לקובץ) */
    fun studioSend(t: DmTask): Intent = Intent(Intent.ACTION_SEND).setType(DmMedia.mimeFor(t.name, t.mime).ifEmpty { "video/mp4" })
        .putExtra(Intent.EXTRA_STREAM, Uri.parse(t.uri)).putExtra(Intent.EXTRA_TEXT, t.title.ifEmpty { t.name }.take(200))
        .setPackage(io.github.yishaiguedj1.snowball.AppRoute.STUDIO_PKG)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)

    fun failed(ctx0: Context, t: DmTask) {
        val ctx = DmLang.wrap(ctx0)   // השפה שנבחרה באפליקציה, לא של הטלפון
        nm(ctx).notify(t.id.hashCode(), builder(ctx, CH_DONE).setSmallIcon(android.R.drawable.stat_notify_error)
            .setContentTitle(ctx.getString(R.string.dmFailedN)).setContentText(t.name.ifEmpty { t.title } + " · " + DmFmt.err(ctx, t.err))
            .setAutoCancel(true).setContentIntent(openApp(ctx, 3)).setGroup("dm_done").build())
    }

    fun waiting(ctx0: Context) {
        val ctx = DmLang.wrap(ctx0)   // השפה שנבחרה באפליקציה, לא של הטלפון
        nm(ctx).notify(N_WAIT, builder(ctx, CH_DONE).setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(ctx.getString(R.string.dmWaitingN)).setContentText(ctx.getString(R.string.dmWaitingS))
            .setAutoCancel(true).setContentIntent(openApp(ctx, 4)).build())
    }
}
