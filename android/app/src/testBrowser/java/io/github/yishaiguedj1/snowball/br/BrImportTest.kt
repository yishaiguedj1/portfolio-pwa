package io.github.yishaiguedj1.snowball.br

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** 26/10/2026: ייבוא מ־Chrome — קובץ סימניות (Netscape), היסטוריה של Takeout, ו־ZIP של Takeout שבו השמות מתורגמים */
class BrImportTest {
    private val html = """<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1><DL><p>
<DT><H3 ADD_DATE="1700000000">סרגל</H3><DL><p>
<DT><A HREF="https://www.ynet.co.il/" ADD_DATE="1700000001" ICON="data:x">ynet &amp; חדשות</A>
<DT><A HREF="javascript:alert(1)">bad</A>
<DT><A HREF="https://example.com/a?b=1&amp;c=2" ADD_DATE="1700000002">Ex &#39;q&#39; &#x5D0;</A>
<DT><A HREF="https://www.ynet.co.il/">dup</A>
</DL><p></DL><p>"""
    private val hist = """{"Browser History":[{"title":"T","url":"https://a.com/","time_usec":1700000000123456},{"title":"c","url":"chrome://settings","time_usec":1}]}"""

    @Test fun bookmarksHtml() {
        val r = BrImport.read(ByteArrayInputStream(html.toByteArray()), "b.html")
        assertEquals(2, r.marks.size)                                     // בלי javascript: ובלי כפולים
        assertEquals("ynet & חדשות", r.marks[0].title)
        assertEquals(1700000001000L, r.marks[0].at)
        assertEquals("https://example.com/a?b=1&c=2", r.marks[1].url)
        assertEquals("Ex 'q' א", r.marks[1].title)
    }

    @Test fun takeoutZipByContent() {
        val bo = ByteArrayOutputStream()
        ZipOutputStream(bo).use { z ->
            z.putNextEntry(ZipEntry("Takeout/Chrome/סימניות.html")); z.write(html.toByteArray()); z.closeEntry()
            z.putNextEntry(ZipEntry("Takeout/Chrome/History.json")); z.write(hist.toByteArray()); z.closeEntry()
            z.putNextEntry(ZipEntry("Takeout/Chrome/Settings.json")); z.write("{\"a\":1}".toByteArray()); z.closeEntry()
            z.putNextEntry(ZipEntry("Takeout/archive_browser.html")); z.write("<html>x</html>".toByteArray()); z.closeEntry()
        }
        val r = BrImport.read(ByteArrayInputStream(bo.toByteArray()), "takeout.zip")
        assertEquals(2, r.marks.size)
        assertEquals(1, r.visits.size)
        assertEquals(1700000000123L, r.visits[0].at)                       // מיקרו־שניות → מילי־שניות
    }

    @Test fun otherFile() {
        val r = BrImport.read(ByteArrayInputStream("hello".toByteArray()), "x.txt")
        assertTrue(r.marks.isEmpty() && r.visits.isEmpty())
    }
}
