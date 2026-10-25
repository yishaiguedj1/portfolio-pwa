package io.github.yishaiguedj1.snowball.ph2

import ai.onnxruntime.OnnxTensor
import io.github.yishaiguedj1.snowball.lab.Npy
import io.github.yishaiguedj1.snowball.lab.Ort
import java.io.Closeable
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteOrder
import java.nio.channels.FileChannel

/**
 * Qwen3-ForcedAligner (INT8) — הגרפים של translator/aligner_export.py, אותה זרימה של OnnxAligner.align:
 * מל → audio-conv (חלקי 100 פריימים) + קידוד מיקומי → audio-encoder → מוזרק במקום טוקני האודיו → text-decoder (+argmax)
 * → המיקומים של <timestamp> × ‏seg_ms.
 */
class QwenAligner(dir: File, threads: Int, arena: Boolean, private val tok: QTok, private val mel: WhisperMel,
                  private val audioId: Int, private val tsId: Int, private val segMs: Double) : Closeable {
    private val conv = Ort.session(File(dir, "audio-conv.onnx"), threads, arena)
    private val enc = Ort.session(File(dir, "audio-encoder.onnx"), threads, arena)
    private val dec = Ort.session(File(dir, "text-decoder.onnx"), threads, arena)
    private val embNpy = Npy.parse(File(dir, "embed.npy"))
    private val embRaf = RandomAccessFile(File(dir, "embed.npy"), "r")
    private val emb = embRaf.channel.map(FileChannel.MapMode.READ_ONLY, 0, embRaf.length()).order(ByteOrder.LITTLE_ENDIAN)
    private val pos: FloatArray
    private val d = 1024

    init {
        val p = Npy.parse(File(dir, "pos.npy"))
        require(p.dtype == "<f4" && p.shape.size == 2 && p.shape[1] == 1024L) { "pos_shape" }
        RandomAccessFile(File(dir, "pos.npy"), "r").use { r ->
            val n = (p.shape[0] * 1024).toInt()
            val bb = r.channel.map(FileChannel.MapMode.READ_ONLY, p.dataOffset, n * 4L).order(ByteOrder.LITTLE_ENDIAN)
            pos = FloatArray(n); bb.asFloatBuffer().get(pos)
        }
        require(embNpy.dtype == "<f2" && embNpy.shape.size == 2 && embNpy.shape[1] == 1024L) { "embed_shape" }
    }

    class Out(val items: List<Triple<String, Double, Double>>, val ids: IntArray, val melFrames: Int, val raw: DoubleArray)

    /** קטע אחד: האודיו (16kHz) והטקסט (המילים הנקיות מופרדות ברווח) → (מילה, התחלה, סוף) בשניות מתחילת הקטע */
    fun align(wav: FloatArray, text: String): Out {
        val words = QAlign.wordList(text)
        val (m, t) = mel.mel(wav)
        val ids = QAlign.ids(tok, words, t)
        val af = audioFeatures(m, t)
        val a = af.size / d
        val l = ids.size
        val e = FloatArray(l * d)
        var k = 0
        for (i in 0 until l) {
            if (ids[i] == audioId) { System.arraycopy(af, k * d, e, i * d, d); k++ } else row(ids[i], e, i)
        }
        require(k == a) { "aligner_onnx_audio_tokens:$k/$a" }
        val outIds: LongArray
        Ort.floats(e, 1, l.toLong(), d.toLong()).use { x ->
            dec.run(mapOf("e" to x)).use { r ->
                val o = r.get(0) as OnnxTensor
                val lb = o.longBuffer
                outIds = LongArray(lb.remaining()); lb.get(outIds)
            }
        }
        val raw = DoubleArray(ids.count { it == tsId })
        var j = 0
        for (i in 0 until l) if (ids[i] == tsId) raw[j++] = outIds[i].toDouble()
        val ms = DoubleArray(raw.size) { raw[it] * segMs }
        return Out(QAlign.parse(words, ms), ids, t, raw)
    }

    private fun row(id: Int, out: FloatArray, at: Int) {
        val base = embNpy.dataOffset + id.toLong() * d * 2
        for (c in 0 until d) out[at * d + c] = Npy.half(emb.getShort((base + c * 2).toInt()).toInt() and 0xffff)
    }

    /** (128, T) → (T', 1024), כמו audio_features ב־align_onnx.py */
    private fun audioFeatures(mel: FloatArray, tMel: Int): FloatArray {
        val k = (tMel + 99) / 100
        val pad = FloatArray(k * 128 * 100)
        val lens = IntArray(k)
        for (i in 0 until k) {
            val w = minOf(100, tMel - i * 100)
            for (c in 0 until 128) System.arraycopy(mel, c * tMel + i * 100, pad, (i * 128 + c) * 100, w)
            lens[i] = QAlign.outLen(w)
        }
        val y: FloatArray
        val per: Int
        Ort.floats(pad, k.toLong(), 1, 128, 100).use { x ->
            conv.run(mapOf("x" to x)).use { r ->
                val t = r.get(0) as OnnxTensor
                per = t.info.shape[1].toInt()
                y = FloatArray(t.floatBuffer.remaining()); t.floatBuffer.get(y)
            }
        }
        val total = lens.sum()
        require(total == QAlign.outLen(tMel)) { "qwen_len:$total" }
        val h = FloatArray(total * d)
        var o = 0
        for (i in 0 until k) for (j in 0 until lens[i]) {
            val src = (i * per + j) * d
            for (c in 0 until d) h[o * d + c] = y[src + c] + pos[j * d + c]
            o++
        }
        Ort.floats(h, total.toLong(), d.toLong()).use { x ->
            enc.run(mapOf("h" to x)).use { r ->
                val t = r.get(0) as OnnxTensor
                val out = FloatArray(t.floatBuffer.remaining()); t.floatBuffer.get(out); return out
            }
        }
    }

    override fun close() { conv.close(); enc.close(); dec.close(); embRaf.close() }
}
