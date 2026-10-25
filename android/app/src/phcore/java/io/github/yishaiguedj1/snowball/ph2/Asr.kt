package io.github.yishaiguedj1.snowball.ph2

import ai.onnxruntime.OnnxTensor
import io.github.yishaiguedj1.snowball.lab.Ort
import io.github.yishaiguedj1.snowball.lab.Parakeet
import java.io.Closeable
import java.io.File
import java.nio.FloatBuffer
import kotlin.math.max
import kotlin.math.min

/**
 * 25/10/2026 (תרגום בטלפון, שלב 2): התמלול של השרת (vt/asr_parakeet.py transcribe) אחד לאחד —
 * Silero VAD (onnx_asr 0.12.0) → חלונות של עד 40 שנ׳ בשתיקות → Parakeet לכל חלון → מילים → חורים ותמלול חוזר.
 * ההבדל היחיד: כל חלון לבד (השרת — באצווה של 4; הריפוד באצווה משנה מעט את התוצאה גם בשרת — נמדד).
 */
class SileroVad(file: File, threads: Int = 1) : Closeable {
    private val s = Ort.session(file, threads, true)

    /** הסתברות דיבור לכל 512 דגימות (32ms) — _encode של onnx_asr: הקשר של 64 דגימות לפני כל צעד, מצב רציף */
    fun probs(wav: FloatArray): FloatArray = probs(Audio.of(wav))

    /** הסתברות דיבור לכל 512 דגימות (32ms) — _encode של onnx_asr: הקשר של 64 דגימות לפני כל צעד, מצב רציף. נקרא בחלקים */
    fun probs(au: Audio, onProg: (Int, Int) -> Unit = { _, _ -> }): FloatArray {
        val hop = HOP; val ctx = CTX
        val n = au.n
        val full = n / hop
        val last = n % hop
        if (n == 0) return FloatArray(0)
        val out = FloatArray(if (full > 0) full + (if (last > 0) 1 else 0) else 2)
        var state = FloatArray(2 * 128)
        val frame = FloatArray(ctx + hop)
        fun run(): Float {
            Ort.floats(frame, 1, frame.size.toLong()).use { x ->
                Ort.floats(state, 2, 1, 128).use { st ->
                    OnnxTensor.createTensor(Ort.env, 16000L).use { sr ->
                        s.run(mapOf("input" to x, "state" to st, "sr" to sr)).use { r ->
                            val p = (r.get("output").get() as OnnxTensor).floatBuffer.get(0)
                            val nb = (r.get("stateN").get() as OnnxTensor).floatBuffer
                            state = FloatArray(nb.remaining()); nb.get(state)
                            return p
                        }
                    }
                }
            }
        }
        // הראשון: אפסים בהקשר + 512 הדגימות הראשונות (מרופד באפסים אם הקובץ קצר)
        java.util.Arrays.fill(frame, 0f)
        au.read(0, min(hop, n)).copyInto(frame, ctx)
        var k = 0
        out[k++] = run()
        if (full > 0) {
            val block = hop * 2048
            var bs = -1; var blk = FloatArray(0)
            for (i in 1 until full) {
                val a = i * hop - ctx
                if (bs < 0 || a + ctx + hop > bs + blk.size) { bs = a; blk = au.read(a, min(n, a + block + ctx + hop)) }
                System.arraycopy(blk, a - bs, frame, 0, ctx + hop)
                out[k++] = run()
                if (i % 4096 == 0) onProg(i, full)
            }
            if (last > 0) {
                java.util.Arrays.fill(frame, 0f)
                au.read(n - last - ctx, n).copyInto(frame, 0)
                out[k++] = run()
            }
        } else {
            // קובץ קצר מ־512 דגימות: onnx_asr מריץ את הראשון ואת "האחרון" (אותו מקטע מרופד) — שתי הרצות
            java.util.Arrays.fill(frame, 0f)
            au.read(max(0, n - last - ctx), n).copyInto(frame, 0)
            out[k++] = run()
        }
        return out
    }

    override fun close() = s.close()

    companion object {
        const val HOP = 512
        const val CTX = 64
        const val SR = 16000

        /** _find_segments (threshold 0.5, ‏neg 0.35) + _merge_segments עם הפרמטרים של transcribe */
        fun segments(probs: FloatArray, n: Int, threshold: Float = 0.5f, minSilenceMs: Double = 150.0, minSpeechMs: Double = 150.0,
                     maxSpeechS: Double = 3600.0, padMs: Double = 0.0): List<Pair<Int, Int>> {
            val neg = threshold - 0.15f
            val raw = ArrayList<Pair<Int, Int>>()
            var st = 0; var start = 0
            for (i in 0..probs.size) {
                val p = if (i < probs.size) probs[i] else 0f
                if (st == 0 && p >= threshold) { st = 1; start = i * HOP }
                else if (st == 1 && p < neg) { st = 0; raw.add(start to i * HOP) }
            }
            val pad = (padMs * SR / 1000).toLong()
            val minSpeech = (minSpeechMs * SR / 1000).toLong() - 2 * pad
            val maxSpeech = (maxSpeechS * SR).toLong() - 2 * pad
            val minSil = (minSilenceMs * SR / 1000).toLong() + 2 * pad
            val inf = 1_000_000_000_000_000L
            val out = ArrayList<Pair<Int, Int>>()
            var cs = -inf; var ce = -inf
            val all = raw.map { it.first.toLong() to it.second.toLong() } + listOf(n.toLong() to n.toLong(), inf to inf)
            for ((s0, e) in all) {
                var s = s0
                if (s - ce < minSil && e - cs < maxSpeech) ce = e
                else {
                    if (cs < n && ce > cs && ce - cs > minSpeech) out.add(max(cs - pad, 0L).toInt() to min(ce + pad, n.toLong()).toInt())
                    while (e - s > maxSpeech) { out.add(max(s - pad, 0L).toInt() to (s + maxSpeech + pad).toInt()); s += maxSpeech }
                    cs = s; ce = e
                }
            }
            return out
        }
    }
}

/** מילה מהתמלול — כמו המילון של asr_parakeet (‏w, s, e) */
class AWord(var w: String, var s: Double, var e: Double)

object AsrWords {
    const val HOLE_S = 0.9; const val HOLE_PAD = 2.0; const val WORD_S = 0.6; const val QUIET_S = 1.8; const val PIECE_S = 28.0

    /** _chunks: חלונות של עד maxS, חיתוך רק בשתיקות, ריפוד pad דגימות לכל צד בתוך השתיקה */
    fun chunks(segs: List<Pair<Int, Int>>, n: Int, sr: Int = 16000, maxS: Double = 40.0, pad: Int = 0): List<Pair<Int, Int>> {
        val out = ArrayList<Pair<Int, Int>>()
        val maxLen = (maxS * sr).toInt()
        var cs: Int? = null; var ce = 0
        for ((s, e) in segs) {
            if (cs == null) { cs = s; ce = e }
            else if (e - cs <= maxLen) ce = e
            else { out.add(cs to ce); cs = s; ce = e }
            while (ce - cs!! > maxLen * 1.5) { out.add(cs to cs + maxLen); cs += maxLen }
        }
        if (cs != null) out.add(cs to ce)
        return out.mapIndexed { i, (s, e) ->
            val lo = if (i == 0) max(0, s - pad) else max(s - pad, Math.floorDiv(out[i - 1].second + s, 2))
            val hi = if (i == out.size - 1) min(n, e + pad) else min(e + pad, Math.floorDiv(e + out[i + 1].first, 2))
            lo to hi
        }
    }

    /** tokens_to_words. ‏strip של פייתון = כל רווח לבן; העיגול round(x, 3) */
    fun tokensToWords(tokens: List<String>, ts: List<Double>, offset: Double, chunkEnd: Double): List<AWord> {
        val words = ArrayList<AWord>()
        var cur = ""; var curS: Double? = null
        for ((tok, t) in tokens.zip(ts)) {
            if (tok.startsWith(" ") || tok.startsWith("▁") || curS == null) {
                if (cur.pyStrip().isNotEmpty()) words.add(AWord(cur.pyStrip(), curS!!, 0.0))
                cur = tok.replace("▁", " "); curS = offset + t
            } else cur += tok
        }
        if (cur.pyStrip().isNotEmpty()) words.add(AWord(cur.pyStrip(), curS!!, 0.0))
        for (i in words.indices) {
            val w = words[i]
            val nxt = if (i + 1 < words.size) words[i + 1].s else min(chunkEnd, w.s + 0.6)
            w.e = max(w.s + 0.04, min(nxt, w.s + 1.5))
            w.s = QAlign.r3(w.s); w.e = QAlign.r3(w.e)
        }
        return words.filter { it.w.isNotEmpty() && it.w != "," && it.w != "." }
    }

    private fun String.pyStrip(): String = trim { it.isWhitespace() || it == '\u001c' || it == '\u001d' || it == '\u001e' || it == '\u001f' || it == '\u0085' }

    private fun norm(w: String): String = buildString { w.lowercase().forEach { if (it.isLetterOrDigit()) append(it) } }

    private val SPELLED = Regex("""[-/]|\.[\p{L}\p{N}_]""")   // ‎\w‎ של פייתון (Unicode) — ב־JVM ‎\w‎ הוא ASCII ובאנדרואיד Unicode

    private fun dup(g: AWord, near: List<AWord>): Boolean {
        val t = norm(g.w)
        if (t.isEmpty()) return true
        for (w in near) {
            val u = norm(w.w)
            if (Math.abs(w.s - g.s) <= 1.2 && u == t) return true
            val win = if (t.length == 1) 5.0 else 2.5
            val spelled = SPELLED.containsMatchIn(w.w)
            if (Math.abs(w.s - g.s) <= win && spelled && u.length > 4 && (u.endsWith(t) || u.startsWith(t) || u.contains(t))) return true
        }
        return false
    }

    class Hole(val i: Int, val a: Double, val b: Double)

    /** holes: חור = לפחות HOLE_S של דיבור (לפי ה־VAD) בין שתי מילים, או QUIET_S בלי מילים; ארוך — בחלקים של PIECE_S */
    fun holes(words: List<AWord>, segs: List<Pair<Double, Double>>, total: Double): List<Hole> {
        val out = ArrayList<Hole>()
        for (i in 0..words.size) {
            val a = if (i > 0) words[i - 1].s + WORD_S else 0.0
            val b = if (i < words.size) words[i].s else total
            if (b - a < HOLE_S) continue
            var sp = 0.0
            for ((s, e) in segs) sp += max(0.0, min(e, b) - max(s, a))
            if (sp >= HOLE_S || b - a >= QUIET_S) {
                val k = max(1, Math.ceil((b - a) / PIECE_S).toInt())
                val step = (b - a) / k
                for (j in 0 until k) out.add(Hole(i, a + j * step, a + (j + 1) * step))
            }
        }
        return out
    }

    /** rescue: תמלול חוזר של כל חור; נכנסות רק מילים שמתחילות בתוכו ושלא נשמעו כבר לידו. מחזיר כמה נוספו */
    fun rescue(words: MutableList<AWord>, found: List<Hole>, total: Double, recog: (Double, Double) -> List<AWord>): Int {
        val add = HashMap<Int, MutableList<AWord>>()
        for (h in found) {
            val i = h.i
            val prev = if (i > 0) words[i - 1] else null
            val nxt = if (i < words.size) words[i] else null
            val lo = max(if (prev != null) prev.s + 0.05 else 0.0, if (add[i] != null) h.a else 0.0)
            var hi = if (nxt != null) nxt.s - 0.05 else total
            hi = if (h.b < hi - 0.5) min(hi, h.b) else hi
            var got = recog(max(0.0, h.a - HOLE_PAD), min(total, h.b + HOLE_PAD)).filter { lo < it.s && it.s < hi }
            val near = words.subList(max(0, i - 6), min(words.size, i + 6)).toList()
            got = got.filter { !dup(it, near) }
            val lst = add.getOrPut(i) { ArrayList() }
            if (got.isNotEmpty()) {
                if (nxt != null) got.last().e = min(got.last().e, nxt.s)
                lst.addAll(got)
            }
        }
        if (add.values.all { it.isEmpty() }) return 0
        val res = ArrayList<AWord>()
        for (i in 0..words.size) {
            add[i]?.let { res.addAll(it) }
            if (i < words.size) res.add(words[i])
        }
        for (i in 0 until res.size - 1) if (res[i].e > res[i + 1].s) res[i].e = QAlign.r3(max(res[i].s + 0.04, res[i + 1].s))
        val n = res.size - words.size
        words.clear(); words.addAll(res)
        return n
    }
}

/** התמלול כולו (transcribe): קובץ קול 16kHz → מילים. ‏onChunk = התקדמות (חלון, מתוך) */
class PhoneAsr(private val vad: SileroVad, private val model: Parakeet, private val mel: NemoMel) {
    private val STEP = 0.01 * 8   // window_step × subsampling — אותו double של onnx_asr
    class Out(val words: List<AWord>, val segs: List<Pair<Int, Int>>, val chunks: List<Pair<Int, Int>>, val holes: Int, val rescued: Int)

    fun tokens(rec: Parakeet.Rec): Pair<List<String>, List<Double>> =
        rec.tokens.map { model.vocab.tokens[it] ?: "" } to rec.idx.map { STEP * it }

    fun recognize(au: Audio, a: Int, b: Int, offset: Double, end: Double): List<AWord> {
        val r = model.recognize(au.read(a, b)) { mel.features(it) }
        if (r.tokens.isEmpty()) return emptyList()
        val (t, ts) = tokens(r)
        return AsrWords.tokensToWords(t, ts, offset, end)
    }

    fun run(wav: FloatArray): Out = run(Audio.of(wav))

    /** [onStep] = (שלב: vad/asr/rescue, כמה, מתוך) */
    fun run(au: Audio, onStep: (String, Int, Int) -> Unit = { _, _, _ -> }): Out {
        val sr = 16000
        val segs = SileroVad.segments(vad.probs(au) { i, t -> onStep("vad", i, t) }, au.n)
        val chunks = AsrWords.chunks(segs, au.n, sr, pad = (0.12 * sr).toInt())
        val words = ArrayList<AWord>()
        for ((k, c) in chunks.withIndex()) {
            words.addAll(recognize(au, c.first, c.second, c.first.toDouble() / sr, c.second.toDouble() / sr))
            onStep("asr", k + 1, chunks.size)
        }
        val total = au.n.toDouble() / sr
        val found = AsrWords.holes(words, segs.map { it.first.toDouble() / sr to it.second.toDouble() / sr }, total)
        var n = 0
        if (found.isNotEmpty()) {
            var k = 0
            n = AsrWords.rescue(words, found, total) { a, b ->
                recognize(au, (a * sr).toInt(), (b * sr).toInt(), a, b).also { onStep("rescue", ++k, found.size) }
            }
        }
        return Out(words, segs, chunks, found.size, n)
    }
}
