package io.github.yishaiguedj1.snowball.br

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * כמה משתמשים בדפדפן אחד (27/10/2026, בקשת המשתמש: "לפי ת־עיצוב — לכל אחד הסנכרון שלו"). לכל משתמש:
 * - תיקייה משלו (סימניות, היסטוריה, כרטיסיות, מצב הסנכרון) — המשתמש הראשון נשאר במקום הישן (filesDir/br), כך שאין העברה;
 * - SharedPreferences משלו (הגדרות, סנכרון בענן, הגשר ל־Chrome) — שם עם הסיומת `_u<id>`;
 * - פרופיל WebView משלו (עוגיות, אחסון של אתרים, חיבור לחשבונות באתרים) — הראשון = פרופיל ברירת המחדל;
 * - מפתח עטיפה משלו ב־Android Keystore.
 * המעבר בין משתמשים = הפעלה מחדש של האפליקציה (BrRestart) — כל מה שבזיכרון שייך למשתמש שהיה. החלק הזה טהור (בלי Context) ונבדק ב־JVM.
 */
object BrUsers {
    /** `c` = הצבע של המשתמש (BrPro.USER_COLORS, הגל השני; ‎-1 = בלי) */
    data class U(val id: String, val em: String = "", val nm: String = "", val at: Long = 0L, val c: Int = -1)

    /** עד 8 משתמשים — כל אחד עם פרופיל WebView, וזה זיכרון ודיסק */
    const val MAX = 8
    const val MAIN = ""

    fun encode(l: List<U>): String = JSONArray().apply { l.forEach { put(JSONObject().put("id", it.id).put("em", it.em).put("nm", it.nm).put("at", it.at).put("c", it.c)) } }.toString()
    fun decode(s: String?): List<U> {
        val out = ArrayList<U>()
        runCatching { val a = JSONArray(s ?: "[]"); for (i in 0 until a.length()) a.optJSONObject(i)?.let { o -> val id = o.optString("id"); if (validId(id) && out.none { it.id == id }) out += U(id, o.optString("em"), o.optString("nm"), o.optLong("at"), o.optInt("c", -1).takeIf { it in -1..15 } ?: -1) } }
        // הראשי תמיד קיים ותמיד ראשון
        if (out.none { it.id == MAIN }) out.add(0, U(MAIN)) else { val m = out.first { it.id == MAIN }; out.remove(m); out.add(0, m) }
        return out
    }
    /** מזהה = אותיות וספרות בלבד (נכנס לשם קובץ, לשם פרופיל ולשם מפתח) */
    fun validId(id: String) = id.isEmpty() || (id.length in 1..12 && id.all { it in 'a'..'z' || it in '0'..'9' })
    fun newId(taken: Collection<String>, rnd: () -> Long): String {
        while (true) { val id = java.lang.Long.toString(rnd() and Long.MAX_VALUE, 36).take(8); if (validId(id) && id !in taken) return id }
    }
    fun prefsName(id: String, base: String) = if (id == MAIN) base else "${base}_u$id"
    fun profileName(id: String): String? = if (id == MAIN) null else "u_$id"
    fun keyAlias(id: String) = if (id == MAIN) "snb_br_sync" else "snb_br_sync_u$id"
    fun relDir(id: String) = if (id == MAIN) "br" else "br/u/$id"

    /* ---------------- מה שנשמר בטלפון ---------------- */

    private fun sp(ctx: Context) = ctx.applicationContext.getSharedPreferences("br_users", Context.MODE_PRIVATE)
    /** המשתמש הנוכחי — נקבע פעם אחת לכל תהליך (מעבר = הפעלה מחדש) */
    @Volatile private var cur: String? = null
    fun cur(ctx: Context): String = cur ?: (sp(ctx).getString("cur", MAIN)?.takeIf { validId(it) && list(ctx).any { u -> u.id == it } } ?: MAIN).also { cur = it }
    fun list(ctx: Context): List<U> = decode(sp(ctx).getString("list", null))
    private fun save(ctx: Context, l: List<U>) { sp(ctx).edit().putString("list", encode(l)).commit() }

    fun dir(ctx: Context): File = File(ctx.filesDir, relDir(cur(ctx))).apply { mkdirs() }
    fun cacheDir(ctx: Context): File = File(ctx.cacheDir, relDir(cur(ctx))).apply { mkdirs() }
    fun prefs(ctx: Context, base: String) = ctx.applicationContext.getSharedPreferences(prefsName(cur(ctx), base), Context.MODE_PRIVATE)
    fun profile(ctx: Context): String? = profileName(cur(ctx))

    /** אחרי כניסה עם Google — השם והמייל ליד המשתמש ברשימה */
    fun label(ctx: Context, em: String, nm: String) {
        val id = cur(ctx)
        save(ctx, list(ctx).map { if (it.id == id) it.copy(em = em, nm = nm) else it })
    }

    /** הצבע של המשתמש הנוכחי (בסרגל ובכפתור הכרטיסיות) */
    fun setColor(ctx: Context, i: Int) {
        val id = cur(ctx)
        save(ctx, list(ctx).map { if (it.id == id) it.copy(c = i) else it })
    }
    fun color(ctx: Context): Int = list(ctx).firstOrNull { it.id == cur(ctx) }?.c ?: -1

    /** משתמש חדש — נכנס לרשימה; המעבר אליו = select ואז הפעלה מחדש */
    fun add(ctx: Context): String? {
        val l = list(ctx); if (l.size >= MAX) return null
        val id = newId(l.map { it.id }) { java.security.SecureRandom().nextLong() }
        save(ctx, l + U(id, at = System.currentTimeMillis()))
        return id
    }
    /** מי ייפתח בהפעלה הבאה (commit — לפני שהתהליך נסגר) */
    fun select(ctx: Context, id: String) { if (list(ctx).any { it.id == id }) sp(ctx).edit().putString("cur", id).commit() }

    /** מחיקת משתמש (לא הראשי ולא הפעיל): הקבצים, ההגדרות, הפרופיל של WebView (העוגיות) והמפתח. מה שבענן נשאר בחשבון שלו */
    fun remove(ctx: Context, id: String): Boolean {
        if (id == MAIN || id == cur(ctx)) return false
        val app = ctx.applicationContext
        save(app, list(app).filter { it.id != id })
        File(app.filesDir, relDir(id)).deleteRecursively()
        File(app.cacheDir, relDir(id)).deleteRecursively()
        listOf("br", "br_cloud", "br_chrome").forEach { b -> runCatching { app.deleteSharedPreferences(prefsName(id, b)) } }
        runCatching { java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(keyAlias(id)) }
        profileName(id)?.let { p -> runCatching { androidx.webkit.ProfileStore.getInstance().deleteProfile(p) } }
        return true
    }
}
