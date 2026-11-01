package io.github.yishaiguedj1.snowball.br

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 01/11/2026: Studio Browser Pro — הגל השלישי (BrDev): כלי מפתחים ושליטה באתר */
class BrDevTest {
    @Test fun cookiesHideHttpOnlyValues() {
        val l = BrDev.cookies("sid=SECRET; theme=dark; a=1", "theme=dark; a=1; js=2")
        val sid = l.first { it.name == "sid" }
        assertTrue(sid.httpOnly); assertNull(sid.value)                 // HttpOnly: השם בלבד
        assertEquals("dark", l.first { it.name == "theme" }.value)
        assertEquals("2", l.first { it.name == "js" }.value)
        assertEquals(listOf("a", "js", "sid", "theme"), l.map { it.name })
        assertEquals(emptyList<BrDev.Cookie>(), BrDev.cookies(null, ""))
        assertEquals(listOf("x" to "", "y" to "a=b"), BrDev.parseCookies(" x ; y=a=b; =z"))
    }

    @Test fun expireCoversDomains() {
        val e = BrDev.expire("sid", "www.example.co.il")
        assertTrue(e.all { it.startsWith("sid=; Max-Age=0") })
        assertTrue(e.any { it.endsWith("; domain=.example.co.il") })
        assertTrue(e.any { it.contains("path=/; domain=www.example.co.il") })
        assertFalse(e.any { it.endsWith("domain=.il") })
    }

    @Test fun storageParseAndUnquote() {
        val r = "\"{\\\"l\\\":[[\\\"k\\\",\\\"v\\\"]],\\\"s\\\":[],\\\"i\\\":[\\\"db\\\"],\\\"c\\\":\\\"a=1\\\"}\""
        val s = BrDev.storageParse(r)!!
        assertEquals(listOf("k" to "v"), s.local); assertEquals(listOf("db"), s.idb); assertEquals("a=1", s.doc)
        assertNull(BrDev.storageParse("null"))
        assertEquals("", BrDev.unquote("null")); assertEquals("a\nb", BrDev.unquote("\"a\\nb\""))
        assertTrue(BrDev.delStorageJs('l', "x'y").contains("removeItem(\"x'y\")"))
        assertTrue(BrDev.delStorageJs('s', null).contains("sessionStorage.clear()"))
    }

    @Test fun zapsRoundTripAndClean() {
        val m = mapOf("ynet.co.il" to listOf("#ad", "div > p:nth-of-type(2)", "#ad"), "bad host!" to listOf("x"), "e.com" to emptyList())
        val d = BrDev.zapsDecode(BrDev.zapsEncode(m))
        assertEquals(mapOf("ynet.co.il" to listOf("#ad", "div > p:nth-of-type(2)")), d)
        // בורר לא יכול לשבור את ה־CSS (סוגריים מסולסלים / תגית)
        val js = BrDev.hideJs(listOf("a{}</style><script>"))
        assertFalse(js.contains("</style>")); assertTrue(js.contains("display:none!important"))
        assertTrue(BrDev.hideJs(emptyList()).contains("s.textContent=\"\""))
    }

    @Test fun picked() {
        val p = BrDev.pickedParse("""{"s":"#main > div","t":"div","w":320,"h":40,"x":"<div>","st":{"color":"rgb(0, 0, 0)","margin":""}}""")!!
        assertEquals("#main > div", p.sel); assertEquals(320, p.w); assertEquals(listOf("color" to "rgb(0, 0, 0)"), p.styles)
        assertNull(BrDev.pickedParse("""{"s":""}""")); assertNull(BrDev.pickedParse("x"))
        assertTrue(BrDev.pickJs(BrDev.PICK_ZAP).endsWith("(2)")); assertTrue(BrDev.pickJs(0).contains("if(!m)return"))
    }

    @Test fun emulation() {
        assertNull(BrDev.emu("").ua); assertNull(BrDev.emu("nope").ua)
        assertTrue(BrDev.emu("ios").ua!!.contains("iPhone"))
        assertTrue(BrDev.emu("win").desktop); assertFalse(BrDev.emu("ios").desktop)
        assertEquals(BrDev.EMUS.size, BrDev.EMUS.map { it.id }.toSet().size)
    }

    @Test fun perf() {
        val p = BrDev.perfParse("\"120|900|1500|2600|-1|42|830|1200|30\"")!!
        assertEquals(120, p.ttfb); assertEquals(-1, p.lcp); assertEquals(830, p.kb)
        assertNull(BrDev.perfParse("\"1|2\"")); assertNull(BrDev.perfParse(null))
        assertEquals(0, BrDev.grade("fcp", 1800)); assertEquals(1, BrDev.grade("fcp", 2500)); assertEquals(2, BrDev.grade("lcp", 4001))
        assertEquals(-1, BrDev.grade("lcp", -1)); assertEquals(-1, BrDev.grade("dom", 5)); assertEquals(1, BrDev.grade("cls", 150))
    }

    @Test fun redirectsAndPopups() {
        assertTrue(BrDev.blockRedirect(false, "news.site.co.il", "ads.other.com", gesture = false, serverRedirect = false))
        assertFalse(BrDev.blockRedirect(false, "news.site.co.il", "www.site.co.il", false, false))   // אותו אתר
        assertFalse(BrDev.blockRedirect(false, "a.com", "b.com", gesture = true, serverRedirect = false))
        assertFalse(BrDev.blockRedirect(false, "a.com", "b.com", gesture = false, serverRedirect = true))
        assertFalse(BrDev.blockRedirect(true, "a.com", "b.com", false, false))
        assertTrue(BrDev.popupOk(0, true)); assertFalse(BrDev.popupOk(0, false)); assertTrue(BrDev.popupOk(1, false)); assertFalse(BrDev.popupOk(-1, true))
    }

    @Test fun siteRuleNewFields() {
        val r = BrShield.SiteRule("x.com", img = false, pop = -1, redir = false, dark = true)
        assertFalse(r.empty)
        assertEquals(r, BrShield.decode(BrShield.encode(listOf(r)))["x.com"])
        assertTrue(BrShield.decode("y.com|1|0|0|0|100|1|1")["y.com"]!!.let { it.img && it.pop == 0 && it.redir && !it.dark })   // שורה ישנה
        assertTrue(BrShield.SiteRule("z.com").empty)
    }

    @Test fun watchText() {
        val h = "<html><head><style>p{}</style><script>var x=1</script></head><body><h1>מבצע</h1><p>מחיר&nbsp;100</p><!-- c --><div>a<br>b</div></body></html>"
        assertEquals("מבצע\nמחיר 100\na\nb", BrDev.pageText(h))
        val n = BrDev.pageText(h.replace("100", "90"))
        assertEquals("מחיר 90", BrDev.diff(BrDev.pageText(h), n))
        assertFalse(BrDev.hash(BrDev.pageText(h)) == BrDev.hash(n))
        val w = BrDev.Watch("1", "https://a.com", "A", 6, at = 0L)
        assertTrue(BrDev.due(w, 6 * 3_600_000L)); assertFalse(BrDev.due(w.copy(at = 1000L), 3_600_000L))
        assertEquals(listOf(w), BrDev.watchDecode(BrDev.watchEncode(listOf(w, w.copy(id = "2", url = "file:///x")))))
        assertEquals(6, BrDev.watchDecode("""[{"id":"x","u":"https://a","e":5}]""")[0].every)
    }

    @Test fun macros() {
        var l = emptyList<BrDev.Step>()
        l = BrDev.addStep(l, BrDev.Step('n', "https://a"))                    // לא מתחילים במעבר דף
        l = BrDev.addStep(l, BrDev.Step('i', "#q", "a"))
        l = BrDev.addStep(l, BrDev.Step('i', "#q", "ab"))                     // אותו שדה — הערך האחרון
        l = BrDev.addStep(l, BrDev.Step('c', "#go"))
        l = BrDev.addStep(l, BrDev.Step('n', "https://a/r")); l = BrDev.addStep(l, BrDev.Step('n', "https://a/r2"))
        assertEquals(listOf('i', 'c', 'n'), l.map { it.k }); assertEquals("ab", l[0].v)
        val m = BrDev.Macro("m1", "https://a.com/", "חיפוש", l)
        assertEquals(listOf(m), BrDev.macrosDecode(BrDev.macrosEncode(listOf(m))))
        assertNull(BrDev.stepParse("""{"k":"x","s":"#a"}""")); assertEquals('c', BrDev.stepParse("""{"k":"c","s":"#a"}""")!!.k)
        assertTrue(BrDev.replayJs(l, 2).endsWith(",2)"))
        // סיסמאות ופרטי כרטיס לא נרשמים — הבדיקה בתוך הסקריפט
        assertTrue(BrDev.recJs(true).contains("t==='password'") && BrDev.recJs(true).contains("cc-"))
    }

    @Test fun userScripts() {
        assertTrue(BrDev.matches("ynet.co.il", "https://ynet.co.il/news/1"))
        assertFalse(BrDev.matches("ynet.co.il", "https://www.ynet.co.il/"))
        assertTrue(BrDev.matches("*.ynet.co.il", "https://ynet.co.il/")); assertTrue(BrDev.matches("*.ynet.co.il", "https://www.ynet.co.il/"))
        assertTrue(BrDev.matches("example.com/news/*", "https://example.com/news/a?x=1"))
        assertFalse(BrDev.matches("example.com/news/*", "https://example.com/sport"))
        assertTrue(BrDev.matches("a.com, b.com", "http://b.com"))
        assertFalse(BrDev.matches("a.com", "about:blank"))
        assertTrue(BrDev.sensitive("https://login.bankhapoalim.co.il/ng-portals/auth"))
        assertTrue(BrDev.sensitive("https://www.leumi.co.il/"))
        assertTrue(BrDev.sensitive("https://shop.com/checkout"))
        assertTrue(BrDev.sensitive("https://site.com/login?next=/"))
        assertTrue(BrDev.sensitive("https://accounts.google.com/x"))
        assertFalse(BrDev.sensitive("https://www.ynet.co.il/news/article/payments-rise"))
        assertFalse(BrDev.sensitive("https://identity-news.com/"))
        val s = BrDev.UScript("1", "x", "*", "1", on = true)
        assertEquals(1, BrDev.runnable(listOf(s), "https://a.com/").size)
        assertEquals(0, BrDev.runnable(listOf(s), "https://a.com/signin").size)        // רגיש — רק באישור
        assertEquals(1, BrDev.runnable(listOf(s.copy(sensitive = true)), "https://a.com/signin").size)
        assertEquals(0, BrDev.runnable(listOf(s.copy(on = false)), "https://a.com/").size)
        assertEquals(listOf(s), BrDev.scriptsDecode(BrDev.scriptsEncode(listOf(s, s.copy(id = "2", match = " ")))))
        assertTrue(BrDev.wrap(s.copy(name = "a'b")).contains("[ab]"))
    }
}
