package io.github.yishaiguedj1.snowball.br

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * 27/10/2026 (בקשת המשתמש: "הייבוא מ־Chrome מדויק"): מקצה לקצה עם התוסף — עצי Chrome אקראיים (כפולות, תיקיות ריקות ומקוננות,
 * javascript:, "/" בשם) עברו בקוד של התוסף ל־state.json (tools/chrome-ext-e2e.mjs → resources/chrome-e2e). כאן — הקוד של הטלפון
 * (applyState + entries) חייב לבנות בדיוק את אותו עץ: אותה כמות, אותן תיקיות, אותו סדר.
 */
class BrE2eTest {
    @Test fun chromeTreeExact() {
        var n = 0
        while (true) {
            val txt = javaClass.classLoader!!.getResourceAsStream("chrome-e2e/case${n + 1}.json")?.bufferedReader()?.readText() ?: break
            n++
            val o = JSONObject(txt); val st = o.getJSONObject("state")
            val sm = ArrayList<BrSync.SMark>(); val a = st.getJSONArray("marks")
            for (i in 0 until a.length()) a.getJSONObject(i).let { sm += BrSync.SMark(it.optString("id"), it.optString("u"), it.optString("t"), it.optLong("at"), it.optString("o"), it.optString("r"), it.optString("p"), it.optInt("i", -1)) }
            val dl = ArrayList<BrSync.Dir>(); val d = st.getJSONArray("dirs")
            for (i in 0 until d.length()) d.getJSONObject(i).let { dl += BrSync.Dir(BrSync.folderPath(it.optString("r"), it.optString("p")), it.optInt("i", -1)) }
            val marks = BrSync.applyState(sm, emptyList(), emptyMap())
            assertEquals("case$n: כמות", o.getInt("total"), marks.size)
            val truth = o.getJSONObject("truth")
            for (path in truth.keys()) {
                val want = truth.getJSONArray(path).let { t -> (0 until t.length()).map { t.getString(it) } }
                assertEquals("case$n: $path", want, BrSync.entries(marks, path, dl).map { if (it is BrMark) "L:" + it.sid else "D:$it" })
            }
        }
        assertEquals(12, n)
    }
}
