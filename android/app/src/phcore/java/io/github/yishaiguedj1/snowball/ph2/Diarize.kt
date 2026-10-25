package io.github.yishaiguedj1.snowball.ph2

import ai.onnxruntime.OnnxTensor
import io.github.yishaiguedj1.snowball.lab.Ort
import java.io.Closeable
import java.io.File
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * 25/10/2026 (תרגום בטלפון, שלב 2): זיהוי הדוברים של השרת (vt/diarize.py) אחד לאחד — fbank בסגנון Kaldi, טביעת קול
 * WeSpeaker ResNet34-LM (‏CC-BY-4.0, אותו קובץ ואותו sha256), אשכול average linkage ב־NN-chain, איחוד אשכולות קטנים,
 * קטעים קצרים כמו השכן, והזזת החלפת דובר לסוף המשפט. כל הקבועים — מאותו קובץ.
 */
object Diarize {
    const val SR = 16000
    const val GAP_S = 0.25; const val WIN_S = 2.0; const val MIN_EMB_S = 1.0; const val STRONG_S = 1.2
    const val THRESH = 0.68; const val MIN_SPK_S = 4.0; const val MERGE_B = 0.4; const val MERGE_K = 0.005; const val SNAP_W = 3
    const val MODEL_SHA256 = "7bb2f06e9df17cdf1ef14ee8a15ab08ed28e8d0ef5054ee135741560df2ec068"

    class Unit(val a: Int, val b: Int, val r: Int)

    /** טביעות מנורמלות (256) לכל קטע */
    fun interface Embed { fun many(clips: List<FloatArray>): Array<FloatArray> }

    private fun endsSentence(w: String) = w.isEmpty() || w.last() in ".?!"

    fun units(words: List<Word>): List<Unit> {
        val runs = ArrayList<Pair<Int, Int>>(); var a = 0
        for (i in 1..words.size) {
            val end = i == words.size || words[i].s - words[i - 1].e >= GAP_S ||
                (endsSentence(words[i - 1].w) && words[i].s - words[i - 1].e >= 0.08)
            if (end) { runs.add(a to i); a = i }
        }
        val out = ArrayList<Unit>()
        for ((r, ab) in runs.withIndex()) {
            val (x, y) = ab
            if (words[y - 1].e - words[x].s <= WIN_S * 1.5) { out.add(Unit(x, y, r)); continue }
            var k = x
            for (j in x + 1..y) if (j == y || words[j].s - words[k].s >= WIN_S) { out.add(Unit(k, j, r)); k = j }
        }
        return out
    }

    // --- fbank (torchaudio.compliance.kaldi.fbank: povey, ‏pre-emphasis 0.97, בלי dither), הכל ב־double כמו ב־numpy ---
    private val banks: Array<FloatArray> by lazy { melBanks() }
    private val win = DoubleArray(400) { (0.5 - 0.5 * cos(2 * PI * it / 399)).pow(0.85) }
    private val EPS32 = Math.ulp(1.0f).toDouble()   // np.finfo(np.float32).eps

    fun melBanks(nMels: Int = 80, nFft: Int = 512, lo: Double = 20.0, hi: Double = SR / 2.0): Array<FloatArray> {
        fun mel(f: Double) = 1127.0 * ln(1.0 + f / 700.0)
        val mLo = mel(lo); val mHi = mel(hi)
        val step = (mHi - mLo) / (nMels + 1)
        val pts = DoubleArray(nMels + 2) { it * step + mLo }.also { it[nMels + 1] = mHi }
        val mf = DoubleArray(nFft / 2) { mel(it * SR.toDouble() / nFft) }
        return Array(nMels) { m ->
            val l = pts[m]; val c = pts[m + 1]; val r = pts[m + 2]
            FloatArray(nFft / 2 + 1) { k -> if (k >= nFft / 2) 0f else max(0.0, min((mf[k] - l) / (c - l), (r - mf[k]) / (r - c))).toFloat() }
        }
    }

    private val fft by lazy { Fft(512) }

    /** (פריימים × 80) בשורות, ‏float32, אחרי הורדת הממוצע לכל ערוץ */
    fun fbank(x0: FloatArray): Pair<FloatArray, Int> {
        val x = DoubleArray(max(400, x0.size)) { if (it < x0.size) x0[it] * 32768.0 else 0.0 }
        val n = 1 + (x.size - 400) / 160
        val f = DoubleArray(n * 80)
        val fr = DoubleArray(512); val pw = DoubleArray(257)
        synchronized(fft) {
            for (t in 0 until n) {
                var mean = 0.0
                for (j in 0 until 400) mean += x[t * 160 + j]
                mean /= 400
                var prev = x[t * 160] - mean
                for (j in 0 until 400) {
                    val v = x[t * 160 + j] - mean
                    fr[j] = (v - 0.97 * (if (j == 0) v else prev)) * win[j]
                    prev = v
                }
                java.util.Arrays.fill(fr, 400, 512, 0.0)
                fft.power(fr, pw)
                for (m in 0 until 80) {
                    var s = 0.0; val bk = banks[m]
                    for (k in 0..256) s += pw[k] * bk[k].toDouble()
                    f[t * 80 + m] = ln(max(s, EPS32))
                }
            }
        }
        val out = FloatArray(n * 80)
        for (m in 0 until 80) {
            var s = 0.0; for (t in 0 until n) s += f[t * 80 + m]
            val mean = s / n
            for (t in 0 until n) out[t * 80 + m] = (f[t * 80 + m] - mean).toFloat()
        }
        return out to n
    }

    // --- אשכול היררכי average linkage (NN-chain) ---
    fun cluster(emb: Array<FloatArray>, thresh: Double = THRESH): IntArray {
        val n = emb.size
        if (n <= 1) return IntArray(n)
        val S = Array(n) { i -> DoubleArray(n) { j -> dotF(emb[i], emb[j]).toDouble() } }
        for (i in 0 until n) S[i][i] = Double.NEGATIVE_INFINITY
        val size = DoubleArray(n) { 1.0 }
        val alive = BooleanArray(n) { true }
        val merges = ArrayList<Triple<Int, Int, Double>>()
        val chain = ArrayList<Int>()
        var left = n
        val row = DoubleArray(n)
        while (left > 1) {
            if (chain.isEmpty()) chain.add(alive.indexOfFirst { it })
            val a = chain.last()
            for (j in 0 until n) row[j] = if (alive[j]) S[a][j] else Double.NEGATIVE_INFINITY
            row[a] = Double.NEGATIVE_INFINITY
            var b = argmax(row)
            if (chain.size > 1 && row[chain[chain.size - 2]] >= row[b]) b = chain[chain.size - 2]
            if (chain.size > 1 && b == chain[chain.size - 2]) {
                chain.removeAt(chain.size - 1); chain.removeAt(chain.size - 1)
                merges.add(Triple(a, b, 1.0 - S[a][b]))
                val nw = DoubleArray(n) { (size[a] * S[a][it] + size[b] * S[b][it]) / (size[a] + size[b]) }
                for (j in 0 until n) { S[a][j] = nw[j]; S[j][a] = nw[j] }
                S[a][a] = Double.NEGATIVE_INFINITY
                size[a] += size[b]
                alive[b] = false
                for (j in 0 until n) { S[b][j] = Double.NEGATIVE_INFINITY; S[j][b] = Double.NEGATIVE_INFINITY }
                left--
            } else chain.add(b)
        }
        val parent = IntArray(n) { it }
        fun root(x0: Int): Int { var x = x0; while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x] }; return x }
        for ((a, b, h) in merges) if (h <= thresh) parent[root(b)] = root(a)
        val roots = IntArray(n) { root(it) }
        val ids = LinkedHashMap<Int, Int>()
        for (r in roots) if (r !in ids) ids[r] = ids.size
        return IntArray(n) { ids[roots[it]]!! }
    }

    private fun argmax(a: DoubleArray): Int { var b = 0; for (i in 1 until a.size) if (a[i] > a[b]) b = i; return b }
    private fun argmax(a: FloatArray): Int { var b = 0; for (i in 1 until a.size) if (a[i] > a[b]) b = i; return b }

    /** מכפלה פנימית של float32 — מחושבת ב־double ומעוגלת ל־float (כמו matmul של float32 עד כדי סדר החיבור) */
    private fun dotF(a: FloatArray, b: FloatArray): Float { var s = 0.0; for (i in a.indices) s += a[i].toDouble() * b[i]; return s.toFloat() }

    private fun normed(v: DoubleArray): FloatArray {
        val f = FloatArray(v.size) { v[it].toFloat() }
        var s = 0.0; for (x in f) s += x.toDouble() * x
        val nrm = sqrt(s).toFloat()
        return FloatArray(f.size) { f[it] / nrm }
    }

    private fun mean(rows: List<FloatArray>): DoubleArray {
        val o = DoubleArray(rows[0].size); for (r in rows) for (i in o.indices) o[i] += r[i].toDouble()
        for (i in o.indices) o[i] = (o[i] / rows.size).toFloat().toDouble()
        return o
    }

    private fun mergeSmall(E: Array<FloatArray>, dur: DoubleArray, who0: IntArray, cent0: List<FloatArray>): Pair<IntArray, List<FloatArray>> {
        var who = who0; var cent = cent0
        while (cent.size > 1) {
            val k = cent.size
            val talk = DoubleArray(k) { c -> var s = 0.0; for (i in who.indices) if (who[i] == c) s += dur[i]; s }
            val C = List(k) { c -> val rows = E.indices.filter { who[it] == c }.map { E[it] }
                if (rows.isNotEmpty()) normed(mean(rows)) else normed(DoubleArray(cent[c].size) { cent[c][it].toDouble() }) }
            val M = Array(k) { i -> FloatArray(k) { j -> if (i == j) -1f else dotF(C[i], C[j]) } }
            var drop = -1
            for (c in (0 until k).sortedBy { talk[it] }) {
                val g = argmax(M[c])
                if (M[c][g] > MERGE_B + MERGE_K * min(talk[c], talk[g])) { drop = c; break }
            }
            if (drop < 0) break
            cent = C.filterIndexed { i, _ -> i != drop }
            who = IntArray(E.size) { i -> argmax(FloatArray(cent.size) { c -> dotF(E[i], cent[c]) }) }
        }
        return who to cent
    }

    class Stats(val speakers: Int, val units: Int, val talk: Map<String, Double>)

    /** ממלא spk = S1, ‏S2… בסדר ההופעה (assign) */
    fun assign(words: List<Word>, audio: FloatArray, embed: Embed): Stats = assign(words, Audio.of(audio), embed)

    fun assign(words: List<Word>, audio: Audio, embed: Embed): Stats {
        val us = units(words)
        if (us.isEmpty()) return Stats(0, 0, emptyMap())
        val dur = DoubleArray(us.size) { words[us[it].b - 1].e - words[us[it].a].s }
        val clips = us.map { u ->
            val a = (words[u.a].s * SR).toInt()
            val b = max(a + 160, (words[u.b - 1].e * SR).toInt())
            audio.read(a, b)
        }
        val E = embed.many(clips)
        var strong = dur.indices.filter { dur[it] >= STRONG_S }
        if (strong.size < 2) strong = dur.indices.toList()
        val Es = Array(strong.size) { E[strong[it]] }
        val lab = cluster(Es)
        val k = lab.max() + 1
        val centAll = List(k) { c -> mean(Es.indices.filter { lab[it] == c }.map { Es[it] }) }
        val tot = DoubleArray(k) { c -> var s = 0.0; for (i in lab.indices) if (lab[i] == c) s += dur[strong[i]]; s }
        var keep = (0 until k).filter { tot[it] >= MIN_SPK_S }
        if (keep.isEmpty()) keep = listOf(argmax(tot))
        var cent = keep.map { normed(centAll[it]) }
        val sim = Array(E.size) { i -> FloatArray(cent.size) { c -> dotF(E[i], cent[c]) } }
        var who = IntArray(E.size) { argmax(sim[it]) }
        val mg = mergeSmall(E, dur, who, cent); who = mg.first; cent = mg.second
        for (i in us.indices) {
            if (dur[i] < STRONG_S && cent.size > 1) {
                val top = sim[i].sortedDescending()
                if ((top[0] - top[1]).toDouble() < 0.08) {
                    val nb = listOf(i - 1, i + 1).filter { it in us.indices && dur[it] >= STRONG_S }.map { who[it] }
                    if (nb.isNotEmpty() && nb.all { it == nb[0] }) who[i] = nb[0]
                }
            }
        }
        val order = LinkedHashSet<Int>(); for (c in who) order.add(c)
        val name = HashMap<Int, String>(); for ((n, c) in order.withIndex()) name[c] = "S${n + 1}"
        for ((u, c) in us.zip(who.toList())) for (w in words.subList(u.a, u.b)) w.spk = name[c]
        for (kk in 1 until us.size) {
            val p = us[kk - 1]; val q = us[kk]
            if (p.r != q.r || who[kk - 1] == who[kk]) continue
            val ends = (max(p.a, p.b - SNAP_W) until min(q.b, p.b + SNAP_W)).filter { endsSentence(words[it].w) && it != p.b - 1 }
            if (ends.isNotEmpty()) {
                val j = ends.minByOrNull { Math.abs(it + 1 - p.b) }!!
                val l = if (j >= p.b) name[who[kk - 1]] else name[who[kk]]
                for (w in words.subList(min(j + 1, p.b), max(j + 1, p.b))) w.spk = l
            }
        }
        val talk = LinkedHashMap<String, Double>()
        for ((i, c) in who.withIndex()) { val nm = name[c]!!; talk[nm] = r1((talk[nm] ?: 0.0) + dur[i]) }
        return Stats(order.size, us.size, talk)
    }

    private fun r1(x: Double) = java.math.BigDecimal(x).setScale(1, java.math.RoundingMode.HALF_EVEN).toDouble()
}

/** WeSpeaker ResNet34-LM ב־ONNX: קטעים באותו מספר פריימים — בהרצה אחת (בלי חיתוך ובלי ריפוד), טביעה מנורמלת */
class WeSpeaker(file: File, threads: Int = 4, private val batch: Int = 32) : Diarize.Embed, Closeable {
    private val s = Ort.session(file, threads, true)

    override fun many(clips: List<FloatArray>): Array<FloatArray> {
        val minLen = (Diarize.MIN_EMB_S * Diarize.SR).toInt()
        val feats = clips.map { x0 ->
            // np.tile(x, …)[:MIN_EMB_S × SR] — קטע קצר חוזר על עצמו עד שנייה
            val x = if (x0.size < minLen && x0.isNotEmpty()) FloatArray(minLen) { x0[it % x0.size] } else x0
            Diarize.fbank(x)
        }
        val out = Array(clips.size) { FloatArray(256) }
        val groups = LinkedHashMap<Int, MutableList<Int>>()
        for ((i, f) in feats.withIndex()) groups.getOrPut(f.second) { ArrayList() }.add(i)
        for ((t, all) in groups) for (k in all.indices step batch) {
            val ix = all.subList(k, min(all.size, k + batch))
            val x = FloatArray(ix.size * t * 80)
            for ((n, i) in ix.withIndex()) System.arraycopy(feats[i].first, 0, x, n * t * 80, t * 80)
            Ort.floats(x, ix.size.toLong(), t.toLong(), 80).use { inp ->
                s.run(mapOf("feats" to inp)).use { r ->
                    val e = (r.get(0) as OnnxTensor).floatBuffer
                    val d = FloatArray(e.remaining()); e.get(d)
                    for ((n, i) in ix.withIndex()) {
                        var ss = 0.0; for (c in 0 until 256) ss += d[n * 256 + c].toDouble() * d[n * 256 + c]
                        val nrm = sqrt(ss).toFloat() + 1e-9f
                        for (c in 0 until 256) out[i][c] = d[n * 256 + c] / nrm
                    }
                }
            }
        }
        return out
    }

    override fun close() = s.close()
}
