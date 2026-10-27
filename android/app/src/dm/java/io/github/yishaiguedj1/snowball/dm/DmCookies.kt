package io.github.yishaiguedj1.snowball.dm

import android.webkit.CookieManager

/**
 * מאיזה מאגר עוגיות לקחת (27/10/2026): ב־Studio Browser לכל משתמש פרופיל WebView משלו, ומה שהדף מוסר להורדה צריך את
 * העוגיות של המשתמש הפעיל — לא של פרופיל ברירת המחדל. הדפדפן קובע `cm` בעלייה; ב־DM לבד — ברירת המחדל.
 */
object DmCookies {
    @Volatile var cm: CookieManager? = null
    fun get(): CookieManager = cm ?: CookieManager.getInstance()
}
