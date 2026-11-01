package io.github.yishaiguedj1.snowball.br

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 01/11/2026: Studio Browser Pro — הגל הראשון (BrPro): מחשבון, המרות, קיצורים, ניקוי קישור, כלי מפתחים */
class BrProTest {
    @Test fun calculator() {
        assertEquals("510", BrPro.answer("15% מ־3,400"))
        assertEquals("510", BrPro.answer("15% of 3400"))
        assertEquals("220", BrPro.answer("200+10%"))
        assertEquals("180", BrPro.answer("200-10%"))
        assertEquals("14", BrPro.answer("2+3*4"))
        assertEquals("20", BrPro.answer("(2+3)*4"))
        assertEquals("1,024", BrPro.answer("2^10"))
        assertEquals("0.3333333333", BrPro.answer("1/3"))
        assertEquals("12.5", BrPro.answer("100 ÷ 8"))
        assertEquals("6", BrPro.answer("2×3"))
        assertEquals("-1", BrPro.answer("2-3"))
        assertEquals("1,234,567.5", BrPro.answer("1234567+0.5"))
    }

    @Test fun notACalculation() {
        assertNull(BrPro.answer("ynet.co.il"))
        assertNull(BrPro.answer("1234"))
        assertNull(BrPro.answer("50%"))
        assertNull(BrPro.answer("-3"))
        assertNull(BrPro.answer("2026-11-01"))      // תאריך
        assertNull(BrPro.answer("01/11/2026"))
        assertNull(BrPro.answer("054-1234567"))     // טלפון
        assertNull(BrPro.answer("1/0"))
        assertNull(BrPro.answer("iphone 15 pro"))
        assertNull(BrPro.answer("2+"))
        assertNull(BrPro.answer("(2+3"))
    }

    @Test fun conversions() {
        assertEquals("8.04672 ק״מ", BrPro.answer("5 mi to km"))
        assertEquals("8.04672 ק״מ", BrPro.answer("5 מייל בק״מ"))
        assertEquals("37.78 °C", BrPro.answer("100f to c"))
        assertEquals("86 °F", BrPro.answer("30 מעלות צלזיוס בפרנהייט"))
        assertEquals("2.2046226 פאונד", BrPro.answer("1 kg to lb"))
        assertNull(BrPro.answer("5 km to kg"))       // סוגים שונים
        assertNull(BrPro.answer("5 km to km"))
    }

    @Test fun keywords() {
        val (k, q) = BrPro.keyword("yt שיר חדש")!!
        assertEquals("yt", k.key); assertEquals("שיר חדש", q)
        assertEquals("https://www.youtube.com/results?search_query=%D7%A9%D7%99%D7%A8+%D7%97%D7%93%D7%A9", BrPro.keywordUrl(k, q))
        assertEquals("w", BrPro.keyword("W ריבית")!!.first.key)
        assertNull(BrPro.keyword("yt"))
        assertNull(BrPro.keyword("yt   "))
        assertNull(BrPro.keyword("youtube music"))
        assertNull(BrPro.keyword("ynet.co.il"))
    }

    @Test fun cleanLinks() {
        assertEquals("https://a.com/x?id=5", BrPro.clean("https://a.com/x?utm_source=fb&id=5&fbclid=abc"))
        assertEquals("https://a.com/x", BrPro.clean("https://a.com/x?utm_source=fb&utm_medium=x"))
        assertEquals("https://a.com/x#top", BrPro.clean("https://a.com/x?gclid=1#top"))
        assertEquals("https://youtu.be/abc?t=30", BrPro.clean("https://youtu.be/abc?si=XYZ&t=30"))
        // si באתר אחר — פרמטר אמיתי, נשאר
        assertEquals("https://shop.com/p?si=2", BrPro.clean("https://shop.com/p?si=2"))
        assertEquals("https://a.com/x", BrPro.clean("https://a.com/x"))
    }

    @Test fun devtools() {
        assertEquals("curl 'https://a.com/x' -H 'Accept: */*'", BrPro.curl("https://a.com/x", "GET", mapOf("Accept" to "*/*", "Cookie" to "s=1")))
        assertEquals("curl -X POST 'https://a.com/it'\\''s'", BrPro.curl("https://a.com/it's", "post", emptyMap()))
        assertEquals("js", BrPro.kindOf("https://a.com/app.js?v=2", false))
        assertEquals("media", BrPro.kindOf("https://cdn/v/1080.m3u8", false))
        assertEquals("doc", BrPro.kindOf("https://a.com/", true))
        assertEquals("undefined", BrPro.evalShow("null"))
        assertEquals("שלום \"עולם\"", BrPro.evalShow("\"שלום \\\"עולם\\\"\""))
        assertEquals("42", BrPro.evalShow("42"))
        val r = BrPro.Ring<Int>(3); (1..5).forEach { r.add(it) }
        assertEquals(listOf(3, 4, 5), r.all())
    }

    @Test fun pageScripts() {
        assertTrue(BrPro.HEBREW_JS.contains("dir','auto'"))
        assertTrue(BrPro.muteJs(true).contains("__snbMute=true"))
        assertFalse(BrPro.muteJs(false).contains("__snbMute=true"))
    }
}
