package io.github.yishaiguedj1.snowball.lab

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.io.Closeable
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.nio.IntBuffer
import java.nio.LongBuffer
import java.nio.channels.FileChannel

/**
 * Studio Lab — אותם מודלים של השרת דרך ONNX Runtime (Java API — זהה באנדרואיד וב־JVM, ולכן נבדק גם כאן).
 * Parakeet: ‏nemo128 → encoder → TDT (‏onnx_asr 0.12.0 ‏NemoConformerTdt). Qwen: ‏audio-conv → encoder → text-decoder
 * (‏translator/vt/align_onnx.py). הגדרות הסשן כמו בשרת: תהליכון בין־אופרטורים אחד, בלי סיבוב של תהליכונים מחכים.
 */
object Ort {
    val env: OrtEnvironment by lazy { OrtEnvironment.getEnvironment() }

    fun session(f: File, threads: Int, arena: Boolean): OrtSession {
        val o = OrtSession.SessionOptions()
        o.setIntraOpNumThreads(threads)
        o.setInterOpNumThreads(1)
        o.setCPUArenaAllocator(arena)
        o.addConfigEntry("session.intra_op.allow_spinning", "0")
        o.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
        return env.createSession(f.absolutePath, o)
    }

    fun floats(a: FloatArray, vararg shape: Long): OnnxTensor = OnnxTensor.createTensor(env, FloatBuffer.wrap(a), shape)
}

/** Parakeet TDT 0.6B v2 (INT8) — אותם קבצים של istupakov/parakeet-tdt-0.6b-v2-onnx שהשרת טוען דרך onnx_asr */
class Parakeet(dir: File, threads: Int, arena: Boolean = true) : Closeable {
    val vocab = Vocab.parse(File(dir, "vocab.txt").readText())
    // רק כשהמאפיינים לא מגיעים מבחוץ: בטלפון (Studio) הקובץ לא יורד בכלל — NemoMel במקומו. עד 25/10/2026 נפתח תמיד,
    // ו"הכל בטלפון" נעצר מיד עם "fail" על קובץ חסר
    private val preL = lazy { Ort.session(File(dir, "nemo128.onnx"), threads, arena) }
    private val pre by preL
    private val enc = Ort.session(File(dir, "encoder-model.int8.onnx"), threads, arena)
    private val dec = Ort.session(File(dir, "decoder_joint-model.int8.onnx"), threads, arena)
    private val maxPerStep = 10
    private val subsampling = 8

    class Res(val text: String, val tokens: Int, val frames: Int)

    /** קטע אחד (16kHz מונו). זמן כל טוקן = פריים × 80ms — כמו window_step × subsampling ב־onnx_asr */
    fun transcribe(wav: FloatArray): Res { val o = recognize(wav); return Res(vocab.text(o.tokens), o.tokens.size, o.n) }

    /** הטוקנים, הפריים של כל אחד (זמן = פריים × 0.08, ‏timestamps של onnx_asr) ומספר הפריימים — לתמלול בטלפון */
    class Rec(val tokens: List<Int>, val idx: List<Int>, val n: Int)

    /** [feats] (אופציונלי) = המאפיינים מבחוץ, (128 × T בשורות, האורך האמיתי) — בטלפון NemoMel, כמו onnx_asr על מעבד */
    fun recognize(wav: FloatArray, feats: ((FloatArray) -> Pair<FloatArray, Int>)? = null): Rec {
        val env = Ort.env
        if (feats != null) {
            val (f, n) = feats(wav)
            val t = f.size / 128
            Ort.floats(f, 1, 128, t.toLong()).use { x ->
                OnnxTensor.createTensor(env, LongBuffer.wrap(longArrayOf(n.toLong())), longArrayOf(1)).use { l -> return encode(x, l) }
            }
        }
        Ort.floats(wav, 1, wav.size.toLong()).use { w ->
            OnnxTensor.createTensor(env, LongBuffer.wrap(longArrayOf(wav.size.toLong())), longArrayOf(1)).use { wl ->
                pre.run(mapOf("waveforms" to w, "waveforms_lens" to wl)).use { p ->
                    return encode(p.get("features").get() as OnnxTensor, p.get("features_lens").get() as OnnxTensor)
                }
            }
        }
    }

    private fun encode(feats: OnnxTensor, flen: OnnxTensor): Rec {
        enc.run(mapOf("audio_signal" to feats, "length" to flen)).use { e ->
            val out = e.get("outputs").get() as OnnxTensor            // (1, 1024, T')
            val n = (e.get("encoded_lengths").get() as OnnxTensor).longBuffer.get(0).toInt()
            val tFull = out.info.shape[2].toInt()
            val d = out.info.shape[1].toInt()
            val buf = out.floatBuffer
            val all = FloatArray(buf.remaining()); buf.get(all)
            return decode(all, d, tFull, minOf(n, tFull))
        }
    }

    private fun decode(all: FloatArray, d: Int, tFull: Int, frames: Int): Rec {
        val env = Ort.env
        val v = vocab.size
        val frame = FloatArray(d)
        val zero = FloatArray(2 * 640)
        val st0 = Pair(zero.copyOf(), zero.copyOf())
        val r = Tdt.greedy(frames, vocab.blank, maxPerStep, st0) { t, prev, st ->
            for (c in 0 until d) frame[c] = all[c * tFull + t]
            Ort.floats(frame, 1, d.toLong(), 1).use { x ->
                OnnxTensor.createTensor(env, IntBuffer.wrap(intArrayOf(prev)), longArrayOf(1, 1)).use { tg ->
                    OnnxTensor.createTensor(env, IntBuffer.wrap(intArrayOf(1)), longArrayOf(1)).use { tl ->
                        Ort.floats(st.first, 2, 1, 640).use { s1 ->
                            Ort.floats(st.second, 2, 1, 640).use { s2 ->
                                dec.run(mapOf("encoder_outputs" to x, "targets" to tg, "target_length" to tl,
                                    "input_states_1" to s1, "input_states_2" to s2)).use { o ->
                                    val ob = (o.get("outputs").get() as OnnxTensor).floatBuffer
                                    val logits = FloatArray(ob.remaining()); ob.get(logits)
                                    val n1 = (o.get("output_states_1").get() as OnnxTensor).floatBuffer
                                    val n2 = (o.get("output_states_2").get() as OnnxTensor).floatBuffer
                                    val a = FloatArray(n1.remaining()); n1.get(a)
                                    val b = FloatArray(n2.remaining()); n2.get(b)
                                    // [0, v) = טוקנים, [v, …) = משכי הצעד (0..4) — argmax הוא המשך עצמו
                                    Triple(logits.copyOfRange(0, v), Tdt.argmax(logits, v, logits.size), Pair(a, b))
                                }
                            }
                        }
                    }
                }
            }
        }
        return Rec(r.tokens, r.frames, frames)
    }

    override fun close() { if (preL.isInitialized()) pre.close(); enc.close(); dec.close() }
}

/**
 * Qwen3-ForcedAligner (INT8) — הגרפים של translator/aligner_export.py. לשלב 0 (מדידה) הטקסט סינתטי: כמה טוקנים
 * כמו בדיבור רגיל (‏[textTokPerSec] לשנייה), כי זמן המפענח והזיכרון תלויים רק באורך הרצף. המל = whisper128 של onnx_asr
 * (128 ערוצים, 100 פריימים לשנייה — כמו המעבד של Qwen).
 */
class QwenAlign(dir: File, mel: File, threads: Int, arena: Boolean) : Closeable {
    private val melS = Ort.session(mel, threads, arena)
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

    class Res(val audioTokens: Int, val seqLen: Int, val melMs: Long, val encMs: Long, val decMs: Long)

    fun run(wav: FloatArray, textTokens: Int, seed: Long = 1): Res {
        val t0 = System.nanoTime()
        val m = melOf(wav)                       // (128, T)
        val tMel = m.size / 128
        val t1 = System.nanoTime()
        val af = audioFeatures(m, tMel)          // (A, 1024)
        val a = af.size / d
        val t2 = System.nanoTime()
        // רצף: 8 טוקנים בהתחלה, האודיו, ואז הטקסט (מילים + חותמות זמן) — מזהים אמיתיים מהמילון, בלי משמעות
        val rnd = java.util.Random(seed)
        val pre = 8
        val l = pre + a + textTokens
        val e = FloatArray(l * d)
        for (i in 0 until pre) row(rnd.nextInt(150000), e, i)
        System.arraycopy(af, 0, e, pre * d, a * d)
        for (i in 0 until textTokens) row(rnd.nextInt(150000), e, pre + a + i)
        Ort.floats(e, 1, l.toLong(), d.toLong()).use { x -> dec.run(mapOf("e" to x)).use { } }
        val t3 = System.nanoTime()
        return Res(a, l, (t1 - t0) / 1_000_000, (t2 - t1) / 1_000_000, (t3 - t2) / 1_000_000)
    }

    private fun row(id: Int, out: FloatArray, at: Int) {
        val base = embNpy.dataOffset + id.toLong() * d * 2
        for (c in 0 until d) out[at * d + c] = Npy.half(emb.getShort((base + c * 2).toInt()).toInt() and 0xffff)
    }

    /** whisper128 מרפד וגם **חותך** ל־30 שנ׳ (3000 פריימים) — לכן חתיכות של 30 שנ׳ ומחברים (המל זניח בזמן ובזיכרון) */
    private fun melOf(wav: FloatArray): FloatArray {
        val piece = 30 * 16000
        val total = (wav.size + 159) / 160
        val out = FloatArray(128 * total)
        var at = 0
        var p = 0
        while (p < wav.size && at < total) {
            val seg = wav.copyOfRange(p, minOf(wav.size, p + piece))
            val got = melPiece(seg)
            val t = minOf(got.size / 128, (seg.size + 159) / 160, total - at)
            val tp = got.size / 128
            for (c in 0 until 128) System.arraycopy(got, c * tp, out, c * total + at, t)
            at += t; p += piece
        }
        return out
    }

    private fun melPiece(wav: FloatArray): FloatArray {
        val env = Ort.env
        Ort.floats(wav, 1, wav.size.toLong()).use { w ->
            OnnxTensor.createTensor(env, LongBuffer.wrap(longArrayOf(wav.size.toLong())), longArrayOf(1)).use { wl ->
                melS.run(mapOf("waveforms" to w, "waveforms_lens" to wl)).use { r ->
                    val f = r.get("features").get() as OnnxTensor   // (1, 128, 3000)
                    val all = FloatArray(f.floatBuffer.remaining()); f.floatBuffer.get(all)
                    return all
                }
            }
        }
    }

    /** (128, T) → (T', 1024), בדיוק כמו audio_features ב־align_onnx.py */
    private fun audioFeatures(mel: FloatArray, tMel: Int): FloatArray {
        val k = (tMel + 99) / 100
        val pad = FloatArray(k * 128 * 100)
        val lens = IntArray(k)
        for (i in 0 until k) {
            val w = minOf(100, tMel - i * 100)
            for (c in 0 until 128) System.arraycopy(mel, c * tMel + i * 100, pad, (i * 128 + c) * 100, w)
            lens[i] = QwenLen.outLen(w)
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
        require(total == QwenLen.outLen(tMel)) { "qwen_len:$total" }
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

    override fun close() { melS.close(); conv.close(); enc.close(); dec.close(); embRaf.close() }
}
