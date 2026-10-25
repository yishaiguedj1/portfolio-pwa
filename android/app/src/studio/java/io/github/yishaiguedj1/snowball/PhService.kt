package io.github.yishaiguedj1.snowball

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * 24/10/2026 — תרגום בטלפון: העבודה בטלפון כשירות בחזית (התראה עם התקדמות) — ממשיכה כשעוברים לאפליקציה אחרת, ומשאירה
 * את Studio חופשי. ההעלאה = dataSync; הצריבה = mediaProcessing מאנדרואיד 15 (המקודד והפענוח — עיבוד מדיה), dataSync לפניו.
 * עבודה אחת בכל פעם. נעצר באמצע (המשתמש / onTimeout) — הרשומה זוכרת את השלב, ו"להמשיך" מתחיל משם.
 */
class PhService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
    @Volatile private var stop = false

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val i = intent ?: return START_NOT_STICKY
        if (i.action == ACT_CANCEL) { stop = true; PhFf.cancel(); PhPy.cancel(); if (!busy) stopSelf(); return START_NOT_STICKY }
        val pid = i.getStringExtra(X_PID) ?: return START_NOT_STICKY
        val burn = i.action == ACT_BURN
        if (busy) return START_NOT_STICKY
        busy = true; stop = false
        val title = PhStore.get(this, pid)?.optString("name") ?: ""
        val n = PhWork.progress(this, title, PhWork.s(this, if (burn) R.string.phBurnPrep else R.string.phPrep), -1f)
        val type = if (burn && Build.VERSION.SDK_INT >= 35) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING else ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        startForeground(PhWork.N_ID, n, type)
        Thread {
            try { if (burn) PhWork.burn(this, pid) { stop } else PhWork.up(this, pid) { stop } }
            finally {
                busy = false
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }.start()
        return START_NOT_STICKY
    }

    /** אנדרואיד 15: נגמרה המכסה של סוג השירות — עוצרים מיד (הרשומה זוכרת את השלב) */
    override fun onTimeout(startId: Int, fgsType: Int) {
        stop = true; PhFf.cancel(); PhPy.cancel()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    companion object {
        const val ACT_UP = "app.thesnowball.studio.PH_UP"
        const val ACT_BURN = "app.thesnowball.studio.PH_BURN"
        const val ACT_CANCEL = "app.thesnowball.studio.PH_CANCEL"
        const val X_PID = "pid"
        @Volatile var busy = false; private set

        fun start(ctx: Context, pid: String, burn: Boolean) {
            ctx.startForegroundService(Intent(ctx, PhService::class.java).setAction(if (burn) ACT_BURN else ACT_UP).putExtra(X_PID, pid))
        }
    }
}
