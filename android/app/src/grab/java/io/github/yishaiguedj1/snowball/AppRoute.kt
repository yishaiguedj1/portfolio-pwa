package io.github.yishaiguedj1.snowball

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri

/**
 * 24/10/2026 (בקשת המשתמש: "מהרגע שמתקינים את Studio DM — כל ההורדות של המכשיר יורדות אליו בברירת מחדל"):
 * לאן הולך קישור/קובץ בין האפליקציות — הבועה, Studio ו־Studio DM. אותו קוד בשלושתן (src/grab).
 *  · הורדה (הבועה, "רק להוריד לטלפון" ב־Studio) → Studio DM כשהוא מותקן; אחרת כמו קודם (Studio).
 *  · מתוך DM: "לתרגם ב־Studio" (הקובץ שירד, כמו שיתוף מהגלריה) ו"ישר לענן של Studio" (הקישור, עם snb_to=cloud —
 *    Studio בוחר את הענן כשהמקור מאפשר, ואחרת נשאר בטלפון).
 * רק חבילות שלנו, ב־setPackage — לא בורר מערכת, ובלי כתובת אינטרנט. כל חבילה כאן — גם ב־<queries> במניפסט (אנדרואיד 11+).
 */
object AppRoute {
    const val DM_PKG = "app.thesnowball.studiodm"
    const val STUDIO_PKG = "app.thesnowball.studio"
    const val EXTRA_REF = "snb_ref"
    const val EXTRA_TO = "snb_to"      // "cloud" = ישר לענן של Studio (בלי להוריד לטלפון)
    /** 26/10/2026: לפתוח את הדף בדפדפן של DM (אתר שכבר הורדת ממנו דרכו — שם ההתחברות) */
    const val EXTRA_BR = "snb_br"
    /** האתרים האלה — DmSitesProvider, מוגן בהרשאת חתימה (רק האפליקציות שלנו) */
    const val SITES_URI = "content://app.thesnowball.studiodm.sites/hosts"

    fun installed(ctx: Context, pkg: String): Boolean = try {
        ctx.packageManager.getPackageInfo(pkg, 0); true
    } catch (e: PackageManager.NameNotFoundException) { false } catch (e: Exception) { false }

    fun dmInstalled(ctx: Context) = ctx.packageName != DM_PKG && installed(ctx, DM_PKG)
    fun studioInstalled(ctx: Context) = ctx.packageName == STUDIO_PKG || installed(ctx, STUDIO_PKG)

    private fun link(pkg: String, url: String, ref: String) = Intent(Intent.ACTION_SEND).setType("text/plain")
        .putExtra(Intent.EXTRA_TEXT, url).setPackage(pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        .also { if (ref.startsWith("http")) it.putExtra(EXTRA_REF, ref) }

    /** הורדה ל־DM. false = DM לא מותקן / לא נפתח — הקורא ממשיך כמו קודם */
    fun toDm(ctx: Context, url: String, ref: String = ""): Boolean {
        if (!dmInstalled(ctx)) return false
        return try { ctx.startActivity(link(DM_PKG, url, ref)); true } catch (e: Exception) { false }
    }

    /** הדף לדפדפן של DM (לא להורדה ישירה). false = DM לא מותקן */
    fun toDmBrowser(ctx: Context, url: String): Boolean {
        if (!dmInstalled(ctx)) return false
        return try { ctx.startActivity(link(DM_PKG, url, "").putExtra(EXTRA_BR, true)); true } catch (e: Exception) { false }
    }

    /** האתרים שבהם הורדת דרך הדפדפן של DM. בלי DM / בלי הרשאה — ריק */
    fun dmSites(ctx: Context): Set<String> = try {
        ctx.contentResolver.query(Uri.parse(SITES_URI), null, null, null, null)?.use { c ->
            val out = HashSet<String>()
            while (c.moveToNext() && out.size < SiteList.MAX) c.getString(0)?.let { out.add(SiteList.norm(it)) }
            out
        } ?: emptySet()
    } catch (e: Exception) { emptySet() }

    /** הקישור ל־Studio (לתרגום); cloud = ישר לענן של Studio כשאפשר */
    fun toStudio(ctx: Context, url: String, ref: String = "", cloud: Boolean = false): Boolean = try {
        ctx.startActivity(link(STUDIO_PKG, url, ref).also { if (cloud) it.putExtra(EXTRA_TO, "cloud") }); true
    } catch (e: Exception) { false }

    /** קובץ שכבר ירד (MediaStore) ל־Studio — כמו "שיתוף ← Studio" מהגלריה; Studio מקבל הרשאת קריאה לקובץ הזה בלבד */
    fun fileToStudio(ctx: Context, uri: Uri, mime: String, title: String): Boolean = try {
        ctx.startActivity(Intent(Intent.ACTION_SEND).setType(mime.ifEmpty { "video/mp4" }).putExtra(Intent.EXTRA_STREAM, uri)
            .putExtra(Intent.EXTRA_TEXT, title.take(200)).setPackage(STUDIO_PKG)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)); true
    } catch (e: Exception) { false }
}
