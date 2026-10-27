package io.github.yishaiguedj1.snowball.lab

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * הליבה (labcore — ONNX Runtime ו־Parakeet של התרגום בטלפון; עד 27/10/2026 גם האפליקציה Studio Lab) מול השרת: הערכים כאן הם הפלט של onnx_asr 0.12.0 ושל translator/vt/align_onnx.py על אותם קלטים.
 * (המודלים עצמם נבדקו מקומית ב־JVM עם ONNX Runtime 1.30.0: התמלול של Parakeet זהה מילה במילה ל־onnx_asr.)
 */
class LabCoreTest {
    @Test fun ffmpegErrorsKeepTheReason() {
        val log = """
            Input #0, matroska,webm, from 'in.mkv':
              Stream #0:0: Video: av1 (libdav1d), yuv420p, 1920x1080
            [h264_mediacodec @ 0xb4] Use MediaCodec from NDK
            [h264_mediacodec @ 0xb4] Encoder configure failed, -10000
            frame=    0 fps=0.0 q=0.0 size=       0KiB time=N/A bitrate=N/A speed=N/A
            [vost#0:0/h264_mediacodec @ 0xc1] Error while opening encoder - maybe incorrect parameters such as bit_rate, rate, width or height
            [h264_mediacodec @ 0xb4] Encoder configure failed, -10000
            Conversion failed!
        """.trimIndent()
        val e = FfLine.errors(log, 6)
        assertEquals(listOf(
            "[h264_mediacodec @ 0xb4] Use MediaCodec from NDK",
            "[vost#0:0/h264_mediacodec @ 0xc1] Error while opening encoder - maybe incorrect parameters such as bit_rate, rate, width or height",
            "[h264_mediacodec @ 0xb4] Encoder configure failed, -10000",
            "Conversion failed!",
        ), e)
        assertEquals(2, FfLine.errors(log, 2).size)
        assertEquals(listOf("Use MediaCodec from NDK", "Encoder configure failed, -10000"), FfLine.own(log, "h264_mediacodec", 10))
    }

    @Test fun vocabDecodeLikeOnnxAsr() {
        val v = Vocab.parse("<unk> 0\n▁he 1\nllo 2\n▁wor 3\nld 4\n, 5\n<blk> 6\n")
        assertEquals(6, v.blank)
        assertEquals(7, v.size)
        // ▁ → רווח; רווח בתחילת הטקסט נמחק; פיסוק נדבק — כמו DECODE_SPACE_PATTERN
        assertEquals("hello, world", v.text(listOf(1, 2, 5, 3, 4)))
        assertEquals("world", v.text(listOf(3, 4)))
    }

    @Test fun tdtGreedyStepsLikeOnnxAsr() {
        // מפענח מדומה: בפריים 0 — טוקן 2 עם צעד 0, ואז blank עם צעד 2; בפריים 2 — טוקן 3 עם צעד 1
        val blank = 4
        val script = mapOf(
            Pair(0, blank) to (2 to 0), Pair(0, 2) to (blank to 2),
            Pair(2, 2) to (3 to 1), Pair(3, 3) to (blank to 0), Pair(4, 3) to (blank to 0),
        )
        val calls = ArrayList<Int>()
        val r = Tdt.greedy(5, blank, 10, 0) { t, prev, st ->
            calls += t
            val (tok, dur) = script[t to prev] ?: (blank to 0)
            val lg = FloatArray(5) { if (it == tok) 1f else 0f }
            Triple(lg, dur, st + 1)
        }
        assertEquals(listOf(2, 3), r.tokens)
        assertEquals(listOf(0, 2), r.frames)
        assertEquals(listOf(0, 0, 2, 3, 4), calls)
    }

    @Test fun tdtMaxTokensPerStep() {
        // מפענח שתמיד פולט טוקן עם צעד 0 — אחרי maxPerStep מתקדמים פריים בכוח (בלי לולאה אינסופית)
        val r = Tdt.greedy(3, 9, 2, 0) { _, _, s -> Triple(FloatArray(10) { if (it == 1) 1f else 0f }, 0, s) }
        assertEquals(6, r.tokens.size)
        assertEquals(listOf(0, 0, 1, 1, 2, 2), r.frames)
    }

    @Test fun argmaxRange() {
        val a = floatArrayOf(5f, 0f, 1f, 3f, 2f)
        assertEquals(0, Tdt.argmax(a))
        assertEquals(1, Tdt.argmax(a, 2, 5))   // בתוך [2,5): ‏3 במקום 1
    }

    @Test fun qwenOutLenLikeAlignOnnx() {
        // python: from vt.align_onnx import out_len
        val want = mapOf(1 to 1, 2 to 1, 7 to 1, 8 to 1, 29 to 4, 99 to 13, 100 to 13, 101 to 14, 200 to 26, 2029 to 264, 9000 to 1170)
        for ((n, w) in want) assertEquals("out_len($n)", w, QwenLen.outLen(n))
    }

    @Test fun npyHeader() {
        val h = "{'descr': '<f2', 'fortran_order': False, 'shape': (152064, 1024), }"
        val pad = (64 - (10 + h.length + 1) % 64) % 64
        val head = h + " ".repeat(pad) + "\n"
        val b = ByteBuffer.allocate(10 + head.length).order(ByteOrder.LITTLE_ENDIAN)
        b.put(0x93.toByte()); b.put("NUMPY".toByteArray()); b.put(1); b.put(0); b.putShort(head.length.toShort()); b.put(head.toByteArray())
        val n = Npy.parse(b.array())
        assertEquals("<f2", n.dtype)
        assertEquals(listOf(152064L, 1024L), n.shape)
        assertEquals((10 + head.length).toLong(), n.dataOffset)
        assertEquals(0L, n.dataOffset % 64)
        assertEquals(1024L, n.rowLen)
        assertEquals(2, n.itemSize)
    }

    @Test fun halfFloat() {
        assertEquals(1f, Npy.half(0x3c00), 0f)
        assertEquals(-2f, Npy.half(0xc000), 0f)
        assertEquals(0.5f, Npy.half(0x3800), 0f)
        assertEquals(65504f, Npy.half(0x7bff), 0f)
        assertEquals(0f, Npy.half(0), 0f)
        assertEquals(5.9604645e-8f, Npy.half(0x0001), 1e-12f)   // תת־נורמלי
    }

    @Test fun ffmpegProgressAndInfo() {
        val p = FfLine.parse("frame= 1800 fps=124 q=-0.0 size=   20480KiB time=00:01:02.34 bitrate=2690.1kbits/s speed=4.15x")!!
        assertEquals(62.34, p.sec!!, 1e-9)
        assertEquals(4.15, p.speed!!, 1e-9)
        assertEquals(124.0, p.fps!!, 1e-9)
        assertEquals(null, FfLine.parse("Stream mapping:"))
        val info = """
            Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'in.mp4':
              Duration: 01:02:03.45, start: 0.000000, bitrate: 2210 kb/s
              Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1920x1080 [SAR 1:1 DAR 16:9], 2081 kb/s, 29.97 fps, 29.97 tbr
        """.trimIndent()
        assertEquals(3723.45, FfLine.duration(info)!!, 1e-9)
        val v = FfLine.video(info)!!
        assertEquals("h264", v.first)
        assertEquals(1920 to 1080, v.second)
        assertEquals(29.97, v.third!!, 1e-9)
        val enc = " V....D h264_mediacodec      H.264 Android MediaCodec encoder (codec h264)\n V....D libx264              libx264 H.264\n A....D aac                  AAC\n"
        assertEquals(listOf("h264_mediacodec", "libx264"), FfLine.encoders(enc, listOf("hevc_mediacodec", "h264_mediacodec", "libx264", "aac")))
    }

    @Test fun wavReadsRangeAndStreamedLength() {
        val f = File.createTempFile("lab", ".wav")
        try {
            val n = 16000 * 3
            val bb = ByteBuffer.allocate(44 + n * 2).order(ByteOrder.LITTLE_ENDIAN)
            bb.put("RIFF".toByteArray()); bb.putInt(-1); bb.put("WAVE".toByteArray())
            bb.put("fmt ".toByteArray()); bb.putInt(16); bb.putShort(1); bb.putShort(1); bb.putInt(16000); bb.putInt(32000); bb.putShort(2); bb.putShort(16)
            bb.put("data".toByteArray()); bb.putInt(-1)   // ffmpeg בזרם: אורך לא ידוע
            for (i in 0 until n) bb.putShort((i % 1000).toShort())
            f.writeBytes(bb.array())
            val inf = Wav.info(f)
            assertEquals(3.0, inf.seconds, 1e-9)
            val a = Wav.read(f, 1.0, 0.5)
            assertEquals(8000, a.size)
            assertEquals((16000 % 1000) / 32768f, a[0], 1e-7f)
            assertEquals(16000 * 2, Wav.read(f, 1.0).size)
        } finally { f.delete() }
    }

    @Test fun windows() {
        assertEquals(listOf(0.0 to 30.0, 30.0 to 60.0, 60.0 to 70.0), Win.of(70.0, 30.0))
        assertEquals(emptyList<Pair<Double, Double>>(), Win.of(0.0, 30.0))
    }

    @Test fun testAssIsHebrewAndCoversTime() {
        val a = TestAss.build(10.0, "Assistant SemiBold", 1920, 1080)
        assertTrue(a.contains("Style: Default,Assistant SemiBold,"))
        assertEquals(5, Regex("^Dialogue:", RegexOption.MULTILINE).findAll(a).count())
        assertTrue(a.contains("0:00:08.00,0:00:09.80"))
        assertTrue(a.contains("צריבת כתוביות"))
    }

    @Test fun fmtIsLocaleFree() {
        assertEquals("12.5", Fmt.n(12.49, 1))
        assertEquals("1:02:03", Fmt.dur(3723.4))
        assertEquals("10.0 min/h", Fmt.perHour(100.0, 600.0))
    }
}
