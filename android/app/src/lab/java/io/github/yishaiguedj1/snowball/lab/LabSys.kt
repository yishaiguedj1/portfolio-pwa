package io.github.yishaiguedj1.snowball.lab

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import java.io.File

/** Studio Lab — מה שהטלפון אומר על עצמו: זיכרון, ליבות, חום, סוללה. רק קריאה — שום הרשאה מיוחדת */
object LabSys {
    /** VmRSS / VmHWM של תהליך (KB) מ־/proc. תהליך ילד (ffmpeg) — לפי ה־pid שלו */
    fun statusKb(pid: Int, key: String): Long = try {
        File("/proc/$pid/status").readLines().firstOrNull { it.startsWith("$key:") }
            ?.split(Regex("\\s+"))?.getOrNull(1)?.toLong() ?: 0L
    } catch (e: Throwable) { 0L }

    fun selfRssKb(): Long = statusKb(android.os.Process.myPid(), "VmRSS")

    /** דגימה של השיא כל 250ms — VmHWM של התהליך לא מתאפס בין השלבים, לכן דוגמים בעצמנו */
    class Sampler(private val child: () -> Int = { 0 }) {
        @Volatile private var run = true
        @Volatile var peakSelfKb = 0L; private set
        @Volatile var peakChildKb = 0L; private set
        private val t = Thread {
            while (run) {
                peakSelfKb = maxOf(peakSelfKb, selfRssKb())
                val c = child(); if (c > 0) peakChildKb = maxOf(peakChildKb, statusKb(c, "VmRSS"))
                try { Thread.sleep(250) } catch (e: InterruptedException) { break }
            }
        }.apply { isDaemon = true; start() }
        fun stop(): Sampler { run = false; t.interrupt(); return this }
    }

    fun device(ctx: Context): String {
        val am = ctx.getSystemService(ActivityManager::class.java)
        val mi = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        val soc = if (Build.VERSION.SDK_INT >= 31) " · SoC ${Build.SOC_MANUFACTURER} ${Build.SOC_MODEL}" else ""
        return "${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})$soc · " +
            "RAM ${Fmt.mb(mi.totalMem)} (פנוי ${Fmt.mb(mi.availMem)}, סף לחץ ${Fmt.mb(mi.threshold)}) · ליבות ${Runtime.getRuntime().availableProcessors()} · " +
            "מחלקת זיכרון לאפליקציה ${am.memoryClass}MB/${am.largeMemoryClass}MB"
    }

    fun availMb(ctx: Context): Long {
        val am = ctx.getSystemService(ActivityManager::class.java)
        return ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }.availMem / 1048576
    }

    fun totalMb(ctx: Context): Long {
        val am = ctx.getSystemService(ActivityManager::class.java)
        return ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }.totalMem / 1048576
    }

    /** "חום: מצב 0 · מרווח 0.42 · סוללה 31.5° · 88% · בטעינה" */
    fun heat(ctx: Context): String {
        val pm = ctx.getSystemService(PowerManager::class.java)
        val st = pm.currentThermalStatus
        val head = if (Build.VERSION.SDK_INT >= 30) pm.getThermalHeadroom(10).let { if (it.isNaN()) "?" else Fmt.n(it.toDouble(), 2) } else "?"
        val b = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val temp = (b?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0) / 10.0
        val lvl = b?.let { it.getIntExtra(BatteryManager.EXTRA_LEVEL, 0) * 100 / maxOf(1, it.getIntExtra(BatteryManager.EXTRA_SCALE, 100)) } ?: 0
        val plug = (b?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0) != 0
        return "חום: מצב $st · מרווח $head · סוללה ${Fmt.n(temp)}° · $lvl%" + if (plug) " · בטעינה" else ""
    }
}
