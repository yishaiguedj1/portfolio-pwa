package io.github.yishaiguedj1.snowball.dm

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import io.github.yishaiguedj1.snowball.SiteList

/**
 * 26/10/2026: רשימת האתרים שבהם הורדת דרך הדפדפן של DM — לבועה ב־Chrome (Studio Bubble), שתופיע בהם ותפתח את הדף
 * בדפדפן של DM. קריאה בלבד, רק שמות אתרים, ומוגן בהרשאת חתימה (app.thesnowball.permission.DM_SITES) — רק אפליקציה
 * שחתומה במפתח שלנו יכולה לקרוא.
 */
class DmSitesProvider : ContentProvider() {
    override fun onCreate() = true

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, args: Array<out String>?, sort: String?): Cursor {
        val c = MatrixCursor(arrayOf("h"))
        val ctx = context ?: return c
        SiteList.parse(DmPrefs(ctx).brSites).forEach { c.addRow(arrayOf(it)) }
        return c
    }

    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, args: Array<out String>?) = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, args: Array<out String>?) = 0
}
