package io.github.yishaiguedj1.snowball.dm

import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Rational
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaController
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionToken
import androidx.media3.ui.PlayerView
import com.google.common.util.concurrent.ListenableFuture
import io.github.yishaiguedj1.snowball.R

/**
 * הנגן של Studio DM (24/10/2026; סבב 4, ‏36 — 02/11/2026). PlayerView של Media3: כתוביות שבתוך הקובץ, מהירות, רצועת קול.
 * סבב 4: הניגון בשירות (DmPlayback) — ממשיך ברקע ובמסך נעול, עם השליטה בהתראה ובמסך הנעילה; תמונה־בתוך־תמונה כשיוצאים
 * מסרטון שמתנגן; טיימר שינה; תור ניגון (כל הסרטונים/הקול שבספרייה); רשימת הפרקים. ממשיך מהמקום שבו עצרת (לכל קובץ).
 * רק content:// של ההורדות שלנו — לא מיוצא. צפייה תוך כדי הורדה (EXTRA_LIVE) — נגן מקומי, כמו קודם.
 */
class DmPlayer : ComponentActivity() {
    private var local: ExoPlayer? = null
    private var future: ListenableFuture<MediaController>? = null
    private var player: Player? = null
    private lateinit var uri: Uri
    private var view: PlayerView? = null
    private val ui = mutableStateOf(true)
    private val pip = mutableStateOf(false)
    private val dlg = mutableStateOf("")
    private val tick = mutableStateOf(0)

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        uri = intent.data ?: return finish()
        if (uri.scheme != "content") return finish()
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        val v = PlayerView(this).apply {
            setBackgroundColor(Color.BLACK)
            setShowSubtitleButton(true)
            keepScreenOn = true
            controllerAutoShow = true
            setControllerVisibilityListener(PlayerView.ControllerVisibilityListener { ui.value = it == android.view.View.VISIBLE })
        }
        view = v
        setContent { DmTheme { Overlay(v) } }
        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
        // 01/11/2026 (סבב 2): צפייה תוך כדי הורדה — הקובץ עוד נכתב: קוראים רק מה שירד (DmGrowSource), ומחכים לשאר
        val live = intent.getStringExtra(EXTRA_LIVE).orEmpty().takeIf { DmStore.get(it)?.let { t -> t.state != DmState.DONE && t.uri == uri.toString() } == true }
        if (live != null) {
            val p = ExoPlayer.Builder(this).build()
            local = p; player = p; v.player = p
            val item = MediaItem.Builder().setUri(uri).setMediaMetadata(MediaMetadata.Builder().setTitle(title).build()).build()
            p.setMediaSource(androidx.media3.exoplayer.source.ProgressiveMediaSource.Factory(DmGrowSource.Factory(this, live)).createMediaSource(item))
            p.prepare(); p.playWhenReady = true
            return
        }
        val f = MediaController.Builder(this, SessionToken(this, ComponentName(this, DmPlayback::class.java))).buildAsync()
        future = f
        f.addListener({ runCatching { f.get() }.getOrNull()?.let { setup(it, title) } }, ContextCompat.getMainExecutor(this))
    }

    /** התור: ההורדה שנפתחה, ואחריה (אם ביקשו) שאר הסרטונים/הקול שבספרייה. אותו קובץ שכבר מתנגן ברקע — ממשיכים בלי לאפס */
    private fun setup(c: MediaController, title: String) {
        player = c; view?.player = c
        c.addListener(object : Player.Listener {
            override fun onMediaItemTransition(m: MediaItem?, r: Int) { tick.value++ }
            override fun onPlaybackStateChanged(st: Int) { if (st == Player.STATE_ENDED) c.currentMediaItem?.let { forget(it) } }
        })
        if (c.currentMediaItem?.localConfiguration?.uri == uri || c.currentMediaItem?.mediaId == idOf(uri)) { c.play(); return }
        val ids = intent.getStringArrayExtra(EXTRA_QUEUE)?.toList().orEmpty()
        val tasks = ids.mapNotNull { DmStore.get(it) }.filter { it.state == DmState.DONE && it.uri.startsWith("content://") }
        val items = if (tasks.size > 1) tasks.map { item(Uri.parse(it.uri), it.id, it.title.ifEmpty { it.name }) }
            else listOf(item(uri, idOf(uri), title))
        val start = items.indexOfFirst { it.localConfiguration?.uri == uri }.coerceAtLeast(0)
        c.setMediaItems(items, start, prefs(this).getLong(key(items[start]), 0L))
        c.prepare(); c.play()
        tick.value++
    }

    private fun item(u: Uri, id: String, title: String) = MediaItem.Builder().setUri(u).setMediaId(id)
        .setMediaMetadata(MediaMetadata.Builder().setTitle(title).build()).build()

    private fun idOf(u: Uri) = DmStore.all().firstOrNull { it.uri == u.toString() }?.id ?: u.toString()
    private fun key(m: MediaItem) = "p:" + (m.localConfiguration?.uri ?: uri).toString().hashCode()
    private fun forget(m: MediaItem) = prefs(this).edit().remove(key(m)).apply()

    /** נשמר רק כשבאמצע (לא בשניות הראשונות, לא בסוף) */
    private fun savePos() {
        val p = player ?: return
        val m = p.currentMediaItem ?: return
        val pos = p.currentPosition; val dur = p.duration
        if (pos > 5000 && (dur <= 0 || pos < dur - 5000)) prefs(this).edit().putLong(key(m), pos).apply()
    }

    private fun isVideo() = player?.videoSize?.let { it.width > 0 && it.height > 0 } == true

    /** יציאה מסרטון שמתנגן — חלון צף (בלי הרשאה; המשתמש יכול לכבות בהגדרות של אנדרואיד) */
    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        val p = player ?: return
        if (!p.isPlaying || !isVideo()) return
        val vs = p.videoSize
        val r = Rational(vs.width, vs.height).let { if (it.toFloat() > 2.39f) Rational(239, 100) else if (it.toFloat() < 0.42f) Rational(42, 100) else it }
        runCatching { enterPictureInPictureMode(PictureInPictureParams.Builder().setAspectRatio(r).build()) }
    }

    override fun onPictureInPictureModeChanged(inPip: Boolean, cfg: Configuration) {
        super.onPictureInPictureModeChanged(inPip, cfg)
        pip.value = inPip
        view?.useController = !inPip
    }

    override fun onStop() {
        super.onStop()
        savePos()
        // הנגן המקומי (תוך כדי הורדה) נעצר; הנגן של השירות ממשיך ברקע (קול / מסך נעול) — עוצרים מההתראה
        local?.pause()
    }

    override fun onDestroy() {
        savePos()
        local?.release(); local = null
        future?.let { MediaController.releaseFuture(it) }; future = null
        player = null; view = null
        super.onDestroy()
    }

    @OptIn(ExperimentalLayoutApi::class)
    @androidx.compose.runtime.Composable
    private fun Overlay(v: PlayerView) {
        val g = LocalDmG.current
        Box(Modifier.fillMaxSize()) {
            AndroidView({ v }, Modifier.fillMaxSize())
            val show by ui; val inPip by pip
            tick.value.let { }
            if (show && !inPip && local == null) {
                val chaps = DmChap.parse(player?.currentMediaItem?.mediaId?.let { DmStore.get(it)?.chp })
                val n = player?.mediaItemCount ?: 0
                FlowRow(Modifier.statusBarsPadding().padding(12.dp).align(Alignment.TopEnd), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    val left = DmPlayback.sleepLeftMin()
                    GChip(left != 0L, { dlg.value = "sleep" }, { Text(if (left > 0) stringResource(R.string.dmSleepLeft, left) else if (left < 0) stringResource(R.string.dmSleepEnd) else stringResource(R.string.dmSleep)) })
                    if (chaps.isNotEmpty()) GChip(false, { dlg.value = "chap" }, { Text(stringResource(R.string.dmChapters)) })
                    if (n > 1) GChip(false, { dlg.value = "queue" }, { Text(stringResource(R.string.dmQueueList, n)) })
                }
            }
            when (dlg.value) {
                "sleep" -> AlertDialog(containerColor = g.dialog, shape = RoundedCornerShape(28.dp), onDismissRequest = { dlg.value = "" },
                    title = { Text(stringResource(R.string.dmSleep)) },
                    text = {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf(15L, 30L, 45L, 60L, 90L).forEach { m -> GChip(false, { DmPlayback.sleep(m); dlg.value = "" }, { Text(stringResource(R.string.dmSleepMin, m)) }) }
                            GChip(false, { DmPlayback.sleep(-1); dlg.value = "" }, { Text(stringResource(R.string.dmSleepEnd)) })
                            GChip(false, { DmPlayback.sleep(0); dlg.value = "" }, { Text(stringResource(R.string.dmSleepOff)) })
                        }
                    }, confirmButton = { TextButton({ dlg.value = "" }) { Text(stringResource(R.string.dmClose)) } })
                "chap" -> AlertDialog(containerColor = g.dialog, shape = RoundedCornerShape(28.dp), onDismissRequest = { dlg.value = "" },
                    title = { Text(stringResource(R.string.dmChapters)) },
                    text = {
                        Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
                            DmChap.parse(player?.currentMediaItem?.mediaId?.let { DmStore.get(it)?.chp }).forEach { c ->
                                Row(Modifier.fillMaxWidth().clickable { player?.seekTo(c.start * 1000L); dlg.value = "" }.padding(vertical = 10.dp)) {
                                    Text(DmClip.fmt(c.start), color = g.mute, modifier = Modifier.padding(end = 12.dp))
                                    Text(c.title, color = g.fg)
                                }
                            }
                        }
                    }, confirmButton = { TextButton({ dlg.value = "" }) { Text(stringResource(R.string.dmClose)) } })
                "queue" -> AlertDialog(containerColor = g.dialog, shape = RoundedCornerShape(28.dp), onDismissRequest = { dlg.value = "" },
                    title = { Text(stringResource(R.string.dmQueueList, player?.mediaItemCount ?: 0)) },
                    text = {
                        val p = player
                        Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
                            if (p != null) for (i in 0 until p.mediaItemCount) {
                                val cur = i == p.currentMediaItemIndex
                                Text(p.getMediaItemAt(i).mediaMetadata.title?.toString().orEmpty(), color = if (cur) StRed else g.fg,
                                    modifier = Modifier.fillMaxWidth().clickable { p.seekTo(i, 0); dlg.value = "" }.padding(vertical = 10.dp))
                            }
                        }
                    }, confirmButton = { TextButton({ dlg.value = "" }) { Text(stringResource(R.string.dmClose)) } })
            }
        }
    }

    companion object {
        const val EXTRA_TITLE = "snb_title"
        /** מזהה הורדה שעוד רצה — הנגן קורא מהקובץ שבכתיבה (רק מתוך האפליקציה; הפעילות לא מיוצאת) */
        const val EXTRA_LIVE = "snb_live"
        /** סבב 4 (36): תור ניגון — מזהי הורדות שהסתיימו, לפי הסדר */
        const val EXTRA_QUEUE = "snb_queue"
        private fun prefs(c: Context) = c.getSharedPreferences("dm-player", Context.MODE_PRIVATE)
    }
}

/**
 * סבב 4 (36): הניגון עצמו — שירות מדיה (Media3): ממשיך ברקע, השליטה בהתראה ובמסך הנעילה, אוזניות שהתנתקו → עצירה.
 * לא מיוצא לאפליקציות אחרות (רק DmPlayer מתחבר). טיימר השינה כאן — כדי שיעבוד גם כשהמסך כבוי.
 */
class DmPlayback : MediaSessionService() {
    private var session: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        val p = ExoPlayer.Builder(this).setAudioAttributes(AudioAttributes.DEFAULT, true).setHandleAudioBecomingNoisy(true).build()
        val open = PendingIntent.getActivity(this, 0, Intent(this, DmActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        session = MediaSession.Builder(this, p).setSessionActivity(open).build()
        me = this
    }

    override fun onGetSession(info: MediaSession.ControllerInfo): MediaSession? = session?.takeIf { info.packageName == packageName || info.packageName == "com.android.systemui" }

    override fun onTaskRemoved(i: Intent?) {
        val p = session?.player
        if (p == null || !p.playWhenReady || p.mediaItemCount == 0) stopSelf()
    }

    override fun onDestroy() {
        sleep(0)
        session?.run { player.release(); release() }
        session = null; me = null
        super.onDestroy()
    }

    companion object {
        @Volatile private var me: DmPlayback? = null
        private val h = Handler(Looper.getMainLooper())
        private var at = 0L
        private val r = Runnable { me?.session?.player?.pause(); at = 0 }

        /** דקות (0 = כבוי, ‎-1‎ = בסוף הפריט הנוכחי) */
        fun sleep(min: Long) {
            h.removeCallbacks(r)
            (me?.session?.player as? ExoPlayer)?.pauseAtEndOfMediaItems = min < 0
            at = when { min > 0 -> System.currentTimeMillis() + min * 60_000; min < 0 -> -1; else -> 0 }
            if (min > 0) h.postDelayed(r, min * 60_000)
        }

        /** כמה דקות נשארו (0 = כבוי, ‎-1‎ = בסוף הפריט) */
        fun sleepLeft(): Long = if (at < 0) -1 else if (at == 0L) 0 else ((at - System.currentTimeMillis()) / 60_000 + 1).coerceAtLeast(1)
        fun sleepLeftMin() = sleepLeft()
    }
}
