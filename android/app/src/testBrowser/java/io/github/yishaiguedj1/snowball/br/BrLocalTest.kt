package io.github.yishaiguedj1.snowball.br

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 01/11/2026: Studio Browser Pro — הגל החמישי (BrLocal): בתוך הטלפון, בלי ענן */
class BrLocalTest {
    private fun js(o: Any) = JSONObject.quote(o.toString())   // כמו שהתשובה של evaluateJavascript מגיעה

    @Test fun normMapsPageAndSystemCodes() {
        assertEquals("en", BrLocal.norm("en-US"))
        assertEquals("he", BrLocal.norm("iw"))
        assertEquals("he", BrLocal.norm("he_IL"))
        assertEquals("id", BrLocal.norm("in"))
        assertEquals("no", BrLocal.norm("nb-NO"))
        assertEquals("zh", BrLocal.norm("zh-Hant-TW"))
        assertEquals("", BrLocal.norm("xx"))
        assertEquals("", BrLocal.norm(null))
        assertEquals("he", BrLocal.target("iw"))
        assertEquals("he", BrLocal.target("xx"))   // שפה שאין לה מודל — עברית
        assertTrue(BrLocal.rtl("he") && BrLocal.rtl("ar") && !BrLocal.rtl("en"))
    }

    @Test fun detectByPageLangThenScriptThenWords() {
        assertEquals("fr", BrLocal.detect("fr", "שלום עולם"))   // התווית של הדף קודמת
        assertEquals("he", BrLocal.detect("", "שלום עולם, זו כתבה בעברית"))
        assertEquals("ar", BrLocal.guess("مرحبا بالعالم هذه مقالة"))
        assertEquals("fa", BrLocal.guess("این یک مقاله پارسی است که چگونه"))
        assertEquals("ru", BrLocal.guess("Привет мир, это статья"))
        assertEquals("uk", BrLocal.guess("Привіт світ, це стаття про їжу"))
        assertEquals("ja", BrLocal.guess("これは日本語の記事です"))
        assertEquals("ko", BrLocal.guess("이것은 한국어 기사입니다"))
        assertEquals("zh", BrLocal.guess("这是一篇中文文章"))
        assertEquals("el", BrLocal.guess("Αυτό είναι ένα άρθρο"))
        assertEquals("en", BrLocal.guess("This is the article and it is for you"))
        assertEquals("fr", BrLocal.guess("Le chat est dans la maison et les enfants sont pour le jardin"))
        assertEquals("es", BrLocal.guess("El perro y los gatos están en la casa para una fiesta con el"))
        assertEquals("de", BrLocal.guess("Der Hund und die Katze ist nicht mit dem Kind auf der Straße"))
        assertEquals("en", BrLocal.guess("12345 !!!"))
    }

    @Test fun planDedupesAndSkipsNoLetters() {
        val texts = listOf("Home", "Hello world", "Home", "2024", "  ", "Hello world")
        val p = BrLocal.plan(texts)
        assertEquals(listOf("Home", "Hello world"), p.uniq)
        assertEquals(listOf(0, 1, 0, -1, -1, 1), p.of.toList())
        val out = BrLocal.spread(texts, p, listOf("בית", null))
        assertEquals(listOf("בית", "Hello world", "בית", "2024", "  ", "Hello world"), out)   // מה שלא תורגם — המקור
        // בהדרגה: רק מה שתורגם בחבילה הזו, במקום הנכון (base = האינדקס הראשון בדף)
        val fr = BrLocal.fresh(p, 10, 0, 1, listOf("בית", null))
        assertEquals(listOf(10 to "בית", 12 to "בית"), fr)
        assertTrue(BrLocal.fresh(p, 0, 1, 2, listOf("בית", null)).isEmpty())
    }

    @Test fun collectedParsesAndScriptsAreSafe() {
        val c = BrLocal.collected(js(JSONObject().put("l", "en").put("t", JSONArray().put("a").put("b")).put("b", 3)))!!
        assertEquals("en", c.lang); assertEquals(listOf("a", "b"), c.texts); assertEquals(3, c.base); assertFalse(c.busy)
        assertTrue(BrLocal.collected(js(JSONObject().put("busy", 1).put("t", JSONArray())))!!.busy)
        assertNull(BrLocal.collected(null))
        assertNull(BrLocal.collected("\"not json\""))
        // תרגום עם מירכאות ותגיות — נכנס כ־JSON (כטקסט, לא כקוד)
        val a = BrLocal.applyJs(listOf(0 to "</script><b>\"x\"'"), true)
        assertTrue(a.contains(JSONArray().put(JSONArray().put(0).put("</script><b>\"x\"'")).toString()))
        assertTrue(a.contains("nodeValue=") && !a.contains("innerHTML"))
        assertTrue(BrLocal.collectJs(true).contains("var S=true") && BrLocal.collectJs(false).contains("var S=false"))
        assertTrue(BrLocal.RESTORE_JS.contains("delete window.__snbTr"))
    }

    @Test fun captionsKeepLastLines() {
        var c = BrLocal.Cap()
        c = BrLocal.capPartial(c, "hello   wor")
        assertEquals("hello wor", c.partial)
        c = BrLocal.capFinal(c, "first line")
        assertEquals(listOf("first line"), c.lines); assertEquals("", c.partial)
        c = BrLocal.capFinal(c, "second"); c = BrLocal.capFinal(c, "third")
        assertEquals(listOf("second", "third"), c.lines)   // עד 2 שורות
        val long = BrLocal.capFinal(BrLocal.Cap(), "מילה ".repeat(40), max = 5, lineMax = 30)
        assertTrue(long.lines.all { it.length <= 30 } && long.lines.size > 1)
        assertEquals("en-US", BrLocal.speechTag("en")); assertEquals("he-IL", BrLocal.speechTag("he"))
        assertTrue(BrLocal.hasSpeech(listOf("en-US", "he-IL"), "he"))
        assertFalse(BrLocal.hasSpeech(listOf("en-US"), "he"))
        assertEquals(true to "en", BrLocal.audioRes(js("ok:en")))
        assertEquals(false to "none", BrLocal.audioRes(js("none")))
        assertEquals(true to "on", BrLocal.audioRes(js("on")))
        assertTrue(BrLocal.audioJs("snbTool").contains("window.snbTool.postMessage('a:'"))
    }

    @Test fun summaryInputAndBullets() {
        val a = BrRead.Article("https://ex.com", "Title", "", "ex", "en", List(50) { BrRead.Block('p', "Paragraph number $it with text. ".repeat(10)) })
        val s = BrLocal.sumInput(a, 2000)
        assertTrue(s.startsWith("Title\n") && s.length <= 2000)
        assertEquals(listOf("One", "Two", "Three"), BrLocal.bullets("* One\n- Two\n\n• Three"))
        assertTrue("en" in BrLocal.SUM_LANGS && "he" !in BrLocal.SUM_LANGS)
    }

    @Test fun aiShimRequestsAndReplies() {
        val r = BrLocal.aiReq(JSONObject().put("id", 7).put("op", "s").put("a", JSONObject().put("t", "x".repeat(9000))).toString())!!
        assertEquals(7, r.id); assertEquals("s", r.op); assertEquals(8000, BrLocal.aiText(r).length)
        assertNull(BrLocal.aiReq(JSONObject().put("id", 1).put("op", "eval").toString()))   // פעולה לא מוכרת
        assertNull(BrLocal.aiReq(JSONObject().put("op", "s").toString()))                   // בלי מזהה
        assertNull(BrLocal.aiReq("garbage"))
        assertEquals("window.__snbAi&&__snbAi.r(3,true,\"a\\\"b\")", BrLocal.aiReply(3, true, "a\"b"))
        assertTrue(BrLocal.aiReply(4, true, BrLocal.detectRes("שלום לכולם")).contains("\"detectedLanguage\":\"he\""))
        assertEquals("available", BrLocal.avail(3)); assertEquals("downloadable", BrLocal.avail(1)); assertEquals("unavailable", BrLocal.avail(0))
        val sh = BrLocal.shimJs("snbTool")
        assertNotNull(sh)
        assertTrue(sh.contains("mk('Summarizer'") && sh.contains("mk('Translator'") && sh.contains("mk('LanguageDetector'"))
        assertTrue(sh.contains("window.snbTool"))
    }
}
