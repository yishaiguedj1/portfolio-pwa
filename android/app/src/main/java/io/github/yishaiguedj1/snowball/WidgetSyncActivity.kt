package io.github.yishaiguedj1.snowball

import android.app.Activity
import android.os.Bundle

/**
 * מקבל מהאפליקציה (האתר, בתוך Chrome) את רשימת המניות לווידג'ט:
 *   intent://widget?s=AAPL~i~Apple,LUMI.TA~m~לאומי~leumi&l=he#Intent;scheme=snowball;package=…;end
 * (app.js → appWidgetSync, בנגיעה אחרי שהתיק השתנה). בלי מסך — שומר, מרענן ונסגר, וחוזרים לאתר.
 * רק סימבולים, מקור ושם — בלי כמויות/שווי. כל אתר יכול לשלוח לכאן, ולכן: אימות אורך/תווים, והמידע רק מוצג.
 */
class WidgetSyncActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val d = intent?.data
        if (d != null && d.scheme == "snowball" && d.host == "widget") {
            WidgetStore.setItems(this, d.getQueryParameter("s") ?: "", d.getQueryParameter("l") ?: "he")
            WidgetRefresh.ensurePeriodic(this)
            WidgetRefresh.now(this)
        }
        finish()
    }
}
