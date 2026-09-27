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

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.3")
    implementation("androidx.glance:glance-appwidget:1.2.0")
    implementation("androidx.work:work-runtime-ktx:2.12.0")
}
