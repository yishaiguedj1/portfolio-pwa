/* עמוד החזרה מחלון ההסכמה של Google (גיבוי הספרייה הפרטית ל־Drive, v318).
   מעביר את הקוד לחלון של האפליקציה (אותו origin) ונסגר. הקוד לבדו לא שווה כלום בלי הסוד שבשרתון,
   ונמחק מכתובת העמוד ומהאחסון מיד. */
(function () {
  // שלב 4: לא בתוך מסגרת של אתר זר — העמוד הזה מקבל קוד הרשאה
  if (self !== top) { document.documentElement.style.display = 'none'; return; }
  var p = new URLSearchParams(location.search);
  // בורר הקבצים של Google (trigger_onepick): מזהי הקבצים שבחרת — רק תווים של מזהה Drive, עד 20
  var pk = String(p.get('picked_file_ids') || '').split(',').filter(function (x) { return /^[A-Za-z0-9_-]{10,100}$/.test(x); }).slice(0, 20).join(',');
  var msg = { code: p.get('code') || '', state: p.get('state') || '', error: p.get('error') || '', picked: pk, at: Date.now() };
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  var sent = false;
  try { var bc = new BroadcastChannel('snb-oauth'); bc.postMessage(msg); bc.close(); sent = true; } catch (e) {}
  try { localStorage.setItem('pwa_oauth_v1', JSON.stringify(msg)); } catch (e) {}   // גיבוי לדפדפן בלי BroadcastChannel (האפליקציה מוחקת מיד)
  var el = document.getElementById('msg');
  if (el) el.textContent = msg.error ? 'החיבור בוטל. אפשר לסגור את החלון.' : pk ? 'נבחר. אפשר לחזור לאפליקציה.' : 'Google Drive חובר. אפשר לחזור לאפליקציה.';
  setTimeout(function () { try { window.close(); } catch (e) {} }, sent ? 300 : 800);
})();
