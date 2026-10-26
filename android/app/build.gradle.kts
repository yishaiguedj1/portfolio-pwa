import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose") // Glance (הווידג'ט) כתוב ב־Compose
}

// חתימה: ב־CI מקובץ מפתח שמגיע מסוד של הריפו (SNOWBALL_KEYSTORE_B64 → קובץ). בלי מפתח (בנייה מקומית) — מפתח debug.
val ksPath: String? = System.getenv("SNOWBALL_KEYSTORE")
val ksPass: String = System.getenv("SNOWBALL_KS_PASS") ?: ""

android {
    namespace = "io.github.yishaiguedj1.snowball"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.yishaiguedj1.snowball"
        minSdk = 26
        targetSdk = 35
        versionCode = (System.getenv("SNOWBALL_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("SNOWBALL_VERSION_NAME") ?: "1.0"
    }

    /* 14/10/2026 (בקשת המשתמש, תוכנית-שלוש-אפליקציות.md סעיף 4א): שלוש אפליקציות נפרדות מאותו קוד — לכל אחת
       אייקון, שם, כתובת וצבע משלה. Invest שומרת את המזהה הקיים (ההתקנה מתעדכנת במקום, הווידג'ט נשאר);
       Academy ו־Studio — מזהים חדשים. הווידג'ט רק ב־Invest (src/invest), Academy ו־Studio חולקות את src/lite. */
    flavorDimensions += "app"
    productFlavors {
        fun app(name: String, id: String, label: String, host: String, color: String) = create(name) {
            dimension = "app"
            applicationId = id
            manifestPlaceholders["siteHost"] = host
            resValue("string", "app_name", label)
            resValue("string", "siteHost", host)
            resValue("string", "launchUrl", "https://$host/")
            resValue("string", "barColor", color)
        }
        app("invest", "io.github.yishaiguedj1.snowball", "Invest", "invest.thesnowball.app", "#30D158")
        app("academy", "app.thesnowball.academy", "Academy", "academy.thesnowball.app", "#4699FF")
        app("studio", "app.thesnowball.studio", "Studio", "studio.thesnowball.app", "#FF4656").apply {
            // 22/10/2026: ההורדה בטלפון (youtubedl-android: פייתון + ffmpeg בספריות מקומיות) — רק arm64 (כל הטלפונים
            // מ־2017 בערך; בלי זה ה־APK פי 4 גדול). Android 10+ — שמירה ל־Movies/Studio דרך MediaStore בלי הרשאות
            minSdk = 29
            ndk { abiFilters += "arm64-v8a" }
        }
        // 22/10/2026: הבועה בדפדפן (שירות נגישות) — APK נפרד. Play Protect חוסם התקנה מחוץ לחנות של אפליקציה עם שירות
        // נגישות, ובגללה Studio כולו לא הותקן; כך רק הבועה תלויה בזה. נגיעה בבועה = שיתוף ל־Studio
        app("bubble", "app.thesnowball.bubble", "Studio Bubble", "studio.thesnowball.app", "#FF4656")
        // 23/10/2026: מרכז הניהול — APK נפרד (src/admin: ווידג'ט מדדי השרתים + מסך הטוקן). ה־TWA פותח את admin.thesnowball.app
        app("admin", "app.thesnowball.admin", "Snowball Admin", "admin.thesnowball.app", "#30D158")
        // 23/10/2026 (בקשת המשתמש): Studio DM — מנהל הורדות נייטיב (Compose), הכל בטלפון ובלי השרת שלנו.
        // לא TWA: ה־MainActivity של main יוצא מהמניפסט (src/dm/AndroidManifest.xml). yt-dlp מאותו מנוע של Studio (src/ytdl)
        app("dm", "app.thesnowball.studiodm", "Studio DM", "studio-dm.thesnowball.app", "#FF4656").apply {
            minSdk = 29
            ndk { abiFilters += "arm64-v8a" }
        }
        // 26/10/2026 (בקשת המשתמש): Studio Browser — דפדפן מלא (המבנה של Chrome, הגימור של Apple) על הקוד של Studio DM,
        // כך שההורדות קורות בתוך האפליקציה עם העוגיות של האתר. src/browser + כל src/dm (המנוע, ההורדות והנגן)
        app("browser", "app.thesnowball.browser", "Studio Browser", "studio-dm.thesnowball.app", "#FF4656").apply {
            minSdk = 29
            ndk { abiFilters += "arm64-v8a" }
        }
        // 24/10/2026 ("תרגום סרטונים בטלפון", שלב 0): Studio Lab — כלי מדידה בלבד. אותם מודלים של השרת (Parakeet, Qwen)
        // דרך ONNX Runtime לאנדרואיד ואותו ffmpeg של youtubedl-android; מודד זמן, זיכרון וחום ומפיק דוח לשיתוף
        app("lab", "app.thesnowball.lab", "Studio Lab", "studio.thesnowball.app", "#FF4656").apply {
            minSdk = 29
            ndk { abiFilters += "arm64-v8a" }
        }
    }
    sourceSets {
        getByName("academy").java.srcDir("src/lite/java")
        getByName("studio").java.srcDirs("src/lite/java", "src/grab/java", "src/ytdl/java", "src/phcore/java", "src/labcore/java")   // 25/10/2026: phcore = התמלול, הדוברים והיישור בטלפון (שלב 2); labcore = ONNX Runtime ו־Parakeet של Studio Lab
        getByName("studio").assets.srcDir("../../translator/fonts")   // 24/10/2026: הגופנים של הכתוביות (vt) — לצריבה בטלפון (PhWork)   // grab = VideoUrl (גם דפדפן הציד וגם הבועה); ytdl = מנוע yt-dlp (משותף עם Studio DM)
        getByName("bubble").java.srcDirs("src/lite/java", "src/grab/java")
        getByName("dm").java.srcDirs("src/lite/java", "src/dmcore/java", "src/ytdl/java", "src/grab/java")   // lite = Flavor (MainActivity של main נבנה גם כאן, ויוצא מהמניפסט)
        getByName("testDm").java.srcDir("src/dmcore/java")
        getByName("browser").java.srcDirs("src/lite/java", "src/dmcore/java", "src/ytdl/java", "src/grab/java", "src/dm/java")
        getByName("browser").res.srcDir("src/dm/res")   // המחרוזות, הערכה והאייקונים של ההורדות (האייקון של הדפדפן — br_launcher)
        getByName("lab").java.srcDirs("src/lite/java", "src/labcore/java")   // labcore = הליבה (נבדקת ב־JVM — testLab)
        getByName("testLab").java.srcDir("src/labcore/java")
    }

    signingConfigs {
        if (ksPath != null) {
            create("release") {
                storeFile = file(ksPath)
                storePassword = ksPass
                keyAlias = "snowball"
                keyPassword = ksPass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (ksPath != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    buildFeatures { resValues = true }

    // youtubedl-android מריץ את libpython.so מתיקיית הספריות — הן חייבות להיות מחולצות (extractNativeLibs)
    packaging { jniLibs { useLegacyPackaging = true } }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.3")
    // הווידג'ט — רק ב־Invest
    "investImplementation"("androidx.glance:glance-appwidget:1.2.0")
    "investImplementation"("androidx.work:work-runtime-ktx:2.12.0")
    "investImplementation"("com.caverock:androidsvg-aar:1.4") // לוגואים של ת״א (SVG של TradingView)
    // בלי ווידג'ט: התוסף של Compose (בשביל Glance) רץ על כל הגרסאות ודורש את ה־runtime — אותה גרסה ש־Glance מביא
    "academyImplementation"("androidx.compose.runtime:runtime:1.7.8")
    "studioImplementation"("androidx.compose.runtime:runtime:1.7.8")
    // 22/10/2026: בדיקות JVM של דפדפן הציד (HuntMedia) והבועה (VideoUrl) — testStudio/testBubble ReleaseUnitTest (גם ב־android.yml)
    "bubbleImplementation"("androidx.compose.runtime:runtime:1.7.8")
    "testStudioImplementation"("junit:junit:4.13.2")
    "testBubbleImplementation"("junit:junit:4.13.2")
    // שלב 2: דפדפן הציד — סקריפט לפני הדף וערוץ הודעות (addDocumentStartJavaScript / addWebMessageListener)
    "studioImplementation"("androidx.webkit:webkit:1.14.0")
    // 22/10/2026 (בקשת המשתמש: "כל ההורדות תמיד מקומית למכשיר"): yt-dlp בטלפון — פייתון 3.12, QuickJS (האתגרים של
    // יוטיוב) ו־ffmpeg (מיזוג בלי קידוד). GPL-3.0. yt-dlp עצמו מתעדכן מתוך האפליקציה (DlEngine.prepare)
    "studioImplementation"("io.github.junkfood02.youtubedl-android:library:0.18.1")
    "studioImplementation"("io.github.junkfood02.youtubedl-android:ffmpeg:0.18.1")
    "studioImplementation"("com.microsoft.onnxruntime:onnxruntime-android:1.30.0")   // 25/10/2026: תרגום בטלפון, שלב 2 — אותה גרסה של השרת
    "testStudioImplementation"("org.json:json:20240303")   // org.json של אנדרואיד לא רץ ב־JVM (DlProbeTest)
    // 23/10/2026: ווידג'ט מדדי השרתים (admin) — אותן גרסאות כמו Invest (Glance, WorkManager) + Compose runtime כמו שאר הטעמים
    "adminImplementation"("androidx.glance:glance-appwidget:1.2.0")
    "adminImplementation"("androidx.work:work-runtime-ktx:2.12.0")
    "adminImplementation"("androidx.compose.runtime:runtime:1.7.8")
    // 23/10/2026: Studio DM — ממשק ב־Compose (Material 3), yt-dlp כמו ב־Studio, בדיקות JVM של הליבה מול שרת אמיתי
    "dmImplementation"(platform("androidx.compose:compose-bom:2025.02.00"))
    "dmImplementation"("androidx.compose.material3:material3")
    "dmImplementation"("androidx.compose.ui:ui")
    "dmImplementation"("androidx.activity:activity-compose:1.10.0")
    "dmImplementation"("androidx.webkit:webkit:1.14.0")   // הדפדפן של DM: סקריפט לפני הדף וערוץ הודעות (כמו דפדפן הציד)
    "dmImplementation"("io.github.junkfood02.youtubedl-android:library:0.18.1")
    "dmImplementation"("io.github.junkfood02.youtubedl-android:ffmpeg:0.18.1")
    // 24/10/2026: כניסה עם Google ב־DM (מאגר הנתונים, בהסכמה) — Credential Manager ← אסימון Google ← Firebase (signInWithIdp)
    "dmImplementation"("androidx.credentials:credentials:1.5.0")
    "dmImplementation"("androidx.credentials:credentials-play-services-auth:1.5.0")
    "dmImplementation"("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    // 24/10/2026: נגן בתוך DM (Media3 — ExoPlayer + PlayerView): כתוביות שבתוך הקובץ, מהירות, מסך מלא
    "dmImplementation"("androidx.media3:media3-exoplayer:1.5.1")
    "dmImplementation"("androidx.media3:media3-ui:1.5.1")
    "testDmImplementation"("junit:junit:4.13.2")
    // 26/10/2026: Studio Browser — אותן תלויות של DM, ומשיכה לרענון
    "browserImplementation"(platform("androidx.compose:compose-bom:2025.02.00"))
    "browserImplementation"("androidx.compose.material3:material3")
    "browserImplementation"("androidx.compose.ui:ui")
    "browserImplementation"("androidx.activity:activity-compose:1.10.0")
    "browserImplementation"("androidx.webkit:webkit:1.14.0")
    "browserImplementation"("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    "browserImplementation"("io.github.junkfood02.youtubedl-android:library:0.18.1")
    "browserImplementation"("io.github.junkfood02.youtubedl-android:ffmpeg:0.18.1")
    "browserImplementation"("androidx.credentials:credentials:1.5.0")
    "browserImplementation"("androidx.credentials:credentials-play-services-auth:1.5.0")
    "browserImplementation"("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    "browserImplementation"("androidx.media3:media3-exoplayer:1.5.1")
    "browserImplementation"("androidx.media3:media3-ui:1.5.1")
    // 24/10/2026: Studio Lab — Compose כמו DM, ‏ONNX Runtime באותה גרסה של השרת (onnxruntime==1.30.0), ffmpeg של youtubedl-android
    "labImplementation"(platform("androidx.compose:compose-bom:2025.02.00"))
    "labImplementation"("androidx.compose.material3:material3")
    "labImplementation"("androidx.compose.ui:ui")
    "labImplementation"("androidx.activity:activity-compose:1.10.0")
    "labImplementation"("com.microsoft.onnxruntime:onnxruntime-android:1.30.0")
    "labImplementation"("io.github.junkfood02.youtubedl-android:library:0.18.1")
    "labImplementation"("io.github.junkfood02.youtubedl-android:ffmpeg:0.18.1")
    "testLabImplementation"("junit:junit:4.13.2")
    "testDmImplementation"("org.json:json:20240303")
    "testBrowserImplementation"("junit:junit:4.13.2")
    "testBrowserImplementation"("org.json:json:20240303")   // ייבוא מ־Chrome (BrImportTest)
}

/* 25/10/2026 (תרגום בטלפון, שלב 3): הקוד של העובד (translator/ — job.py, pipeline.py, llm.py, vt/…) כנכס של Studio
   (translator.zip), שהפייתון של האפליקציה מריץ (PhPy). בלי הבדיקות, המודלים והמחקר; הגופנים כבר נכסים (בשורש). ארכיון
   קבוע (סדר, זמנים) — אותו קוד = אותה טביעה = לא נפתח מחדש בטלפון */
abstract class PtPack : DefaultTask() {
    @get:Internal abstract val base: DirectoryProperty
    @get:InputFiles @get:PathSensitive(PathSensitivity.RELATIVE) abstract val src: ConfigurableFileCollection
    @get:OutputDirectory abstract val outDir: DirectoryProperty
    @TaskAction fun pack() {
        val root = base.get().asFile
        val files = src.files.map { it.relativeTo(root).invariantSeparatorsPath }.sorted()
        val out = outDir.get().asFile.apply { mkdirs() }
        ZipOutputStream(File(out, "translator.zip").outputStream()).use { z ->
            for (rel in files) {
                val e = ZipEntry(rel).apply { time = 315532800000L }
                z.putNextEntry(e); File(root, rel).inputStream().use { it.copyTo(z) }; z.closeEntry()
            }
        }
    }
}
val ptPack = tasks.register<PtPack>("ptPack") {
    val tr = layout.projectDirectory.dir("../../translator")
    base.set(tr)
    // בלי הבדיקות, המודלים, המחקר והכלים; הגופנים — כבר נכסים בשורש (לצריבה), PhPy מעתיק אותם
    src.from(fileTree(tr) { exclude("tests/**", "models/**", "research/**", "bench/**", "tools/**", "fonts/**", "**/__pycache__/**", "**/*.pyc", "**/*.onnx", "**/*.lock") })
    outDir.set(layout.buildDirectory.dir("generated/ptAssets"))
}
androidComponents {
    onVariants(selector().withFlavor("app" to "studio")) { v ->
        v.sources.assets?.addGeneratedSourceDirectory(ptPack, PtPack::outDir)
    }
}
