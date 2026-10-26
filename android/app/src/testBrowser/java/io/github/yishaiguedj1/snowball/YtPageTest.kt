package io.github.yishaiguedj1.snowball

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 26/10/2026: רשימת הפורמטים מהנגן שבדף ביוטיוב (YtPage) → אותו סיכום של yt-dlp (DlProbe.summarize) — מיד, בלי לחכות לבדיקה */
class YtPageTest {
    private val url = "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=3"

    /** כמו שה־WebView מחזיר: מחרוזת JSON של המחרוזת שהסקריפט החזיר */
    private fun raw(id: String = "dQw4w9WgXcQ", live: Int = 0, fs: JSONArray = formats()): String =
        JSONObject.quote(JSONObject().put("id", id).put("t", "Never Gonna Give You Up").put("d", 213).put("live", live).put("f", fs).toString())

    private fun row(vararg v: Any) = JSONArray().apply { v.forEach { put(it) } }

    private fun formats() = JSONArray()
        .put(row(137, "video/mp4; codecs=\"avc1.640028\"", 1080, 30, "45000000", 4500000, "1080p", 0, 0))
        .put(row(248, "video/webm; codecs=\"vp9\"", 1080, 30, "30000000", 3000000, "1080p", 0, 0))
        .put(row(136, "video/mp4; codecs=\"avc1.4d401f\"", 720, 30, "20000000", 2000000, "720p", 0, 0))
        .put(row(140, "audio/mp4; codecs=\"mp4a.40.2\"", 0, 0, "3400000", 130000, "", 1, 0))
        .put(row(251, "audio/webm; codecs=\"opus\"", 0, 0, "3600000", 140000, "", 1, 0))
        .put(row(251, "audio/webm; codecs=\"opus\"", 0, 0, "3600000", 140000, "", 2, 0))   // דיבוב — לא
        .put(row(18, "video/mp4; codecs=\"avc1.42001E, mp4a.40.2\"", 360, 30, "", 500000, "360p", 0, 0))

    @Test fun ids() {
        assertEquals("dQw4w9WgXcQ", YtPage.idOf(url))
        assertEquals("dQw4w9WgXcQ", YtPage.idOf("https://youtu.be/dQw4w9WgXcQ?si=x"))
        assertEquals("dQw4w9WgXcQ", YtPage.idOf("https://www.youtube.com/shorts/dQw4w9WgXcQ"))
        assertTrue(YtPage.isYt(url)); assertTrue(YtPage.isYt("https://youtu.be/x"))
        assertTrue(!YtPage.isYt("https://notyoutube.com/watch?v=dQw4w9WgXcQ"))
    }

    @Test fun summaryLikeYtDlp() {
        val info = YtPage.toInfo(raw(), url)
        assertNotNull(info)
        val s = DlProbe.summarize(info!!)
        assertEquals("Never Gonna Give You Up", s.getString("t"))
        val q = s.getJSONArray("q")
        assertEquals(1080, q.getJSONObject(0).getInt("h"))
        assertEquals("248", q.getJSONObject(0).getString("v"))          // VP9 קודם, כמו ב־yt-dlp (V_RANK)
        assertEquals("251", q.getJSONObject(0).getString("a"))          // הקול המקורי, Opus
        assertEquals(33600000L, q.getJSONObject(0).getLong("sz"))       // וידאו + קול, מה־contentLength
        assertEquals(listOf(1080, 720, 360), (0 until q.length()).map { q.getJSONObject(it).getInt("h") })
        assertEquals("251", s.getJSONObject("ao").getString("id"))
        // 360p — וידאו וקול יחד (itag 18): בלי גודל בדף, לפי הקצב והאורך
        assertTrue(q.getJSONObject(2).getLong("sz") > 0)
    }

    @Test fun rejects() {
        assertNull(YtPage.toInfo(raw(), "https://www.ynet.co.il/watch?v=dQw4w9WgXcQ"))   // לא יוטיוב
        assertNull(YtPage.toInfo(raw(id = "aaaaaaaaaaa"), url))                          // הנגן עוד על הסרטון הקודם
        assertNull(YtPage.toInfo(raw(live = 1), url))                                    // שידור חי
        assertNull(YtPage.toInfo("null", url))                                           // הנגן עוד לא עלה
        assertNull(YtPage.toInfo(raw(fs = JSONArray()), url))
        assertNull(YtPage.toInfo(JSONObject.quote("<script>"), url))
    }

    @Test fun drcSkipped() {
        val fs = JSONArray().put(row(251, "audio/webm; codecs=\"opus\"", 0, 0, "3600000", 140000, "", 0, 1))
            .put(row(137, "video/mp4; codecs=\"avc1.640028\"", 1080, 30, "45000000", 4500000, "1080p HDR", 0, 0))
        val s = DlProbe.summarize(YtPage.toInfo(raw(fs = fs), url)!!)
        assertTrue(s.isNull("ao"))
        assertEquals(1, s.getJSONArray("q").getJSONObject(0).getInt("hdr"))
    }
}
