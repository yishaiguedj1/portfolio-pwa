package io.github.yishaiguedj1.snowball.lab

import android.content.Context
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.DataInputStream
import java.io.EOFException
import java.io.File

/**
 * Studio Lab גרסה 3 (24/10/2026): צריבה במקודד החומרה של אנדרואיד, בלי המקודד של ffmpeg.
 * ב־ffmpeg (תהליך נפרד, בלי JVM) כל ‎*_mediacodec‎ נכשל ב־"Could not open encoder" — לכן ffmpeg רק מפענח וצורב את
 * הכתוביות (libass) ומוציא פריימים גולמיים (nv12) בצינור, ו־MediaCodec בתוך האפליקציה מקודד ל־MP4 (MediaMuxer).
 * זה גם המסלול שייבנה בפועל אם הוא מהיר.
 */
object LabCodec {
    class Res(val ok: Boolean, val ms: Long, val frames: Int, val bytes: Long, val codec: String?, val err: String?)

    /** שם המקודד שהמערכת בוחרת לסוג הזה (חומרה קודם), או null */
    fun encoderFor(mime: String, w: Int, h: Int): String? {
        val f = MediaFormat.createVideoFormat(mime, w, h)
        f.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
        return try { MediaCodecList(MediaCodecList.REGULAR_CODECS).findEncoderForFormat(f) } catch (e: Throwable) { null }
    }

    fun burn(ctx: Context, input: File, vf: String, sec: Double, w0: Int, h0: Int, fps: Double, mime: String, bitrate: Int,
             out: File, errFile: File, stop: () -> Boolean): Res {
        val w = w0 and 1.inv(); val h = h0 and 1.inv()
        val name = encoderFor(mime, w, h) ?: return Res(false, 0, 0, 0, null, "אין מקודד ל־$mime ב־${w}x$h")
        val fmt = MediaFormat.createVideoFormat(mime, w, h).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
            setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
            setFloat(MediaFormat.KEY_FRAME_RATE, fps.toFloat())
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
        }
        val t0 = System.nanoTime()
        val codec = try { MediaCodec.createByCodecName(name).apply { configure(fmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE); start() } }
            catch (e: Throwable) { return Res(false, 0, 0, 0, name, "configure: ${e.javaClass.simpleName} ${e.message?.take(120)}") }
        out.delete()
        val mux = MediaMuxer(out.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var track = -1; var frames = 0; var outBytes = 0L; var eosOut = false
        val info = MediaCodec.BufferInfo()
        fun drain(wait: Long) {
            while (true) {
                val i = codec.dequeueOutputBuffer(info, wait)
                when {
                    i == MediaCodec.INFO_TRY_AGAIN_LATER -> return
                    i == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> { track = mux.addTrack(codec.outputFormat); mux.start() }
                    i >= 0 -> {
                        val b = codec.getOutputBuffer(i)!!
                        if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0 && info.size > 0 && track >= 0) {
                            b.position(info.offset); b.limit(info.offset + info.size)
                            mux.writeSampleData(track, b, info); outBytes += info.size
                        }
                        codec.releaseOutputBuffer(i, false)
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) { eosOut = true; return }
                    }
                }
            }
        }
        val p = LabFf.spawn(ctx, listOf("-hide_banner", "-nostdin", "-loglevel", "error", "-t", Fmt.n(sec, 0), "-i", input.absolutePath,
            "-vf", "$vf,scale=$w:$h,format=nv12", "-an", "-f", "rawvideo", "-pix_fmt", "nv12", "pipe:1"), errFile)
        val frame = ByteArray(w * h * 3 / 2)
        var err: String? = null
        try {
            DataInputStream(p.inputStream.buffered(1 shl 22)).use { din ->
                while (true) {
                    if (stop()) error("stopped")
                    try { din.readFully(frame) } catch (e: EOFException) { break }
                    var idx: Int
                    do { idx = codec.dequeueInputBuffer(10_000); if (idx < 0) drain(0) } while (idx < 0)
                    val img = codec.getInputImage(idx)!!
                    putNv12(img, frame, w, h)
                    codec.queueInputBuffer(idx, 0, frame.size, (frames * 1_000_000.0 / fps).toLong(), 0)
                    frames++
                    drain(0)
                }
            }
            var idx: Int
            do { idx = codec.dequeueInputBuffer(10_000); if (idx < 0) drain(0) } while (idx < 0)
            codec.queueInputBuffer(idx, 0, 0, (frames * 1_000_000.0 / fps).toLong(), MediaCodec.BUFFER_FLAG_END_OF_STREAM)
            val until = System.nanoTime() + 10_000_000_000L
            while (!eosOut && System.nanoTime() < until) drain(10_000)
        } catch (e: Throwable) {
            err = "${e.javaClass.simpleName} ${e.message?.take(120)}"
        } finally {
            p.destroy(); p.waitFor()
            try { codec.stop() } catch (_: Throwable) {}
            codec.release()
            try { if (track >= 0) mux.stop() } catch (_: Throwable) {}
            mux.release()
        }
        val ms = (System.nanoTime() - t0) / 1_000_000
        if (err == null && frames == 0) err = "ffmpeg: " + (errFile.takeIf { it.isFile }?.readText()?.trim()?.lines()?.lastOrNull()?.take(160) ?: "בלי פריימים")
        return Res(err == null && outBytes > 0, ms, frames, out.length(), name, err)
    }

    /** NV12 (Y, ואז UV שזורים) לתוך Image של המקודד — כל pixelStride/rowStride; UV שזור (כמו NV12) מועתק בשורות שלמות */
    private fun putNv12(img: android.media.Image, src: ByteArray, w: Int, h: Int) {
        val pl = img.planes
        val y = pl[0].buffer; val yrs = pl[0].rowStride
        if (yrs == w) { y.position(0); y.put(src, 0, w * h) }
        else for (r in 0 until h) { y.position(r * yrs); y.put(src, r * w, w) }
        val u = pl[1].buffer; val v = pl[2].buffer; val rs = pl[1].rowStride; val ps = pl[1].pixelStride
        val cw = w / 2; val ch = h / 2; val base = w * h
        // UV שזור בסדר של NV12 = ‏V מתחיל בית אחד אחרי U: בודקים בכתיבה (כתובות לא נגישות מ־Java)
        var nv12 = false
        if (ps == 2 && pl[2].pixelStride == 2) { u.put(0, 1); v.put(0, 2); nv12 = u.get(1) == 2.toByte() }
        if (nv12) {
            for (r in 0 until ch) {
                val n = minOf(w, u.limit() - r * rs)
                u.position(r * rs); u.put(src, base + r * w, n)
                if (n < w) v.put(r * rs + w - 2, src[base + r * w + w - 1])
            }
        } else {
            val vrs = pl[2].rowStride; val vps = pl[2].pixelStride
            for (r in 0 until ch) for (c in 0 until cw) {
                u.put(r * rs + c * ps, src[base + r * w + c * 2])
                v.put(r * vrs + c * vps, src[base + r * w + c * 2 + 1])
            }
        }
    }
}
