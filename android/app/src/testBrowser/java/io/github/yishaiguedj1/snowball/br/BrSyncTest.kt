package io.github.yishaiguedj1.snowball.br

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** 26/10/2026: ייבוא וייצוא בין Studio Browser ל־Chrome בלי כפילויות — רק מה שחדש נוסף (BrSync) */
class BrSyncTest {
    private fun item(u: String, t: String = "", at: Long = 0) = BrImport.Item(u, t, at)

    @Test fun sameSiteDifferentSpelling() {
        val k = BrSync.key("https://www.ynet.co.il/")
        for (u in listOf("http://ynet.co.il", "https://YNET.co.il/", "https://www.ynet.co.il:443/", "https://ynet.co.il/#top",
                "https://ynet.co.il/?utm_source=x&fbclid=y")) assertEquals(u, k, BrSync.key(u))
        assertEquals(BrSync.key("https://a.com/p/"), BrSync.key("https://a.com/p"))
        assertEquals(BrSync.key("https://a.com/%c3%a9"), BrSync.key("https://a.com/%C3%A9"))
        // דפים שונים באמת — מפתחות שונים
        assertNotEquals(BrSync.key("https://a.com/p?id=1"), BrSync.key("https://a.com/p?id=2"))
        assertNotEquals(BrSync.key("https://a.com/#/inbox"), BrSync.key("https://a.com/#/sent"))
        assertNotEquals(BrSync.key("https://a.com/Path"), BrSync.key("https://a.com/path"))
        assertNotEquals(BrSync.key("https://a.com:8080/"), BrSync.key("https://a.com/"))
        assertEquals("a.com/x?b=2&a=1", BrSync.key("https://a.com/x?b=2&utm_medium=m&a=1"))
    }

    @Test fun importOnlyNew() {
        val have = listOf(BrMark("https://ynet.co.il", "ynet", 1), BrMark("https://b.com/x", "b", 2, x = 99))   // b יצאה ל־Chrome
        val inc = listOf(item("https://www.ynet.co.il/", "ynet"), item("https://b.com/x/", "b"), item("https://new.com/", "new", 5000),
            item("http://new.com", "dup in file"), item("https://gone.com/a", "gone"))
        val p = BrSync.planMarks(have, inc, setOf(BrSync.key("https://gone.com/a")), 777)
        assertEquals(listOf("https://new.com/"), p.add.map { it.url })
        assertTrue(p.add[0].imp)
        assertEquals(3, p.known)       // ynet, b (שחזרה מ־Chrome), וכפולה בתוך הקובץ
        assertEquals(1, p.gone)        // נמחקה כאן — לא חוזרת
        // ייבוא שני של אותו קובץ אחרי הראשון — לא מוסיף כלום
        val p2 = BrSync.planMarks(have + p.add, inc, setOf(BrSync.key("https://gone.com/a")), 777)
        assertTrue(p2.add.isEmpty())
    }

    @Test fun visitsOnlyNew() {
        val have = listOf(BrVisit("https://a.com/", "A", 1_700_000_000_123))
        val inc = listOf(item("https://www.a.com", "A", 1_700_000_000_456), item("https://a.com/", "A", 1_700_000_100_000),
            item("https://a.com/", "A", 1_700_000_100_000), item("https://a.com/", "A", 0))
        val nv = BrSync.planVisits(have, inc)
        assertEquals(listOf(1_700_000_100_000L), nv.map { it.at })   // אותה שנייה = אותו ביקור; כפולה בקובץ; בלי זמן — לא
    }

    @Test fun exportOnlyWhatChromeLacks() {
        val marks = listOf(BrMark("https://mine.com/", "m", 3), BrMark("https://chrome.com/", "c", 2, imp = true),
            BrMark("https://old.com/", "o", 1, x = 50), BrMark("https://www.mine.com", "m2", 0), BrMark("ftp://x", "f", 0))
        assertEquals(listOf("https://mine.com/"), BrSync.toExport(marks, false).map { it.url })
        assertEquals(listOf("https://mine.com/", "https://old.com/"), BrSync.toExport(marks, true).map { it.url })
        val html = BrSync.exportHtml(BrSync.toExport(marks, true), "Studio Browser · 1/1")
        // הקובץ שיצא חוזר בייבוא כמו שהוא — ולא מוסיף כלום
        val back = BrImport.read(html.byteInputStream(), "x.html")
        assertEquals(2, back.marks.size)
        assertTrue(BrSync.planMarks(marks, back.marks, emptySet(), 1).add.isEmpty())
    }
}
