package io.github.yishaiguedj1.snowball

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.json.JSONObject
import java.io.File

/**
 * 24/10/2026 — תרגום בטלפון, שלב 1: העבודה בטלפון. שני חלקים, כל אחד בשירות בחזית (PhService):
 *  up    — הקול בלי קידוד → העלאה → רישום → התחלת העבודה בשרת → השוטים וה־ffprobe → העלאת קובץ המדידות.
 *          השרת מתמלל ומתרגם בינתיים; הסרטון לא עוזב את הטלפון.
 *          שלב 2 (pw, 25/10/2026): המודלים → תמלול, דוברים ויישור בטלפון (PhLocal) → קובץ המילים → המדידות → התחלה.
 *          גם הקול לא עוזב את הטלפון.
 *  burn  — כשהתרגום מוכן: he.ass מהשרתון → ffmpeg (libass) → MediaCodec (חומרה) → הקול מהמקור → Movies/Studio.
 * כל שלב נשמר ברשומה (PhStore) — עצירה של המערכת באמצע = ממשיכים מאותו שלב (וההעלאה מאותו חלק).
 */
object PhWork {
    const val N_ID = 43
    const val N_DONE = 44
    private const val CH = "ph"

    class Stop(val code: String) : Exception(code)

    /** דיווח התקדמות לשרתון: רק הערך האחרון נשלח, קריאה אחת בכל רגע. עד 25/10/2026 כל דיווח נכנס לתור — כשקריאה לקחה
     *  יותר מ־5 שנ׳ התור גדל, ודף העבודה פיגר אחרי ההתראה (35% מול 51%, דיווח המשתמש) */
    class Latest(private val send: (JSONObject) -> Unit) {
        private val pending = java.util.concurrent.atomic.AtomicReference<JSONObject?>(null)
        private val q = java.util.concurrent.Executors.newSingleThreadExecutor()
        fun post(o: JSONObject) {
            if (pending.getAndSet(o) == null) try { q.execute { while (true) { val x = pending.getAndSet(null) ?: break; try { send(x) } catch (e: Throwable) {} } } } catch (e: Throwable) {}
        }
        /** ההודעה האחרונה ("הסתיים"/"נכשל") — אחרי כל מה שבדרך, ומחכים לה */
        fun last(o: JSONObject) { pending.set(null); try { q.execute { try { send(o) } catch (e: Throwable) {} } } catch (e: Throwable) {}; q.shutdown(); try { q.awaitTermination(30, java.util.concurrent.TimeUnit.SECONDS) } catch (e: Throwable) {} }
        fun stop() { pending.set(null); q.shutdown() }
    }

    /** קוד לכשל: שלנו כמו שהוא; כל חריגה אחרת — ‎x_<סוג החריגה>‎ (עד 25/10/2026 "fail" לכולן, ולא היה אפשר לדעת מה קרה) */
    fun codeOf(e: Throwable): String = (e as? Stop)?.code ?: (e as? PhNet.Err)?.code
        ?: ("x_" + e.javaClass.simpleName.lowercase().filter { it in 'a'..'z' || it in '0'..'9' }).take(32).let { if (it == "x_") "fail" else it }
            .also { android.util.Log.e("PhWork", "fail", e) }

    private fun net(r: JSONObject) = PhNet(r.getString("base"), r.getString("job"), r.getString("key"))
    private fun src(ctx: Context, r: JSONObject): File {
        val f = File(r.optString("src"))
        if (!f.isFile || !f.absolutePath.startsWith(ctx.noBackupFilesDir.absolutePath)) throw Stop("src_gone")
        return f
    }

    /* ---------------------------------------------------------------- up */
    fun up(ctx: Context, pid: String, stopped: () -> Boolean) {
        var r = PhStore.get(ctx, pid) ?: return
        val title = r.optString("name")
        val n = net(r)
        val work = PhStore.work(ctx, pid)
        // שלב 2: מה הטלפון עושה — גם לדף העבודה (op:'phProg', לפני שהעבודה מתחילה; בתור — בלי לעכב את העבודה)
        val pw0 = r.optBoolean("pw")
        val q = Latest { o -> n.call("phProg", JSONObject().put("ppr", o)) }
        var repAt = 0L; var repSt = ""
        fun rep(st: String, p: Float, e: String? = null) {
            if (!pw0 || r.optBoolean("started")) return
            val now = System.currentTimeMillis()
            if (st == repSt && e == null && now - repAt < 3000) return
            repAt = now; repSt = st
            val o = JSONObject().put("s", st).put("p", p.toDouble()); if (e != null) o.put("e", e)
            if (e != null) q.last(o) else q.post(o)
        }
        fun stage(st: String, text: Int, p: Float = -1f) {
            r = PhStore.update(ctx, pid) { it.put("st", st) } ?: r
            notify(ctx, progress(ctx, title, s(ctx, text), p))
            rep(st, p)
        }
        try {
            val f = src(ctx, r)
            val pw = r.optBoolean("pw")
            // 0. שלב 2 ("הכל בטלפון"): המודלים, ואז התמלול, הדוברים והיישור כאן — עולה רק קובץ המילים (בלי קול)
            if (pw && r.optString("wId").isEmpty()) {
                if (!PhModels.ready(ctx)) {
                    // גם בחבילת גלישה (בקשת המשתמש 25/10/2026 — עד היום רק ב־Wi‑Fi)
                    stage("models", R.string.phModels, 0f)
                    PhModels.fetch(ctx, stopped) { done, total ->
                        notify(ctx, progress(ctx, title, s(ctx, R.string.phModelsP, done shr 20, total shr 20), done.toFloat() / total))
                        rep("models", done.toFloat() / total) }
                }
                var lastSt = ""
                val wf = PhLocal.run(ctx, work, f, stopped) { st, p ->
                    if (st != lastSt) { lastSt = st; r = PhStore.update(ctx, pid) { it.put("st", st) } ?: r }
                    val txt = when (st) { "wav" -> R.string.phWav; "asr" -> R.string.phAsr; "diar" -> R.string.phDiar; else -> R.string.phAlign }
                    notify(ctx, progress(ctx, title, s(ctx, txt), p))
                    rep(st, p)
                }
                stage("upw", R.string.phUpW, 0f)
                val id = n.upload(wf, "application/json", "words.json", r.optString("wUp0"), r.optString("wUp"),
                    { id, up -> PhStore.update(ctx, pid) { it.put("wUp0", id).put("wUp", up) } }, stopped) {}
                val fr = n.call("phFile", JSONObject().put("which", "w").put("id", id))
                if (!fr.optBoolean("ok")) throw Stop(fr.optString("error", "file"))
                r = PhStore.update(ctx, pid) { it.put("wId", id) } ?: r
            }
            // 1. הקול כמו שהוא (שניות)
            if (!pw && r.optString("aId").isEmpty()) {
                val a = File(work, "audio.mka")
                if (!a.isFile || a.length() == 0L) {
                    stage("audio", R.string.phAudio)
                    val o = PhFf.run(ctx, PhCore.audioArgs(f.absolutePath, a.absolutePath), stop = stopped)
                    if (stopped()) throw Stop("stopped")
                    if (o.code != 0 || !a.isFile || a.length() == 0L) { a.delete(); throw Stop("no_audio") }
                }
                stage("upa", R.string.phUpA, 0f)
                val id = n.upload(a, "audio/x-matroska", title.substringBeforeLast('.') + ".audio.mka", r.optString("aUp0"), r.optString("aUp"),
                    { id, up -> PhStore.update(ctx, pid) { it.put("aUp0", id).put("aUp", up) } }, stopped) { p ->
                    notify(ctx, progress(ctx, title, s(ctx, R.string.phUpA), p)) }
                val fr = n.call("phFile", JSONObject().put("which", "a").put("id", id))
                if (!fr.optBoolean("ok")) throw Stop(fr.optString("error", "file"))
                r = PhStore.update(ctx, pid) { it.put("aId", id) } ?: r
                a.delete()
            }
            // 2. העבודה מתחילה בשרת (התמלול והתרגום רצים בזמן שהטלפון מודד את השוטים). "הכל בטלפון" — אחרי המדידות
            if (!pw && !r.optBoolean("started")) {
                stage("start", R.string.phStart)
                val sr = n.call("phStart", JSONObject().put("ov", r.optBoolean("ov")))
                if (!sr.optBoolean("ok")) throw Stop(sr.optString("error", "start"))
                r = PhStore.update(ctx, pid) { it.put("started", true) } ?: r
            }
            // 3. המדידות: ffprobe (נשמר בבחירה) + השוטים (כ־3 דק׳ לשעת סרטון)
            if (r.optString("mId").isEmpty()) {
                val m = File(work, "meta.json")
                if (!m.isFile) {
                    stage("shots", R.string.phShots)
                    val o = PhFf.run(ctx, PhCore.shotsArgs(f.absolutePath), stop = stopped) { it.contains("lavfi.scd") }
                    if (stopped()) throw Stop("stopped")
                    if (o.code != 0) throw Stop("shots")
                    val probe = r.optJSONObject("probe") ?: throw Stop("probe")
                    m.writeText(PhCore.meta(probe, PhCore.shots(o.err)).toString())
                }
                stage("upm", R.string.phUpM)
                val id = n.upload(m, "application/json", "meta.json", r.optString("mUp0"), r.optString("mUp"),
                    { id, up -> PhStore.update(ctx, pid) { it.put("mUp0", id).put("mUp", up) } }, stopped) {}
                val fr = n.call("phFile", JSONObject().put("which", "m").put("id", id))
                if (!fr.optBoolean("ok")) throw Stop(fr.optString("error", "file"))
                r = PhStore.update(ctx, pid) { it.put("mId", id) } ?: r
            }
            if (pw && !r.optBoolean("started")) {
                stage("start", R.string.phStartPw)
                val sr = n.call("phStart", JSONObject().put("ov", r.optBoolean("ov")))
                if (!sr.optBoolean("ok")) throw Stop(sr.optString("error", "start"))
                r = PhStore.update(ctx, pid) { it.put("started", true) } ?: r
            }
            // 4. שלב 3: גם שלבי הטקסט כאן (job.py בפייתון של האפליקציה) — השרת רק מעביר את הקריאות ל־Claude
            val pt = pw && r.optBoolean("pt")
            if (pt && !r.optBoolean("ptDone")) {
                q.stop()
                stage("text", R.string.phText)
                text(ctx, r, n, work, title, stopped)
                r = PhStore.update(ctx, pid) { it.put("ptDone", true) } ?: r
            }
            PhStore.update(ctx, pid) { it.put("st", "wait") }
            q.stop()
            nm(ctx).cancel(N_ID)
            nm(ctx).notify(N_DONE, if (pt) simple(ctx, s(ctx, R.string.phTextDone), s(ctx, R.string.phTextDoneS), webIntent(ctx, r, ""))
                else simple(ctx, s(ctx, R.string.phSent), s(ctx, R.string.phSentS), webIntent(ctx, r, "")))
        } catch (e: Throwable) {
            val code = codeOf(e)
            if (code == "stopped" || stopped()) { q.stop(); return }   // המערכת עצרה — ממשיכים בפעם הבאה מאותו שלב
            if (pw0 && !r.optBoolean("started")) rep("err", -1f, code.lowercase().filter { it in 'a'..'z' || it in '0'..'9' || it == '_' }.take(32).padEnd(2, '_')) else q.stop()
            PhStore.update(ctx, pid) { it.put("e", code).put("st", "err").put("est", r.optString("st")) }
            nm(ctx).cancel(N_ID)
            nm(ctx).notify(N_DONE, simple(ctx, s(ctx, R.string.phFailed), title, webIntent(ctx, r, code)))
        }
    }

    /* ---------------------------------------------------------------- burn */
    /** שלב 3: הטלפון לוקח את העבודה (phClaim — מפתח עבודה חדש) ומריץ job.py run ואז auto. כשל — job.py כבר דיווח
     *  לשרתון (קוד 1); קריסה של התהליך — מדווחים כאן (worker_crash), כמו agent.py בשרת */
    private fun text(ctx: Context, r: JSONObject, n: PhNet, work: File, title: String, stopped: () -> Boolean) {
        val cl = n.call("phClaim", JSONObject())
        if (!cl.optBoolean("ok")) throw Stop(cl.optString("error", "claim"))
        val jb = cl.getJSONObject("job")
        val job = File(PhPy.dir(ctx), "job.py").absolutePath
        val (rc0, t0) = PhPy.run(ctx, work, listOf("-u", job, "run", "--job", jb.getString("id"), "--key", jb.getString("key"), "--server", r.getString("base")), stopped)
        if (stopped()) throw Stop("stopped")
        if (rc0 != 0) throw Stop(if (rc0 == 2) "stopped_srv" else "pt_run")
        var last = ""
        val (rc, tail) = PhPy.run(ctx, work, listOf("-u", job, "auto"), stopped) {
            val (st, p) = PhPy.prog(work)
            if (st.isNotEmpty() && st != last) { last = st; notify(ctx, progress(ctx, title, s(ctx, textLabel(st)), p)) }
        }
        if (stopped()) throw Stop("stopped")
        when (rc) {
            0, 3 -> return
            1 -> throw Stop("pt_fail")           // job.py דיווח את הכשל לשרתון — הדף מציג אותו
            2 -> throw Stop("stopped_srv")       // השרתון ביקש לעצור (בוטלה / מתג החירום)
        }
        PhPy.run(ctx, work, listOf("-c", "import sys; sys.path.insert(0, " + JSONObject.quote(PhPy.dir(ctx).absolutePath) + ")\nimport job as J\n" +
            "J.Ctx(J.load_state()).report(fail=True, err='worker_crash', msg='התהליך בטלפון נעצר (קוד $rc)', force=True, usage=J.usage_safe())"), { false })
        throw Stop("pt_crash")
    }

    private fun textLabel(st: String) = when (st) {
        "tr" -> R.string.phTextTr; "al", "tl" -> R.string.phTextTl; "rv" -> R.string.phTextRv; else -> R.string.phTextSv
    }

    /* ---------------------------------------------------------------- video (29/10/2026) */
    /** הסרטון לענן (spec.vc) — בצילום של המשתמש העבודה חיכתה 1:20 ש׳ להעלאה מהדפדפן, שקופא כשהמסך כבוי. כאן: משימת UIDT
     *  (PhUpJob, אנדרואיד 14+) או השירות בחזית (מתחת ל־14), CONC חלקים במקביל, ממשיכה מהחלקים שכבר ב־R2. העבודה לא מחכה לה
     *  (המדידות במקום הסרטון) — היא לנגן מכל מכשיר, לשמירה ב־Drive ולהפקה מחדש בענן. מתחילה אחרי הקול (שלא יתחרו על הקו).
     *  true = נגמר (עלה / אין מה לעשות / שגיאה קבועה — מדווחת לדף), false = לנסות שוב (רשת, נעצר, הקול עוד לא עלה) */
    /** 29/10/2026: "ביטול" בהתראה של הסרטון (PhService.ACT_VCANCEL, אותו תהליך :ph) — עוצר את ההעלאה לענן בלבד; הכתוביות
     *  והצריבה בטלפון לא תלויות בה. נרשם vE = "cancel", כך שהמשימה לא חוזרת */
    @Volatile var vCancel = false

    fun video(ctx: Context, pid: String, stopped0: () -> Boolean, show: (Notification) -> Unit): Boolean {
        vCancel = false
        val stopped = { stopped0() || vCancel }
        var r = PhStore.get(ctx, pid) ?: return true
        if (!r.optBoolean("vc") || r.optString("vId").isNotEmpty() || r.optString("vE").isNotEmpty()) return true
        val t0 = System.currentTimeMillis()
        while (!r.optBoolean("pw") && r.optString("aId").isEmpty()) {
            if (r.optString("st") == "err") return true                  // הקול נעצר — "להמשיך" באתר (phgo) מתזמן שוב
            if (stopped() || System.currentTimeMillis() - t0 > VC_WAIT) return false
            Thread.sleep(3000)
            r = PhStore.get(ctx, pid) ?: return true
        }
        val f = try { src(ctx, r) } catch (e: Stop) { return true }
        val title = r.optString("name")
        val n = net(r)
        val size = maxOf(1L, f.length())
        val q = Latest { o -> n.call("phVp", o) }
        var shownP = -1; var repP = -1f; var repAt = 0L
        show(vprogress(ctx, title, 0f))
        return try {
            val id = n.uploadPar(f, vmime(f), title, JSONObject().put("v", true), r.optString("vUp0"), r.optString("vUp"),
                { id, up -> PhStore.update(ctx, pid) { it.put("vUp0", id).put("vUp", up) } }, stopped) { b ->
                val p = b.toFloat() / size
                val now = System.currentTimeMillis()
                if ((p * 100).toInt() != shownP) { shownP = (p * 100).toInt(); show(vprogress(ctx, title, p)) }
                if (p - repP >= 0.03f || now - repAt > 30_000L) { repP = p; repAt = now; q.post(JSONObject().put("p", p.toDouble())) }
            }
            q.stop()
            val fr = n.call("phFile", JSONObject().put("which", "v").put("id", id).put("v", true))
            if (!fr.optBoolean("ok")) throw Stop(fr.optString("error", "file"))
            PhStore.update(ctx, pid) { it.put("vId", id) }
            true
        } catch (e: Throwable) {
            q.stop()
            if (vCancel) {
                PhStore.update(ctx, pid) { it.put("vE", "cancel") }
                try { n.call("phVp", JSONObject().put("p", 0).put("e", "cancel")) } catch (x: Throwable) {}
                return true
            }
            val code = codeOf(e)
            if (code == "stopped" || stopped() || code in VC_RETRY) return false
            PhStore.update(ctx, pid) { it.put("vE", code) }
            try { n.call("phVp", JSONObject().put("p", 0).put("e", code.lowercase().filter { it in 'a'..'z' || it in '0'..'9' || it == '_' }.take(32).padEnd(2, '_'))) } catch (x: Throwable) {}
            true
        }
    }
    private const val VC_WAIT = 20 * 60_000L    // כמה מחכים לקול לפני שמשחררים את המשימה (היא מתוזמנת שוב)
    private val VC_RETRY = setOf("net", "rate_limited", "store", "up", "r2_nourls", "r2_none")   // חולפות — מנסים שוב
    private fun vmime(f: File) = when (f.extension.lowercase()) {
        "mp4", "m4v" -> "video/mp4"; "mov" -> "video/quicktime"; "mkv" -> "video/x-matroska"; "webm" -> "video/webm"; "avi" -> "video/x-msvideo"
        else -> "application/octet-stream"
    }
    const val N_VID = 45
    fun vprogress(ctx: Context, title: String, p: Float): Notification {
        val cancel = PendingIntent.getService(ctx, 13, Intent(ctx, PhService::class.java).setAction(PhService.ACT_VCANCEL), PendingIntent.FLAG_IMMUTABLE)
        return builder(ctx).setSmallIcon(android.R.drawable.stat_sys_upload).setContentTitle(title.ifEmpty { s(ctx, R.string.phTitle) })
            .setContentText(s(ctx, R.string.phUpV, (p * 100).toInt().coerceIn(0, 100))).setOngoing(true).setOnlyAlertOnce(true)
            .setProgress(100, (p * 100).toInt().coerceIn(0, 100), false)
            .addAction(Notification.Action.Builder(null, s(ctx, R.string.dlCancel), cancel).build()).build()
    }

    fun burn(ctx: Context, pid: String, stopped: () -> Boolean) {
        var r = PhStore.get(ctx, pid) ?: return
        val title = r.optString("name")
        val n = net(r)
        val work = PhStore.work(ctx, pid)
        val small = r.optString("pb") == "small"
        val t0 = System.currentTimeMillis()
        // ההתקדמות נשלחת בתהליכון אחד (רק הערך האחרון) — קריאה לרשת לא עוצרת את הקידוד, ו"הסתיים" לא נדרס ע"י אחוז שהגיע אחריו
        val q = Latest { o -> n.call("phBurn", JSONObject().put("pbn", o)) }
        fun rep(o: JSONObject) = q.post(o)
        fun repDone(o: JSONObject) = q.last(o)
        try {
            val f = src(ctx, r)
            r = PhStore.update(ctx, pid) { it.put("st", "burn").remove("e") } ?: r
            notify(ctx, progress(ctx, title, s(ctx, R.string.phBurnPrep), -1f))
            val j = n.call("phJob").optJSONObject("job") ?: throw Stop("job")
            if (j.optString("state") != "done") throw Stop("not_ready")
            val outs = j.optJSONArray("out")
            var assId = ""
            for (i in 0 until (outs?.length() ?: 0)) outs!!.getJSONObject(i).let { if (it.optString("k") == "ass") assId = it.optString("id") }
            if (assId.isEmpty()) throw Stop("no_ass")
            val g = n.call("phGet", JSONObject().put("id", assId))
            val ass = File(work, "he.ass")
            n.get(g.optString("url"), ass)
            val fonts = File(work, "fonts").apply { mkdirs() }
            for (fn in listOf("Arimo-Bold.ttf", "Assistant-SemiBold.ttf"))
                ctx.assets.open(fn).use { i -> File(fonts, fn).outputStream().use { i.copyTo(it) } }
            val info = PhCore.info(r.optJSONObject("probe") ?: throw Stop("probe")) ?: throw Stop("probe")
            val (w, h) = PhCore.outSize(info, small)
            val (mime, codecName) = PhCodec.pick(w, h, small) ?: throw Stop("no_codec")
            rep(JSONObject().put("s", "run").put("p", 0))
            val v = File(work, "v.mp4")
            var lastRep = 0L
            val res = PhCodec.encode(ctx, PhCore.burnArgs(f.absolutePath, ass.absolutePath, fonts.absolutePath, info, w, h), w, h, info.fps, mime, codecName,
                PhCore.bitrate(f.length(), info.dur, small), v, File(work, "ff.err"), (info.dur * info.fps).toInt(), stopped) { p ->
                notify(ctx, progress(ctx, title, s(ctx, R.string.phBurning, (p * 100).toInt().coerceIn(0, 100)), p))
                val now = System.currentTimeMillis()
                // כל 2 שנ׳ (רק האחרון נשלח) — דף העבודה מציג אותו אחוז של ההתראה
                if (now - lastRep > 2_000) { lastRep = now; rep(JSONObject().put("s", "run").put("p", p.coerceIn(0f, 1f).toDouble())) }
            }
            if (stopped()) throw Stop("stopped")
            if (!res.ok) throw Stop(res.err ?: "encode")
            notify(ctx, progress(ctx, title, s(ctx, R.string.phSaving), -1f))
            val outDir = File(work, "out").apply { deleteRecursively(); mkdirs() }
            val out = File(outDir, PhCore.outName(title, small))
            val aac = small || !PhCore.mp4Audio(info.aCodec)
            var mx = PhFf.run(ctx, PhCore.muxArgs(v.absolutePath, f.absolutePath, out.absolutePath, info, aac, !small), stop = stopped)
            if ((mx.code != 0 || !out.isFile) && !aac) mx = PhFf.run(ctx, PhCore.muxArgs(v.absolutePath, f.absolutePath, out.absolutePath, info, true, !small), stop = stopped)
            if (mx.code != 0 || !out.isFile) throw Stop("mux")
            val sz = out.length()
            val uri = DlEngine.publish(ctx, out)                 // Movies/Studio (מוחק את התיקייה הזמנית)
            v.delete()
            repDone(JSONObject().put("s", "done").put("sz", sz).put("ms", System.currentTimeMillis() - t0))
            PhStore.update(ctx, pid) { it.put("st", "done").put("out", uri.toString()) }
            // העותק של הסרטון נשמר לצריבה נוספת — עד שהפרויקט נמחק באתר (PhStore.gcRemote, בקשת המשתמש 25/10/2026)
            nm(ctx).cancel(N_ID)
            nm(ctx).notify(N_DONE, savedNotif(ctx, title, uri))
        } catch (e: Throwable) {
            val code = codeOf(e)
            if (code == "stopped" || stopped()) { q.stop(); return }
            repDone(JSONObject().put("s", "fail").put("e", code))
            PhStore.update(ctx, pid) { it.put("e", code).put("st", "err").put("est", "burn") }
            nm(ctx).cancel(N_ID)
            nm(ctx).notify(N_DONE, simple(ctx, s(ctx, R.string.phBurnFailed), title, webIntent(ctx, r, code)))
        }
    }

    /* ---------------------------------------------------------------- התראות */
    fun s(ctx: Context, id: Int, vararg a: Any): String = DlLang.of(ctx).getString(id, *a)
    fun nm(ctx: Context) = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private fun notify(ctx: Context, n: Notification) = nm(ctx).notify(N_ID, n)

    private fun builder(ctx: Context): Notification.Builder {
        if (Build.VERSION.SDK_INT >= 26) nm(ctx).createNotificationChannel(NotificationChannel(CH, s(ctx, R.string.phChannel), NotificationManager.IMPORTANCE_LOW))
        return if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CH) else Notification.Builder(ctx)
    }

    fun progress(ctx: Context, title: String, text: String, p: Float): Notification {
        val cancel = PendingIntent.getService(ctx, 12, Intent(ctx, PhService::class.java).setAction(PhService.ACT_CANCEL), PendingIntent.FLAG_IMMUTABLE)
        return builder(ctx).setSmallIcon(android.R.drawable.stat_sys_upload).setContentTitle(title.ifEmpty { s(ctx, R.string.phTitle) })
            .setContentText(text).setOngoing(true).setOnlyAlertOnce(true)
            .setProgress(100, if (p < 0) 0 else (p * 100).toInt().coerceIn(0, 100), p < 0)
            .addAction(Notification.Action.Builder(null, s(ctx, R.string.dlCancel), cancel).build()).build()
    }

    private fun simple(ctx: Context, title: String, text: String, open: Intent): Notification =
        builder(ctx).setSmallIcon(android.R.drawable.stat_sys_upload_done).setContentTitle(title).setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text)).setAutoCancel(true)
            .setContentIntent(PendingIntent.getActivity(ctx, 13, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)).build()

    private fun savedNotif(ctx: Context, title: String, uri: Uri): Notification {
        val pi = PendingIntent.getActivity(ctx, 14, DlState.viewIntent(uri), PendingIntent.FLAG_IMMUTABLE)
        val share = PendingIntent.getActivity(ctx, 15, DlState.shareIntent(ctx, uri), PendingIntent.FLAG_IMMUTABLE)
        return builder(ctx).setSmallIcon(android.R.drawable.stat_sys_download_done).setContentTitle(s(ctx, R.string.phBurned))
            .setContentText(title).setStyle(Notification.BigTextStyle().bigText(title + "\n" + s(ctx, R.string.dlSavedS)))
            .addAction(Notification.Action.Builder(null, s(ctx, R.string.dlOpen), pi).build())
            .addAction(Notification.Action.Builder(null, s(ctx, R.string.dlShare), share).build())
            .setAutoCancel(true).setContentIntent(pi).build()
    }

    /** חזרה לאתר — לדף העבודה (‎#studio=<מזהה>), ועם שגיאה מהטלפון (‎&phe=<קוד>) */
    fun webIntent(ctx: Context, r: JSONObject, code: String): Intent {
        val web = r.optString("web").ifEmpty { s(ctx, R.string.launchUrl) }
        val h = "#studio=" + r.optString("job") + (if (code.isNotEmpty()) "&phe=" + code.filter { it.isLetterOrDigit() || it == '_' }.take(24) else "")
        return Intent(Intent.ACTION_VIEW, Uri.parse(web + h), ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
}
