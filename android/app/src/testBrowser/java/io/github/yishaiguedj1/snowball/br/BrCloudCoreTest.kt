package io.github.yishaiguedj1.snowball.br

import io.github.yishaiguedj1.snowball.br.BrCloudCore.Rec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 27/10/2026: הסנכרון בענן בין המכשירים — שני מכשירים ו"Drive" מדומה (קובץ לכל מכשיר), כמו בשטח */
class BrCloudCoreTest {
    /** מכשיר: מה שיש בו (local), מה שהיה בסבב הקודם (base), והקובץ שלו בענן (own). השעון שלו מוזז ב־skew */
    private inner class Dev(val id: String, val skew: Long = 0) {
        val hlc = BrCloudCore.Hlc(id)
        var local = HashMap<String, String>()
        var base = HashMap<String, String>()
        val own = HashMap<String, Rec>()
        fun sync(now: Long, seed: (String, String?) -> Long? = { _, _ -> null }): Boolean {
            // הקבצים של האחרים — דרך הקידוד, כמו שיורדים מ־Drive
            val remote = drive.filterKeys { it != id }.values.map { BrCloudCore.decode(it)!!.second }
            val st = BrCloudCore.step(local, base, own, remote, hlc, now + skew, seed)
            local = HashMap(st.view); base = HashMap(st.view)
            if (st.ownChanged || id !in drive) drive[id] = BrCloudCore.encode(id, own)
            return st.ownChanged
        }
    }
    private val drive = HashMap<String, ByteArray>()

    @Test fun addEditDeleteTravel() {
        val a = Dev("A"); val b = Dev("B")
        a.sync(1000); b.sync(1000)
        a.local["m:x.com"] = "x"; a.sync(2000); b.sync(2100)
        assertEquals("x", b.local["m:x.com"])
        b.local["m:x.com"] = "x2"; b.sync(3000); a.sync(3100)
        assertEquals("x2", a.local["m:x.com"])
        a.local.remove("m:x.com"); a.sync(4000); b.sync(4100)
        assertFalse("מחיקה עוברת", "m:x.com" in b.local)
        // סבב בלי שינוי — הקובץ לא נכתב שוב
        assertFalse(a.sync(5000)); assertFalse(b.sync(5000))
    }

    @Test fun lastWriterWinsEvenWithSkewedClock() {
        val a = Dev("A"); val b = Dev("B", skew = -3_600_000)   // השעון של B מאחר בשעה
        a.sync(1000); b.sync(1000)
        a.local["p:eng"] = "bing"; a.sync(10_000_000)
        b.sync(10_000_100)
        assertEquals("bing", b.local["p:eng"])
        // B משנה אחרי שראה את A — גובר למרות שהשעון שלו מאחר
        b.local["p:eng"] = "ddg"; b.sync(10_000_200); a.sync(10_000_300)
        assertEquals("ddg", a.local["p:eng"])
        assertEquals("ddg", b.local["p:eng"])
    }

    @Test fun concurrentEditVsDelete() {
        val a = Dev("A"); val b = Dev("B")
        a.local["m:x"] = "1"; a.sync(1000); b.sync(1000)
        a.local["m:x"] = "2"; a.sync(2000)          // שינוי
        b.local.remove("m:x"); b.sync(3000)          // מחיקה מאוחרת יותר, לפני ש־B ראה את השינוי
        a.sync(3100); b.sync(3200)
        assertFalse("m:x" in a.local); assertFalse("m:x" in b.local)
    }

    @Test fun firstSyncSeedsWithItemTime() {
        val a = Dev("A")
        a.local["m:old"] = "o"; a.sync(1000)
        a.local.remove("m:old"); a.sync(5000)                 // נמחקה ב־5000
        a.local["p:eng"] = "bing"; a.sync(6000)
        // מכשיר חדש עם סימנייה מאותו אתר שנוספה ב־2000, והגדרה משלו
        val b = Dev("B")
        b.local["m:old"] = "o"; b.local["p:eng"] = "google"; b.local["m:mine"] = "m"
        b.sync(7000) { k, _ -> when { k.startsWith("m:") -> 2000L; k.startsWith("p:") -> 0L; else -> null } }
        assertFalse("מחיקה מאוחרת מהפריט גוברת", "m:old" in b.local)
        assertEquals("ההגדרות של החשבון נלקחות", "bing", b.local["p:eng"])
        assertEquals("m", b.local["m:mine"])
        a.sync(7100)
        assertEquals("מה שהיה רק במכשיר החדש מגיע לאחרים", "m", a.local["m:mine"])
        assertEquals("bing", a.local["p:eng"])
    }

    @Test fun reEnabledTypeSeedsWithItemTime() {
        // A מחק היסטוריה ב־5000; ב־B ההיסטוריה הייתה כבויה (אין בבסיס אף h:) ונדלקה — הביקור הישן שלו לא חוזר
        val a = Dev("A"); val b = Dev("B")
        a.local["h:v"] = "v"; a.local["m:x"] = "x"; a.sync(1000)
        a.local.remove("h:v"); a.sync(5000)
        b.local["m:x"] = "x"; b.sync(6000) { _, _ -> 1000L }
        b.local["h:v"] = "v"; b.sync(7000) { k, _ -> if (k.startsWith("h:")) 2000L else null }
        assertFalse("h:v" in b.local)
        assertTrue("m:x" in b.local)
    }

    @Test fun prunedFromOtherFileIsNotDeletedHere() {
        val a = Dev("A"); val b = Dev("B")
        a.local["h:x"] = "v"; a.sync(1000); b.sync(1100)
        assertEquals("v", b.local["h:x"])
        a.own.remove("h:x"); drive["A"] = BrCloudCore.encode("A", a.own)   // יצא מהקובץ של A כי הוא ישן
        b.sync(1200)
        assertEquals("v", b.local["h:x"])
    }

    @Test fun gcDropsOldTombsAndHistory() {
        val now = 400L * 86_400_000
        val own = hashMapOf(
            "m:a" to Rec(null, BrCloudCore.clock(now - BrCloudCore.TOMB_TTL - 1, 0, "A")),
            "m:b" to Rec(null, BrCloudCore.clock(now - 1000, 0, "A")),
            "h:old" to Rec("v", BrCloudCore.clock(now - BrCloudCore.HIST_TTL - 1, 0, "A")),
            "h:new" to Rec("v", BrCloudCore.clock(now - 1000, 0, "A")),
            "m:keep" to Rec("v", BrCloudCore.clock(1, 0, "A")))
        assertTrue(BrCloudCore.gc(own, now))
        assertEquals(setOf("m:b", "h:new", "m:keep"), own.keys)
        val many = HashMap<String, Rec>()
        for (i in 0 until BrCloudCore.HIST_MAX + 10) many["h:$i"] = Rec("v", BrCloudCore.clock(now - 100_000 + i, 0, "A"))
        BrCloudCore.gc(many, now)
        assertEquals(BrCloudCore.HIST_MAX, many.size)
        assertTrue("החדשים נשארים", "h:${BrCloudCore.HIST_MAX + 9}" in many && "h:0" !in many)
    }

    @Test fun fileRoundTripAndCorrupt() {
        val r = hashMapOf("m:a\tb" to Rec("כותרת\nעם\tטאב\\ו", BrCloudCore.clock(5, 1, "A")), "m:z" to Rec(null, BrCloudCore.clock(6, 0, "A")))
        val (dev, back) = BrCloudCore.decode(BrCloudCore.encode("A", r))!!
        assertEquals("A", dev); assertEquals(r, back)
        assertNull(BrCloudCore.decode("not gzip".toByteArray()))
        assertNull(BrCloudCore.decode(BrCloudCore.gz("other\tA\n")))
        assertEquals(listOf("https://a.com", "t t", "5", "1"), BrCloudCore.parts(BrCloudCore.markVal("https://a.com", "t\u001ft", 5, true)))
        // 27/10/2026: תיקייה ומקום ב־Chrome — אותה כתובת בשתי תיקיות = שתי רשומות, והמפתח רק ממה שברשומה
        assertEquals(listOf("https://a.com", "t", "5", "1", "b/Learning", "3"), BrCloudCore.parts(BrCloudCore.markVal("https://a.com", "t", 5, true, "b/Learning", 3)))
        assertNotEquals(BrCloudCore.markKey("a.com", "b/X", 0), BrCloudCore.markKey("a.com", "o", 0))
        assertEquals("m:a.com", BrCloudCore.markKey("a.com", "", -1))
    }

    @Test fun encryptedFiles() {
        val k = ByteArray(32) { it.toByte() }; val other = ByteArray(32) { (it + 1).toByte() }
        val plain = BrCloudCore.encode("A", hashMapOf("m:x" to Rec("סוד", BrCloudCore.clock(5, 0, "A"))))
        val e = BrCloudCore.seal(k, 's', "snbc-A-d", plain)
        assertTrue(BrCloudCore.isSealed(e) && !BrCloudCore.isSealed(plain))
        assertFalse("בלי המפתח אין טקסט גלוי", String(e, Charsets.ISO_8859_1).contains("m:x"))
        assertEquals('s', BrCloudCore.kidOf(e))
        assertTrue(BrCloudCore.open(k, "snbc-A-d", e)!!.contentEquals(plain))
        assertNull("מפתח של משתמש אחר", BrCloudCore.open(other, "snbc-A-d", e))
        assertNull("קובץ של מכשיר אחד בשם של אחר", BrCloudCore.open(k, "snbc-B-d", e))
        val bad = e.copyOf(); bad[bad.size - 1] = (bad[bad.size - 1] + 1).toByte()
        assertNull("שובש", BrCloudCore.open(k, "snbc-A-d", bad))
        assertNull("לא מוצפן", BrCloudCore.open(k, "snbc-A-d", plain))
        assertFalse("IV אקראי — אותו תוכן, הצפנה אחרת", BrCloudCore.seal(k, 's', "snbc-A-d", plain).contentEquals(e))
    }

    @Test fun clockOrderIsStringOrder() {
        val h = BrCloudCore.Hlc("A")
        val c1 = h.next(1000); val c2 = h.next(1000); val c3 = h.next(999)   // השעון חזר אחורה — עדיין עולה
        assertTrue(c1 < c2 && c2 < c3)
        h.see(BrCloudCore.clock(50_000, 7, "B"))
        assertTrue(h.next(1000) > BrCloudCore.clock(50_000, 7, "B"))
        assertEquals(50_000L, BrCloudCore.wallOf(BrCloudCore.clock(50_000, 7, "B")))
    }

    @Test fun sessionsSendAndResume() {
        val now = 10L * 86_400_000
        val t = BrCloudCore.STab("https://a.com/p", "כותרת\tא", now - 1000, 0.42f, "המשפט שעל המסך", 73.5f)
        val s = BrCloudCore.Session("A", "Pixel 9", "p", now, listOf(t),
            listOf(BrCloudCore.Send(3, "B", t, now - 500), BrCloudCore.Send(4, "C", t, now - 400)), mapOf("B" to 9L))
        val back = BrCloudCore.decodeSession(BrCloudCore.encodeSession(s))!!
        assertEquals(s, back)
        // ל־B מחכה שליחה 3; אחרי שאישר (acks של B: A→3) — יוצאת מהקובץ של A
        assertEquals(listOf(3L), BrCloudCore.inbox(listOf(back), "B", emptyMap()).map { it.second.id })
        assertTrue(BrCloudCore.inbox(listOf(back), "B", mapOf("A" to 3L)).isEmpty())
        val sb = BrCloudCore.Session("B", "Tab", "t", now, emptyList(), acks = mapOf("A" to 3L))
        assertEquals(listOf(4L), BrCloudCore.pruneSends(s.sends, listOf(sb), "A", now).map { it.id })
        // המשך מ־A: רק אם לא פתוחה כאן, לא נסגרה ההצעה, וביממה האחרונה
        assertEquals(t, BrCloudCore.resume(listOf(back), emptySet(), emptySet(), now)?.second)
        assertNull(BrCloudCore.resume(listOf(back), setOf(BrSync.key(t.u)), emptySet(), now))
        assertNull(BrCloudCore.resume(listOf(back), emptySet(), setOf(BrCloudCore.resumeId(t)), now))
        assertNull(BrCloudCore.resume(listOf(back), emptySet(), emptySet(), now + BrCloudCore.RESUME_MS + 2000))
        assertNull(BrCloudCore.decodeSession(BrCloudCore.gz("snbs1\tA\n")))
    }
}
