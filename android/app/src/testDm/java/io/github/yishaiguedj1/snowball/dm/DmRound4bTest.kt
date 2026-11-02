package io.github.yishaiguedj1.snowball.dm

import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.Proxy
import java.net.ServerSocket
import java.net.URL
import java.util.Random

/** סבב 4ב של השדרוג (02/11/2026): שרת ברשת הבית, קוד מהמחשב, כניסות לאתרים, רשת, נדידה, ספרייה, חריגים, גיליון חכם, סיכום יומי */
class DmRound4bTest {
    @After fun reset() { DmNet.creds = { null }; DmNet.uaRules = emptyMap(); DmNet.proxy = null }

    private fun get(u: String, range: String? = null): HttpURLConnection = (URL(u).openConnection(Proxy.NO_PROXY) as HttpURLConnection).apply {
        range?.let { setRequestProperty("Range", it) }; connectTimeout = 5000; readTimeout = 5000
    }

    @Test fun lanServer() {
        val data = ByteArray(200_000).also { Random(5).nextBytes(it) }
        var ended: Boolean? = null
        val s = DmLanServer("סרט \"1\".mp4", data.size.toLong(), "video/mp4", { pos -> ByteArrayInputStream(data, pos.toInt(), data.size - pos.toInt()) }, onEnd = { ended = it })
        s.start(InetAddress.getByName("127.0.0.1"))
        val base = s.url("127.0.0.1")
        assertEquals(6, s.pin.length); assertEquals(24, s.token.length)
        assertEquals(200, get(base).responseCode)
        assertEquals(404, get(base.substringBeforeLast('/') + "/wrongtoken").responseCode)
        assertEquals(403, get("$base/f?pin=000000x").responseCode)
        // המשך מאמצע (Range)
        val r = get("$base/f?pin=${s.pin}", "bytes=1000-1999")
        assertEquals(206, r.responseCode); assertArrayEquals(data.copyOfRange(1000, 2000), r.inputStream.readBytes())
        assertNull(ended)
        val c = get("$base/f?pin=${s.pin}")
        assertEquals(200, c.responseCode)
        assertTrue(c.getHeaderField("Content-Disposition").contains("filename*=UTF-8''"))
        assertArrayEquals(data, c.inputStream.readBytes())
        Thread.sleep(200)
        assertEquals(true, ended); assertTrue(s.closed)   // נסגר אחרי העברה מלאה
    }

    @Test fun lanLockout() {
        val s = DmLanServer("a.bin", 10, "", { ByteArrayInputStream(ByteArray(10)) })
        s.start(InetAddress.getByName("127.0.0.1"))
        val base = s.url("127.0.0.1")
        repeat(5) { assertEquals(403, get("$base/f?pin=x$it").responseCode) }
        assertEquals(410, get("$base/f?pin=${s.pin}").responseCode)   // 5 ניסיונות שגויים — נסגר
        assertTrue(DmLanServer.lanOk("192.168.1.5")); assertTrue(DmLanServer.lanOk("10.0.0.2")); assertTrue(DmLanServer.lanOk("172.20.1.1"))
        assertFalse(DmLanServer.lanOk("8.8.8.8")); assertFalse(DmLanServer.lanOk("172.40.1.1"))
    }

    @Test fun scan() {
        val r = DmScan.parse("studiodm://add?url=https%3A%2F%2Fa.com%2Ff.zip&quiet=1")!!
        assertEquals(listOf("https://a.com/f.zip"), r.urls); assertFalse(r.quiet)   // מהסורק — תמיד עם הגיליון
        assertEquals(listOf("https://b.com/x"), DmScan.parse("https://b.com/x")!!.urls)
        assertNull(DmScan.parse("hello https://b.com/x")); assertNull(DmScan.parse("javascript:alert(1)")); assertNull(DmScan.parse(""))
    }

    @Test fun digestAuthVector() {
        // RFC 2617, סעיף 3.5
        val ch = DmAuth.challenge("""Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"""")!!
        assertEquals("digest", ch.first)
        val h = DmAuth.digest(ch.second, "Mufasa", "Circle Of Life", "GET", "/dir/index.html", "0a4f113b")!!
        assertTrue(h.contains("response=\"6629fae49393a05397450978507c4ef1\""))
        assertTrue(h.contains("nc=00000001")); assertTrue(h.contains("opaque=\"5ccc069c403ebaf9f0171e9517f40e41\""))
        assertNull(DmAuth.digest(ch.second + ("algorithm" to "SHA-512-256"), "a", "b", "GET", "/", "c"))
        assertEquals("Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==", DmAuth.basic("Aladdin", "open sesame"))
        assertEquals("a.com", DmAuth.hostOf("https://www.a.com/x")); assertEquals("files.b.org", DmAuth.hostOf("files.b.org")); assertEquals("", DmAuth.hostOf("bad host!"))
    }

    /** המנוע עונה ל־Digest לבד, רק לאתר שיש לו כניסה; Basic לא נשלח ב־http גלוי */
    @Test fun authInFetch() {
        val srv = ServerSocket(0, 20, InetAddress.getByName("127.0.0.1"))
        val seen = java.util.Collections.synchronizedList(ArrayList<String>())
        Thread {
            while (!srv.isClosed) {
                val c = runCatching { srv.accept() }.getOrNull() ?: break
                runCatching {
                    c.use { s ->
                        val rd = s.getInputStream().bufferedReader(Charsets.ISO_8859_1)
                        val line = rd.readLine() ?: return@use
                        var auth = ""
                        while (true) { val h = rd.readLine() ?: break; if (h.isEmpty()) break; if (h.startsWith("Authorization:", true)) auth = h.substringAfter(':').trim() }
                        seen.add(auth)
                        val path = line.split(' ')[1]
                        val ok = auth.startsWith("Digest ") && auth.contains("username=\"u\"") && auth.contains("uri=\"$path\"")
                        val chal = if (path.startsWith("/basic")) "Basic realm=\"r\"" else "Digest realm=\"r\", nonce=\"n1\", qop=\"auth\""
                        val o = s.getOutputStream()
                        if (ok) o.write("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok".toByteArray())
                        else o.write("HTTP/1.1 401 X\r\nWWW-Authenticate: $chal\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray())
                    }
                }
            }
        }.apply { isDaemon = true; start() }
        try {
            val base = "http://127.0.0.1:${srv.localPort}"
            DmNet.creds = { h -> if (h == "127.0.0.1") DmCred(h, "u", "p") else null }
            val c = DmFetch.open("$base/f.bin?x=1", "", DmFetch.UA, conn = { it.openConnection(Proxy.NO_PROXY) })
            assertEquals(200, c.responseCode); c.disconnect()
            assertEquals(2, seen.size); assertEquals("", seen[0])
            seen.clear()
            val b = DmFetch.open("$base/basic", "", DmFetch.UA, conn = { it.openConnection(Proxy.NO_PROXY) })
            assertEquals(401, b.responseCode); b.disconnect()
            assertEquals(listOf(""), seen.toList())   // Basic ב־http — לא נשלח
            seen.clear()
            DmNet.creds = { null }
            assertEquals(401, DmFetch.open("$base/f.bin", "", DmFetch.UA, conn = { it.openConnection(Proxy.NO_PROXY) }).responseCode)
            assertEquals(1, seen.size)   // בלי כניסה — אין ניסיון שני
        } finally { srv.close() }
    }

    @Test fun net() {
        val p = DmNet.parseProxy("socks://10.0.0.1:1080")!!
        assertEquals(Proxy.Type.SOCKS, p.type())
        assertEquals(Proxy.Type.HTTP, DmNet.parseProxy("proxy.lan:3128")!!.type())
        assertNull(DmNet.parseProxy("bad:99999")); assertNull(DmNet.parseProxy("a b:80")); assertNull(DmNet.parseProxy(""))
        DmNet.uaRules = DmNet.parseUa("a.com=desktop\nb.org=MyAgent/1\nbad\n=x\nc.net=line\r")
        assertEquals(DmNet.UA_PRESETS["desktop"], DmNet.uaFor("a.com", "x"))
        assertEquals(DmNet.UA_PRESETS["desktop"], DmNet.uaFor("cdn.a.com", "x"))
        assertEquals("MyAgent/1", DmNet.uaFor("b.org", "x")); assertEquals("x", DmNet.uaFor("z.com", "x"))
    }

    @Test fun travel() {
        val now = 1_000_000L
        assertEquals(DmTravel.Act.ASK, DmTravel.act(true, 0, false, now))
        assertEquals(DmTravel.Act.OK, DmTravel.act(false, 0, false, now))
        assertEquals(DmTravel.Act.WIFI_ONLY, DmTravel.act(true, now + 1, false, now))
        assertEquals(DmTravel.Act.WIFI_ONLY, DmTravel.act(false, now + 1, false, now))   // בחו"ל: רק Wi‑Fi (גם אם הנדידה לא זוהתה)
        assertEquals(DmTravel.Act.OK, DmTravel.act(true, now + 1, true, now))            // חבילה בחו"ל
        assertEquals(DmTravel.Act.ASK, DmTravel.act(true, now - 1, false, now))          // נגמר — חזרה לרגיל
        assertTrue(DmTravel.expired(now - 1, now)); assertFalse(DmTravel.expired(0, now)); assertFalse(DmTravel.expired(now + 5, now))
        val tz = java.util.TimeZone.getTimeZone("Asia/Jerusalem")
        val c = java.util.Calendar.getInstance(tz).apply { timeInMillis = DmTravel.endOfDay(2026, 11, 20, tz) }
        assertEquals(listOf(2026, 10, 20, 23, 59), listOf(c.get(1), c.get(2), c.get(5), c.get(11), c.get(12)))
    }

    @Test fun library() {
        fun t(id: String, n: String, size: Long, fin: Long, tg: String = "", host: String = "a.com") =
            DmTask(id + "000000", "https://$host/$n").apply { name = n; total = size; finishedAt = fin; state = DmState.DONE; tags = tg }
        val ts = listOf(t("a", "zeta.mp4", 10, 3, "קורס,עבודה"), t("b", "alpha.pdf", 30, 1, host = "b.com"), t("c", "beta.zip", 20, 2, "קורס"))
        assertEquals(listOf("zeta.mp4", "beta.zip", "alpha.pdf"), DmLib.apply(ts, DmLib.Q()).map { it.name })
        assertEquals(listOf("alpha.pdf", "beta.zip", "zeta.mp4"), DmLib.apply(ts, DmLib.Q(sort = DmLib.Sort.SIZE)).map { it.name })
        assertEquals(listOf("alpha.pdf", "beta.zip", "zeta.mp4"), DmLib.apply(ts, DmLib.Q(sort = DmLib.Sort.NAME)).map { it.name })
        assertEquals(listOf("zeta.mp4", "beta.zip"), DmLib.apply(ts, DmLib.Q(tag = "קורס")).map { it.name })
        assertEquals(listOf("alpha.pdf"), DmLib.apply(ts, DmLib.Q(text = "b.com")).map { it.name })
        assertEquals(listOf("קורס", "עבודה"), DmLib.allTags(ts))
        val day = 86_400_000L
        assertEquals(listOf("b000000"), DmLib.stale(ts.map { it.apply { finishedAt *= day } }, 2, 4 * day))
        assertTrue(DmLib.stale(ts, 0, Long.MAX_VALUE).isEmpty())
    }

    @Test fun exclusions() {
        val ex = DmExcl.parse("work.com\n.EXE\n\nhttps://www.intra.net/x\n.toolongext\n")
        assertTrue(DmExcl.blocked("https://work.com/a.zip", ex)); assertTrue(DmExcl.blocked("https://files.work.com/a.zip", ex))
        assertTrue(DmExcl.blocked("https://x.org/setup.exe", ex)); assertTrue(DmExcl.blocked("https://intra.net/a", ex))
        assertFalse(DmExcl.blocked("https://notwork.com/a.zip", ex)); assertFalse(DmExcl.blocked("https://x.org/a.zip", ex))
    }

    @Test fun smart() {
        assertEquals(DmSmart.K.MAGNET, DmSmart.kind("magnet:?xt=urn:btih:abc"))
        assertEquals(DmSmart.K.STUDIODM, DmSmart.kind("studiodm://add?url=x"))
        assertEquals(DmSmart.K.METALINK, DmSmart.kind("https://a.org/img.meta4"))
        assertEquals(DmSmart.K.METALINK, DmSmart.kind("<?xml?><metalink xmlns='x'></metalink>"))
        assertEquals(DmSmart.K.FEED, DmSmart.kind("https://pod.com/feed/"))
        assertEquals(DmSmart.K.FEED, DmSmart.kind("https://www.youtube.com/feeds/videos.xml?channel_id=UC1"))
        assertEquals(DmSmart.K.PATTERN, DmSmart.kind("https://a.com/ep[01-03].mp4"))
        assertEquals(DmSmart.K.LIST, DmSmart.kind("https://a.com/1 https://a.com/2"))
        assertEquals(DmSmart.K.ONE, DmSmart.kind("https://a.com/file.zip"))
        assertEquals(DmSmart.K.TEXT, DmSmart.kind("just words"))
        assertEquals(DmSmart.K.EMPTY, DmSmart.kind("  "))
    }

    @Test fun daily() {
        var d = DmDaily.Day(0, 0, 0, 0, 0)
        d = DmDaily.add(d, 20261102, 1000, 500, true).first
        d = DmDaily.add(d, 20261102, 3000, 1500, false).first
        assertEquals(DmDaily.Day(20261102, 4000, 2000, 1, 1), d)
        assertEquals(2000L, DmDaily.avg(d))
        val (n, prev) = DmDaily.add(d, 20261103, 10, 10, null)
        assertEquals(d, prev); assertEquals(DmDaily.Day(20261103, 10, 10, 0, 0), n)
        assertEquals(d, DmDaily.parse(DmDaily.dump(d)))
        assertFalse(DmDaily.worth(n))
    }
}
