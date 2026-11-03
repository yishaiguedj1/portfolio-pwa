package io.github.yishaiguedj1.snowball.br

import android.content.ContentProvider
import android.content.ContentValues
import android.content.pm.PackageManager
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import androidx.webkit.CookieManagerCompat
import androidx.webkit.ProfileStore
import androidx.webkit.WebViewFeature
import io.github.yishaiguedj1.snowball.AppRoute
import io.github.yishaiguedj1.snowball.dm.DmSession
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * 03/11/2026: ההתחברות של הדפדפן ל־DM (הצד של הדפדפן ל־`DmSession.pull`).
 * שאילתה: content://app.thesnowball.browser.session/c?u=<כתובת> → שורה לכל עוגייה של הכתובת, במבנה Set-Cookie המלא
 * (Domain/Path/Secure/HttpOnly/Expires/SameSite, כש־WebView תומך — כך DM שומר אותן בדיוק כמו בדפדפן).
 *
 * ⛔ עונים רק כש: הפונה = DM עם אותה חתימה; הכתובת http(s) תקינה; המשתמש שלח מהאתר הזה הורדה ל־DM ב־30 הימים האחרונים;
 * העוגיות מהפרופיל של המשתמש הפעיל בדפדפן — לעולם לא מהכרטיסייה הפרטית. אין כתיבה, ואין יומן.
 */
class BrSessionProvider : ContentProvider() {
    override fun onCreate() = true

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? {
        val ctx = context ?: return null
        val caller = callingPackage ?: return null
        val pm = ctx.packageManager
        if (caller != AppRoute.DM_PKG || pm.checkSignatures(caller, ctx.packageName) != PackageManager.SIGNATURE_MATCH) return null
        if (uri.pathSegments != listOf("c")) return null
        val u = uri.getQueryParameter("u")?.takeIf { (it.startsWith("https://") || it.startsWith("http://")) && it.length < 4000 && it.none { ch -> ch < ' ' } } ?: return null
        if (!DmSession.granted(ctx, u)) return null
        val out = MatrixCursor(arrayOf("c"))
        cookies(ctx, u).take(200).forEach { out.addRow(arrayOf(it)) }
        return out
    }

    /** הפרופיל וה־CookieManager — בתהליכון הראשי (ה־API של הפרופילים דורש), עם תקרת זמן */
    private fun cookies(ctx: android.content.Context, u: String): List<String> {
        var res: List<String> = emptyList()
        val done = CountDownLatch(1)
        Handler(Looper.getMainLooper()).post {
            try {
                val prof = BrUsers.profile(ctx)?.takeIf { runCatching { WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE) }.getOrDefault(false) }
                val cm = prof?.let { n -> runCatching { ProfileStore.getInstance().getProfile(n)?.cookieManager }.getOrNull() } ?: CookieManager.getInstance()
                res = if (runCatching { WebViewFeature.isFeatureSupported(WebViewFeature.GET_COOKIE_INFO) }.getOrDefault(false))
                    CookieManagerCompat.getCookieInfo(cm, u)
                else {
                    // בלי פרטי העוגייה: לפחות Secure בכתובת https, כדי ש־DM לא ישלח אותה בגלוי
                    val sec = if (u.startsWith("https://")) "; Secure" else ""
                    (cm.getCookie(u) ?: "").split(';').map { it.trim() }.filter { '=' in it }.map { it + sec }
                }
            } catch (e: Throwable) { res = emptyList() } finally { done.countDown() }
        }
        done.await(3, TimeUnit.SECONDS)
        return res
    }

    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?) = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?) = 0
}
