package io.github.yishaiguedj1.snowball.lab

import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Locale

/**
 * Studio Lab — הליבה בלי אנדרואיד (24/10/2026, "תרגום סרטונים בטלפון", שלב 0 = מדידה).
 * כל מה שאפשר לבדוק ב־JVM: מילון Parakeet, פענוח TDT, קבצי npy, אורך הפלט של Qwen, פענוח השורות של ffmpeg,
 * קריאת WAV, וחלוקה לחלונות. אותו היגיון של השרת (onnx_asr 0.12.0, ‏translator/vt/align_onnx.py) — לא להמציא אחר.
 */

/** vocab.txt של onnx_asr: "<טוקן> <מספר>" בכל שורה, ▁ = רווח. הפענוח לטקסט = _AsrWithDecoding._decode_tokens */
class Vocab(val tokens: Map<Int, String>) {
    val size = tokens.size
    val blank: Int = tokens.entries.firstOrNull { it.value == "<blk>" }?.key ?: (size - 1)

    fun text(ids: List<Int>): String {
        val s = ids.joinToString("") { tokens[it] ?: "" }
        // DECODE_SPACE_PATTERN = r"\A\s|\s\B|(\s)\b" → רווח רק כשהוא לפני תחילת מילה
        return SPACE.replace(s) { m -> if (m.groups[1] != null) " " else "" }
    }

    companion object {
        private val SPACE = Regex("""\A\s|\s\B|(\s)\b""")
        fun parse(text: String): Vocab {
            val m = LinkedHashMap<Int, String>()
            for (line in text.split('\n')) {
                if (line.isEmpty()) continue
                val i = line.lastIndexOf(' ')
                if (i <= 0) continue
                m[line.substring(i + 1).trim().toInt()] = line.substring(0, i).replace('▁', ' ')
            }
            return Vocab(m)
        }
    }
}

/**
 * פענוח TDT חמדני — אחד לאחד כמו _AsrWithTransducerDecoding._decoding של onnx_asr:
 * בכל פריים קריאה למפענח; טוקן שאינו blank נכנס (והמצב מתקדם), ואז מדלגים לפי משך הצעד, או פריים אחד אחרי blank /
 * אחרי maxPerStep טוקנים. [step] = (פריים, הטוקן הקודם או blank, מצב) → (לוגיטים של הטוקנים, משך הצעד, מצב חדש).
 */
object Tdt {
    class Out(val tokens: List<Int>, val frames: List<Int>)

    fun <S> greedy(frames: Int, blank: Int, maxPerStep: Int, init: S, step: (t: Int, prev: Int, state: S) -> Triple<FloatArray, Int, S>): Out {
        val tokens = ArrayList<Int>()
        val idx = ArrayList<Int>()
        var state = init
        var t = 0
        var emitted = 0
        while (t < frames) {
            val (logits, dur, next) = step(t, tokens.lastOrNull() ?: blank, state)
            val tok = argmax(logits)
            if (tok != blank) {
                state = next
                tokens += tok; idx += t
                emitted++
            }
            if (dur > 0) { t += dur; emitted = 0 }
            else if (tok == blank || emitted == maxPerStep) { t += 1; emitted = 0 }
        }
        return Out(tokens, idx)
    }

    fun argmax(a: FloatArray, from: Int = 0, to: Int = a.size): Int {
        var best = from
        for (i in from + 1 until to) if (a[i] > a[best]) best = i
        return best - from
    }
}

/** קובץ ‎.npy (גרסה 1/2, little-endian, ‏C order): הכותרת והמקום שבו הנתונים מתחילים — לקריאה במקום (mmap) */
class Npy(val dtype: String, val shape: List<Long>, val dataOffset: Long) {
    val rowLen: Long get() = if (shape.size > 1) shape.drop(1).fold(1L) { a, b -> a * b } else 1L
    val itemSize: Int get() = when (dtype) { "<f2" -> 2; "<f4" -> 4; "<i8" -> 8; "<i4" -> 4; else -> error("npy_dtype:$dtype") }

    companion object {
        fun parse(head: ByteArray): Npy {
            require(head.size >= 10 && head[0] == 0x93.toByte() && String(head, 1, 5, Charsets.ISO_8859_1) == "NUMPY") { "npy_magic" }
            val major = head[6].toInt()
            val bb = ByteBuffer.wrap(head).order(ByteOrder.LITTLE_ENDIAN)
            val (hlen, start) = if (major == 1) (bb.getShort(8).toInt() and 0xffff) to 10 else bb.getInt(8) to 12
            require(head.size >= start + hlen) { "npy_short" }
            val h = String(head, start, hlen, Charsets.ISO_8859_1)
            val descr = Regex("""'descr':\s*'([^']+)'""").find(h)?.groupValues?.get(1) ?: error("npy_descr")
            require(!Regex("""'fortran_order':\s*True""").containsMatchIn(h)) { "npy_fortran" }
            val shp = Regex("""'shape':\s*\(([^)]*)\)""").find(h)?.groupValues?.get(1) ?: error("npy_shape")
            val dims = shp.split(',').map { it.trim() }.filter { it.isNotEmpty() }.map { it.toLong() }
            return Npy(descr, dims, (start + hlen).toLong())
        }

        fun parse(f: File): Npy = RandomAccessFile(f, "r").use { r ->
            val b = ByteArray(minOf(4096L, r.length()).toInt()); r.readFully(b); parse(b)
        }

        /** float16 (IEEE half) → float */
        fun half(h: Int): Float {
            val s = (h shr 15) and 1
            val e = (h shr 10) and 0x1f
            val m = h and 0x3ff
            val v = when (e) {
                0 -> m / 1024f * Math.pow(2.0, -14.0).toFloat()
                31 -> if (m == 0) Float.POSITIVE_INFINITY else Float.NaN
                else -> (1 + m / 1024f) * Math.pow(2.0, (e - 15).toDouble()).toFloat()
            }
            return if (s == 1) -v else v
        }
    }
}

/** Qwen3-ForcedAligner: אורך אחרי שלוש הקונבולוציות (‏100 פריימי מל → 13) — out_len ב־align_onnx.py */
object QwenLen {
    fun outLen(n: Int): Int {
        val r = n % 100
        val f = (r - 1).floorDiv(2) + 1
        return ((f - 1).floorDiv(2) + 1 - 1).floorDiv(2) + 1 + (n / 100) * 13
    }
}

/** שורת ההתקדמות של ffmpeg ("frame= … fps= … time=00:01:02.34 … speed=2.3x") → (שניות במדיה, מהירות) */
object FfLine {
    private val TIME = Regex("""time=\s*(-?\d+):(\d+):(\d+(?:\.\d+)?)""")
    private val SPEED = Regex("""speed=\s*([\d.]+)x""")
    private val FPS = Regex("""fps=\s*([\d.]+)""")

    class P(val sec: Double?, val speed: Double?, val fps: Double?)

    fun parse(line: String): P? {
        val t = TIME.find(line)
        val s = SPEED.find(line)
        if (t == null && s == null) return null
        val sec = t?.let { m -> m.groupValues[1].toDouble() * 3600 + m.groupValues[2].toDouble() * 60 + m.groupValues[3].toDouble() }
        return P(sec?.takeIf { it >= 0 }, s?.groupValues?.get(1)?.toDoubleOrNull(), FPS.find(line)?.groupValues?.get(1)?.toDoubleOrNull())
    }

    /** "Duration: 01:02:03.45" מהפלט של ffmpeg -i */
    fun duration(text: String): Double? = Regex("""Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)""").find(text)?.let { m ->
        m.groupValues[1].toDouble() * 3600 + m.groupValues[2].toDouble() * 60 + m.groupValues[3].toDouble()
    }

    /** "Video: h264 (High) …, 1920x1080 …, 29.97 fps" → (codec, רוחב, גובה, fps) */
    fun video(text: String): Triple<String, Pair<Int, Int>?, Double?>? {
        val l = text.lineSequence().firstOrNull { it.contains("Video:") } ?: return null
        val codec = Regex("""Video:\s*([A-Za-z0-9_]+)""").find(l)?.groupValues?.get(1) ?: "?"
        val wh = Regex("""\b(\d{2,5})x(\d{2,5})\b""").find(l)?.let { it.groupValues[1].toInt() to it.groupValues[2].toInt() }
        val fps = Regex("""([\d.]+) fps""").find(l)?.groupValues?.get(1)?.toDoubleOrNull()
        return Triple(codec, wh, fps)
    }

    /** הפלט של ffmpeg -encoders: אילו מקודדים קיימים מתוך הרשימה */
    fun encoders(text: String, want: List<String>): List<String> = want.filter { e -> Regex("""^\s*V\S*\s+$e\b""", RegexOption.MULTILINE).containsMatchIn(text) }

    private val ERR = Regex("""mediacodec|error|fail|invalid|unsupported|not supported|unable|could not|cannot|no such|denied""", RegexOption.IGNORE_CASE)
    private val NOISE = Regex("""^\s*(Stream #|Input #|Output #|Metadata:|Duration:|encoder\s*:|handler_name|vendor_id|Press \[q\])""")

    /** השורות שמסבירות כישלון (גם מ־‎-loglevel verbose): בלי התקדמות ובלי כפולים, האחרונות [n], עד 180 תווים כל אחת */
    fun errors(text: String, n: Int): List<String> {
        val seen = LinkedHashSet<String>()
        for (l in text.lineSequence()) {
            val t = l.trim()
            if (t.isEmpty() || parse(t) != null || NOISE.containsMatchIn(t) || !ERR.containsMatchIn(t)) continue
            seen.remove(t); seen.add(t.take(180))
        }
        return seen.toList().takeLast(n)
    }
}

/** WAV PCM 16-bit (מה ש־ffmpeg כותב עם ‎-ac 1 -ar 16000) → float ב־[-1,1]. רק הטווח שביקשו (שניות) */
object Wav {
    class Info(val rate: Int, val channels: Int, val dataStart: Long, val dataLen: Long) {
        val seconds: Double get() = dataLen / 2.0 / channels / rate
    }

    fun info(f: File): Info = RandomAccessFile(f, "r").use { r ->
        val h = ByteArray(12); r.readFully(h)
        require(String(h, 0, 4, Charsets.ISO_8859_1) == "RIFF" && String(h, 8, 4, Charsets.ISO_8859_1) == "WAVE") { "wav_magic" }
        var rate = 0; var ch = 0; var bits = 0
        while (r.filePointer + 8 <= r.length()) {
            val id = ByteArray(4); r.readFully(id)
            val lenB = ByteArray(4); r.readFully(lenB)
            var len = ByteBuffer.wrap(lenB).order(ByteOrder.LITTLE_ENDIAN).int.toLong() and 0xffffffffL
            val name = String(id, Charsets.ISO_8859_1)
            if (name == "fmt ") {
                val b = ByteArray(16); r.readFully(b)
                val bb = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN)
                require(bb.getShort(0).toInt() == 1) { "wav_not_pcm" }
                ch = bb.getShort(2).toInt(); rate = bb.getInt(4); bits = bb.getShort(14).toInt()
                r.seek(r.filePointer + len - 16 + (len and 1))
            } else if (name == "data") {
                require(bits == 16 && rate > 0 && ch > 0) { "wav_fmt" }
                // ffmpeg בזרם (pipe) כותב אורך 0xffffffff — אז עד סוף הקובץ
                if (len == 0xffffffffL || r.filePointer + len > r.length()) len = r.length() - r.filePointer
                return Info(rate, ch, r.filePointer, len)
            } else r.seek(r.filePointer + len + (len and 1))
        }
        error("wav_no_data")
    }

    fun read(f: File, fromSec: Double = 0.0, seconds: Double = Double.MAX_VALUE): FloatArray {
        val inf = info(f)
        require(inf.channels == 1) { "wav_mono" }
        val first = (fromSec * inf.rate).toLong().coerceAtLeast(0)
        val total = inf.dataLen / 2
        val n = minOf(total - first, (seconds * inf.rate).toLong().coerceAtLeast(0)).coerceAtLeast(0).toInt()
        val out = FloatArray(n)
        RandomAccessFile(f, "r").use { r ->
            r.seek(inf.dataStart + first * 2)
            val buf = ByteArray(1 shl 16)
            var i = 0
            while (i < n) {
                val want = minOf(buf.size, (n - i) * 2)
                r.readFully(buf, 0, want)
                val bb = ByteBuffer.wrap(buf, 0, want).order(ByteOrder.LITTLE_ENDIAN)
                while (bb.remaining() >= 2 && i < n) out[i++] = bb.short / 32768f
            }
        }
        return out
    }
}

/** חלונות קבועים של [win] שניות (כמו החלקים של היישור), האחרון קצר */
object Win {
    fun of(totalSec: Double, win: Double): List<Pair<Double, Double>> {
        val out = ArrayList<Pair<Double, Double>>()
        var a = 0.0
        while (a < totalSec - 1e-6) { val b = minOf(totalSec, a + win); out += a to b; a = b }
        return out
    }
}

/** מספרים בדוח — אנגלית בלבד (הדוח מודבק בצ'אט עם Claude), בלי לוקאל של הטלפון */
object Fmt {
    fun n(x: Double, d: Int = 1): String = String.format(Locale.US, "%.${d}f", x)
    fun mb(bytes: Long): String = n(bytes / 1048576.0, 0) + "MB"
    fun dur(sec: Double): String {
        val s = sec.toLong()
        return if (s >= 3600) String.format(Locale.US, "%d:%02d:%02d", s / 3600, (s / 60) % 60, s % 60)
        else String.format(Locale.US, "%d:%02d", s / 60, s % 60)
    }
    /** דקות עבודה לשעת אודיו: elapsed שניות על audio שניות */
    fun perHour(elapsed: Double, audio: Double): String = if (audio <= 0) "?" else n(elapsed / audio * 60.0, 1) + " min/h"
}

/** ה־ASS לבדיקת הצריבה: כתוביות בעברית (עם מספרים ואנגלית בתוכן) כל 2 שנ׳ — אותו מראה בסיסי של vt */
object TestAss {
    private val LINES = listOf(
        "זו בדיקה של צריבת כתוביות בטלפון",
        "המספר 1,234 ו־Apple נכתבים נכון?",
        "שורה ארוכה יותר שנשברת לשתי שורות כדי לבדוק את המדידה של הרוחב",
        "\"ציטוט\" — עם מקף, סוגריים (כאלה) ונקודה.",
    )

    fun build(seconds: Double, font: String, w: Int, h: Int): String {
        val size = (h * 0.052).toInt().coerceAtLeast(24)
        val sb = StringBuilder()
        sb.append("[Script Info]\nScriptType: v4.00+\nPlayResX: $w\nPlayResY: $h\nWrapStyle: 0\n\n")
        sb.append("[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n")
        sb.append("Style: Default,$font,$size,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,${(size / 14).coerceAtLeast(2)},0,2,${w / 12},${w / 12},${h / 18},1\n\n")
        sb.append("[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
        var t = 0.0; var i = 0
        while (t < seconds) {
            sb.append("Dialogue: 0,${ts(t)},${ts(minOf(seconds, t + 1.8))},Default,,0,0,0,,${LINES[i % LINES.size]}\n")
            t += 2.0; i++
        }
        return sb.toString()
    }

    private fun ts(s: Double): String {
        val cs = Math.round(s * 100)
        return String.format(Locale.US, "%d:%02d:%02d.%02d", cs / 360000, (cs / 6000) % 60, (cs / 100) % 60, cs % 100)
    }
}
