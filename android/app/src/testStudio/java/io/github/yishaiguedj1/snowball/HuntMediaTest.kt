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
        // 26/10/2026: פרסומות וידאו
        listOf("https://v.fwmrm.net/ad/g/1/clip.mp4", "https://cdn.spotxchange.com/media/v.mp4", "https://s.innovid.com/x/ad.m3u8",
            "https://cdn.site.com/preroll/intro.mp4", "https://cdn.site.com/media/vast/ad1.mp4", "https://a.teads.tv/v/1.mp4",
            "https://cdn.site.com/vpaid/clip.mp4").forEach { assertNull(it, HuntMedia.classify(it)) }
        // לא פרסומת: מילים שמכילות "ad" ושמות כמו download / vastu / headline
        listOf("https://cdn.site.com/download/movie.mp4", "https://cdn.site.com/headline/clip.mp4", "https://skyfire.vimeocdn.com/1/a/v.mp4",
            "https://cdn.site.com/vastu/talk.mp4").forEach { assertTrue(it, HuntMedia.classify(it) != null) }
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
    /** 26/10: אותו קובץ עם חתימה אחרת בנתיב (רענון ב־Vimeo) = כפול; קבצים שונים — לא */
    @Test fun signedPathDedupe() {
        val a = "https://skyfire.vimeocdn.com/1793027351-0x12d667a707d12429a386b0a870fb95f41458ade4/98a3d4df/v2/playlist/av/primary/playlist.m3u8"
        val b = "https://skyfire.vimeocdn.com/1793030999-0x99ff00aa07d12429a386b0a870fb95f41458aaaa/98a3d4df/v2/playlist/av/primary/playlist.m3u8"
        assertEquals(HuntMedia.keyOf(a), HuntMedia.keyOf(b))
        val f = HuntMedia.Found()
        assertTrue(f.add(HuntMedia.classify(a)!!)); assertTrue(!f.add(HuntMedia.classify(b)!!))
        assertTrue(HuntMedia.keyOf("https://c.com/v/clip1.mp4") != HuntMedia.keyOf("https://c.com/v/clip2.mp4"))
        assertTrue(HuntMedia.keyOf("https://c.com/exp=1700000000~acl=x/a.mp4") == HuntMedia.keyOf("https://c.com/exp=1800000000~acl=y/a.mp4"))
        assertTrue(HuntMedia.keyOf("https://c.com/videos/98a3d4df/a.mp4") != HuntMedia.keyOf("https://c.com/videos/11223344/a.mp4"))
        // שם קובץ ארוך עם ספרות — לא חתימה
        assertTrue(HuntMedia.keyOf("https://c.com/v/lesson-2023-intro-part-one-final.mp4") != HuntMedia.keyOf("https://c.com/v/lesson-2023-intro-part-two-final.mp4"))
    }

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

    /* 26/10/2026: נגן ‎<video>‎ שמבקש קובץ בלי סיומת (Range) — ניחוש; קבצים סטטיים לא */
    @Test fun fromRequest() {
        val r = mapOf("Range" to "bytes=0-")
        assertEquals(HuntMedia.Kind.HLS, HuntMedia.fromRequest("https://c.com/v/master.m3u8", null)!!.kind)
        val g = HuntMedia.fromRequest("https://vod.c.com/stream/abc123?t=9", r)!!
        assertTrue(g.guess && g.kind == HuntMedia.Kind.FILE)
        assertNull(HuntMedia.fromRequest("https://vod.c.com/stream/abc123", null))
        assertNull(HuntMedia.fromRequest("https://c.com/app.js", r))
        assertNull(HuntMedia.fromRequest("https://c.com/seg-1.m4s", r))
        assertNull(HuntMedia.fromRequest("https://c.com/thumbnail/x", r))
        assertNull(HuntMedia.fromRequest("https://c.com/x", mapOf("range" to "items=0-9")))
        assertTrue(HuntMedia.fromRequest("https://c.com/x", mapOf("range" to "bytes=100-"))!!.guess)
    }

    /* 26/10/2026: הסקריפט בדף מדווח סוג לפי Content-Type של התשובה */
    @Test fun fromHook() {
        assertEquals(HuntMedia.Kind.HLS, HuntMedia.fromHook("@hls https://c.com/api/manifest?id=7")!!.kind)
        assertEquals(HuntMedia.Kind.DASH, HuntMedia.fromHook("@dash https://c.com/p/7")!!.kind)
        assertEquals(HuntMedia.Kind.FILE, HuntMedia.fromHook("@file https://c.com/media/7")!!.kind)
        assertEquals(HuntMedia.Kind.FILE, HuntMedia.fromHook("https://c.com/a.mp4")!!.kind)
        assertNull(HuntMedia.fromHook("@hls javascript:alert(1)"))
        assertNull(HuntMedia.fromHook("@file https://pubads.g.doubleclick.net/x"))
        assertNull(HuntMedia.fromHook("@zzz https://c.com/x"))
        assertNull(HuntMedia.fromHook(null))
    }

    @Test fun headOk() {
        val min = 1_000_000L
        assertTrue(HuntMedia.headOk("video/mp4", 50_000_000, true, min))
        assertTrue(HuntMedia.headOk("application/octet-stream", -1, true, min))
        assertTrue(!HuntMedia.headOk("", -1, true, min))                 // ניחוש בלי סוג — לא
        assertTrue(HuntMedia.headOk("", -1, false, min))                 // לפי סיומת בלי סוג — כן (כמו קודם)
        assertTrue(!HuntMedia.headOk("text/html", -1, false, min))       // דף כניסה
        assertTrue(!HuntMedia.headOk("video/mp4", 5_000, false, min))     // קטן מדי
        assertTrue(!HuntMedia.headOk("application/json", -1, true, min))
    }

    /* 26/10/2026: אתרים שהורדת מהם בדפדפן של DM — לבועה */
    @Test fun siteList() {
        assertEquals("schooler.biz", SiteList.hostOf("www.schooler.biz/s/1"))
        assertEquals("my.schooler.biz", SiteList.hostOf("https://my.schooler.biz/s/54113/x"))
        var l = SiteList.add(emptyList(), "my.schooler.biz")
        l = SiteList.add(l, "ted.com"); l = SiteList.add(l, "my.schooler.biz")
        assertEquals(listOf("my.schooler.biz", "ted.com"), l)
        assertEquals(l, SiteList.add(l, "localhost"))
        assertTrue(SiteList.has(l, "my.schooler.biz") && SiteList.has(l, "video.ted.com") && SiteList.has(l, "www.ted.com"))
        assertTrue(!SiteList.has(l, "schooler.biz") && !SiteList.has(l, "evilted.com"))
        assertEquals(l, SiteList.parse(l.joinToString("\n") + "\n\nbad\n"))
        assertEquals(SiteList.MAX, (1..400).fold(emptyList<String>()) { a, i -> SiteList.add(a, "s$i.com") }.size)
    }
}
