package io.github.yishaiguedj1.snowball.dm

import org.json.JSONArray

/**
 * כתוביות היוצר (24/10/2026): מתוך רשימת הכתוביות של הבדיקה (DlProbe.subsList — l, n, a=אוטומטיות) — עד 3 שפות לצרף לסרטון:
 * עברית, אנגלית ושפת הממשק, כתוביות שהיוצר העלה קודם (אוטומטיות רק בשפת הסרטון המקורית — "‎-orig"). טהור.
 */
object DmSubs {
    const val MAX = 3
    data class Sub(val l: String, val n: String, val auto: Boolean)

    fun list(a: JSONArray?) = (0 until (a?.length() ?: 0)).mapNotNull { a!!.optJSONObject(it) }
        .map { Sub(it.optString("l"), it.optString("n"), it.optInt("a") == 1) }.filter { it.l.isNotEmpty() }

    private fun base(l: String) = l.lowercase().substringBefore('-').let { if (it == "iw") "he" else it }

    fun pick(a: JSONArray?, ui: String): List<Sub> {
        val all = list(a)
        val want = listOf("he", "en", base(ui)).distinct()
        val out = ArrayList<Sub>()
        for (w in want) {
            val s = all.firstOrNull { !it.auto && base(it.l) == w } ?: all.firstOrNull { it.auto && base(it.l) == w }
            if (s != null && out.none { base(it.l) == base(s.l) }) out += s
        }
        // אין אף אחת מהשפות — כתוביות היוצר בשפה המקורית (אם יש)
        if (out.isEmpty()) all.firstOrNull { !it.auto }?.let { out += it }
        return out.take(MAX)
    }

    /** לשמירה במשימה: "he,en" + האם יש אוטומטיות */
    fun langs(s: List<Sub>) = s.joinToString(",") { it.l }
    fun anyAuto(s: List<Sub>) = s.any { it.auto }
}
