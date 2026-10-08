/* עמוד החזרה מחלון ההסכמה של Google (גיבוי הספרייה הפרטית ל־Drive, v318).
   מעביר את הקוד לחלון של האפליקציה (אותו origin) ונסגר. הקוד לבדו לא שווה כלום בלי הסוד שבשרתון,
   ונמחק מכתובת העמוד ומהאחסון מיד. */
(function () {
  // שלב 4: לא בתוך מסגרת של אתר זר — העמוד הזה מקבל קוד הרשאה
  if (self !== top) { document.documentElement.style.display = 'none'; return; }
  var p = new URLSearchParams(location.search);
  var msg = { code: p.get('code') || '', state: p.get('state') || '', error: p.get('error') || '', at: Date.now() };
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  var sent = false;
  try { var bc = new BroadcastChannel('snb-oauth'); bc.postMessage(msg); bc.close(); sent = true; } catch (e) {}
  try { localStorage.setItem('pwa_oauth_v1', JSON.stringify(msg)); } catch (e) {}   // גיבוי לדפדפן בלי BroadcastChannel (האפליקציה מוחקת מיד)
  var el = document.getElementById('msg');
  if (el) el.textContent = msg.error ? 'החיבור בוטל. אפשר לסגור את החלון.' : 'Google Drive חובר. אפשר לחזור לאפליקציה.';
  setTimeout(function () { try { window.close(); } catch (e) {} }, sent ? 300 : 800);
})();
