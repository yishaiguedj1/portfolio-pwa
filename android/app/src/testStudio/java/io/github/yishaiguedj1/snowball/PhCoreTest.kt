package io.github.yishaiguedj1.snowball

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 24/10/2026 — תרגום בטלפון: הליבה מול פלט אמיתי של ffprobe/scdet (resources/ph — מסרטון עם קול שמתחיל אחרי הסרטון).
 * meta.expect.json = מה שהעובד מקבל: translator/tests/test_phone.py מריץ עליו את ph_meta_check (אותו קובץ בשני הצדדים).
 * info.expect.json = מה ש־vt/media.py ‏summarize מחשב מאותו probe (ציר הזמן, t0).
 */
class PhCoreTest {
    private fun res(n: String) = javaClass.getResource("/ph/$n")!!.readText()

    @Test fun metaMatchesWhatTheWorkerExpects() {
        val probe = JSONObject(res("probe.json"))
        val m = PhCore.meta(probe, PhCore.shots(res("scdet.txt")))
        val want = JSONObject(res("meta.expect.json"))
        assertEquals(1, m.getInt("v"))
        assertEquals("ה־probe עובר כמו שהוא", probe.toString(), m.getJSONObject("probe").toString())
        val ws0 = want.getJSONObject("probe").getJSONArray("streams")
        assertEquals(ws0.length(), probe.getJSONArray("streams").length())
        for (i in 0 until ws0.length()) assertEquals(ws0.getJSONObject(i).getString("codec_type"), probe.getJSONArray("streams").getJSONObject(i).getString("codec_type"))
        val s = m.getJSONObject("shots"); val ws = want.getJSONObject("shots")
        assertEquals(ws.getDouble("threshold"), s.getDouble("threshold"), 0.0)
        assertEquals(ws.getJSONArray("shots").length(), s.getJSONArray("shots").length())
        for (i in 0 until s.getJSONArray("shots").length()) {
            assertEquals(ws.getJSONArray("shots").getJSONObject(i).getDouble("t"), s.getJSONArray("shots").getJSONObject(i).getDouble("t"), 1e-9)
            assertEquals(ws.getJSONArray("shots").getJSONObject(i).getDouble("score"), s.getJSONArray("shots").getJSONObject(i).getDouble("score"), 1e-9)
        }
    }

    @Test fun infoMatchesVtSummarize() {
        val i = PhCore.info(JSONObject(res("probe.json")))!!
        val e = JSONObject(res("info.expect.json"))
        assertEquals(e.getInt("w"), i.w); assertEquals(e.getInt("h"), i.h)
        assertEquals(e.getString("fps"), i.fpsStr)
        assertEquals(e.getDouble("base"), i.base, 1e-6)
        assertEquals(e.getDouble("vt0"), i.vt0, 1e-6)
        assertEquals(e.getDouble("at0"), i.at0, 1e-6)
        assertEquals(e.getDouble("dur"), i.dur, 1e-6)
        assertTrue(i.hasAudio)
    }

    @Test fun shotsParse() {
        assertEquals(listOf(6.006 to 21.895), PhCore.shots(res("scdet.txt")))
        assertTrue(PhCore.shots("frame=  100 fps=0.0 q=-0.0").isEmpty())
    }

    @Test fun infoRejects() {
        assertNull("בלי וידאו", PhCore.info(JSONObject("""{"format":{"duration":"5"},"streams":[{"codec_type":"audio"}]}""")))
        assertNull("תמונה מצורפת בלבד", PhCore.info(JSONObject("""{"format":{},"streams":[{"codec_type":"video","width":300,"height":300,"disposition":{"attached_pic":1}}]}""")))
        val v = PhCore.info(JSONObject("""{"format":{"duration":"5"},"streams":[{"codec_type":"video","width":1920,"height":1080,"avg_frame_rate":"0/0","r_frame_rate":"25/1"}]}"""))!!
        assertEquals("25/1", v.fpsStr); assertFalse(v.hasAudio)
    }

    @Test fun hostsAndIds() {
        assertTrue(PhCore.hostOk("https://api.thesnowball.app"))
        assertFalse(PhCore.hostOk("https://api.thesnowball.app.evil.com"))
        assertFalse(PhCore.hostOk("http://api.thesnowball.app"))
        assertEquals("https://ibkr-proxy-wine.vercel.app", PhCore.fallback("https://api.thesnowball.app"))
        assertNull(PhCore.fallback("https://api-staging.thesnowball.app"))
        assertTrue(PhCore.PID_RE.matches("p0123456789abcdef"))
        assertFalse(PhCore.PID_RE.matches("p0123456789abcdeg"))
        assertTrue(PhCore.JOB_RE.matches("j" + "a".repeat(20)))
    }

    @Test fun commands() {
        val i = PhCore.info(JSONObject(res("probe.json")))!!
        val b = PhCore.burnArgs("/x/src.mp4", "/x/he.ass", "/x/fonts", i, 640, 360)
        val vf = b[b.indexOf("-vf") + 1]
        assertFalse("ציר שמתחיל ב־0 — בלי setpts", vf.contains("setpts"))
        assertTrue(vf.startsWith("subtitles=filename=/x/he.ass:fontsdir=/x/fonts,scale=640:360,format=nv12"))
        assertEquals(listOf("cfr"), listOf(b[b.indexOf("-fps_mode") + 1]))
        assertEquals("30000/1001", b[b.indexOf("-r") + 1])
        assertEquals("pipe:1", b.last())
        val late = PhCore.Info(1920, 1080, 25, 1, 60.0, 1.5, 0.0, 0.2, "aac", true)
        PhCore.burnArgs("/s", "/a", "/f", late, 1920, 1080).let { assertTrue(it[it.indexOf("-vf") + 1].startsWith("setpts=PTS-1.5/TB,")) }
        val mx = PhCore.muxArgs("/v.mp4", "/s.mkv", "/o.mp4", PhCore.Info(1920, 1080, 25, 1, 60.0, 0.0, 0.04, 0.0, "dts", true), true)
        assertEquals("0.04", mx[mx.indexOf("-itsoffset") + 1])
        assertEquals("aac", mx[mx.indexOf("-c:a") + 1])
        assertTrue(PhCore.mp4Audio("aac")); assertFalse(PhCore.mp4Audio("dts"))
        assertEquals(listOf("-map", "0:a:0", "-vn"), PhCore.audioArgs("/s", "/a.mka").let { it.subList(it.indexOf("-map"), it.indexOf("-map") + 3) })
        assertTrue(PhCore.shotsArgs("/s").contains("scale=320:-2,scdet=threshold=10"))
    }

    @Test fun sizesAndNames() {
        val i = PhCore.Info(3841, 2161, 30, 1, 3600.0, 0.0, 0.0, 0.0, "aac", true)
        assertEquals(3840 to 2160, PhCore.outSize(i, false))
        assertEquals(1278 to 720, PhCore.outSize(i, true))
        assertEquals(PhCore.Info(720, 1280, 30, 1, 1.0, 0.0, 0.0, 0.0, "", true).let { PhCore.outSize(it, true) }, 720 to 1280)
        assertEquals(2_000_000, PhCore.bitrate(10, 60.0, false))
        assertTrue("5 דק׳ לוואטסאפ — וידאו + קול עד 28MB", (PhCore.bitrate(1L shl 30, 300.0, true) + 96_000) * 300.0 / 8 <= PhCore.SMALL_MB * 1_000_000.0)
        assertEquals("שעה — לא יורד מתחת למינימום", 300_000, PhCore.bitrate(1L shl 30, 3600.0, true))
        assertEquals("a_b — עברית.mp4", PhCore.outName("a/b.mov", false))
        assertEquals((0L until 10L), PhCore.part(1, 10, 25)); assertEquals((20L until 25L), PhCore.part(3, 10, 25))
        assertEquals(3, PhCore.parts(25, 10)); assertEquals(1, PhCore.parts(10, 10))
    }
}
