package io.github.yishaiguedj1.snowball.dm

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

/** "תואם לכל מכשיר": H.264 + AAC באותה רזולוציה; בלי H.264 בגובה הזה — נשאר מה שנבחר */
class DmCodecTest {
    private fun f(id: String, k: String, h: Int, c: String, ac: String = "", sz: Long = 0, br: Long = 0, fps: Int = 30, hdr: Int = 0) =
        JSONObject().put("id", id).put("k", k).put("h", h).put("c", c).put("ac", ac).put("sz", sz).put("br", br).put("fps", fps).put("hdr", hdr)
    private val fm = JSONArray(listOf(
        f("399", "v", 1080, "av1", sz = 90_000_000), f("137", "v", 1080, "h264", sz = 130_000_000, br = 4000),
        f("248", "v", 1080, "vp9", sz = 100_000_000), f("136", "v", 720, "h264", sz = 60_000_000),
        f("251", "a", 0, "", "opus", sz = 20_000_000, br = 130), f("140", "a", 0, "", "mp4a.40.2", sz = 21_000_000, br = 128)))
    private val q1080 = JSONObject().put("h", 1080).put("v", "399").put("a", "251").put("c", "av1").put("sz", 110_000_000L)
    private val ao = JSONObject().put("id", "251").put("sz", 20_000_000L)

    @Test fun smallKeepsChoice() {
        assertEquals(DmCodec.Pick("399", "251", "av1", 110_000_000), DmCodec.prefer(q1080, fm, ao, DmCodec.SMALL))
    }

    @Test fun compatPicksH264AndAac() {
        assertEquals(DmCodec.Pick("137", "140", "h264", 151_000_000), DmCodec.prefer(q1080, fm, ao, DmCodec.COMPAT))
    }

    @Test fun compatWithoutH264AtHeightKeeps() {
        val q4k = JSONObject().put("h", 2160).put("v", "401").put("a", "251").put("c", "av1").put("sz", 300L)
        assertEquals("401", DmCodec.prefer(q4k, fm, ao, DmCodec.COMPAT).v)
    }

    @Test fun compatCombinedNoSeparateAudio() {
        val fm2 = JSONArray(listOf(f("18", "av", 360, "h264", "mp4a", sz = 9)))
        val q = JSONObject().put("h", 360).put("v", "243").put("a", "251").put("c", "vp9").put("sz", 8L)
        assertEquals(DmCodec.Pick("18", "", "h264", 9), DmCodec.prefer(q, fm2, ao, DmCodec.COMPAT))
    }
}
