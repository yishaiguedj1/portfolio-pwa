package io.github.yishaiguedj1.snowball.br

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 01/11/2026: Studio Browser Pro — הגל הראשון (BrPro): מחשבון, המרות, קיצורים, ניקוי קישור, כלי מפתחים */
class BrProTest {
    @Test fun calculator() {
        assertEquals("510", BrPro.answer("15% מ־3,400"))
        assertEquals("510", BrPro.answer("15% of 3400"))
        assertEquals("220", BrPro.answer("200+10%"))
        assertEquals("180", BrPro.answer("200-10%"))
        assertEquals("14", BrPro.answer("2+3*4"))
        assertEquals("20", BrPro.answer("(2+3)*4"))
        assertEquals("1,024", BrPro.answer("2^10"))
        assertEquals("0.3333333333", BrPro.answer("1/3"))
        assertEquals("12.5", BrPro.answer("100 ÷ 8"))
        assertEquals("6", BrPro.answer("2×3"))
        assertEquals("-1", BrPro.answer("2-3"))
        assertEquals("1,234,567.5", BrPro.answer("1234567+0.5"))
    }

    @Test fun notACalculation() {
        assertNull(BrPro.answer("ynet.co.il"))
        assertNull(BrPro.answer("1234"))
        assertNull(BrPro.answer("50%"))
        assertNull(BrPro.answer("-3"))
        assertNull(BrPro.answer("2026-11-01"))      // תאריך
        assertNull(BrPro.answer("01/11/2026"))
        assertNull(BrPro.answer("054-1234567"))     // טלפון
        assertNull(BrPro.answer("1/0"))
        assertNull(BrPro.answer("iphone 15 pro"))
        assertNull(BrPro.answer("2+"))
        assertNull(BrPro.answer("(2+3"))
    }

    @Test fun conversions() {
        assertEquals("8.04672 ק״מ", BrPro.answer("5 mi to km"))
        assertEquals("8.04672 ק״מ", BrPro.answer("5 מייל בק״מ"))
        assertEquals("37.78 °C", BrPro.answer("100f to c"))
        assertEquals("86 °F", BrPro.answer("30 מעלות צלזיוס בפרנהייט"))
        assertEquals("2.2046226 פאונד", BrPro.answer("1 kg to lb"))
        assertNull(BrPro.answer("5 km to kg"))       // סוגים שונים
        assertNull(BrPro.answer("5 km to km"))
    }

    @Test fun keywords() {
        val (k, q) = BrPro.keyword("yt שיר חדש")!!
        assertEquals("yt", k.key); assertEquals("שיר חדש", q)
        assertEquals("https://www.youtube.com/results?search_query=%D7%A9%D7%99%D7%A8+%D7%97%D7%93%D7%A9", BrPro.keywordUrl(k, q))
        assertEquals("w", BrPro.keyword("W ריבית")!!.first.key)
        assertNull(BrPro.keyword("yt"))
        assertNull(BrPro.keyword("yt   "))
        assertNull(BrPro.keyword("youtube music"))
        assertNull(BrPro.keyword("ynet.co.il"))
    }

    @Test fun cleanLinks() {
        assertEquals("https://a.com/x?id=5", BrPro.clean("https://a.com/x?utm_source=fb&id=5&fbclid=abc"))
        assertEquals("https://a.com/x", BrPro.clean("https://a.com/x?utm_source=fb&utm_medium=x"))
        assertEquals("https://a.com/x#top", BrPro.clean("https://a.com/x?gclid=1#top"))
        assertEquals("https://youtu.be/abc?t=30", BrPro.clean("https://youtu.be/abc?si=XYZ&t=30"))
        // si באתר אחר — פרמטר אמיתי, נשאר
        assertEquals("https://shop.com/p?si=2", BrPro.clean("https://shop.com/p?si=2"))
        assertEquals("https://a.com/x", BrPro.clean("https://a.com/x"))
    }

    @Test fun devtools() {
        assertEquals("curl 'https://a.com/x' -H 'Accept: */*'", BrPro.curl("https://a.com/x", "GET", mapOf("Accept" to "*/*", "Cookie" to "s=1")))
        assertEquals("curl -X POST 'https://a.com/it'\\''s'", BrPro.curl("https://a.com/it's", "post", emptyMap()))
        assertEquals("js", BrPro.kindOf("https://a.com/app.js?v=2", false))
        assertEquals("media", BrPro.kindOf("https://cdn/v/1080.m3u8", false))
        assertEquals("doc", BrPro.kindOf("https://a.com/", true))
        assertEquals("undefined", BrPro.evalShow("null"))
        assertEquals("שלום \"עולם\"", BrPro.evalShow("\"שלום \\\"עולם\\\"\""))
        assertEquals("42", BrPro.evalShow("42"))
        val r = BrPro.Ring<Int>(3); (1..5).forEach { r.add(it) }
        assertEquals(listOf(3, 4, 5), r.all())
    }

    @Test fun pageScripts() {
        assertTrue(BrPro.HEBREW_JS.contains("dir','auto'"))
        assertTrue(BrPro.muteJs(true).contains("__snbMute=true"))
        assertFalse(BrPro.muteJs(false).contains("__snbMute=true"))
    }

    /* ---------------- הגל השני (01/11/2026) ---------------- */

    @Test fun scopedSearch() {
        assertEquals(BrPro.Scope.TABS to "שיר", BrPro.scope("@כרטיסיות שיר"))
        assertEquals(BrPro.Scope.HISTORY to "ynet", BrPro.scope("@history ynet"))
        assertEquals(BrPro.Scope.MARKS to "", BrPro.scope("@סימניות"))
        assertEquals(BrPro.Scope.TABS to "x", BrPro.scope("@Tabs x"))
        assertNull(BrPro.scope("@someone"))
        assertNull(BrPro.scope("history"))
        assertEquals(listOf(BrPro.Scope.TABS, BrPro.Scope.MARKS, BrPro.Scope.HISTORY), BrPro.scopeHints("@"))
        assertEquals(listOf(BrPro.Scope.HISTORY), BrPro.scopeHints("@הי"))
        assertTrue(BrPro.scopeHints("@היסטוריה").isEmpty())   // כבר נבחר — אין מה להציע
        assertTrue(BrPro.scopeHints("@היסטוריה x").isEmpty())
        assertEquals("כרטיסיות", BrPro.scopeWord(BrPro.Scope.TABS, true))
        assertEquals("tabs", BrPro.scopeWord(BrPro.Scope.TABS, false))
    }

    @Test fun omniboxActions() {
        assertEquals(BrPro.Act.CLEAR, BrPro.action("מחיקת היסט"))
        assertEquals(BrPro.Act.CLEAR, BrPro.action("Clear browsing"))
        assertEquals(BrPro.Act.SETTINGS, BrPro.action("הגדרות"))
        assertEquals(BrPro.Act.SETTINGS, BrPro.action("הגדרות הדפדפן"))
        assertEquals(BrPro.Act.PRIVATE, BrPro.action("incog"))
        assertEquals(BrPro.Act.TASKS, BrPro.action("task manager"))
        assertEquals(BrPro.Act.SPLIT, BrPro.action("מסך מפ"))
        assertNull(BrPro.action("הג"))            // פחות מ־3 אותיות
        assertNull(BrPro.action("ynet.co.il"))    // כתובת
        assertNull(BrPro.action("https://settings.example"))
        assertNull(BrPro.action("@history"))
        assertNull(BrPro.action("מזג אוויר"))
    }

    @Test fun toolbarLayout() {
        assertEquals(listOf("newtab"), BrPro.tools(null))
        assertEquals(emptyList<String>(), BrPro.tools(""))
        assertEquals(listOf("share", "star"), BrPro.tools("share,bogus,star,share"))
        assertEquals(3, BrPro.tools("newtab,home,share,star,reload").size)
        val l = listOf("newtab", "share")
        assertEquals(listOf("newtab", "share", "star"), BrPro.toolToggle(l, "star"))
        assertEquals(listOf("share"), BrPro.toolToggle(l, "newtab"))
        assertEquals(listOf("newtab", "share", "star"), BrPro.toolToggle(listOf("newtab", "share", "star"), "reload"))   // מעל התקרה — לא נוסף
        assertEquals(listOf("share", "newtab"), BrPro.toolMove(l, "share", -1))
        assertEquals(l, BrPro.toolMove(l, "newtab", -1))
        assertEquals("newtab,share", BrPro.toolsEncode(l + "bogus"))
        assertEquals(BrPro.TOOLS.size, BrPro.TOOLS.toSet().size)
    }

    @Test fun keyboardShortcuts() {
        // קבועים של KeyEvent — המהדר מציב את הערך, אין טעינה של המחלקה ב־JVM
        val codes = mapOf("T" to android.view.KeyEvent.KEYCODE_T, "N" to android.view.KeyEvent.KEYCODE_N, "W" to android.view.KeyEvent.KEYCODE_W,
            "TAB" to android.view.KeyEvent.KEYCODE_TAB, "1" to android.view.KeyEvent.KEYCODE_1, "9" to android.view.KeyEvent.KEYCODE_9, "0" to android.view.KeyEvent.KEYCODE_0,
            "L" to android.view.KeyEvent.KEYCODE_L, "DPAD_LEFT" to android.view.KeyEvent.KEYCODE_DPAD_LEFT, "DPAD_RIGHT" to android.view.KeyEvent.KEYCODE_DPAD_RIGHT,
            "F5" to android.view.KeyEvent.KEYCODE_F5, "ESCAPE" to android.view.KeyEvent.KEYCODE_ESCAPE, "C" to android.view.KeyEvent.KEYCODE_C,
            "V" to android.view.KeyEvent.KEYCODE_V, "A" to android.view.KeyEvent.KEYCODE_A, "X" to android.view.KeyEvent.KEYCODE_X, "Z" to android.view.KeyEvent.KEYCODE_Z,
            "Y" to android.view.KeyEvent.KEYCODE_Y)
        fun k(n: String) = codes.getValue(n)
        assertEquals("newtab", BrPro.shortcut(k("T"), true, false, false))
        assertEquals("reopen", BrPro.shortcut(k("T"), true, true, false))
        assertEquals("private", BrPro.shortcut(k("N"), true, true, false))
        assertEquals("close", BrPro.shortcut(k("W"), true, false, false))
        assertEquals("next", BrPro.shortcut(k("TAB"), true, false, false))
        assertEquals("prev", BrPro.shortcut(k("TAB"), true, true, false))
        assertEquals("tab1", BrPro.shortcut(k("1"), true, false, false))
        assertEquals("tab9", BrPro.shortcut(k("9"), true, false, false))
        assertEquals("zoom0", BrPro.shortcut(k("0"), true, false, false))
        assertEquals("address", BrPro.shortcut(k("L"), true, false, false))
        assertEquals("back", BrPro.shortcut(k("DPAD_LEFT"), false, false, true))
        assertEquals("fwd", BrPro.shortcut(k("DPAD_RIGHT"), false, false, true))
        assertEquals("reload", BrPro.shortcut(k("F5"), false, false, false))
        assertEquals("tasks", BrPro.shortcut(k("ESCAPE"), false, true, false))
        // מה שהדף והשדות צריכים — לא נתפס
        for (n in listOf("C", "V", "A", "X", "Z", "Y")) assertNull(n, BrPro.shortcut(k(n), true, false, false))
        assertNull(BrPro.shortcut(k("T"), false, false, false))
        assertNull(BrPro.shortcut(k("ESCAPE"), false, false, false))
        assertNull(BrPro.shortcut(k("DPAD_LEFT"), false, false, false))
        // כל פעולה ברשימת העזרה היא פעולה שהקיצורים מחזירים
        val ids = setOf("newtab", "private", "close", "reopen", "next", "prev", "tab1", "address", "reload", "find", "star", "history", "downloads", "marks",
            "back", "fwd", "zoomin", "split", "tasks", "clear", "keys")
        assertTrue(BrPro.KEYS_HELP.all { it.second in ids })
    }

    @Test fun toolbarSwipe() {
        assertEquals(1, BrPro.swipe(-200f, 10f, 100f, false))
        assertEquals(-1, BrPro.swipe(200f, -10f, 100f, false))
        assertEquals(2, BrPro.swipe(5f, 150f, 100f, false))       // הסרגל למעלה — גרירה למטה
        assertEquals(0, BrPro.swipe(5f, -150f, 100f, false))
        assertEquals(2, BrPro.swipe(5f, -150f, 100f, true))       // הסרגל למטה — גרירה למעלה
        assertEquals(0, BrPro.swipe(120f, 110f, 100f, false))     // אלכסון — כלום
        assertEquals(0, BrPro.swipe(50f, 0f, 100f, false))
    }

    @Test fun sessionsAndGroups() {
        var n = 0
        val id = { "s" + (++n) }
        val a = listOf("https://a.com" to "A", "https://b.com" to "B")
        var l = BrPro.pushSession(emptyList(), a, 1_000L, id)
        assertEquals(1, l.size); assertTrue(l[0].auto)
        // אותן כתובות — רק הזמן
        l = BrPro.pushSession(l, a, 99 * 60_000L, id)
        assertEquals(1, l.size); assertEquals(99 * 60_000L, l[0].at)
        // תוך חצי שעה — מחליף את האחרון
        l = BrPro.pushSession(l, a + ("https://c.com" to "C"), 100 * 60_000L, id)
        assertEquals(1, l.size); assertEquals(3, l[0].tabs.size)
        // אחרי חצי שעה — סשן חדש, החדש ראשון
        l = BrPro.pushSession(l, listOf("https://d.com" to "D"), 200 * 60_000L, id)
        assertEquals(2, l.size); assertEquals("https://d.com", l[0].tabs[0].first)
        // רק כתובות http, ובלי כרטיסיות — לא משתנה
        assertEquals(l, BrPro.pushSession(l, listOf("" to "", "about:blank" to ""), 300 * 60_000L, id))
        // עד 10 סשנים
        var m = l
        for (i in 1..20) m = BrPro.pushSession(m, listOf("https://x$i.com" to ""), (300 + i * 40) * 60_000L, id)
        assertEquals(BrPro.SESSIONS_MAX, m.count { it.auto })
        // קבוצה עם שם — לפני הסשנים, ושם קיים מוחלף
        m = BrPro.saveGroup(m, " עבודה ", a, 5L, id)
        m = BrPro.saveGroup(m, "עבודה", listOf("https://z.com" to "Z"), 6L, id)
        assertEquals(1, m.count { !it.auto && it.name == "עבודה" })
        assertEquals("https://z.com", m.first { !it.auto }.tabs[0].first)
        assertEquals(m, BrPro.saveGroup(m, "  ", a, 7L, id))
        // שמירה וקריאה
        val back = BrPro.setsDecode(BrPro.setsEncode(m))
        assertEquals(m, back)
        assertTrue(BrPro.setsDecode("not json").isEmpty())
        assertTrue(BrPro.setsDecode("""[{"id":"q","n":"x","at":1,"a":false,"t":[["javascript:1",""]]}]""").isEmpty())
    }

    @Test fun memorySaver() {
        assertEquals(5, BrPro.liveCap(5, 0, false))
        assertEquals(2, BrPro.liveCap(5, 1, false))
        assertEquals(2, BrPro.liveCap(5, 0, true))
        assertEquals(1, BrPro.liveCap(5, 2, false))
        assertEquals(1, BrPro.liveCap(1, 1, true))
        assertFalse(BrPro.sleepy(99 * 60_000L, 0, false, false))      // רגיל — רק לפי הזיכרון
        assertTrue(BrPro.sleepy(21 * 60_000L, 1, false, false))
        assertFalse(BrPro.sleepy(19 * 60_000L, 1, false, false))
        assertTrue(BrPro.sleepy(6 * 60_000L, 2, false, false))
        assertTrue(BrPro.sleepy(11 * 60_000L, 0, true, false))       // חיסכון הסוללה של הטלפון
        assertFalse(BrPro.sleepy(99 * 60_000L, 2, true, true))       // מנגנת — אף פעם
    }

    @Test fun quickDeleteDeskAndColors() {
        assertEquals(listOf(15, 60, 1440), BrPro.QUICK)
        assertEquals(1_000_000L - 15 * 60_000L, BrPro.since(1_000_000L, 15))
        assertTrue(BrPro.desk(0, 900)); assertFalse(BrPro.desk(0, 411))
        assertTrue(BrPro.desk(1, 360)); assertFalse(BrPro.desk(2, 1200))
        assertNull(BrPro.userColor(-1)); assertNull(BrPro.userColor(99))
        assertEquals(BrPro.USER_COLORS[0], BrPro.userColor(0))
    }
}
