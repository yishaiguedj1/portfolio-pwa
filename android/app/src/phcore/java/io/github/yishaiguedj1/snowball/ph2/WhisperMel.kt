package io.github.yishaiguedj1.snowball.ph2

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.log10
import kotlin.math.max

/**
 * 25/10/2026: WhisperFeatureExtractor (128 ערוצים) כמו בשרת — הנתיב של torch (_torch_extract_fbank_features), כי
 * בתמונת העובד יש torch: stft עם hann מחזורי, center + reflect, בלי הפריים האחרון, log10 עם רצפה 1e-10, מקסימום
 * גלובלי פחות 8, ‏(x+4)/4. המסננים (201×128) = mel_filters של transformers, שמורים בקובץ (whisper_mel_128.bin).
 * לפני: float_range_normalize של qwen_asr (שיא מעל 1 — מחלקים, ואז חיתוך ל־[-1, 1]).
 */
class WhisperMel(filters: FloatArray) {
    private val fil = filters                     // [k * 128 + m], k = 0..200
    private val win = DoubleArray(400) { 0.5 - 0.5 * cos(2 * PI * it / 400) }
    private val fft = Fft(400)

    /** מחזיר (128 × T) בשורות — T = len / 160 */
    fun mel(wav0: FloatArray): Pair<FloatArray, Int> {
        val wav = normalize(wav0)
        val L = wav.size
        val T = L / 160
        val out = FloatArray(128 * T)
        val frame = DoubleArray(400); val pw = DoubleArray(201)
        var mx = Double.NEGATIVE_INFINITY
        val tmp = DoubleArray(128)
        for (t in 0 until T) {
            for (j in 0 until 400) {
                var i = t * 160 - 200 + j
                if (i < 0) i = -i
                if (i >= L) i = 2 * L - 2 - i
                frame[j] = wav[i.coerceIn(0, L - 1)] * win[j]
            }
            fft.power(frame, pw)
            java.util.Arrays.fill(tmp, 0.0)
            for (k in 0..200) { val p = pw[k]; if (p == 0.0) continue; val b = k * 128; for (m in 0 until 128) tmp[m] += fil[b + m] * p }
            for (m in 0 until 128) { val v = log10(max(tmp[m], 1e-10)); out[m * T + t] = v.toFloat(); if (v > mx) mx = v }
        }
        val floor = (mx - 8.0).toFloat()
        for (i in out.indices) out[i] = (max(out[i], floor) + 4f) / 4f
        return out to T
    }

    companion object {
        fun normalize(a: FloatArray): FloatArray {
            var peak = 0f
            for (x in a) { val v = kotlin.math.abs(x); if (v > peak) peak = v }
            if (peak == 0f) return a
            val d = if (peak > 1f) peak else 1f
            return FloatArray(a.size) { (a[it] / d).coerceIn(-1f, 1f) }
        }

        fun filters(bytes: ByteArray): FloatArray {
            val bb = java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
            require(bb.remaining() == 201 * 128) { "mel filters" }
            return FloatArray(bb.remaining()).also { bb.get(it) }
        }
    }
}
