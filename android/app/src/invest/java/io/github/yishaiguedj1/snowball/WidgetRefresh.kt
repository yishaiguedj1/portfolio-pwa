package io.github.yishaiguedj1.snowball

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/**
 * רענון הווידג'ט. אנדרואיד לא מאפשר לווידג'ט להתעדכן כל 2 שניות ברקע, אז:
 *  • כשהמחיר זז (מסחר רגיל/טרום/אחרי/לילי): כל ~דקה — התראה לא־מעירה (RTC): רצה רק כשהטלפון ער (מסך דלוק),
 *    ובמסך כבוי נדחית עד ההתעוררות → רענון מיד כשפותחים את הטלפון.
 *  • שוק סגור: כל 15 דקות. וגם WorkManager תקופתי (15 דק׳) כרשת ביטחון — שורד הפעלה מחדש של הטלפון.
 *  • מיד: ↻, סנכרון רשימה מהאפליקציה, הוספת ווידג'ט, פתיחה/סגירה של האפליקציה.
 * כל רענון = בקשה אחת לשרתון לכל התיק (לא בקשה לכל מניה — לקח v164).
 */
object WidgetRefresh {
    private const val NOW = "snowball-now"
    private const val PERIODIC = "snowball-periodic"
    private const val ACTIVE_MS = 60_000L
    private const val IDLE_MS = 15 * 60_000L

    fun now(c: Context) {
        val req = OneTimeWorkRequestBuilder<RefreshWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(c).enqueueUniqueWork(NOW, ExistingWorkPolicy.REPLACE, req)
    }

    fun ensurePeriodic(c: Context) {
        val req = PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, req)
    }

    fun stopAll(c: Context) {
        WorkManager.getInstance(c).cancelUniqueWork(PERIODIC)
        WorkManager.getInstance(c).cancelUniqueWork(NOW)
        c.getSystemService(AlarmManager::class.java)?.cancel(tickIntent(c))
    }

    private fun tickIntent(c: Context): PendingIntent =
        PendingIntent.getBroadcast(c, 1, Intent(c, TickReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun scheduleNext(c: Context, active: Boolean) {
        val am = c.getSystemService(AlarmManager::class.java) ?: return
        val delay = if (active) ACTIVE_MS else IDLE_MS
        // חלון גמיש (בלי הרשאת "התראה מדויקת"); RTC ולא RTC_WAKEUP — לא מעיר טלפון ישן
        am.setWindow(AlarmManager.RTC, System.currentTimeMillis() + delay, if (active) 15_000L else 5 * 60_000L, tickIntent(c))
    }

    /** שולף את המודל מהשרתון, שומר, ומעדכן את כל הווידג'טים. בלי רשימה — רק מצייר (מסך "פתח את האפליקציה") */
    suspend fun run(c: Context): Boolean {
        val s = WidgetStore.items(c)
        var ok = true
        var active = false
        if (s.isNotEmpty()) {
            val json = withContext(Dispatchers.IO) { fetch(s, WidgetStore.lang(c)) }
            val model = WidgetModel.parse(json)
            if (json != null && model != null) {
                WidgetStore.saveModel(c, json, System.currentTimeMillis())
                LogoCache.warm(c, model.rows)
                active = model.rows.any { it.active }
            } else ok = false
        }
        // v249: ווידג'ט "רשימות מעקב" — בקשה לכל רשימה (במקביל), רק כשיש ווידג'ט כזה על המסך
        val lists = WidgetStore.watchLists(c)
        val hasWatch = GlanceAppWidgetManager(c).getGlanceIds(SnowballWatchWidget::class.java).isNotEmpty()
        if (hasWatch && lists.isNotEmpty()) {
            val lang = WidgetStore.lang(c)
            val res = coroutineScope { lists.map { l -> async(Dispatchers.IO) { l to fetch(l.items, lang) } }.awaitAll() }
            for ((l, json) in res) {
                val m = WidgetModel.parse(json)
                if (json != null && m != null) {
                    WidgetStore.saveWatchModel(c, l.id, json)
                    LogoCache.warm(c, m.rows)
                    if (m.rows.any { it.active }) active = true
                } else ok = false
            }
            WidgetStore.saveWatchTime(c, System.currentTimeMillis())
        }
        repaint(c)
        if (s.isNotEmpty() || lists.isNotEmpty()) scheduleNext(c, active)
        return ok
    }

    suspend fun repaint(c: Context) {
        val stamp = System.nanoTime()
        GlanceAppWidgetManager(c).getGlanceIds(SnowballWidget::class.java).forEach { id ->
            updateAppWidgetState(c, id) { it[SnowballWidget.KEY_STAMP] = stamp }
            SnowballWidget().update(c, id)
        }
        GlanceAppWidgetManager(c).getGlanceIds(SnowballWatchWidget::class.java).forEach { id ->
            updateAppWidgetState(c, id) { it[SnowballWidget.KEY_STAMP] = stamp }
            SnowballWatchWidget().update(c, id)
        }
    }

    private fun fetch(s: String, l: String): String? {
        val url = WidgetStore.PROXY + "/api/widget?format=json&l=" + l + "&s=" + URLEncoder.encode(s, "UTF-8")
        val conn = URL(url).openConnection() as HttpURLConnection
        return try {
            conn.connectTimeout = 10_000
            conn.readTimeout = 20_000
            conn.setRequestProperty("Accept", "application/json")
            if (conn.responseCode == 200) conn.inputStream.use { it.readBytes().toString(Charsets.UTF_8) } else null
        } catch (e: Exception) { null } finally { conn.disconnect() }
    }
}

class RefreshWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = if (WidgetRefresh.run(applicationContext) || runAttemptCount >= 2) Result.success() else Result.retry()
}

class TickReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { WidgetRefresh.now(context) }
}
