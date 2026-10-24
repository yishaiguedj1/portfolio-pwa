package io.github.yishaiguedj1.snowball.dm

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class DmSubsTest {
    private fun s(l: String, a: Int = 0) = JSONObject().put("l", l).put("n", l).put("a", a)

    @Test fun prefersCreatorSubsHeEn() {
        val a = JSONArray(listOf(s("en-orig", 1), s("en"), s("iw"), s("fr")))
        assertEquals("iw,en", DmSubs.langs(DmSubs.pick(a, "he")))   // עברית קודם
        assertEquals(false, DmSubs.anyAuto(DmSubs.pick(a, "he")))
    }

    @Test fun autoOnlyWhenNoCreatorSubs() {
        val a = JSONArray(listOf(s("en-orig", 1)))
        val p = DmSubs.pick(a, "he")
        assertEquals("en-orig", DmSubs.langs(p)); assertEquals(true, DmSubs.anyAuto(p))
    }

    @Test fun fallbackOriginal() {
        assertEquals("ja", DmSubs.langs(DmSubs.pick(JSONArray(listOf(s("ja"))), "he")))
        assertEquals("", DmSubs.langs(DmSubs.pick(JSONArray(), "he")))
    }
}
