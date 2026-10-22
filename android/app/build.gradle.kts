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
    }
    sourceSets {
        getByName("academy").java.srcDir("src/lite/java")
        getByName("studio").java.srcDirs("src/lite/java", "src/grab/java")   // grab = VideoUrl (גם דפדפן הציד וגם הבועה)
        getByName("bubble").java.srcDirs("src/lite/java", "src/grab/java")
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
    "testStudioImplementation"("org.json:json:20240303")   // org.json של אנדרואיד לא רץ ב־JVM (DlProbeTest)
}
