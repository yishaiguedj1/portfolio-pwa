package io.github.yishaiguedj1.snowball.dm

import android.content.Context
import io.github.yishaiguedj1.snowball.R
import java.util.Locale

/** מספרים וטקסטים לממשק — גודל, מהירות, זמן, וקוד תקלה → משפט */
object DmFmt {
    fun size(ctx: Context, b: Long): String {
        if (b < 0) return ctx.getString(R.string.dmSizeUnknown)
        val u = listOf("B", "KB", "MB", "GB", "TB")
        var v = b.toDouble(); var i = 0
        while (v >= 1024 && i < u.size - 1) { v /= 1024; i++ }
        return if (i == 0) "${b} B" else String.format(Locale.US, if (v >= 100) "%.0f %s" else "%.1f %s", v, u[i])
    }

    fun speed(ctx: Context, bps: Long): String = if (bps <= 0) "" else size(ctx, bps) + "/s"

    fun left(ctx: Context, sec: Long): String = when {
        sec < 0 -> ""
        sec < 60 -> ctx.getString(R.string.dmLeftS, sec)
        sec < 3600 -> ctx.getString(R.string.dmLeftM, sec / 60)
        else -> ctx.getString(R.string.dmLeftH, sec / 3600, (sec % 3600) / 60)
    }

    fun err(ctx: Context, code: String): String = ctx.getString(when (code) {
        "net" -> R.string.dmErrNet
        "wifi" -> R.string.dmErrWifi
        "expired" -> R.string.dmErrExpired
        "http_404" -> R.string.dmErr404
        "space" -> R.string.dmErrSpace
        "ssl" -> R.string.dmErrSsl
        "changed" -> R.string.dmErrChanged
        "page" -> R.string.dmErrPage
        "drm" -> R.string.dmErrDrm
        "blocked" -> R.string.dmErrBlocked
        "private", "login" -> R.string.dmErrLogin
        "unavailable", "geo" -> R.string.dmErrUnavail
        "live" -> R.string.dmErrLive
        "playlist" -> R.string.dmErrPlaylist
        "unsupported", "no_video" -> R.string.dmErrNoVideo
        "refresh_size" -> R.string.dmErrRefreshSize
        "refresh_kind" -> R.string.dmErrRefreshKind
        else -> R.string.dmErrFail
    })

    /** שורת המצב של הורדה */
    fun line(ctx: Context, t: DmTask): String {
        val got = t.got; val tot = t.total
        val sz = if (tot > 0) ctx.getString(R.string.dmOf, size(ctx, got), size(ctx, tot)) else size(ctx, got.coerceAtLeast(0))
        return when (t.state) {
            DmState.RUNNING -> {
                val st = if (t.kind == DmKind.YTDL) DmEngine.ytStage[t.id] else null
                val stage = when (st) {
                    DmYt.Stage.PREP -> R.string.dmStPrep
                    DmYt.Stage.CONN -> R.string.dmStConn
                    DmYt.Stage.RETRY -> R.string.dmStRetry
                    DmYt.Stage.MERGE -> R.string.dmStMerge
                    DmYt.Stage.POST -> R.string.dmStPost
                    else -> 0
                }
                // לפני שהבתים מתחילים לזרום — מה קורה עכשיו, לא "0 B" קפוא
                if (stage != 0 && (got <= 0 || st != DmYt.Stage.CONN && st != DmYt.Stage.PREP)) return ctx.getString(stage)
                val sp = DmEngine.speed[t.id] ?: 0
                val eta = if (st != null) DmEngine.ytEta[t.id] ?: -1 else -1
                val l = if (eta >= 0) left(ctx, eta) else if (sp > 0 && tot > 0) left(ctx, (tot - got) / sp) else ""
                listOf(sz, speed(ctx, sp), l).filter { it.isNotEmpty() }.joinToString(" · ")
            }
            DmState.QUEUED -> ctx.getString(R.string.dmQueued) + if (got > 0) " · $sz" else ""
            DmState.WAITING -> err(ctx, t.err)
            DmState.PAUSED -> ctx.getString(R.string.dmPaused) + " · " + sz
            DmState.FAILED -> err(ctx, t.err)
            DmState.DONE -> size(ctx, tot)
        }
    }
}
