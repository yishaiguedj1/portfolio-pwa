package io.github.yishaiguedj1.snowball.br

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 03/11/2026: סריקת אתר לסרטונים (BrScan) — ניתוח, מספור, סדר, עדינות ואבטחה */
class BrScanTest {

    @Test fun numbering() {
        assertEquals(BrScan.Num(1, 2), BrScan.num("The Show S01E02 Pilot"))
        assertEquals(BrScan.Num(2, 5), BrScan.num("הסדרה - עונה 2 פרק 5"))
        assertEquals(BrScan.Num(-1, 12), BrScan.num("בפרק 12: הסוף"))
        assertEquals(BrScan.Num(-1, 3), BrScan.num("שיעור 3 – מבוא"))
        assertEquals(BrScan.Num(-1, 7), BrScan.num("Episode 7"))
        assertEquals(BrScan.Num(-1, 2), BrScan.num("פרק שני"))
        assertEquals(BrScan.Num(-1, 4, 2), BrScan.num("Lesson 4 Part 2"))
        assertEquals(BrScan.Num(-1, 3), BrScan.num("חלק 3"))
        assertEquals(BrScan.Num(3, 10), BrScan.num("show 3x10"))
        assertFalse(BrScan.num("1920x1080 trailer").ep == 1920)
        assertFalse(BrScan.num("שלום עולם").has)
        assertEquals(12, BrScan.numUrl("https://s.com/show/episode-12/").ep)
        assertEquals(BrScan.Num(2, 5), BrScan.numUrl("https://s.com/show/s2/e5"))
        assertFalse(BrScan.numUrl("https://s.com/news/2024/").has)
        assertEquals("הסדרה", BrScan.seriesName("הסדרה - עונה 2 פרק 5"))
    }

    @Test fun parsesPage() {
        val html = """<html><head><title>פרק 3 | האתר</title><meta property="og:site_name" content="האתר">
            <meta property="og:video" content="https://cdn.s.com/v/ep3.m3u8"></head><body>
            <video autoplay muted loop src="/bg.mp4"></video>
            <video controls><source src="/media/ep3.mp4" type="video/mp4"></video>
            <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"></iframe>
            <iframe src="https://ads.doubleclick.net/x.mp4"></iframe>
            <a href="/show/ep-4?utm_source=x#top">פרק 4</a><a href="javascript:void(0)">x</a><a href="/logout">יציאה</a>
            <a rel="next" href="/show?page=2">הבא</a>
            <script>var p={"file":"https:\/\/cdn.s.com\/v\/ep3-hd.mp4"}</script></body></html>"""
        val p = BrScan.parse(html, "https://s.com/show/ep-3")
        assertEquals("פרק 3", p.title)
        val urls = p.media.map { it.url }
        assertTrue(urls.contains("https://s.com/media/ep3.mp4"))
        assertTrue(urls.contains("https://cdn.s.com/v/ep3.m3u8"))
        assertTrue(urls.contains("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        assertTrue(urls.contains("https://cdn.s.com/v/ep3-hd.mp4"))
        assertFalse("סרטון רקע לא נכנס", urls.contains("https://s.com/bg.mp4"))
        assertFalse(urls.any { "doubleclick" in it })
        assertEquals('s', p.media.first { it.url.endsWith("m3u8") }.kind)
        val l = p.links.associateBy { it.url }
        assertEquals("פרק 4", l["https://s.com/show/ep-4"]?.text)
        assertTrue(l["https://s.com/show?page=2"]!!.next)
        assertNull(l.keys.firstOrNull { it.startsWith("javascript") })
    }

    @Test fun securityScope() {
        val h = "s.com"
        assertTrue(BrScan.crawlable("https://s.com/show/ep-1", h, null, true))
        assertFalse("לא מורידים ל־http", BrScan.crawlable("http://s.com/show/ep-1", h, null, true))
        assertFalse("אתר אחר", BrScan.crawlable("https://evil.com/x", h, null, true))
        assertFalse("תת־דומיין אחר", BrScan.crawlable("https://s.com.evil.com/x", h, null, true))
        listOf("/logout", "/user/sign-out", "/wp-login.php", "/cart", "/account/settings", "/post?action=delete", "/x?_wpnonce=1", "/search?q=a", "/item/delete/3")
            .forEach { assertFalse(it, BrScan.crawlable("https://s.com$it", h, null, true)) }
        assertFalse("קבצים לא נסרקים כדפים", BrScan.crawlable("https://s.com/a.zip", h, null, true))
        assertTrue(BrScan.crawlable("https://www.s.com/show/ep-2", h, "/show", true))
        assertFalse("מחוץ לסעיף", BrScan.crawlable("https://s.com/other", h, "/show", true))
        assertFalse("/showcase אינו /show", BrScan.crawlable("https://s.com/showcase", h, "/show", true))
        assertNull("סיסמה בכתובת לא עוברת", BrScan.norm("https://u:p@s.com/x"))
        assertNull(BrScan.norm("file:///etc/passwd"))
        assertEquals("https://s.com/a?b=1", BrScan.norm("https://S.com/a?b=1&utm_medium=x&fbclid=y#z"))
        assertEquals("/show", BrScan.prefixOf("https://s.com/show/"))
        assertEquals("/show", BrScan.prefixOf("https://s.com/show/index.html"))
    }

    @Test fun orderAndNames() {
        val m = { u: String -> BrScan.Media(u, 'e', "") }
        val raw = listOf(
            BrScan.Raw(m("https://v.com/3"), "https://s.com/a3", "הסדרה פרק 3", "", 0, 0, 1),
            BrScan.Raw(m("https://v.com/1"), "https://s.com/a1", "הסדרה פרק 1", "", 1, 0, 1),
            BrScan.Raw(m("https://v.com/10"), "https://s.com/a10", "הסדרה פרק 10", "", 2, 0, 1),
            BrScan.Raw(m("https://v.com/t"), "https://s.com/a1", "x", "", 3, 1, 2),
            BrScan.Raw(m("https://v.com/t"), "https://s.com/a3", "x", "", 4, 1, 2),
            BrScan.Raw(m("https://v.com/t"), "https://s.com/a10", "x", "", 5, 1, 2),
            BrScan.Raw(BrScan.Media("https://s.com/x.mp4", 'f', "mp4"), "https://s.com/misc", "סתם", "", 6, 0, 1),
        )
        val g = BrScan.order(raw, "האתר")
        assertEquals(2, g.size)
        assertEquals(listOf(1, 3, 10), g[0].items.map { it.num.ep })
        assertFalse("טריילר בכל הדפים לא נכנס", g.flatMap { it.items }.any { it.media.url == "https://v.com/t" })
        assertEquals("01 - הסדרה פרק 1", BrScan.fileName(g[0].items[0], g[0]))
        assertEquals("", g[1].key)
        assertEquals("סתם.mp4", BrScan.fileName(g[1].items[0], g[1]))
        assertEquals("הסדרה", BrScan.folder(g[0], "האתר"))
        // כותרת כללית של אתר JS — טקסט הקישור קובע
        val js = (1..3).map { i -> BrScan.Raw(m("https://v.com/j$i"), "https://s.com/j$i", "האתר שלי", "שיעור ${4 - i}", i, 0, 1) }
        assertEquals(listOf("שיעור 1", "שיעור 2", "שיעור 3"), BrScan.order(js)[0].items.map { it.title })
    }

    @Test fun politeness() {
        assertEquals(5000L, BrScan.crawlDelay("User-agent: *\nCrawl-delay: 5\n"))
        assertEquals(30_000L, BrScan.crawlDelay("User-agent: *\nCrawl-delay: 999"))
        assertEquals(2000L, BrScan.crawlDelay("User-agent: studiodm\nCrawl-delay: 2\nUser-agent: *\nCrawl-delay: 9"))
        val p = BrScan.Pace(rnd = { 0 })
        assertEquals(1500L, p.gap())
        p.robotsMs = 4000; assertEquals(4000L, p.gap())
        p.robotsMs = 0
        p.ok(5000); assertTrue("שרת איטי → מאטים", p.gap() >= 10_000)
        val q = BrScan.Pace(rnd = { 0 })
        assertEquals(30_000L, q.busy(30))
        assertTrue(q.busy(-1) >= 5000); q.busy(-1)
        assertEquals(-1L, q.busy(-1))
        assertFalse(q.denied()); assertFalse(q.denied()); assertTrue(q.denied())
    }

    private fun site(): Map<String, String> = mapOf(
        "https://s.com/show" to """<a href="/show/ep-2">פרק 2</a><a href="/show/ep-1">פרק 1</a><a href="/logout">x</a><a href="https://o.com/y">o</a><a rel="next" href="/show?page=2">הבא</a>""",
        "https://s.com/show?page=2" to """<a href="/show/ep-3">פרק 3</a>""",
        "https://s.com/show/ep-1" to """<title>פרק 1</title><video controls src="/v/1.mp4"></video>""",
        "https://s.com/show/ep-2" to """<title>פרק 2</title><video controls src="/v/2.mp4"></video>""",
        "https://s.com/show/ep-3" to """<title>פרק 3</title><iframe src="https://player.vimeo.com/video/123456"></iframe>""",
    )

    @Test fun crawls() {
        val s = site(); val asked = ArrayList<String>(); val slept = ArrayList<Long>()
        val st = BrScan.State()
        val end = BrScan.run("https://s.com/show", BrScan.Mode.LINKS, 50, null,
            fetch = { u -> asked.add(u); s[u]?.let { BrScan.Resp(200, u, it) } ?: BrScan.Resp(404, u, null) },
            robots = { BrScan.Robots({ true }, 0) }, sleep = { slept.add(it) }, stop = { false }, st = st) {}
        assertEquals(BrScan.End.DONE, end)
        assertFalse("לא נכנסים ליציאה", asked.any { "logout" in it })
        assertFalse("לא יוצאים לאתר אחר", asked.any { "o.com" in it })
        assertEquals(asked.size, asked.distinct().size)
        assertTrue("מרווח לפני כל בקשה (robots נחשב)", slept.size >= asked.size && slept.all { it >= BrScan.MIN_GAP_MS })
        val g = BrScan.order(st.raw)
        assertEquals("דף המשך לא מוסיף עומק — גם פרק 3 נמצא", listOf(1, 2, 3), g[0].items.map { it.num.ep })
        assertEquals("https://vimeo.com/123456", g[0].items[2].media.url)
    }

    @Test fun backsOffAndStops() {
        var n = 0; val slept = ArrayList<Long>()
        val end = BrScan.run("https://s.com/show", BrScan.Mode.SITE, 50, null,
            fetch = { u -> n++; BrScan.Resp(429, u, null, 20) }, robots = { BrScan.Robots({ true }, 0) },
            sleep = { slept.add(it) }, stop = { false }, st = BrScan.State()) {}
        assertEquals(BrScan.End.BUSY, end)
        assertEquals(4, n)
        assertTrue(slept.count { it == 20_000L } == 3)
        val st = BrScan.State()
        assertEquals(BrScan.End.CAP, BrScan.run("https://s.com/show", BrScan.Mode.SITE, 2, null,
            fetch = { u -> site()[u]?.let { BrScan.Resp(200, u, it) } }, robots = { BrScan.Robots({ true }, 0) }, sleep = {}, stop = { false }, st = st) {})
        assertEquals(2, st.pages)
        // robots אוסר — לא מבקשים
        val asked = ArrayList<String>()
        BrScan.run("https://s.com/show", BrScan.Mode.LINKS, 50, site()["https://s.com/show"],
            fetch = { u -> asked.add(u); site()[u]?.let { BrScan.Resp(200, u, it) } }, robots = { BrScan.Robots({ p -> !p.startsWith("/show/ep-2") }, 0) },
            sleep = {}, stop = { false }, st = BrScan.State()) {}
        assertFalse(asked.contains("https://s.com/show/ep-2"))
        assertFalse("הדף הפתוח לא מתבקש שוב", asked.contains("https://s.com/show"))
        // הפניה לדף התחברות = ההתחברות פגה
        assertEquals(BrScan.End.LOGIN, BrScan.run("https://s.com/show", BrScan.Mode.LINKS, 50, site()["https://s.com/show"],
            fetch = { u -> BrScan.Resp(200, "https://s.com/login?next=x", "<html></html>") }, robots = { BrScan.Robots({ true }, 0) },
            sleep = {}, stop = { false }, st = BrScan.State()) {})
    }
}
