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

    @Test fun chromeStateWins() {
        val st = listOf(BrSync.SMark("n1", "https://ynet.co.il/", "ynet", 30, "c"), BrSync.SMark("n2", "https://mine.com/", "m", 20, "a"),
            BrSync.SMark("n3", "https://www.ynet.co.il", "dup", 10, "c"), BrSync.SMark("n4", "https://gone.com/", "g", 5, "c"))
        val pending = listOf(BrSync.Op(8, "add", "a8", "https://new.com/", "new", 40), BrSync.Op(9, "del", "n4", "https://gone.com/", "", 0),
            BrSync.Op(10, "add", "a10", "https://mine.com", "dup", 1), BrSync.Op(11, "ren", "a7", "", "שם חדש", 0),
            BrSync.Op(12, "add", "a12", "https://tmp.com/", "t", 2), BrSync.Op(13, "del", "a12", "https://tmp.com/", "", 0))
        val r = BrSync.applyState(st, pending, mapOf("a7" to "n2"))
        assertEquals(listOf("https://new.com/", "https://ynet.co.il/", "https://mine.com/"), r.map { it.url })   // בלי כפולה, בלי שנמחקה, בלי זו שנוספה ונמחקה
        assertTrue(r[1].imp && !r[2].imp && !r[0].imp)                    // מ־Chrome / נשמרה כאן
        assertEquals("שם חדש", r[2].title)                                // שינוי שם שעוד לא הגיע — דרך המזהה הזמני
        assertEquals(listOf("a8", "n1", "n2"), r.map { it.sid })
        // כשכל הפעולות אושרו — הרשימה = המצב של Chrome בלבד
        assertEquals(3, BrSync.applyState(st, emptyList(), emptyMap()).size)
    }
}
