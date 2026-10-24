package io.github.yishaiguedj1.snowball.dm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** שורות אמיתיות של yt-dlp (הפורמט של nightly 2026) → שלב, אחוז, מהירות; וההתקדמות לא חוזרת אחורה בין הווידאו לקול */
class DmYtTest {
    @Test fun stages() {
        assertEquals(DmYt.Stage.CONN, DmYt.parse("[youtube] Extracting URL: https://youtu.be/abc").stage)
        assertEquals(DmYt.Stage.CONN, DmYt.parse("[youtube] abc: Downloading tv player API JSON").stage)
        assertEquals(DmYt.Stage.CONN, DmYt.parse("[info] abc: Downloading 1 format(s): 399+251").stage)
        assertEquals(DmYt.Stage.DL, DmYt.parse("[download] Destination: /x/a.f399.mp4").stage)
        assertEquals(DmYt.Stage.RETRY, DmYt.parse("[download] Got error: HTTP Error 403: Forbidden. Retrying (1/10)...").stage)
        assertEquals(DmYt.Stage.MERGE, DmYt.parse("[Merger] Merging formats into \"/x/a.mp4\"").stage)
        assertEquals(DmYt.Stage.POST, DmYt.parse("[FixupM4a] Correcting container of \"/x/a.m4a\"").stage)
        assertEquals(null, DmYt.parse("WARNING: something").stage)
        assertEquals(null, DmYt.parse("").stage)
    }

    @Test fun percentSpeedEta() {
        val l = DmYt.parse("[download]  42.7% of   96.12MiB at    2.50MiB/s ETA 00:22")
        assertEquals(0.427f, l.pct, 0.0001f)
        assertEquals((2.5 * 1024 * 1024).toLong(), l.bps)
        assertEquals(22L, l.eta)
        assertEquals(3723L, DmYt.etaOf("ETA 01:02:03"))
        assertEquals(0L, DmYt.speedOf("[download] 10.0% of ~ 5MiB at Unknown B/s ETA Unknown"))
        assertEquals((800 * 1024).toLong(), DmYt.speedOf("at  800.00KiB/s"))
    }

    @Test fun progressNeverGoesBack() {
        val p = DmYt.Progress(2, -1f)
        assertEquals(DmYt.Stage.PREP, p.stage); assertEquals(-1f, p.frac, 0f)
        p.feed("[youtube] Extracting URL: https://youtu.be/abc")
        assertEquals(DmYt.Stage.CONN, p.stage); assertEquals(-1f, p.frac, 0f)
        p.feed("[download] Destination: a.f399.mp4")
        p.feed("[download] 100.0% of 80.00MiB at 3.00MiB/s ETA 00:00")
        assertEquals(DmYt.VIDEO_W, p.frac, 0.0001f)
        p.feed("[download] Destination: a.f251.webm")          // הקול — האחוז של yt-dlp מתחיל מאפס
        p.feed("[download]   0.5% of 30.00MiB at 1.00MiB/s ETA 00:30")
        assertTrue(p.frac >= DmYt.VIDEO_W)
        p.feed("[download]  50.0% of 30.00MiB at 1.00MiB/s ETA 00:15")
        assertEquals(DmYt.VIDEO_W + 0.5f * (1 - DmYt.VIDEO_W), p.frac, 0.0001f)
        p.feed("[Merger] Merging formats into \"a.mp4\"")
        assertEquals(DmYt.Stage.MERGE, p.stage); assertTrue(p.frac >= 0.99f)
    }

    @Test fun singlePartAndResume() {
        val p = DmYt.Progress(1, 0.3f)                          // המשך — מה שכבר הוצג נשמר
        p.feed("[download] Destination: a.mp4")
        p.feed("[download]  10.0% of 10.00MiB at 1.00MiB/s ETA 00:09")
        assertEquals(0.3f, p.frac, 0f)
        p.feed("[download]  60.0% of 10.00MiB at 1.00MiB/s ETA 00:04")
        assertEquals(0.6f, p.frac, 0.0001f)
        p.feed("[youtube] something late")                    // שורת חיבור באמצע ההורדה לא מחזירה ל"מתחבר"
        assertEquals(DmYt.Stage.DL, p.stage)
    }
}
