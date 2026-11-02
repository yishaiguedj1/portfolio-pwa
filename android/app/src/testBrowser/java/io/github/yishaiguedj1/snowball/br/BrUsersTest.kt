package io.github.yishaiguedj1.snowball.br

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 27/10/2026: כמה משתמשים בדפדפן — הרשימה, המזהים והשמות של האחסון */
class BrUsersTest {
    @Test fun mainAlwaysFirstAndOnlyValidIds() {
        val l = BrUsers.decode("""[{"id":"ab12"},{"id":"../x"},{"id":"ab12"},{"id":"","em":"a@b.c"},{"id":"ZZ"}]""")
        assertEquals(listOf("", "ab12"), l.map { it.id })
        assertEquals("a@b.c", l[0].em)
        assertEquals(listOf(""), BrUsers.decode("not json").map { it.id })
        assertEquals(l, BrUsers.decode(BrUsers.encode(l)))
    }

    @Test fun namesKeepMainWhereItWas() {
        assertEquals("br", BrUsers.relDir(""))
        assertEquals("br/u/ab12", BrUsers.relDir("ab12"))
        assertEquals("br_cloud", BrUsers.prefsName("", "br_cloud"))
        assertEquals("br_cloud_uab12", BrUsers.prefsName("ab12", "br_cloud"))
        assertEquals("snb_br_sync", BrUsers.keyAlias(""))
        assertNull(BrUsers.profileName(""))
        assertEquals("u_ab12", BrUsers.profileName("ab12"))
    }

    @Test fun newIdIsSafeAndUnique() {
        var x = 0L
        val id = BrUsers.newId(listOf("1", "2")) { ++x }
        assertTrue(BrUsers.validId(id)); assertFalse(id in listOf("1", "2"))
        assertFalse(BrUsers.validId("a/b")); assertFalse(BrUsers.validId("AB")); assertFalse(BrUsers.validId("1234567890123"))
    }

    /** הגל השני: צבע לכל משתמש — נשמר ונקרא; רשומה ישנה בלי צבע = ‎-1 */
    @Test fun colorPerUser() {
        val l = listOf(BrUsers.U(""), BrUsers.U("ab12", c = 3))
        assertEquals(l, BrUsers.decode(BrUsers.encode(l)))
        assertEquals(-1, BrUsers.decode("""[{"id":""}]""")[0].c)
        assertEquals(-1, BrUsers.decode("""[{"id":"","c":999}]""")[0].c)
    }
}
