package io.github.yishaiguedj1.snowball.br

import android.net.Uri

/**
 * "להמשיך מאותה נקודה בדיוק" (27/10/2026) — יותר ממה ש־Chrome ו־Safari מעבירים (רק כתובת): המקום בדף נמדד בשני אופנים,
 * כי במכשיר אחר (רוחב אחר) הדף בגובה אחר — המשפט שבראש המסך (חוזרים אליו), ואם לא נמצא — החלק היחסי של הגלילה.
 * בסרטון — הזמן (וביוטיוב גם ?t= בכתובת, כדי שהנגן יתחיל משם גם לפני שהדף מוכן).
 */
object BrCloudJs {
    /** [חלק שנגלל 0–1, המשפט בראש המסך (עד 100 תווים), זמן בסרטון] */
    const val MEASURE = """(function(){try{var d=document.documentElement,b=document.body,H=Math.max(d.scrollHeight,b?b.scrollHeight:0)-innerHeight;
var sc=H>0?Math.min(1,Math.max(0,scrollY/H)):0,tx='';
if(scrollY>40){var el=document.elementFromPoint(innerWidth/2,Math.min(90,innerHeight/5));
for(var i=0;i<5&&el;i++){if((el.textContent||'').length<4000){var s=(el.innerText||'').trim().split('\n')[0].trim();if(s.length>=20){tx=s.slice(0,100);break}}el=el.parentElement}}
var v=document.querySelector('video'),mt=v&&v.currentTime>2&&!v.ended?v.currentTime:0;
return JSON.stringify([sc,tx,mt])}catch(e){return ''}})()"""

    /** התשובה של evaluateJavascript (מחרוזת JSON בתוך מחרוזת) → (sc, tx, mt) */
    fun parse(raw: String?): Triple<Float, String, Float>? = runCatching {
        if (raw == null || raw.length < 4 || raw == "null") return null
        val inner = org.json.JSONArray("[$raw]").getString(0)
        val a = org.json.JSONArray(inner)
        Triple(a.optDouble(0, 0.0).toFloat().coerceIn(0f, 1f), a.optString(1, "").take(100), a.optDouble(2, 0.0).toFloat().coerceAtLeast(0f))
    }.getOrNull()

    private fun js(s: String) = org.json.JSONObject.quote(s)

    /** חוזרים למקום: קודם המשפט (TreeWalker על הטקסט), ואם לא נמצא — לפי החלק היחסי; עד 12 ניסיונות (דף שנטען בחלקים) */
    fun restore(t: BrCloudCore.STab): String = """(function(sc,tx,mt){var k=0;
function go(){var ok=false;
if(tx){var key=tx.slice(0,40),w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n;
while((n=w.nextNode())){if(n.nodeValue&&n.nodeValue.indexOf(key)>=0&&n.parentElement){var r=n.parentElement.getBoundingClientRect();scrollTo(0,scrollY+r.top-70);ok=true;break}}}
if(!ok&&sc>0){var H=document.documentElement.scrollHeight-innerHeight;if(H>innerHeight*1.5){scrollTo(0,sc*H);ok=k>3}}
if(mt>0){var v=document.querySelector('video');if(v&&Math.abs(v.currentTime-mt)>3){try{v.currentTime=mt}catch(e){}}}
return ok||(!tx&&sc==0)}
(function t(){if(go()||++k>12)return;setTimeout(t,700)})()})(${t.sc},${js(t.tx)},${t.mt})"""

    /** ביוטיוב — ?t= בכתובת (הנגן מתחיל משם) */
    fun withTime(url: String, mt: Float): String {
        if (mt < 3f) return url
        val u = runCatching { Uri.parse(url) }.getOrNull() ?: return url
        val h = u.host?.lowercase() ?: return url
        if (!(h.endsWith("youtube.com") || h == "youtu.be")) return url
        val b = u.buildUpon().clearQuery()
        for (n in u.queryParameterNames) if (n != "t") u.getQueryParameters(n).forEach { b.appendQueryParameter(n, it) }
        return b.appendQueryParameter("t", "${mt.toInt()}s").build().toString()
    }
}
