# חדר האפליקציה (ת3 בתוכנית השרת המאוחד, 10/10/2026 — הכנה; טרם בשימוש): השרתון (ibkr-proxy) כשרת HTTP רגיל.
# אותן פונקציות שרצות היום ב־Vercel, דרך ibkr-proxy/server.js — המעבר הוא החלפת כתובת, ו־Vercel נשאר גיבוי.
#
# אבטחה (כמו קופסת העובד):
#   • בסיס נעול ב־digest (Node 22 LTS, Debian 13 slim). עדכון = שינוי מכוון כאן (Dependabot יציע).
#   • בלי npm install — לשרתון אין תלויות בכלל (package.json), כך שאין שרשרת אספקה מעבר ל־Node עצמו.
#   • משתמש רגיל (10001), מערכת קבצים לקריאה בלבד (compose), בלי הרשאות. הסודות רק ממשתני הסביבה בשרת.
#   • לא חשוף לאינטרנט: רק השער (Caddy / Cloudflare Tunnel) ברשת הפנימית מגיע אליו.
ARG NODE_IMAGE=node:22.20.0-trixie-slim@sha256:f3bca16c4b87ad0c7abfad97f6803898ee9b08a1f153a269140f0a08f50231d2
FROM ${NODE_IMAGE}

COPY --chown=root:root ibkr-proxy/api /app/api
COPY --chown=root:root ibkr-proxy/lib /app/lib
COPY --chown=root:root ibkr-proxy/server.js ibkr-proxy/vercel.json ibkr-proxy/package.json /app/
RUN find /app -type d -exec chmod 755 {} + && find /app -type f -exec chmod 644 {} + \
 && node --check /app/server.js && for f in /app/api/*.js; do node --check "$f"; done

ENV NODE_ENV=production PORT=3000
USER 10001:10001
WORKDIR /app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD ["node", "-e", "require('http').get('http://127.0.0.1:3000/healthz', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
CMD ["node", "/app/server.js"]
