package io.github.yishaiguedj1.snowball.dm

import org.json.JSONArray

/**
 * כתוביות היוצר (24/10/2026): מתוך רשימת הכתוביות של הבדיקה (DlProbe.subsList — l, n, a=אוטומטיות) — מה שיצורף לסרטון.
 * 27/10/2026 (החלטת המשתמש — DM זהה ל־Studio): רק כתוביות שהיוצר העלה, רק עברית ואנגלית (DlEngine.SUBS) — אף פעם לא
 * אוטומטיות, ולא שפה אחרת. טהור.
 */
object DmSubs {
    const val MAX = 2
    data class Sub(val l: String, val n: String, val auto: Boolean)

    fun list(a: JSONArray?) = (0 until (a?.length() ?: 0)).mapNotNull { a!!.optJSONObject(it) }
        .map { Sub(it.optString("l"), it.optString("n"), it.optInt("a") == 1) }.filter { it.l.isNotEmpty() }

    private fun base(l: String) = l.lowercase().substringBefore('-').let { if (it == "iw") "he" else it }

    fun pick(a: JSONArray?): List<Sub> {
        val all = list(a).filter { !it.auto }
        val out = ArrayList<Sub>()
        for (w in listOf("he", "en")) all.firstOrNull { base(it.l) == w }?.let { out += it }
        return out.take(MAX)
    }

    /** לשמירה במשימה: "he,en" */
    fun langs(s: List<Sub>) = s.joinToString(",") { it.l }
}
