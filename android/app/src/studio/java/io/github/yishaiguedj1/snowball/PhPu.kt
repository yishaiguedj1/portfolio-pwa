package io.github.yishaiguedj1.snowball

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import android.os.ParcelFileDescriptor
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Locale

/**
 * 1/11/2026 (בקשת המשתמש — "תרגום רגיל בשרת, הסרטון עולה דרך האפליקציה"; spec.pu): האפליקציה רק מעלה. הסרטון נקרא
 * במקומו (URI עם הרשאה קבועה — takePersistableUriPermission), בלי עותק של כמה GB ובלי לחכות להעתקה. הקול — MediaExtractor
 * ו־MediaMuxer של המערכת (בלי קידוד, כמו extractAudio באתר: AAC → MP4, ‏Opus/Vorbis → WebM); קודק אחר — בלי קול, והשרת
 * מתחיל מהסרטון. הכל אחר (התמלול, השוטים, הצריבה) — בשרת, כמו בעבודה רגילה.
 */
object PhPu {
    /** הסרטון במקומו. כל open = זרם חדש מה־URI, מוזז ל־off (קובץ מקומי — channel.position; ספק שנותן צינור — skip) */
    class UriSrc(private val ctx: Context, private val uri: Uri, override val size: Long) : PhNet.Src {
        override fun open(off: Long): InputStream {
            val pfd = ctx.contentResolver.openFileDescriptor(uri, "r") ?: throw IOException("uri")
            val s = ParcelFileDescriptor.AutoCloseInputStream(pfd)
            val moved = try { s.channel.position(off); s.channel.position() == off } catch (e: Throwable) { false }
            if (!moved && off > 0) {
                var left = off
                while (left > 0) { val k = s.skip(left); if (k <= 0) { s.close(); throw IOException("skip") }; left -= k }
            }
            return s
        }
    }

    /** הרשומה → המקור. ההרשאה בוטלה / הקובץ נמחק — Stop("src_gone") (קבוע, לא מנסים שוב) */
    fun src(ctx: Context, r: JSONObject): UriSrc {
        val u = try { Uri.parse(r.optString("uri")) } catch (e: Throwable) { null }
        if (u == null || u.scheme != "content") throw PhWork.Stop("src_gone")
        val s = UriSrc(ctx, u, r.optLong("size"))
        try { s.open(0).close() } catch (e: Throwable) { throw PhWork.Stop("src_gone") }
        return s
    }

    /** מה שהטופס צריך (pickJson): האורך, המידות, הקצב, יש קול. בלי ffprobe — MediaExtractor על ה־URI */
    fun probe(ctx: Context, uri: Uri): PhCore.Info? {
        val ex = MediaExtractor()
        return try {
            ex.setDataSource(ctx, uri, null)
            var v: MediaFormat? = null; var a: MediaFormat? = null
            for (i in 0 until ex.trackCount) {
                val f = ex.getTrackFormat(i); val m = f.getString(MediaFormat.KEY_MIME) ?: continue
                if (v == null && m.startsWith("video/")) v = f
                if (a == null && m.startsWith("audio/")) a = f
            }
            v ?: return null
            var w = v.intOr(MediaFormat.KEY_WIDTH); var h = v.intOr(MediaFormat.KEY_HEIGHT)
            val rot = v.intOr("rotation-degrees")
            if (rot == 90 || rot == 270) { val t = w; w = h; h = t }
            if (w < 16 || h < 16) return null
            val fps = v.intOr(MediaFormat.KEY_FRAME_RATE).takeIf { it in 1..240 }?.toLong() ?: 25L
            val us = maxOf(v.longOr(MediaFormat.KEY_DURATION), a?.longOr(MediaFormat.KEY_DURATION) ?: 0L)
            PhCore.Info(w, h, fps, 1L, us / 1e6, 0.0, 0.0, 0.0, a?.getString(MediaFormat.KEY_MIME) ?: "", a != null)
        } catch (e: Throwable) { null } finally { try { ex.release() } catch (e: Throwable) {} }
    }

    /** טביעת האצבע של OpenSubtitles (= PhCore.osHash, = studionet.js osHash) מה־URI — 64KB מההתחלה ו־64KB מהסוף */
    fun osHash(s: PhNet.Src): String {
        val size = s.size
        if (size < CH) return ""
        var h = size
        val b = ByteArray(CH)
        for (at in longArrayOf(0, size - CH)) {
            s.open(at).use { i -> var got = 0; while (got < CH) { val k = i.read(b, got, CH - got); if (k < 0) return ""; got += k } }
            val bb = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN)
            while (bb.remaining() >= 8) h += bb.long
        }
        return String.format(Locale.ROOT, "%016x", h)
    }
    private const val CH = 65536

    class Audio(val f: File, val mime: String)

    /** הקול כמו שהוא (העתקה של הדגימות, בלי קידוד). null = אין קול / קודק ש־MediaMuxer לא מקבל / תקלה — השרת יתחיל
     *  מהסרטון. progress = 0–1 לפי הזמן */
    fun audio(ctx: Context, uri: Uri, work: File, stopped: () -> Boolean, progress: (Float) -> Unit): Audio? {
        val ex = MediaExtractor()
        var mx: MediaMuxer? = null
        var out: File? = null
        try {
            ex.setDataSource(ctx, uri, null)
            var ti = -1; var fmt: MediaFormat? = null
            for (i in 0 until ex.trackCount) {
                val f = ex.getTrackFormat(i)
                if ((f.getString(MediaFormat.KEY_MIME) ?: "").startsWith("audio/")) { ti = i; fmt = f; break }
            }
            if (ti < 0 || fmt == null) return null
            val (kind, ext, mime) = when (fmt.getString(MediaFormat.KEY_MIME)) {
                MediaFormat.MIMETYPE_AUDIO_AAC -> Triple(MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4, "m4a", "audio/mp4")
                MediaFormat.MIMETYPE_AUDIO_OPUS, MediaFormat.MIMETYPE_AUDIO_VORBIS -> Triple(MediaMuxer.OutputFormat.MUXER_OUTPUT_WEBM, "webm", "audio/webm")
                else -> return null
            }
            val dur = maxOf(1L, fmt.longOr(MediaFormat.KEY_DURATION))
            ex.selectTrack(ti)
            out = File(work, "audio.$ext").apply { delete() }
            mx = MediaMuxer(out.absolutePath, kind)
            val t = mx.addTrack(fmt)
            mx.start()
            val buf = ByteBuffer.allocateDirect(maxOf(1 shl 20, fmt.intOr(MediaFormat.KEY_MAX_INPUT_SIZE)))
            val info = MediaCodec.BufferInfo()
            /* 09/11/2026 (פרק של 22 דק׳: התמלול 16 דק׳, 69 מילים במקום ~2,500): ב־MKV עם lacing ‏MatroskaExtractor נותן
               לכל המסגרות של בלוק את אותה חותמת (blockTimeUs), ו־MediaMuxer כותב אותן כך (משך 0). בשרת aresample=async
               השמיט דגימות והקול יצא שבור. לכן מסגרות באותה חותמת נאספות, ונכתבות מפוזרות עד החותמת של הבלוק הבא.
               מסגרת עם חותמת משלה (MP4, MKV בלי lacing) — נכתבת בדיוק בחותמת שלה, כמו קודם. */
            val sr = fmt.intOr(MediaFormat.KEY_SAMPLE_RATE).takeIf { it > 0 } ?: 48000
            val frameUs = 1024L * 1_000_000L / sr
            val pend = ArrayList<Pair<ByteArray, Int>>()
            var bTs = -1L; var step = frameUs
            fun flush(next: Long) {
                if (pend.isEmpty()) return
                if (next > bTs) step = minOf((next - bTs) / pend.size, 3 * frameUs).coerceAtLeast(1L)
                for ((k, p) in pend.withIndex()) {
                    buf.clear(); buf.put(p.first); buf.flip()
                    info.set(0, p.first.size, maxOf(0L, bTs + k * step), p.second)
                    mx.writeSampleData(t, buf, info)
                }
                pend.clear()
            }
            var t0 = -1L; var last = 0L
            while (true) {
                if (stopped()) { mx.stop(); out.delete(); return null }
                val n = ex.readSampleData(buf, 0)
                if (n < 0) break
                val ts = ex.sampleTime
                if (t0 < 0) t0 = ts
                if (ts != bTs) { flush(ts); bTs = ts }
                val b = ByteArray(n); buf.position(0); buf.get(b, 0, n)
                pend.add(b to if (ex.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0)
                ex.advance()
                val now = System.currentTimeMillis()
                if (now - last > 500) { last = now; progress(((ts - t0).toFloat() / dur).coerceIn(0f, 1f)) }
            }
            flush(-1L)
            mx.stop()
            return if (out.length() > 0) Audio(out, mime) else { out.delete(); null }
        } catch (e: Throwable) {
            android.util.Log.e("PhPu", "audio", e)
            out?.delete()
            return null
        } finally {
            try { mx?.release() } catch (e: Throwable) {}
            try { ex.release() } catch (e: Throwable) {}
        }
    }

    private fun MediaFormat.intOr(k: String): Int = try { if (containsKey(k)) getInteger(k) else 0 } catch (e: Throwable) { 0 }
    private fun MediaFormat.longOr(k: String): Long = try { if (containsKey(k)) getLong(k) else 0L } catch (e: Throwable) { 0L }
}
