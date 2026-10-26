package io.github.yishaiguedj1.snowball.br

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** 26/10/2026: Studio Browser שלב 3 — חסימת פרסומות ומעקב והגדרות לכל אתר (BrShield) */
class BrShieldTest {
    @Test fun site() {
        assertEquals("ynet.co.il", BrShield.site("www.news.ynet.co.il"))
        assertEquals("example.com", BrShield.site("a.b.example.com"))
        assertEquals("bbc.co.uk", BrShield.site("BBC.CO.UK."))
        assertEquals("localhost", BrShield.site("localhost"))
    }

    @Test fun blocksThirdPartyAds() {
        assertTrue(BrShield.blocks("securepubads.g.doubleclick.net", "ynet.co.il"))
        assertTrue(BrShield.blocks("www.google-analytics.com", "haaretz.co.il"))
        assertTrue(BrShield.blocks("cdn.taboola.com", "ynet.co.il"))
        // לא שם בסוף שמזכיר שם ברשימה
        assertFalse(BrShield.blocks("notdoubleclick.net", "ynet.co.il"))
        assertFalse(BrShield.blocks("doubleclick.net.example.com", "ynet.co.il"))
        // האתר עצמו — לא נחסם (גם כשהוא ברשימה)
        assertFalse(BrShield.blocks("www.taboola.com", "taboola.com"))
        assertFalse(BrShield.blocks("static.taboola.com", "blog.taboola.com"))
    }

    @Test fun neverBreaksCommonSites() {
        for (h in listOf("www.youtube.com", "i.ytimg.com", "rr3---sn-x.googlevideo.com", "www.gstatic.com", "fonts.googleapis.com",
                "www.googletagmanager.com", "connect.facebook.net", "accounts.google.com", "apis.google.com", "cdn.jsdelivr.net",
                "ajax.googleapis.com", "www.google.com", "challenges.cloudflare.com", "js.stripe.com", "www.paypal.com"))
            assertFalse(h, BrShield.blocks(h, "ynet.co.il"))
        // סיומת לבדה לא נבדקת
        assertFalse(BrShield.blocks("com", "ynet.co.il"))
        assertFalse(BrShield.blocks("", "ynet.co.il"))
    }

    @Test fun siteRulesRoundTrip() {
        val rules = listOf(BrShield.SiteRule("ynet.co.il", shield = false), BrShield.SiteRule("meet.google.com", cam = 1, mic = 1),
            BrShield.SiteRule("maps.example.com", loc = -1, speed = 150), BrShield.SiteRule("nothing.com"))
        val back = BrShield.decode(BrShield.encode(rules))
        assertEquals(3, back.size)                                   // בלי האתר שאין לו שום הגדרה
        assertEquals(rules[0], back["ynet.co.il"])
        assertEquals(rules[1], back["meet.google.com"])
        assertEquals(rules[2], back["maps.example.com"])
        // שורות פגומות / ערכים מחוץ לטווח / שם לא חוקי — לא נכנסים כמו שהם
        val bad = BrShield.decode("a.com|1|9|-7|0|333\nbad host|0|0|0|0|100\nshort|1\nb.com|1|0|0|0|125")
        assertEquals(1, bad["a.com"]!!.cam); assertEquals(-1, bad["a.com"]!!.mic); assertEquals(100, bad["a.com"]!!.speed)
        assertFalse("bad host" in bad); assertFalse("short" in bad)
        assertEquals(125, bad["b.com"]!!.speed)
    }

    @Test fun speedScript() {
        assertTrue(BrShield.speedJs(150).contains("__snbRate=1.5"))
        assertTrue(BrShield.speedJs(9999).contains("__snbRate=4.0"))
        assertTrue(BrShield.SPEEDS.contains(100))
    }
}
