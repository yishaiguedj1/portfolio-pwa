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
        if (i.action == ACT_VCANCEL) { PhWork.vCancel = true; if (!busy) stopSelf(); return START_NOT_STICKY }   // רק הסרטון לענן
        if (i.action == ACT_CANCEL) { stop = true; PhFf.cancel(); PhPy.cancel(); if (!busy) stopSelf(); return START_NOT_STICKY }
        val burn = i.action == ACT_BURN
        // 20/11/2026: תור עבודות — הקול של כל עבודה עולה אחרי הקודמת. עבודה שנוספה בזמן שאחרת רצה — נכנסת לתור (q)
        val pid: String
        synchronized(q) {
            if (!burn) for (p in (i.getStringArrayListExtra(X_PIDS) ?: arrayListOf(i.getStringExtra(X_PID) ?: ""))) if (p.isNotEmpty() && p !in q) q.add(p)
            if (busy) {   // כבר רץ: startForegroundService מחייב startForeground גם כאן (אחרת אנדרואיד סוגר את האפליקציה)
                startForeground(PhWork.N_ID, PhWork.progress(this, "", PhWork.s(this, R.string.phPrep), -1f), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
                return START_NOT_STICKY
            }
            pid = if (burn) i.getStringExtra(X_PID) ?: return START_NOT_STICKY else q.poll() ?: return START_NOT_STICKY
            busy = true; stop = false
        }
        val title = PhStore.get(this, pid)?.optString("name") ?: ""
        val n = PhWork.progress(this, title, PhWork.s(this, if (burn) R.string.phBurnPrep else R.string.phPrep), -1f)
        val type = if (burn && Build.VERSION.SDK_INT >= 35) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING else ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        startForeground(PhWork.N_ID, n, type)
        Thread {
            try {
                if (burn) PhWork.burn(this, pid) { stop }
                else {
                    var cur: String? = pid
                    while (cur != null && !stop) {
                        val p = cur
                        PhWork.up(this, p) { stop }
                        // 29/10/2026: הסרטון לענן — כשאין UIDT (מתחת לאנדרואיד 14) הוא עולה כאן, באותו שירות, אחרי הקול
                        val r = PhStore.get(this, p)
                        if (!stop && r != null && r.optBoolean("vc") && !r.optBoolean("vJob")) {
                            PhWork.video(this, p, { stop }) { n -> PhWork.nm(this).notify(PhWork.N_VID, n) }
                            PhWork.nm(this).cancel(PhWork.N_VID)
                        }
                        cur = synchronized(q) { q.poll() }
                    }
                }
            }
            finally {
                synchronized(q) { if (stop) q.clear(); busy = false }
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
        const val ACT_VCANCEL = "app.thesnowball.studio.PH_VCANCEL"
        const val X_PID = "pid"
        const val X_PIDS = "pids"
        @Volatile var busy = false; private set
        private val q = ArrayDeque<String>()   // 20/11/2026: העבודות שמחכות (תור עבודות, phq) — תחת synchronized(q)

        /** 20/11/2026: כמה עבודות — הקול של כל אחת אחרי הקודמת; כבר רץ — מצטרפות לתור */
        fun enqueue(ctx: Context, pids: List<String>) {
            ctx.startForegroundService(Intent(ctx, PhService::class.java).setAction(ACT_UP).putStringArrayListExtra(X_PIDS, ArrayList(pids)))
        }

        fun start(ctx: Context, pid: String, burn: Boolean) {
            ctx.startForegroundService(Intent(ctx, PhService::class.java).setAction(if (burn) ACT_BURN else ACT_UP).putExtra(X_PID, pid))
        }
    }
}
