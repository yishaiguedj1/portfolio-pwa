package io.github.yishaiguedj1.snowball

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 23/10/2026: הבדיקה לעומק — קובץ העוגיות ל־yt-dlp, מה שהדף מחזיר, והסיכום של זרם שנמצא */
class DlDeepTest {
    @Test fun hostKey() {
        assertEquals("imdb.com", DlDeep.hostKey("https://www.imdb.com/title/tt0111161/"))
        assertEquals("buffett.cnbc.com", DlDeep.hostKey("https://buffett.cnbc.com/video/1"))
        assertEquals("", DlDeep.hostKey("javascript:alert(1)"))
        assertEquals("", DlDeep.hostKey(null))
    }

    @Test fun netscape() {
        val t = DlDeep.netscape(listOf(
            "https://www.imdb.com/video/vi1" to "aws-waf-token=abc:def; session-id=1",
            "https://cdn.example.net/m.m3u8" to null,
            "https://www.imdb.com/x" to "session-id=2",          // אותו אתר ושם — פעם אחת
            "https://evil.com/" to "bad name=1; ok=a\tb"         // שם לא תקין / ערך עם טאב — לא נכנסים
        ), 1000)
        val lines = t.trim().lines()
        assertEquals("# Netscape HTTP Cookie File", lines[0])
        assertEquals(".imdb.com\tTRUE\t/\tTRUE\t${1000 + DlDeep.CK_TTL_MS / 1000}\taws-waf-token\tabc:def", lines[1])
        assertEquals(".imdb.com\tTRUE\t/\tTRUE\t${1000 + DlDeep.CK_TTL_MS / 1000}\tsession-id\t1", lines[2])
        assertEquals(3, lines.size)
        lines.drop(1).forEach { assertEquals(7, it.split('\t').size) }
    }

    @Test fun parsePage() {
        val p = DlDeep.parsePage("""{"t":"Trailer","i":"https://m.media-amazon.com/x.jpg","u":["https://a.com/v.m3u8",5,"x"]}""")!!
        assertEquals("Trailer", p.title)
        assertEquals("https://m.media-amazon.com/x.jpg", p.image)
        assertEquals(listOf("https://a.com/v.m3u8", "x"), p.urls)            // לא־מחרוזת נזרקת; הסינון — HuntMedia
        assertEquals("", DlDeep.parsePage("""{"i":"javascript:x"}""")!!.image)
        assertNull(DlDeep.parsePage("not json"))
        assertNull(DlDeep.parsePage(null))
    }

    @Test fun fromMedia() {
        val pg = DlDeep.Page("The Annual Meeting", "", emptyList())
        val s = DlDeep.fromMedia(JSONObject().put("t", "master").put("u", "x"), "https://cdn.c.com/master.m3u8", "https://buffett.cnbc.com/v/1", pg)
        assertEquals("The Annual Meeting", s.getString("t"))
        assertEquals("https://cdn.c.com/master.m3u8", s.getString("u"))
        assertEquals("https://buffett.cnbc.com/v/1", s.getString("rf"))
        val keep = DlDeep.fromMedia(JSONObject().put("t", "Real title"), "https://c/v.mp4", "https://p/", pg)
        assertEquals("Real title", keep.getString("t"))                     // כותרת אמיתית מ־yt-dlp נשארת
    }

    @Test fun extractScript() {
        val js = DlDeep.EXTRACT
        assertTrue(js.contains("__NEXT_DATA__") && js.contains("application/ld+json") && js.contains("og:video"))
        assertTrue(js.contains("muted=true"))
        assertFalse(js.contains("fetch(") || js.contains("XMLHttpRequest") || js.contains("sendBeacon"))   // לא שולח כלום
    }
}
