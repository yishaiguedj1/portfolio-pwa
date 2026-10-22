package io.github.yishaiguedj1.snowball

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * 22/10/2026: אריח "בועת הורדה" בהגדרות המהירות — הדלקה וכיבוי בנגיעה, בלי להיכנס להגדרות.
 * כשהשירות עוד לא הופעל במסך הנגישות — הנגיעה פותחת אותו (ההפעלה עצמה רק שם — כך אנדרואיד דורש).
 */
class GrabTile : TileService() {
    override fun onStartListening() { paint() }

    override fun onClick() {
        if (!GrabService.enabled(this)) { openSettings(); return }
        val p = getSharedPreferences(GrabService.PREFS, MODE_PRIVATE)
        p.edit().putBoolean(GrabService.KEY_ON, !GrabService.isOn(this)).apply()
        paint()
    }

    private fun paint() {
        val t = qsTile ?: return
        val en = GrabService.enabled(this)
        val on = en && GrabService.isOn(this)
        t.state = if (on) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        t.label = getString(R.string.grabTile)
        if (Build.VERSION.SDK_INT >= 29) t.subtitle = getString(if (!en) R.string.grabTileSetup else if (on) R.string.grabTileOn else R.string.grabTileOff)
        t.updateTile()
    }

    @Suppress("DEPRECATION")
    private fun openSettings() {
        val i = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE))
        } else startActivityAndCollapse(i)
    }

    companion object {
        /** השירות עלה/ירד — שהאריח יציג את המצב הנכון גם בלי לפתוח את הלוח */
        fun refresh(c: Context) {
            try { requestListeningState(c, ComponentName(c, GrabTile::class.java)) } catch (e: Exception) {}
        }
    }
}
