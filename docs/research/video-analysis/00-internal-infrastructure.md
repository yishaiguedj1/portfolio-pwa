# ניתוח סרטונים — 00: התשתית הפנימית שכבר קיימת

> 9/11/2026 · סקירה פנימית בלבד: הקוד ו־`docs/`, בלי מחקר רשת.
> המטרה: לתכנן לשונית "ניתוח סרטונים" ב־Studio — ניתוח הרצאות, וובינרים וקורסים: תמלול + שקפים + טקסט מהמסך, וכל נקודה בניתוח = לחיצה לזמן בסרטון.
> ההפניות `קובץ:שורה` — לפי main של היום (שורות זזות: לחפש לפי השם). בלי נתוני משתמש.

## תקציר — מה יש ומה חסר
| תחום | קיים | חסר לניתוח סרטונים |
|---|---|---|
| קול ← טקסט | Parakeet לאנגלית, יישור מילים, זיהוי דוברים, `timeline.json` עם זמן לכל מילה | תמלול עברי רק בשרשרת הקריוקי; `LANG_READY.from=['auto','en']` |
| מסך ← טקסט | חילופי שוטים (`scdet`), 2 פריימים לשנייה לצריבה, PP-OCRv3 לאיתור תיבות בפסים | חילוץ שקפים, OCR שקורא טקסט (ובעברית), שמירת תמונות כתוצר |
| מודל שפה | Claude ישירות, מטמון, Batches, דף "רעיונות" (פרקים, קטעים, שאלות) | שליחת תמונה (`llm.py` שולח טקסט בלבד), Gemini בעובד |
| ממשק | חוגה עם 4 לשוניות, תבנית הקריוקי, נגן עם `seek` ופרקים, "שלח ל־Academy" | זמן בניתוב ובקישור העמוק; `canPlay` בלי כתוביות; תמונות מ־R2 נחסמות ב־CSP |
| אחסון | R2 פרטי, תוצרים נשמרים 30 יום | המקור ואיכויות הצפייה נמחקים אחרי יום, ואז אין סרטון לקפוץ אליו |

---

## A. ממשק Studio בטלפון

### A1. מבנה
- **הכניסה**: `studio.html` + `studio-app.js` (`appBoot` מ־`shell.js`) ← `openStudio` (studio.js:10396).
- **המודולים** (studio.js:11-20): `studionet` (כל הרשת, `createNet(env)`; ‏studio.js עצמו לא פונה לרשת) · `studioplay` (נגן) · `studiosubs` (עורך, ציר, קבצים) · `studioedl` (חיתוך) · `studioai` ("רעיונות") · `studiostore` · `studiobg` (Background Fetch).
- **המצב המקומי**: `pwa_studio_v1` ו־IndexedDB ‏`snb-studio`; הפרקים (`rec.chap`) רק בטלפון (studio-app.md:6-9).
- **השפות**: `LANG_READY={from:['auto','en'],to:['he']}` (studio.js:55 = ibkr-proxy/lib/studio.js:50). שפה אחרת ← העובד מחזיר `lang_unsupported` (job.py:385).

### A2. לשונית ראשית חדשה — כל נקודות המגע
| מה | איפה (studio.js) |
|---|---|
| סדר הלשוניות (מימין לשמאל) | `ST_SIB=['ka','home','job','tower']` ‏:2396 |
| דפים בלי החלקה | `ST_NOSWIPE` ‏:2397 |
| אילו לשוניות מוצגות (שער הרשאה) | `stDialKeys` ‏:2405 (‏`ka` רק כש־`kaOk()`), ‏`stDialJob` ‏:2401 |
| לאיזו לשונית שייך דף | `stKeyOf` ‏:2406 |
| החלקה בין הלשוניות (קובייה) | `stSibTarget`…`stSwipePage` ‏:2413-2445 |
| אייקון ותווית | `ST_DIAL_ICO` ‏:2457, ‏`stDialNav` ‏:2465 (‏`dialNavBuild('st-dial', …, stDialTo)`), ‏`STUDIO_DIAL` ‏:2474 |
| "חזור" | `chainFor` ‏:2300 (מפת ההורים; טפסים חוזרים ל־`new`, ול־`'ka'` כש־`form.ka`), ‏`leaving` ‏:2309, ‏`go` ‏:2317, ‏`replaceView` ‏:2331, ‏`back` ‏:2340 |
| ציור | `render(kind,still,pre)` ‏:10142 — שרשרת לפי `ui.view`; ב־`home`/`ka` מתאפס `form` |
| טופס | `freshForm` ‏:1277, ‏`pageForm` ‏:3441 (הענף `f.ka`) |
| מחרוזות | `STRINGS.he`/`STRINGS.en` ב־app.js (סביב 1247/3058) ← `node tools/coregen.js` ← `strings-studio.js`; הבדיקה `i18n-coverage` |
| מודול חדש | `APPS.studio` ב־tools/coregen.js (סביב 19) + `STUDIO_SHELL` ב־sw.js:159 (רק דרך `node tools/swgen.js`) |

"חזור" עם CloseWatcher: רשומת היסטוריה אחת `{studio:1,sv,sp}` ומחסנית בזיכרון; בלעדיו `cleanState` לכל דף (studio-app.md:9).

### A3. תבנית הקריוקי — הלשונית האחרונה שנוספה (30/10)
- **הדף**: `pageKa(p){pageHome(p,true)}` (3255) — אותו בית עם דגל. ב־`pageHome(p,kaTab)` (3268) כרטיס "חדש" מסמן `form.ka=true`; הרשימה `store.jobs.filter((rec)=>!rec.spec.ka===!kaTab)` — סינון בינארי, ולשונית שלישית מחייבת סינון לפי סוג.
- **השער**: `kaOk` (3639) = ‏`servers>0 && r2 && (api.admin||api.ka)` — ההרשאה מגיעה מהשרתון (`normApi` ‏:123).
- **אין סוג עבודה חדש**: `tr` עם `spec.ka=1`. העובד מנתב ב־`auto` (job.py:4528): ‏rr←render, ‏ai←ai_auto, ‏dx←`dx_auto` (4771), ‏ka←`karaoke` (5002), השאר ← pipeline. השלבים באותם מפתחות, עם `KA_STG` (studionet.js:150 = kaPlan ב־studioeta.js).
- **המחיר**: כ־11 מקרים מיוחדים בשרתון (api/studio.js ‏7, ‏lib/studio.js ‏2, ‏studioeta ‏1, ‏usermon ‏1); לשונית חדשה תצטרך מקבילה לכל אחד. תיעוד: studio-app.md:104-108.

### A4. דף העבודה, "רעיונות" ו"שלח ל־Academy" — הבסיס הקרוב ביותר
- **דף העבודה** `pageJob` (9115), פעולות של עבודה גמורה (9196-9216): צפייה `go('play',id)` (9203/9206) · עורך `go('subs')` (9208) · רעיונות `go('ideas')` (9210) · Drive ‏(`dxRow`) · Academy (9213, רק כשיש `srt`) · קבלה.
- **"רעיונות" — ניתוח טקסט של התמליל שכבר עובד**: `pageIdeas` (8969). ב־studioai.js:
  - `TEXT_KINDS=['chap','yt','hl','ask']` (11); ‏`AI_TASKS` (19-29) — למשל `chap` = 4–10 פרקים בשורות `MM:SS כותרת`.
  - `HEAD_T` (30): התמליל בתוך `<transcript>` = נתונים בלבד. ‏`aiTRow` (35): ‏`{id, t, he}`, ‏`t` בשניות שלמות. ‏`AI_T_ROWS 3000` (60).
  - `parseChapters` (117, עד 30), ‏`parseRanges` (128, ‏5–180 שנ׳, עד 5).
  - התוצאה: פרקים ← `rec.chap` ← `pl.ctl.setChapters` ומעבר לנגן (8991); קטעים ← `rrEdl` ‏9:16.
- **ההרצה = עבודת `ai`**: `aiJobRun` (8841) מעלה `request.json` ← `ai_prep` (job.py:4681, הפרומפט ב־`aisheet.py`, זהה לטלפון) ← `ai_auto` (4738, קריאה אחת, `max_tokens=64000`) ← `ai_done` (4712) מעלה `aiout` (studio-app.md:28-29).
- **"שלח ל־Academy"**: `sendToAcademy` (9799) עם `AC_INBOX={op:'inbox',path:'/api/library'}` (9798). ‏`toLectureMd(cues, rec.chap, name)` (studiosubs.js:33) בונה Markdown: `##` לכל פרק, פסקה אחרי שתיקה של 2.5 שנ׳ או אחרי כ־90 שנ׳ בסוף משפט — **בלי זמנים**. נכתב ל־R2 ‏`inbox/<uid>/…` (ibkr-proxy/lib/libweb.js:93-112). לכן מ־Academy אין היום דרך חזרה לרגע בסרטון.

### A5. הנגן ו"לחיצה לזמן"
- **יש**: `createPlayer(opts)` (studioplay.js:518) מחזיר `{el, video, seek, play, pause, setCues, setChapters, destroy}` ועוד `setPoster` (514-515); ‏`normChapters` — מפרידים בפס ושם הפרק בכמוסה (ת־נגן: standards.md:62-70).
- **התבנית של "לחיצה לזמן" כבר קיימת**: ברשימת הבעיות ב־`pagePlay` (8173) — ‏`pl.ctl.seek(Math.max(0,x.t-0.3)); pl.ctl.play()` (8196); בעורך `seek(t-0.05)` (8246) ו־`se.ctl.seek(at)` (8352).
- **חסר**:
  1. `go('play', id)` בלי זמן; הקישור העמוק (studio-app.js:40) `[#&]studio=(j…{20})(?:&v=(play|subs))?` — בלי `t`.
  2. `canPlay` (8071) דורש תוצר `cues`/`srt` **וגם** וידאו (`srcVid`/`burnedOut`/`phLocal`).
  3. `playLoad` (8108) ו־`playClose` (8073) בנויים סביב כתוביות.
- **המדיה**: hls.js + איכויות מ־translator/ladder.py; הכל דרך `./studio-media/<id>` (sw.js:255-300) — פרוקסי טווחים שמקבל מהדף קישור חתום ב־MessageChannel, רק `video|audio`.

### A6. העורך וציר הזמן — זמן לכל מילה כבר קיים
- `createSubsEditor`/`createTimeline` (studiosubs.js); ‏`seLoad` (סביב 8230) טוען cues, ‏notes ו־meta.
- התוצר `meta` = ‏`timeline.json` (translator/peaks.py:1-20, נבנה ב־finish, job.py:5174): `{v, r:20, pk: base64 של עוצמה, sh:[זמני חילופי שוטים], wd:[[התחלה, סוף, מילה, ביטחון]]}`; ‏`SH_MAX 5000`, ‏`WD_MAX 60000`, עד 4 שעות; זהה ל־`normMeta` (studiosubs.js).
- **לניתוח**: `sh` = מועמדים לחילופי שקף; `wd` = עוגן לזמן מדויק לכל ציטוט. תיעוד: studio-app.md:25, 124-131.

### A7. סטטוס, דגלים והרשאות
- **סטטוס מהשרתון** (studio.js:1395-1415): ‏`ui.api` (`normApi` ‏:123), ‏`r2`, ‏`url`, ‏`yc`, ‏`halt` ועוד.
- **דגלים**: דגלי מערכת ב־ibkr-proxy/lib/sysflags.js:14-25 (st_api, ‏st_url, ‏st_auto, ‏learn…); דגל חדש = שורה ב־`FLAGS` + אכיפה + מחרוזות. דגלי ניסוי `XF_KEYS` (lib/studio.js:1018 = xflags.py = admin-app.js).
- **הרשאות**: `allowed` (api/studio.js:97) = ‏`isAdmin || STUDIO_USERS`; השער 2890-2894; ‏120 בקשות בדקה; מצבים ציבוריים `PUBLIC_MODES=['haiku-medium','haiku-high']` (lib/studio.js:39) + `modeLocked`.

---

## B. קליטת סרטונים

### B1. הורדה בעובד — translator/fetchurl.py
- **גרסאות**: yt-dlp 2026.10.21 עם yt-dlp-ejs, ‏curl-cffi ו־bgutil-ytdlp-pot-provider (infra/worker/requirements.lock:2558-2567); ‏Deno 2.6.4 (infra/worker/Dockerfile:37-57).
- **לפני ההורדה**: `summarize` (233) — שם, אורך, ערוץ, שפה, **פרקי היוצר `ch` (עד 30)**, כתוביות, איכויות, תמונה. ‏`subs_list` (213): של היוצר בכל השפות, אוטומטיות רק בשפת המקור. ‏`get_subs` (541): מוריד רק של היוצר, עברית ואנגלית.
- **הפורמט**: `HEIGHTS` 2160…360, ‏`DEFAULT_H 1080` (28-29); ‏`selector` (335), ‏`audio_selector` (350), ‏`ERR_RULES` (358), ‏`ytdlp_base` (379).
- **ההורדה** `download` (572): קול ב־`-x`; וידאו MKV בלי קידוד מחדש; ‏`--max-filesize 40G`, ‏`--download-sections`, תקרה 6 שעות.
- **בעובד**: `url_get` (job.py:2620), ‏`url_fetch` (2646) — הקול קודם, הסרטון ב־thread ברקע; שלב שמנתח מסך יחכה לסרטון. ‏`check_url` (fetchurl.py:68) נגד SSRF.

### B2. יוטיוב בשרת
- **העוגיות** של חשבון ייעודי: `adminYt` ← ‏ibkr-proxy/lib/ytck.js ← ‏`studioVault/_ytck` (מוצפן) ← ‏`yt_sync` (agent.py:1311, כל 5 דקות) ← ‏`/cache/yt/ck.txt`. שתי חסימות ברצף מכבות את `yc`. מחוות שרתים לא אמין; פרוקסי ביתי עולה כסף (studio-server.md:29).
- **בלי `yc`**: `cloudBlocked` (studio.js:4362) — יוטיוב לא נשלח לענן. החלופה: Studio לאנדרואיד — youtubedl-android 0.18.1, ‏`DlActivity`/`DlService` ← `/share-file` ← `#got`; ‏`DlProbe.kt` = ‏`fetchurl.summarize` (android-apps.md:8, 10).
- **בדיקת קישור**: `pageLink` (4613), ‏`linkCheckSrv` (4441) ← ‏`urlProbe` ← ‏`studioProbe` ← ‏`probe_loop` (agent.py:1292, ‏op ‏`pq`); ‏`startLinkCloud` (4927) ← ‏`spec.src='url'`.

### B3. העלאה, Drive, שיתוף ומגבלות
- **R2 בחלקים**: `r2up`/`r2parts`/`r2done`/`r2url`, ‏`R2_CONC=4`; ‏Background Fetch (studiobg.js, דרך `/up` = functions/up.js); הקול קודם; Studio לאנדרואיד מעלה ב־UIDT (studio-app.md:78-94, 110-114). בחירה: `nuPick` (5055), ‏`studioGot` (4975).
- **Drive**: ‏`drive.file` (`studioDrive`) ו־`drive.readonly` (`studioBrowse`, רק לשרת שלנו); ‏`pageDrivePick` (4561) (studio-app.md:17, 33, 36).
- **שיתוף**: קישורים עמוקים ב־studio-app.js:40-56 (`#studio=`, ‏`#share=`, ‏`#got` ועוד); מ־Studio DM (`AppRoute.fileToStudio`) ומהבועה (`ACTION_SEND`).
- **מגבלות**: `MAX_SIZE` 64GB (lib/studio.js:59) · אורך עד 24 שעות · `OUT_MAX` 12 · `MAX_STORED` 100 · 6 שעות בלי שרת ← `no_server` · `BW_MAX` 36 שעות (Batches).

---

## C. העובד והשרת

### C1. מבנה
- job.py (5,951 שורות), ‏pipeline.py (2,598), ‏agent.py (1,693), ‏llm.py (825); ‏`translator/vt/`: ‏cli, ‏asr_*, ‏align*, ‏burnin, ‏diarize, ‏lang, ‏media, ‏render ועוד.
- פקודות vt (vt/cli.py, סביב 775-860): ‏ingest, ‏asr, ‏lang, ‏align, ‏shots, ‏plan, ‏build, ‏render, ‏speakers ועוד. ‏`--engine` (cli.py:799): ‏parakeet ברירת מחדל; מנועי ענן קיימים בקוד, בלי מפתחות בעובד.

### C2. סוגי עבודה וניתוב
- `KINDS`/`WORKER_KINDS` = ‏['ping','tr','rr','ai','dx'] (lib/studio.js:31, 33) = ‏`AUTO_KINDS` (agent.py:778). הניתוב — A3.
- תרגום: pipeline.py:1-17 — ‏prepare←proofread←align←translate←review←finish; ‏`STAGES` = ‏up/tr/al/tl/rv/bn/sv.
- **סוג עבודה חדש מחייב**: `KINDS`, ‏`WORKER_KINDS`, ‏`AUTO_KINDS`; ‏`MEM_PRIOR` (agent.py:843, ‏[MB קבוע, MB לדקת סרטון]: ‏tr ‏(4600,22), ‏rr ‏(2200,6), ‏ai ‏(700,0), ‏dx ‏(400,0)); תוכנית שלבים ב־studioeta; וכל מקום שבודק `kind`.

### C3. קול
- **אנגלית**: Parakeet ‏`nemo-parakeet-tdt-0.6b-v2` דרך onnx-asr 0.12.0, ‏int8; חיתוך ב־Silero VAD לקטעים עד 40 שנ׳ (vt/asr_parakeet.py:1-19).
- **עברית — רק בשרשרת הקריוקי** (vt/align_he.py:1-40; Dockerfile:148-174): ‏ivrit-ai/whisper-large-v3-turbo-ct2 + stable-ts 2.19.1 + CTC של imvladikon/wav2vec2-large-xlsr-53-hebrew. נמדד: 32 שנ׳ לשיר של 3:27 על 4 ליבות. הרצאה עברית של שעה — לא נמדדה.
- **זיהוי שפה**: faster-whisper-small (vt/lang.py).
- **יישור**: Qwen/Qwen3-ForcedAligner-0.6B ב־ONNX INT8 (translator/aligner_export.py:23-24), ‏MMS_FA (רישיון NC — פער ידוע), וחציון של שלושה מקורות.
- **דוברים**: WeSpeaker ResNet34-LM (vt/diarize.py) — שימושי ל"מי אמר" בפאנל או בוובינר.

### C4. מסך — מה יש ומה אין
- **יש**:
  - `detect_shots` (vt/media.py:137): ‏scdet בסף 10 ברוחב 320 ← shots.json ← `sh` ב־timeline.json.
  - `_shots_and_burn` (160): באותו מעבר פענוח גם 2 פריימים לשנייה ברוחב 640 ל־burnin. ‏`frame_png` (213) לפריים בודד; התוצר `thumb` (job.py:4813).
  - vt/burnin.py:22-46: ‏PP-OCRv3 ‏det+rec דרך rapidocr 1.2.3, רק פס עליון ותחתון, שומר **תיבות בלבד** (לא טקסט), לא קורא עברית; 30–36ms לפריים.
  - translator/frame.py: זיהוי פנים (YuNet).
- **אין**: זיהוי שקף יציב וסינון כפילויות · OCR של כל המסך וטקסט עברי מהמסך · שמירת פריימים כתוצר · קריאה למודל עם תמונה (D1).
- **נקודת החיבור הטבעית**: `_shots_and_burn` כבר מפענח את כל הסרטון — אפשר לדגום בו גם פריימים לשקפים בלי מעבר פענוח נוסף.

### C5. התמונה והקונטיינר
- **התמונה**: infra/worker/Dockerfile רב־שלבי (aligner, ‏speaker, ‏linebreak, ‏separator, ‏karaokehe, ‏lid, ‏burnin), משתמש uid 10001, ‏ffmpeg BtbN n8.1 מאומת. מודל חדש = שלב חדש; שינוי בשכבות הבסיס = תמונה מלאה של כ־4.3GB (studio-server.md:14).
- **הבנייה** (.github/workflows/worker-image.yml): ‏amd64+arm64 וחתימה; הקידום לייצור באישור — רק הריצה האחרונה.
- **הקונטיינר** (infra/compose.yaml:24-60): ‏gVisor, ‏read_only, ‏tmpfs ‏`/tmp` 2g; ‏volumes ‏`/work`, ‏`/cache`; המגבלות מ־`snb_limits`. קבצים גדולים רק תחת `VT_WORK` (studio-server.md:20).
- **הסודות**: `/etc/snb/worker.env` (infra/host/snb-setup:40-44) — רק `ANTHROPIC_API_KEY`, ‏`SNB_WORKER_TOKEN`, ‏`SNB_HEARTBEAT_URL`. **אין מפתח Gemini ואין מפתחות R2** (קישורים חתומים).

### C6. קיבולת וזמנים
- **השרת**: CX53 — ‏16 ליבות, 32GB (תוכנית-שיפור-מתמיד.md:229); מכסת החשבון ב־Hetzner ‏20 vCPU. ‏`snb_limits` (infra/host/snb-common.sh:20-48): לייצור תקרת זיכרון 23.2GB (לניסוי שמור 4.5GB); מעבד — כל הליבות לכל עובד, עם משקלים. ‏`SNB_DISK_MIN_GB` 8; גודל הדיסק לא מתועד.
- **משבצות**: `SLOTS_MAX 4` (agent.py:839), לפחות 4 ליבות לעבודה (`slots_max` ‏856), ‏`mem_fit` (1034), ‏`perf_dmax` (1076); כל עבודה בתהליך משלה. בשרתון: `perfBlock`/`peakNeed` (ibkr-proxy/lib/studio.js:1633, 1639).
- **זמנים** (perf.py:18-39): ‏`SLOW_MAX 1.35`; דקות עבודה לדקת סרטון — תמלול 0.05, יישור 0.108 (במקביל לתרגום 1+0.18d), צריבה 0.14.
- **נמדד**: פרק של 22 דק׳ — ‏ASR כ־155 שנ׳, יישור כ־275, צריבה כ־250, סך הכל כ־1,070 שנ׳, ‏$0.084–0.112 (studio-learning.md:31-33). זמן סיום לבד (מודל): סרטון 5 דק׳ ← 13 דק׳, ‏60 ← 39, ‏120 ← 68; בסרטון ארוך התרגום קובע — בניתוח בלי תרגום הנתיב הקריטי ישתנה. נקודות הזהב: 3 במקביל לסרטונים עד כ־16 דק׳, 4 עד כ־9; מעל כ־5 עבודות בשעה השרת הוא הגבול (studio-parallel-plan.md:12-55, 80).
- **מדידה**: `note_timing` (job.py:2079) ← ‏`snb-timing.json`; בדיווח `prog.stg`. שלב ניתוח מסך צריך מקום ב־perf.py ובתוכנית השלבים, אחרת הקבלה החזויה תטעה.

### C7. תוצרים
- `put_output` (job.py:1917) — נקודה אחת לכל כתיבה: R2 כשהתיקייה `R2_…`, אחרת Drive; ‏`put_output_retry` (1935). ‏`AUX_FILES` (5126-5132): ‏cues, ‏vtt, ‏ass, ‏en, ‏meta.
- `OUT_KINDS` (lib/studio.js:55) — רשימה סגורה של 17: ‏compact, ‏same, ‏mkv, ‏srt, ‏cues, ‏vtt, ‏ass, ‏en, ‏small, ‏aiout, ‏meta, ‏thumb, ‏inst, ‏lrc, ‏elrc, ‏lyr, ‏notes. ‏`OUT_MAX 12` (56).
- `normOut` (322) דוחה סוג לא מוכר **וגם סוג כפול** — לכן שקפים רבים = קובץ אחד (ארכיון או גיליון), לא קובץ לכל שקף.

### C8. מאגר הלמידה
`learn_put` (job.py:1429): קורפוס מוצפן לדלי `snb-learn`, רק בהסכמת `lrt`; ‏`learn_media` (1588): קול ו־240p מוצפנים, רק בהסכמת `lrm` (studio-learning.md:6, 10-11). ניתוח חדש — לא לאיסוף בלי החלטה.

---

## D. מודלי שפה

### D1. ‏translator/llm.py
- **מחירים** (38-43, דולר למיליון טוקנים — קלט/פלט/קריאה מהמטמון): opus-5-5 ‏4/20/0.20 · sonnet-5-5 ‏2/10/0.10 · haiku-5-5 ‏0.10/0.50/0.01. מעל 100K טוקני קלט Haiku עובר לכרטיס היקר `HAIKU_LONG` ‏0.5/2.5/0.05 (44-45).
- **הגדרות**: `MODES` (49-56); ‏`DEFAULT_MODE='haiku-medium'` (58); ‏`ROLE_CAP={'main':'medium'}` (65); ‏`CARD_LIMIT` (78) + `CARD_MARGIN 0.9`; ‏`JUDGE` = ‏Haiku high (83); ‏`CACHE_TTL='1h'`.
- **המנוע**: `Ledger` (183), ‏`BATCH_KEYS` main/tl/rv (224), ‏`Engine` (349), ‏`_anthropic0` (538: ‏`cache_control`, ‏thinking adaptive, ‏`effort`, מיפוי שגיאות). עוד: `cli` ‏(`claude -p`), ‏`relay`, ‏`ManualEngine` (798).
- **ההודעה היא טקסט בלבד**: `messages=[{'role':'user','content':prompt}]`. שליחת שקף תדרוש תוכן מרובה חלקים, ואומדן טוקנים לתמונה ב־Ledger וב־`fits_card`.

### D2. כרטיס ה־100K ו־Batches
- **כרטיס ה־100K**: ב־Haiku בקשה מעל 100K טוקנים מתומחרת כולה פי 5. הפתרון הקיים: `card_slices`/`lb_parts`, השומר `Card0911.GUARDS` (studio-worker.md:134-139). תמליל של הרצאה של שעתיים + טקסט השקפים יעבור את הסף — צריך חלוקה (וממילא יש `AI_T_ROWS 3000`).
- **Message Batches** (studio-worker.md:111-125): ‏`spec.bt`, ‏`bt_loop` (agent.py:1583), ‏`BW_MAX` 36 שעות — מתאים לניתוח שלא דחוף.

### D3. עלות, תקרות ו־Routine
- **תקרות**: `cap`, ‏`SNB_JOB_CAP_USD` 10, ‏`STUDIO_API_USER_MONTH_USD`, ‏`studioStats.mc`/`mu`, מתג החירום `halt`.
- **Routine ("המנוי שלי")**: translator/RUNBOOK.md — ‏`job.py go` מריץ את `auto`; ‏`ry` ← ‏ibkr-proxy/lib/relay.js (studio-worker.md:52-53).

### D4. ‏Gemini — רק בשרתון
- **הניתוח של Academy**: `op:'insight'` (ibkr-proxy/api/library.js:247-285) ← ‏lib/insight.js — סכימת JSON ‏(summary, ‏ideas, ‏lens, ‏terms, ‏question), ‏temperature 0.3, ‏maxOutputTokens 8192, תקציב 52 שנ׳, גיבוי Mistral ‏`ministral-14b-latest`.
- **מודלים ומטמון**: `INSIGHT_MODELS` (gmodels.js — משפחות flash ו־flash-lite, עם דריסה ב־`GEMINI_INSIGHT_MODEL`); ‏`insightCache` לפי id|md5 (api/library.js:24); ‏aicache.js (`AI_INSIGHT_DAILY` 100); בטלפון `rec.ins`.
- **המפתח**: `GEMINI_API_KEY` ב־Vercel (SECURITY.md:23) ובשרתון שלנו דרך `SNB_ENV_GZ` (infra/README.md:144) — **לא בעובד**. ‏vt/review.py: ביקורת Gemini ב־CLI בלבד.
- **Vercel חסום**: 402 ‏`DEPLOYMENT_DISABLED` (משימות-פתוחות.md:63) — כל `op` חדש צריך לרוץ גם בשרתון שלנו.

---

## E. נתונים ואחסון

### E1. ‏Firestore
- **האוספים** (api/studio.js, סביב 121): ‏studioJobs, ‏studioVault, ‏studioStats, ‏studioOps, ‏studioProbe, ‏studioEta ועוד.
- **`JSON_FIELDS`** (lib/studio.js:1700) עובד לפי שם שדה בכל האוספים — שם JSON חדש בודקים קודם בכולם (studio-server.md:19).
- **כללי כתיבה**: רק מספרים שלמים; רק דרך `patchDoc`/`patchIf`/`delDoc`; מסמך עד 1MiB.
- **מכסת 50K קריאות ביום**: ‏`SRV_LIGHT` (api/studio.js:1748), המטמון של `listJobs`, ‏tests/studio-fsreads.test.js (storage.md:12-15). **הניתוח לא נשמר במסמך העבודה.**

### E2. ‏ldb
SQLite בשרת, בקונטיינר של 768MB (ldb.md:5-36) — לא לתוצרי ניתוח.

### E3. ‏R2
- **המבנה**: הדלי `snb-studio` (EU); מפתח `st/<uid>/<id>`; תיקייה `R2_<jobId>`; מזהה קובץ עובר `FILE_ID_RE`.
- **הקריאה**: `r2url` חותם קובץ אחד לשעה (studionet.js: ‏`r2Get` ‏1145, ‏`driveJson` ‏1207) — כל קובץ = בקשה נפרדת לשרתון.
- **השמירה** (ibkr-proxy/lib/studioscan.js:176-214): תוצרים — `JOB_TTL` ‏30 יום בייצור, 7 בניסוי. המקור והנגזרים (`fa`, ‏`fv` חוץ מ־`fv.ext`, ‏`hl`, ‏`hla`, ‏`ck`) — ‏`SRC_TTL` יום אחד, ולא פחות מ־`SRC_GRACE` של 6 שעות אחרי הסיום.
- **המשמעות**: הסרטון המקורי ואיכויות הצפייה נמחקים אחרי יום. ניתוח שמקפיץ לזמן גם אחרי יום צריך עותק צפייה כתוצר (`compact`/`small` קיימים כסוגים) או שינוי במדיניות.

### E4. ‏CSP ותמונות
- **studio.html**: ‏`connect-src` כולל את R2 (`*.r2.cloudflarestorage.com`); ‏`img-src` = ‏`'self' data: blob:` ועוד כמה מארחים — **בלי R2**; ‏`media-src 'self' blob:`; ב־`frame-src` אין אתרי וידאו.
- **שלוש דרכים לשקפים מ־R2**: (1) fetch ← blob (כבר מותר ב־`connect-src`); (2) נתיב תמונות ב־sw.js לצד `studio-media` (שמקבל היום רק `video|audio`); (3) R2 ב־`img-src` **בכל הדפים** (tests/apps-pages.test.js).
- **החתימה** נפרדת לכל קובץ — עדיף ארכיון אחד, או פעולה שחותמת כמה בבת אחת.

### E5. איפה לשמור ניתוח
ה־JSON של הניתוח ותמונות השקפים = תוצרים חדשים ב־R2 של העבודה: סוג חדש ב־`OUT_KINDS`, ב־`put_output` ובנירמול בטלפון. **לא** Firestore ו**לא** ldb. עותק ל־Drive של המשתמש — דרך `dx` הקיים.

---

## F. פיקוח ושליטה
- **תיעוד**: studio-tower.md:6-36, 39. **בטלפון**: `pageTower` (studio.js:7065), ‏`pageTowerFull` (7158).
- **בשרתון**: ‏studioops, ‏studioinc, ‏studioprob, ‏studiosla, ‏studioscan, ‏studioslo, ‏studioanom, ‏studioagents ועוד; סט הזהב `goldRun`; שערים `normGate`; מתג החירום.
- **מרכז הניהול**: דגלים, ‏adminYt, שרתים, ‏xf, ניטור משתמשים (usermon.js, ‏`TYPES` ‏:256). **ברקע**: studio-watch.yml כל 10 דקות, ‏webpush.
- **לניתוח**: סוג או דגל חדש צריך ייצוג בתוכנית השלבים (studioeta), בהתראות (studioinc/studioprob), ב־SLA ובניטור המשתמשים — אחרת המגדל יראה אותו כתקלה, או לא יראה אותו בכלל.

---

## G. אילוצים לפרויקט חדש
1. **Vercel**: 12 מתוך 12 פונקציות; ‏`maxDuration` של studio ‏30 שנ׳ (ibkr-proxy/vercel.json). פעולה חדשה = `op` ב־api/studio.js (ההערה בשורות 1-2) או `SERVER_ONLY` (ibkr-proxy/server.js:123). ‏Vercel עצמו חסום כרגע (D4).
2. **appscope** (ibkr-proxy/lib/appscope.js:11-30): ‏`studio:['studio']`, ‏`inbox` מותר גם מ־studio.
3. **CSP**: מקור חדש — בכל הדפים (tests/apps-pages.test.js).
4. **פרטיות** (privacy.md:17, 30-45): וידאו, תמלילים ושקפים רק ב־R2 הפרטי או ב־Drive של המשתמש; תוכן הסרטון = נתונים, לא הוראות (`inject_guard`, job.py:2578; ‏`HEAD_T`); הצ'קליסט של "מערכות משלנו".
5. **בדיקות**: כ־120 `tests/studio-*.test.js`, ועוד sw-media-studio, ‏apps-pages, ‏appscope, ‏i18n-coverage ושלושת השומרים (privacy, ‏xss, ‏brand); כ־75 `translator/tests/test_*.py`. מריצים `bash tools/t.sh [--py]`. קבועים משותפים נבדקים בהשוואה: טלפון↔שרתון (`OUT_KINDS`, ‏`LANG_READY`), ‏JS↔פייתון (`XF_KEYS`, ‏`WD_MAX` מול peaks.py).
6. **פריסה וכסף**: PR אחד פתוח; ‏`coregen` ואז `swgen`; ‏worker-image — רק הריצה האחרונה. שירות בתשלום (OCR בענן, Gemini בעובד, שרת נוסף) — רק באישור עם מחיר.
7. **אנדרואיד** (android/app/build.gradle.kts:28-75): ה־flavor ‏studio (‏minSdk 29, ‏arm64, עם ytdl ו־phcore) ועוד bubble, ‏dm, ‏browser, ‏admin.

---

## H. תוכניות, מחקרים והתנגשויות
- **studio-upgrade-research.md:7-45**: ‏OCR עברי Rivok/paddleocr-hebrew (Apache, קהילתי); שוטים TransNetV2/PySceneDetect; חיפוש סמנטי (e5/bge-m3/Qwen3-Embedding); ‏Parakeet v3. מלכודות רישיון: gigapdf-ocr-hebrew (NC), ‏Surya, ‏MMS_FA (NC).
- **משימות-פתוחות.md:26-35** — מסומנות ‹בעבודה› של סשן אחר: סבב 6 D3 (כיסוי כתוביות צרובות מה־OCR); סבב 7 — ‏A11 ‏(Parakeet v3), ‏C7 (חיפוש), ‏J2 (הרצאה כמאמר ב־Academy), ‏J4 (קישור צפייה), ‏I4 ("תרגם" מ־Studio Browser). החפיפה עם ניתוח הרצאות ישירה — לתאם לפני שמתחילים. באותו קובץ: מנוע תמלול שני נדחה (87); סיכום ב־Browser Pro רק באישור כסף (118-119).
- **studio-quality-plan.md**: מדיניות PR פתוח אחד; סט המדידה כולל הרצאה.
- **התנגשויות שמות**: `docs/studio-analysis-prompt.md` = ניתוח איכות התרגום; ת־ניתוח (standards.md) = הניתוח הפונדמנטלי ב־Invest; ‏`va`/`an` כבר שדות בתשובת המגדל (api/studio.js:3740); "רעיונות" כבר קיים — להחליט אם הלשונית החדשה מרחיבה אותו או מחליפה אותו.

---

## סיכום הפערים ונקודות החיבור
| # | פער | נקודת החיבור |
|---|---|---|
| 1 | חילוץ שקפים | `_shots_and_burn` (vt/media.py:160), ‏`sh` ב־timeline.json |
| 2 | OCR שקורא טקסט, ועברית | vt/burnin.py (rapidocr) + מודל עברי פתוח מ־H |
| 3 | מודל עם תמונה | `_anthropic0` (llm.py:538), ‏`Ledger`, ‏`fits_card` |
| 4 | תמלול עברי להרצאה | שרשרת הקריוקי (vt/align_he.py) + `LANG_READY` בשלושת המקומות |
| 5 | סרטון זמין אחרי יום | `SRC_TTL` (studioscan.js) או תוצר צפייה |
| 6 | זמן בניתוב ובקישור | `go('play')`, ‏studio-app.js:40, ‏`canPlay` |
| 7 | תמונות ב־CSP | `img-src`, נתיב ב־sw.js, או blob |
| 8 | סוג תוצר לניתוח | `OUT_KINDS`, ‏`normOut`, הנירמול בטלפון |
| 9 | זמני שלבים | perf.py, ‏studioeta, ‏`MEM_PRIOR` |
| 10 | תיאום עם הסשן של סבב 7 | משימות-פתוחות.md:26-35 |
