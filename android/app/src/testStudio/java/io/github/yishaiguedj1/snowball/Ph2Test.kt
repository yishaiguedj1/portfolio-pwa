package io.github.yishaiguedj1.snowball

import io.github.yishaiguedj1.snowball.ph2.AWord
import io.github.yishaiguedj1.snowball.ph2.AsrWords
import io.github.yishaiguedj1.snowball.ph2.Diarize
import io.github.yishaiguedj1.snowball.ph2.NemoMel
import io.github.yishaiguedj1.snowball.ph2.PwJson
import io.github.yishaiguedj1.snowball.ph2.QAlign
import io.github.yishaiguedj1.snowball.ph2.QTok
import io.github.yishaiguedj1.snowball.ph2.SileroVad
import io.github.yishaiguedj1.snowball.ph2.WhisperMel
import io.github.yishaiguedj1.snowball.ph2.Word
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * 25/10/2026 — תרגום בטלפון, שלב 2: כל השלבים של התמלול, זיהוי הדוברים והיישור מול הקוד של השרת עצמו
 * (resources/ph2/fixtures.json — tools/ph2-fixtures.py מריץ את vt/onnx_asr/qwen_asr על קלט סינתטי).
 * המודלים עצמם (ONNX) לא כאן — נבדקו מול השרת על הרצאה אמיתית (היומן, 25/10/2026). שינוי בצד של השרת = להריץ את המחולל שוב.
 */
class Ph2Test {
    private val fx = JSONObject(javaClass.getResource("/ph2/fixtures.json")!!.readText())
    private fun asset(n: String) = File("src/studio/assets/ph2/$n").readBytes()
    private fun pcm(a: JSONArray) = FloatArray(a.length()) { a.getInt(it) / 32768f }
    private fun dl(a: JSONArray) = List(a.length()) { a.getDouble(it) }
    private fun sl(a: JSONArray) = List(a.length()) { a.getString(it) }
    private fun pairs(a: JSONArray) = List(a.length()) { a.getJSONArray(it).let { x -> x.getInt(0) to x.getInt(1) } }
    private fun aw(a: JSONArray) = List(a.length()) { a.getJSONObject(it).let { o -> AWord(o.getString("w"), o.getDouble("s"), o.getDouble("e")) } }
    private fun same(want: JSONArray, got: List<AWord>) {
        assertEquals(want.length(), got.size)
        for (i in got.indices) { val o = want.getJSONObject(i)
            assertEquals(o.getString("w"), got[i].w); assertEquals(o.getDouble("s"), got[i].s, 0.0); assertEquals(o.getDouble("e"), got[i].e, 0.0) }
    }

    @Test fun nemoFeaturesMatchOnnxAsrNumpy() {
        val o = fx.getJSONObject("nemo")
        val (f, n) = NemoMel(NemoMel.filters(asset("nemo_mel_128.bin"))).features(pcm(o.getJSONArray("x")))
        assertEquals(o.getInt("n"), n)
        val w = o.getJSONArray("f"); val t = f.size / 128
        assertEquals(w.getJSONArray(0).length(), t)
        for (m in 0 until 128) for (j in 0 until t) assertEquals("ערוץ $m פריים $j", w.getJSONArray(m).getDouble(j), f[m * t + j].toDouble(), 2e-4)
    }

    @Test fun whisperMelMatchesTheProcessor() {
        val o = fx.getJSONObject("whisper")
        val x = pcm(o.getJSONArray("x")); val g = o.getDouble("gain").toFloat()
        val (m, t) = WhisperMel(WhisperMel.filters(asset("whisper_mel_128.bin"))).mel(FloatArray(x.size) { x[it] * g })
        assertEquals(o.getInt("t"), t)
        val w = o.getJSONArray("m")
        for (c in 0 until 128) for (j in 0 until t) assertEquals(w.getJSONArray(c).getDouble(j), m[c * t + j].toDouble(), 2e-5)
    }

    @Test fun kaldiFbankMatchesDiarize() {
        val o = fx.getJSONObject("fbank")
        val (f, n) = Diarize.fbank(pcm(o.getJSONArray("x")))
        val w = o.getJSONArray("f")
        assertEquals(w.length(), n)
        for (t in 0 until n) for (m in 0 until 80) assertEquals(w.getJSONArray(t).getDouble(m), f[t * 80 + m].toDouble(), 1e-4)
    }

    @Test fun vadSegmentsLikeOnnxAsr() {
        val o = fx.getJSONObject("vad")
        val p = o.getJSONArray("p").let { a -> FloatArray(a.length()) { a.getDouble(it).toFloat() } }
        assertEquals(pairs(o.getJSONArray("segs")), SileroVad.segments(p, o.getInt("n")))
        assertEquals(pairs(o.getJSONArray("segs2")), SileroVad.segments(p, o.getInt("n"), maxSpeechS = 2.0, padMs = 30.0))
    }

    /** 25/10/2026: הספים של התמלול החוזר זהים לשרת — מרווחים משני הצדדים של HOLE_S ושל QUIET_S */
    @Test fun holeThresholdsLikeTheServer() {
        val r = fx.getJSONObject("holes2")
        val segs = r.getJSONArray("segs").let { a -> List(a.length()) { a.getJSONArray(it).let { x -> x.getDouble(0) to x.getDouble(1) } } }
        val holes = AsrWords.holes(aw(r.getJSONArray("words")), segs, r.getDouble("total"))
        val wh = r.getJSONArray("holes")
        assertEquals(wh.length(), holes.size)
        assertEquals("דיבור של 1.0 ושקט של 2.0 — חורים; 0.8 ו־1.7 לא", 2, holes.size)
        for (i in holes.indices) { val h = wh.getJSONArray(i)
            assertEquals(h.getInt(0), holes[i].i); assertEquals(h.getDouble(1), holes[i].a, 0.0); assertEquals(h.getDouble(2), holes[i].b, 0.0) }
    }

    /** 25/10/2026: חלון בלי פיסוק ותמלול חוזר בחלונות קצרים — כמו flat/unflatten של השרת */
    @Test fun flatWindowsLikeTheServer() {
        val f = fx.getJSONObject("flat")
        val cases = f.getJSONArray("cases"); val want = f.getJSONArray("flat"); val sh = f.getJSONArray("shape")
        for (i in 0 until cases.length()) {
            val ws = aw(cases.getJSONArray(i))
            assertEquals("מקרה $i", want.getBoolean(i), AsrWords.flat(ws))
            val (p, c) = AsrWords.shape(ws)
            assertEquals(sh.getJSONArray(i).getDouble(0), p, 0.0); assertEquals(sh.getJSONArray(i).getDouble(1), c, 0.0)
        }
        val u = fx.getJSONObject("unflat")
        val parts: MutableList<List<AWord>> = MutableList(u.getJSONArray("parts").length()) { aw(u.getJSONArray("parts").getJSONArray(it)) }
        val calls = u.getJSONArray("calls"); var k = 0
        val done = AsrWords.unflatten(parts, pairs(u.getJSONArray("chunks")), pairs(u.getJSONArray("segs")), u.getInt("n"), 16000) { a, b ->
            val cl = calls.getJSONObject(k++)
            assertEquals(cl.getInt("a"), a); assertEquals(cl.getInt("b"), b)
            aw(cl.getJSONArray("w"))
        }
        assertEquals(calls.length(), k)
        assertEquals(u.getInt("done"), done)
        assertTrue("יש חלון שהוחלף", done > 0)
        val out = u.getJSONArray("out")
        for (i in parts.indices) same(out.getJSONArray(i), parts[i])
    }

    @Test fun chunksWordsHolesAndRescueLikeTheServer() {
        val c = fx.getJSONObject("chunks")
        assertEquals(pairs(c.getJSONArray("out")), AsrWords.chunks(pairs(c.getJSONArray("segs")), c.getInt("n"), pad = (0.12 * 16000).toInt()))
        val ws = fx.getJSONArray("words")
        for (i in 0 until ws.length()) { val o = ws.getJSONObject(i)
            same(o.getJSONArray("w"), AsrWords.tokensToWords(sl(o.getJSONArray("t")), dl(o.getJSONArray("ts")), o.getDouble("o"), o.getDouble("e"))) }
        val r = fx.getJSONObject("rescue")
        val words = aw(r.getJSONArray("words")).toMutableList()
        val segs = r.getJSONArray("segs").let { a -> List(a.length()) { a.getJSONArray(it).let { x -> x.getDouble(0) to x.getDouble(1) } } }
        val holes = AsrWords.holes(words, segs, r.getDouble("total"))
        val wh = r.getJSONArray("holes")
        assertEquals(wh.length(), holes.size)
        for (i in holes.indices) { val h = wh.getJSONArray(i)
            assertEquals(h.getInt(0), holes[i].i); assertEquals(h.getDouble(1), holes[i].a, 0.0); assertEquals(h.getDouble(2), holes[i].b, 0.0) }
        val calls = r.getJSONArray("calls"); var k = 0
        val n = AsrWords.rescue(words, holes, r.getDouble("total")) { a, b ->
            val cl = calls.getJSONObject(k++)
            assertEquals(cl.getDouble("a"), a, 0.0); assertEquals(cl.getDouble("b"), b, 0.0)
            AsrWords.tokensToWords(sl(cl.getJSONArray("t")), dl(cl.getJSONArray("ts")), a, b)
        }
        assertEquals(calls.length(), k)
        assertEquals(r.getInt("n"), n)
        assertTrue("יש מה להציל בבדיקה", n > 0)
        same(r.getJSONArray("out"), words)
    }

    private fun tok(): QTok {
        val t = fx.getJSONObject("tok")
        val add = t.getJSONObject("added").let { a -> a.keys().asSequence().associateWith { a.getInt(it) } }
        return QTok(t.getJSONObject("vocab").toString(), t.getString("merges"), add)
    }

    @Test fun qwenTokenizerLikeTransformers() {
        val q = tok(); val cs = fx.getJSONObject("tok").getJSONArray("cases")
        for (i in 0 until cs.length()) { val o = cs.getJSONObject(i)
            val want = o.getJSONArray("ids").let { a -> IntArray(a.length()) { a.getInt(it) } }
            assertEquals("\"${o.getString("s")}\"", want.toList(), q.encode(o.getString("s")).toList()) }
    }

    @Test fun wordListAiTextAndIdsLikeQwenAsr() {
        val t = fx.getJSONObject("tok"); val q = tok()
        val wl = t.getJSONArray("wl")
        for (i in 0 until wl.length()) { val o = wl.getJSONObject(i)
            val w = QAlign.wordList(o.getString("s"))
            assertEquals(sl(o.getJSONArray("wl")), w); assertEquals(o.getString("ai"), QAlign.aiText(w)) }
        val cl = t.getJSONArray("clean")
        for (i in 0 until cl.length()) assertEquals(cl.getJSONArray(i).getString(1), QAlign.cleanToken(cl.getJSONArray(i).getString(0)))
        val ids = t.getJSONArray("ids")
        for (i in 0 until ids.length()) { val o = ids.getJSONObject(i)
            assertEquals(o.getJSONArray("ids").let { a -> List(a.length()) { a.getInt(it) } }, QAlign.ids(q, sl(o.getJSONArray("words")), o.getInt("mel")).toList()) }
    }

    @Test fun fixTimestampLikeQwenAsr() {
        val f = fx.getJSONArray("fix")
        for (i in 0 until f.length()) { val o = f.getJSONObject(i)
            val d = o.getJSONArray("d").let { a -> DoubleArray(a.length()) { a.getDouble(it) } }
            assertEquals(o.getJSONArray("out").let { a -> List(a.length()) { a.getInt(it) } }, QAlign.fixTimestamp(d).toList()) }
    }

    @Test fun alignWordsLikeTheServer() {
        val a = fx.getJSONObject("align")
        val ww = a.getJSONArray("words")
        val words = List(ww.length()) { ww.getJSONObject(it).let { o -> Word(o.getString("w"), o.getDouble("s"), o.getDouble("e")) } }
        val plan = QAlign.planChunks(words, audioLen = a.getDouble("total"))
        val wp = a.getJSONArray("plan")
        assertEquals(wp.length(), plan.size)
        for (i in plan.indices) { val p = wp.getJSONArray(i)
            assertEquals(QAlign.Chunk(p.getInt(0), p.getInt(1), p.getDouble(2), p.getDouble(3)), plan[i]) }
        val st = QAlign.Stats(); val items = a.getJSONArray("items")
        for ((ci, c) in plan.withIndex()) {
            val it = items.getJSONArray(ci)
            val its = List(it.length()) { k -> it.getJSONArray(k).let { x -> Triple(x.getString(0), x.getDouble(1), x.getDouble(2)) } }
            QAlign.apply(words, c, QAlign.mapItems(words.subList(c.i0, c.i1), its), st)
        }
        QAlign.repairOrder(words)
        val s = a.getJSONObject("stats")
        assertEquals(s.getInt("aligned"), st.aligned); assertEquals(s.getInt("kept_approx"), st.approx); assertEquals(s.getInt("suspicious"), st.suspicious)
        assertTrue(st.aligned > 0 && st.approx > 0 && st.suspicious > 0)
        val out = a.getJSONArray("out")
        for (i in words.indices) { val o = out.getJSONObject(i); val w = words[i]
            assertEquals("מילה $i", o.getDouble("s"), w.s, 0.0); assertEquals("מילה $i", o.getDouble("e"), w.e, 0.0)
            assertEquals(o.getString("align"), w.align)
            if (!o.isNull("s_asr")) { assertEquals(o.getDouble("s_asr"), w.sAsr!!, 0.0); assertEquals(o.getDouble("e_asr"), w.eAsr!!, 0.0) } }
    }

    @Test fun diarizeLikeTheServer() {
        val d = fx.getJSONObject("diar")
        val dw = d.getJSONArray("words")
        fun fresh() = List(dw.length()) { dw.getJSONObject(it).let { o -> Word(o.getString("w"), o.getDouble("s"), o.getDouble("e")) } }
        val us = Diarize.units(fresh()); val wu = d.getJSONArray("units")
        assertEquals(wu.length(), us.size)
        for (i in us.indices) { val u = wu.getJSONArray(i); assertEquals(listOf(u.getInt(0), u.getInt(1), u.getInt(2)), listOf(us[i].a, us[i].b, us[i].r)) }
        fun mat(a: JSONArray) = Array(a.length()) { i -> a.getJSONArray(i).let { r -> FloatArray(r.length()) { r.getDouble(it).toFloat() } } }
        val c = d.getJSONObject("cluster")
        assertEquals(c.getJSONArray("lab").let { a -> List(a.length()) { a.getInt(it) } }, Diarize.cluster(mat(c.getJSONArray("E"))).toList())
        assertEquals(c.getJSONArray("lab5").let { a -> List(a.length()) { a.getInt(it) } }, Diarize.cluster(mat(c.getJSONArray("E")), 0.5).toList())
        val E = mat(d.getJSONArray("E"))
        val words = fresh()
        val st = Diarize.assign(words, FloatArray(((words.last().e + 1) * 16000).toInt())) { E }
        val ws = d.getJSONArray("spk")
        assertEquals(List(ws.length()) { if (ws.isNull(it)) null else ws.getString(it) }, words.map { it.spk })
        val s = d.getJSONObject("stats")
        assertEquals(s.getInt("speakers"), st.speakers); assertEquals(s.getInt("units"), st.units)
        val t = s.getJSONObject("talk")
        assertEquals(t.keys().asSequence().associateWith { t.getDouble(it) }, st.talk)
        assertTrue(st.speakers >= 2)
    }

    @Test fun wordsFileIsWhatTheWorkerAccepts() {
        val p = fx.getJSONObject("pw")            // המחולל בודק שהעובד (pw_check) מקבל אותו
        val ws = p.getJSONArray("words")
        val words = List(ws.length()) { ws.getJSONObject(it).let { o -> Word(o.getString("w"), o.getDouble("s"), o.getDouble("e"), o.optString("spk").ifEmpty { null }, o.optString("align").ifEmpty { null }) } }
        val dz = p.getJSONObject("diarize")
        val got = PwJson.build(words, Diarize.Stats(dz.getInt("speakers"), dz.getInt("units"), emptyMap()), dz.getDouble("seconds"))
        assertEquals(p.toString(), got.toString())
    }
}
