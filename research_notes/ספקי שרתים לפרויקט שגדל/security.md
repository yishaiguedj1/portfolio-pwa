# אבטחה בשכירת שרת וניהולו לבד (VPS / ייעודי / GPU) — מצב 2025–2026

> נכתב 08/10/2026. "רשמי" = עמוד של הספק / NVD / OWASP / תיעוד רשמי. "משני" = עיתונות, בלוגים, אתרי השוואה. סיכומי החיפוש עברו דרך מודל ביניים, ולכן כל מספר שמכריע החלטה כדאי לבדוק שוב בעמוד המקור לפני ההמלצה הסופית.

## (א1) עד כמה כל ספק מאובטח כפלטפורמה: הסמכות, הצפנה, DDoS, אבטחת חשבון

### Takeaway
ברמת "החשבון והפלטפורמה", כל הספקים המרכזיים (Hetzner, netcup, Contabo, Vultr, DigitalOcean, OVH) מחזיקים ISO 27001 או SOC 2. ההבדל המעשי נמצא בשני מקומות: הצפנת דיסקים כברירת מחדל (ב־DigitalOcean יש, ב־Hetzner Cloud כנראה אין) ומפתח חומרה ל־2FA. לבעלים יחיד שאינו מומחה, הסיכון האמיתי הוא השרת עצמו ולא הספק.

### Cited Findings
**Hetzner (גרמניה/פינלנד)**
- רשמי: ל־Hetzner יש הסמכת ISO/IEC 27001:2022 בלי החרגות מבקרות Annex A. מסמך ה־SoA פנימי ולא נמסר ללקוחות — [Hetzner: Information security](https://docs.hetzner.com/general/company-and-policy/information-security-at-hetzner/)
- רשמי: Hetzner מתמקדת ב־ISO 27001 ולא ב־SOC 2, כי לדבריה הוא "מתאים יותר לשוק בינלאומי". הביקורת על פארקי Falkenstein נעשתה בידי FOX Certification — [Hetzner: Certificates](https://docs.hetzner.com/general/others/certificates)
- רשמי: יש 2FA בחשבון Hetzner (Hetzner Accounts → Settings → Enable 2‑FA), עם מפתח שחזור. YubiKey מוזכר כאחת השיטות. העמוד עודכן לאחרונה ב־2020 ומתייחס לפאנל "Accounts" — [Hetzner Docs: 2FA](https://docs.hetzner.com/accounts-panel/accounts/two-factor-authentication/). (משני: מדריך לשימוש בטוקני חומרה Token2 בחשבון Hetzner — [Token2](https://www.token2.com/pages/using-token2-hardware-tokens-for-hetzner-account))
- משני (2018): מדריכי קהילה מסבירים איך להצפין Volume של Hetzner Cloud בעצמכם עם LUKS. המשמעות היא שהספק לא מצפין כברירת מחדל, אבל זה לא אושר בעמוד רשמי. החיסרון: אחרי כל הפעלה מחדש צריך לפתוח את ההצפנה ידנית — [stanislas.blog](https://stanislas.blog/2018/12/how-to-use-encrypted-block-storage-volumes-hetzner-cloud/)

**DigitalOcean (ארה"ב)**
- רשמי: Volumes והצילומים שלהם (snapshots) מוצפנים במנוחה כברירת מחדל, בלי שום הגדרה — [DO Docs: Snapshot volumes](https://docs.digitalocean.com/products/snapshots/how-to/snapshot-volumes/)
- רשמי: ההצפנה במנוחה נועדה להגן מגישה פיזית לחומרה. אפשר להוסיף מעליה שכבת LUKS בתוך ה־Volume. ה־Volumes נבדקים במסגרת דוח SOC 2 Type 2 של DigitalOcean — [DO: Shared responsibility – Volumes](https://www.digitalocean.com/security/shared-responsibility-model-volumes)
- סתירה: תשובה בפורום הקהילה טוענת ש"Backups (של Droplet) אינם מוצפנים במנוחה". זו לא תשובה רשמית, והיא עוסקת בגיבויי Droplet ולא ב־Volumes — [DO Community](https://www.digitalocean.com/community/questions/are-the-weekly-server-backups-and-block-storage-encrypted)

**Vultr (ארה"ב)**
- רשמי: לפי עמוד הציות, ל־Vultr יש ISO/IEC 27001:2022, ‏20000‑1, ‏27017, ‏27018, ‏SOC 2+ (HIPAA), ‏CSA STAR Level 1 וסטטוס PCI merchant. היא עוברת ביקורת SOC 2+ Type II שנתית ובדיקות חדירה רבעוניות — [Vultr Compliance](https://www.vultr.com/legal/compliance/); [Vultr blog 06/2024](https://blogs.vultr.com/Announcing-Vultrs-New-ISO-Certifications)

**netcup (גרמניה/אוסטריה)**
- רשמי: netcup מוסמכת ISO 27001 מ־2023, ו־TÜV Nord מאמת את ההסמכה מדי שנה. ההסמכה היא על מערכת הניהול של החברה (אירוח, שרתים וירטואליים ועוד) ולא על מתקן מסוים — [netcup Certifications](https://www.netcup.com/en/about-netcup/certifications)
- משני וסותר: לפי אתר השוואה, ה־DDoS כלול (Anexia DDoS Guard, עד 2Tbps), אבל באותו אתר הוא מופיע גם כשירות בתשלום נוסף. משתמש בפורום מתאר הפעלה איטית ולא גמישה של הסינון — [hosttest.de](https://www.hosttest.de/vs/contabo-netcup); [LowEndTalk](https://lowendtalk.com/discussion/comment/3140316)

**Contabo (גרמניה)**
- טענת הספק: מרכזי נתונים מוסמכי ISO 27001, עם בקרת גישה ומצלמות. הגנת DDoS "always-on" כלולה בכל VPS בלי תוספת — [Contabo blog](https://contabo.com/blog/web-hosting-security/). העמוד הספרדי טוען ש"99% מההתקפות" נבלמות, וזו טענה שיווקית שלא נבדקה באופן עצמאי — [Contabo DDoS](https://www.contabo.com/es/ddos-protection/)

**OVHcloud (צרפת)**
- רשמי: הפלטפורמה Bare Metal Pod קיבלה SecNumCloud 3.2 מ־ANSSI. ההודעה פורסמה ב־31/03/2025, והחלטת ANSSI עצמה מתוארכת ל־24/03/2025. ההסמכה חלה באזורים Gravelines, ‏Roubaix ו־Strasbourg בלבד. התקן כולל מעל 360 קריטריונים. OVH תכננה להרחיב אותו ל־Public Cloud עד סוף 2025, ולא נמצא אישור שזה קרה — [OVHcloud press release](https://corporate.ovhcloud.com/en/newsroom/news/secnumcloud-qualification-bare-metal-pod/); [OVH SecNumCloud page](https://www.ovhcloud.com/en/bare-metal/secnumcloud/)

**Scaleway (צרפת)**
- רשמי: Scaleway נכנסה לתהליך SecNumCloud ב־08/01/2025, ובקשתה התקבלה (אבן הדרך הראשונה) ביולי 2025. העמוד הרשמי, שאינו מתוארך, אומר שההסמכה "טרם הוענקה" — [Scaleway SecNumCloud](https://www.scaleway.com/en/security-and-compliance/secnumcloud/); [Scaleway blog](https://www.scaleway.com/en/blog/secnumcloud-qualification-trusted-cloud/)

**Kamatera (ישראל)**
- משני בלבד: לפי אתר ביקורות (05/2026), Kamatera "מפנה ל־SOC 2 Type II" ומציעה תצורות ברוח PCI-DSS/HIPAA. לא נמצא מקור רשמי ל־ISO 27001 — [cloudtweaks](https://tools.cloudtweaks.com/company/kamatera)

### Inferences
- SecNumCloud רלוונטי רק למוצר הייעודי של OVH (Bare Metal Pod), ולא ל־VPS הזול. לפרויקט אישי זה לא שיקול.
- לפי DigitalOcean, הצפנה במנוחה אצל הספק מגינה רק מגניבת דיסק פיזי. היא לא מגינה מעובד של הספק או ממי שפרץ לשרת שלכם. לכן הצפנה אצל הספק היא שכבה נחמדה, לא קריטית.
- ההחלטה בין הספקים צריכה להתבסס יותר על מחיר, מיקום, חומת אש בענן ו־2FA טוב מאשר על אישורי תקנים, כי לכולם יש משהו.

### Gaps
- לא נבדקו בסבב הזה דפי Trust של Akamai/Linode, Google Cloud me-west1, ‏AWS il-central-1 ו־Azure Israel Central. ידוע כללית שלשלושת הענקים יש ISO 27001/SOC 2/PCI והצפנת דיסקים כברירת מחדל עם אפשרות למפתחות של הלקוח, אבל זה לא אומת כאן לאזורים הישראליים.
- Hetzner: לא נמצא עמוד רשמי שמבהיר אם Volumes ו־Backups מוצפנים במנוחה, אם ה־2FA חל גם על Cloud Console, ואם יש WebAuthn/Passkeys. לא נבדקו בעמוד רשמי גם יומני ביקורת (audit log) והגבלת הרשאות של API tokens.
- איכות ה־DDoS לא נמדדה באופן עצמאי אצל אף ספק.
- הסטטוס העדכני (2026) של SecNumCloud אצל Scaleway ושל OVH Public Cloud — יש לבדוק ברשימת ANSSI.

## (א2) היסטוריית תקריות 2020–2026 ואיך טופלו

### Takeaway
התקרית החשובה ביותר ללקח היא השריפה של OVH בשטרסבורג (03/2021): גיבוי באותו מרכז נתונים נשרף יחד עם השרת, ובית משפט קבע ש־OVH לא עמדה בהתחייבות הגיבוי. אצל שאר הספקים התקריות שנמצאו קטנות יחסית (DigitalOcean) או ישנות (Linode 2013/2016). לגבי Contabo נמצאו רק חשדות לא מאומתים.

### Cited Findings
- **OVH — שריפת SBG2, ‏10/03/2021**: מרכז הנתונים SBG2 בשטרסבורג נהרס — [DCD](https://datacenterdynamics.com/en/news/fire-destroys-ovhclouds-sbg2-data-center-strasbourg); [Malwarebytes](https://www.malwarebytes.com/blog/news/2021/03/ovh-cloud-datacenter-destroyed-by-fire)
- **OVH — פסק דין**: בית המשפט המסחרי של ליל חייב את OVH לשלם 250 אלף אירו לשתי חברות (Bati Courtage 100K, ‏Bluepad 150K) על אובדן מידע. נקבע ש־OVH לא עמדה בהתחייבות הגיבוי ומסרה מידע מטעה על מיקום הנתונים, כי לא ציינה שהגיבוי "מקומי" בלבד. טענת "רשלנות חמורה" בבטיחות האש נדחתה — [cloudnews.tech](https://cloudnews.tech/ovhcloud-sentenced-to-pay-e250000-to-customers-for-data-loss-in-fire-at-their-data-center-in-strasbourg/); [Clubic](https://www.clubic.com/ovh/actualite-456327-pourquoi-ovh-est-condamne-a-verser-100-000-a-un-client-dont-le-serveur-a-brule-lors-de-l-incendie-de-strasbourg.html)
- **OVH — עוד לקחים (משני)**: לפי Journal du Net, קומות SBG2 היו מעץ ולקח כשעה לנתק את החשמל. לפי מנכ"ל Atempo, תוכנית ההתאוששות מאסון היא באחריות הלקוח — [JDN](https://www.journaldunet.com/web-tech/cloud/1499203-six-choses-qu-ovh-ne-dit-pas-sur-l-incendie-de-ses-datacenters-a-strasbourg); [Druva](https://www.druva.com/blog/why-back-up-the-cloud-an-example)
- **DigitalOcean — 05/2020**: מסמך פנימי נשאר פתוח לציבור ונצפה לפחות 15 פעמים לפני שהוסר — [The Hacker News 2020](https://thehackernews.com/2020/05/digitalocean-data-breach.html)
- **DigitalOcean — דליפת פרופילי חיוב (כנראה 04/2021)**: באג אפשר גישה בין 9 ל־22 באפריל. נחשפו שם, כתובת, 4 ספרות אחרונות ותוקף כרטיס, של כ־1% מפרופילי החיוב. סיסמאות לא נחשפו — [Computing](https://computing.co.uk/news/4030605/breach-digitalocean-exposes-customer-billing-profiles)
- **DigitalOcean — 08/2022 (ספק משנה Mailchimp)**: חשבון Mailchimp של DO נפרץ ומיילים של לקוחות נחשפו. חלק קטן מהלקוחות קיבלו איפוס סיסמה לא מורשה. DO פרסמה תחקיר — [DO blog](https://www.digitalocean.com/blog/digitalocean-response-to-mailchimp-security-incident)
- **Linode — 2013**: פריצה לשרתי הרשת ולמסד הלקוחות. מספרי הכרטיסים היו מוצפנים — [Help Net Security](https://www.helpnetsecurity.com/2013/04/16/linode-hackers-say-they-will-release-stolen-customer-data/). **בסביבות 2016**: חשש לחשיפת טבלת משתמשים (סיסמאות מגובבות וסודות 2FA מוצפנים), וכל הסיסמאות אופסו — [Silicon UK](https://silicon.co.uk/security/cyberwar/linode-resets-passwords-183235)
- **Contabo**: לא נמצאה דליפה מאומתת. בפורום Cloudron לקוח חשד בחיוב כרטיס מזויף, ו־Contabo ענתה ש"אין לנו דליפות מידע" — [Cloudron forum](https://forum.cloudron.io/topic/7745/fraudulent-charge-on-credit-card-possible-contabo-breach-tbd). ב־2026 דף הסטטוס של Contabo התריע על פרצה ב־cPanel/WHM, שהיא תוכנה של צד שלישי ולא תקרית של Contabo — [pingoru](https://pingoru.io/providers/contabo/incidents/1484548)

### Inferences
- לקח OVH עבורנו: גיבוי חייב לשבת אצל ספק אחר או לפחות באזור אחר (offsite). "גיבוי" שהספק מוכר באותו מרכז נתונים לא נחשב גיבוי.
- רוב התקריות אצל ספקי VPS נגעו לנתוני חיוב או מיילים של לקוחות, ולא לתוכן השרתים עצמם. לכן הסיכון לסרטונים של המשתמשים נובע בעיקר מתצורת השרת שלנו.

### Gaps
- לא נמצאו תקריות 2020–2026 של Hetzner, ‏netcup, ‏Vultr, ‏Scaleway ו־Kamatera. החיפוש היה קצר, וזה לא אומר שלא היו.
- Akamai/Linode אחרי 2022 לא נבדק.

## (א3) ענני GPU בשוק פתוח (Vast.ai, RunPod): המידע שלכם על מחשבים של זרים

### Takeaway
ב־Community Cloud של RunPod ובמארחים הרגילים של Vast.ai, המכונה שייכת לאדם או לחברה אחרים, וההפרדה מלקוחות אחרים היא ברמת קונטיינר בלבד. בעל המכונה יכול טכנית לראות את הדיסק ואת הזיכרון. לסרטונים ולתמלילים פרטיים של משתמשים מתאים רק RunPod Secure Cloud, או ב־Vast.ai רק Datacenter Partners (ISO 27001 + DPA). אצל Lambda והענקים הבעיה הזו לא קיימת.

### Cited Findings
- רשמי (Vast): הנתונים מבודדים בקונטיינרי Docker. "Verified Hosts" מתאימים ל"מחשוב כללי". "Datacenter Partners" מחזיקים לפחות ISO 27001 וחותמים על DPA, וחלקם גם HIPAA/SOC — [Vast.ai: Private AI models](https://vast.ai/article/running-private-ai-models-without-the-risk-of-data-exposure); [Vast compliance](https://vast.ai/compliance)
- רשמי (Vast): הודעה מאפריל 2025 על SOC 2 **Type I**, "בהכנה ל־Type II". אתרי צבירה טוענים שיש גם Type II, אבל לא נמצא אישור מ־Vast. את הדוח מבקשים ב־compliance@vast.ai — [Vast press release](https://vast.ai/press-release/vast-ai-soc-2-type-1-certification)
- משני (RunPod): ב־Community Cloud המארח הפיזי משותף והבידוד ברמת קונטיינר. Secure Cloud רץ במרכזי נתונים Tier 3/4 על חומרה ייעודית. ביקורת אחת טוענת ל־SOC 2 Type II מ־10/2025, ולא אומת בעמוד Trust של RunPod. מחיר RTX 4090: כ־0.34$ לשעה ב־Community לעומת כ־0.69$ ב־Secure — [aliteq review 2026](https://aliteq.com/runpod-review-2026); [dupple](https://dupple.com/reviews/runpod)

### Inferences
- כלל פשוט: מידע של משתמשים (סרטונים מה־Drive שלהם) לא נכנס ל־Community Cloud ולא ל־Vast "Verified". אפשר להשתמש ב־RunPod Secure / Vast Datacenter Partner, או לעבד במקום אחר. לניסויים בלי מידע אמיתי, Community זול ומקובל.
- גם ב־Secure Cloud כדאי למחוק את הקבצים מיד בסוף העבודה, ולא להשאיר מפתחות API בתוך תבנית ה־pod.

### Gaps
- לא נמצא עמוד Trust רשמי של RunPod או של Lambda בסבב הזה.

## (ב1) גישה לשרת, עדכונים אוטומטיים וחומת אש

### Takeaway
הבסיס המומלץ: אין SSH פתוח לאינטרנט בכלל. הגישה עוברת דרך Tailscale (או WireGuard), והתעבורה הציבורית עוברת דרך Cloudflare Tunnel או דרך 80/443 בלבד. בנוסף: התחברות במפתחות בלבד ובלי root, עדכוני אבטחה אוטומטיים (מופעלים כברירת מחדל ב־Ubuntu) ו־Livepatch בחינם, וחומת אש בשתי שכבות: של הספק ושל השרת.

### Cited Findings
- רשמי (Ubuntu): ב־Ubuntu Server עדכוני אבטחה מותקנים אוטומטית דרך `unattended-upgrades`, שמותקן כברירת מחדל. אפשר להגדיר שהשרת יופעל מחדש לבד כשעדכון דורש זאת. מאגר חבילות שהוספתם לא מתעדכן אוטומטית — [Ubuntu Server docs: Automatic updates](https://ubuntu.com/server/docs/how-to/software/automatic-updates/)
- משני (2022–2023): Ubuntu Pro חינם לשימוש אישי בעד 5 מכונות (חשבון Ubuntu One). Pro כולל Livepatch, כלומר תיקוני kernel בלי הפעלה מחדש, ו־10 שנות תמיכה גם ל־Universe. מפעילים עם `sudo pro enable livepatch` — [Hackster](https://hackster.io/news/canonical-launches-ubuntu-pro-with-10-years-updates-offers-individuals-five-free-machine-licenses-25348242f20b); [ostechnix](https://ostechnix.com/enable-ubuntu-pro-free/)
- משני: הדפוס המקובל הוא להעביר SSH ופאנלים אל ה־tailnet ולסגור את פורט 22 הציבורי. Tailscale יוצר רק חיבורים יוצאים, ולכן אינו צריך פורט פתוח. ב־Tailscale SSH, מדיניות ה־tailnet (ולא `sshd_config`) קובעת מי נכנס ובאיזה משתמש — [SSDNodes](https://www.ssdnodes.com/learn/lang/fr/tailscale-ssh-on-a-vps); [kbeezie](https://kbeezie.com/tailscale-ssh-cloud-firewall)
- משני: לפני סגירת 22 צריך לבדוק שהגישה דרך Tailscale עובדת ולהשאיר סשן פתוח. דרך מילוט: הקונסולה של הספק (VNC/serial), או פורט SSH מוגבל לכתובת הבית — [kbeezie](https://kbeezie.com/tailscale-ssh-cloud-firewall); [dev.to](https://dev.to/binsarjr/turn-your-vps-into-an-impenetrable-fortress-how-to-make-your-public-server-private-using-tailscale-and-ufw-3841)
- משני: גם עם Tailscale עדיין מגדירים מפתחות בלבד, בלי root ו־fail2ban. שינוי מספר הפורט מפחית רעש של בוטים אבל אינו גבול אבטחה — [reetlab](https://reetlab.substack.com/p/the-solo-devs-zero-trust-vps-stack)

### Inferences
- לבעלים לא טכני כדאי להעדיף את חומת האש של הספק (Hetzner/DO/Vultr Cloud Firewall): היא נוחה, נראית בממשק, ונאכפת לפני השרת. ufw בשרת הוא שכבה שנייה.
- פאנלים כמו Coolify/Dokploy, מסדי נתונים ו־Grafana לא נחשפים לאינטרנט בשום מקרה. הגישה אליהם רק דרך ה־tailnet.

### Gaps
- לא נקראו בסבב הזה CIS Benchmark ל־Ubuntu, ‏Mozilla OpenSSH Guidelines והתיעוד הרשמי של Tailscale ושל Cloudflare Tunnel. ההמלצות למעלה עקביות איתם לפי ידע כללי, אבל לא צוטטו כאן.
- CrowdSec מול fail2ban לא הושוו כאן.

## (ב2) Docker: מלכודת UFW, הקשחת קונטיינרים וסודות

### Takeaway
הבאג הנפוץ ביותר: Docker עוקף את ufw. פורט שמפורסם עם `-p 8080:80` פתוח לכל האינטרנט גם כש־ufw אומר deny. הפתרון: לפרסם פורטים רק על `127.0.0.1` או על כתובת ה־tailnet, לסמוך על חומת האש של הספק, ולבדוק מבחוץ עם nmap.

### Cited Findings
- משני: Docker מוסיף כלל DNAT ב־PREROUTING, ולכן החבילה עוברת דרך שרשרת FORWARD ולא מגיעה ל־INPUT, שבה נמצאים כללי ufw. התוצאה: `ufw deny 8080` מדווח הצלחה, והפורט עדיין עונה לכל העולם — [SSD Nodes](https://www.ssdnodes.com/learn/docker-ports-bypass-ufw); [virtua.cloud](https://www.virtua.cloud/learn/en/tutorials/docker-ufw-firewall-fix-vps)
- משני: הפתרונות: (1) לפרסם `127.0.0.1:8080:80` לשירותים שעומדים מאחורי reverse proxy; (2) כללים בשרשרת `DOCKER-USER`, שרצה לפני כללי Docker (הכלי ufw-docker עושה זאת אוטומטית); (3) חומת אש של הספק, שחוסמת לפני שהתעבורה מגיעה לשרת. ובכל מקרה לבדוק מבחוץ: פורט חסום מופיע כ־filtered ב־nmap — [virtua.cloud](https://www.virtua.cloud/learn/en/tutorials/docker-ufw-firewall-fix-vps)
- משני: `-p 5432:5432` מקשר את הפורט ל־0.0.0.0, ומסד נתונים נחשף בלי שמרגישים. עדיף לקשר לכתובת ה־tailnet — [computebox.de](https://computebox.de/tutorials/secure-server-with-tailscale)
- רלוונטי מ־Coolify: כמה מהפרצות נוצלו דרך docker-compose שמעגן (mount) את מערכת הקבצים של המארח, והתוצאה הייתה root מלא על השרת (CVE‑2025‑34159/59156). זו בדיוק הסיבה שאסור לחשוף docker.sock או `/` לקונטיינר — [The Hacker News 01/2026](https://thehackernews.com/2026/01/coolify-discloses-11-critical-flaws.html)

### Inferences
- כללי Docker לבסיס, לפי ידע כללי, לא צוטטו בסבב הזה, וכדאי לאמת מול Docker Docs ו־OWASP Docker Cheat Sheet: משתמש לא־root בקונטיינר (`user:`), ‏`read_only: true` עם tmpfs לכתיבה, ‏`cap_drop: [ALL]`, ‏`no-new-privileges`, לא למפות `/var/run/docker.sock`, תגית או digest קבועים לכל image, וסריקה עם Trivy ב־CI.
- סודות, לפי ידע כללי שלא צוטט כאן: לבעלים יחיד מספיק קובץ `.env` עם הרשאות 600 מחוץ ל־git, או SOPS+age אם רוצים לשמור סודות מוצפנים בריפו. Vault/Infisical מוגזמים לפרויקט כזה. מפתחות Anthropic/OpenRouter: מפתח נפרד לכל שירות, עם תקרת הוצאה בחשבון וסבב החלפה כשיש חשד. המערכת הקיימת (כספת AES‑256‑GCM ב־Vercel) כבר עומדת ברמה הזו.

### Gaps
- לא נקרא העמוד הרשמי של Docker על packet filtering, וגם לא התיעוד על rootless mode.
- לא אומתו כאן מנגנוני תקרת ההוצאה וההגבלה לכל מפתח של Anthropic Console ו־OpenRouter.

## (ב3) הגנה על מידע: הצפנת דיסק, מחיקה אחרי עיבוד, גיבויים ומעקב

### Takeaway
LUKS על VPS שכור אפשרי, אבל מחייב פתיחה ידנית אחרי כל הפעלה מחדש (או dropbear/clevis), ומגן בעיקר מגניבת דיסק ולא מהספק כשהשרת רץ. לבעלים לא טכני עדיף עיבוד חולף: להוריד מה־Drive, לעבד, להעלות תוצר ולמחוק מיד, ולשמור גיבויים חיצוניים בלתי ניתנים למחיקה (B2 Object Lock).

### Cited Findings
- משני: עם Volume מוצפן ב־LUKS ב־Hetzner, אחרי כל הפעלה מחדש צריך להיכנס ולפתוח את ההצפנה ידנית. משתמש בפורום מעיר שכאשר ה־Volume פתוח, תוכנה בצד הספק יכולה טכנית לגשת לנתונים — [stanislas.blog](https://stanislas.blog/2018/12/how-to-use-encrypted-block-storage-volumes-hetzner-cloud/); [Cloudron forum](https://forum.cloudron.io/topic/8352/how-to-install-cloudron-nextcloud-with-luks-full-disk-encryption-on-hetzner-cloud-server)
- רשמי (Backblaze): ב־Object Lock במצב **Compliance**, אף משתמש לא יכול להסיר את הנעילה, אפשר רק להאריך אותה. במצב **Governance** מי שיש לו הרשאה מתאימה יכול לעקוף. קובץ נעול (retention או legal hold) לא ניתן למחיקה. ברירת מחדל לכל bucket — [Backblaze Docs: Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock)
- משני: גיבוי רגיל בענן נמחק בידי כל מי שמחזיק את מפתח הגישה. לכן משתמשים במפתח מוגבל שלא יכול למחוק קבצים נעולים, ובודקים שניסיון מחיקה נכשל — [tech-insider](https://tech-insider.org/au/?p=1235)
- משני (פורום restic, גרסאות ישנות): restic עם Object Lock עובד, אבל `forget/prune` לא משחרר מקום עד שהנעילה פגה, ולפעמים צריך "לבטל הסתרה" של קבצים ידנית לפני שחזור. חובה לבדוק שחזור — [restic forum](https://forum.restic.net/t/backblaze-object-lock-ransomware-protection/6651); [restic forum 2](https://forum.restic.net/t/anyone-using-restic-with-b2-backblaze-and-object-locks/4277)
- לקח OVH (סעיף א2): גיבוי באותו מרכז נתונים = אין גיבוי — [cloudnews.tech](https://cloudnews.tech/ovhcloud-sentenced-to-pay-e250000-to-customers-for-data-loss-in-fire-at-their-data-center-in-strasbourg/)

### Inferences
- סרטונים ותמלילים של משתמשים **לא צריכים גיבוי בכלל**. מקור האמת הוא ה־Drive של המשתמש, ובשרת הם רק עוברים. מגבים רק קוד, תצורה וסודות מוצפנים, וזה מקטין מאוד את הסיכון.
- מחיקה אחרי עיבוד: תיקיית עבודה זמנית לכל משימה, שנמחקת ב־`finally`, וניקוי מתוזמן של שאריות מעל X שעות. אפשר גם tmpfs לקבצים קטנים.
- 3‑2‑1 מעשי: (1) השרת; (2) צילום (snapshot) של הספק לתיקון מהיר; (3) restic ל־B2 עם Object Lock באזור אחר. בדיקת שחזור פעם ברבעון, שאפשר לתת לסוכן ה־AI לבצע.
- מעקב, לפי ידע כללי שלא צוטט כאן: מוניטור זמינות חיצוני חינמי (UptimeRobot / Healthchecks.io ל־cron של הגיבוי) עם התראה למייל ולטלפון; CrowdSec או fail2ban; ‏auditd/Wazuh כבדים מדי לבעלים יחיד.

### Gaps
- לא נמצא מקור ל־Wasabi Object Lock, ל־CrowdSec/Wazuh, ולמדיניות שמירת לוגים מומלצת (NIST SP 800‑92 לא נקרא).

## (ב4) פאנלים לניהול עצמי (Coolify / Dokploy / CapRover): היסטוריית פרצות

### Takeaway
ל־Coolify ול־Dokploy היו ב־2025–2026 עשרות פרצות קריטיות (CVSS 9–10), רובן הזרקת פקודות שנותנת root על השרת. ב־01/2026 נמנו כ־53 אלף התקנות Coolify חשופות לאינטרנט. אם משתמשים בפאנל: הוא תמיד מאחורי VPN ומעודכן תמיד, ורק לבעלים יש משתמש בו.

### Cited Findings
- **Coolify, ‏01/2026 (The Hacker News, 08/01/2026)**: נחשפו 11 פרצות קריטיות. CVE‑2025‑66209/66210/66211/66212/66213 (CVSS 10.0) הן הזרקת פקודות בגיבוי DB, ביבוא DB, בסקריפט init של PostgreSQL, בתצורת ה־proxy ובמיפוי תיקיות, ומאפשרות פקודות כ־root. התיקון: 4.0.0‑beta.451. ‏CVE‑2025‑64420 (10.0): משתמש עם הרשאות נמוכות יכול לקרוא את מפתח ה־SSH הפרטי של root. ‏CVE‑2025‑64424 (9.4): הזרקה דרך שדה git. סטטוס התיקון של שתי האחרונות "לא ברור" בכתבה. Censys מנה כ־52,890 מארחי Coolify חשופים (גרמניה 15K, ארה"ב 9.8K). לא דווח על ניצול בפועל — [The Hacker News](https://thehackernews.com/2026/01/coolify-discloses-11-critical-flaws.html); [heise](https://heise.de/-11134651)
- **Coolify, ‏2025**: ‏CVE‑2025‑59156/59157 (9.4/10.0, הזרקה דרך Compose/Git, תוקנו ב־beta.420.7). ‏CVE‑2025‑34159: הזרקת הוראות Compose שמעגנות את `/` של המארח, ומשם root מלא. ‏CVE‑2025‑22611/22612 (01/2025, ‏10.0): גילוי מפתחות פרטיים בתהליך ההתקנה הראשוני (onboarding) עד הרצת פקודות. יש פערי ציון בין מאגרים (CVE‑2025‑59156: ‏9.4 מול 8.8) — [The Hacker News](https://thehackernews.com/2026/01/coolify-discloses-11-critical-flaws.html); [securitricks CVE-2025-34159](https://securitricks.com/cve/CVE-2025-34159); [cve.imfht](https://cve.imfht.com/product/coolify?lang=en)
- **Dokploy**: ‏CVE‑2025‑53825 (CVSS 9.4, **בלי הזדהות**): כל מי שפותח Pull Request בריפו ציבורי עם Preview Deployments יכול להריץ קוד ולקרוא משתני סביבה. תוקן ב־0.24.3 — [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-53825). ‏CVE‑2025‑53376: הזרקת פקודות על ידי משתמש עם הרשאות נמוכות, תוקן ב־0.23.7 — [SentinelOne](https://www.sentinelone.com/vulnerability-database/cve-2025-53376/). ב־2026 (מאגר משני): הזרקה בטרמינל ה־WebSocket, סיסמת DB קבועה בקוד בסקריפט ההתקנה ו־clickjacking, תוקנו ב־0.26.6. בנוסף CVE‑2026‑45628 (9.6, הזרקה בשם ענף), גרסת התיקון לא אומתה — [cvelogic](https://www.cvelogic.com/vendor/dokploy); [cve.imfht](https://cve.imfht.com/intel/631106?lang=en)
- **CapRover**: לא נמצאו CVE בחיפוש.

### Inferences
- פאנל כזה נותן נוחות, אבל הוא גם התוכנה הפגיעה ביותר על השרת, והוא מחזיק מפתח root. לבעלים לא טכני שהקוד שלו נכתב בידי AI, עדיף Docker Compose פשוט + Caddy + סוכן AI שמנהל דרך SSH על ה־tailnet. אם בכל זאת רוצים פאנל: גישה רק דרך Tailscale, 2FA, משתמש יחיד, עדכון אוטומטי או שבועי, בלי Preview Deployments מריפו ציבורי, ומעקב אחרי GitHub Security Advisories של הפרויקט.
- מספר הפרצות הגבוה ב־Coolify משקף גם תשומת לב של חוקרי אבטחה ואת הסטטוס של "beta" לאורך זמן, ולא רק איכות קוד. זה עדיין סימן אזהרה.

### Gaps
- לא נבדק ישירות דף GitHub Security Advisories של Coolify/CapRover, ולא נבדק אם תוקנו CVE‑2025‑64420/64424.

## (ב5) סוכן LLM עם כלים על השרת: Prompt Injection בתוכן לא אמין (תמלילים)

### Takeaway
לפי OWASP Top 10 for LLM Apps 2025, הסיכון מספר 1 הוא Prompt Injection, ומספר 6 הוא Excessive Agency. סוכן שקורא תמליל של משתמש ויש לו shell, רשת ומפתחות יכול להיות מופעל על ידי טקסט בתוך הסרטון. ההגנה היא ארכיטקטונית ולא "הנחיות למודל": כלים מינימליים, הרשאות מינימליות, סודות מחוץ להישג יד, ואישור אנושי לפעולות מסוכנות.

### Cited Findings
- רשמי (OWASP, 2025): הרשימה: LLM01 Prompt Injection, ‏LLM02 Sensitive Information Disclosure, ‏LLM03 Supply Chain, ‏LLM04 Data and Model Poisoning, ‏LLM05 Improper Output Handling, ‏LLM06 Excessive Agency, ‏LLM07 System Prompt Leakage, ‏LLM08 Vector and Embedding Weaknesses, ‏LLM09 Misinformation, ‏LLM10 Unbounded Consumption — [OWASP GenAI Top 10](https://genai.owasp.org/llm-top-10/)
- רשמי (OWASP LLM06): ל־Excessive Agency יש שלושה שורשים: יותר מדי פונקציונליות, יותר מדי הרשאות, יותר מדי אוטונומיה. ההמלצות: מינימום כלים; כלי צר במקום כלי פתוח (shell, ‏URL-fetch); הרשאות מינימליות (למשל קריאה בלבד); פעולה בזהות המשתמש ולא בחשבון משותף בעל הרשאות; אישור אנושי לפעולות בעלות השפעה גבוהה; אכיפת הרשאות במערכת היעד ולא אצל המודל; לוגים, ניטור והגבלת קצב — [OWASP LLM06:2025](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)

### Inferences
- תרגום מעשי לפרויקט: (1) העובד שמעבד תמלילים רץ בקונטיינר או ב־VM נפרד, בלי `docker.sock` ובלי מפתח SSH לשרת; (2) רשת יוצאת רק לרשימת דומיינים מאושרת: ה־API של המודל, Drive ושרת הניהול; (3) בלי גישה לסודות של פרויקטים אחרים; מפתח API נפרד עם תקרת הוצאה, כנגד LLM10 Unbounded Consumption; (4) גישה ל־Drive בהרשאה `drive.file` בלבד, כמו שכבר נעשה ב־v357 עם לקוח OAuth נפרד לסטודיו; (5) הפלט מטופל כטקסט בלבד ולא כ־HTML או כפקודות (LLM05). הפרויקט כבר מיישם חלק מזה: deny ל־`git push` ול־MCP בסביבת העובד, ומפתח עבודה קצר מועד.
- "סוכן AI שמנהל את השרת" (Claude Code עם SSH) ו"סוכן שמעבד תוכן משתמשים" חייבים להיות שתי זהויות נפרדות עם הרשאות נפרדות.

### Gaps
- עמוד LLM01 (Prompt Injection) המלא לא נקרא. ההמלצות שלו (הפרדת תוכן חיצוני, סינון, least privilege, human-in-the-loop) מבוססות כאן על ידע כללי.

## (ב6) רשימת בסיס מציאותית ומה אפשר לאטמט (מאמץ חודשי קרוב לאפס)

### Takeaway
אפשר להגיע לרמת אבטחה טובה עם כ־12 צעדים חד־פעמיים. כמעט כל התחזוקה השוטפת אוטומטית: עדכונים, Livepatch, גיבויים נעולים והתראות. נשאר לבעלים: לאשר התראה כשמגיעה, ובדיקת שחזור רבעונית שהסוכן מבצע ומדווח עליה.

### Cited Findings
- עדכוני אבטחה אוטומטיים כברירת מחדל ב־Ubuntu, כולל אפשרות להפעלה מחדש אוטומטית — [Ubuntu docs](https://ubuntu.com/server/docs/how-to/software/automatic-updates/); ‏Livepatch חינם בעד 5 מכונות — [Hackster](https://hackster.io/news/canonical-launches-ubuntu-pro-with-10-years-updates-offers-individuals-five-free-machine-licenses-25348242f20b)
- סגירת SSH ציבורי עם Tailscale, ודרך מילוט דרך הקונסולה של הספק — [kbeezie](https://kbeezie.com/tailscale-ssh-cloud-firewall)
- Docker עוקף ufw, ולכן חומת אש של הספק + פרסום פורטים על 127.0.0.1 + בדיקת nmap מבחוץ — [virtua.cloud](https://www.virtua.cloud/learn/en/tutorials/docker-ufw-firewall-fix-vps)
- גיבוי Compliance-mode ב־B2 — [Backblaze](https://www.backblaze.com/docs/cloud-storage-object-lock)
- OWASP LLM06: כלים והרשאות מינימליים — [OWASP](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)

### Inferences
רשימת הבסיס המוצעת (חד־פעמית; מסומן אם זה אוטומטי אחר כך):
1. חשבון הספק: 2FA, ומפתח חומרה אם יש. מייל ייעודי לחשבון. API token רק אם צריך, ובהרשאה מוגבלת.
2. Ubuntu LTS נקי; ‏Ubuntu Pro חינם + Livepatch; ‏unattended-upgrades עם הפעלה מחדש אוטומטית בשעת לילה **(אוטומטי)**.
3. חומת אש של הספק: נכנס רק 80/443 (או כלום עם Cloudflare Tunnel), ופורט 41641/UDP של Tailscale אופציונלי. ‏ufw כ־default-deny כשכבה שנייה.
4. SSH: מפתחות בלבד, ‏`PermitRootLogin no`, משתמש לא־root עם sudo, והגישה רק דרך Tailscale. דרך מילוט: הקונסולה של הספק.
5. Docker: פורטים רק על 127.0.0.1 או tailnet, ‏Caddy כ־reverse proxy עם TLS אוטומטי, קונטיינרים כמשתמש לא־root, בלי docker.sock, ותגיות image קבועות.
6. סודות: `.env` בהרשאה 600 מחוץ ל־git, מפתח API נפרד לכל שירות עם תקרת הוצאה, ותיעוד איך מחליפים מפתח.
7. עיבוד סרטונים: תיקייה זמנית לכל משימה ומחיקה בסוף, cron שמנקה שאריות, ושום דבר לא נכנס לגיבוי **(אוטומטי)**.
8. העובד/סוכן ה־LLM: קונטיינר נפרד, בלי shell למארח, רשת יוצאת מוגבלת, והרשאות Drive מינימליות.
9. גיבוי: restic ל־B2 Object Lock (Compliance, ‏30 יום) עם מפתח שלא מוחק **(אוטומטי, יומי)** + צילום שבועי של הספק.
10. התראות: מוניטור זמינות חיצוני + Healthchecks לגיבוי + CrowdSec/fail2ban **(אוטומטי)**, הכל למייל ולטלפון.
11. פאנל ניהול (אם בכלל): רק דרך Tailscale, ‏2FA, משתמש יחיד, עדכון שבועי, ומעקב אחרי Advisories.
12. בדיקת שחזור ובדיקת nmap מבחוץ פעם ברבעון: הסוכן מריץ ומדווח, והבעלים מאשר.

### Gaps
- הצעדים 1–12 מבוססים על המקורות שצוטטו ועל ידע כללי. CIS Ubuntu Benchmark, ‏NIST SP 800‑123 (אבטחת שרתים) והנחיות SSH של Mozilla לא נקראו בסבב הזה, וכדאי להפנות אליהם בדוח כמקורות סמכותיים.
