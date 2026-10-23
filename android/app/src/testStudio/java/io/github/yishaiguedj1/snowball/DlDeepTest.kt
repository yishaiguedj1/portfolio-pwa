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

    private fun sum(d: Int, sz: Long, h: Int = 720) =
        JSONObject().put("d", d).put("q", org.json.JSONArray().put(JSONObject().put("h", h).put("sz", sz)))

    /* 23/10/2026: ב־buffett.cnbc.com נבחר "סרטון" של 1KB */
    @Test fun realVideo() {
        assertFalse(DlDeep.realVideo(sum(0, 1_000, 0), 0))                // הקובץ מהדיווח: 1KB
        assertFalse(DlDeep.realVideo(sum(5, 2_000_000), 0))               // 5 שניות
        assertFalse(DlDeep.realVideo(sum(30, 9_000_000), 3 * 3600))      // פרסומת של 30 שנ׳ בדף של 3 שעות
        assertTrue(DlDeep.realVideo(sum(24, 22_000_000), 0))              // טריילר של IMDb (0:24)
        assertTrue(DlDeep.realVideo(sum(3 * 3600, 0), 3 * 3600))          // HLS בלי גודל, באורך של הדף
        assertTrue(DlDeep.realVideo(sum(0, 0, 0), 0))                     // לא ידוע כלום — לא נפסל (אבל לא "תואם")
    }

    @Test fun matchesAndBetter() {
        assertTrue(DlDeep.matches(sum(10_790, 0), 10_800))
        assertFalse(DlDeep.matches(sum(30, 0), 10_800))
        assertFalse(DlDeep.matches(sum(30, 0), 0))
        val short = sum(600, 50_000_000); val long = sum(3600, 10_000_000); val hi = sum(3600, 10_000_000, 1080)
        assertTrue(DlDeep.better(long, short, 0))
        assertTrue(DlDeep.better(hi, long, 0))
        assertFalse(DlDeep.better(short, long, 0))
        assertTrue(DlDeep.better(short, null, 0))
        // שניהם תואמים לדף — האיכות הגבוהה ביותר, גם אם קצת קצר יותר
        val m360 = sum(10_800, 300_000_000, 360); val m1080 = sum(10_750, 2_000_000_000, 1080)
        assertTrue(DlDeep.better(m1080, m360, 10_800))
        assertTrue(DlDeep.better(m360, sum(30, 9_000_000, 1080), 10_800))   // תואם גובר על קובץ קצר באיכות גבוהה
    }

    /* 23/10/2026: הקובץ שירד מ־buffett.cnbc.com — MP4 של 5KB, שנייה אחת; ושרת שמחזיר דף */
    @Test fun notVideo() {
        assertFalse(DlDeep.realVideo(sum(0, 5_000, 0), 0))                                // 5KB אחרי HEAD
        assertFalse(DlDeep.realVideo(sum(0, 0, 0).put("nv", 1), 0))                        // השרת: text/html
        val mp4 = ByteArray(32).also { "ftypisom".toByteArray().copyInto(it, 4) }
        assertTrue(DlDeep.looksLikeVideo(mp4))
        assertTrue(DlDeep.looksLikeVideo(byteArrayOf(0x1A, 0x45, 0xDF.toByte(), 0xA3.toByte(), 0, 0, 0, 0, 0, 0, 0, 0)))
        assertFalse(DlDeep.looksLikeVideo("<!DOCTYPE html><html>".toByteArray()))
        assertFalse(DlDeep.looksLikeVideo("#EXTM3U\n#EXT-X-VERSION:3".toByteArray()))
        assertFalse(DlDeep.looksLikeVideo(ByteArray(4)))
    }

    @Test fun withAlt() {
        val a = sum(3600, 1_000_000_000, 1080).put("u", "https://c/a.m3u8")
        val b = sum(3600, 400_000_000, 480).put("u", "https://c/b.mp4")
        val c = sum(3600, 600_000_000, 720).put("u", "https://c/c.mp4")
        val r = DlDeep.withAlt(a, listOf(b, a, c), 3600)
        val alt = r.getJSONArray("alt")
        assertEquals(2, alt.length())
        assertEquals("https://c/c.mp4", alt.getJSONObject(0).getString("u"))   // מהטוב לפחות טוב
        assertEquals(720, alt.getJSONObject(0).getInt("h"))
        assertEquals("https://c/b.mp4", alt.getJSONObject(1).getString("u"))
        assertFalse(DlDeep.withAlt(sum(1, 1).put("u", "x"), emptyList(), 0).has("alt"))
    }

    @Test fun pageDuration() {
        assertEquals(3600, DlDeep.parsePage("""{"d":3600,"vd":30}""")!!.dur)   // JSON-LD גובר על הנגן
        assertEquals(0, DlDeep.parsePage("""{"vd":30}""")!!.dur)               // נגן קצר (כנראה פרסומת) — לא נחשב
        assertEquals(5400, DlDeep.parsePage("""{"vd":5400.4}""")!!.dur)
        assertTrue(DlDeep.EXTRACT.contains("k==='duration'") && DlDeep.EXTRACT.contains("out.vd"))
    }

    @Test fun extractScript() {
        val js = DlDeep.EXTRACT
        assertTrue(js.contains("__NEXT_DATA__") && js.contains("application/ld+json") && js.contains("og:video"))
        assertTrue(js.contains("muted=true"))
        assertFalse(js.contains("fetch(") || js.contains("XMLHttpRequest") || js.contains("sendBeacon"))   // לא שולח כלום
    }
}
