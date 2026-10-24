package io.github.yishaiguedj1.snowball.dm

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

/** שמירת משימה: "tr" היה גם מספר הניסיונות וגם "להוריד ולתרגם" — עכשיו st; קובץ ישן נקרא נכון; "אחר כך" נשמר */
class DmModelTest {
    @Test fun roundTrip() {
        val t = DmTask("abcdef12", "https://x.com/a.mp4").apply { tries = 3; tr = true; later = true }
        val o = DmTask.of(JSONObject(t.json().toString()))!!
        assertEquals(3, o.tries); assertEquals(true, o.tr); assertEquals(true, o.later)
    }

    @Test fun oldFileWithTrBoolean() {
        val old = JSONObject().put("id", "abcdef12").put("u", "https://x.com/a").put("tr", true)
        val o = DmTask.of(old)!!
        assertEquals(true, o.tr); assertEquals(0, o.tries); assertEquals(false, o.later)
    }
}
