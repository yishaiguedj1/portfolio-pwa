package io.github.yishaiguedj1.snowball.dm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DmCoreTest {
    @Test fun initialSegments() {
        val s = DmSegs.initial(100L shl 20, true, 8)
        assertEquals(8, s.size)
        assertEquals(0L, s.first().start); assertEquals(100L shl 20, s.last().end)
        for (i in 1 until s.size) assertEquals(s[i - 1].end, s[i].start)
        assertEquals(1, DmSegs.initial(3L shl 20, false, 8).size)
        assertEquals(3, DmSegs.initial(3L shl 20, true, 8).size)   // לא קטן מ־1MB
        assertEquals(Long.MAX_VALUE, DmSegs.initial(-1, true, 8)[0].end)
    }

    @Test fun splitTakesHalfOfLargestRemaining() {
        val segs = mutableListOf(Seg(0, 10L shl 20, 9L shl 20), Seg(10L shl 20, 20L shl 20, 1L shl 20))
        val n = DmSegs.split(segs)!!
        assertEquals((10L shl 20) + (1L shl 20) + (9L shl 20) / 2, n.start)
        assertEquals(20L shl 20, n.end)
        assertEquals(n.start, segs[1].end)
        assertEquals(3, segs.size)
        assertNull(DmSegs.split(mutableListOf(Seg(0, 3L shl 20 / 2))))   // קטן מדי לחיתוך
    }

    @Test fun completeAndCompact() {
        val segs = mutableListOf(Seg(0, 10, 10), Seg(10, 20, 10), Seg(20, 30, 4))
        assertFalse(DmSegs.complete(segs, 30))
        segs[2].done = 10
        assertTrue(DmSegs.complete(segs, 30))
        DmSegs.compact(segs)
        assertEquals(1, segs.size); assertEquals(30L, segs[0].done)
        assertFalse(DmSegs.complete(listOf(Seg(0, 10, 10), Seg(12, 30, 18)), 30))   // רווח
    }

    @Test fun retryVerdicts() {
        assertEquals(DmRetry.Act.RETRY, DmRetry.http(503).act)
        assertEquals("expired", DmRetry.http(403).code)
        assertEquals(DmRetry.Act.FATAL, DmRetry.http(404).act)
        assertEquals(DmRetry.Act.RESTART, DmRetry.http(416).act)
        assertEquals("net", DmRetry.io(java.net.SocketTimeoutException()).code)
        assertEquals("space", DmRetry.io(DmSpace()).code)
        assertEquals(1000L, DmRetry.backoffMs(0)); assertEquals(60_000L, DmRetry.backoffMs(20)); assertEquals(5000L, DmRetry.backoffMs(3, 5))
    }

    @Test fun names() {
        assertEquals("דוח שנתי.pdf", DmName.fromDisposition("attachment; filename*=UTF-8''%D7%93%D7%95%D7%97%20%D7%A9%D7%A0%D7%AA%D7%99.pdf"))
        assertEquals("a b.zip", DmName.fromDisposition("attachment; filename=\"a b.zip\""))
        assertEquals("x.mp4", DmName.fromUrl("https://cdn.example.com/v/x.mp4?sig=1#t"))
        assertEquals("a_b_c.txt", DmName.clean("a/b:c.txt"))
        assertEquals("video.mp4", DmName.pick(null, "https://e.com/video", "video/mp4"))
        assertEquals("download", DmName.pick(null, "https://e.com/", ""))
        assertTrue(DmName.clean("x".repeat(300) + ".mkv").let { it.length <= 120 && it.endsWith(".mkv") })
        assertEquals(DmName.Cat.VIDEO, DmName.cat("a.mkv", "")); assertEquals(DmName.Cat.ARCHIVE, DmName.cat("a.7z", ""))
        assertEquals(DmName.Cat.AUDIO, DmName.cat("x", "audio/mpeg"))
    }

    @Test fun links() {
        assertEquals("https://e.com/a.mp4", DmLink.first("תראה את זה: https://e.com/a.mp4."))
        assertEquals("", DmLink.first("אין כאן קישור"))
    }

    @Test fun taskJsonRoundTrip() {
        val t = DmTask("abc12345", "https://e.com/a.bin", "https://e.com/p").apply {
            name = "a.bin"; total = 100; ranges = true; etag = "\"x\""; state = DmState.RUNNING
            segs = mutableListOf(Seg(0, 50, 20), Seg(50, 100, 0))
        }
        val back = DmTask.listOf(DmTask.listJson(listOf(t)))
        assertEquals(1, back.size)
        val b = back[0]
        assertEquals(DmState.QUEUED, b.state)   // רץ כשהתהליך מת → חוזר לתור
        assertEquals(20L, b.got); assertEquals(2, b.segs.size); assertEquals("\"x\"", b.etag)
        assertTrue(DmTask.listOf("לא json").isEmpty())
        assertNull(DmTask.of(org.json.JSONObject().put("id", "../x").put("u", "https://e.com")))
    }
}
