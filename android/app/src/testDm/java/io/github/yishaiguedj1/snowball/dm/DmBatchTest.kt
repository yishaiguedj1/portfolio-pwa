package io.github.yishaiguedj1.snowball.dm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream

/** שלב 3: הדבקת רשימה, שחזור מגיבוי, בדיקת שלמות */
class DmBatchTest {
    @Test fun linksFromText() {
        val t = "שלום https://a.com/1.zip, וגם (https://b.com/x?y=1).\nשוב https://a.com/1.zip\nhttp://c.org/f.iso\nלא קישור: ftp://x"
        assertEquals(listOf("https://a.com/1.zip", "https://b.com/x?y=1", "http://c.org/f.iso"), DmLink.all(t))
        assertEquals(DmLink.MAX_BATCH, DmLink.all((1..500).joinToString("\n") { "https://a.com/$it" }).size)
        assertTrue(DmLink.all("").isEmpty())
    }

    @Test fun parseLinksAndBackup() {
        val p = DmImport.parse("https://a.com/1 https://a.com/2")
        assertTrue(p is DmImport.Parsed.Links && p.urls.size == 2)
        assertTrue(DmImport.parse("  \n ") is DmImport.Parsed.Empty)
        // ייצוא של DM → משימות חדשות בתור: בלי מקטעים, בלי uri, בלי מצב "הסתיים"
        val t = DmTask("abc12345", "https://a.com/f.bin").apply { name = "f.bin"; state = DmState.DONE; uri = "content://x"; segs = mutableListOf(Seg(0, 10, 10)); total = 10 }
        val b = DmImport.parse(DmTask.listJson(listOf(t)))
        assertTrue(b is DmImport.Parsed.Backup)
        val r = (b as DmImport.Parsed.Backup).tasks.single()
        assertEquals("https://a.com/f.bin", r.url); assertEquals("f.bin", r.name)
        assertEquals(DmState.QUEUED, r.state); assertEquals("", r.uri); assertTrue(r.segs.isEmpty()); assertEquals(-1L, r.total)
    }

    @Test fun freshSkipsKnownAndRenumbers() {
        val a = DmTask("id000001", "https://a.com/1"); val b = DmTask("id000002", "https://a.com/2"); val c = DmTask("id000003", "https://a.com/2")
        var n = 0
        val out = DmImport.fresh(listOf(a, b, c), have = setOf("https://a.com/1"), ids = setOf("id000002")) { "new0000${++n}" }
        assertEquals(listOf("https://a.com/2"), out.map { it.url })
        assertEquals("new00001", out[0].id)
    }

    @Test fun hashes() {
        val data = "hello".toByteArray()
        assertEquals("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", DmHash.digest(ByteArrayInputStream(data), "SHA-256"))
        assertEquals("5d41402abc4b2a76b9719d911017c592", DmHash.digest(ByteArrayInputStream(data), "MD5"))
        assertEquals("SHA-256", DmHash.algoOf("SHA256: 2CF24DBA5FB0A30E26E83B2AC5B9E29E1B161E5C1FA7425E73043362938B9824  hello.txt"))
        assertEquals("MD5", DmHash.algoOf("5d41402abc4b2a76b9719d911017c592"))
        assertNull(DmHash.algoOf("abc"))
        assertEquals(true, DmHash.matches("5d41402abc4b2a76b9719d911017c592", "MD5 (hello) = 5D41402ABC4B2A76B9719D911017C592"))
        assertEquals(false, DmHash.matches("5d41402abc4b2a76b9719d911017c592", "00000000000000000000000000000000"))
        assertNull(DmHash.matches("x", "לא סיכום"))
    }
}

class DmHostRulesTest {
    @Test fun learnsAndRecovers() {
        assertEquals(4, DmHostRules.next(0, 8, true, 8))      // הגביל ב־8 → 4
        assertEquals(2, DmHostRules.next(4, 4, true, 8))
        assertEquals(1, DmHostRules.next(1, 1, true, 8))      // לא פחות מ־1
        assertEquals(4, DmHostRules.next(2, 2, false, 8))     // נקייה → צעד למעלה
        assertEquals(0, DmHostRules.next(4, 4, false, 8))     // הגיע לברירת המחדל → בלי כלל
        assertEquals(0, DmHostRules.next(0, 8, false, 8))
        assertEquals(3, DmHostRules.conns(3, 8)); assertEquals(8, DmHostRules.conns(0, 8)); assertEquals(2, DmHostRules.conns(4, 2))
    }

    @Test fun storage() {
        val m = DmHostRules.parse("a.com=2;bad host=3;b.org=9;c.net=x;d.io=1")
        assertEquals(mapOf("a.com" to 2, "d.io" to 1), m)
        assertEquals("a.com=2;d.io=1", DmHostRules.dump(m))
        assertEquals(DmHostRules.MAX_HOSTS, DmHostRules.parse(DmHostRules.dump((1..150).associate { "h$it.com" to 2 })).size)
    }
}
