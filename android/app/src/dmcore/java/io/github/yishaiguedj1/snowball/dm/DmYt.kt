package io.github.yishaiguedj1.snowball.dm

/**
 * 24/10/2026 (דיווח המשתמש: הורדה מיוטיוב "נראתה תקועה" על 0 B ובסוף ירדה):
 * לפני השורה הראשונה של ‎[download] … %‎ ‏yt-dlp מתחבר, פותר את בדיקת ה־JavaScript של יוטיוב (QuickJS — איטי בטלפון)
 * ובוחר פורמט — ובכל הזמן הזה DM הציג "0 B" בלי תנועה. כאן: כל שורה של yt-dlp → שלב, אחוז, מהירות וזמן שנותר,
 * וההתקדמות של כל ההורדה (וידאו ואחריו קול — האחוז של yt-dlp מתחיל מאפס בכל חלק) לא חוזרת אחורה.
 */
object DmYt {
    enum class Stage { PREP, CONN, DL, RETRY, MERGE, POST }

    data class Line(val stage: Stage?, val pct: Float = -1f, val bps: Long = 0, val eta: Long = -1, val newPart: Boolean = false, val partDone: Boolean = false)

    private val PCT = Regex("^\\[download]\\s+([\\d.]+)%")
    private val SPEED = Regex("\\bat\\s+([\\d.]+)\\s*([KMGT]?)i?B/s")
    private val ETA = Regex("\\bETA\\s+(\\d+):(\\d+)(?::(\\d+))?")

    fun parse(raw: String?): Line {
        val l = (raw ?: "").trim()
        if (l.isEmpty()) return Line(null)
        if (l.startsWith("[download] Destination:")) return Line(Stage.DL, newPart = true)
        if (l.startsWith("[download]") && l.contains("has already been downloaded")) return Line(Stage.DL, pct = 1f, partDone = true)
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

    /** ההתקדמות של כל ההורדה — לפי החלק הנוכחי, ולא פחות ממה שכבר הוצג */
    class Progress(private val parts: Int, start: Float) {
        var frac = start.coerceIn(-1f, 1f); private set
        var stage = Stage.PREP; private set
        var bps = 0L; private set
        var eta = -1L; private set
        private var part = 0

        fun feed(raw: String?): Boolean {
            val x = parse(raw)
            val s = x.stage ?: return false
            if (x.newPart) part++
            stage = if (s == Stage.CONN && frac > 0f) stage else s
            if (x.pct >= 0f) {
                val k = part.coerceAtLeast(1)
                val f = if (parts < 2) x.pct
                    else if (k == 1) x.pct * VIDEO_W
                    else VIDEO_W + x.pct * (1f - VIDEO_W)
                if (f > frac) frac = f.coerceAtMost(1f)
                bps = x.bps; eta = x.eta
            } else if (s != Stage.DL) { bps = 0; eta = -1 }
            if (s == Stage.MERGE || s == Stage.POST) frac = maxOf(frac, 0.99f)
            return true
        }
    }
}
