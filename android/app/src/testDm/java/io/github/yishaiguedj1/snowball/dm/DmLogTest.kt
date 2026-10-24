package io.github.yishaiguedj1.snowball.dm

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** היומן של DM: בלי כתובת מלאה, אסימונים, עוגיות, מיילים ונתיבים — ורק מה שמסביר תקלה מ־yt-dlp */
class DmLogTest {
    @Test fun redactsSecrets() {
        val r = DmLog.redact("HTTP Error 403 at https://rr3---sn-x.googlevideo.com/videoplayback?expire=1793&sig=AOq0QJ8wRQIhAKz&ip=1.2.3.4 for a@b.com")
        assertTrue(r, r.contains("<rr3---sn-x.googlevideo.com>"))
        assertFalse(r, r.contains("videoplayback")); assertFalse(r, r.contains("AOq0")); assertFalse(r, r.contains("a@b.com"))
        assertEquals("Cookie=<…>; token=<…>", DmLog.redact("Cookie: SID=abc;  token=xyz"))
        assertEquals("bearer <…>", DmLog.redact("Bearer eyJhbGciOi.J9.x"))
        assertFalse(DmLog.redact("open /storage/emulated/0/Android/data/app/files/dl/x/My video.mp4").contains("emulated"))
        assertEquals("<…>", DmLog.redact("A".repeat(40)))
        assertTrue(DmLog.redact("x".repeat(500)).length <= DmLog.MSG_MAX + 1)
        assertEquals("", DmLog.redact(null))
    }

    @Test fun domainAndName() {
        assertEquals("youtube.com", DmLog.domain("https://www.youtube.com/watch?v=abc&t=3"))
        assertEquals("a.mp4", DmLog.cleanName("/x/y/a.mp4"))
    }

    @Test fun tailKeepsOnlyErrors() {
        val t = DmLog.Tail(2)
        t.add("[download]  10.0% of 5MiB at 1MiB/s ETA 00:04")
        t.add("[youtube] abc: Downloading webpage")
        t.add("WARNING: [youtube] nsig extraction failed")
        t.add("ERROR: unable to download https://x.com/a?sig=1234567890abcdef")
        t.add("[download] Got error: HTTP Error 403: Forbidden. Retrying (1/10)...")
        assertEquals(2, t.list().size)
        assertTrue(t.list()[0].startsWith("ERROR"))
        assertFalse(t.list()[0].contains("sig=1"))
    }

    @Test fun jsonRoundTripAndExport() {
        val e = DmLog.Event(1000, "fail", "id1", "yt", "youtube.com", "a.mp4", "blocked", 100, 40, 2000, 20, 0, 1, "IOException", "x", listOf("ERROR: y"))
        assertEquals(e, DmLog.Event.of(JSONObject(e.json().toString())))
        val s = DmLog.export("head", listOf(e, e.copy(k = "start", code = "", tail = emptyList())))
        assertTrue(s.startsWith("head\n\n"))
        assertTrue(s.indexOf("start") < s.indexOf("fail"))   // מהחדש לישן
        assertTrue(s.contains("    | ERROR: y"))
        assertFalse(e.json().has("url"))
    }
}
