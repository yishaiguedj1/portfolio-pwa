package io.github.yishaiguedj1.snowball.ph2

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.sqrt

/**
 * 25/10/2026: המאפיינים של Parakeet כמו בשרת — NemoPreprocessorNumpy של onnx_asr 0.12.0 (על מעבד onnx_asr משתמש
 * ב־NumPy ולא ב־nemo128.onnx; שני הקבצים לא זהים במספרים). preemphasis 0.97 → ריפוד 256 אפסים → חלונות של 512 כל 160
 * עם hanning(400) סימטרי באמצע → |rfft| (float64 → float32) בריבוע → מסננים (257×128 מ־fbanks.npz, ‏nemo_mel_128.bin) →
 * ‏log(x + 2⁻²⁴) → נרמול לכל ערוץ על features_lens = len // 160 פריימים (השונות חלקי n−1); הפריים האחרון = 0.
 */
class NemoMel(filters: FloatArray) {
    private val fil = filters                     // [k * 128 + m], k = 0..256
    private val win = DoubleArray(512).also { w -> for (n in 0 until 400) w[56 + n] = 0.5 - 0.5 * cos(2 * PI * n / 399) }
    private val fft = Fft(512)

    /** (128 × T) בשורות, T = len / 160 + 1, והאורך האמיתי (len / 160) */
    fun features(wav: FloatArray): Pair<FloatArray, Int> {
        val L = wav.size
        val pre = FloatArray(L)
        for (i in 0 until L) pre[i] = wav[i] - 0.97f * (if (i > 0) wav[i - 1] else 0f)
        val T = L / 160 + 1
        val n = L / 160
        val lm = FloatArray(128 * T)
        val frame = DoubleArray(512); val pw = DoubleArray(257); val sp = FloatArray(257)
        for (t in 0 until T) {
            for (j in 0 until 512) { val i = t * 160 - 256 + j; frame[j] = if (i in 0 until L) pre[i] * win[j] else 0.0 }
            fft.power(frame, pw)
            for (k in 0..256) { val a = sqrt(pw[k]).toFloat(); sp[k] = a * a }
            for (m in 0 until 128) {
                var s = 0.0
                for (k in 0..256) s += sp[k] * fil[k * 128 + m]
                lm[m * T + t] = ln((s.toFloat() + GUARD).toDouble()).toFloat()
            }
        }
        val out = FloatArray(128 * T)
        for (m in 0 until 128) {
            val b = m * T
            var sum = 0.0; for (t in 0 until n) sum += lm[b + t]
            val mean = (sum / n).toFloat()
            var v = 0.0; for (t in 0 until n) { val d = lm[b + t] - mean; v += (d * d).toDouble() }
            val sd = sqrt((v / (n - 1)).toFloat().toDouble()).toFloat() + 1e-5f
            for (t in 0 until n) out[b + t] = (lm[b + t] - mean) / sd
        }
        return out to n
    }

    companion object {
        const val GUARD = 5.9604645e-8f   // 2⁻²⁴

        fun filters(bytes: ByteArray): FloatArray {
            val bb = java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
            require(bb.remaining() == 257 * 128) { "nemo filters" }
            return FloatArray(bb.remaining()).also { bb.get(it) }
        }
    }
}
