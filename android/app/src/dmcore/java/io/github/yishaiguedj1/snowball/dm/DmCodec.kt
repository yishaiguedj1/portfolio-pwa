package io.github.yishaiguedj1.snowball.dm

import org.json.JSONArray
import org.json.JSONObject

/**
 * פורמט הווידאו (24/10/2026, שאלת המשתמש: אתר אחר נתן 153MB ואנחנו 111MB לאותו 1080p).
 * "small" (ברירת המחדל) = מה ש־DlProbe בוחר: AV1/VP9 — אותה איכות בקובץ קטן ב־25–40%.
 * "compat" = H.264 + AAC באותה רזולוציה — מתנגן ונערך בכל מכשיר, תוכנה וטלוויזיה (גדול יותר). אין H.264 בגובה הזה — נשאר מה שנבחר.
 * טהור: מקבל את הבחירה (q מתוך summarize) ואת רשימת הפורמטים (fm) והקול הטוב (ao).
 */
object DmCodec {
    const val SMALL = "small"
    const val COMPAT = "compat"
    val MODES = listOf(SMALL, COMPAT)

    data class Pick(val v: String, val a: String, val c: String, val sz: Long)

    private fun rows(fm: JSONArray?) = (0 until (fm?.length() ?: 0)).mapNotNull { fm!!.optJSONObject(it) }

    fun prefer(q: JSONObject, fm: JSONArray?, ao: JSONObject?, mode: String): Pick {
        val keep = Pick(q.optString("v"), q.optString("a"), q.optString("c"), q.optLong("sz", -1))
        if (mode != COMPAT || keep.c == "h264") return keep
        val h = q.optInt("h")
        val all = rows(fm)
        val vids = all.filter { it.optString("c") == "h264" && it.optInt("h") == h && (it.optString("k") == "v" || it.optString("k") == "av") && it.optInt("hdr") == 0 }
        val v = vids.maxWithOrNull(compareBy<JSONObject>({ if (it.optString("k") == "v") 1 else 0 }, { it.optInt("fps") }, { it.optLong("br") }, { it.optLong("sz") }))
            ?: return keep
        if (v.optString("k") == "av") return Pick(v.optString("id"), "", "h264", v.optLong("sz", -1))
        // קול שנכנס ל־MP4 בלי המרה: AAC קודם (Opus ב־MP4 לא מתנגן בכל מקום), אחרת הקול הטוב
        val aac = all.filter { it.optString("k") == "a" && it.optString("ac").let { c -> c.startsWith("aac") || c.startsWith("mp4a") } }
            .maxByOrNull { it.optLong("br") }
        val a = aac ?: ao
        val aid = a?.optString("id").orEmpty()
        val vsz = v.optLong("sz", -1); val asz = a?.optLong("sz", -1) ?: -1
        return Pick(v.optString("id"), aid, "h264", if (vsz > 0) vsz + maxOf(asz, 0) else -1)
    }
}
