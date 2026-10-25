package io.github.yishaiguedj1.snowball.ph2

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * 25/10/2026: FFT ממשי לאורך קבוע (400 — המל של Whisper/Qwen; ‏512 — ה־fbank של זיהוי הדוברים). Cooley-Tukey מעורב
 * (4/2/5/3) רקורסיבי, ב־double. power() מחזיר |X_k|² ל־k=0..n/2. נבדק מול numpy (FftTest).
 */
class Fft(val n: Int) {
    private val factors: IntArray
    private val cosT = DoubleArray(n) { cos(2 * PI * it / n) }
    private val sinT = DoubleArray(n) { -sin(2 * PI * it / n) }
    private val re = DoubleArray(n)
    private val im = DoubleArray(n)

    init {
        val f = ArrayList<Int>(); var m = n
        for (p in intArrayOf(4, 2, 5, 3)) while (m % p == 0) { f.add(p); m /= p }
        require(m == 1) { "fft size $n" }
        factors = f.toIntArray()
    }

    fun power(x: DoubleArray, out: DoubleArray) {
        System.arraycopy(x, 0, re, 0, n); java.util.Arrays.fill(im, 0.0)
        dft(0, re, im, n)
        for (k in 0..n / 2) out[k] = re[k] * re[k] + im[k] * im[k]
    }

    private fun dft(level: Int, re: DoubleArray, im: DoubleArray, len: Int) {
        if (len == 1) return
        val p = factors[level]; val m = len / p
        val tr = DoubleArray(len); val ti = DoubleArray(len)
        for (q in 0 until p) {
            val sr = DoubleArray(m); val si = DoubleArray(m)
            for (k in 0 until m) { sr[k] = re[k * p + q]; si[k] = im[k * p + q] }
            dft(level + 1, sr, si, m)
            System.arraycopy(sr, 0, tr, q * m, m); System.arraycopy(si, 0, ti, q * m, m)
        }
        val tw = n / len
        for (kk in 0 until len) {
            val k = kk % m
            var sr = 0.0; var si = 0.0
            for (q in 0 until p) {
                val e = ((q * kk) % len) * tw
                val ar = tr[q * m + k]; val ai = ti[q * m + k]
                sr += ar * cosT[e] - ai * sinT[e]; si += ar * sinT[e] + ai * cosT[e]
            }
            re[kk] = sr; im[kk] = si
        }
    }
}
