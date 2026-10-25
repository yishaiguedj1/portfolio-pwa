package io.github.yishaiguedj1.snowball.ph2

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * 25/10/2026 (תרגום בטלפון, שלב 2): היישור הכפוי — הלוגיקה של vt/align.py ושל Qwen3ForceAlignProcessor (qwen_asr 0.0.6),
 * אחת לאחת. בלי ONNX (QwenAligner מריץ את הגרפים) — נבדק ב־JVM מול הפלט של השרת (QAlignTest).
 */
class Word(var w: String, var s: Double, var e: Double, var spk: String? = null, var align: String? = null,
           var sAsr: Double? = null, var eAsr: Double? = null)

object QAlign {
    const val MAX_CHUNK_S = 90.0
    const val MAX_DEV_S = 1.2

    /** כמו במעבד של Qwen: אותיות, ספרות וגרש בלבד */
    fun keep(cp: Int): Boolean = cp == '\''.code || Character.getType(cp).let { t ->
        t == Character.UPPERCASE_LETTER.toInt() || t == Character.LOWERCASE_LETTER.toInt() || t == Character.TITLECASE_LETTER.toInt() ||
            t == Character.MODIFIER_LETTER.toInt() || t == Character.OTHER_LETTER.toInt() ||
            t == Character.DECIMAL_DIGIT_NUMBER.toInt() || t == Character.LETTER_NUMBER.toInt() || t == Character.OTHER_NUMBER.toInt()
    }

    fun cleanToken(w: String): String {
        val sb = StringBuilder()
        var i = 0
        while (i < w.length) { val cp = w.codePointAt(i); if (keep(cp)) sb.appendCodePoint(cp); i += Character.charCount(cp) }
        return sb.toString()
    }

    private fun cjk(cp: Int) = cp in 0x4E00..0x9FFF || cp in 0x3400..0x4DBF || cp in 0x20000..0x2A6DF || cp in 0x2A700..0x2B73F ||
        cp in 0x2B740..0x2B81F || cp in 0x2B820..0x2CEAF || cp in 0xF900..0xFAFF

    /** tokenize_space_lang + split_segment_with_chinese */
    /** str.split() של פייתון (רווח לבן ב־Unicode) — לא Regex("\\s"), שבאנדרואיד וב־JVM מתנהג אחרת */
    fun pySplit(t: String): List<String> {
        val out = ArrayList<String>(); val b = StringBuilder()
        for (c in t) {
            if (Character.isWhitespace(c) || c == '\u0085' || c == '\u00A0' || c == '\u2007' || c == '\u202F') { if (b.isNotEmpty()) { out.add(b.toString()); b.clear() } }
            else b.append(c)
        }
        if (b.isNotEmpty()) out.add(b.toString())
        return out
    }

    fun wordList(text: String): List<String> {
        val out = ArrayList<String>()
        for (seg in pySplit(text)) {
            val c = cleanToken(seg)
            if (c.isEmpty()) continue
            val buf = StringBuilder()
            var i = 0
            while (i < c.length) {
                val cp = c.codePointAt(i)
                if (cjk(cp)) { if (buf.isNotEmpty()) { out.add(buf.toString()); buf.setLength(0) }; out.add(String(Character.toChars(cp))) }
                else buf.appendCodePoint(cp)
                i += Character.charCount(cp)
            }
            if (buf.isNotEmpty()) out.add(buf.toString())
        }
        return out
    }

    /** encode_timestamp: הטקסט עם שני <timestamp> אחרי כל מילה, ואחרי <|audio_pad|> יחיד (המעבד מכפיל אותו) */
    fun aiText(words: List<String>): String =
        "<|audio_start|><|audio_pad|><|audio_end|>" + words.joinToString("<timestamp><timestamp>") + "<timestamp><timestamp>"

    /** _get_feat_extract_output_lengths */
    fun outLen(n: Int): Int {
        val r = n % 100
        val f = (r - 1).floorDiv(2) + 1
        return ((f - 1).floorDiv(2) + 1 - 1).floorDiv(2) + 1 + (n / 100) * 13
    }

    /** ה־ids של הקטע: ה־<|audio_pad|> מוכפל לפי אורך המל (replace_multimodal_special_tokens) */
    fun ids(tok: QTok, words: List<String>, melFrames: Int): IntArray {
        val t = aiText(words).replaceFirst("<|audio_pad|>", "<|audio_pad|>".repeat(outLen(melFrames)))
        return tok.encode(t)
    }

    /** fix_timestamp: הרצף העולה הארוך ביותר נשאר, השאר — לפי השכנים */
    fun fixTimestamp(data: DoubleArray): IntArray {
        val n = data.size
        if (n == 0) return IntArray(0)
        val dp = IntArray(n) { 1 }; val parent = IntArray(n) { -1 }
        for (i in 1 until n) for (j in 0 until i) if (data[j] <= data[i] && dp[j] + 1 > dp[i]) { dp[i] = dp[j] + 1; parent[i] = j }
        var maxIdx = 0
        for (i in 0 until n) if (dp[i] > dp[maxIdx]) maxIdx = i
        val normal = BooleanArray(n)
        var idx = maxIdx
        while (idx != -1) { normal[idx] = true; idx = parent[idx] }
        val res = data.copyOf()
        var i = 0
        while (i < n) {
            if (!normal[i]) {
                var j = i
                while (j < n && !normal[j]) j++
                val cnt = j - i
                var left: Double? = null
                for (k in i - 1 downTo 0) if (normal[k]) { left = res[k]; break }
                var right: Double? = null
                for (k in j until n) if (normal[k]) { right = res[k]; break }
                if (cnt <= 2) {
                    for (k in i until j) res[k] = when {
                        left == null -> right ?: res[k]
                        right == null -> left
                        else -> if (k - (i - 1) <= j - k) left else right
                    }
                } else {
                    if (left != null && right != null) { val step = (right - left) / (cnt + 1); for (k in i until j) res[k] = left + step * (k - i + 1) }
                    else if (left != null) for (k in i until j) res[k] = left
                    else if (right != null) for (k in i until j) res[k] = right
                }
                i = j
            } else i++
        }
        return IntArray(n) { res[it].toLong().toInt() }   // int() של פייתון — חיתוך לכיוון אפס (הערכים חיוביים)
    }

    /** parse_timestamp → (מילה, התחלה, סוף) בשניות, כמו OnnxAligner.align (round(ms/1000, 3)) */
    fun parse(words: List<String>, tsMs: DoubleArray): List<Triple<String, Double, Double>> {
        val f = fixTimestamp(tsMs)
        return words.mapIndexed { i, w -> Triple(w, r3(f[i * 2] / 1000.0), r3(f[i * 2 + 1] / 1000.0)) }
    }

    /** round(x, 3) של פייתון: הערך המדויק של ה־double, ועיגול חצי לזוגי */
    fun r3(x: Double): Double = java.math.BigDecimal(x).setScale(3, java.math.RoundingMode.HALF_EVEN).toDouble()

    /** plan_chunks: (i0, i1 לא כולל, התחלה, סוף) — חיתוך באמצע השתיקה הארוכה ב־40% האחרונים של החלון */
    fun planChunks(words: List<Word>, maxS: Double = MAX_CHUNK_S, audioLen: Double? = null): List<Chunk> {
        val out = ArrayList<Chunk>()
        var i0 = 0; val n = words.size
        while (i0 < n) {
            var cs = max(0.0, words[i0].s - 0.3)
            if (i0 > 0) cs = max(cs, (words[i0 - 1].e + words[i0].s) / 2)
            var j = i0
            while (j + 1 < n && words[j + 1].e - cs <= maxS) j++
            if (j + 1 >= n) {
                var ce = words[n - 1].e + 0.5
                if (audioLen != null && audioLen > 0) ce = min(ce, audioLen)
                out.add(Chunk(i0, n, cs, ce)); break
            }
            val lo = i0 + max(1, ((j - i0) * 0.6).toInt())
            var bestK = j; var bestGap = -1.0
            for (k in lo..j) {
                val gap = if (k + 1 < n) words[k + 1].s - words[k].e else 0.0
                if (gap > bestGap) { bestK = k; bestGap = gap }
            }
            val ce = (words[bestK].e + words[bestK + 1].s) / 2
            out.add(Chunk(i0, bestK + 1, cs, ce))
            i0 = bestK + 1
        }
        return out
    }

    data class Chunk(val i0: Int, val i1: Int, val cs: Double, val ce: Double)

    /** align_chunk: מהפריטים של המודל לזמנים (יחסית לתחילת הקטע) לכל מילה; מילה בלי אותיות — null */
    fun mapItems(words: List<Word>, items: List<Triple<String, Double, Double>>): Array<Pair<Double, Double>?> {
        val toks = words.map { cleanToken(it.w) }
        val idx = toks.indices.filter { toks[it].isNotEmpty() }
        val out = arrayOfNulls<Pair<Double, Double>>(words.size)
        if (items.size == idx.size) {
            for (k in idx.indices) out[idx[k]] = items[k].second to items[k].third
        } else {
            val a = idx.map { toks[it].lowercase() }; val b = items.map { it.first.lowercase() }
            for ((i1, j1, len) in Diff.equalBlocks(a, b)) for (k in 0 until len) out[idx[i1 + k]] = items[j1 + k].second to items[j1 + k].third
        }
        return out
    }

    /** align_words אחרי ההרצה: מילה רחוקה מהזמן המשוער — "suspicious", בלי זמן — "approx", אחרת qwen3 */
    fun apply(words: List<Word>, c: Chunk, res: Array<Pair<Double, Double>?>, st: Stats) {
        for (k in res.indices) {
            val w = words[c.i0 + k]
            val r = res[k]
            if (r == null) { st.approx++; w.align = "approx"; continue }
            val s = c.cs + r.first; val e = c.cs + r.second
            if (abs(s - w.s) > MAX_DEV_S) { st.suspicious++; w.align = "suspicious"; continue }
            w.sAsr = w.s; w.eAsr = w.e
            w.s = r3(s); w.e = r3(max(e, s + 0.02))
            w.align = "qwen3"; st.aligned++
        }
    }

    class Stats { var aligned = 0; var approx = 0; var suspicious = 0 }

    /** _repair_order */
    fun repairOrder(words: List<Word>) {
        val n = words.size
        for (i in 0 until n) {
            val w = words[i]
            if (w.align == "approx" || w.align == "suspicious") {
                val prevE = if (i > 0) words[i - 1].e else 0.0
                val nxtS = if (i + 1 < n) words[i + 1].s else w.e
                if (!(prevE <= w.s && w.s < w.e && w.e <= max(nxtS, w.s + 0.05))) {
                    w.s = r3(max(prevE, min(w.s, nxtS - 0.05)))
                    w.e = r3(max(w.s + 0.05, min(w.e, nxtS)))
                }
            }
        }
        for (i in 1 until n) {
            if (words[i].s < words[i - 1].s) words[i].s = words[i - 1].s
            if (words[i].e < words[i].s) words[i].e = words[i].s + 0.02
        }
    }
}
