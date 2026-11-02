package io.github.yishaiguedj1.snowball.br

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.zip.ZipInputStream

/** 02/11/2026: Studio Browser Pro — הגל השישי (BrOurs): Studio, Academy ו־Invest */
class BrOursTest {

    private val SRT = "﻿1\r\n00:00:01,000 --> 00:00:03,500\r\n<i>שלום</i> לכולם.\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\n{\\an8}היום נדבר על ריבית\r\n\r\n"
    private val VTT = "WEBVTT\n\nNOTE x\n\n00:01.000 --> 00:02.250 align:start\nHello &amp; welcome\n\nid2\n01:00:00.5 --> 01:00:01.000\nLate\n"

    @Test fun parsesSrtAndVtt() {
        val s = BrOurs.parseSubs(SRT)
        assertEquals(2, s.size)
        assertEquals(1000L, s[0].s); assertEquals(3500L, s[0].e); assertEquals("שלום לכולם.", s[0].t)
        assertEquals("היום נדבר על ריבית", s[1].t)
        val v = BrOurs.parseSubs(VTT)
        assertEquals(2, v.size)
        assertEquals("Hello & welcome", v[0].t); assertEquals(2250L, v[0].e)
        assertEquals(3_600_500L, v[1].s)
        assertTrue(BrOurs.parseSubs("garbage\n\nnothing").isEmpty())
        // הלוך ושוב דרך SRT
        assertEquals(s, BrOurs.parseSubs(BrOurs.toSrt(s)))
        assertEquals("1:02:03", BrOurs.clock(3_723_000)); assertEquals("4:05", BrOurs.clock(245_000))
    }

    @Test fun attachJsIsSafeAndUsesNativeTrack() {
        val js = BrOurs.attachJs(listOf(BrOurs.Cue(0, 1000, "a\"</script><b>'")), "עברית", "he")
        assertTrue(js.contains("addTextTrack") && js.contains("VTTCue"))
        assertFalse(js.contains("innerHTML") || js.contains("blob:"))
        assertTrue(js.contains("a\\\"") && !js.contains("</script>"))   // הטקסט עובר כמחרוזת JSON (‏org.json כותב ‎<\/)
        assertTrue(BrOurs.seekJs(61_500).contains("currentTime=61.5"))
        val (l, c) = BrOurs.pageSubs(JSONObject.quote(JSONObject().put("l", "en").put("c", JSONArray().put(JSONArray().put(2000).put(3000).put("<c>Hi</c>"))).toString()))
        assertEquals("en", l); assertEquals("Hi", c.single().t)
        assertTrue(BrOurs.pageSubs("null").second.isEmpty())
    }

    /** תמליל של 12 דקות: שלושה נושאים, עם הפסקות ארוכות ביניהם */
    private fun talk(): List<BrOurs.Cue> {
        val topics = listOf(
            "ריבית הבנק המרכזי עלתה והמשכנתאות התייקרו",
            "מניות הטכנולוגיה עלו אחרי הדוחות של החברות",
            "קרנות המדד מתאימות לחיסכון ארוך טווח בלי דמי ניהול גבוהים")
        val out = ArrayList<BrOurs.Cue>(); var t = 0L
        topics.forEachIndexed { k, s ->
            repeat(24) { i ->
                out.add(BrOurs.Cue(t, t + 9000, if (i % 3 == 0) "$s." else "ועוד משפט על ${s.split(' ')[0]} מספר $i."))
                t += 10_000
            }
            t += 6000   // הפסקה בין נושאים
        }
        return out
    }

    @Test fun chaptersFollowPausesAndSummaryIsExtractive() {
        val c = talk()
        val ch = BrOurs.chapters(c)
        assertTrue(ch.size in 2..12)
        assertEquals(0L, ch[0].s)
        assertTrue(ch.zipWithNext().all { (a, b) -> b.s > a.s })
        assertTrue(ch.all { it.title.isNotBlank() && it.title.length <= 66 })
        val sum = BrOurs.summary(c)
        assertTrue(sum.size in 3..7)
        assertTrue(sum.zipWithNext().all { (a, b) -> b.s > a.s })               // בסדר שבו נאמרו
        val all = BrOurs.sentences(c).map { it.t }.toSet()
        assertTrue(sum.all { it.t in all })                                     // רק משפטים מהתמליל עצמו
        assertTrue(BrOurs.chapters(c.take(5)).isEmpty())                        // קצר מדי — אין פרקים
    }

    @Test fun searchFoldsNiqqudAndFinalLetters() {
        val c = talk()
        val h = BrOurs.search(c, "משכנתאוֹת")
        assertTrue(h.isNotEmpty() && h.all { "משכנתאות" in it.t })
        assertTrue(BrOurs.search(c, "את").isEmpty())                             // מילה ריקה בלבד
        assertEquals(BrOurs.fold("שלום"), BrOurs.fold("שָׁלוֹם"))
        assertTrue(BrOurs.search(c, "חיסכון ארוך").all { "חיסכון" in it.t })
    }

    @Test fun sentListMatchesReturningFile() {
        val now = 10L * 86_400_000L
        var l = emptyList<BrOurs.Sent>()
        l = BrOurs.sentAdd(l, BrOurs.Sent("https://www.youtube.com/watch?v=a", "Interest rates explained", now - 1000), now)
        l = BrOurs.sentAdd(l, BrOurs.Sent("https://vimeo.com/2", "Cooking pasta at home", now - 500), now)
        l = BrOurs.sentAdd(l, BrOurs.Sent("https://youtube.com/watch?v=a&utm_source=x", "Interest rates explained", now), now)
        assertEquals(2, l.size)                                                  // אותו דף — מתעדכן, לא כפול
        assertEquals(l, BrOurs.sentDecode(BrOurs.sentEncode(l)))
        assertEquals("Cooking pasta at home", BrOurs.matchSent(l, "Cooking pasta at home.he.srt", now)?.title)
        assertEquals("Interest rates explained", BrOurs.matchSent(l, "x.srt", now)?.title)   // בלי התאמה — האחרון
        assertNull(BrOurs.matchSent(l, "x.srt", now + 30L * 86_400_000L))
        assertEquals(BrOurs.subsFile("https://youtube.com/watch?v=a"), BrOurs.subsFile("https://www.youtube.com/watch?v=a&utm_source=y"))
        assertEquals(720, BrOurs.laterHeight(listOf(2160, 720, 360)))
        assertEquals(1080, BrOurs.laterHeight(listOf(2160, 1080, 720)))
        assertEquals(1440, BrOurs.laterHeight(listOf(2160, 1440)))
        assertNull(BrOurs.laterHeight(emptyList()))
    }

    @Test fun epubIsValidAndEscaped() {
        val a = BrRead.Article("https://site.co.il/a?x=1&y=2", "כותרת <מבחן> & עוד", "דנה", "האתר", "he",
            listOf(BrRead.Block('p', "פסקה ראשונה עם \"ציטוט\""), BrRead.Block('h', "תת כותרת"), BrRead.Block('l', "אחד"), BrRead.Block('l', "שתיים"), BrRead.Block('q', "ציטוט")))
        val b = BrOurs.epub(a, "", 0L)
        val files = LinkedHashMap<String, String>(); var first = ""; var stored = false
        ZipInputStream(b.inputStream()).use { z ->
            while (true) {
                val e = z.nextEntry ?: break
                if (first.isEmpty()) { first = e.name; stored = e.method == java.util.zip.ZipEntry.STORED }
                files[e.name] = z.readBytes().toString(Charsets.UTF_8)
            }
        }
        assertEquals("mimetype", first); assertTrue(stored)
        assertEquals("application/epub+zip", files["mimetype"])
        assertTrue(files.keys.containsAll(listOf("META-INF/container.xml", "OEBPS/content.opf", "OEBPS/nav.xhtml", "OEBPS/text.xhtml")))
        val t = files["OEBPS/text.xhtml"]!!
        assertTrue(t.contains("dir=\"rtl\"") && t.contains("&lt;מבחן&gt; &amp; עוד") && t.contains("<ul>\n<li>אחד</li>\n<li>שתיים</li>\n</ul>"))
        assertTrue(t.contains("href=\"https://site.co.il/a?x=1&amp;y=2\""))
        assertFalse(t.contains("<script"))
        val opf = files["OEBPS/content.opf"]!!
        assertTrue(opf.contains("<dc:language>he</dc:language>") && opf.contains("<dc:creator>דנה</dc:creator>") && opf.contains("properties=\"nav\""))
        assertEquals("a b.epub", BrOurs.epubName("a/b"))
        assertEquals("article.epub", BrOurs.epubName("  "))
    }

    @Test fun stockQueryFromSelection() {
        assertEquals(listOf("AAPL"), BrOurs.query("\$AAPL")!!.syms)
        assertEquals(listOf("AAPL"), BrOurs.query("(NASDAQ: AAPL)")!!.syms)
        assertEquals(listOf("BRK-B"), BrOurs.query("NYSE:BRK.B")!!.syms)
        assertEquals(listOf("POLI.TA"), BrOurs.query("TASE: POLI")!!.syms)
        assertEquals(listOf("TEVA.TA"), BrOurs.query("teva.ta")!!.syms)
        assertEquals(listOf("NVDA"), BrOurs.query("NVDA")!!.syms)
        val n = BrOurs.query("בנק הפועלים")!!
        assertTrue(n.syms.isEmpty()); assertEquals("בנק הפועלים", n.q)
        assertEquals("Apple Inc", BrOurs.query("Apple Inc")!!.q)
        assertNull(BrOurs.query(" "))
        assertNull(BrOurs.query("x".repeat(100)))
        assertEquals(3, BrOurs.query("\$A \$B \$C \$D")!!.syms.size)               // לכל היותר 3 — בקשה אחת
        assertFalse(BrOurs.symOk("A B")); assertTrue(BrOurs.symOk("^GSPC"))
    }

    @Test fun quotesAndSearchParse() {
        val meta = { cur: String, p: Double, prev: Double -> JSONObject().put("chart", JSONObject().put("result", JSONArray().put(JSONObject()
            .put("meta", JSONObject().put("currency", cur).put("regularMarketPrice", p).put("chartPreviousClose", prev).put("longName", "Name $cur"))))) }
        val body = JSONObject().put("ok", true).put("data", JSONObject()
            .put("AAPL", meta("USD", 110.0, 100.0).put("x", JSONObject().put("state", "POST").put("post", JSONObject().put("p", 111.0).put("pct", 0.9))))
            .put("POLI.TA", meta("ILA", 4000.0, 4100.0))).toString()
        val cs = BrOurs.quotesParse(body, mapOf("AAPL" to "Apple"))
        val a = cs.first { it.sym == "AAPL" }
        assertEquals("Apple", a.name); assertEquals(10.0, a.chg, 1e-9); assertEquals(10.0, a.pct, 1e-9); assertEquals(111.0, a.ext!!, 1e-9)
        val p = cs.first { it.sym == "POLI.TA" }
        assertEquals("ILS", p.cur); assertEquals(40.0, p.price, 1e-9); assertTrue(p.ta && p.chg < 0)
        assertEquals("₪40.00", BrOurs.money(p.price, p.cur)); assertEquals("$1,234.50", BrOurs.money(1234.5, "USD"))
        assertEquals("−2.44%", BrOurs.pctText(p.pct)); assertEquals("+10.00%", BrOurs.pctText(a.pct))
        assertTrue(BrOurs.quotesParse("{}", emptyMap()).isEmpty())
        val sr = BrOurs.searchParse(JSONObject().put("items", JSONArray().put(JSONObject().put("sym", "poli.ta").put("name", "Bank Hapoalim")).put(JSONObject().put("sym", "bad sym"))).toString())
        assertEquals(listOf("POLI.TA" to "Bank Hapoalim"), sr)
        assertEquals("""{"syms":["AAPL","POLI.TA"]}""", BrOurs.quotesBody(listOf("AAPL", "POLI.TA", "a b")))
        assertNotNull(JSONObject(BrOurs.searchBody("x")).optString("q"))
        assertEquals("https://invest.thesnowball.app/#chart=POLI.TA", BrOurs.chartUrl("POLI.TA"))
        assertEquals("https://invest.thesnowball.app/#watch=%5EGSPC&nm=S%26P%20500", BrOurs.watchUrl("^GSPC", "S&P 500"))
    }
}
