package io.github.yishaiguedj1.snowball.ph2

import io.github.yishaiguedj1.snowball.lab.Wav
import java.io.Closeable
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * 25/10/2026: הקול של העבודה (16kHz מונו) — נקרא בחלקים. בשרת כל הקול בזיכרון; בטלפון שעה = ‎~230MB של float — קרוב
 * לגבול של אפליקציה, ולכן כל שלב מבקש רק את הקטע שלו (הערכים זהים: pcm_s16le חלקי 32768, כמו soundfile).
 */
interface Audio {
    val n: Int
    /** הדגימות [a, b) — מחוץ לקובץ נחתך (כמו חיתוך של numpy) */
    fun read(a: Int, b: Int): FloatArray

    companion object {
        fun of(x: FloatArray): Audio = object : Audio {
            override val n = x.size
            override fun read(a: Int, b: Int) = x.copyOfRange(a.coerceIn(0, n), b.coerceIn(0, n).coerceAtLeast(a.coerceIn(0, n)))
        }
    }
}

class WavAudio(f: File) : Audio, Closeable {
    private val inf = Wav.info(f).also { require(it.channels == 1 && it.rate == 16000) { "wav_16k_mono" } }
    private val r = RandomAccessFile(f, "r")
    override val n = (inf.dataLen / 2).toInt()

    @Synchronized override fun read(a: Int, b: Int): FloatArray {
        val lo = a.coerceIn(0, n); val hi = b.coerceIn(lo, n)
        val out = FloatArray(hi - lo)
        if (out.isEmpty()) return out
        val buf = ByteArray(out.size * 2)
        r.seek(inf.dataStart + lo * 2L); r.readFully(buf)
        val sb = ByteBuffer.wrap(buf).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
        for (i in out.indices) out[i] = sb.get(i) / 32768f
        return out
    }

    override fun close() = r.close()
}
