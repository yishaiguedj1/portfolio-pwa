package io.github.yishaiguedj1.snowball.dm

import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.Random
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** סבב 1 של השדרוג (01/11/2026): תבנית, הצצה ל־ZIP (גם דרך HTTP אמיתי), המניפסט של APK, חום ואבחון */
class DmProTest {
    private lateinit var srv: ServerSocket
    private lateinit var base: String
    @Volatile private var body = ByteArray(0)
    @Volatile private var etag = "\"z1\""
    @Volatile private var slowMs = 0L

    @Before fun up() {
        srv = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        base = "http://127.0.0.1:${srv.localPort}"
        Thread { while (!srv.isClosed) { val c = runCatching { srv.accept() }.getOrNull() ?: break; Thread { serve(c) }.apply { isDaemon = true; start() } } }
            .apply { isDaemon = true; start() }
    }

    @After fun down() { srv.close() }

    /** שרת קטן: Range ו־If-Range לפי ETag, ‏/page = ‏HTML */
    private fun serve(c: Socket) = c.use { s ->
        val inp = s.getInputStream().bufferedReader(Charsets.ISO_8859_1)
        val first = inp.readLine() ?: return
        val h = HashMap<String, String>()
        while (true) { val l = inp.readLine() ?: break; if (l.isEmpty()) break; val i = l.indexOf(':'); if (i > 0) h[l.substring(0, i).lowercase()] = l.substring(i + 1).trim() }
        val out = s.getOutputStream()
        if (first.contains("/page")) { out.write("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 2\r\nConnection: close\r\n\r\nhi".toByteArray()); return }
        val b = body
        val rg = Regex("bytes=(\\d+)-(\\d*)").find(h["range"] ?: "")
        val ifr = h["if-range"]
        if (rg != null && (ifr == null || ifr == etag)) {
            val a = rg.groupValues[1].toLong(); val e = rg.groupValues[2].toLongOrNull()?.coerceAtMost(b.size - 1L) ?: (b.size - 1L)
            out.write(("HTTP/1.1 206 Partial Content\r\nContent-Range: bytes $a-$e/${b.size}\r\nContent-Length: ${e - a + 1}\r\nETag: $etag\r\n" +
                "Content-Type: application/zip\r\nConnection: close\r\n\r\n").toByteArray())
            var at = a.toInt(); val end = e.toInt() + 1
            while (at < end) { val n = minOf(16 shl 10, end - at); out.write(b, at, n); at += n; if (slowMs > 0) Thread.sleep(slowMs) }
        } else {
            out.write("HTTP/1.1 200 OK\r\nContent-Length: ${b.size}\r\nETag: $etag\r\nContent-Type: application/zip\r\nConnection: close\r\n\r\n".toByteArray())
            out.write(b)
        }
        out.flush()
    }

    // ---------- תקרת חיבורים שמשתנה באמצע (DmHeat) ----------
    @Test fun capChangesMidDownload() {
        body = ByteArray(8 shl 20).also { Random(9).nextBytes(it) }
        slowMs = 20
        val p = DmFetch.probe("$base/f.bin")
        val t = DmTask("capTest01", "$base/f.bin").apply { total = p.total; ranges = p.ranges; etag = p.etag }
        val out = ByteArray(body.size)
        val sink = object : DmSink {
            override fun write(pos: Long, buf: ByteArray, len: Int) { synchronized(out) { System.arraycopy(buf, 0, out, pos.toInt(), len) } }
            override fun sync() {}
        }
        val cap = java.util.concurrent.atomic.AtomicInteger(8)
        val f = DmFetch(t, sink, 8, minSeg = 64L shl 10, cap = { cap.get() })
        var sawOne = false; var maxAfter = 0
        val mon = Thread {
            Thread.sleep(250); cap.set(1); Thread.sleep(600)
            repeat(20) { if (f.live == 1) sawOne = true; Thread.sleep(20) }
            cap.set(4); Thread.sleep(500)
            repeat(20) { maxAfter = maxOf(maxAfter, f.live); Thread.sleep(20) }
        }.apply { isDaemon = true; start() }
        val r = f.run({ false })
        mon.join(5000)
        slowMs = 0
        assertEquals(DmFetch.Result.Done, r)
        assertArrayEquals(body, out)
        assertTrue("התקרה ירדה לחיבור אחד", sawOne)
        assertTrue("התקרה עלתה שוב", maxAfter in 2..4)
    }

    // ---------- תבנית ----------
    @Test fun patternPadsAndExpands() {
        assertEquals(listOf("https://a.com/ep01.mp4", "https://a.com/ep02.mp4", "https://a.com/ep03.mp4"), DmPattern.expand("https://a.com/ep[01-03].mp4"))
        assertEquals((1..10).map { "https://a.com/$it.jpg" }, DmPattern.expand("https://a.com/[1-10].jpg"))
        assertEquals(listOf("https://a.com/a/x", "https://a.com/b/x", "https://a.com/c/x"), DmPattern.expand("https://a.com/[a-c]/x"))
        assertEquals(listOf("https://a.com/s1e1", "https://a.com/s1e2", "https://a.com/s2e1", "https://a.com/s2e2"), DmPattern.expand("https://a.com/s[1-2]e[1-2]"))
        assertEquals(listOf("https://a.com/3", "https://a.com/2", "https://a.com/1"), DmPattern.expand("https://a.com/[3-1]"))
        assertEquals(6L, DmPattern.count("https://a.com/[1-3]/[a-b]"))
    }

    @Test fun patternNotInHostAndCapped() {
        assertFalse(DmPattern.has("http://[::1]/file.zip"))
        assertFalse(DmPattern.has("https://a.com/file.zip"))
        assertEquals(DmLink.MAX_BATCH, DmPattern.expand("https://a.com/[1-999]").size)
        assertTrue(DmPattern.expand("https://a.com/[a-Z]").isEmpty())
        // ההדבקה מזהה תבנית בקישור יחיד
        val p = DmImport.parse("https://a.com/part[1-4].rar") as DmImport.Parsed.Links
        assertEquals(4, p.urls.size); assertTrue(p.pattern)
    }

    // ---------- ZIP ----------
    private fun zip(): Pair<ByteArray, Map<String, ByteArray>> {
        val files = linkedMapOf(
            "readme.txt" to "שלום עולם\n".repeat(200).toByteArray(),
            "dir/big.bin" to ByteArray(300_000).also { Random(3).nextBytes(it) },
            "stored.dat" to ByteArray(5000) { (it % 7).toByte() },
        )
        val o = ByteArrayOutputStream()
        ZipOutputStream(o).use { z ->
            for ((n, d) in files) {
                val e = ZipEntry(n)
                if (n == "stored.dat") { e.method = ZipEntry.STORED; e.size = d.size.toLong(); e.compressedSize = d.size.toLong(); e.crc = CRC32().also { it.update(d) }.value }
                z.putNextEntry(e); z.write(d); z.closeEntry()
            }
            z.putNextEntry(ZipEntry("empty/")); z.closeEntry()
            z.setComment("x".repeat(300))
        }
        return o.toByteArray() to files
    }

    @Test fun zipListAndExtractLocal() {
        val (z, files) = zip()
        val rd = { p: Long, n: Int -> z.copyOfRange(p.toInt(), p.toInt() + n) }
        val l = DmZipPeek.list(z.size.toLong(), rd)
        assertEquals(4, l.entries.size); assertFalse(l.truncated)
        assertEquals(listOf("readme.txt", "dir/big.bin", "stored.dat", "empty/"), l.entries.map { it.name })
        assertTrue(l.entries.last().dir)
        for (e in l.entries.filter { !it.dir }) {
            val o = ByteArrayOutputStream()
            DmZipPeek.extract(e, rd, { p, n -> z.inputStream(p.toInt(), n.toInt()) }, o)
            assertArrayEquals(e.name, files[e.name], o.toByteArray())
        }
    }

    @Test fun zipOverHttpAndChanged() {
        val (z, files) = zip()
        body = z
        val p = DmFetch.probe("$base/a.zip")
        assertTrue(DmZipPeek.canPeek("a.zip", p.ranges, p.total))
        val h = DmZipPeek.Http("$base/a.zip", "", DmFetch.UA, p.etag)
        val l = DmZipPeek.list(p.total, h::read)
        val e = l.entries.first { it.name == "dir/big.bin" }
        val o = ByteArrayOutputStream()
        DmZipPeek.extract(e, h::read, h::stream, o)
        assertArrayEquals(files["dir/big.bin"], o.toByteArray())
        // הקובץ בשרת השתנה → If-Range מחזיר 200 → לא מערבבים
        etag = "\"z2\""
        val err = runCatching { DmZipPeek.list(p.total, h::read) }.exceptionOrNull()
        assertTrue(err is DmZipPeek.Bad && err.message == "changed")
    }

    @Test fun zipBadCrcAndNotZip() {
        val (z, _) = zip()
        val rd = { p: Long, n: Int -> z.copyOfRange(p.toInt(), p.toInt() + n) }
        val e = DmZipPeek.list(z.size.toLong(), rd).entries.first { it.name == "stored.dat" }
        val bad = z.copyOf(); val at = DmZipPeek.dataStart(e, rd).toInt() + 10; bad[at] = (bad[at] + 1).toByte()
        val r = runCatching { DmZipPeek.extract(e, rd, { p, n -> bad.inputStream(p.toInt(), n.toInt()) }, ByteArrayOutputStream()) }.exceptionOrNull()
        assertEquals("crc", r?.message)
        val junk = ByteArray(5000) { 1 }
        assertEquals("not_zip", runCatching { DmZipPeek.list(junk.size.toLong()) { p, n -> junk.copyOfRange(p.toInt(), p.toInt() + n) } }.exceptionOrNull()?.message)
        assertFalse(DmZipPeek.canPeek("a.mp4", true, 100))
        assertFalse(DmZipPeek.canPeek("a.zip", false, 100))
    }

    // ---------- APK: AndroidManifest.xml בינארי ----------
    private fun axml(): ByteArray {
        val st = listOf("name", "versionCode", "versionName", "package", "manifest", "uses-permission", "android.permission.CAMERA",
            "com.example.app", "2.5.1", "uses-sdk", "minSdkVersion", "service", "permission", "android.permission.BIND_ACCESSIBILITY_SERVICE",
            "android.permission.INTERNET")
        fun le16(o: ByteArrayOutputStream, v: Int) { o.write(v and 0xff); o.write((v shr 8) and 0xff) }
        fun le32(o: ByteArrayOutputStream, v: Int) { le16(o, v and 0xffff); le16(o, (v ushr 16) and 0xffff) }
        val strData = ByteArrayOutputStream(); val offs = ArrayList<Int>()
        for (s in st) { offs.add(strData.size()); le16(strData, s.length); strData.write(s.toByteArray(Charsets.UTF_16LE)); le16(strData, 0) }
        while (strData.size() % 4 != 0) strData.write(0)
        val pool = ByteArrayOutputStream()
        le16(pool, 1); le16(pool, 28); le32(pool, 28 + 4 * st.size + strData.size()); le32(pool, st.size); le32(pool, 0); le32(pool, 0)
        le32(pool, 28 + 4 * st.size); le32(pool, 0); offs.forEach { le32(pool, it) }; pool.write(strData.toByteArray())
        val rm = ByteArrayOutputStream(); val ids = intArrayOf(0x01010003, 0x0101021b, 0x0101021c)
        le16(rm, 0x0180); le16(rm, 8); le32(rm, 8 + 4 * ids.size); ids.forEach { le32(rm, it) }
        fun el(name: Int, attrs: List<IntArray>): ByteArray {   // attr = [name, raw, type, data]
            val o = ByteArrayOutputStream()
            le16(o, 0x0102); le16(o, 16); le32(o, 36 + 20 * attrs.size); le32(o, 1); le32(o, -1); le32(o, -1); le32(o, name)
            le16(o, 20); le16(o, 20); le16(o, attrs.size); le16(o, 0); le16(o, 0); le16(o, 0)
            for (a in attrs) { le32(o, -1); le32(o, a[0]); le32(o, a[1]); le16(o, 8); o.write(0); o.write(a[2]); le32(o, a[3]) }
            return o.toByteArray()
        }
        val body = ByteArrayOutputStream()
        body.write(pool.toByteArray()); body.write(rm.toByteArray())
        body.write(el(4, listOf(intArrayOf(3, 7, 3, 7), intArrayOf(1, -1, 0x10, 42), intArrayOf(2, 8, 3, 8))))
        body.write(el(9, listOf(intArrayOf(10, -1, 0x10, 26))))
        body.write(el(5, listOf(intArrayOf(0, 6, 3, 6))))
        body.write(el(5, listOf(intArrayOf(0, 14, 3, 14))))
        body.write(el(11, listOf(intArrayOf(0, 7, 3, 7), intArrayOf(12, 13, 3, 13))))
        val o = ByteArrayOutputStream(); le16(o, 3); le16(o, 8); le32(o, 8 + body.size()); o.write(body.toByteArray())
        return o.toByteArray()
    }

    @Test fun apkManifest() {
        val i = DmApk.parse(axml())
        assertNotNull(i); i!!
        assertEquals("com.example.app", i.pkg); assertEquals("2.5.1", i.versionName); assertEquals(42L, i.versionCode); assertEquals(26, i.minSdk)
        assertEquals(listOf("android.permission.CAMERA", "android.permission.INTERNET"), i.perms)
        assertEquals(listOf("CAMERA"), i.risky)
        assertTrue(i.accessibility)
        assertEquals(null, DmApk.parse(ByteArray(40) { 7 }))
    }

    // ---------- חום וסוללה ----------
    @Test fun heat() {
        assertEquals(DmHeat.Cap(8, 0, DmHeat.Why.NONE), DmHeat.cap(8, 0, 80, false, false))
        assertEquals(DmHeat.Why.HOT, DmHeat.cap(8, 2, 80, false, false).why); assertEquals(4, DmHeat.cap(8, 2, 80, false, false).conns)
        assertEquals(2, DmHeat.cap(8, 3, 80, true, false).conns); assertTrue(DmHeat.cap(8, 3, 80, true, false).bps > 0)
        assertEquals(1, DmHeat.cap(8, 4, 80, true, false).conns)
        assertEquals(DmHeat.Why.BATTERY, DmHeat.cap(8, 0, 10, false, false).why)
        assertEquals(DmHeat.Why.NONE, DmHeat.cap(8, 0, 10, true, false).why)      // בטעינה — לא מאטים בגלל סוללה
        assertEquals(DmHeat.Why.SAVER, DmHeat.cap(8, 0, 60, false, true).why)
        assertEquals(1, DmHeat.cap(1, 2, 80, false, false).conns)
    }

    // ---------- אבחון ----------
    @Test fun diagExplain() {
        assertEquals(DmDiag.Act.REFRESH, DmDiag.explain("expired", DmKind.HTTP, true, 0).first().act)
        assertEquals(DmDiag.Act.FEWER, DmDiag.explain("http_503", DmKind.HTTP, true, 0).first().act)
        assertEquals("Dns", DmDiag.explain("net", DmKind.HTTP, true, 0, "UnknownHostException").first().key)
        assertTrue(DmDiag.explain("net", DmKind.HTTP, true, 4).any { it.act == DmDiag.Act.FEWER })
        assertTrue(DmDiag.explain("net", DmKind.HTTP, false, 0).any { it.key == "NoResume" })
        assertEquals(DmDiag.Act.CELL, DmDiag.explain("wifi", DmKind.HTTP, true, 0, wifiOnly = true).first().act)
        assertEquals(DmDiag.Act.SPACE, DmDiag.explain("space", DmKind.YTDL, true, 0).first().act)
        assertEquals("Unknown", DmDiag.explain("weird", DmKind.YTDL, true, 0).first().key)
    }

    @Test fun diagCheckLive() {
        body = ByteArray(10_000) { 1 }
        val ok = DmDiag.check("$base/f.bin", "", DmFetch.UA, null, 10_000, "\"z1\"")
        assertEquals(listOf("dns", "conn", "http", "size", "ranges", "same"), ok.map { it.k })
        assertTrue(ok.all { it.ok })
        etag = "\"z9\""
        assertFalse(DmDiag.check("$base/f.bin", "", DmFetch.UA, null, 10_000, "\"z1\"").last().ok)
        assertEquals("page", DmDiag.check("$base/page", "", DmFetch.UA, null, 0, "").last().k)
        val dns = DmDiag.check("http://no.such.host.invalid/x", "", DmFetch.UA, null, 0, "", resolve = { throw java.net.UnknownHostException() })
        assertEquals(listOf("dns"), dns.map { it.k }); assertFalse(dns[0].ok)
    }
}
