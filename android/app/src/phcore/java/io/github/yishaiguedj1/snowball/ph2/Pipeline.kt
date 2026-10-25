package io.github.yishaiguedj1.snowball.ph2

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/**
 * 25/10/2026 (תרגום בטלפון, שלב 2): היישור כולו — align_words של השרת (vt/align.py): חלוקה לקטעים של עד 90 שנ׳,
 * Qwen לכל קטע, מיפוי למילים, מילה רחוקה מהזמן של התמלול = suspicious, בלי זמן = approx, ותיקון הסדר.
 * [cache] = התוצאות של כל קטע שנשמרות תוך כדי (PartCache) — עבודה שנקטעה (הטלפון סגר את האפליקציה) ממשיכה מהקטע הבא.
 */
class PhoneAlign(private val al: QwenAligner) {
    class Res(val stats: QAlign.Stats, val chunks: Int, val cached: Int)

    fun run(words: List<Word>, wav: FloatArray, cache: File? = null, onChunk: (Int, Int) -> Unit = { _, _ -> }): Res = run(words, Audio.of(wav), cache, onChunk)

    fun run(words: List<Word>, au: Audio, cache: File? = null, onChunk: (Int, Int) -> Unit = { _, _ -> }): Res {
        val sr = 16000
        val total = au.n.toDouble() / sr
        val plan = QAlign.planChunks(words, audioLen = total)
        val pc = PartCache(cache, words, plan)
        val st = QAlign.Stats()
        var cached = 0
        for ((ci, c) in plan.withIndex()) {
            val sub = words.subList(c.i0, c.i1)
            var res = pc.get(ci, sub.size)
            if (res != null) cached++
            else {
                val toks = sub.map { QAlign.cleanToken(it.w) }
                res = if (toks.all { it.isEmpty() }) arrayOfNulls(sub.size) else {
                    val seg = au.read((c.cs * sr).toInt(), (c.ce * sr).toInt())
                    QAlign.mapItems(sub, al.align(seg, toks.filter { it.isNotEmpty() }.joinToString(" ")).items)
                }
                pc.put(ci, res, ci + 1 == plan.size)
            }
            QAlign.apply(words, c, res, st)
            onChunk(ci + 1, plan.size)
        }
        QAlign.repairOrder(words)
        return Res(st, plan.size, cached)
    }

    /** align.part.json של השרת, בקטן: המפתח = המילים והחלוקה; קובץ של יישור אחר לא נקרא */
    private class PartCache(val f: File?, words: List<Word>, plan: List<QAlign.Chunk>) {
        val key: String
        val data = HashMap<Int, Array<Pair<Double, Double>?>>()
        var t = 0L

        init {
            val md = MessageDigest.getInstance("SHA-1")
            for (w in words) md.update("${w.w}|${w.s}|${w.e};".toByteArray())
            for (c in plan) md.update("${c.i0},${c.i1},${c.cs},${c.ce};".toByteArray())
            key = md.digest().joinToString("") { "%02x".format(it) }.take(16)
            try {
                if (f != null && f.isFile) {
                    val o = JSONObject(f.readText())
                    if (o.optString("k") == key) {
                        val r = o.getJSONObject("r")
                        for (k in r.keys()) {
                            val a = r.getJSONArray(k)
                            data[k.toInt()] = Array(a.length()) { i -> if (a.isNull(i)) null else a.getJSONArray(i).let { it.getDouble(0) to it.getDouble(1) } }
                        }
                    }
                }
            } catch (_: Exception) { data.clear() }
        }

        fun get(i: Int, n: Int) = data[i]?.takeIf { it.size == n }

        fun put(i: Int, res: Array<Pair<Double, Double>?>, force: Boolean) {
            data[i] = res
            if (f == null || (!force && System.currentTimeMillis() - t < 15_000)) return
            t = System.currentTimeMillis()
            try {
                val r = JSONObject()
                for ((k, v) in data) r.put(k.toString(), JSONArray(v.map { p -> if (p == null) JSONObject.NULL else JSONArray(listOf(p.first, p.second)) }))
                val tmp = File(f.path + ".tmp"); tmp.writeText(JSONObject().put("k", key).put("r", r).toString())
                tmp.renameTo(f)
            } catch (_: Exception) {}
        }
    }
}

/** קובץ המילים שעולה לשרתון (`w`, ‏PW_V = 1 — pw_check ב־translator/job.py) */
object PwJson {
    const val V = 1
    private val CTRL = Regex("[\\x00-\\x1f]")

    fun build(words: List<Word>, diar: Diarize.Stats?, diarSec: Double?): JSONObject {
        val ws = JSONArray()
        for (w in words) {
            val t = CTRL.replace(w.w, "").trim().take(64)
            if (t.isEmpty()) continue
            val o = JSONObject().put("w", t).put("s", w.s).put("e", w.e)
            w.spk?.let { o.put("spk", it) }
            w.align?.let { o.put("align", it) }
            ws.put(o)
        }
        val o = JSONObject().put("v", V).put("engine", "parakeet").put("aligner", "qwen3-onnx-int8").put("words", ws)
        if (diar != null && diar.speakers > 0) o.put("diarize", JSONObject().put("speakers", diar.speakers).put("units", diar.units).apply { diarSec?.let { put("seconds", it) } })
        return o
    }

    /** מהתמלול (AWord) למילה של היישור/הדוברים */
    fun words(a: List<AWord>): List<Word> = a.map { Word(it.w, it.s, it.e) }
}
