# קונצנזוס קהילת המפתחים על ספקי VPS / שרתים ייעודיים / GPU (2025–2026)

> נכתב 08/10/2026. מקורות: Hacker News (כולל חיפוש Algolia ישיר), LowEndTalk, WebHostingTalk, Trustpilot (דרך תוצאות חיפוש — לא נפתח ישירות), בלוגים הנדסיים ודיווחי DCD/The Register. **אזהרה כללית**: רוב דפי "best VPS 2026" ו"X vs Y" שנמצאו הם של מתחרים או אתרי שותפים (affiliate) — מסומנים כך בכל מקום. מספרים מ־Reddit לא נמצאו ישירות בחיפוש (ראו פערים).

## 1. מה הקונצנזוס ב־HN / LowEndTalk / Reddit על כל ספק

### Takeaway
Hetzner הוא ברירת המחדל הכמעט־אוניברסלית של מפתחים מנוסים לשרת זול וחזק באירופה (גם אחרי העלאות המחירים של 2026 — "עדיין זול בהרבה מ־DO/AWS"), עם הסתייגות קבועה: אימות זהות/חסימת חשבון חדש. Contabo = "הכי הרבה משאבים לדולר" אבל מוניטין של מכירת־יתר (CPU steal), רשת ותמיכה חלשות — מתאים לתחביב/עבודות לא־קריטיות. OVH מוזכר כחלופה אירופית מרכזית; LowEndTalk מעדיף ספקים קטנים "low-end" ולא את השמות הגדולים.

### Cited Findings
**Hetzner**
- שרשור HN "Hetzner Prices increase 30-40%" (פברואר 2026, תוקף 01/04/2026): **553 נקודות, 628 תגובות**. הרוב: ההעלאה נסבלת; משתמש אחד — +40–50 אירו לחודש, אחר — +3% על שרת ייעודי. סיבה מצוטטת מהמייל של Hetzner: "עלות זיכרון DRAM עלתה עד 500% מאז ספטמבר 2025" — [HN 47120145](https://news.ycombinator.com/item?id=47120145)
- דוגמאות מהשרשור: EX42-NVMe ‏€49.65→€51.13; ‏AX41 ‏€49.73→€51.22; Server Auction ‏€65.22→€67.18; תוספת זיכרון 128GB ל־AX162-R ‏€46→€264; לפי מגיב: Cloud +38%, bare metal +15%, תוספות זיכרון +575% (לא מאומת רשמית) — [HN 47120145](https://news.ycombinator.com/item?id=47120145)
- השוואה מהשרשור: שרת מקביל ב־DigitalOcean ‏$126 עם שליש מהדיסק, מול ~$40 ב־Hetzner אחרי ההעלאה — [HN 47120145](https://news.ycombinator.com/item?id=47120145)
- חלופות אירופיות שהוזכרו שם: OVH, Netcup, Scaleway, Strato, IONOS, Exoscale; ספקי LowEndBox רבים מעלים מחירים או נסגרים בגלל מחירי RAM — [HN 47120145](https://news.ycombinator.com/item?id=47120145)
- גודל ההעלאה שנוי במחלוקת: issue בגיטהאב טוען שבאפריל זה היה 30–37% בענן ו־2–21% בייעודיים (לא 30–50%, מספר שמקורו בתגובת HN) — [agentdeals #2226](https://github.com/robhunter/agentdeals/issues/2226)
- סבב שני, 15/06/2026: קווי vCPU ייעודי CPX/CCX עד +176%, רק להזמנות חדשות/שינוי גודל — [wz-it (ספק שירותי מיגרציה, בעל עניין)](https://wz-it.com/en/blog/hetzner-price-increase-june-2026-cpx-ccx-alternatives/); ‏CX22 ‏€3.95→€5.39 — [Michael Tsai](https://mjtsai.com/blog/2026/03/09/hetzner-price-hikes/); בארה"ב VPS עלה 107–204% לפי [Cybernews](https://cybernews.com/security/hetzner-increases-vps-hosting-price/)
- Hetzner + Coolify מוצג בשרשורי HN כהמלצת ברירת המחדל להחלפת PaaS — [HN 37107900](https://news.ycombinator.com/item?id=37107900), [HN 45480506](https://news.ycombinator.com/item?id=45480506)

**Contabo** (חיפוש Algolia ישיר ב־HN, תגובות מ־01/01/2025 עד 09/2026 — 37 תגובות בחלק שנקרא)
- מתוך 26 תגובות עם עמדה: ~50% חיוביות (מחיר/ערך: "‎$5 = 8GB RAM, 4 vCPU, 75GB NVMe", "יציב יחסית"), ~42% שליליות, ~8% מעורבות — [HN Algolia: contabo](https://hn.algolia.com/api/v1/search?query=contabo&tags=comment&numericFilters=created_at_i>1735689600&hitsPerPage=40)
- ציטוטים שליליים חוזרים: "Contabo does have some steal factor involved… support times aren't great" (24/06/2026, [HN 48664166](https://news.ycombinator.com/item?id=48664166)); "overprovisioned with steal factor (Like Contabo) is universally hated" (03/03/2026, [HN 47233184](https://news.ycombinator.com/item?id=47233184)); "The most overshared vps provider I know is contabo" (29/01/2026, [HN 46818704](https://news.ycombinator.com/item?id=46818704)); "constant IPv4 issues and IPv6 goes down for several days" (30/01/2026, [HN 46823320](https://news.ycombinator.com/item?id=46823320))
- לפי מגיב ב־HN, Contabo העלתה מחירים ב־06/2026 ב־30–35% (תגובה בודדת, לא מאומת) — [HN 48542752](https://news.ycombinator.com/item?id=48542752); מגיב אחר באותו שרשור: "מחיר Contabo לא השתנה" — סתירה — [HN 48549708](https://news.ycombinator.com/item?id=48549708)
- דיווח (משני, מעמוד של מתחרה ForexVPS) על משתמש Reddit עם ~80% steal — לא אומת — [ForexVPS](https://www.forexvps.net/resources/forexvps-vs-contabo/)
- ביקורות 2026 (אתרי ביקורות, חלקם שותפים): "מספיק לרוב העומסים אבל איטי במבחני CPU/זיכרון מול Kamatera/UpCloud" — [Afftank](https://afftank.com/blog/contabo-review); "לא יוצא דופן אבל אמין ומהיר" — [Cybernews](https://cybernews.com/best-web-hosting/contabo-review/); דיסק 3,328MB/s (64k) — [HOSTtest](https://www.hosttest.co.uk/reviews/contabo-vps); כתיבה רציפה 524MiB/s — [HostAdvice](https://hostadvice.com/hosting-company/contabo-reviews/)

**LowEndTalk — סקר הספקים 2025**
- עשרת הראשונים בקולות: GreenCloudVPS ‏120, Onidel ‏47, RackNerd ‏45, HostHatch ‏38, HostBrr ‏36, HostDZire ‏35, Host-C ‏34, SolidVPS ‏34, BuyVM ‏21, OVH/SoYouStart/Kimsufi ‏21 — [LET Provider Poll 2025 Results](https://lowendtalk.com/discussion/216378/provider-poll-2025-the-results). הסקר כלל פרסים שתרמו הספקים (GreenCloud תרמה הכי הרבה) — הטיה אפשרית — [LET](https://lowendtalk.com/discussion/215699/provider-poll-2025-choose-your-favorite-providers-and-stand-a-chance-to-win-a-prize); יש אף שרשור תלונה על GreenCloud אחרי הזכייה — [LET 216876](https://lowendtalk.com/discussion/216876/am-i-in-the-wrong-here-greencloud-voted-2025-top-provider-review-experience)

**PaaS (Fly.io / Railway / Render / Coolify)**
- Railway: "5 תקלות גדולות מאז 11/2025, כולל השבתה של 8 שעות במאי 2026" — המקור הוא השוואה של מתחרה — [tech-insider](https://tech-insider.org/render-vs-railway-vs-fly-io-2026/), [Render (מתחרה)](https://render.com/articles/best-railway-alternatives)
- Fly.io: תקלות תכופות וקצרות, הרוב מ־Consul/Corrosion/6PN; Postgres שלהם מוצהר "לא מנוהל" — [Kuberns (מתחרה)](https://kuberns.com/blogs/is-fly-io-good-for-production/)
- Render: הנתונים החיוביים מגיעים בעיקר מ־Render עצמה; מדידה עצמאית ישנה (~2.5 שנים) מצאה ב־Render הכי הרבה כשלים (12, ‏99.89%) — [OpenStatus](https://www.openstatus.dev/blog/monitoring-latency-cf-workers-fly-koyeb-raylway-render)
- Coolify ב־HN: "one of those PHP apps that's weirdly reliable" — [HN 43555996](https://news.ycombinator.com/item?id=43555996); אזהרה חוזרת (שרשור ויראלי 03/2026 לפי מדריך): Docker עוקף את UFW ופורטים של Postgres נחשפים — [Northflank (מתחרה)](https://northflank.com/blog/coolify-alternatives-in-2026)

### Inferences
- הקונצנזוס הוא "Hetzner לברירת מחדל, Contabo רק כשהמחיר הוא הכל והעבודה סובלת האטות" — ל־CPU כבד ורציף (וידאו) ה־steal של Contabo הוא בדיוק הסיכון הרלוונטי.
- גל העלאות המחירים של 2026 (Hetzner, ולפי דיווח גם Contabo ו־Netcup) נובע ממחירי DRAM ופוגע בכל השוק — הפער היחסי מול AWS/DO נשמר.

### Gaps
- לא נמצאו שרשורי Reddit (r/selfhosted, r/hetzner, r/sysadmin, r/webhosting) ישירות בתוצאות החיפוש — אין ספירת הצבעות מ־Reddit.
- כמעט אין דיון קהילתי ממוקד שנמצא על Scaleway, UpCloud, IONOS, Linode/Akamai, Lambda — רק אזכורים כחלופות.

## 2. דירוגים (Trustpilot / G2 / Capterra / HostAdvice)

### Takeaway
דירוגי Trustpilot הפוכים לקונצנזוס של המפתחים: Contabo (~4.6) ו־DigitalOcean (~4.6) גבוהים, Hetzner (~3.0) ו־Vultr (~1.8–2.2) נמוכים — בעיקר בגלל תלונות על חסימות חשבון/אימות של לקוחות חדשים, לא על איכות השרת. לכן Trustpilot הוא אות חלש לבחירה טכנית.

### Cited Findings
- **Contabo**: ‏4.6 מ־~11K ביקורות (צילום 09–10/2026) — [סיכום חיפוש של Trustpilot](https://ie.trustpilot.com/review/contabo.com); צילום אחר: 4.5 מ־~8,600 — [Trustpilot IE](https://ie.trustpilot.com/review/contabo.com) (המספרים משתנים בין עותקים)
- **OVHcloud**: ‏3.8 מ־8,605 ביקורות — [Trustpilot](https://www.trustpilot.com/review/ovhcloud.com)
- **Netcup**: ‏3.8 מ־2,982 (עותק אחר: 2,586); ~69% חמישה כוכבים ו־~19% כוכב אחד — [Trustpilot](https://uk.trustpilot.com/review/netcup.com)
- **Hetzner Online**: ‏~3.0 מ־~3K ביקורות (עותק NZ: 2,664); דף hetzner.cloud ‏2.6 מ־8 ביקורות בלבד — [Trustpilot NZ](https://nz.trustpilot.com/review/hetzner.com), [hetzner.cloud](https://www.trustpilot.com/review/hetzner.cloud)
- **DigitalOcean** ‏4.6 מ־2,284; **Vultr** ‏1.8 מ־538 — לפי RFP.wiki (אמינות בינונית, סתירות פנימיות) — [RFP.wiki](https://www.rfp.wiki/cloud-computing/digitalocean/vultr); מקור אחר: Vultr ~2.2, Linode ~3 — [SSD Nodes (מתחרה)](https://www.ssdnodes.com/blog/digitalocean-vs-linode-vs-vultr/)
- סיבת הדירוג הנמוך של Vultr/Linode לפי אותו מקור: אימות חשבון אגרסיבי ו"false positives" של מניעת הונאה בהרשמה; לקוחות ותיקים נאמנים — [SSD Nodes](https://www.ssdnodes.com/blog/digitalocean-vs-linode-vs-vultr/)
- **Kamatera**: Trustpilot ‏3.5 מ־170; HostAdvice ‏4.8 מ־141 (HostAdvice — אתר עם קישורי שותפים) — [WebsitePlanet](https://www.websiteplanet.com/web-hosting/kamatera/), [HostAdvice עברית](https://he.hostadvice.com/hosting-company/kamatera-reviews/); ביקורת Capterra ישראל: ביצועים טובים, צ'אט תמיכה טוב — [Capterra IL](https://www.capterra.co.il/software/177921/kamatera)

### Inferences
- הפער בין Trustpilot ל־HN מוסבר בכך שמי שנחסם בהרשמה כותב ביקורת, ומי שמרוצה לא; Contabo כמעט לא חוסמת ולכן מקבלת ציון גבוה.

### Gaps
- לא נפתח Trustpilot ישירות לכל ספק (Scaleway, UpCloud, IONOS, DigitalOcean) — המספרים משניים. G2 לא נבדק.
- לא נמצאו ביקורות אמיתיות של מפתחים ישראלים על Kamatera בפורומים (Fxp, תפוז, קבוצות פייסבוק) — רק אתרי השוואה ישראליים שנראים שיווקיים (Netolink, Check-Box, Oznet). ב־Check-Box ביקורת בודדת על חיוב אחרי השעיה — [Check-Box](https://check-box.co.il/brand/kamatera/).

## 3. תלונות חוזרות לפי ספק

### Takeaway
Hetzner — אימות זהות וחסימה מיידית; Contabo — steal, רשת, תמיכה איטית; OVH — הלקח של שריפת שטרסבורג (גיבוי באותו אתר); Oracle Free — השבתת מכונות "בטלות" וחסימות חשבון; Kamatera — לא למתחילים, תוספות בתשלום; ענני ישראל — יקרים ויציאת נתונים יקרה פי 4.

### Cited Findings
- **Hetzner — אימות**: Hetzner עצמה (מצוטט ב־LET, 07/2025): "בגלל המחירים הנמוכים אנחנו מושכים רמאים וספאמרים" ולכן מבקשת דרכון כשיש ספק — [LET 207732](https://lowendtalk.com/discussion/207732/hetzner-storage-box-new-account-verification); אפשרות חלופית: תשלום €20 ב־PayPal; אישור אוטומטי נדיר — שם
- מקרים: חשבון נסגר תוך שניות (משתמש בבאלי עם כרטיס אמריקאי); משתמש מאוקראינה נדחה אחרי יומיים — [WHT](https://www.webhostingtalk.com/showthread.php?t=1895485); חסימה בגלל חוב בחשבון ישן — [LET 190231](https://lowendtalk.com/discussion/190231/serious-problem-with-hetzner-sign-up-banned-instantly); לולאת אימות אינסופית — [Ask HN 41555055](https://news.ycombinator.com/item?id=41555055)
- 03/2026: Hetzner שילבה את KYC של iDenfy בהרשמה (לפי הודעת iDenfy) — מתוך סיכום החיפוש; [CB Insights/iDenfy](https://www.cbinsights.com/company/idenfy/customers)
- **OVH**: שריפה 10/03/2021 — SBG2 נהרס, ~3.6 מיליון אתרים; גיבויים באותו אתר; לקוחות bare metal בלי גיבוי של OVH — [DEV](https://dev.to/vivian-voss/the-fire-that-reached-the-backups-the-ovhcloud-strasbourg-data-centre-fire-2021-1m8f), [TechRadar](https://www.techradar.com/news/ovh-says-it-doesnt-hold-backups-for-some-systems-affected-by-data-center-fire); בית משפט בליל חייב את OVH ב־>€400K לשתי חברות (מקור: בלוג של ספק גיבוי — לאמת) — [rdem-systems](https://nimbus.rdem-systems.com/en/blog/ovh-strasbourg-fire-multi-site-backup/); OVH הבטיחה גיבוי חינם לכל הלקוחות — [TechRadar](https://www.techradar.com/news/ovh-says-it-will-now-back-up-all-customer-data-for-free-following-fire)
- **Oracle Always Free**: מכונה נחשבת "בטלה" אם ב־7 ימים אחוזון 95 של CPU <20%, רשת <20%, זיכרון <20% (A1) — ונעצרת (לא נמחקת); מעבר ל־PAYG בלי חיוב בתוך המכסה מונע זאת — [Oracle docs](https://docs.oracle.com/iaas/Content/FreeTier/freetier.htm); "Out of capacity" ביצירת ARM — [GitHub oci-arm-host-capacity](https://github.com/oeufmeister/oci-arm-host-capacity); חסימת חשבון בתשלום בלי הסבר (אנקדוטה) — [DEV](https://dev.to/nobinkhan/beware-of-oracle-cloud-my-experience-with-unexplained-account-termination-12i); ‏HN 2023: "OCI will randomly shut your instances down" — [HN 36008957](https://news.ycombinator.com/item?id=36008957)
- **Kamatera**: לא ידידותי למתחילים, אין SSL/דומיין/גיבוי חינם, 30 יום ניסיון, 5 מרכזי נתונים בישראל — [WebsitePlanet](https://www.websiteplanet.com/web-hosting/kamatera/)
- **AWS il-central-1** (נפתח 08/2023): m6g.xlarge ‏$0.1806/שעה בתל אביב מול $0.1540 בווירג'יניה; יציאה לאינטרנט $0.11/GB מול $0.09; העברה מהאזור לאזור אחר יקרה פי 4 — [DoIT](https://www.doit.com/blog/aws-region-in-tel-aviv-israel-price-comparison-versus-other-regions/)
- **GCP me-west1 / Azure Israel Central**: נתוני אגרגטורים לא ניתנים להשוואה (סלים שונים) — [devzero](https://www.devzero.io/instances/gcp/regions/me-west1), [cloudprice](https://cloudprice.net/regions)

### Inferences
- לישראלי: הסיכון המעשי ב־Hetzner הוא בהרשמה (כרטיס/כתובת/מדינה לא תואמים, VPN) — כדאי להירשם עם תעודה וכרטיס ישראליים תואמים ובלי VPN.
- לקח OVH חל על כל ספק זול: גיבוי מחוץ לאתר/לספק.

### Gaps
- אין נתונים כמותיים עצמאיים על steal ב־Contabo (רק אנקדוטות); אין נתוני תקלות 2025–2026 של Hetzner/OVH/Netcup שנמצאו.
- לא נמצא מידע עדכני על תמיכת OVH (חוץ מהשריפה) ועל Scaleway/UpCloud/IONOS.

## 4. השוואות ביצועים עצמאיות ומקרי מיגרציה

### Takeaway
מקרי מיגרציה מתועדים היטב מראים חיסכון של 70–76% במעבר מ־AWS/DO ל־Hetzner (כותרות של 90% — פחות אמינות); 37signals חוסכת ~$2M בשנה ביציאה מהענן לחומרה משלה. השוואות DO/Vultr/Linode מראות פערי ביצועים קטנים. VPSBenchmarks לא נגיש ישירות במחקר זה.

### Cited Findings
- **37signals**: חשבון הענן ירד מ־$3.2M ל־$1.3M בשנה; חומרת Dell ב־~$700K שהוחזרה ב־2023; צפי >$10M חיסכון ב־5 שנים; S3 ‏~$1.5M בשנה הוחלף ב־Pure Storage ב־<$200K; AWS ויתרה על $250K עמלות יציאה — [DCD](https://www.datacenterdynamics.com/en/news/37signals-claims-it-saved-almost-2m-last-year-from-cloud-repatriation/), [DCD S3](https://www.datacenterdynamics.com/en/news/37signals-begins-exiting-aws-storage-service/), [ITPro](https://www.itpro.com/cloud/cloud-computing/this-software-company-says-ditching-the-cloud-was-worth-usd10-million-in-savings-and-theres-still-more-to-come). הסתייגות: לא כולל רענון חומרה, צוות תפעול, חשמל/קירור — שם
- **Digital Society** (10/2025): ‏$559.36→$132.96 לחודש (−76%) עם פי 3 קיבולת, Hetzner ARM + Talos — [digitalsociety.coop](https://digitalsociety.coop/posts/migrating-to-hetzner-cloud/), ניתוח: [bex.co](https://bex.co/blog/2026/09/25/aws-hetzner-arm-talos-76-percent)
- מקרה SaaS בריטי (מתועד בגיטהאב): ~72% חיסכון, בלי לספור קרדיטים — [GitHub](https://github.com/h4nz0x/aws-to-hetzner-case-study)
- HN: "עברנו מ־AWS ל־Hetzner, חסכנו 90%, שמרנו ISO 27001 עם Ansible" — [HN 44335920](https://news.ycombinator.com/item?id=44335920); טענת נגד: עלות מהנדס לתחזוקת k8s על bare metal עולה על חיסכון של ~$400 לחודש — [HN 45614922](https://news.ycombinator.com/item?id=45614922)
- DO/Vultr/Linode (מצוטט מ־VPSBenchmarks דרך Codeless — משני): DO מוביל ב־single-core, Linode ב־RAM, DO/Vultr בדיסק; "הפער מינימלי" — [Codeless](https://codeless.co/vultr-vs-digitalocean-vs-linode/)
- הטיית שותפים: דפי השוואה של SSD Nodes, DigitalOcean, Render, Northflank, Kuberns — כולם מתחרים של הנבחנים; HostAdvice/WebsitePlanet/Cybernews — קישורי שותפים.

### Inferences
- לעבודות CPU רציפות (וידאו) היחס מחיר/ביצועים של Hetzner (ובמיוחד שרתי ייעודי/Server Auction) הוא היתרון שעליו הקהילה מצביעה; ב־Contabo — צפוי steal.

### Gaps
- VPSBenchmarks, ServerScope ו־Geekbench Browser לא נפתחו ישירות — אין מספרי בנצ'מרק עצמאיים לכל ספק.

## 5. "להתחיל קטן ולגדול בלי מיגרציה" + "LLM 24/7 בבית מול API"

### Takeaway
המסלול שהקהילה ממליצה עליו: VPS זול (Hetzner Cloud) + Coolify/Docker → שרת ייעודי (Hetzner AX/Auction) כשהעומס קבוע; גיבוי מחוץ לספק. ל־LLM: API זול יותר מהשכרת GPU 24/7 אלא אם נפח הטוקנים גבוה מאוד; GPU שכור — לפרצי עבודה (RunPod יציב יותר, Vast.ai הכי זול ופחות אמין).

### Cited Findings
- Hetzner + Coolify כמסלול ברירת מחדל — [HN 37107900](https://news.ycombinator.com/item?id=37107900), [HN 45480506](https://news.ycombinator.com/item?id=45480506); עם Coolify "אתה אחראי לזמינות, עדכונים, גיבויים" — [Northflank (מתחרה)](https://northflank.com/blog/coolify-alternatives-in-2026)
- **Hetzner GEX44**: ‏RTX 4000 SFF Ada ‏20GB, i5-13500, 64GB; מחיר השקה €184 לחודש + €79 התקנה — [Hetzner](https://www.hetzner.com/pressroom/new-gpu-server/); לפי סקירה, 08/2026: €234 + €114 התקנה, רק בפלקנשטיין — [gpuhosted](https://gpuhosted.com/en/hetzner-gpu-review/) (סתירה — לבדוק במחשבון); תקרה נוחה ~14B, ‏32B Q4 ממלא את הכרטיס — [Effloow](https://effloow.com/articles/hetzner-cloud-ai-gpu-server-guide-2026); HN: "לטעון LLM מכווץ ולקרוא לו כמה עשרות פעמים ביום — €2,200 לשנה זה יותר מדי" — [HN 39601229](https://news.ycombinator.com/item?id=39601229)
- RunPod: ‏H100 ‏$2.89–3.29/שעה → $2,100–3,100 לחודש 24/7; RTX 4090 ‏~$0.34–0.69/שעה; Vast.ai — שוק P2P בלי SLA, H100 חציון $2.13/שעה (טווח $1.33–6.71) — [promptquorum](https://www.promptquorum.com/power-local-llm/cloud-gpu-rental-guide-2026), [klymentiev](https://klymentiev.com/blog/runpod-vs-lambda-vs-vast)
- נקודת איזון: RTX 4090 בבית ~$104 לחודש — מול GPT-4o משתלם מ־8M טוקנים לחודש, מול GPT-4o-mini רק מ־204M+ — [renezander](https://renezander.com/guides/self-hosted-llm-vs-api/); השכרה זולה ב־30–50% מבעלות כשמדובר בפרצים ולא 24/7 — [kunalganglani](https://www.kunalganglani.com/blog/local-llm-cost-breakeven)

### Inferences
- למפתח יחיד בישראל: להתחיל ב־Hetzner Cloud (CCX/CX לפי הצורך — לשים לב להעלאת 06/2026 ב־CCX), לעבור לייעודי מ־Server Auction כשהעבודות רציפות; ענני ישראל (AWS/GCP/Azure) רק אם נדרשת שהות נתונים בישראל.
- LLM 24/7 בבית — כנראה לא כדאי בשלב זה: GEX44 (~€184–234 לחודש) מוגבל ל־~14B; API זול יותר לנפחים נמוכים.

### Gaps
- לא נמצאו שרשורי r/LocalLLaMA ישירים; מספרי האיזון מבוססים על מודלים ישנים (GPT-4o) ובלוגים בודדים.
- אין נתוני Lambda עדכניים מהקהילה.
