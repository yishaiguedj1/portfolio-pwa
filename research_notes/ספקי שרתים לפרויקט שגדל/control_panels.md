# לוחות בקרה לשרת / PaaS בניהול עצמי — מה מתאים לפרויקט שמנוהל בידי Claude Code (מצב 08/10/2026)

> מקרא: **[מאומת]** = נבדק ישירות במקור ראשוני (GitHub API / דף ה־advisories / תיעוד רשמי) בתאריך 08/10/2026. **[משני]** = מכתבה, אתר מעקב CVE או השוואה של צד שלישי. כתבות של מי שמוכר מוצר מתחרה או שירות ניהול — מסומנות.
> מספרי כוכבים ב־GitHub — כולם **[מאומת]**, מתוך חיפוש GitHub API ב־08/10/2026.

## שאלה 1: מה כל סוג לוח, ומה מצב האפשרויות המובילות (בשלות, רישיון, צריכת משאבים, יכולות)

### Takeaway
יש ארבע משפחות: (א) PaaS בניהול עצמי — "Vercel/Heroku משלך" על השרת (Coolify, Dokploy, CapRover, Easypanel, Komodo); (ב) כלי פריסה בלי לוח — קוד שמתאר את השרת, נשמר ב־git ורץ מ־SSH (Kamal, Dokku, Docker Compose + GitHub Actions); (ג) מנהלי קונטיינרים (Portainer) ו"חנויות אפליקציות לבית" (CasaOS, Umbrel, YunoHost, Cloudron); (ד) לוחות אחסון אתרים קלאסיים (cPanel, Plesk, HestiaCP, CloudPanel, aaPanel) שנבנו לאתרי PHP/וורדפרס, לא לעובדים בקונטיינרים. Coolify הוא הגדול והעשיר ביותר (62.7K כוכבים), Dokploy הצעיר המהיר (37.7K, עדיין לפני 1.0), Kamal/Dokku — הוותיקים והקלים, בלי ממשק גרפי.

### Cited Findings

**מספרים מ־GitHub (08/10/2026) [מאומת]** — [GitHub search API](https://github.com/search?q=repo%3Acoollabsio%2Fcoolify&type=repositories)
| פרויקט | כוכבים | רישיון (לפי GitHub) | נוצר | דחיפה אחרונה |
|---|---|---|---|---|
| coollabsio/coolify | 62,721 | Apache-2.0 | 01/2021 | 08/10/2026 |
| portainer/portainer | 38,614 | Zlib (CE) | 05/2016 | 08/10/2026 |
| Dokploy/dokploy | 37,710 | "NOASSERTION" (מעורב, ראו למטה) | 04/2024 | 08/10/2026 |
| IceWhaleTech/CasaOS | 37,292 | Apache-2.0 | 09/2021 | 28/09/2026 |
| dokku/dokku | 32,174 | MIT | 06/2013 | 08/10/2026 (רק 34 issues פתוחים) |
| caprover/caprover | 15,182 | NOASSERTION (במקור Apache-2.0 לפי WZ-IT) | 10/2017 | 06/10/2026 |
| basecamp/kamal | 14,637 | MIT | 01/2023 | 08/10/2026 |
| moghtech/komodo | 12,654 | GPL-3.0 | 03/2022 | 21/09/2026 |
| getumbrel/umbrel | 12,314 | NOASSERTION | 07/2020 | 22/09/2026 |
| azukaar/Cosmos-Server | 6,179 | NOASSERTION | 02/2023 | 08/10/2026 |
| hestiacp/hestiacp | 4,519 | GPL-3.0 | 11/2018 | 08/10/2026 |
| kubero-dev/kubero | 4,432 | GPL-3.0 | 05/2022 | 09/09/2026 |
| aaPanel/aaPanel | 3,064 | NOASSERTION | 06/2019 | 27/08/2026 |
| YunoHost/yunohost | 2,975 | AGPL-3.0 | 05/2014 | 07/10/2026 |
| כלי מעקב: louislam/uptime-kuma | 92,221 | MIT | | 08/10/2026 |
| netdata/netdata | 80,845 | GPL-3.0 | | 08/10/2026 |
| henrygd/beszel | 26,037 | MIT | 07/2024 | 08/10/2026 |
| amir20/dozzle | 14,586 | MIT | | 08/10/2026 (issue פתוח אחד) |
| open-webui/open-webui | 154,041 | NOASSERTION | | 08/10/2026 |

(Easypanel לא הופיע בחיפוש ריפו ציבורי — מוצר סגור עם שכבת חינם; ראו למטה.)

**Coolify**
- גרסאות: v4.4.3 שוחררה 08/10, לפניה v4.4.0 (06/10) ו־v4.3.x בספטמבר — כ־10 גרסאות בחודש, 71 עמודי גרסאות בסך הכל. מספור בלי "beta" = v4 יציב. ב־v4.4.0 יש תמיכה "ניסיונית" ב־SQLite ו־runners של GitHub Actions ב"beta" **[מאומת]** — [Coolify releases](https://github.com/coollabsio/coolify/releases)
- עד אמצע 2026 הגרסאות היו 4.0.0-beta.4xx (תיקוני האבטחה של יולי 2026 יצאו ב־beta.469–beta.474) **[מאומת דרך heise]** — [heise, 06/07/2026](https://www.heise.de/en/news/Coolify-Critical-vulnerabilities-could-enable-remote-attacks-11354777.html). מקור משני טוען ש־v4 יצא כיציב באפריל 2026 — לא תואם את מספור ה־beta של יולי, כלומר תאריך היציבות לא ודאי **[משני, סותר]** — [appstackbuilder](https://appstackbuilder.com/blog/coolify-vs-dokploy-vs-caprover-2026)
- דרישות מינימום רשמיות: 2 ליבות, 2GB RAM, 10GB דיסק; לינוקס בלבד; לוח על פורט 8000 **[מאומת]** — [Coolify docs: installation](https://coolify.io/docs/get-started/installation). הערכות צריכה במנוחה בהשוואות: כ־1GB עד 1.5–2GB RAM **[משני]** — [סיכום השוואות](https://wolf-tech.io/blog/coolify-vs-dokploy-vs-kamal-picking-a-self-hosted-paas-for-a-small-saas-team)
- אזהרה רשמית: מי שמגיע ראשון לדף ההרשמה אחרי ההתקנה הופך למנהל עם root על השרת — אפשר ליצור את חשבון המנהל מראש עם `ROOT_USERNAME`/`ROOT_USER_EMAIL`/`ROOT_USER_PASSWORD`; חובה לגבות את `/data/coolify/source/.env` (מכיל `APP_KEY` שמצפין את הסודות) **[מאומת]** — [Coolify docs](https://coolify.io/docs/get-started/installation)
- רישיון Apache-2.0 בלי שכבת Enterprise סגורה; ~280 שירותים בלחיצה; ריבוי שרתים מובנה (דרך SSH) **[משני]** — [סיכום השוואות 2026](https://appstackbuilder.com/blog/coolify-vs-dokploy-vs-caprover-2026); מקור אחר טוען "שרת אחד לכל מופע" — סותר ונראה שגוי **[משני, סותר]** — [temps.sh (מוכר מוצר מתחרה)](https://temps.sh/blog/coolify-review-2026)
- גיבוי מסדי נתונים ושחזור מהממשק (לעומת Kamal שמשאיר זאת לך) **[משני]** — [WZ-IT (מפעילים Coolify ללקוחות בתשלום)](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/)
- ארכיטקטורה: תהליך אחד בהרשאות root שמחזיק את ה־Docker socket ומתחבר ב־SSH כ־root לכל השרתים המנוהלים **[משני — כתבה של מתחרה, bex]** — [bex.co](https://bex.co/blog/2026/07/10/coolify-cve-pileup-single-daemon-paas-risk)

**Dokploy**
- גרסה v0.30.2 (18/08/2026) — **לפני 1.0**, "ממשקים והתנהגות עלולים להשתנות"; מבוסס Docker Swarm + Traefik **[משני]** — [WZ-IT, 23/08/2026](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/)
- רישיון מפוצל: הליבה Apache-2.0, וכל מה שבתיקייה `/proprietary` — תחת `LICENSE_PROPRIETARY` נפרד **[מאומת]** — [Dokploy LICENSE.MD](https://github.com/Dokploy/dokploy/blob/canary/LICENSE.MD). לפי WZ-IT החלק הסגור הוא DSAL 1.0 שדורש הסכם מסחרי לשימוש בייצור; SSO/SCIM/יומני ביקורת — ברישיון Enterprise **[משני]** — [WZ-IT](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/)
- הממשק נחשב נקי ואינטואיטיבי יותר מזה של Coolify; קטלוג התבניות מדווח כ־30 / 100+ / 500+ לפי המקור (סותר) **[משני]** — [סיכום השוואות](https://www.bitdoze.com/coolify-vs-dokploy-vs-kamal-2/)

**CapRover** — v1.15.3 (20/08/2026), מאז 2017, ריבוי שרתים כ"אשכול" דרך Docker Swarm, תמיכה מוגבלת ב־Docker Compose; מומלץ "כשיציבות חשובה מרוחב יכולות" **[משני]** — [WZ-IT](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/). מדיניות האבטחה: "רק הגרסה האחרונה מקבלת תיקוני אבטחה" **[מאומת]** — [CapRover security](https://github.com/caprover/caprover/security)

**Dokku** — v0.38.27 (12/08/2026), MIT, הכלי הוותיק ביותר ברשימה, שורת פקודה + תוספים, "טביעת המשאבים הקטנה ביותר", בלי לוח **[משני]** — [WZ-IT](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/)

**Kamal (37signals)** — v2.12.0 (18/06/2026), MIT; פורס קונטיינרים לכל שרת דרך SSH, הגדרות ב־YAML בתוך הריפו, פריסה בלי השבתה דרך kamal-proxy; אין לוח, אין ניהול משתמשים, אין קטלוג שירותים, אין שכבת פלטפורמה שרצה על השרת; גיבויים (למשל pg_dump ב־cron) — עליך **[משני]** — [WZ-IT](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/); [סיכום השוואות](https://www.bitdoze.com/coolify-vs-dokploy-vs-kamal-2/)

**Komodo** — GPL-3.0; "Stack" = קבצי Compose מריפו git, webhook מפריס מחדש בכל push, שינויים מתועדים ב־git וניתנים לביטול; ארכיטקטורת core + periphery (סוכן בכל שרת), לוח על פורט 9120, MongoDB; מדריך רשמי בקהילת Hetzner (נבדק על v2.2.0) **[משני]** — [Hetzner Community tutorial](https://community.hetzner.com/tutorials/deploy-containers-with-komodo); [Komodo docs: Compose](https://komo.do/docs/deploy/compose)

**Easypanel** — מוצר מסחרי סגור: חינם לתמיד עד 3 פרויקטים (שירותים ופריסות בלי הגבלה, ניטור בסיסי); Hobby $10.9, Growth $16.9, Business $29.9 לשרת לחודש; גיבויי מסדי נתונים והתראות — רק מ־Hobby; ריבוי משתמשים — מ־Growth; אשכול — "alpha" ב־Business **[משני, מבוסס על דף התמחור הרשמי; עותק ישן מציג מחירים אחרים]** — [Easypanel pricing](https://easypanel.io/pricing)

**GPU** — Docker Compose תומך ב־GPU דרך `deploy.resources.reservations.devices` עם `capabilities: [gpu]` (חובה), `count` או `device_ids`; על השרת נדרשים דרייבר NVIDIA + NVIDIA Container Toolkit **[מאומת]** — [Docker docs: GPU support](https://docs.docker.com/compose/how-tos/gpu-support/). לא נמצא תיעוד ייעודי ל־GPU ב־Coolify/Dokploy — כל לוח שמריץ Compose כמו שהוא אמור להעביר את זה הלאה (הסקה, לא מאומת).

### Inferences
- כל ה־PaaS המודרניים (Coolify, Dokploy, Komodo, CapRover) יושבים מעל Docker; Coolify/Komodo/Dokploy מריצים Compose — לכן **היציאה מהם יחסית קלה** (מעתיקים את קובצי ה־Compose ואת הנתונים). Easypanel (סגור) ו־CapRover (פורמט משלו, Compose מוגבל) — נעילה גבוהה יותר.
- לעובד תרגום של שעות: אף אחד מהלוחות לא מוסיף יכולת שחסרה ב־Compose (`restart`, מגבלות CPU/RAM, GPU). היתרון שלהם = פריסה מ־git, סודות בממשק, לוגים בדפדפן, גיבויים.
- לוחות אחסון קלאסיים (cPanel/Plesk/HestiaCP/CloudPanel/aaPanel) — בנויים סביב Apache/Nginx+PHP+MySQL+מייל לאתרים; עובד Python בקונטיינר ו־GPU אינם המקרה שלהם. חנויות לבית (CasaOS/Umbrel/YunoHost/Cloudron) — בנויות להתקנת אפליקציות מוכנות (Nextcloud וכו') בלחיצה, לא לפריסת קוד שלך מ־GitHub. (הסקה; לא נמצא מקור ראשוני שמנסח זאת.)

### Gaps
- צריכת RAM במנוחה של Dokploy/Komodo/CapRover — לא נמצאה מדידה אמינה; רק "Dokku הכי קל".
- מצב התמיכה ב־2FA/SSO של כל לוח לא אומת ישירות (המידע היחיד: ב־Dokploy, SSO ברישיון Enterprise לפי WZ-IT).
- מצב תחזוקת CasaOS (האם עבר לתחזוקה בלבד לטובת ZimaOS) — לא נבדק; דחיפה אחרונה 28/09/2026.
- Cloudron (בתשלום), cPanel/Plesk — לא נבדקו לעומק בסבב הזה.
- רישיון CapRover מופיע ב־GitHub כ־"NOASSERTION" (קובץ רישיון לא סטנדרטי), WZ-IT כותב Apache-2.0 — לא אומת.

## שאלה 2: רקורד אבטחה 2024–2026 (Coolify, Dokploy, Portainer, CapRover, aaPanel)

### Takeaway
ב־2026 גם Coolify וגם Dokploy פרסמו עשרות פרצות חמורות, רובן מאותו סוג: "קלט משתמש → פקודת shell" שמסתיים ב־root על השרת. רובן דורשות משתמש מחובר, אבל עשרות אלפי לוחות היו חשופים לאינטרנט. מסקנה מעשית: **לוח PaaS הוא החוליה החלשה אם הוא נגיש מהאינטרנט** — אם משתמשים בלוח, רק מאחורי VPN (Tailscale) או Cloudflare Access, עם משתמש יחיד ועדכון שוטף.

### Cited Findings
- **Coolify — ינואר 2026**: 11 פרצות פורסמו ב־08/01/2026, כולן CVSS 9.4–10.0 (שבע ב־10.0); רובן הזרקת פקודות (גיבויים, ייבוא DB, סקריפט init של PostgreSQL, הגדרות proxy, שדה ריפו git, הוראות Compose), דליפת מפתח SSH של root, ו־XSS; תוקנו ב־4.0.0-beta.451; לא נצפה ניצול פעיל **[משני — כתבת מתחרה]** — [bex.co](https://bex.co/blog/2026/07/10/coolify-cve-pileup-single-daemon-paas-risk)
- כ־52,890 לוחות Coolify היו נגישים מהאינטרנט ב־08/01/2026 (Censys) **[משני]** — [webpronews](https://www.webpronews.com/coolify-reveals-11-critical-vulnerabilities-exposing-52000-instances/); [SC World](https://www.scworld.com/brief/nearly-a-dozen-coolify-flaws-put-servers-at-risk)
- **Coolify — יולי 2026**: 5 פרצות "קריטיות" (CVE-2026-34038, ‎34047, ‎57498, ‎34037, ‎34048) — הרצת פקודות לא מורשית בידי חברי צוות, אפשרות ל־root בשרשרת; תוקנו ב־beta.464–beta.474; תיאורים ו־PoC פורסמו; אין ניצול ידוע **[מאומת — heise]** — [heise, 06/07/2026](https://www.heise.de/en/news/Coolify-Critical-vulnerabilities-could-enable-remote-attacks-11354777.html)
- CVE-2026-34158 (יולי 2026, CVSS 8.8): `executeInDocker()` עוטף פקודות build בגרש בלי escape → הזרקה; הטענה: "שורש אחד — User Input → Shell — ב־5 תתי־מערכות לפחות", והתיקונים נקודתיים לכל שדה ולא גבול הרשאות **[משני — מתחרה]** — [bex.co](https://bex.co/blog/2026/07/10/coolify-cve-pileup-single-daemon-paas-risk)
- דף ה־advisories של Coolify: 7 עמודים (~61–70 הודעות); בעמוד הראשון (יוני–יולי 2026): 1 קריטית, 6 גבוהות, 3 נמוכות — למשל "Unauthenticated Deployment Trigger via Webhook HMAC Bypass with Null Secret" (25/06/2026), "Cross-Team IDOR … Exposes SSH Keys", "Sanctum API Tokens Have No Expiration" **[מאומת]** — [Coolify security advisories](https://github.com/coollabsio/coolify/security/advisories)
- דיווחים משניים על פרצות מאוחרות יותר: CVE-2026-84694 (RCE דרך מפתחות משתני סביבה, לפני 4.2.0, פורסם 03/09/2026) ו־CVE-2026-15507 **[משני — אתר מעקב, לא אומת ב־NVD]** — [SentinelOne](https://www.sentinelone.com/vulnerability-database/cve-2026-84694/); אתר מעקב מונה 74 CVE לתגית Coolify **[משני]** — [vuln.today](https://vuln.today/tag/coolify)
- **Dokploy**: דף ה־advisories — 6 עמודים (~60); בעמוד הראשון, כולן מ־21/07/2026: 6 קריטיות + 4 גבוהות — למשל "Non-admin member gains root on the host by bypassing the owner/admin check on server-level schedules", "Incomplete fix of GHSA-3frc-cfh9-ch2c", "Git Provider Credential Exposure via Unprotected .one Endpoints" **[מאומת]** — [Dokploy security advisories](https://github.com/Dokploy/dokploy/security/advisories)
- Dokploy ינואר 2026: CVE-2026-24841 (הזרקת פקודות ב־WebSocket של הטרמינל, 9.9, תוקן ב־0.26.6) ו־**CVE-2026-24840 — סיסמת מסד נתונים קבועה בסקריפט ההתקנה, זהה כמעט בכל ההתקנות** (8.0, תוקן ב־0.26.6); 2025: CVE-2025-53825 (RCE ב־Preview Deployments, 9.4) **[משני — מראות של advisories]** — [cve.imfht.com](https://cve.imfht.com/product/dokploy?lang=en); [cve.report](https://cve.report/vendor/Dokploy)
- **Portainer CE**: מקבץ ב־28/05/2026 — CVE-2026-33590 (ברירות מחדל לא בטוחות: משתמש רגיל מקבל גישה למערכת הקבצים של השרת והרצת קוד), CVE-2026-44848 ו־44849 (עקיפת הגבלות דרך plugins / Swarm, 8.8–9.4 לפי המקור), תוקנו ב־2.33.8 / 2.39.2 / 2.41.0; דיווח לא מאומת על CVE-2026-72533 עד 2.44.0 **[משני]** — [Averlon](https://research.averlon.ai/vulnerability-intelligence/cve/CVE-2026-44848); [isitpatched](https://isitpatched.com/portainer/vulnerabilities)
- **CapRover**: אין אף advisory מפורסם ב־GitHub; "רק הגרסה האחרונה מקבלת תיקונים" **[מאומת]** — [CapRover security](https://github.com/caprover/caprover/security). (היעדר הודעות ≠ הוכחה לבטיחות — ייתכן שפחות חוקרים בודקים אותו.)
- **aaPanel**: רשומה מ־03/2026 על v7.57.0 — העלאת קובץ שרירותית שמובילה להרצת קוד, CVSS 9.8, ייתכן בלי התחברות; קודם: path traversal שחשף את מפתח ה־SSH הפרטי של root (v6.8.21), CVE-2020-14421 (הרצת פקודות דרך מסך Cron, עם exploit פומבי) **[משני]** — [cvedetails](https://www.cvedetails.com/vulnerability-list/vendor_id-23472/ophttprs-1/Aapanel.html); [inthewild](https://inthewild.io/vuln/CVE-2020-14421); [woktron](https://www.woktron.com/blog/vulnerability-uncovered-in-aapanel-hosting-control-panel/). לא נמצא דיווח מאומת על קמפיין פריצה המוני ל־aaPanel ב־2026 (היו כתבות על cPanel מאתרים מפוקפקים — לא הסתמכתי).

### Inferences
- הדפוס זהה בשני המובילים: כל שדה בממשק (שם ענף, שם volume, שם image, משתני סביבה) הופך בסוף לפקודת shell עם root. ככל שיש יותר יכולות — יותר שדות — יותר פרצות. זו תכונה של המבנה ("דימון root אחד"), לא תקלה חד־פעמית.
- רוב הפרצות דורשות "משתמש מחובר" — אצל בעלים יחיד בלי משתמשים נוספים, ומאחורי VPN, הסיכון המעשי יורד מאוד. ה־webhook שלא דורש התחברות (HMAC עם סוד ריק) — הוא בדיוק מה שנחשף כשמחברים GitHub; לכן גם ה־webhook צריך סוד.
- לחלופה "Compose + GitHub Actions דרך SSH" אין משטח תקיפה של לוח בכלל: אין דף התחברות, אין API, אין שדות שהופכים ל־shell; מה שנשאר הוא SSH (מפתח בלבד) ו־GitHub Secrets.

### Gaps
- מספר מדויק של CVE לכל כלי ב־NVD ו"זמן עד תיקון" — לא נמדד; מקורות המעקב סותרים בציונים (8.8 מול 9.9).
- לא אומת ב־NVD קיומם של CVE-2026-84694 / 15507 / 72902 (מספרים ממקורות משניים בלבד).
- רקורד האבטחה של Komodo ו־Easypanel — לא נבדק.

## שאלה 3: מה ממליצים מפתחים מנוסים ב־2025–2026, ומה התלונות הנפוצות

### Takeaway
הקונצנזוס בהשוואות: Coolify = הכי שלם עם ממשק, Dokploy = ממשק נקי ו־Compose טוב אבל צעיר, Kamal/Dokku = למי שרוצה "תשתית כקוד" בלי לוח. תלונות קבועות על Coolify: באגים בפריסה/proxy, ממשק כבד, "שוכח" קונטיינרים של Compose; על Dokploy: לפני 1.0 ורישיון מפוצל. הרבה מההשוואות נכתבו בידי מי שמוכר מוצר או שירות — לקרוא בזהירות.

### Cited Findings
- HN, מרץ 2025: "חוויתי כל כך הרבה באגים בפריסות Docker שלא יכולתי לסמוך עליו בייצור"; באותו שרשור — תקלה ותיקה של קפיצות ל־100% CPU; מנגד: "שנה איתו, מאוד מרוצה, תחזוקה נמוכה ויציב" **[משני — דעות]** — [HN 43304612](https://news.ycombinator.com/item?id=43304612); [HN 43589149](https://news.ycombinator.com/item?id=43589149)
- HN, אפריל 2025: ערב שלם על proxy שלא עולה בלי משוב בממשק → חזר ל־Docker רגיל; המתחזק ענה שמגיעים שיפורי יציבות **[משני]** — [HN 43594790](https://news.ycombinator.com/item?id=43594790)
- HN (~מאי 2026, "לפני 5 חודשים"): "Coolify מלא יכולות אבל חוויית השימוש סובלת"; "Komodo קצת קשה להבין ולמצוא מודל פריסה"; Dockge = "ממשק פשוט לקונטיינרים שרצים"; המתחזק של Dokku: "לטוב ולרע, אנשים מאוד אוהבים ממשק חינמי" **[משני]** — [HN 47876352](https://news.ycombinator.com/item?id=47876352)
- WZ-IT (23/08/2026): Coolify — לסטאק מעורב עם ממשק, "לבדוק עדכונים על מופע נפרד קודם" (קצב שינוי מהיר); Dokploy — רק אחרי בדיקת הרישיון; CapRover — כשיציבות חשובה; Dokku/Kamal — כשהפריסה כבר בסקריפט והצוות בטרמינל **[משני — החברה מפעילה Coolify ללקוחות ומוכרת "PaaS exit review" מ־€1,490]** — [WZ-IT](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/)
- סקירות 2026: Coolify "מסוכן למשתמשים לא טכניים שמצפים לאחסון מנוהל"; ממשק איטי עם הרבה משאבים פתוחים **[משני, חלקן ממתחרים]** — [LumaDock](https://lumadock.com/tutorials/coolify-vs-dokploy); [temps.sh (מתחרה)](https://temps.sh/blog/coolify-review-2026)
- הוראות "בטוחות" של Coolify עצמו: לא לחשוף את דף ההרשמה, לגבות את `APP_KEY` — כלומר גם הספק מניח שהלוח הוא נכס רגיש **[מאומת]** — [Coolify docs](https://coolify.io/docs/get-started/installation)

### Inferences
- לבעלים לא טכני, "לוח עם ממשק" נשמע קל, אבל התלונות מראות שכשמשהו נשבר בלוח (proxy, Traefik, Compose) — צריך מישהו טכני לפתור, וממשק לא עוזר. במקרה הזה ה"מישהו" הוא Claude Code — שעובד טוב יותר עם קבצים ופקודות מאשר עם ממשק דפדפן.
- קצב העדכונים של Coolify (~10 בחודש) הוא חרב פיפיות: תיקונים מהר, אבל גם שבירות; חייבים לעדכן כל הזמן בגלל האבטחה.

### Gaps
- לא נאסף דגימה שיטתית מ־r/selfhosted 2026 (החיפוש החזיר בעיקר HN וכתבות).
- אין סקר מסודר של "מה מפתחים מנוסים בוחרים" — רק דעות ובלוגים.

## שאלה 4: בפרויקט שמנוהל בידי AI — האם לוח גרפי בכלל יתרון, לעומת "תשתית כקוד" + לוח סטטוס לקריאה בלבד?

### Takeaway
בפרויקט הזה — **לא**. Claude Code עובד הכי טוב עם קבצים ב־git ופקודות (Compose + GitHub Actions/SSH או Kamal): כל שינוי נבדק, מתועד, ניתן לביטול ולשחזור על שרת חדש בדקות, ומשטח התקיפה הוא רק SSH. מה שהבעלים צריך מהטלפון הוא **מבט סטטוס**, לא כפתורי שליטה — ולזה מתאימים כלים קלים ונפרדים: Uptime Kuma (האם השירות חי + התראות), Beszel (CPU/RAM/דיסק של השרת), Dozzle (לוגים חיים) — כולם קוד פתוח פופולרי, וכולם רק מאחורי Tailscale/Cloudflare Access.

### Cited Findings
- Kamal: "ההגדרות חיות בריפו כ־YAML", פריסה ב־SSH, אין שכבת פלטפורמה שרצה על השרת **[משני]** — [WZ-IT](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/); [סיכום השוואות](https://www.bitdoze.com/coolify-vs-dokploy-vs-kamal-2/)
- Komodo מציע דרך ביניים: Compose בריפו git, webhook מפריס ב־push, "כל השינויים מתועדים ב־git וניתנים לביטול" — עם לוח **[משני]** — [Hetzner tutorial](https://community.hetzner.com/tutorials/deploy-containers-with-komodo)
- Docker Compose לבדו כבר תומך ב־GPU (`deploy.resources.reservations.devices`) **[מאומת]** — [Docker docs](https://docs.docker.com/compose/how-tos/gpu-support/)
- כלי הסטטוס: Uptime Kuma 92.2K כוכבים (MIT), Beszel 26.0K (MIT, מ־07/2024), Dozzle 14.6K (MIT, issue פתוח אחד), Netdata 80.8K (GPL-3.0) **[מאומת — GitHub 08/10/2026]** — [GitHub](https://github.com/louislam/uptime-kuma)
- הלקח מ־Coolify/Dokploy/Portainer: הפרצות החמורות נמצאות בדיוק ביכולות "שליטה" (טרמינל בדפדפן, שדות שהופכים ל־shell, webhook בלי סוד) **[מאומת — דפי advisories]** — [Coolify advisories](https://github.com/coollabsio/coolify/security/advisories); [Dokploy advisories](https://github.com/Dokploy/dokploy/security/advisories)

### Inferences
- **הצעת מבנה (הסקה):** ריפו `infra/` עם `compose.yaml` לכל שירות + `.github/workflows/deploy.yml` שמתחבר ב־SSH (מפתח ייעודי, משתמש לא־root בקבוצת docker, או דרך Tailscale) ומריץ `docker compose pull && up -d`; סודות ב־GitHub Secrets → קובץ `.env` בשרת (הרשאות 600), לא בריפו הציבורי. Cron/מתזמנים = שירות Compose נוסף (או systemd timer). הטריגר מה־Vercel proxy לעובד — HTTPS דרך Cloudflare Tunnel או endpoint עם מפתח, לא פורט פתוח.
- בדיוק כמו בפרויקט הקיים (Vercel + GitHub Actions + בדיקות), זה המודל ש־Claude כבר שולט בו — אותו פרוטוקול פריסה ובדיקה.
- נעילה: אפסית — Compose רץ על כל ספק; מעבר מ־Hetzner ל־OVH = `rsync` של volumes + הרצת ה־workflow על שרת חדש.
- חיסרון: אין כפתור "התקן Postgres בלחיצה" או גיבוי S3 מובנה — Claude כותב את זה פעם אחת (שירות Compose לגיבוי, למשל pg_dump/restic ל־S3/Backblaze).
- לוח הטלפון: Uptime Kuma (דף סטטוס + התראות לטלגרם/מייל) + Beszel (גרפים, התראות דיסק/RAM) מספיקים; Dozzle לקריאת לוגים. אפשרי גם לחשוף דף סטטוס ציבורי לקריאה בלבד של Uptime Kuma בלי לחשוף את הממשק.

### Gaps
- לא נבדק רקורד האבטחה של Uptime Kuma/Beszel/Dozzle (גם הם ממשקי ווב — Dozzle מחזיק את ה־Docker socket; חובה מאחורי VPN).
- לא אומתה צריכת המשאבים של Beszel/Uptime Kuma.

## שאלה 5: מטריצת המלצה — עכשיו (עובד אחד, שרת אחד) מול בהמשך (הרבה שירותים, כמה שרתים, GPU)

### Takeaway
**עכשיו: בלי לוח** — Docker Compose בריפו + GitHub Actions דרך SSH/Tailscale + Uptime Kuma/Beszel לטלפון. **בהמשך (5+ שירותים, 2–3 שרתים, GPU):** להישאר בקוד ולשקול Kamal או Komodo (שומר את ה־Compose ב־git); Coolify רק אם הבעלים באמת רוצה לגעת בממשק, ורק מאחורי Tailscale עם עדכונים שוטפים. לא מומלצים: לוחות אחסון קלאסיים (במיוחד aaPanel), חנויות אפליקציות לבית, Easypanel (סגור + בתשלום לגיבויים), Portainer כ־PaaS (הוא מנהל קונטיינרים, לא פורס מ־git), Dokploy לייצור (לפני 1.0 + רישיון מפוצל + ~60 advisories).

### Cited Findings
- Coolify: Apache-2.0, הקהילה הגדולה ביותר, ריבוי שרתים וקטלוג גדול — אבל ~61–70 advisories ו־52,890 לוחות חשופים בינואר 2026 **[מאומת/משני כמצוין למעלה]** — [Coolify advisories](https://github.com/coollabsio/coolify/security/advisories); [webpronews](https://www.webpronews.com/coolify-reveals-11-critical-vulnerabilities-exposing-52000-instances/)
- Dokploy: לפני 1.0, חלק קנייני, ~60 advisories עם 6 קריטיות ביום אחד (21/07/2026) **[מאומת]** — [Dokploy advisories](https://github.com/Dokploy/dokploy/security/advisories); [Dokploy LICENSE](https://github.com/Dokploy/dokploy/blob/canary/LICENSE.MD)
- Kamal: MIT, 37signals, ריבוי שרתים דרך SSH, בלי שכבה שרצה על השרת **[משני]** — [WZ-IT](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/)
- Komodo: GPL-3.0, 12.7K כוכבים, Compose מ־git + webhook, סוכן periphery לכל שרת **[מאומת/משני]** — [Komodo docs](https://komo.do/docs/deploy/compose)
- aaPanel: RCE 9.8 ב־2026, היסטוריה של חשיפת מפתח root **[משני]** — [cvedetails](https://www.cvedetails.com/vulnerability-list/vendor_id-23472/ophttprs-1/Aapanel.html)
- Easypanel: גיבויי DB רק בתשלום ($10.9+/שרת/חודש), אשכול alpha **[משני]** — [Easypanel pricing](https://easypanel.io/pricing)

**המטריצה (הסקה מבוססת על הממצאים):**
| מצב | מומלץ | חלופה סבירה | לא מומלץ |
|---|---|---|---|
| עכשיו: עובד תרגום אחד, שרת אחד | Compose בריפו + GitHub Actions (SSH דרך Tailscale) + Uptime Kuma + Beszel | Kamal | כל לוח פתוח לאינטרנט; aaPanel/cPanel/Plesk; CasaOS/Umbrel |
| 3–10 שירותים (בוטים, תורים, מתזמנים, API קטן, DB) | אותו מבנה + שירות גיבוי ל־S3 + Dozzle | Komodo (מאחורי Tailscale) | Dokploy בייצור; Easypanel |
| כמה שרתים + שרת GPU (Open WebUI + Ollama) | Kamal או Compose לכל שרת מאותו ריפו; GPU דרך `deploy.resources` | Coolify מאחורי Tailscale, משתמש יחיד, terminal כבוי, עדכון שבועי | Portainer כפלטפורמת פריסה; Kubernetes (Kubero) — כבד מדי לבעלים יחיד |
| אם הבעלים רוצה ממשק ללחיצות | Coolify (הכי בשל, קוד פתוח מלא) — רק מאחורי VPN | Komodo | Dokploy (רישיון + בשלות) |

### Inferences
- הקריטריון שמכריע: "מי מתחזק?" — כאן Claude Code. לוח גרפי מוסיף שכבה שצריך לעדכן כל שבוע בגלל אבטחה, ש־Claude שולט בה פחות טוב מקבצים, ושלא מוסיפה יכולת שהעובד צריך.
- ההחלטה הפיכה: קובצי Compose שנכתבים עכשיו ייובאו כמו שהם ל־Coolify/Komodo אם יוחלט על לוח בעתיד.

### Gaps
- לא נבדקה תמיכה בפועל ב־GPU דרך ממשק Coolify/Komodo (רק ש־Compose תומך).
- לא נבדקו חלופות "Railway בקוד פתוח" נוספות (למשל Kubero לעומק, Cosmos Cloud) מעבר לנתוני GitHub.
- DigitalOcean App Platform / Render / Railway / Fly.io כנקודת ייחוס — לא נבדקו בסבב הזה (מחירים/יכולות 2026 חסרים).
