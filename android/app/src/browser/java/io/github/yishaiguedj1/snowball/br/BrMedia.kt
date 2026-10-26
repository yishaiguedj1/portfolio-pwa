package io.github.yishaiguedj1.snowball.br

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.IBinder
import io.github.yishaiguedj1.snowball.R

/**
 * 26/10/2026 (Studio Browser שלב 3 — "וידאו ברקע ובמסך נעול"): כשיוצאים מהדפדפן בזמן שסרטון או שיר מתנגנים, הניגון
 * ממשיך — שירות בחזית מסוג mediaPlayback (אחרת אנדרואיד עוצר את התהליך), עם MediaSession של המערכת: ההתראה, מסך הנעילה
 * ואוזניות Bluetooth מקבלים "השהיה"/"המשך". הפקודות עוברות לדף כ־JavaScript (BrShield.PAUSE_JS/RESUME_JS) דרך
 * BrowserActivity. כשחוזרים לדפדפן — השירות נעצר. אין כאן שום רשת: רק השם של הדף והאתר.
 */
object BrMedia {
    const val CH = "br-media"
    const val N_ID = 7401
    private const val ACT_PAUSE = "br.pause"
    private const val ACT_PLAY = "br.play"
    private const val ACT_STOP = "br.stop"

    @Volatile var title = ""
    @Volatile var host = ""
    @Volatile var playing = false
    /** הדפדפן מאזין: true = להמשיך, false = להשהות, null = לעצור (סגירת ההתראה) */
    var onCmd: ((Boolean?) -> Unit)? = null
    private var session: MediaSession? = null
    @Volatile var running = false

    fun start(ctx: Context, title: String, host: String) {
        this.title = title; this.host = host; playing = true
        runCatching { ctx.startForegroundService(Intent(ctx, BrMediaService::class.java)) }
    }

    fun stop(ctx: Context) {
        if (!running) return
        runCatching { ctx.stopService(Intent(ctx, BrMediaService::class.java)) }
    }

    /** הדף דיווח שהניגון נעצר / חזר (גם כשעצרת מהאוזניות) */
    fun state(ctx: Context, p: Boolean) {
        if (!running || p == playing) return
        playing = p
        show(ctx)
    }

    internal fun cmd(ctx: Context, action: String?) {
        when (action) {
            ACT_PAUSE -> { playing = false; onCmd?.invoke(false) }
            ACT_PLAY -> { playing = true; onCmd?.invoke(true) }
            ACT_STOP -> { playing = false; onCmd?.invoke(null); stop(ctx); return }
            else -> return
        }
        show(ctx)
    }

    internal fun open(ctx: Context): Notification {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm?.createNotificationChannel(NotificationChannel(CH, ctx.getString(R.string.brChMedia), NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        val s = session ?: MediaSession(ctx, "studio-browser").also { session = it }
        s.setCallback(object : MediaSession.Callback() {
            override fun onPlay() = cmd(ctx, ACT_PLAY)
            override fun onPause() = cmd(ctx, ACT_PAUSE)
            override fun onStop() = cmd(ctx, ACT_STOP)
        })
        s.isActive = true
        return build(ctx, s)
    }

    internal fun close() {
        runCatching { session?.isActive = false; session?.release() }
        session = null
    }

    private fun show(ctx: Context) {
        val s = session ?: return
        runCatching { ctx.getSystemService(NotificationManager::class.java)?.notify(N_ID, build(ctx, s)) }
    }

    private fun pi(ctx: Context, a: String, rc: Int) =
        PendingIntent.getService(ctx, rc, Intent(ctx, BrMediaService::class.java).setAction(a), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private fun build(ctx: Context, s: MediaSession): Notification {
        val t = title.ifEmpty { host }
        s.setMetadata(MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE, t).putString(MediaMetadata.METADATA_KEY_ARTIST, host).build())
        s.setPlaybackState(PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_STOP)
            .setState(if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f).build())
        val open = PendingIntent.getActivity(ctx, 1, Intent(ctx, BrowserActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val toggle = if (playing) Notification.Action.Builder(android.graphics.drawable.Icon.createWithResource(ctx, android.R.drawable.ic_media_pause), ctx.getString(R.string.brPause), pi(ctx, ACT_PAUSE, 2)).build()
            else Notification.Action.Builder(android.graphics.drawable.Icon.createWithResource(ctx, android.R.drawable.ic_media_play), ctx.getString(R.string.brPlay), pi(ctx, ACT_PLAY, 3)).build()
        val stop = Notification.Action.Builder(android.graphics.drawable.Icon.createWithResource(ctx, android.R.drawable.ic_menu_close_clear_cancel), ctx.getString(R.string.brClose), pi(ctx, ACT_STOP, 4)).build()
        return Notification.Builder(ctx, CH)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(t).setContentText(host)
            .setContentIntent(open)
            .setDeleteIntent(pi(ctx, ACT_STOP, 5))
            .setOngoing(playing)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(toggle).addAction(stop)
            .setStyle(Notification.MediaStyle().setMediaSession(s.sessionToken).setShowActionsInCompactView(0, 1))
            .build()
    }
}

/** השירות בחזית של הניגון ברקע — לא מיוצא; רק BrowserActivity וההתראה שלנו מפעילים אותו */
class BrMediaService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action != null && BrMedia.running) { BrMedia.cmd(this, intent.action); return START_NOT_STICKY }
        if (intent?.action != null) { stopSelf(); return START_NOT_STICKY }   // פקודה מהתראה ישנה אחרי שהשירות נעצר
        val n = BrMedia.open(this)
        if (Build.VERSION.SDK_INT >= 29) startForeground(BrMedia.N_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK) else startForeground(BrMedia.N_ID, n)
        BrMedia.running = true
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        BrMedia.running = false
        BrMedia.close()
        super.onDestroy()
    }
}
