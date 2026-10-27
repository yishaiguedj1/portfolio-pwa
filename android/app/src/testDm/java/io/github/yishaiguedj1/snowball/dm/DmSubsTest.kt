package io.github.yishaiguedj1.snowball.dm

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

/** 27/10/2026: DM זהה ל־Studio — רק כתוביות של היוצר, רק עברית ואנגלית, אף פעם לא אוטומטיות */
class DmSubsTest {
    private fun s(l: String, a: Int = 0) = JSONObject().put("l", l).put("n", l).put("a", a)

    @Test fun prefersCreatorSubsHeEn() {
        val a = JSONArray(listOf(s("en-orig", 1), s("en"), s("iw"), s("fr")))
        assertEquals("iw,en", DmSubs.langs(DmSubs.pick(a)))   // עברית קודם
    }

    @Test fun neverAuto() {
        assertEquals("", DmSubs.langs(DmSubs.pick(JSONArray(listOf(s("en-orig", 1), s("en", 1), s("he", 1))))))
    }

    @Test fun onlyHeEn() {
        assertEquals("", DmSubs.langs(DmSubs.pick(JSONArray(listOf(s("ja"), s("fr"))))))
        assertEquals("", DmSubs.langs(DmSubs.pick(JSONArray())))
    }

    @Test fun forTaskDefaultsOn() {
        assertEquals("iw,en", DmSubs.langs(DmSubs.forTask(JSONArray(listOf(s("en"), s("iw"))), true)))
        assertEquals("he,en", DmSubs.langs(DmSubs.forTask(JSONArray(), true)))   // לא נמצאו — מנסים בהורדה
        assertEquals("", DmSubs.langs(DmSubs.forTask(JSONArray(listOf(s("en"))), false)))
    }
}
