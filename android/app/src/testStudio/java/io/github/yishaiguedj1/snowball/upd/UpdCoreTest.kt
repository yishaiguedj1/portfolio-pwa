package io.github.yishaiguedj1.snowball.upd

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/* 08/11/2026: הליבה של העדכון העצמי — הצורה של latest.json (tools/apk-latest.js), ההחלטה ובדיקת הקובץ */
class UpdCoreTest {
    private val sha = "a".repeat(64)
    private val json = """{"v":1,"code":812,"name":"1.0.812","apps":{"app.thesnowball.studio":{"f":"the-snowball-studio.apk","n":1234,"h":"$sha"}}}"""

    @Test fun parsesOwnPackage() {
        val r = UpdCore.parse(json, "app.thesnowball.studio")!!
        assertEquals(812L, r.code); assertEquals("1.0.812", r.name); assertEquals("the-snowball-studio.apk", r.file)
        assertEquals(1234L, r.size); assertEquals(sha, r.sha)
    }

    @Test fun otherPackageOrJunkIsNull() {
        assertNull(UpdCore.parse(json, "app.thesnowball.academy"))
        assertNull(UpdCore.parse("not json", "app.thesnowball.studio"))
        assertNull(UpdCore.parse(json.replace("the-snowball-studio.apk", "../x.apk"), "app.thesnowball.studio"))   // רק שם קובץ
        assertNull(UpdCore.parse(json.replace(sha, "abc"), "app.thesnowball.studio"))   // sha256 מלא בלבד
        assertNull(UpdCore.parse(json.replace("\"code\":812", "\"code\":0"), "app.thesnowball.studio"))
    }

    @Test fun newerOnlyWhenHigher() {
        val r = UpdCore.parse(json, "app.thesnowball.studio")
        assertTrue(UpdCore.newer(811, r)); assertFalse(UpdCore.newer(812, r)); assertFalse(UpdCore.newer(900, r)); assertFalse(UpdCore.newer(1, null))
    }

    @Test fun verifyChecksSizeAndHash() {
        val f = File.createTempFile("upd", ".apk"); f.writeText("hello")
        val h = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"   // sha256("hello")
        assertTrue(UpdCore.verify(f, UpdCore.Rel(2, "", "a.apk", 5, h)))
        assertFalse(UpdCore.verify(f, UpdCore.Rel(2, "", "a.apk", 6, h)))
        assertFalse(UpdCore.verify(f, UpdCore.Rel(2, "", "a.apk", 5, sha)))
        f.delete()
    }

    @Test fun mb() { assertEquals("", UpdCore.mb(0)); assertEquals("8.4 MB", UpdCore.mb(8_808_038)); assertEquals("112 MB", UpdCore.mb(117_440_512)) }

    /* 09/11/2026: ההורדה שלנו עם המשך (במקום DownloadManager) */
    @Test fun resumeOffsets() {
        assertEquals(5000L, UpdCore.writeFrom(206, 5000))   // המשך מהמקום שנעצר
        assertEquals(0L, UpdCore.writeFrom(200, 5000))      // השרת התעלם מ־Range — מההתחלה
        assertEquals(0L, UpdCore.writeFrom(200, 0))
        assertNull(UpdCore.writeFrom(206, 0))               // 206 בלי שביקשנו — לא סומכים
        assertNull(UpdCore.writeFrom(404, 0))
        assertNull(UpdCore.writeFrom(416, 5000))
    }

    @Test fun transientCodes() {
        assertTrue(UpdCore.transient(503)); assertTrue(UpdCore.transient(429)); assertTrue(UpdCore.transient(416))
        assertFalse(UpdCore.transient(404)); assertFalse(UpdCore.transient(403))
    }
}
