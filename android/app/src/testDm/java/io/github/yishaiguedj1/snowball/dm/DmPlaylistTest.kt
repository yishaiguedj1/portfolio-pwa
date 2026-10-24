package io.github.yishaiguedj1.snowball.dm

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** פלט ‎--flat-playlist -J‎ של yt-dlp (מבנה של 2026) → רשימה; סרטונים פרטיים/כפולים יוצאים */
class DmPlaylistTest {
    private fun e(id: String, t: String, url: String = id) = JSONObject().put("_type", "url").put("ie_key", "Youtube").put("id", id).put("url", url).put("title", t).put("duration", 61.4)

    @Test fun parse() {
        val o = JSONObject().put("_type", "playlist").put("title", "הרצאות").put("uploader", "ערוץ").put("entries", JSONArray(listOf(
            e("dQw4w9WgXcQ", "אחת", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"), e("aaaaaaaaaaa", "שתיים"), e("aaaaaaaaaaa", "כפול"),
            e("bbbbbbbbbbb", "[Private video]"), JSONObject().put("id", "bad id").put("url", "x"))))
        val p = DmPlaylist.parse(o)!!
        assertEquals("הרצאות", p.title); assertEquals(2, p.entries.size)
        assertEquals("https://www.youtube.com/watch?v=aaaaaaaaaaa", p.entries[1].url); assertEquals(61, p.entries[1].dur)
        assertNull(DmPlaylist.parse(JSONObject().put("_type", "video")))
        assertNull(DmPlaylist.parse(JSONObject().put("_type", "playlist").put("entries", JSONArray())))
    }

    @Test fun listUrl() {
        assertEquals("https://www.youtube.com/playlist?list=PL1234567890ab", DmPlaylist.listUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890ab&index=2"))
        assertEquals("", DmPlaylist.listUrl("https://example.com/watch?list=PL1234567890ab"))
        assertEquals("", DmPlaylist.listUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
    }

    @Test fun format() {
        assertEquals("ba/b", DmPlaylist.format(1080, true, DmCodec.SMALL))
        assertEquals("bv*[height<=720]+ba/b[height<=720]/bv*+ba/b", DmPlaylist.format(720, false, DmCodec.SMALL))
        assertEquals(true, DmPlaylist.format(0, false, DmCodec.COMPAT).startsWith("bv*[height<=4320][vcodec^=avc1]+ba[acodec^=mp4a]/"))
    }
}
