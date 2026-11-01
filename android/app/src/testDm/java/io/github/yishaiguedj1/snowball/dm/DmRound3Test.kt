package io.github.yishaiguedj1.snowball.dm

import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.Random

/** סבב 3 של השדרוג (01/11/2026): תורים, חלונות, תיקיות, חוקים, פעולות בסיום, בודק APK, מגבלות ומכסות, ממשק לאפליקציות */
class DmRound3Test {
    private lateinit var srv: ServerSocket
    private lateinit var base: String
    @Volatile private var body = ByteArray(0)

    @Before fun up() {
        srv = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        base = "http://127.0.0.1:${srv.localPort}"
        Thread { while (!srv.isClosed) { val c = runCatching { srv.accept() }.getOrNull() ?: break; Thread { serve(c) }.apply { isDaemon = true; start() } } }
            .apply { isDaemon = true; start() }
    }

    @After fun down() { srv.close() }

    private fun serve(c: Socket) = c.use { s ->
        val inp = s.getInputStream().bufferedReader(Charsets.ISO_8859_1)
        inp.readLine() ?: return
        val h = HashMap<String, String>()
        while (true) { val l = inp.readLine() ?: break; if (l.isEmpty()) break; val i = l.indexOf(':'); if (i > 0) h[l.substring(0, i).lowercase()] = l.substring(i + 1).trim() }
        val out = s.getOutputStream(); val b = body
        val rg = Regex("bytes=(\\d+)-(\\d*)").find(h["range"] ?: "")
        if (rg != null) {
            val a = rg.groupValues[1].toLong(); val e = rg.groupValues[2].toLongOrNull()?.coerceAtMost(b.size - 1L) ?: (b.size - 1L)
            out.write(("HTTP/1.1 206 Partial Content\r\nContent-Range: bytes $a-$e/${b.size}\r\nContent-Length: ${e - a + 1}\r\nETag: \"e3\"\r\n" +
                "Content-Type: application/octet-stream\r\nConnection: close\r\n\r\n").toByteArray())
            runCatching { out.write(b, a.toInt(), (e - a + 1).toInt()) }
        } else {
            out.write("HTTP/1.1 200 OK\r\nContent-Length: ${b.size}\r\nConnection: close\r\n\r\n".toByteArray()); out.write(b)
        }
        out.flush()
    }

    // ---------- חלון זמן ----------
    @Test fun window() {
        val work = DmWindow(0x1f, 9 * 60, 18 * 60)              // ראשון–חמישי 09:00–18:00
        assertTrue(work.open(0, 9 * 60)); assertTrue(work.open(4, 17 * 60 + 59))
        assertFalse(work.open(0, 18 * 60)); assertFalse(work.open(5, 12 * 60))   // שישי
        assertEquals(60, work.untilOpen(0, 8 * 60))
        assertEquals(0, work.untilOpen(1, 10 * 60))
        assertEquals(60, work.untilClose(1, 17 * 60))
        assertEquals(2 * 1440 + 9 * 60 - 20 * 60, work.untilOpen(4, 20 * 60))   // חמישי בערב → ראשון בבוקר
        val night = DmWindow(DmWindow.ALL, 23 * 60, 6 * 60)     // כל לילה 23:00–06:00
        assertTrue(night.open(3, 23 * 60 + 30)); assertTrue(night.open(4, 2 * 60)); assertFalse(night.open(4, 7 * 60))
        assertEquals(7 * 60 - 30, night.untilClose(3, 23 * 60 + 30))
        val friNight = DmWindow(1 shl 5, 23 * 60, 6 * 60)       // רק בליל שישי — שבת בבוקר נשארת פתוחה עד 06:00
        assertTrue(friNight.open(6, 5 * 60)); assertFalse(friNight.open(0, 5 * 60))
        assertTrue(DmWindow().always); assertEquals(-1, DmWindow().untilClose(0, 0))
        assertEquals(-1, DmWindow(0, 60, 120).untilOpen(0, 0))
        val sat = DmWindow(1 shl 6, 0, 0)                        // כל יום שבת
        assertTrue(sat.open(6, 0) && sat.open(6, 1439)); assertFalse(sat.open(0, 0))
        assertEquals(DmWindow(5, 10, 20), DmWindow.parse(DmWindow(5, 10, 20).dump()))
        assertEquals(9 * 60 + 30, DmWindow.hm("9:30")); assertEquals(-1, DmWindow.hm("25:00")); assertEquals("07:05", DmWindow.fmt(425))
    }

    // ---------- תורים ----------
    @Test fun queues() {
        val night = DmQueue("q1", "לילה", parallel = 1, wifi = true, win = DmWindow(DmWindow.ALL, 23 * 60, 6 * 60), tries = 3)
        val movies = DmQueue("q2", "Movies", parallel = 2)
        val qs = DmQueues.parse(DmQueues.dump(listOf(night, movies, night)))
        assertEquals(listOf(night, movies), qs)                  // בלי כפולים, חוזר כמו שנשמר
        assertEquals(movies, DmQueues.find(qs, "movies"))
        assertEquals("q3", DmQueues.newId(qs))
        assertEquals("window", DmQueues.block(night, true, 2, 12 * 60))
        assertEquals("wifi", DmQueues.block(night, false, 2, 23 * 60 + 5))
        assertNull(DmQueues.block(night, true, 2, 23 * 60 + 5)); assertNull(DmQueues.block(null, false, 0, 0))
        // q1 כבר רץ אחד (תקרה 1) — רק מהתורים האחרים; q2 עד 2
        assertEquals(listOf(1, 2, 4), DmQueues.gate(listOf("q1", "q2", "q2", "q2", ""), mapOf("q1" to 1), mapOf("q1" to 1, "q2" to 2)))
        assertTrue(DmQueues.retry(night, 1, "net")); assertFalse(DmQueues.retry(night, 3, "net"))
        assertFalse(DmQueues.retry(night, 0, "space")); assertFalse(DmQueues.retry(movies, 0, "net"))
        assertNull(DmQueues.ended(listOf(DmState.DONE, DmState.QUEUED)))
        assertEquals(DmQueues.End(2, 1), DmQueues.ended(listOf(DmState.DONE, DmState.FAILED, DmState.DONE, DmState.PAUSED)))
        assertTrue(DmQueues.parse("[{\"id\":\"BAD!\",\"n\":\"x\"}]").isEmpty())
    }

    // ---------- תיקיות ----------
    @Test fun folders() {
        val m = DmFolders.parse(DmFolders.dump(mapOf("VIDEO" to "sub:סדרות/עונה 1/עוד", ".pdf" to "sub:Docs", "AUDIO" to "tree:content://x/tree/1", "OTHER" to "sub:../..")))
        assertEquals("sub:סדרות/עונה 1", m["VIDEO"])               // עד שתי רמות
        assertEquals("sub:Docs", DmFolders.pick(m, "book.pdf", ""))
        assertEquals("sub:סדרות/עונה 1", DmFolders.pick(m, "ep.mkv", ""))
        assertEquals("tree:content://x/tree/1", DmFolders.pick(m, "a.mp3", ""))
        assertEquals("", DmFolders.pick(m, "x.bin", ""))            // ‎..‎ נזרק
        assertEquals("Movies/Studio DM/סדרות/עונה 1", DmFolders.rel("Movies/Studio DM", m["VIDEO"]!!))
        assertEquals("", DmFolders.norm("tree:file:///sdcard"))
        assertEquals("a/b", DmFolders.cleanSub("/a//b/"))
    }

    // ---------- חוקים ----------
    @Test fun rules() {
        val rs = DmRules.parse(DmRules.dump(listOf(
            DmRule(host = "cdn.example.org", ext = "mp4, MKV", queue = "q2", dir = "sub:Films", conns = 4, lim = 1 shl 20, name = "{date} {base}", done = "hash,open"),
            DmRule(host = "", ext = "zip", done = "unzip"),
            DmRule(host = "*.off.example", on = false),
            DmRule(host = "*", ext = "pdf", dir = "sub:Docs"),
        )))
        assertEquals(4, rs.size)
        val r = DmRules.match(rs, "https://v.cdn.example.org/a/ep1.MKV", "ep1.MKV")!!
        assertEquals("q2", r.queue); assertEquals(4, r.conns); assertEquals(setOf(DmOnDone.A.HASH, DmOnDone.A.OPEN), DmOnDone.parse(r.done))
        assertNull(DmRules.match(rs, "https://notcdn.example.org/ep.mp4", "ep.mp4"))   // לא תת־אתר
        assertEquals(setOf(DmOnDone.A.UNZIP), DmOnDone.parse(DmRules.match(rs, "https://any.example/x.zip", "x.zip")!!.done))
        assertNull(DmRules.match(rs, "https://a.off.example/x.iso", "x.iso"))           // כבוי
        assertEquals("sub:Docs", DmRules.match(rs, "https://www.b.example/f.pdf", "f.pdf")!!.dir)
        assertEquals("2026-11-01 ep1.mkv", DmRules.rename("{date} {base}", "ep1.mkv", "https://x.example/ep1.mkv", "2026-11-01"))
        assertEquals("x.example-a_b.zip", DmRules.rename("{host}-{base}", "a_b.zip", "https://www.x.example/a", "d"))
        assertEquals("a.zip", DmRules.rename("", "a.zip", "", ""))
        assertFalse(DmRules.rename("x/y", "a.zip", "", "").contains("/"))
        assertTrue(DmRules.parse("[{\"h\":\"bad host!\",\"x\":\"\"}]").isEmpty())
    }

    // ---------- פעולות בסיום ----------
    @Test fun onDone() {
        val s = DmOnDone.sidecars("https://dl.example/v1/app.iso?t=9#x")
        assertEquals("https://dl.example/v1/app.iso.sha256?t=9", s[0])
        assertTrue(s.contains("https://dl.example/v1/SHA256SUMS"))
        val a = "a".repeat(64); val b = "b".repeat(64)
        assertEquals(b, DmOnDone.sumFor("$a  other.iso\n$b *app.iso\n", "app.iso"))
        assertEquals(a, DmOnDone.sumFor("SHA256 (dist/app.iso) = $a", "app.iso"))
        assertEquals(a, DmOnDone.sumFor("$a\n", "anything.iso"))                       // קובץ .sha256 עם hex בלבד
        assertNull(DmOnDone.sumFor("$a  other.iso", "app.iso"))
        assertNull(DmOnDone.sumFor("<html>not found</html>", "app.iso"))
        assertEquals("open,hash,silent", DmOnDone.dump(DmOnDone.parse("SILENT,open,hash,bogus")))
    }

    // ---------- בודק APK ----------
    @Test fun apkCheck() {
        assertEquals("0A:FF:10", DmApkCheck.hex(byteArrayOf(10, -1, 16)))
        val me = setOf("AA"); val other = setOf("BB")
        assertEquals(DmApkCheck.V.NEW, DmApkCheck.verdict(me, 5, null, 0))
        assertEquals(DmApkCheck.V.UPDATE, DmApkCheck.verdict(me, 6, me, 5))
        assertEquals(DmApkCheck.V.SAME, DmApkCheck.verdict(me, 5, me, 5))
        assertEquals(DmApkCheck.V.DOWNGRADE, DmApkCheck.verdict(me, 4, me, 5))
        assertEquals(DmApkCheck.V.OTHER_SIG, DmApkCheck.verdict(other, 9, me, 5))
        assertEquals(DmApkCheck.V.UNSIGNED, DmApkCheck.verdict(emptySet(), 9, null, 0))
        assertTrue(DmApkCheck.warn(DmApkCheck.V.OTHER_SIG)); assertFalse(DmApkCheck.warn(DmApkCheck.V.UPDATE))
        assertEquals(listOf("READ_SMS", "CAMERA"), DmApkCheck.risky(listOf("android.permission.INTERNET", "android.permission.READ_SMS", "android.permission.CAMERA")))
    }

    // ---------- מגבלות ומכסות ----------
    @Test fun speedPlan() {
        val sl = DmSpeed.parse(DmSpeed.dump(listOf(DmSlot(DmWindow(0x1f, 9 * 60, 18 * 60), 2L shl 20))) + ";bad;1,2,3,0")
        assertEquals(1, sl.size)
        assertEquals(2L shl 20, DmSpeed.now(0, sl, false, 0, 1, 10 * 60))
        assertEquals(0L, DmSpeed.now(0, sl, false, 0, 1, 20 * 60))
        assertEquals(5L shl 20, DmSpeed.now(5L shl 20, sl, false, 0, 1, 20 * 60))
        assertEquals(1L shl 20, DmSpeed.now(0, sl, true, 1L shl 20, 1, 10 * 60))   // בסלולר — הנמוך
        assertEquals(1L shl 20, DmSpeed.now(0, emptyList(), true, 1L shl 20, 1, 10 * 60))
    }

    @Test fun bucket() {
        var t = 0L; var slept = 0L
        val b = DmBucket({ 1000L }, { t })
        repeat(10) { b.take(500, { ms -> slept += ms; t += ms * 1_000_000 }) }
        assertTrue("slept=$slept", slept in 4000..5500)            // 5,000 בתים בקצב 1,000 לשנייה
        val off = DmBucket({ 0L }, { 0L }); var s2 = 0L
        off.take(1 shl 30) { s2 += it }; assertEquals(0L, s2)
    }

    @Test fun quota() {
        var u = DmQuota.roll(DmQuota.Use(), 20261101, 202611)
        u = DmQuota.add(u, 600, true); u = DmQuota.add(u, 100, false)
        val c = DmQuota.Caps(dayC = 500, monW = 1000)
        assertEquals("day", DmQuota.over(u, c, true)); assertNull(DmQuota.over(u, c, false))
        u = DmQuota.add(u, 900, false)
        assertEquals("month", DmQuota.over(u, c, false))
        u = DmQuota.roll(u, 20261102, 202611)
        assertNull(DmQuota.over(u, c, true)); assertEquals(1000L, u.mW)        // יום חדש — החודש נשאר
        u = DmQuota.roll(u, 20261201, 202612)
        assertNull(DmQuota.over(u, c, false))
        assertEquals(u, DmQuota.parseUse(DmQuota.dumpUse(u)))
        assertEquals(c, DmQuota.parseCaps(DmQuota.dumpCaps(c)))
    }

    /** מגבלה להורדה אחת, מול שרת אמיתי: 256KB בקצב 512KB/שנ׳ = חצי שנייה לפחות, והקובץ זהה */
    @Test fun perTaskLimitOnServer() {
        body = ByteArray(256 shl 10).also { Random(5).nextBytes(it) }
        val p = DmFetch.probe("$base/f.bin")
        val t = DmTask("limTest01", "$base/f.bin").apply { total = p.total; ranges = p.ranges; etag = p.etag; lim = 512L shl 10 }
        val out = ByteArray(body.size)
        val sink = object : DmSink {
            override fun write(pos: Long, buf: ByteArray, len: Int) { synchronized(out) { System.arraycopy(buf, 0, out, pos.toInt(), len) } }
            override fun sync() {}
        }
        val t0 = System.nanoTime()
        val f = DmFetch(t, sink, 2, own = DmBucket({ t.lim }))
        assertEquals(DmFetch.Result.Done, f.run({ false }))
        val ms = (System.nanoTime() - t0) / 1_000_000
        assertArrayEquals(body, out)
        assertTrue("ms=$ms", ms >= 350)
    }

    // ---------- ממשק לאפליקציות ----------
    @Test fun api() {
        val ex = mapOf("url" to "https://a.example/x.zip", "name" to "my/file?.zip", "queue" to " לילה ", "folder" to "../Work", "quiet" to "1")
        val r = DmApi.parse({ ex[it] }, true)!!
        assertEquals(listOf("https://a.example/x.zip"), r.urls); assertTrue(r.quiet); assertEquals("לילה", r.queue); assertEquals("Work", r.folder)
        assertFalse(r.name.contains("/") || r.name.contains("?"))
        assertFalse(DmApi.parse({ ex[it] }, false)!!.quiet)           // בלי ההרשאה — תמיד עם הגיליון
        assertNull(DmApi.parse({ mapOf("url" to "file:///sdcard/x")[it] }, true))
        assertNull(DmApi.parse({ mapOf("url" to "javascript:alert(1)")[it] }, true))
        val d = DmApi.fromUri("studiodm://add?url=https%3A%2F%2Fb.example%2Fa.mp4&later=1&quiet=1&name=A")!!
        assertEquals(listOf("https://b.example/a.mp4"), d.urls); assertTrue(d.later); assertFalse(d.quiet); assertEquals("A", d.name)
        val many = DmApi.parse({ if (it == "urls") "https://a.example/1.zip https://a.example/2.zip" else null }, true)!!
        assertEquals(2, many.urls.size); assertEquals("", many.name)
        assertNull(DmApi.fromUri("https://add?url=https://x.example/a"))
    }

    // ---------- המשימה נשמרת עם השדות החדשים ----------
    @Test fun taskJson() {
        val t = DmTask("r3Task0001", "https://a.example/x.mp4").apply { q = "q2"; dir = "sub:Films"; conns = 4; lim = 1000; onDone = "hash"; sum = "ok" }
        val b = DmTask.of(t.json())!!
        assertEquals("q2", b.q); assertEquals("sub:Films", b.dir); assertEquals(4, b.conns); assertEquals(1000L, b.lim); assertEquals("hash", b.onDone); assertEquals("ok", b.sum)
        assertEquals("", DmTask.of(t.json().put("dr", "sub:../.."))!!.dir)
    }
}
