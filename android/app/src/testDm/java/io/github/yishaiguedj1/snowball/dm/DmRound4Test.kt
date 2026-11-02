package io.github.yishaiguedj1.snowball.dm

import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.RandomAccessFile
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.Random

/** סבב 4א של השדרוג (02/11/2026): קטע, המרה, פרקים, כתוביות, תור סנכרון, פידים, Metalink ומראות, Repr-Digest, סורק אתר */
class DmRound4Test {
    private lateinit var srv: ServerSocket
    private lateinit var base: String
    @Volatile private var body = ByteArray(0)
    @Volatile private var corruptAt = -1L   // המראה /bad מחזירה בית שגוי במקום הזה

    @Before fun up() {
        srv = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        base = "http://127.0.0.1:${srv.localPort}"
        Thread { while (!srv.isClosed) { val c = runCatching { srv.accept() }.getOrNull() ?: break; Thread { serve(c) }.apply { isDaemon = true; start() } } }
            .apply { isDaemon = true; start() }
    }

    @After fun down() { srv.close() }

    private fun serve(c: Socket) = runCatching {
        c.use { s ->
            val r = s.getInputStream().bufferedReader(Charsets.ISO_8859_1)
            val line = r.readLine() ?: return@use
            var range: String? = null
            while (true) { val h = r.readLine() ?: break; if (h.isEmpty()) break; if (h.startsWith("Range:", true)) range = h.substringAfter(':').trim() }
            val path = line.split(' ')[1]
            val out = s.getOutputStream()
            if (path.startsWith("/dead")) { out.write("HTTP/1.1 404 X\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray()); return@use }
            val b = body
            val m = range?.let { Regex("bytes=(\\d+)-(\\d*)").find(it) }
            val a = m?.groupValues?.get(1)?.toLong() ?: 0L
            val e = m?.groupValues?.get(2)?.toLongOrNull() ?: (b.size - 1L)
            val part = b.copyOfRange(a.toInt(), (e + 1).toInt())
            if (path.startsWith("/bad") && corruptAt in a..e) part[(corruptAt - a).toInt()] = (part[(corruptAt - a).toInt()] + 1).toByte()
            val dg = java.util.Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(b))
            val head = (if (m != null) "HTTP/1.1 206 P\r\nContent-Range: bytes $a-$e/${b.size}\r\n" else "HTTP/1.1 200 OK\r\n") +
                "Content-Length: ${part.size}\r\nAccept-Ranges: bytes\r\nRepr-Digest: sha-256=:$dg:\r\nConnection: close\r\n\r\n"
            out.write(head.toByteArray()); out.write(part); out.flush()
        }
    }

    private class FileSink(val f: RandomAccessFile) : DmSink {
        override fun write(pos: Long, buf: ByteArray, len: Int) = synchronized(f) { f.seek(pos); f.write(buf, 0, len) }
        override fun sync() {}
    }

    private fun hex(b: ByteArray) = b.joinToString("") { "%02x".format(it) }

    @Test fun clip() {
        assertEquals(750, DmClip.parse("12:30"))
        assertEquals(3723, DmClip.parse("1:02:03"))
        assertEquals(90, DmClip.parse("90"))
        assertNull(DmClip.parse("1:70"))
        assertNull(DmClip.parse("abc"))
        assertTrue(DmClip.valid(10, 20, 30)); assertFalse(DmClip.valid(20, 10, 30)); assertFalse(DmClip.valid(10, 40, 30)); assertTrue(DmClip.valid(10, 40, 0))
        assertEquals("1:02:03", DmClip.fmt(3723)); assertEquals("12:30", DmClip.fmt(750))
    }

    @Test fun conv() {
        assertEquals(listOf("-x", "--audio-format", "mp3", "--audio-quality", "0", "--embed-thumbnail", "--embed-metadata"), DmConv.args("mp3"))
        assertTrue(DmConv.args("").isEmpty()); assertTrue(DmConv.args("evil;rm").isEmpty())
        assertEquals("--remux-video", DmConv.args("mp4")[0])
        // "עד גודל": הטובה ביותר שנכנסת; אין — הקטנה ביותר; בלי גדלים — null
        assertEquals(2, DmConv.fit(listOf(900L, 500L, 200L, 90L), 300))
        assertEquals(3, DmConv.fit(listOf(900L, 500L, 0L, 200L), 100))
        assertNull(DmConv.fit(listOf(0L, 0L), 100))
    }

    @Test fun chapters() {
        val info = """{"title":"x","chapters":[{"start_time":120.5,"end_time":300,"title":"שני"},{"start_time":0,"end_time":120.5,"title":"פתיחה"}]}"""
        val cs = DmChap.fromInfo(info)
        assertEquals(listOf(0, 120), cs.map { it.start }); assertEquals("פתיחה", cs[0].title)
        assertEquals(cs, DmChap.parse(DmChap.dump(cs)))
        assertEquals(listOf("A - 001 פתיחה.mp4", "A - 002 שני.mp4"), DmChap.files(listOf("A [id].mp4", "A - 002 שני.mp4", "A - 001 פתיחה.mp4", "A [id].info.json")))
        assertTrue(DmChap.args("split").any { it.startsWith("chapter:{DIR}/") })
    }

    @Test fun subtitles() {
        val srt = "1\n00:00:01,500 --> 00:00:03,000\nשלום <i>עולם</i>\n\n2\n01:02:03.040 --> 01:02:05.000\nHello there\nfriend\n"
        val cues = DmSubIndex.parse(srt)
        assertEquals(2, cues.size); assertEquals(1500L, cues[0].ms); assertEquals("שלום עולם", cues[0].text)
        assertEquals(3723040L, cues[1].ms); assertEquals("Hello there friend", cues[1].text)
        val hits = DmSubIndex.search("friend", mapOf("t1" to cues))
        assertEquals(1, hits.size); assertEquals("t1", hits[0].id)
        assertTrue(DmSubIndex.search(" ", mapOf("t1" to cues)).isEmpty())
    }

    @Test fun watches() {
        val w = DmWatch("w1", "https://a.com/f.zip", "file", etag = "\"1\"", lastMod = "Mon", size = 10)
        assertTrue(DmWatches.changed(w, "\"2\"", "Mon", 10))
        assertFalse(DmWatches.changed(w, "\"1\"", "Tue", 11))   // ETag גובר
        assertTrue(DmWatches.changed(w.copy(etag = ""), "", "Tue", 10))
        assertTrue(DmWatches.changed(w.copy(etag = "", lastMod = ""), "", "", 11))
        assertFalse(DmWatches.changed(DmWatch("w", "https://a", "file"), "\"9\"", "x", 5))   // בדיקה ראשונה רק לומדת
        val ws = listOf(w.copy(checked = 0), w.copy(id = "w2", checked = System.currentTimeMillis()))
        assertEquals(listOf("w1"), DmWatches.due(ws, System.currentTimeMillis()).map { it.id })
        assertEquals(ws, DmWatches.parse(DmWatches.dump(ws)))
        val f = DmWatch("w3", "https://p.com/rss", "feed")
        assertEquals(listOf("c"), DmWatches.fresh(f, listOf("c", "b", "a")))          // פעם ראשונה — רק האחרון
        val f2 = f.copy(checked = 1, seen = DmWatches.markSeen(f, listOf("c", "b", "a")))
        assertEquals(listOf("d"), DmWatches.fresh(f2, listOf("d", "c", "b", "a")))
        assertEquals("w4", DmWatches.newId(listOf(w, w.copy(id = "w2"), w.copy(id = "w3"))))
    }

    @Test fun feeds() {
        val rss = """<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><rss><channel><title>פודקאסט</title>
            <item><title><![CDATA[פרק 2]]></title><guid>g2</guid><enclosure url="https://cdn.p.com/2.mp3?a=1&amp;b=2" type="audio/mpeg"/><pubDate>Mon</pubDate></item>
            <item><title>פרק 1</title><link>https://p.com/1</link></item></channel></rss>"""
        val f = DmFeed.parse(rss)!!
        assertEquals("פודקאסט", f.title); assertEquals(2, f.items.size)
        assertEquals("https://cdn.p.com/2.mp3?a=1&b=2", f.items[0].url); assertEquals("g2", f.items[0].id); assertEquals("פרק 2", f.items[0].title)
        assertEquals("https://p.com/1", f.items[1].url)
        val atom = """<feed xmlns:yt="x"><title>ערוץ</title><entry><id>yt:video:abc</id><yt:videoId>abcDEF12345</yt:videoId><title>וידאו</title><link rel="alternate" href="https://www.youtube.com/watch?v=abcDEF12345"/></entry></feed>"""
        val a = DmFeed.parse(atom)!!
        assertEquals("https://www.youtube.com/watch?v=abcDEF12345", a.items[0].url)
        assertNull(DmFeed.parse("<html>no</html>"))
        assertEquals("https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv", DmFeed.youtubeFeed("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"))
        assertEquals("https://www.youtube.com/feeds/videos.xml?playlist_id=PL1234567890ab", DmFeed.youtubeFeed("https://www.youtube.com/playlist?list=PL1234567890ab"))
        assertNull(DmFeed.youtubeFeed("https://www.youtube.com/@someone"))
    }

    @Test fun metalinkParse() {
        val x = """<?xml version="1.0"?><metalink xmlns="urn:ietf:params:xml:ns:metalink"><file name="img.iso"><size>100000</size>
            <hash type="sha-256">${"a".repeat(64)}</hash><hash type="md5">${"b".repeat(32)}</hash>
            <pieces length="65536" type="sha-256"><hash>${"1".repeat(64)}</hash><hash>${"2".repeat(64)}</hash></pieces>
            <url priority="2">https://m2.org/img.iso</url><url priority="1">https://m1.org/img.iso</url><url>ftp://x/img.iso</url></file>
            <file name="../evil"><url>https://e.org/x</url></file></metalink>"""
        val fs = DmMeta4.parse(x)
        assertEquals(2, fs.size)
        val f = fs[0]
        assertEquals("img.iso", f.name); assertEquals(100000L, f.size)
        assertEquals(mapOf("SHA-256" to "a".repeat(64)), f.hashes)   // md5 לא נחשב
        assertEquals(listOf("https://m1.org/img.iso", "https://m2.org/img.iso"), f.urls)   // לפי עדיפות, בלי ftp
        assertEquals(65536L, f.pieceLen); assertEquals(2, f.pieces.size)
        assertFalse(fs[1].name.contains(".."))
        // חלקים שלא מכסים את הקובץ — מתעלמים
        assertTrue(DmMeta4.parse(x.replace("100000", "300000"))[0].pieces.isEmpty())
        // 3.0: preference
        val old = """<metalink version="3.0"><files><file name="a.bin"><resources><url type="http" preference="10">https://slow/a.bin</url><url type="http" preference="100">https://fast/a.bin</url></resources></file></files></metalink>"""
        assertEquals(listOf("https://fast/a.bin", "https://slow/a.bin"), DmMeta4.parse(old)[0].urls)
        assertTrue(DmMeta4.isUrl("https://x.org/a.meta4?x=1")); assertFalse(DmMeta4.isUrl("https://x.org/a.iso"))
    }

    @Test fun piecesAndRedo() {
        val data = ByteArray(300_000).also { Random(1).nextBytes(it) }
        val pl = 100_000L
        val hashes = (0 until 3).map { i -> hex(MessageDigest.getInstance("SHA-256").digest(data.copyOfRange((i * pl).toInt(), minOf(data.size, ((i + 1) * pl).toInt())))) }
        assertTrue(DmMeta4.badPieces(ByteArrayInputStream(data), pl, "SHA-256", hashes).isEmpty())
        val broken = data.clone(); broken[150_000] = (broken[150_000] + 1).toByte()
        assertEquals(listOf(1), DmMeta4.badPieces(ByteArrayInputStream(broken), pl, "SHA-256", hashes))
        val segs = DmMeta4.redo(listOf(1), pl, 300_000)
        assertEquals(3, segs.size)
        assertTrue(segs[0].finished && segs[2].finished && !segs[1].finished)
        assertEquals(100_000L, segs[1].start); assertEquals(200_000L, segs[1].end)
        assertFalse(DmSegs.complete(segs, 300_000))
    }

    @Test fun mirrorsPick() {
        val u = listOf("a", "b", "c")
        assertEquals(0, DmMirrors.pick(u, 0, emptySet())); assertEquals(1, DmMirrors.pick(u, 1, emptySet())); assertEquals(0, DmMirrors.pick(u, 3, emptySet()))
        assertEquals(2, DmMirrors.pick(u, 1, setOf(1)))
        assertNull(DmMirrors.pick(u, 0, setOf(0, 1, 2)))
    }

    /** הורדה מכמה מראות כשאחת מתה (404): ממשיכה מהאחרות; מראה שמחזירה בית שגוי — רק החלק הפגום יורד שוב */
    @Test fun mirrorsDownload() {
        val data = ByteArray(6 shl 20).also { Random(7).nextBytes(it) }
        body = data; corruptAt = (3L shl 20) + 5
        val f = java.io.File.createTempFile("dm4", ".bin")
        try {
            val t = DmTask("mirror0001", "$base/ok").apply { total = data.size.toLong(); ranges = true; mir = listOf("$base/dead", "$base/ok", "$base/bad").joinToString("\n") }
            RandomAccessFile(f, "rw").use { raf ->
                raf.setLength(data.size.toLong())
                val r = DmFetch(t, FileSink(raf), 6, sleep = {}, minSeg = 256 * 1024).run({ false })
                assertTrue(r.toString(), r is DmFetch.Result.Done)
            }
            val pl = 1L shl 20
            val hashes = (0 until 6).map { i -> hex(MessageDigest.getInstance("SHA-256").digest(data.copyOfRange((i * pl).toInt(), ((i + 1) * pl).toInt()))) }
            val bad = DmMeta4.badPieces(f.inputStream(), pl, "SHA-256", hashes)
            if (bad.isNotEmpty()) {
                assertEquals(listOf(3), bad)
                t.mir = "$base/ok"; t.segs = DmMeta4.redo(bad, pl, data.size.toLong())
                RandomAccessFile(f, "rw").use { raf -> assertTrue(DmFetch(t, FileSink(raf), 2, sleep = {}).run({ false }) is DmFetch.Result.Done) }
            }
            assertArrayEquals(data, f.readBytes())
        } finally { f.delete() }
    }

    @Test fun reprDigest() {
        // RFC 9530 — הדוגמה מהתקן: {"hello": "world"}
        val dg = DmDigest.parse("sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:", null)
        assertEquals("SHA-256", DmDigest.algo(dg))
        assertEquals(hex(MessageDigest.getInstance("SHA-256").digest("{\"hello\": \"world\"}".toByteArray())), DmDigest.value(dg))
        assertEquals("", DmDigest.parse("md5=:abc:", null))
        assertEquals("SHA-256", DmDigest.algo(DmDigest.parse(null, "SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=")))
        assertEquals("", DmDigest.parse("sha-256=:AAAA:", null))   // אורך שגוי
        // מהשרת, בבדיקה
        body = ByteArray(5000).also { Random(3).nextBytes(it) }
        val p = DmFetch.probe("$base/f.bin")
        assertEquals("SHA-256:" + hex(MessageDigest.getInstance("SHA-256").digest(body)), p.digest)
    }

    @Test fun robots() {
        val r = DmRobots.parse("User-agent: googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private/\nAllow: /private/ok\nDisallow: /*.pdf$\n")
        assertTrue(r.allowed("/public/a.zip")); assertFalse(r.allowed("/private/x")); assertTrue(r.allowed("/private/ok/1"))
        assertFalse(r.allowed("/docs/a.pdf")); assertTrue(r.allowed("/docs/a.pdf?x=1"))
        assertTrue(DmRobots.parse(null).allowed("/anything"))
        assertFalse(DmRobots.parse("User-agent: studiodm\nDisallow: /\n").allowed("/x"))
    }

    @Test fun crawl() {
        val site = mapOf(
            "https://s.com/" to """<a href="/a">A</a><a href="b.html">B</a><a href="https://other.com/x">X</a><a href="/f/1.zip">1</a><a href="/secret/s.zip">s</a>""",
            "https://s.com/a" to """<a href="/f/2.zip">2</a><a href="/f/2.pdf">p</a><a href="/deep">d</a>""",
            "https://s.com/b.html" to """<a href="/f/1.zip">dup</a>""",
            "https://s.com/deep" to """<a href="/f/3.zip">3</a>""",
        )
        val job = DmCrawlJob("c1", "https://s.com/", depth = 2, exts = setOf("zip"))
        var slept = 0
        val got = DmCrawl.run(job, { u -> site[u]?.let { DmCrawl.Page(u, it) } }, { DmRobots.parse("User-agent: *\nDisallow: /secret/") }, { slept++ }, { false }, {})
        assertEquals(setOf("https://s.com/f/1.zip", "https://s.com/f/2.zip", "https://s.com/secret/s.zip"), got.map { it.url }.toSet())
        assertTrue(slept >= 2)   // השהיה בין דפים
        // עומק 3 — מגיע גם ל־/deep; הרצה חוזרת עם seen — רק החדש
        val j3 = job.copy(depth = 3, seen = got.map { it.url })
        assertEquals(listOf("https://s.com/f/3.zip"), DmCrawl.run(j3, { u -> site[u]?.let { DmCrawl.Page(u, it) } }, { DmRobots.ALL }, {}, { false }, {}).map { it.url })
        assertEquals(listOf(job), DmCrawl.parseJobs(DmCrawl.dumpJobs(listOf(job))))
        assertTrue(DmCrawl.sizeOk(job.copy(minKb = 10), -1)); assertFalse(DmCrawl.sizeOk(job.copy(minKb = 10), 5000))
    }

    @Test fun taskJson() {
        val t = DmTask("abcdef123456", "https://a.com/x").apply { s0 = 10; s1 = 20; cv = "mp3"; chm = "split"; mir = "https://m1/x\nhttps://m2/x"; pl = 1024; pa = "SHA-256"; dg = "SHA-256:ab"; tags = "a,b"; note = "n"; priv = true; wid = "w1" }
        val b = DmTask.of(t.json())!!
        assertEquals(listOf(10, 20, "mp3", "split", 2, 1024L, "SHA-256:ab", "a,b", "n", true, "w1"), listOf(b.s0, b.s1, b.cv, b.chm, b.mirrors().size, b.pl, b.dg, b.tags, b.note, b.priv, b.wid))
        assertEquals("", DmTask.of(t.json().put("cv", "x;y"))!!.cv)
    }
}
