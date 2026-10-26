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
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/*
 * רענון ווידג'ט מרכז הניהול. אנדרואיד לא מאפשר לווידג'ט להתעדכן כל כמה שניות. 26/10/2026 (בקשת המשתמש: "בתדירות הכי
 * גבוהה שאפשר") — כמו ווידג'ט Invest: כל ~דקה בהתראה לא־מעירה (RTC — רצה רק כשהמסך דלוק; במסך כבוי נדחית עד ההתעוררות,
 * ואז רענון מיד), ו־WorkManager כל 15 דק׳ כרשת ביטחון שגם שורדת הפעלה מחדש של הטלפון. מיד: ↻, שמירת טוקן, הוספת ווידג'ט,
 * חזרה מהאתר. השרת מדווח כל ~20 שנ׳, והשרתון שומר בזיכרון את בדיקת הטוקן — רענון כל דקה כמעט לא עולה קריאות.
 */
object MonRefresh {
    private const val NOW = "snowball-admin-now"
    private const val PERIODIC = "snowball-admin-periodic"
    private const val TICK_MS = 60_000L

    fun now(c: Context) {
        val req = OneTimeWorkRequestBuilder<MonRefreshWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(c).enqueueUniqueWork(NOW, ExistingWorkPolicy.REPLACE, req)
    }

    fun ensurePeriodic(c: Context) {
        val req = PeriodicWorkRequestBuilder<MonRefreshWorker>(15, TimeUnit.MINUTES)
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
        PendingIntent.getBroadcast(c, 2, Intent(c, MonTickReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    /** הדקה הבאה — חלון גמיש (בלי הרשאת "התראה מדויקת"); RTC ולא RTC_WAKEUP — לא מעיר טלפון ישן. רק כשיש ווידג'ט על המסך */
    private suspend fun scheduleNext(c: Context) {
        if (GlanceAppWidgetManager(c).getGlanceIds(MonWidget::class.java).isEmpty()) return
        val am = c.getSystemService(AlarmManager::class.java) ?: return
        am.setWindow(AlarmManager.RTC, System.currentTimeMillis() + TICK_MS, 15_000L, tickIntent(c))
    }

    /** שולף מהשרתון ושומר. כשל רשת / 5xx — נשאר הנתון האחרון עם השעה שלו (לא מתרוקן) */
    suspend fun run(c: Context) {
        val tok = MonStore.token(c)
        if (tok.isNotEmpty()) {
            when (val r = withContext(Dispatchers.IO) { MonApi.fetch(tok) }) {
                is MonApi.Res.Ok -> {
                    // "עודכן לפני…" לפי השעה של השרתון (now, שניות) — כשל רשת אחריו לא יראה נתון ישן כטרי
                    val at = MonParse.parse(r.json)?.now?.takeIf { it > 0L }?.times(1000L) ?: System.currentTimeMillis()
                    MonStore.saveModel(c, r.json, at)
                }
                MonApi.Res.NoAuth -> MonStore.setAuthBad(c)
                MonApi.Res.Fail -> Unit
            }
        }
        repaint(c)
        if (tok.isNotEmpty()) scheduleNext(c)
    }

    suspend fun repaint(c: Context) {
        val stamp = System.nanoTime()
        GlanceAppWidgetManager(c).getGlanceIds(MonWidget::class.java).forEach { id ->
            updateAppWidgetState(c, id) { it[MonWidget.KEY_STAMP] = stamp }
            MonWidget().update(c, id)
        }
    }
}

class MonRefreshWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        MonRefresh.run(applicationContext)
        return Result.success()   // בלי ניסיונות חוזרים: הרענון הבא מגיע לבד (בעוד דקה, או 15 דק׳)
    }
}

/** הדקה הבאה הגיעה (או המסך נדלק אחרי שהיא נדחתה) — רענון */
class MonTickReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { MonRefresh.now(context) }
}
