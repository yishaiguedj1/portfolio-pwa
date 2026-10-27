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
        // 27/10/2026: כל סימנייה של Chrome מופיעה (גם n3 — אותה כתובת, Chrome מרשה), בסדר של Chrome; מה שנשמר כאן ועוד לא הגיע — בסוף,
        // ורק אם הכתובת לא כבר ב־Chrome (a10 = mine.com כבר שם); בלי שנמחקה (n4), בלי זו שנוספה ונמחקה (a12)
        assertEquals(listOf("https://ynet.co.il/", "https://mine.com/", "https://www.ynet.co.il", "https://new.com/"), r.map { it.url })
        assertTrue(r[0].imp && !r[1].imp && r[2].imp && !r[3].imp)        // מ־Chrome / נשמרה כאן
        assertEquals("שם חדש", r[1].title)                                // שינוי שם שעוד לא הגיע — דרך המזהה הזמני
        assertEquals(listOf("n1", "n2", "n3", "a8"), r.map { it.sid })
        // כשכל הפעולות אושרו — הרשימה = המצב של Chrome בלבד, אחד לאחד
        assertEquals(4, BrSync.applyState(st, emptyList(), emptyMap()).size)
    }

    // 27/10/2026: התיקיות של Chrome — כל סימנייה בתיקייה שלה ובמקום שלה, תיקיות וסימניות מעורבות בסדר של Chrome, גם תיקייה ריקה
    @Test fun chromeFolders() {
        val st = listOf(BrSync.SMark("n1", "https://a.com/", "a", 1, "c", "b", "Learning", 1), BrSync.SMark("n2", "https://b.com/", "b", 9, "c", "b", "Learning/Sub", 0),
            BrSync.SMark("n3", "https://a.com/", "a2", 2, "c", "o", "", 0), BrSync.SMark("n4", "https://c.com/", "c", 3, "c", "b", "", 2),
            BrSync.SMark("n5", "https://m.com/", "m", 4, "a", "m", "", 0), BrSync.SMark("n6", "https://www.a.com", "dup", 5, "c", "b", "Learning", 2),
            BrSync.SMark("n7", "https://first.com/", "f", 6, "c", "b", "", 0))
        val dirs = listOf(BrSync.Dir("b/Learning", 1), BrSync.Dir("b/Learning/Sub", 0), BrSync.Dir("b/Empty", 3), BrSync.Dir("o/Old", 1))
        val r = BrSync.applyState(st, listOf(BrSync.Op(1, "add", "a1", "https://new.com/", "new", 9), BrSync.Op(2, "del", "n3", "https://a.com/", "", 0)), emptyMap())
        assertEquals(listOf("b/Learning", "b/Learning/Sub", "b", "m", "b/Learning", "b", "m"), r.map { it.f })   // n3 נמחקה רק היא; n1 ו־n6 נשארות
        assertEquals(listOf("m", "b", "o"), BrSync.roots(r, dirs))                                                 // "אחרות" — בגלל תיקייה ריקה
        // הסרגל: first (0), Learning (1), c (2), Empty (3) — בדיוק הסדר של Chrome
        assertEquals(listOf("https://first.com/", "b/Learning", "https://c.com/", "b/Empty"), BrSync.entries(r, "b", dirs).map { if (it is BrMark) it.url else it })
        assertEquals(listOf("b/Learning/Sub", "https://a.com/", "https://www.a.com"), BrSync.entries(r, "b/Learning", dirs).map { if (it is BrMark) it.url else it })
        // הנייד: m.com (0) ואז מה שנשמר כאן ועוד לא הגיע ל־Chrome — בסוף, כמו שהתוסף יוסיף אותה
        assertEquals(listOf("https://m.com/", "https://new.com/"), BrSync.entries(r, "m", dirs).map { (it as BrMark).url })
        // בלי רשימת תיקיות (תוסף ישן) — עדיין לפי המקום של הסימניות, והתיקייה לפי מתי הופיעה
        assertEquals(listOf("https://first.com/", "https://c.com/", "b/Learning"), BrSync.entries(r, "b").map { if (it is BrMark) it.url else it })
        assertEquals(5, BrSync.count(r, "b")); assertEquals("Sub", BrSync.folderName("b/Learning/Sub")); assertEquals("b/Learning", BrSync.parent("b/Learning/Sub"))
        // ייבוא ישן בלי תיקייה → "מיובאות", שמורה כאן בלי תיקייה → נייד
        assertEquals("i", BrSync.folderOf(BrMark("https://x.com/", "x", 1, imp = true))); assertEquals("m", BrSync.folderOf(BrMark("https://y.com/", "y", 1)))
        assertEquals(listOf("m", "i"), BrSync.roots(listOf(BrMark("https://x.com/", "x", 1, imp = true))))
    }

    // 27/10/2026 (בקשת המשתמש: "במיוחד ההיסטוריה"): ביקור־ביקור, ומחיקה רק כש־Chrome מחק
    @Test fun chromeHistory() {
        val h = 3_600_000L
        val have = listOf(BrVisit("https://a.com/", "A", 10 * h), BrVisit("https://mine.com/", "M", 11 * h), BrVisit("https://old.com/", "O", 1 * h),
            BrVisit("https://del.com/", "D", 12 * h), BrVisit("https://new-here.com/", "N", 13 * h))
        val prev = mapOf(BrSync.visitKey("https://a.com/", 10 * h) to 10 * h, BrSync.visitKey("https://del.com/", 12 * h) to 12 * h,
            BrSync.visitKey("https://old.com/", 1 * h) to 1 * h)
        val chrome = listOf(BrImport.Item("https://www.a.com", "A", 10 * h + 300), BrImport.Item("https://a.com/", "A", 9 * h),   // אותו ביקור בכתיב אחר + ביקור נוסף באותה כתובת
            BrImport.Item("https://c.com/", "C", 14 * h), BrImport.Item("https://hidden.com/", "H", 15 * h))
        val p = BrSync.planChromeHist(have, chrome, prev, 5 * h, setOf(BrSync.visitKey("https://hidden.com/", 15 * h)))
        // del.com: Chrome הראה ועכשיו לא → נמחק. old.com: מתחת ל־hfrom (קיטום) → נשאר. new-here / mine: Chrome לא הראה אף פעם → נשארים
        assertEquals(setOf(BrSync.visitKey("https://del.com/", 12 * h)), p.remove)
        // כל ביקור של Chrome שחסר כאן — גם השני באותה כתובת; לא מה שמחקת כאן ועוד לא נמחק שם; בלי כפולה של ביקור שכבר כאן
        assertEquals(listOf("https://a.com/" to 9 * h, "https://c.com/" to 14 * h), p.add.map { it.url to it.at })
        assertEquals(4, p.cur.size)
        // אותו מצב פעמיים — כלום
        val again = BrSync.planChromeHist(have.filter { it.url != "https://del.com/" } + p.add, chrome, p.cur, 5 * h, setOf(BrSync.visitKey("https://hidden.com/", 15 * h)))
        assertTrue(again.add.isEmpty() && again.remove.isEmpty())
    }

    // 27/10/2026 (המחקר): Chrome הראה פתאום פחות מחצי — מחכים לאישור; שינוי רגיל / מעט סימניות — לא
    @Test fun bigDropGate() {
        assertTrue(BrSync.bigDrop(170, 40)); assertTrue(!BrSync.bigDrop(170, 160)); assertTrue(!BrSync.bigDrop(10, 0)); assertTrue(!BrSync.bigDrop(40, 20))
    }
}
