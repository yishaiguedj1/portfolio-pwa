package io.github.yishaiguedj1.snowball

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** 22/10/2026: דפדפן הציד — אילו בקשות הן סרטון, ובלי כפולים / קטעים / פרסומות */
class HuntMediaTest {
    @Test fun kinds() {
        assertEquals(HuntMedia.Kind.HLS, HuntMedia.classify("https://cdn.site.com/v/master.m3u8?token=1")!!.kind)
        assertEquals(HuntMedia.Kind.DASH, HuntMedia.classify("https://cdn.site.com/v/manifest.mpd")!!.kind)
        assertEquals(HuntMedia.Kind.FILE, HuntMedia.classify("https://cdn.site.com/clip.MP4")!!.kind)
        assertEquals(HuntMedia.Kind.HLS, HuntMedia.classify("https://x.akamaized.net/i/v/index.ism/manifest(format=m3u8-aapl)")!!.kind)
    }

    @Test fun ignored() {
        listOf("https://cdn.site.com/v/seg-001.ts", "https://cdn.site.com/v/chunk-5.m4s", "https://cdn.site.com/page.html",
            "https://pubads.g.doubleclick.net/ad.mp4", "https://cdn.site.com/preview/clip.mp4", "blob:https://site.com/abc",
            "javascript:void(0)", "https://cdn.site.com/thumb.jpg").forEach { assertNull(it, HuntMedia.classify(it)) }
    }

    @Test fun found() {
        val f = HuntMedia.Found()
        assertTrue(f.add(HuntMedia.classify("https://c.com/a/clip.mp4?sig=1")!!))
        assertTrue(!f.add(HuntMedia.classify("https://c.com/a/clip.mp4?sig=2")!!))          // אותו קובץ, חתימה אחרת
        assertTrue(f.add(HuntMedia.classify("https://c.com/h/master.m3u8")!!))
        assertTrue(!f.add(HuntMedia.classify("https://c.com/h/720p.m3u8")!!))              // רשימת משנה של אותה ראשית
        assertEquals(HuntMedia.Kind.HLS, f.list.first().kind)                               // הזרם לפני הקובץ
        assertEquals(2, f.size)
    }

    /* 25/10/2026: מעבר בין שיעורים באתר של "דף אחד" — רק מה שנראה ממש לפני המעבר נשאר */
    @Test fun navigated() {
        val f = HuntMedia.Found()
        f.add(HuntMedia.classify("https://c.com/l1/master.m3u8")!!, 1_000)
        f.add(HuntMedia.classify("https://d.com/l2/master.m3u8")!!, 9_500)            // הנגן החדש — רגע לפני שהכתובת התעדכנה
        assertTrue(f.navigated(10_000))
        assertEquals(listOf("https://d.com/l2/master.m3u8"), f.list.map { it.url })
        assertTrue(!f.navigated(10_100))
        assertTrue(f.add(HuntMedia.classify("https://c.com/l1/master.m3u8")!!, 20_000))  // חזרה לשיעור הראשון — מוצע שוב
        assertTrue(HuntMedia.samePage("https://s.com/a?x=1#t", "https://s.com/a?x=1"))
        assertTrue(!HuntMedia.samePage("https://s.com/s/1/abc", "https://s.com/s/1/def"))
    }
}
