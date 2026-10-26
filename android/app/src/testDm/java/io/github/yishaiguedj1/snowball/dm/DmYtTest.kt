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
        assertEquals(DmYt.Stage.PREP, p.stage); assertEquals(0f, p.frac, 0f)
        p.feed("[youtube] Extracting URL: https://youtu.be/abc", 0)
        assertEquals(DmYt.Stage.CONN, p.stage)
        p.feed("[download] Destination: a.f399.mp4", 10)
        p.feed("[download] 100.0% of 80.00MiB at 3.00MiB/s ETA 00:00", 20)
        assertEquals(DmYt.dlToAll(DmYt.VIDEO_W), p.frac, 0.0001f)
        p.feed("[download] Destination: a.f251.webm", 30)          // הקול — האחוז של yt-dlp מתחיל מאפס
        p.feed("[download]   0.5% of 30.00MiB at 1.00MiB/s ETA 00:30", 40)
        assertTrue(p.frac >= DmYt.dlToAll(DmYt.VIDEO_W))
        p.feed("[download]  50.0% of 30.00MiB at 1.00MiB/s ETA 00:15", 50)
        assertEquals(DmYt.dlToAll(DmYt.VIDEO_W + 0.5f * (1 - DmYt.VIDEO_W)), p.frac, 0.0001f)
        p.feed("[Merger] Merging formats into \"a.mp4\"", 60)
        assertEquals(DmYt.Stage.MERGE, p.stage); assertTrue(p.frac >= DmYt.DL_END)
        p.feed("[MoveFiles] Moving file", 70)
        assertTrue(p.frac >= 0.99f)
    }

    /** 26/10: בשלבים בלי אחוז הפס זוחל לפי הזמן — תמיד זז קדימה, לא עובר את סוף השלב, ולא חוזר אחורה */
    @Test fun creepIsContinuous() {
        val p = DmYt.Progress(2, -1f)
        p.creep(0)
        var last = p.frac
        for (t in 1..60) { p.creep(t * 1000L); assertTrue(p.frac >= last); last = p.frac }
        assertTrue(p.frac > 0.02f && p.frac < DmYt.PREP_END)            // הכנה: עד 3%, לא מגיע
        p.feed("[youtube] Extracting URL: https://youtu.be/abc", 61_000)
        for (t in 62..120) { p.creep(t * 1000L); assertTrue(p.frac >= last); last = p.frac }
        assertTrue(p.frac > DmYt.PREP_END && p.frac < DmYt.CONN_END)
        p.feed("[download]   1.0% of 80.00MiB at 3.00MiB/s ETA 00:30", 121_000)
        assertTrue(p.frac >= last)                                        // האחוז הראשון לא מחזיר אחורה
        assertTrue(!p.creep(200_000))                                     // בהורדה — רק האחוז של yt-dlp
    }

    @Test fun singlePartAndResume() {
        val p = DmYt.Progress(1, 0.3f)                          // המשך — מה שכבר הוצג נשמר
        p.feed("[download] Destination: a.mp4")
        p.feed("[download]  10.0% of 10.00MiB at 1.00MiB/s ETA 00:09")
        assertEquals(0.3f, p.frac, 0f)
        p.feed("[download]  60.0% of 10.00MiB at 1.00MiB/s ETA 00:04")
        assertEquals(DmYt.dlToAll(0.6f), p.frac, 0.0001f)
        p.feed("[youtube] something late")                    // שורת חיבור באמצע ההורדה לא מחזירה ל"מתחבר"
        assertEquals(DmYt.Stage.DL, p.stage)
    }

    /** 26/10/2026: הכתוביות יורדות לפני הווידאו — לא קופצים ל־83% ולא זוחלים ב־15% האחרונים */
    @Test fun subtitlesDoNotJump() {
        val p = DmYt.Progress(2, 0f)
        p.feed("[info] abc: Writing video subtitles to: /x/a [abc].he.vtt")
        p.feed("[download] Destination: /x/a [abc].he.vtt")
        p.feed("[download] 100% of   41.20KiB in 00:00:00 at 300.00KiB/s")
        p.feed("[download] Destination: /x/a [abc].en.vtt")
        p.feed("[download] 100% of   38.00KiB in 00:00:00 at 300.00KiB/s")
        assertTrue(p.frac < 0.07f)
        p.feed("[download] Destination: /x/a [abc].f399.mp4")
        p.feed("[download]  50.0% of   60.00MiB at    5.00MiB/s ETA 00:06")
        assertEquals(DmYt.dlToAll(0.5f * DmYt.VIDEO_W), p.frac, 0.001f)
        p.feed("[download] 100% of   60.00MiB in 00:00:12 at 5.00MiB/s")
        p.feed("[download] Destination: /x/a [abc].f251.webm")
        p.feed("[download]  50.0% of    5.00MiB at    5.00MiB/s ETA 00:01")
        assertEquals(DmYt.dlToAll(DmYt.VIDEO_W + 0.5f * (1 - DmYt.VIDEO_W)), p.frac, 0.001f)
        assertTrue(DmYt.parse("[download] /x/a [abc].he.vtt has already been downloaded").side)
        assertTrue(!DmYt.parse("[download] /x/a [abc].mp4 has already been downloaded").side)
    }
}
