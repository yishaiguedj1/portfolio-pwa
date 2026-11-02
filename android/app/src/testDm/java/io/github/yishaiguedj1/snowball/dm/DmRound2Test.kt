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
import java.net.URL
import java.util.Random
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/** סבב 2 של השדרוג (01/11/2026): כל הקישורים בדף, Wi‑Fi וסלולר יחד, רענון אוטומטי, צפייה תוך כדי הורדה */
class DmRound2Test {
    private lateinit var srv: ServerSocket
    private lateinit var base: String
    @Volatile private var body = ByteArray(0)
    @Volatile private var slowMs = 0L
    private val starts = java.util.Collections.synchronizedList(ArrayList<Long>())

    @Before fun up() {
        srv = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        base = "http://127.0.0.1:${srv.localPort}"
        Thread { while (!srv.isClosed) { val c = runCatching { srv.accept() }.getOrNull() ?: break; Thread { serve(c) }.apply { isDaemon = true; start() } } }
            .apply { isDaemon = true; start() }
    }

    @After fun down() { srv.close() }

    private val page = """<html><head><base href="/files/"></head><body>
        <a href="a.zip">zip</a> <a href='b.pdf?x=1&amp;y=2#top'>pdf</a> <a href="/about.html">page</a>
        <a href="javascript:void(0)">js</a> <a href="mailto:x@y">m</a> <video src="//cdn.example.org/v.mp4"></video>
        <img srcset="i1.webp 1x, i2.webp 2x"> <a href="a.zip">dup</a> <a href="tool.exe">exe</a> <link href="s.css">
        </body></html>"""

    private fun serve(c: Socket) = c.use { s ->
        val inp = s.getInputStream().bufferedReader(Charsets.ISO_8859_1)
        val first = inp.readLine() ?: return
        val h = HashMap<String, String>()
        while (true) { val l = inp.readLine() ?: break; if (l.isEmpty()) break; val i = l.indexOf(':'); if (i > 0) h[l.substring(0, i).lowercase()] = l.substring(i + 1).trim() }
        val out = s.getOutputStream()
        if (first.contains("/page")) {
            val b = page.toByteArray()
            out.write("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${b.size}\r\nConnection: close\r\n\r\n".toByteArray()); out.write(b); return
        }
        if (first.contains("/gone")) { out.write("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray()); return }
        val b = if (first.contains("/other")) ByteArray(1234) else body
        val rg = Regex("bytes=(\\d+)-(\\d*)").find(h["range"] ?: "")
        if (rg != null) {
            val a = rg.groupValues[1].toLong(); val e = rg.groupValues[2].toLongOrNull()?.coerceAtMost(b.size - 1L) ?: (b.size - 1L)
            starts.add(a)
            out.write(("HTTP/1.1 206 Partial Content\r\nContent-Range: bytes $a-$e/${b.size}\r\nContent-Length: ${e - a + 1}\r\nETag: \"e1\"\r\n" +
                "Content-Type: video/mp4\r\nConnection: close\r\n\r\n").toByteArray())
            var at = a.toInt(); val end = e.toInt() + 1
            try { while (at < end) { val n = minOf(16 shl 10, end - at); out.write(b, at, n); at += n; if (slowMs > 0) Thread.sleep(slowMs) } } catch (x: Exception) {}
        } else {
            out.write("HTTP/1.1 200 OK\r\nContent-Length: ${b.size}\r\nContent-Type: video/mp4\r\nConnection: close\r\n\r\n".toByteArray()); out.write(b)
        }
        out.flush()
    }

    private fun sinkOf(out: ByteArray) = object : DmSink {
        override fun write(pos: Long, buf: ByteArray, len: Int) { synchronized(out) { System.arraycopy(buf, 0, out, pos.toInt(), len) } }
        override fun sync() {}
    }

    // ---------- כל הקישורים בדף ----------
    @Test fun pageLinks() {
        val l = DmPageLinks.extract(page, "https://site.example/dir/index.html")
        val urls = l.map { it.url }
        assertTrue(urls.contains("https://site.example/files/a.zip"))
        assertTrue(urls.contains("https://site.example/files/b.pdf?x=1&y=2"))     // &amp; ועוגן
        assertTrue(urls.contains("https://cdn.example.org/v.mp4"))                // בלי פרוטוקול
        assertTrue(urls.contains("https://site.example/files/i2.webp"))           // srcset
        assertTrue(urls.contains("https://site.example/files/tool.exe"))
        assertFalse(urls.any { it.endsWith(".html") || it.endsWith(".css") || it.startsWith("javascript") || it.startsWith("mailto") })
        assertEquals(1, urls.count { it.endsWith("a.zip") })                         // בלי כפולים
        assertEquals(DmName.Cat.VIDEO, l.first { it.url.endsWith("v.mp4") }.cat)
    }

    @Test fun pageFetchAndCheck() {
        body = ByteArray(300_000)
        val (fin, html) = DmPageLinks.fetch("$base/page", "", DmFetch.UA)
        assertTrue(fin.endsWith("/page") && html.contains("a.zip"))
        val ok = DmPageLinks.check("$base/f.mp4", "", DmFetch.UA)
        assertTrue(ok.ok); assertEquals(300_000L, ok.size)
        val bad = DmPageLinks.check("$base/gone", "", DmFetch.UA)
        assertFalse(bad.ok); assertEquals("expired", bad.code)
        val pg = DmPageLinks.check("$base/page", "", DmFetch.UA)
        assertFalse(pg.ok); assertEquals("page", pg.code)
    }

    // ---------- Wi‑Fi וסלולר יחד ----------
    @Test fun bondRule() {
        assertTrue(DmBond.cellular(1, 8, true, true, 0, 500))
        assertFalse(DmBond.cellular(0, 8, true, true, 0, 500))
        assertFalse(DmBond.cellular(1, 8, false, true, 0, 500))      // כבוי
        assertFalse(DmBond.cellular(1, 8, true, false, 0, 500))      // לא ב־Wi‑Fi
        assertFalse(DmBond.cellular(1, 1, true, true, 0, 500))       // חיבור אחד
        assertFalse(DmBond.cellular(1, 8, true, true, 500L shl 20, 500))   // התקרה היומית
        assertTrue(DmBond.cellular(3, 8, true, true, 9_000L shl 20, 0))    // בלי תקרה
    }

    @Test fun routeSplitsConnections() {
        body = ByteArray(4 shl 20).also { Random(3).nextBytes(it) }
        slowMs = 2
        val p = DmFetch.probe("$base/f.bin")
        val t = DmTask("bondTest1", "$base/f.bin").apply { total = p.total; ranges = p.ranges; etag = p.etag }
        val out = ByteArray(body.size)
        val altOpens = AtomicInteger(0)
        val f = DmFetch(t, sinkOf(out), 4, minSeg = 128L shl 10,
            route = { slot -> if (slot % 2 == 1) { u: URL -> altOpens.incrementAndGet(); u.openConnection() } else null })
        assertEquals(DmFetch.Result.Done, f.run({ false }))
        assertArrayEquals(body, out)
        assertTrue(altOpens.get() > 0)
        assertTrue(f.altBytes in 1 until f.bytes)
    }

    // ---------- רענון אוטומטי ----------
    @Test fun refreshPick() {
        val t = DmTask("refTest01", "https://a.example/old/video.mp4", "https://a.example/page").apply { total = 5000; name = "video.mp4"; err = "expired" }
        assertTrue(DmRefresh.worth(t))
        fun pr(sz: Long, url: String, rg: Boolean = true) = DmProbe(sz, rg, "", "", "video/mp4", "", url)
        val c = listOf("https://a.example/x.mp4" to pr(4000, "https://a.example/x.mp4"),
            "https://a.example/new/video.mp4" to pr(5000, "https://a.example/new/video.mp4"),
            "https://a.example/old/video.mp4" to pr(5000, "https://a.example/old/video.mp4"))
        assertEquals("https://a.example/new/video.mp4", DmRefresh.pick(t, c)?.first)
        assertNull(DmRefresh.pick(t, listOf("https://a.example/z.zip" to DmProbe(5000, true, "", "", "application/zip", "", "https://a.example/z.zip"))))
        t.autoRefresh = DmRefresh.MAX_AUTO
        assertFalse(DmRefresh.worth(t))
        assertFalse(DmRefresh.worth(DmTask("refTest02", "https://a.example/v.mp4").apply { total = 10; err = "expired" }))   // בלי דף
    }

    // ---------- צפייה תוך כדי הורדה ----------
    @Test fun growAvail() {
        val segs = mutableListOf(Seg(0, 100, 100), Seg(100, 200, 50), Seg(200, 300, 100))
        assertEquals(150L, DmGrow.avail(segs, 300, 0))
        assertEquals(0L, DmGrow.avail(segs, 300, 160))
        assertEquals(100L, DmGrow.avail(segs, 300, 200))
        assertTrue(DmGrow.toEnd(segs, 300, 200)); assertFalse(DmGrow.toEnd(segs, 300, 0))
        assertEquals(0L, DmGrow.avail(segs, 300, 300))
    }

    @Test fun splitAtNearOrFar() {
        val segs = mutableListOf(Seg(0, 10L shl 20, 0))
        assertNull(DmSegs.splitAt(segs, 1L shl 20))               // החיבור קרוב — יגיע לבד
        val n = DmSegs.splitAt(segs, 6L shl 20)!!
        assertEquals(6L shl 20, n.start); assertEquals(6L shl 20, segs[0].end); assertEquals(2, segs.size)
    }

    @Test fun wantStartsConnectionThere() {
        body = ByteArray(8 shl 20).also { Random(5).nextBytes(it) }
        slowMs = 15
        val p = DmFetch.probe("$base/f.bin")
        val t = DmTask("wantTest1", "$base/f.bin").apply { total = p.total; ranges = p.ranges; etag = p.etag }
        val out = ByteArray(body.size)
        val w = AtomicLong(-1)
        val at = 7L shl 20
        val f = DmFetch(t, sinkOf(out), 1, minSeg = 128L shl 10, wantAt = { w.get() })
        Thread { Thread.sleep(300); w.set(at) }.apply { isDaemon = true; start() }
        val r = f.run({ false })
        assertEquals(DmFetch.Result.Done, r)
        assertArrayEquals(body, out)
        assertTrue("חיבור שהתחיל בנקודה שהנגן ביקש: $starts", starts.contains(at))
    }
}
