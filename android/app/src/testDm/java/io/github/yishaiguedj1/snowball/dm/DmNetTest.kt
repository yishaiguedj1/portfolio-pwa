package io.github.yishaiguedj1.snowball.dm

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.Collections

/**
 * שלב 2: עוגיות מהדפדפן נשלחות רק לכתובת שהן שלה — גם אחרי הפניה (open עוקב בעצמו, ושואל על כל קפיצה בנפרד);
 * בלי ירידה מ־https ל־http; מגבלת מהירות לכל ההורדות; ולכל היותר PER_HOST הורדות במקביל מאותו אתר.
 */
class DmNetTest {
    private val servers = ArrayList<ServerSocket>()
    private val cookieSeen = Collections.synchronizedMap(HashMap<Int, String?>())

    private fun server(handle: (Int, String, Map<String, String>, Socket) -> Unit): Int {
        val s = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        servers.add(s)
        Thread {
            while (!s.isClosed) {
                val c = runCatching { s.accept() }.getOrNull() ?: break
                Thread {
                    try {
                        val inp = c.getInputStream().bufferedReader(Charsets.ISO_8859_1)
                        val line = inp.readLine() ?: ""
                        val h = HashMap<String, String>()
                        while (true) { val l = inp.readLine() ?: break; if (l.isEmpty()) break; val i = l.indexOf(':'); if (i > 0) h[l.substring(0, i).trim().lowercase()] = l.substring(i + 1).trim() }
                        handle(s.localPort, line, h, c)
                    } catch (e: Exception) {} finally { runCatching { c.close() } }
                }.apply { isDaemon = true; start() }
            }
        }.apply { isDaemon = true; start() }
        return s.localPort
    }

    private fun reply(c: Socket, status: Int, headers: Map<String, String>, body: ByteArray = ByteArray(0)) {
        val sb = StringBuilder("HTTP/1.1 $status X\r\n")
        headers.forEach { (k, v) -> sb.append("$k: $v\r\n") }
        sb.append("Content-Length: ${body.size}\r\nConnection: close\r\n\r\n")
        c.getOutputStream().apply { write(sb.toString().toByteArray(Charsets.ISO_8859_1)); write(body); flush() }
    }

    @Before fun up() { DmLimit.bytesPerSec = 0 }
    @After fun down() { servers.forEach { it.close() }; DmLimit.bytesPerSec = 0 }

    @Test fun cookiesStayOnTheirSiteAcrossRedirect() {
        val b = server { port, _, h, c -> cookieSeen[port] = h["cookie"]; reply(c, 206, mapOf("Content-Range" to "bytes 0-0/10", "ETag" to "\"x\""), byteArrayOf(1)) }
        val a = server { port, _, h, c -> cookieSeen[port] = h["cookie"]; reply(c, 302, mapOf("Location" to "http://127.0.0.1:$b/f.bin")) }
        val asked = ArrayList<String>()
        val p = DmFetch.probe("http://127.0.0.1:$a/go", cookies = { u -> asked.add(u); if (u.contains(":$a/")) "sid=secret" else null })
        assertEquals(10L, p.total)
        assertEquals("sid=secret", cookieSeen[a])
        assertNull("העוגייה של האתר הראשון לא עוברת לאתר שאליו מפנים", cookieSeen[b])
        assertEquals(2, asked.size)   // שאלנו על כל קפיצה בנפרד
        assertTrue(p.finalUrl.contains(":$b/"))
    }

    @Test fun noCookieHeaderInjection() {
        val a = server { port, _, h, c -> cookieSeen[port] = h["cookie"]; reply(c, 206, mapOf("Content-Range" to "bytes 0-0/10"), byteArrayOf(1)) }
        DmFetch.probe("http://127.0.0.1:$a/f", cookies = { "a=1\r\nX-Evil: 1" })
        assertNull(cookieSeen[a])
    }

    @Test fun tooManyRedirectsStops() {
        var a = 0
        a = server { _, _, _, c -> reply(c, 302, mapOf("Location" to "http://127.0.0.1:$a/again")) }
        val e = runCatching { DmFetch.probe("http://127.0.0.1:$a/x") }.exceptionOrNull()
        assertTrue(e is DmHttpError && e.status == 302)
    }

    @Test fun limiterHoldsTheRate() {
        var t = 0L
        DmLimit.now = { t }
        try {
            DmLimit.bytesPerSec = 1000
            var slept = 0L
            val sleep: (Long) -> Unit = { ms -> slept += ms; t += ms * 1_000_000 }
            repeat(10) { DmLimit.take(500, sleep) }          // 5000 בתים בקצב 1000/שנ׳
            assertTrue("בערך 5 שניות (חצי שנייה בדלי בהתחלה)", slept in 4500..5100)
            DmLimit.bytesPerSec = 0
            var none = 0L
            DmLimit.take(1_000_000) { none += it }
            assertEquals(0L, none)
        } finally { DmLimit.now = { System.nanoTime() } }
    }

    @Test fun perHostLimit() {
        val q = listOf("https://a.com/1", "https://www.a.com/2", "https://a.com/3", "https://b.com/1", "https://c.com/1")
        assertEquals(listOf(0, 1, 3), DmLink.pickStart(q, emptyList(), 3))
        assertEquals(listOf(3, 4), DmLink.pickStart(q, listOf("https://a.com/x", "https://a.com/y"), 5))
        assertEquals(listOf(0), DmLink.pickStart(q, emptyList(), 1))
        assertEquals("a.com", DmLink.host("https://WWW.A.com/x?y"))
    }
}
