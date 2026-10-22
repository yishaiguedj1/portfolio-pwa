package io.github.yishaiguedj1.snowball

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 22/10/2026: DlProbe (הבדיקה בטלפון) = translator/fetchurl.py (הבדיקה שהייתה בשרת). הקבצים ב־resources/dlprobe נוצרו
 * מהפייתון עצמו (summarize על info לדוגמה) — שינוי באחד מהם בלי השני = הבדיקה נכשלת.
 */
class DlProbeTest {
    private fun res(n: String) = JSONObject(javaClass.classLoader!!.getResource("dlprobe/$n")!!.readText())

    @Test fun summarizeMatchesPython() {
        for (name in listOf("yt", "direct", "playlist", "live", "none")) {
            val info = res("$name.info.json")
            val exp = res("$name.expect.json")
            if (exp.has("err")) {
                val e = try { DlProbe.summarize(info); null } catch (x: IllegalArgumentException) { x.message }
                assertEquals(name, exp.getString("err"), e)
            } else {
                val got = DlProbe.summarize(info)
                val want = exp.getJSONObject("ok")
                for (k in want.keys()) assertTrue("$name.$k: ${got.opt(k)} != ${want.opt(k)}", same(want.opt(k), got.opt(k)))
                assertEquals(name + " keys", ks(want), ks(got))
                assertEquals(name + " thumb", exp.getString("th"), DlProbe.thumbUrl(info))
            }
        }
    }

    private fun ks(o: JSONObject): Set<String> = o.keys().asSequence().toSet()

    /** השוואה לפי ערך (גם 1 מול 1L) */
    private fun same(a: Any?, b: Any?): Boolean {
        if (a is Number && b is Number) return a.toDouble() == b.toDouble()
        if (a is JSONObject && b is JSONObject) return ks(a) == ks(b) && ks(a).all { k -> same(a.opt(k), b.opt(k)) }
        if (a is org.json.JSONArray && b is org.json.JSONArray) return a.length() == b.length() && (0 until a.length()).all { same(a.opt(it), b.opt(it)) }
        return a == b
    }

    @Test fun selectorErrUrlRef() {
        val m = res("misc.json")
        val sel = m.getJSONObject("sel")
        assertEquals(sel.getString("a"), DlProbe.selector("399", "251", 1080))
        assertEquals(sel.getString("b"), DlProbe.selector("x y", "", 50))
        assertEquals(sel.getString("c"), DlProbe.selector("", "", null))
        val errs = m.getJSONObject("errs")
        for (k in errs.keys()) assertEquals(k, errs.getString(k), DlProbe.errCode(k))
        assertEquals(m.getString("ex"), DlProbe.extractUrl("watch this https://youtu.be/abc). ok"))
        val ref = m.getJSONArray("ref")
        assertEquals(ref.getString(0), DlProbe.refOk("https://a.com/x y"))
        assertEquals(ref.getString(1), DlProbe.refOk(" https://a.com/p "))
    }

    @Test fun pyRoundIsBankers() {
        assertEquals(2, DlProbe.pyRound(2.5)); assertEquals(4, DlProbe.pyRound(3.5)); assertEquals(30, DlProbe.pyRound(29.97))
    }
}
