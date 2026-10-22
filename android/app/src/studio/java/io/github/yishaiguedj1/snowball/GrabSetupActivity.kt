package io.github.yishaiguedj1.snowball

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings

/**
 * 22/10/2026: מהאתר (Studio ← "בועת הורדה בדפדפן") — intent://grab?s=…#Intent;scheme=snbstudio;package=…;end.
 * בלי מסך: פותח את ההגדרה המבוקשת וסוגר. s=app — "פרטי האפליקציה" (שם: ⋮ ← "לאפשר הגדרות מוגבלות", באנדרואיד 13+
 * לאפליקציה שלא הותקנה מחנות); אחרת — מסך הנגישות.
 */
class GrabSetupActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = intent?.data?.getQueryParameter("s") == "app"
        val i = if (app) Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null))
        else Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        try { startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) {}
        finish()
    }
}
