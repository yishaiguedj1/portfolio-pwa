package io.github.yishaiguedj1.snowball.dm

import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.io.RandomAccessFile
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.Random
import java.util.concurrent.atomic.AtomicInteger

/**
 * המבחן של שלב 1 ("תמיד מסתיים"): שרת אמיתי ב־JVM שמנתק חיבורים באמצע, עונה 503, ומחליף את הקובץ —
 * ובסוף הקובץ שירד זהה בבית לבית (SHA-256), גם אחרי עצירה והמשך מהמקטעים השמורים.
 */
class DmFetchTest {
    private lateinit var srv: ServerSocket
    private lateinit var base: String
    private var body = ByteArray(0)
    @Volatile private var etag = "\"v1\""
    @Volatile private var ranges = true
    @Volatile private var cutEvery = 0          // לנתק חיבור אחרי כמה בתים (0 = לא)
    @Volatile private var fail503 = 0           // כמה בקשות ראשונות יקבלו 503
    @Volatile private var status = 0            // תשובה קבועה (404 וכו')
    @Volatile private var slow = true
    private val hits = AtomicInteger()
    private val maxParallel = AtomicInteger()
    private val now = AtomicInteger()

    @Before fun up() {
        body = ByteArray(9 * 1024 * 1024 + 12345).also { Random(7).nextBytes(it) }
        // שרת HTTP קטן משלנו (בבדיקות של אנדרואיד אין com.sun.net.httpserver): חיבור = בקשה אחת
        srv = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        Thread { while (!srv.isClosed) { val c = runCatching { srv.accept() }.getOrNull() ?: break; Thread { serve(c) }.apply { isDaemon = true; start() } } }
            .apply { isDaemon = true; start() }
        base = "http://127.0.0.1:${srv.localPort}"
    }

    @After fun down() { srv.close() }

    private class Ex(val sock: Socket) {
        val requestHeaders = HashMap<String, String>()
        val responseHeaders = LinkedHashMap<String, String>()
        val out = sock.getOutputStream()
        init {
            val inp = sock.getInputStream().bufferedReader(Charsets.ISO_8859_1)
            inp.readLine()
            while (true) { val l = inp.readLine() ?: break; if (l.isEmpty()) break; val i = l.indexOf(':'); if (i > 0) requestHeaders[l.substring(0, i).trim().lowercase()] = l.substring(i + 1).trim() }
        }
        fun header(k: String) = requestHeaders[k.lowercase()]
        fun send(status: Int, len: Long) {
            val sb = StringBuilder("HTTP/1.1 $status X\r\n")
            responseHeaders.forEach { (k, v) -> sb.append("$k: $v\r\n") }
            sb.append("Content-Length: ${len.coerceAtLeast(0)}\r\nConnection: close\r\n\r\n")
            out.write(sb.toString().toByteArray(Charsets.ISO_8859_1)); out.flush()
        }
    }

    private fun serve(sock: Socket) {
        val ex = runCatching { Ex(sock) }.getOrNull() ?: run { sock.close(); return }
        val n = hits.incrementAndGet()
        val cur = now.incrementAndGet(); maxParallel.accumulateAndGet(cur) { a, b -> maxOf(a, b) }
        try {
            if (status != 0) { ex.send(status, 0); return }
            if (n <= fail503) { ex.responseHeaders["Retry-After"] = "1"; ex.send(503, 0); return }
            ex.responseHeaders["ETag"] = etag
            ex.responseHeaders["Content-Type"] = "application/octet-stream"
            val rh = ex.header("Range")
            val ifr = ex.header("If-Range")
            var from = 0; var to = body.size - 1; var part = false
            if (ranges && rh != null && (ifr == null || ifr == etag)) {
                val m = Regex("bytes=(\\d+)-(\\d*)").find(rh)!!
                from = m.groupValues[1].toInt(); to = m.groupValues[2].toIntOrNull()?.coerceAtMost(body.size - 1) ?: (body.size - 1)
                part = true
                ex.responseHeaders["Content-Range"] = "bytes $from-$to/${body.size}"
            }
            val len = (to - from + 1).toLong()
            ex.send(if (part) 206 else 200, len)
            ex.out.let { out ->
                var p = from; var sent = 0
                while (p <= to) {
                    val k = minOf(32 * 1024, to - p + 1)
                    if (cutEvery > 0 && sent + k > cutEvery && Random().nextInt(3) == 0) return   // ניתוק באמצע
                    out.write(body, p, k); p += k; sent += k
                    if (slow) Thread.sleep(1)   // כמו רשת אמיתית: החיבורים חופפים בזמן
                }
            }
        } catch (e: Exception) {
        } finally { now.decrementAndGet(); runCatching { sock.close() } }
    }

    private class FileSink(f: File) : DmSink {
        private val raf = RandomAccessFile(f, "rw")
        @Synchronized override fun write(pos: Long, buf: ByteArray, len: Int) { raf.seek(pos); raf.write(buf, 0, len) }
        @Synchronized override fun sync() { raf.fd.sync() }
        fun close() = raf.close()
    }

    private fun sha(b: ByteArray) = MessageDigest.getInstance("SHA-256").digest(b)

    private fun task(): DmTask {
        val p = DmFetch.probe("$base/f.bin")
        return DmTask("t1abcdef", p.finalUrl).apply { total = p.total; ranges = p.ranges; etag = p.etag; lastMod = p.lastMod }
    }

    private fun download(t: DmTask, conns: Int, stop: () -> Boolean = { false }): Pair<DmFetch.Result, File> {
        val f = File.createTempFile("dmt", ".bin").also { it.deleteOnExit() }
        val s = FileSink(f)
        val r = DmFetch(t, s, conns, sleep = { Thread.sleep(minOf(it, 20)) }, minSeg = 256 * 1024).run(stop)
        s.close()
        return r to f
    }

    @Test fun probeRetriesBusyServer() {
        fail503 = 2
        val p = DmFetch.probeRetry("$base/f.bin", sleep = {})
        assertEquals(body.size.toLong(), p.total)
    }

    @Test fun probeReadsRangeAndSize() {
        val p = DmFetch.probe("$base/f.bin")
        assertEquals(body.size.toLong(), p.total); assertTrue(p.ranges); assertEquals("\"v1\"", p.etag)
        ranges = false
        val q = DmFetch.probe("$base/f.bin")
        assertEquals(false, q.ranges); assertEquals(body.size.toLong(), q.total)
    }

    @Test fun parallelWithDisconnectsIsByteExact() {
        val t = task()
        cutEvery = 200 * 1024; fail503 = hits.get() + 2
        val (r, f) = download(t, 8)
        assertEquals(DmFetch.Result.Done, r)
        assertArrayEquals(sha(body), sha(f.readBytes()))
        assertTrue("בכמה חיבורים במקביל", maxParallel.get() >= 3)
    }

    @Test fun stopAndResumeFromSavedSegments() {
        val t = task()
        val f = File.createTempFile("dmt", ".bin").also { it.deleteOnExit() }
        var s = FileSink(f)
        val fetch = DmFetch(t, s, 4, minSeg = 256 * 1024)
        val r1 = fetch.run({ fetch.bytes > 3L * 1024 * 1024 })
        s.close()
        assertEquals(DmFetch.Result.Stopped, r1)
        // "הריגה": שומרים ומשחזרים את המשימה מ־JSON, וממשיכים לאותו קובץ
        val back = DmTask.of(t.json())!!
        assertTrue(back.got in 1 until body.size.toLong())
        val before = back.got
        s = FileSink(f)
        val f2 = DmFetch(back, s, 4, minSeg = 256 * 1024)
        assertEquals(DmFetch.Result.Done, f2.run({ false }))
        s.close()
        assertArrayEquals(sha(body), sha(f.readBytes()))
        assertTrue("לא הורד מחדש מההתחלה", f2.bytes <= body.size - before + 8 * 64 * 1024)
    }

    @Test fun changedFileRestartsNotMixed() {
        val t = task()
        val f = File.createTempFile("dmt", ".bin").also { it.deleteOnExit() }
        var s = FileSink(f)
        val a = DmFetch(t, s, 4, minSeg = 256 * 1024)
        a.run({ a.bytes > 2L * 1024 * 1024 }); s.close()
        // הקובץ בשרת השתנה (ETag חדש) — If-Range מחזיר 200 → מתחילים מחדש, ולא מערבבים
        body = ByteArray(body.size).also { Random(99).nextBytes(it) }; etag = "\"v2\""
        val back = DmTask.of(t.json())!!
        s = FileSink(f)
        val b = DmFetch(back, s, 4, minSeg = 256 * 1024)
        val r = b.run({ false }); s.close()
        // התחלה מחדש עם ה־ETag הישן תמיד נדחית — עד שהמשימה מקבלת את החדש
        if (r is DmFetch.Result.Failed) {
            assertEquals("changed", r.code)
            val p = DmFetch.probe("$base/f.bin"); back.etag = p.etag; back.segs.clear()
            s = FileSink(f); assertEquals(DmFetch.Result.Done, DmFetch(back, s, 4, minSeg = 256 * 1024).run({ false })); s.close()
        }
        assertArrayEquals(sha(body), sha(f.readBytes().copyOf(body.size)))
    }

    @Test fun noRangesSingleStream() {
        ranges = false; cutEvery = 0
        val p = DmFetch.probe("$base/f.bin")
        val t = DmTask("t2abcdef", p.finalUrl).apply { total = p.total; this.ranges = p.ranges }
        // החיבור של הבדיקה עוד נסגר בצד השרת — לא לספור אותו כחיבור מקביל
        var w = 0; while (now.get() > 0 && w++ < 200) Thread.sleep(10)
        maxParallel.set(0)
        val (r, f) = download(t, 8)
        assertEquals(DmFetch.Result.Done, r)
        assertArrayEquals(sha(body), sha(f.readBytes()))
        assertEquals(1, maxParallel.get())
    }

    @Test fun expiredLinkStopsWithCode() {
        val t = task()
        status = 403
        val (r, _) = download(t, 4)
        assertEquals(DmFetch.Result.Failed("expired"), r)
        status = 404
        val (r2, _) = download(DmTask("t3abcdef", "$base/f.bin").apply { total = body.size.toLong(); ranges = true }, 2)
        assertEquals(DmFetch.Result.Failed("http_404"), r2)
    }
}
