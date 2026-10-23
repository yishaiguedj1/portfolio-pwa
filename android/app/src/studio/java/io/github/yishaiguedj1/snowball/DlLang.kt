package io.github.yishaiguedj1.snowball

import android.content.Context
import android.content.res.Configuration
import java.util.Locale

/**
 * 23/10/2026 (בקשת המשתמש): חלון ההורדה, ההתראות ודפדפן הציד בשפה של Studio — לא בשפת הטלפון.
 * האתר שולח l=he|en בכל intent (dlIntent / huntOpen); נשמר, כי ההתראות וההורדה ברקע רצות בלי האתר.
 */
object DlLang {
    private const val PREFS = "dl"; private const val KEY = "l"

    fun set(ctx: Context, l: String?) {
        if (l != "he" && l != "en") return
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, l).apply()
    }

    fun cur(ctx: Context): String? = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)

    /** הקשר עם המחרוזות בשפה שנבחרה (או של הטלפון, כשעוד לא נבחרה) */
    fun of(ctx: Context): Context {
        val l = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: return ctx
        val c = Configuration(ctx.resources.configuration)
        c.setLocale(Locale(l)); c.setLayoutDirection(Locale(l))
        return ctx.createConfigurationContext(c)
    }
}
