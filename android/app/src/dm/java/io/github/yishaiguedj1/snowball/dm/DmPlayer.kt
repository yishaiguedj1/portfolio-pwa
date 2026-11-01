package io.github.yishaiguedj1.snowball.dm

import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

/**
 * הנגן של Studio DM (24/10/2026, מפת המסכים בדוח: "נגן מסך מלא (Media3), מהירות, כתוביות"): סרטון וקול שירדו נפתחים כאן ולא
 * באפליקציה אחרת. PlayerView של Media3 נותן לבד את כפתור הכתוביות (רצועות שבתוך הקובץ — "עם כתוביות"), מהירות ורצועת קול.
 * ממשיך מהמקום שבו עצרת (לכל קובץ), המסך דלוק בזמן ניגון, בלי שורות מערכת. רק content:// של ההורדות שלנו — לא מיוצא.
 */
class DmPlayer : Activity() {
    private var player: ExoPlayer? = null
    private lateinit var uri: Uri

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
        val view = PlayerView(this).apply {
            setBackgroundColor(Color.BLACK)
            setShowSubtitleButton(true)
            setShowNextButton(false); setShowPreviousButton(false)
            keepScreenOn = true
            controllerAutoShow = true
        }
        setContentView(view)
        val p = ExoPlayer.Builder(this).build()
        player = p
        view.player = p
        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
        val item = MediaItem.Builder().setUri(uri).setMediaMetadata(MediaMetadata.Builder().setTitle(title).build()).build()
        // 01/11/2026 (סבב 2): צפייה תוך כדי הורדה — הקובץ עוד נכתב: קוראים רק מה שירד (DmGrowSource), ומחכים לשאר
        val live = intent.getStringExtra(EXTRA_LIVE).orEmpty().takeIf { DmStore.get(it)?.let { t -> t.state != DmState.DONE && t.uri == uri.toString() } == true }
        if (live != null) p.setMediaSource(androidx.media3.exoplayer.source.ProgressiveMediaSource.Factory(DmGrowSource.Factory(this, live)).createMediaSource(item))
        else p.setMediaItem(item)
        val at = prefs(this).getLong(key(), 0L)
        if (at > 0) p.seekTo(at)
        p.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(st: Int) { if (st == Player.STATE_ENDED) prefs(this@DmPlayer).edit().remove(key()).apply() }
        })
        p.prepare(); p.playWhenReady = true
    }

    private fun key() = "p:" + uri.toString().hashCode()

    override fun onPause() {
        super.onPause()
        player?.let { p ->
            p.pause()
            val pos = p.currentPosition; val dur = p.duration
            // נשמר רק כשבאמצע (לא בשניות הראשונות, לא בסוף)
            if (pos > 5000 && (dur <= 0 || pos < dur - 5000)) prefs(this).edit().putLong(key(), pos).apply()
        }
    }

    override fun onDestroy() { player?.release(); player = null; super.onDestroy() }

    companion object {
        const val EXTRA_TITLE = "snb_title"
        /** מזהה הורדה שעוד רצה — הנגן קורא מהקובץ שבכתיבה (רק מתוך האפליקציה; הפעילות לא מיוצאת) */
        const val EXTRA_LIVE = "snb_live"
        private fun prefs(c: Context) = c.getSharedPreferences("dm-player", Context.MODE_PRIVATE)
    }
}
