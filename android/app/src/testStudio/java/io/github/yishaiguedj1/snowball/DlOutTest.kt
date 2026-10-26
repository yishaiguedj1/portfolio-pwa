package io.github.yishaiguedj1.snowball

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File
import java.nio.file.Files

/** 26/10/2026: הקובץ שירד נמצא בתיקייה של ההורדה (בלי ‎--print‎, שהשתיק את ההתקדמות) — לא קובץ ביניים של yt-dlp */
class DlOutTest {
    private fun dir(vararg files: Pair<String, Int>): File {
        val d = Files.createTempDirectory("dl").toFile()
        files.forEach { (n, sz) -> File(d, n).writeBytes(ByteArray(sz)) }
        return d
    }

    @Test fun picksMergedFile() {
        val d = dir("Title [abc123].mp4" to 500, "Title [abc123].f137.mp4" to 900, "Title [abc123].f251.webm" to 300,
            "Title [abc123].mp4.part" to 2000, "Title [abc123].he.srt" to 50, "Title [abc123].mp4.ytdl" to 10)
        assertEquals("Title [abc123].mp4", DlProbe.outFile(d)!!.name)
    }

    @Test fun titleWithDotsIsFine() {
        val d = dir("v1.f is great [abc].mkv" to 100)
        assertEquals("v1.f is great [abc].mkv", DlProbe.outFile(d)!!.name)
    }

    @Test fun nothingYet() {
        assertNull(DlProbe.outFile(dir("a.mp4.part" to 100, "b.mp4" to 0)))
    }
}
