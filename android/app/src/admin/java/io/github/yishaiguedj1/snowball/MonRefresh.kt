package io.github.yishaiguedj1.snowball

import android.content.Context
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
 * רענון ווידג'ט מרכז הניהול. אנדרואיד לא מאפשר כל 2 שניות בווידג'ט — לכן: WorkManager כל 15 דק׳ (המינימום של המערכת),
 * ומיד ב־↻, אחרי שמירת טוקן/בדיקה, ובחזרה מהאתר למסך הבית (Flavor.onReturn). בלי טוקן — רק מצייר.
 */
object MonRefresh {
    private const val NOW = "snowball-admin-now"
    private const val PERIODIC = "snowball-admin-periodic"

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
        return Result.success()   // בלי ניסיונות חוזרים: הרענון הבא מגיע לבד (15 דק׳)
    }
}
