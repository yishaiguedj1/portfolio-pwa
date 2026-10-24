package io.github.yishaiguedj1.snowball.dm

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.TileService

/**
 * שלב 3: אריח בהגדרות המהירות — "הורדה מהלוח". נגיעה פותחת את DM עם גיליון ההוספה והקישור שבלוח
 * (באנדרואיד 10+ רק האפליקציה שבפוקוס קוראת את הלוח — לכן הקריאה עצמה ב־DmActivity, כשהחלון בפוקוס).
 * בלי הרשאה רגישה: BIND_QUICK_SETTINGS_TILE מוגנת על ידי המערכת, לא נתנת לאפליקציות אחרות.
 */
class DmTile : TileService() {
    override fun onClick() {
        super.onClick()
        val i = Intent(this, DmActivity::class.java).setAction(ACTION_CLIP).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 7, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
        } else {
            @Suppress("DEPRECATION", "StartActivityAndCollapseDeprecated") startActivityAndCollapse(i)
        }
    }

    companion object { const val ACTION_CLIP = "app.thesnowball.studiodm.CLIP" }
}
