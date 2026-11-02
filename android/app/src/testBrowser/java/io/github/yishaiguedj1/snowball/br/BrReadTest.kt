package io.github.yishaiguedj1.snowball.br

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 01/11/2026: Studio Browser Pro — הגל הרביעי (BrRead): קריאה, צילום ומדיה */
class BrReadTest {
    private fun js(o: Any) = JSONObject.quote(o.toString())   // כמו שהתשובה של evaluateJavascript מגיעה (מחרוזת JSON בתוך מחרוזת)

    private fun art(title: String, vararg p: Pair<String, String>) = js(JSONObject().put("t", title).put("b", "כותב").put("s", "אתר").put("l", "he")
        .put("p", JSONArray().apply { p.forEach { put(JSONArray().put(it.first).put(it.second)) } }))

    private val long = "זו פסקה ארוכה מספיק כדי להיחשב חלק מכתבה אמיתית, עם כמה משפטים. ".repeat(6)

    @Test fun articleParseDropsDupTitleAndShortPages() {
        val a = BrRead.articleParse(art("הכותרת", "h" to "הכותרת", "p" to long, "p" to long, "x" to "לא סוג", "q" to "ציטוט", "l" to "פריט"), "https://ex.com/a")!!
        assertEquals("הכותרת", a.title)
        assertEquals(listOf('p', 'q', 'l'), a.blocks.map { it.k }.distinct())    // הכותרת הכפולה יורדת, סוג לא מוכר — לא; פסקה זהה ברצף — פעם אחת
        assertEquals(1, a.blocks.count { it.k == 'p' })
        assertTrue(a.minutes >= 1)
        assertNull(BrRead.articleParse(art("קצר", "p" to "מעט טקסט"), "https://ex.com"))
        assertNull(BrRead.articleParse("\"\"", "https://ex.com"))
        assertNull(BrRead.articleParse(null, "https://ex.com"))
        // הלוך־חזור לקובץ של רשימת הקריאה
        assertEquals(a, BrRead.articleOf(BrRead.articleJson(a)))
    }

    @Test fun htmlEscapesAndSetsDirection() {
        val a = BrRead.Article("https://ex.com/?a=1&b=2", "<script>alert(1)</script>", "", "ex", "", listOf(BrRead.Block('p', "שלום <b>עולם</b> & \"ציטוט\" וזה עוד טקסט ארוך בעברית")))
        val h = BrRead.html(a)
        assertFalse(h.contains("<script>")); assertFalse(h.contains("<b>"))
        assertTrue(h.contains("&lt;script&gt;")); assertTrue(h.contains("&amp; &quot;"))
        assertTrue(h.contains("dir=\"rtl\""))
        assertTrue(BrRead.html(a.copy(lang = "en", blocks = listOf(BrRead.Block('p', "hello")))).contains("dir=\"ltr\""))
    }

    @Test fun langAndChunks() {
        assertEquals("he", BrRead.langOf("שלום עולם hello"))
        assertEquals("en", BrRead.langOf("Hello world שלום"))
        assertEquals("ar", BrRead.langOf("مرحبا بالعالم"))
        assertEquals("ru", BrRead.langOf("Привет мир"))
        assertEquals("en", BrRead.langOf("1234"))
        val s = "משפט ראשון. ".repeat(500)
        val ch = BrRead.chunks(s, 300)
        assertTrue(ch.all { it.length <= 300 }); assertTrue(ch.all { it.endsWith(".") })
        assertEquals(s.trim().replace(Regex("\\s+"), " "), ch.joinToString(" "))
        assertEquals(listOf("קצר"), BrRead.chunks("  קצר  "))
        assertEquals(emptyList<String>(), BrRead.chunks("   "))
        // יחידות ההקראה: הכותרת (-1) ואז כל בלוק עם המספר שלו
        val a = BrRead.Article("u", "כותרת", "", "", "", listOf(BrRead.Block('p', "א"), BrRead.Block('p', "ב")))
        assertEquals(listOf(-1, 0, 1), BrRead.speakUnits(a).map { it.first })
    }

    @Test fun pageKeyStripsTracking() {
        assertEquals("https://ex.com/a?id=5", BrRead.pageKey("https://www.ex.com/a/?utm_source=x&id=5&fbclid=1#top"))
        assertEquals("https://ex.com/a", BrRead.pageKey("https://ex.com/a?utm_medium=y"))
        assertEquals(BrRead.pageKey("https://ex.com/a#x"), BrRead.pageKey("https://www.ex.com/a/"))
    }

    @Test fun readingListAddDedupAndCap() {
        val s1 = BrRead.Saved("1", "https://ex.com/a?utm_x=1", "א", "ex", 1, 3)
        var (l, out) = BrRead.savedAdd(emptyList(), s1)
        val s2 = BrRead.Saved("2", "https://ex.com/a", "א2", "ex", 2, 4)
        BrRead.savedAdd(l, s2).let { l = it.first; out = it.second }
        assertEquals(1, l.size); assertEquals("1", l[0].id); assertEquals("א2", l[0].title)   // אותו דף — מתעדכן, המזהה (והקובץ) נשמר
        val many = (0 until BrRead.SAVED_MAX).map { BrRead.Saved("i$it", "https://ex.com/$it", "", "", it.toLong(), 1) }
        val (l2, gone) = BrRead.savedAdd(many, BrRead.Saved("new", "https://ex.com/new", "", "", 9, 1))
        assertEquals(BrRead.SAVED_MAX, l2.size); assertEquals("new", l2[0].id); assertEquals(listOf("i${BrRead.SAVED_MAX - 1}"), gone.map { it.id })
        assertEquals(l2, BrRead.savedDecode(BrRead.savedEncode(l2)))
        assertEquals(emptyList<BrRead.Saved>(), BrRead.savedDecode("not json"))
        assertEquals(emptyList<BrRead.Saved>(), BrRead.savedDecode("""[{"i":"x","u":"javascript:alert(1)"}]"""))
    }

    @Test fun marksRoundTripAndPages() {
        val m = listOf(
            BrRead.Mark("a", "https://ex.com/p?utm_a=1", "דף", "קטע מודגש", "", 1, 10),
            BrRead.Mark("b", "https://ex.com/p", "דף", "", "הערה לדף", 0, 20),
            BrRead.Mark("c", "https://other.com/", "אחר", "x", "y", 9, 5))
        val back = BrRead.marksDecode(BrRead.marksEncode(m))
        assertEquals(3, back.size); assertEquals(BrRead.COLORS.size - 1, back[2].color)   // צבע מחוץ לטווח — נחתך
        assertEquals(listOf("a", "b"), BrRead.forPage(back, "https://www.ex.com/p#x").map { it.id })
        assertEquals(listOf(2, 1), BrRead.pages(back).map { it.second })
        assertEquals(emptyList<BrRead.Mark>(), BrRead.marksDecode("""[{"i":"z","u":"https://e.com","t":"","n":""}]"""))   // ריקה — לא נשמרת
    }

    @Test fun markScriptsQuoteSafely() {
        val j = BrRead.applyJs(listOf(BrRead.Mark("id1", "u", "", "טקסט עם 'גרש' ו\"מרכאות\" </script>", "", 0, 0)))
        assertFalse(j.contains("</script>\""))
        assertTrue(j.contains("#FFE066"))
        assertTrue(BrRead.markSelJs("x", 99).contains("#FFA8C8"))       // צבע מחוץ לטווח — האחרון
        assertTrue(BrRead.unmarkJs("a'b").contains("\\\"a'b\\\""))
        assertEquals("(function(L){", BrRead.applyJs(emptyList()).take(13))
    }

    @Test fun searchAllTokensScoreAndAlive() {
        var l = emptyList<BrRead.Doc>()
        l = BrRead.indexAdd(l, BrRead.Doc("https://a.com/1", "מתכון לעוגת שוקולד", "עוגת שוקולד עשירה. מערבבים קמח, סוכר וקקאו, ואופים חצי שעה בתנור חם מאוד.", 1))
        l = BrRead.indexAdd(l, BrRead.Doc("https://b.com/2", "חדשות", "היום דיברו על שוקולד בכנסת, וגם על מזג האוויר ועל התחבורה הציבורית.", 2))
        l = BrRead.indexAdd(l, BrRead.Doc("https://c.com/3", "קצר", "מעט", 3))                       // קצר מדי — לא נכנס
        assertEquals(2, l.size)
        val h = BrRead.search(l, "שוקולד")
        assertEquals(listOf("https://a.com/1", "https://b.com/2"), h.map { it.doc.url })            // בכותרת — ראשון
        assertEquals(listOf("https://a.com/1"), BrRead.search(l, "שוקולד תנור").map { it.doc.url })   // כל המילים
        assertEquals(emptyList<BrRead.Hit>(), BrRead.search(l, "שוקולד", alive = setOf("https://b.com/3")))  // נמחק מההיסטוריה
        assertEquals(listOf("https://b.com/2"), BrRead.search(l, "שוקולד", alive = setOf(BrRead.pageKey("https://b.com/2"))).map { it.doc.url })
        assertEquals(emptyList<BrRead.Hit>(), BrRead.search(l, "a"))
        // ניקוד לא מפריע, ואותו דף מתחלף
        assertEquals(1, BrRead.search(listOf(BrRead.Doc("https://n.com", "", "שָׁלוֹם לכולם, זה טקסט ארוך מספיק בשביל האינדקס של הדפדפן.", 1)), "שלום").size)
        assertEquals(2, BrRead.indexAdd(l, l[0].copy(title = "חדש")).size)
        assertEquals(l, BrRead.docsDecode(BrRead.docsEncode(l)))
    }

    @Test fun snippetAroundMatch() {
        val t = "מילים ".repeat(60) + "המילה החשובה כאן " + "עוד ".repeat(60)
        val s = BrRead.snippet(t, listOf("החשובה"), 80)
        assertTrue(s.contains("החשובה")); assertTrue(s.startsWith("…")); assertTrue(s.endsWith("…")); assertTrue(s.length <= 84)
        assertEquals("קצר", BrRead.snippet("קצר", listOf("x")))
    }

    @Test fun topicsGroupByWordThenHost() {
        val v = mutableListOf<BrVisit>()
        listOf("הבחירות בארה\"ב: הסקר", "תוצאות הבחירות", "בחירות 2026 ניתוח", "בחירות — מה הלאה").forEachIndexed { i, s -> v += BrVisit("https://n$i.com/x", s, 100L + i) }
        listOf("Kotlin coroutines", "Compose state", "Gradle tips").forEachIndexed { i, s -> v += BrVisit("https://dev.example.com/$i", s, 50L + i) }
        v += BrVisit("https://solo.com", "משהו אחר לגמרי", 1)
        v += BrVisit("https://n0.com/x", "הבחירות בארה\"ב: הסקר", 200)   // אותו דף שוב — נספר פעם אחת
        val t = BrRead.topics(v)
        assertEquals("בחירות", t[0].name); assertEquals(4, t[0].visits.size)
        assertEquals("dev.example.com", t[1].name); assertEquals(3, t[1].visits.size)
        assertEquals("", t.last().name); assertEquals(1, t.last().visits.size)
        assertEquals(listOf("kotlin", "coroutines"), BrRead.words("The Kotlin coroutines 2026"))
        assertEquals(emptyList<BrRead.Topic>(), BrRead.topics(emptyList()))
    }

    @Test fun filesByExtension() {
        val raw = js(JSONArray()
            .put(JSONArray().put("https://ex.com/docs/report%20Q3.pdf?x=1").put("הדוח").put(0))
            .put(JSONArray().put("https://ex.com/docs/report%20Q3.pdf?x=1#p2").put("שוב").put(0))   // אותו קובץ
            .put(JSONArray().put("https://ex.com/song.mp3").put("song.mp3").put(0))
            .put(JSONArray().put("https://ex.com/page.html").put("דף").put(0))                   // לא קובץ
            .put(JSONArray().put("https://ex.com/get?id=7").put("data.zip").put(1))               // download עם שם
            .put(JSONArray().put("javascript:void(0).pdf").put("x").put(0))
            .put(JSONArray().put("https://ex.com/a/b:c.png").put("").put(0)))
        val f = BrRead.files(raw)
        assertEquals(listOf("report Q3.pdf", "song.mp3", "data.zip", "b_c.png"), f.map { it.name })
        assertEquals(listOf('d', 'a', 'z', 'i'), f.map { it.cat })
        assertEquals("pdf", BrRead.extOf("https://e.com/x.PDF?a"))
        assertEquals("", BrRead.extOf("https://e.com/x"))
        assertEquals(emptyList<BrRead.FileLink>(), BrRead.files("garbage"))
        assertEquals("ex.com", BrRead.host("https://user@www.ex.com:8080/a?b"))
    }

    @Test fun shotsPlanCoversPage() {
        assertEquals(listOf(BrRead.Shot(0, 0, 800)), BrRead.shots(500, 800))                         // קצר ממסך
        val p = BrRead.shots(2000, 800)
        assertEquals(2000, p.sumOf { it.h })
        assertEquals(BrRead.Shot(1200, 400, 400), p.last())                                         // הסוף: גוללים עד הסוף, החלק התחתון
        val cap = BrRead.shots(100_000, 800, 3)
        assertEquals(2400, cap.sumOf { it.h }); assertTrue(cap.all { it.top == 0 })
        assertEquals(emptyList<BrRead.Shot>(), BrRead.shots(100, 0))
    }

    @Test fun frameAndMediaParse() {
        assertNull(BrRead.frameParse("\"\""))
        val f = BrRead.frameParse(js(JSONObject().put("x", 10).put("y", 20).put("w", 300).put("h", 200).put("r", 2.5).put("t", 3.2).put("d", "")))!!
        assertEquals(2.5f, f.dpr); assertNull(f.png)
        val m = BrRead.mediaParse(js("""{"n":2,"p":true,"m":false}"""))
        assertEquals(BrRead.MediaState(2, true, false), m)
        assertEquals(0, BrRead.mediaParse(null).n)
        assertTrue(BrRead.mediaJs("pause").endsWith("(\"pause\")"))
        assertTrue(BrRead.clipJs(10).endsWith("(10)"))
    }

    @Test fun fileNameSafe() {
        val n = BrRead.fileName("a/b:c*?\"<>| d\n", "png", 0)
        assertFalse(n.any { it in "/:*?\"<>|\n" }); assertTrue(n.endsWith(".png")); assertTrue(n.startsWith("a b c"))
        assertTrue(BrRead.fileName("", "pdf", 0).startsWith("Studio Browser"))
    }

    @Test fun qrRoundTrip() {
        val text = "https://ex.com/מאמר?id=5"
        val m = com.google.zxing.qrcode.QRCodeWriter().encode(text, com.google.zxing.BarcodeFormat.QR_CODE, 300, 300,
            mapOf(com.google.zxing.EncodeHintType.CHARACTER_SET to "UTF-8", com.google.zxing.EncodeHintType.MARGIN to 2))
        val px = IntArray(m.width * m.height) { i -> if (m.get(i % m.width, i / m.width)) 0xFF000000.toInt() else -1 }
        assertEquals(text, BrCapture.decode(px, m.width, m.height))
        assertNull(BrCapture.decode(IntArray(100 * 100) { -1 }, 100, 100))
    }

    @Test fun isolateQuotesSelector() {
        val j = BrRead.isolateJs("div[data-x=\"a'b\"] > p")
        assertTrue(j.endsWith("(\"div[data-x=\\\"a'b\\\"] > p\")"))
        assertNotNull(BrRead.READER_JS.takeIf { it.startsWith("(function(){") })
    }
}
