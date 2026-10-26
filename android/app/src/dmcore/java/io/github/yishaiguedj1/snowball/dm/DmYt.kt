package io.github.yishaiguedj1.snowball.dm

/**
 * 24/10/2026 (דיווח המשתמש: הורדה מיוטיוב "נראתה תקועה" על 0 B ובסוף ירדה):
 * לפני השורה הראשונה של ‎[download] … %‎ ‏yt-dlp מתחבר, פותר את בדיקת ה־JavaScript של יוטיוב (QuickJS — איטי בטלפון)
 * ובוחר פורמט — ובכל הזמן הזה DM הציג "0 B" בלי תנועה. כאן: כל שורה של yt-dlp → שלב, אחוז, מהירות וזמן שנותר,
 * וההתקדמות של כל ההורדה (וידאו ואחריו קול — האחוז של yt-dlp מתחיל מאפס בכל חלק) לא חוזרת אחורה.
 */
object DmYt {
    enum class Stage { PREP, CONN, DL, RETRY, MERGE, POST }

    data class Line(val stage: Stage?, val pct: Float = -1f, val bps: Long = 0, val eta: Long = -1, val newPart: Boolean = false, val partDone: Boolean = false, val side: Boolean = false)

    private val PCT = Regex("^\\[download]\\s+([\\d.]+)%")
    private val SPEED = Regex("\\bat\\s+([\\d.]+)\\s*([KMGT]?)i?B/s")
    /** 26/10/2026 (דיווח המשתמש: הפס "קופץ"): קובץ עזר שיורד לפני הווידאו — כתוביות, תמונה, מידע. עד היום נספר כחלק
     *  ההורדה הראשון: כתוביות שירדו ב־100% הקפיצו את הפס ל־83% מיד, והווידאו עצמו זחל ב־15% האחרונים */
    private val SIDE = Regex("\\.(vtt|srt|ass|ssa|ttml|srv[123]|json3?|lrc|jpe?g|png|webp|description|info\\.json)$", RegexOption.IGNORE_CASE)
    fun isSide(path: String) = SIDE.containsMatchIn(path.trim())

    private val ETA = Regex("\\bETA\\s+(\\d+):(\\d+)(?::(\\d+))?")

    fun parse(raw: String?): Line {
        val l = (raw ?: "").trim()
        if (l.isEmpty()) return Line(null)
        if (l.startsWith("[download] Destination:")) return Line(Stage.DL, newPart = true, side = isSide(l.removePrefix("[download] Destination:")))
        if (l.startsWith("[download]") && l.contains("has already been downloaded")) {
            val f = l.removePrefix("[download]").substringBefore(" has already been downloaded")
            return Line(Stage.DL, pct = 1f, partDone = true, side = isSide(f))
        }
        PCT.find(l)?.let { m ->
            val p = (m.groupValues[1].toFloatOrNull() ?: 0f) / 100f
            return Line(Stage.DL, pct = p.coerceIn(0f, 1f), bps = speedOf(l), eta = etaOf(l))
        }
        if (Regex("Retrying|Got error|HTTP Error", RegexOption.IGNORE_CASE).containsMatchIn(l)) return Line(Stage.RETRY)
        if (l.startsWith("[Merger]") || l.startsWith("[VideoConvertor]") || l.startsWith("[VideoRemuxer]")) return Line(Stage.MERGE)
        if (l.startsWith("[Fixup") || l.startsWith("[MoveFiles]") || l.startsWith("[Metadata]") || l.startsWith("[EmbedSubtitle]")) return Line(Stage.POST)
        if (l.startsWith("[info]") || Regex("^\\[[\\w:-]+]").containsMatchIn(l)) return Line(Stage.CONN)
        return Line(null)
    }

    fun speedOf(l: String): Long {
        val m = SPEED.find(l) ?: return 0
        val v = m.groupValues[1].toDoubleOrNull() ?: return 0
        val mul = when (m.groupValues[2]) { "K" -> 1024.0; "M" -> 1024.0 * 1024; "G" -> 1024.0 * 1024 * 1024; "T" -> 1024.0 * 1024 * 1024 * 1024; else -> 1.0 }
        return (v * mul).toLong()
    }

    fun etaOf(l: String): Long {
        val m = ETA.find(l) ?: return -1
        val a = m.groupValues[1].toLong(); val b = m.groupValues[2].toLong(); val c = m.groupValues[3]
        return if (c.isEmpty()) a * 60 + b else a * 3600 + b * 60 + c.toLong()
    }

    /** כמה חלקים yt-dlp יוריד: וידאו + קול נפרדים = 2 (הווידאו הוא רוב הקובץ — VIDEO_W), אחרת 1 */
    const val VIDEO_W = 0.85f

    /**
     * 26/10/2026 (בקשת המשתמש: "שהטעינה תהיה רציפה וברורה מתחילת ההורדה עד סופה, גם בהתראה"): סקאלה אחת לכל ההורדה —
     * הכנת המנוע 0–3%, חיבור (ובדיקת ה־JavaScript של יוטיוב) עד 6%, ההורדה עצמה 6–97%, איחוד וסיום עד 100%.
     * בשלבים בלי אחוז מ־yt-dlp הפס זוחל לפי הזמן (creep) לכיוון סוף השלב ולא מגיע אליו — תמיד זז, אף פעם לא חוזר.
     */
    const val PREP_END = 0.03f
    const val CONN_END = 0.06f
    const val DL_END = 0.97f

    /** האחוז של החלק בהורדה עצמה (0–1) → המקום בסקאלה של כל ההורדה */
    fun dlToAll(f: Float) = CONN_END + f.coerceIn(0f, 1f) * (DL_END - CONN_END)

    /** ההתקדמות של כל ההורדה — לפי השלב והחלק הנוכחי, ולא פחות ממה שכבר הוצג */
    class Progress(private val parts: Int, start: Float) {
        var frac = start.coerceIn(0f, 1f); private set
        var stage = Stage.PREP; private set
        var bps = 0L; private set
        var eta = -1L; private set
        private var part = 0
        private var inSide = false
        private var stageAt = -1L
        private var stageFrom = frac

        private fun enter(s: Stage, now: Long) { if (s != stage || stageAt < 0) { stage = s; stageAt = now; stageFrom = frac } }

        fun feed(raw: String?, now: Long = System.currentTimeMillis()): Boolean {
            val x = parse(raw)
            val s = x.stage ?: return false
            if (stageAt < 0) stageAt = now
            if (x.newPart) { inSide = x.side; if (!x.side) part++ }
            if (x.partDone && !x.side) inSide = false
            enter(if (s == Stage.CONN && frac > CONN_END) stage else s, now)
            // האחוז של קובץ עזר (כתוביות) לא שייך להתקדמות של הסרטון
            if (x.pct >= 0f && (x.side || (inSide && !x.partDone))) return true
            if (x.pct >= 0f) {
                val k = part.coerceAtLeast(1)
                val f = if (parts < 2) x.pct
                    else if (k == 1) x.pct * VIDEO_W
                    else VIDEO_W + x.pct * (1f - VIDEO_W)
                val g = dlToAll(f)
                if (g > frac) frac = g.coerceAtMost(1f)
                bps = x.bps; eta = x.eta
            } else if (s != Stage.DL) { bps = 0; eta = -1 }
            if (s == Stage.MERGE) frac = maxOf(frac, DL_END)
            if (s == Stage.POST) frac = maxOf(frac, 0.99f)
            return true
        }

        /** הזמן עובר בשלב בלי אחוז (הכנה, חיבור, איחוד) — הפס זוחל לכיוון סוף השלב: חצי מהדרך כל ~8 שניות */
        fun creep(now: Long = System.currentTimeMillis()): Boolean {
            if (stageAt < 0) { stageAt = now; return false }
            val end = when (stage) {
                Stage.PREP -> PREP_END
                Stage.CONN, Stage.RETRY -> if (frac < CONN_END) CONN_END else return false
                Stage.MERGE -> 0.995f
                else -> return false
            }
            if (frac >= end) return false
            val k = 1.0 - Math.pow(0.5, (now - stageAt) / 8000.0)
            val g = (stageFrom + (end - stageFrom) * k * 0.95).toFloat()
            if (g <= frac) return false
            frac = g
            return true
        }
    }
}
