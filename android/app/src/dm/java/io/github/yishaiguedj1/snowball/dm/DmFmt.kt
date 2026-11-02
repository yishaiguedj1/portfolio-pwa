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
        "window" -> R.string.dmErrWindow      // 01/11/2026 (סבב 3): התור מחוץ לחלון הזמן שלו
        "quota" -> R.string.dmErrQuota        // נגמרה מכסת הנפח (יום/חודש)
        else -> R.string.dmErrFail
    })

    /** 01/11/2026 (DmHeat): למה ההורדה הואטה — ריק כשלא */
    fun heat(ctx: Context): String = when (DmEngine.heatWhy) {
        DmHeat.Why.NONE -> ""
        DmHeat.Why.HOT -> ctx.getString(R.string.dmHeatHot)
        DmHeat.Why.HEAT -> ctx.getString(R.string.dmHeatHeat)
        DmHeat.Why.BATTERY -> ctx.getString(R.string.dmHeatBatt)
        DmHeat.Why.SAVER -> ctx.getString(R.string.dmHeatSaver)
    }

    /** Last-Modified של HTTP → תאריך מקומי קצר (ריק כשלא מבין) */
    fun httpDate(s: String): String = runCatching {
        val d = java.text.SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.US).parse(s) ?: return ""
        java.text.DateFormat.getDateInstance(java.text.DateFormat.MEDIUM).format(d)
    }.getOrDefault("")

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
                // 26/10/2026 (בקשת המשתמש): האחוז תמיד ראשון — באפליקציה ובהתראה, מההתחלה ועד הסוף
                val f = t.frac
                val pc = if (f >= 0f) "${(f * 100).toInt()}%" else ""
                // לפני שהבתים מתחילים לזרום — מה קורה עכשיו, לא "0 B" קפוא
                if (stage != 0 && (got <= 0 || st != DmYt.Stage.CONN && st != DmYt.Stage.PREP)) return listOf(pc, ctx.getString(stage)).filter { it.isNotEmpty() }.joinToString(" · ")
                val sp = DmEngine.speed[t.id] ?: 0
                val eta = if (st != null) DmEngine.ytEta[t.id] ?: -1 else -1
                val l = if (eta >= 0) left(ctx, eta) else if (sp > 0 && tot > 0) left(ctx, (tot - got) / sp) else ""
                val slow = if (t.kind == DmKind.HTTP) heat(ctx) else ""
                // 01/11/2026 (סבב 2): כמה עבר בסלולר (Wi‑Fi וסלולר יחד)
                val cell = DmEngine.alt[t.id]?.takeIf { it > 0 }?.let { ctx.getString(R.string.dmBondLine, size(ctx, it)) } ?: ""
                listOf(pc, sz, speed(ctx, sp), l, slow, cell).filter { it.isNotEmpty() }.joinToString(" · ")
            }
            DmState.QUEUED -> ctx.getString(if (t.later && !DmEngine.laterReady) R.string.dmQueuedLater else R.string.dmQueued) + if (got > 0) " · $sz" else ""
            DmState.WAITING -> err(ctx, t.err)
            DmState.PAUSED -> ctx.getString(R.string.dmPaused) + " · " + sz
            DmState.FAILED -> if (DmAutoRefresh.busy(t.id)) ctx.getString(R.string.dmAutoRefreshing) else err(ctx, t.err)
            DmState.DONE -> size(ctx, tot)
        }
    }
}
