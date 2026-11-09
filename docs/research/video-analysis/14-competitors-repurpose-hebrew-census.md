# מתחרים ושוק: כלי repurposing וידע מהרצאות ארוכות, השוק העברי־ישראלי, ומפקד הזנב הארוך (נכון ל־9/11/2026)

> הערות מחקר (סוכן 14). כל טענה מתוארכת ומקושרת. "נבדק 9/11/2026" = העמוד נקרא ישירות בתאריך זה. "(תקציר חיפוש)" = העובדה נלקחה מתקציר תוצאות חיפוש ולא מקריאת העמוד המלא — לאמת לפני שימוש. "(לא אומת)" = מקור משני או סותר. תקציב החיפוש המשותף (200 חיפושים לסבב) נגמר באמצע העבודה; ההמשך נעשה בקריאה ישירה של עמודים רשמיים, חנויות, GitHub ו־Product Hunt בלבד (פירוט ב־Gaps של כל סעיף). ניסוח עובדתי בלבד, בלי השוואות העתקה.

## א1. כרטיסי עומק — 21 כלי repurposing וידע: מה הם עושים, על מה הם נשענים (תמליל מול תמונה), מה יוצא, כמה זה עולה והאם יש עברית

### Takeaway
נכון ל־9/11/2026 כל 21 הכלים נשענים בעיקר על תמליל (ASR משלהם או כתוביות YouTube). רק שניים מצהירים על ניתוח פריימים: OpusClip ClipAnything (פריים־פריים, כולל טקסט על המסך, לצורך גזירת קליפים) ו־Descript (חיפוש ויזואלי בתוכנית Enterprise). אף אחד מהם לא מחלץ שקפים או OCR כדי לבנות סינתזה של תוכן הרצאה. עברית חסומה במפורש ב־Descript (רק אלפבית לטיני) וב־OpusClip ("we do not support any languages that read right to left"), ואינה מופיעה ברשימות השפות של Notion, של ה־API של Castmagic, של Snipd ושל Podwise. ב־Riverside היא נתמכת חלקית בלבד (באפליקציה, והתצוגה משמאל לימין). הכיוון החם של 2026 הוא סוכנים ו־MCP (Descript, OpusClip, Castmagic, Riverside, Podwise, Readwise, Heptabase), ובחירת מודל שכוללת את Claude (Descript, Glasp, Heptabase).

### Cited Findings

#### 1. Descript (Underlord) — עורך וידאו מבוסס תמליל עם סוכן עריכה
- **מה הוא עושה:** Underlord מוגדר "agentic video co-editor" ש־"can read your script, watch your video, and decide what to do next". הוא מבצע עריכות מרובות (קיצור וובינר לאורך יעד, מירכוז דוברים, צפצוף, lower thirds), קליפים, תיאורי YouTube, show notes ותרגום. נבדק 9/11/2026 — [Descript Underlord](https://www.descript.com/underlord)
- **השקות 2026 (עדכון מ־3/11/2026):** Generative Layouts; חיפוש מדיה בכל הפרויקטים, שעובד גם דרך Underlord, MCP ו־API; **חיפוש ויזואלי שמוצא שוטים לפי מה שעל המסך — רק ב־Enterprise**; Underlord Skills (שמירת עריכה מוצלחת כ"מיומנות", כ־10 מיומנויות מובנות); Animate Text ("coming soon") — [Descript blog, 3/11/2026](https://www.descript.com/blog/article/descript-updates-oct-2026)
- **מודלים:** ב־5/8/2026 נוסף Claude Fable 5 לבורר המודלים כ"premium model" (לתוכניות בתשלום ול־Enterprise), Claude Sonnet 5 נוסף לכל המשתמשים, Gemini Omni Flash נוסף ליצירת וידאו, תקרת הקרדיטים לשלב החשיבה של Underlord הוכפלה מ־100 ל־200 לתור, ונוסף מנוע התמלול Rev AI v3 — [Descript changelog, 5/8/2026](https://feedback.descript.com/changelog/release-round-upaugust-5th-2026). במרץ 2026 נוספו Claude Sonnet 4.6 ו־Gemini 3.1 Pro (תקציר חיפוש; לא אומת בעמוד עצמו) — [Descript changelog, מרץ 2026](https://feedback.descript.com/changelog/release-roundupmarch-17th-2026)
- **API ו־MCP:** API ב־open beta ממאי 2026 (תקציר חיפוש) — [Newsfile, מאי 2026](https://www.newsfilecorp.com/release/297461/Descript-Launches-API-in-Open-Beta-with-Editing-and-Workflow-Updates?lang=fr). מחבר ה־MCP "live in two major AI assistant marketplaces" (תקציר חיפוש של changelog יוני 2026) — [Descript changelog, 11/6/2026](https://feedback.descript.com/changelog/release-round-upjune-11th-2026). הוראות קבועות (custom instructions) ל־Underlord, מאי 2026 (מקור משני; לא אומת) — [createwith](https://www.createwith.com/tool/descript/updates/descripts-underlord-ai-now-learns-your-editing-style-with-custom-instructions)
- **קלט ועיבוד:** תמלול אוטומטי ב־26 שפות לפי הפתיחה (בטבלה 27 שורות), ו־"Every supported language is written in the Latin alphabet". עברית, ערבית ו־RTL לא מוזכרות. נבדק 9/11/2026 — [Descript Help](https://help.descript.com/script-editing/supported-transcription-languages.md)
- **עברית:** בקשת הפיצ'ר "Hebrew and RTL languages support" פתוחה מ־18/11/2022, עם כ־400 הצבעות. ב־3/4/2026 מוזגו אליה בקשות קרובות, אבל אין לה סטטוס ואין התחייבות — [Descript feedback](https://feedback.descript.com/feature-requests/p/hebrew-and-rtl-languages-support)
- **מחיר (נבדק 9/11/2026):** Free ‏$0 (שעת מדיה אחת, 100 קרדיטים חד־פעמיים); Hobbyist ‏$24 לחודש או $16 בחיוב שנתי (10 שעות, 400 קרדיטים); Creator ‏$35 או $24 (30 שעות, 800 קרדיטים, "Full access to Underlord"); Business ‏$65 או $50 (40 שעות, 1,500 קרדיטים). כתוביות ב־61 שפות ודיבוב ב־30. איזה מחיר חודשי ואיזה שנתי — מוסק מהמתג "Saving up to 35%" — [Descript pricing](https://www.descript.com/pricing)
- **ביקורות:** ב־Trustpilot ‏2.6/5, ‏292 ביקורות, 43% כוכב אחד. התלונות של 2026: קרדיטים שנשרפים ("Burned through 800 credits just trying to clean up filler pauses", 3/10/2026), קריסות, קושי בביטול מנוי, וניקוי תמליל ש־"many of the words important to the understanding of the lecture were removed" (21/8/2026) — [Trustpilot Descript](https://www.trustpilot.com/review/descript.com)

#### 2. OpusClip — גזירת קליפים ויראליים מסרטון ארוך, ו־Agent Opus
- **ניתוח רב־מודלי:** ClipAnything מוצג כ־"the first-ever multimodal AI video clipping software". הוא מנתח כל פריים לפי רמזים חזותיים, קוליים ורגשיים, ומזהה אובייקטים, סצנות, פעולות, צלילים, רגשות **וטקסט על המסך** ("Scoreboards, name cards, logo"). כל סצנה מקבלת דירוג ויראליות, וקליפים יכולים להגיע עד 15 דקות. ReframeAnything עדיין "Alpha". נבדק 9/11/2026 — [OpusClip ClipAnything](https://www.opus.pro/clipanything). ClipAnything הושק באוגוסט 2024 (תקציר חיפוש) — [OpusClip blog](https://www.opus.pro/de-de/blog/opusclip-celebrates-30m-in-funding-and-the-launch-of-clipanything)
- **סוכנים ו־MCP:** Agent Opus הוא "end-to-end AI video agent" (מפרומפט, תסריט, שמע או URL ועד וידאו). שרת MCP: נקודת IDE/CLI עם 29 כלים, ומחבר ל־Claude.ai ול־Claude Desktop עם 27 כלי קריאה וכתיבה. נדרשת תוכנית בתשלום. העמוד עודכן לאחרונה באוגוסט 2026 — [OpusClip llms.txt](https://www.opus.pro/llms.txt)
- **היקף:** ב־llms.txt כתוב "more than 16 million creators", ובדף הבית שנקרא ב־9/11/2026 כתוב "We help 20M+ creators" — [OpusClip llms.txt](https://www.opus.pro/llms.txt); [OpusClip](https://www.opus.pro/) (סתירה פנימית במספרים). לפי Sacra: הכנסות $20M ב־2025, שווי $215M (מרץ 2025), ‏$50M גיוס מצטבר, Agent Opus הושק באוגוסט 2025 ו־Zapier בספטמבר 2025 (העמוד לא מציין מקורות) — [Sacra](https://sacra.com/c/opusclip/)
- **מחיר (נבדק 9/11/2026):** Free ‏$0, ‏Starter ‏$15 לחודש, Pro ‏$29 לחודש, Business בהתאמה אישית. ציון ויראליות מ־Starter. ב־Pro יש Video Editing API, ‏Scheduler API ומחבר MCP. אחסון המדיה פג אחרי 3 ימים בחינם ואחרי 29 ימים ב־Starter — [OpusClip pricing](https://www.opus.pro/pricing)
- **עברית:** "Unfortunately, we do not support any languages that read right to left, including Hebrew, Kurdish, Arabic or Persian" (עמוד בלי תאריך) — [OpusClip Help](https://help.opus.pro/docs/article/does-opusclip-support-languages-right-left.md). לעומת זאת, פוסט 2026 על ה־API (שנמצא ב־early access) מונה עברית בין 30+ שפות (תקציר חיפוש; סותר את מרכז העזרה) — [OpusClip blog API](https://www.opus.pro/blog/multi-language-captions-api)
- **ביקורות:** ב־Trustpilot ‏4.0, ‏520 ביקורות, 20% כוכב אחד. תלונות 2026: לחץ לקנות קרדיטים (7/10/2026), התוכנית החינמית "completely deletes any saved progress" (6/10/2026), ותמיכה איטית — [Trustpilot OpusClip](https://www.trustpilot.com/review/opus.pro)

#### 3. Castmagic — מקובץ שמע או וידאו לתוכן כתוב, עם ספרייה שאפשר לשאול
- **קלט:** קבצי MP3, ‏WAV, ‏M4A ו־MP4 עד 1GB; קישורים מ־"1,800+" פלטפורמות (YouTube, ‏Spotify, ‏Vimeo, ‏Loom, ‏Wistia, ‏Google Drive ועוד); פיד RSS ("Podcast autopilot"); והקלטות פגישות מ־Zoom ו־Meet. נבדק 9/11/2026 — [Castmagic](https://www.castmagic.io/)
- **פלט:** תמליל "Speaker-labelled and timestamped"; סיכומים, show notes, ציטוטים וגרפיקת ציטוטים; מאמרים, ניוזלטרים ופוסטים; קרוסלות, קליפים אנכיים ו־audiograms. פרקים (chapters) לא מוזכרים — [Castmagic](https://www.castmagic.io/)
- **שאלות על הספרייה:** Magic Chat, ‏"Ask your library" (שאלה על כמה הקלטות יחד), חיפוש סמנטי לפי משמעות, Brand voice, ראיונות אסינכרוניים ו־Audience Chat. "Castmagic × Claude" מסומן "Live now": מחבר MCP שמאפשר ל־Claude לחפש בספרייה ו־"cite exact moments" — [Castmagic](https://www.castmagic.io/)
- **מחיר:** Hobby ‏$19 לחודש (30 שעות), Starter ‏$48 (100 שעות), Team ‏$139 (400 שעות). נבדק 9/11/2026 במחקר 06 — [Castmagic pricing](https://www.castmagic.io/pricing)
- **שפות ועברית — סתירה:** דף הבית: "60+ languages" — [Castmagic](https://www.castmagic.io/). מסמכי ה־API: en, ‏de, ‏es, ‏fr, ‏hi בלבד, "same languages as the customer-facing application" (תקציר חיפוש) — [Castmagic API docs](https://docs.castmagic.io/reference/supported-languages). תשובת החברה ב־AppSumo מיוני 2026: "70+" (תקציר חיפוש) — [AppSumo Q&A](https://appsumo.com/products/castmagic/questions/does-castmagic-work-for-all-languages-1518351/). אף אחד מהמקורות לא מזכיר עברית.
- **ביקורות:** ב־Trustpilot יש ביקורת אחת בלבד (2 כוכבים, 31/3/2026): המנוי הומר לתשלום לפני סוף תקופת הניסיון, ו־"credit system also feels overpriced". לא מייצג — [Trustpilot Castmagic](https://www.trustpilot.com/review/castmagic.io)

#### 4. Riverside — הקלטה, עריכה ו־repurposing (Magic Clips, ‏AI Show Notes, ‏Co-Creator, ‏Agents)
- **השקות 2026 לפי דף העדכונים:** Riverside Agents ("AI production team", ‏26/10/2026); ‏Riverside MCP ‏(31/8/2026); ‏Dictionary למונחים ושמות (21/9/2026); הרצה מחדש של התמליל בשפה שנבחרת (27/9/2026); כתוביות חיות באנגלית לוובינרים (15/10/2026); Magic Clips מתוך גרסה ערוכה (28/10/2026); b-roll ו־motion graphics ל־Magic Clips בלחיצה (3/11/2026); AI Twin ‏(7/9/2026); Q&A AI Moderator ‏(27/9/2026) — [Riverside product updates](https://riverside.com/university/product-updates)
- **יכולות AI:** Magic Clips "already edited and ready to post as is"; ‏Co-Creator מנסח תוכן לפי ה־"tone of voice"; תרגום ל־"30+ languages" בקול שלך עם סנכרון שפתיים; VideoDub; עריכה בשיחה עם סוכן. נבדק 9/11/2026 — [Riverside AI](https://riverside.com/ai). show notes כוללים מילות מפתח, סיכום, תובנות וציטוטים, ו־Magic Clips הם קטעים של 30–90 שניות (תקציר חיפוש; העמוד החזיר 403) — [Riverside support](https://support.riverside.com/hc/en-us/articles/20173322157341). הוראות קבועות לכל סוג נכס ב־Co-Creator (תמליל סרטון בלי תאריך; לא אומת) — [GoTranscript](https://gotranscript.com/public/riverside-co-creator-adds-custom-instructions-for-every-asset)
- **עברית:** "The Riverside mobile app can transcribe right-to-left languages (ex. Hebrew, Arabic), however the transcriptions will display as left-to-right". התמלול עלול גם ליפול לשפת "הורה" קרובה (תקציר חיפוש של מרכז העזרה; העמוד החזיר 403) — [Riverside support](https://support.riverside.com/hc/en-us/articles/10446154802589)
- **מחיר:** מעותק staging שמצהיר שהוא "may not be up to date": ‏Free ‏$0 (שעתיים, Magic Clips, ‏720p); Pro ‏$29 לחודש או $24 בחיוב שנתי ("Unlimited transcriptions", ‏Magic clips & show notes); Grow ‏$39 או $34; Webinar ‏$99 או $79; Business בפנייה. יש סתירה פנימית במחיר השנתי של Webinar — [Riverside pricing](https://riverside.com/pricing)
- **ביקורות:** ב־Trustpilot ‏3.8, ‏549 ביקורות, 19% כוכב אחד. תלונות: תמיכה (1/11/2026), "Constant errors" ‏(28/10/2026), ועומס של פיצ'רי AI שגורם לאתר להרגיש "cluttered" ‏(27/10/2026). מנגד, "a big step up" על הסוכנים (26/10/2026) — [Trustpilot Riverside](https://www.trustpilot.com/review/riverside.fm)

#### 5. Vizard — גזירת קליפים ו־Vizard Agent
- **מה הוא עושה:** "#1 AI Video Editing and Clipping Tool". מזהה רגעים "engaging" וממרכז את הנושא בפריים, אבל לא מפרט אם על סמך דיבור או תמונה. Vizard Agent ‏(NEW) מגיע עם 22 תבניות. אפשר לערוך דרך מחיקת טקסט מהתמליל ("Edit by text"), ויש תרגום כתוביות ל־"over 100 languages". הוא מציג "10 million+ creators & businesses". נבדק 9/11/2026 — [Vizard](https://vizard.ai/)
- **מחיר:** בתוכנית החינמית 60 קרדיטים בחודש ("1 credit = 1 minute of video"), ייצוא 720p ומגבלת ייצוא של 10 דקות. המחירים בתשלום לא קריאים בעמוד (מוצגים כתמונה). ל־API יש מגבלות קצב לפי תוכנית — [Vizard pricing](https://vizard.ai/pricing). לפי סקירה: Creator ‏$16.90 ו־Business ‏$22.80 לחודש בחיוב שנתי, או $29 ו־$39 בחיוב חודשי (תקציר חיפוש) — [RoboRhythms](https://www.roborhythms.com/?p=33200)
- **שפות:** הטענה "100+" נוגעת לתרגום. ביקורת אחת טוענת שכיסוי התמלול בפועל הוא כ־25 שפות (תקציר חיפוש; לא אומת) — [RoboRhythms](https://www.roborhythms.com/?p=33200). עברית לא מופיעה בעמוד המחירים — [Vizard pricing](https://vizard.ai/pricing)

#### 6. Munch → Munch Studio — מכלי גזירה לשירות תוכן "done-for-you"
- **השינוי:** ‏getmunch.com מפנה (301) ל־munchstudio.com — [Munch](https://www.getmunch.com/pricing). כותרת האתר: "Munch Studio - Social Media For Businesses", והתיאור "creates done-for-you social media content". נבדק 9/11/2026 — [Munch Studio](https://www.munchstudio.com/)
- **מחיר (עמוד מ־3/11/2026):** Essential ‏$38 לחודש ($456 לשנה), עם 500 דקות repurposing בחודש ו־10 סרטונים מיוצרים; Premium ‏$60 ($720 לשנה), עם 1,000 דקות ו־30 סרטונים. ניסיון של 7 ימים ופרסום לרשתות. העמוד לא מזכיר שפות, ניתוח טרנדים, API או ניתוח חזותי — [Munch Studio pricing](https://www.munchstudio.com/pricing)

#### 7. Swell AI — repurposing לפודקאסטים
- **קלט ופלט:** "Turn audio or video into clips, blog posts, newsletters and more". קלט: RSS, ‏Apple Podcasts, ‏Zoom Cloud, ‏Dropbox, ‏Drive, ‏OneDrive, ‏Omny, ‏webhooks ו־REST API. פלט: תמליל עם תוויות דוברים, קליפים ו־audiograms, ‏show notes "with summaries, time-stamps, and key topics", מאמרים, ניוזלטרים, פוסטים, תסריטי פרסומות, מילות מפתח, וצ'אט לכל פרק ("Swell Chat") — [Swell AI](https://www.swellai.com/)
- **מחיר:** Hobby ‏$0 (העלאה אחת בחודש), Studio ‏$29 (300 דקות), Agency ‏$49 (600 דקות), או $8.99 לכל 60 דקות. הנתונים בדף הם מ־2023 עד תחילת 2024, ולכן ייתכן שהדף לא מעודכן. עמוד /pricing מחזיר 404 — [Swell AI](https://www.swellai.com/)

#### 8. Podium — show notes ופרקים לפודקאסט
- הדומיין podium.page לא נפתח מסביבת המחקר (EAI_AGAIN), ולכן לא נקרא — ראו Gaps.
- לפי מקורות משניים: Podium מייצר show notes, פרקים "compatible with Spotify, YouTube, and RSS", קליפים ותמלילים. מחיר: "Creator" מ־$14 לחודש ו־"Studio" ב־$213 (רישום ב־Software Advice מ־2026; יש חשש לבלבול עם חברה אחרת בשם Podium) (תקציר חיפוש) — [Software Advice](https://www.softwareadvice.com/product/514578-Podium/). בסקירה של מתחרה ממאי 2024: $12 עד $14 לחודש ל־3 שעות (תקציר חיפוש) — [Riverside blog](https://riverside.fm/blog/podium-review). "currently supports English" (תקציר חיפוש; ייתכן שמיושן) — [SimilarLabs](https://similarlabs.com/p/podium)

#### 9. Headliner — audiograms וקליפים מבוססי תבניות
- **מחיר ותכונות (נסקר 1/10/2026):** Free ‏$0 (סרטון אחד בחודש עם סימן מים), Basic ‏$9.99 ($7.99 בחיוב שנתי), Pro ‏$25.99 ($19.99 בשנתי), Business ‏$49.99. הסקירה מתארת אותו "manual and template-driven", בלי בחירת קליפים ב־AI, ואת התמלול "generally good for clear English-language speech". יש סתירות פנימיות במחירים — [CreatorStackClub](https://www.creatorstackclub.com/software/headliner/pricing)
- ארבע דרגות: Forever Free, ‏Basic, ‏Pro, ‏Enterprise/API (תקציר חיפוש של מרכז העזרה) — [Headliner help](https://learn.headliner.app/hc/en-us/articles/360003772294). העמודים הרשמיים headliner.app ו־/pricing חזרו ריקים (תוכן שנטען ב־JavaScript), ולכן לא אומתו.

#### 10. Snipd — אפליקציית פודקאסטים עם "snips" ו־AI
- **מה הוא עושה:** הקשה משולשת על האוזניות שומרת רגע: "Our AI creates a snip for you with audio, transcript, and summary". יש גם Mini summaries, צ'אט עם פרקים, פרקים אוטומטיים, תמליל עם זיהוי דוברים, פרומפטים מותאמים, ספרים שהוזכרו וכרטיסי ציטוט. אפשר לייבא סרטוני YouTube, ספרי שמע מ־Libro.fm וקבצים. ייצוא ל־Notion, ‏Readwise, ‏Obsidian, ‏Logseq, ‏Glasp, ‏Bear ו־Markdown. הדף מציג "hundreds of thousands" משתמשים ו־AI ב־26 שפות. נבדק 9/11/2026 — [Snipd](https://www.snipd.com/)
- **מחיר:** בחינם, AI ל־2 פרקים בשבוע. Premium ‏$6.99 לחודש: AI ללא הגבלה על פרקים שכבר עובדו, ו־900 דקות עיבוד בחודש לפרקים שטרם עובדו — [Snipd pricing](https://www.snipd.com/pricing)
- **שפות — סתירה:** ב־App Store ‏(גרסה 3.2.4) מופיעות 10 שפות AI חדשות (de, ‏es, ‏fr, ‏nl, ‏sv, ‏pt, ‏it, ‏pl, ‏no, ‏da) בנוסף לאנגלית (תקציר חיפוש) — [App Store Snipd](https://apps.apple.com/dk/app/id1557206126?l=en-gb). בדף הבית כתוב 26 — [Snipd](https://www.snipd.com/). לא נמצאה ראיה לעברית.

#### 11. Podwise — אפליקציית ידע מפודקאסטים, עם CLI, ‏Skills ו־MCP
- **קלט:** Apple Podcasts, ‏Spotify, ‏YouTube, ‏RSS, פידים פרטיים, ‏OPML והעלאות. **פלט:** סיכום עם takeaways, מפת חשיבה, תמליל עם זמנים בכל שורה, ו־"Key insights". תשובות לשאלות מצביעות על רגעים בפרק (למשל 02:14). חיפוש בכל הספרייה. ייצוא ל־Notion, ‏Readwise, ‏Obsidian, ‏Logseq, ‏Markdown ו־PDF. נבדק 9/11/2026 — [Podwise](https://podwise.ai/)
- **מפתחים:** CLI דרך Homebrew; ‏Skills שאפשר להתקין ב־Claude Code, ‏Codex ו־OpenClaw; ושרת MCP מתארח ל־Claude, ‏ChatGPT ו־Cursor. ‏Podwise App 2.0 Beta (תמיכה ב־CarPlay וב־Android Auto) — [Podwise](https://podwise.ai/)
- **מחיר ושפות:** Standard ‏$5.90 לחודש, Pro ‏$11.90, Enterprise מ־$299. ‏12 שפות (בדוגמאות: אנגלית, סינית, יפנית, ספרדית). "115,000+ listeners" — [Podwise](https://podwise.ai/). עברית לא מוזכרת.

#### 12. Shortform — סיכומי ספרים, ותוסף שמסכם YouTube
- **התוסף:** "Shortform: Summary of Web + YouTube / ChatGPT" מסכם דפי ווב וסרטוני YouTube בלחיצה ומוסיף "background context and counter-arguments". כ־10,000 משתמשים, דירוג 4.0 (26 דירוגים). עודכן ב־1/4/2026 (גרסה 0.8.6). פודקאסטים וסרטונים שאינם מ־YouTube מסומנים "Coming soon". בחינם: עשרות סיכומים בחודש וסיכום חדש אחד ביום — [Chrome Web Store](https://chromewebstore.google.com/detail/shortform-summarize-anyth/anfegbjckcheemfbibglojdmjadgiepe)
- **המוצר המרכזי:** מדריכי ספרים עם "insights and analysis", דוגמאות והערות מומחים. $16.42 לחודש בחיוב שנתי, $24 בחודשי (עמוד של Shortform עצמה מ־12/12/2025, עודכן 18/5/2026) — [Shortform blog](https://www.shortform.com/blog/shortform-vs-blinkist/)

#### 13. Blinkist — Blinkist AI ‏(Extracts), ‏Shortcasts ו־Guides
- **Blinkist AI:** מסכם דפי ווב, פודקאסטים, סרטונים ומסמכים (כולל PDF) ל־"Extracts" שאפשר לקרוא או להאזין להם. "currently available exclusively in the Blinkist mobile app". אין הגבלה על מספר הקישורים. דורש PRO. מאמר מ־19/3/2026 — [Blinkist support](https://support.blinkist.com/hc/en-us/articles/21281516909074-What-is-Blinkist-AI)
- **מחיר:** Pro ב־$139.99 לשנה במבצע (במקום $174.99) (תקציר חיפוש) — [Blinkist pricing](https://www.blinkist.com/en/pricing). המחירים סותרים בין מקורות — [Shortform blog](https://www.shortform.com/blog/shortform-vs-blinkist/)
- **Shortcasts:** פרקי פודקאסט מקוצרים של 15 דקות שנוצרים "עם היוצרים המקוריים" (תקציר חיפוש של עמוד רשמי בגרמנית; העמוד החזיר 403) — [Blinkist DE](https://www.blinkist.com/de/learn/blinkist-review-2026-an-honest-look-at-what-you-get). שפות ל־AI לא צוינו.

#### 14. Readwise Reader — תמליל YouTube מסונכרן, ו־Ghostreader
- **וידאו:** "Watch YouTube videos and highlight the transcript in Reader". רק YouTube. הסרטון מתנגן "alongside its time-synced transcript", ולחיצה על קטע מקפיצה לזמן שלו. "Enhanced transcript" מתקן כתוביות אוטומטיות. האפשרויות "limited to the caption options available on the original YouTube video" — [Readwise Reader](https://readwise.io/read); [Readwise docs Videos](https://docs.readwise.io/reader/docs/faqs/videos)
- **Ghostreader:** "searches across your entire library, answers with citations that link to the source". ברירת המחדל GPT-5 Mini. עם מפתח OpenAI משלך זמינים GPT-5, ‏GPT-4.1, ‏o3 ו־o4-mini. **Claude לא מוזכר**. מסמכים נשמרים עם סיכום אוטומטי — [Readwise docs Ghostreader](https://docs.readwise.io/reader/docs/faqs/ghostreader)
- **אינטגרציות ומחיר:** שרת MCP ל־Claude, ‏ChatGPT ו־Cursor; ‏CLI; מצב e-ink; ייצוא Markdown ו־CSV. ‏$9.99 לחודש בחיוב שנתי או $12.99 בחודשי, 50% הנחה לסטודנטים. נבדק 9/11/2026 — [Readwise Reader](https://readwise.io/read). ניקוי תמלילי YouTube ב־GPT (אוקטובר 2024) ובחירת שפת כתוביות (ינואר 2025) (תקציר חיפוש) — [Readwise update Oct 2024](https://readwise.io/reader/update-oct2024); [Readwise update Jan 2025](https://readwise.io/reader/update-jan2025)

#### 15. Matter — קורא "שמור לאחר כך" עם תמלול ו־Co-Reader
- שומר סרטוני YouTube ופרקי פודקאסט ומתמלל אותם ל־"time-synced text". יש הקראה (TTS), הדגשות ו־Quoteshots. נבדק 9/11/2026 — [Matter](https://getmatter.com/)
- ב־App Store: ‏AI Co-Reader בתוכנית Premium; דירוג 4.6 (1.3K דירוגים); Premium שנתי $79.99 (ומחירים נוספים ברשימת הרכישות). גרסה 4.1.3 (9/3) הוסיפה הקראה ב־15 שפות, וגרסה 4.1.18 ‏(23/10) הוסיפה חלונית צד ל־Co-Reader ולפרקים. שפת הממשק: אנגלית בלבד — [App Store Matter](https://apps.apple.com/us/app/matter-reading-app/id1501592184). אין אפליקציית אנדרואיד (אוגוסט 2026; תקציר חיפוש) — [Tooliverse](https://tooliverse.ai/tools/matter)

#### 16. Glasp — סיכום YouTube עם זמנים, ובחירת מודל
- תוסף חינמי ל־Chrome, ‏Edge, ‏Firefox ו־Safari, ואפליקציה לנייד. אפשר לסכם עם ChatGPT, ‏**Claude**, ‏Gemini או Mistral, ולבחור אורך, מספר נקודות ופרומפט. הסיכום כולל זמנים, ולחיצה על נקודה קופצת לרגע בסרטון. התמליל זמין ב־"every language YouTube has captions for", כלומר תלוי בכתוביות. ייצוא ל־Notion, ‏Obsidian, ‏Roam ו־mem.ai, ‏Markdown ו־JSON. בחינם: 3 סיכומים בכל 7 ימים. בתשלום מ־$15 לחודש או $150 לשנה (Pro: ‏1,000 סיכומים ל־30 יום). "2,000,000+ users". נבדק 9/11/2026 — [Glasp YouTube Summary](https://glasp.co/youtube-summary)

#### 17. Heptabase — לוחות לבנים עם "כרטיסי וידאו"
- **עיבוד:** ה־AI "doesn't read the raw video" ועובד רק מהתמליל. ב־YouTube הוא "automatically selects a caption track", ו־"You can't manually choose the YouTube caption language" — [Heptabase support](https://support.heptabase.com/en/articles/11991474-how-do-i-use-a-video-with-the-heptabase-ai-agent)
- **עיגון בזמן:** תובנות מסוכמות "every few hundred words", ‏"each insight linking to the respective timestamps in the video". פודקאסטים מתומללים במודלים מובנים, במגבלה חודשית לפי תוכנית — [Heptabase wiki](https://wiki.heptabase.com/pdf-annotation). ייבוא כתוביות YouTube נוסף בדצמבר 2024 (תקציר חיפוש) — [Heptabase newsletter 2024-12-28](https://wiki.heptabase.com/newsletters/2024-12-28)
- **מחיר (נבדק 9/11/2026):** Pro ‏$8.99 לחודש: 100 קרדיטים, סוכן על Gemini בלבד, תוספים (ChatGPT, ‏Claude, ‏Grok), ‏"MCP & CLI" ו־"YouTube transcripts". Premium ‏$17.99: ‏1,800 קרדיטים, "AI agent (GPT, Claude, Gemini)", ‏AI tutor ו־OCR ל־PDF. Premium+ ‏$53.99 — [Heptabase pricing](https://heptabase.com/pricing)

#### 18. Obsidian ו־Logseq — תוספי וידאו־הערות
- **Media Extended (Obsidian):** "Transform your Obsidian into a powerful video note-taking tool". קישורי זמן בהערות, צילומי פריים עם קישור זמן, ניווט וחיפוש בתמליל מקובצי ‎.srt/.vtt, וסימונים בזמן הקלטה. עובד עם קבצים מקומיים, YouTube, ‏Vimeo ו־WebDAV. גרסה 4 "closed source", וגרסה 3 נשארת MIT. ‏965 כוכבים. נבדק 9/11/2026 — [GitHub media-extended](https://github.com/aidenlx/media-extended). ב־v4, סיכום AI של תמלילים ו־OCR לצילומי מסך מסומנים כפיצ'רים בתשלום, בלי מחיר ידוע (תקציר חיפוש) — [GitHub PKM-er/media-extended](https://github.com/PKM-er/media-extended)
- **תוספים נוספים ב־Obsidian (קיום בלבד):** Media Transcript, ‏WayinVideo Video Summarizer, ‏AI Transcriber ו־Transcription — [Obsidian plugins](https://community.obsidian.md/plugins/media-transcript); [WayinVideo plugin](https://community.obsidian.md/plugins/wayinvideo-video-summarizer-and-transcript-generator); [AI Transcriber](https://community.obsidian.md/plugins/ai-transcriber)
- **Logseq:** המאקרו ‎{{youtube-timestamp}}‎ עובד רק עם YouTube, ומשתמשים מדווחים על השגיאה "No Video found in parent block" — [Logseq forum](https://discuss.logseq.com/t/video-seeking-and-screenshotting-for-non-youtube-videos/25063). התוסף Cinematograph (12 כוכבים) — [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fqwxlea%2Fcinematograph). התוסף logseq-youtube-plugin ‏(push אחרון בספטמבר 2022) — [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fhiway%2Flogseq-youtube-plugin). תוסף Chrome להערות עם זמנים שמעביר ל־Logseq — [yt-notes](https://github.com/fferrin/yt-notes)

#### 19. Notion AI ‏(AI Meeting Notes) — תמלול וסיכום בתוך סביבת העבודה
- **שפות:** 16 שפות, ביניהן en, ‏zh, ‏es, ‏fr, ‏de, ‏ja, ‏ko ו־pt. **עברית לא ברשימה**. זיהוי דוברים באנגלית בלבד. נדרשת תוכנית Business או Enterprise. אפשר להעלות AAC, ‏M4A, ‏MP3 ו־WAV, עם מגבלה של 10 שעות ביום למשתמש. **ציטוטים בסיכום מקושרים לשורת התמליל**. נדרשים לפחות 300 תווים מתומללים. נבדק 9/11/2026 — [Notion Help](https://www.notion.com/help/ai-meeting-notes)
- **פרטיות:** "No training on your data", ‏"Configurable transcript retention", ‏"Consent disclosures", ‏SOC2 Type 2 — [Notion AI Meeting Notes](https://www.notion.com/product/ai-meeting-notes). הפיצ'ר הושק במאי 2025 (תקציר חיפוש) — [AlternativeTo news](https://alternativeto.net/news/2025/5/notion-adds-ai-meeting-notes-enterprise-search-and-model-picker)

#### 20. Mem — סביבת הערות עם סוכן, Voice Mode ופגישות בלי בוט
- "Mem listens without a meeting bot, writes the notes, and keeps track of decisions and follow-ups". יש גם Push-to-Remember, ‏Web Clipper ופוסט בבלוג על "Claude Connector". העמוד לא מזכיר העלאת וידאו או YouTube. נבדק 9/11/2026 — [Mem](https://get.mem.ai/)
- **מחיר:** Free ‏$0 (3 שעות Voice Mode), Plus ‏$9 (10 שעות), Pro ‏$29 (25 שעות), ועד Pro 20× ‏$199 (500 שעות) — [Mem pricing](https://get.mem.ai/pricing). ‏Mem 2.0 הושק ב־1/10/2025 כ־"AI Thought Partner" (תקציר חיפוש) — [Mem blog](https://get.mem.ai/blog/mem-2-dot-0)

#### 21. Reflect — הערות יומיות, ו־Reflect Open
- AI אופציונלי עם מפתח API של המשתמש ("AI usage is billed separately by your provider"), ותמלול קולי "with your transcription provider". ב־Mac בחינם, ב־iPhone ו־iPad בתשלום. YouTube לא מוזכר. נבדק 9/11/2026 — [Reflect](https://reflect.app/)
- Reflect Open הוא גרסת קוד פתוח ב־MIT, מבוססת קובצי Markdown מקומיים, שיצאה באמצע 2026 (יולי 2026, לפי מקורות משניים) (תקציר חיפוש) — [Reflect blog](https://reflect.app/blog/reflect-open)

### Inferences
- **Descript:** החוזקה היא הסוכן, ה־MCP ובחירת המודל (כולל Claude Fable 5 ו־Sonnet 5). החולשה היא אלפבית לטיני בלבד, בקשת עברית שמחכה כבר כ־4 שנים, ותלונות על קרדיטים שנשרפים. מה לומדים: עלות AI שקופה וצפויה לכל פעולה היא בידול. "ניקוי" תמליל שמוחק מילים שחשובות להבנת ההרצאה הוא סיכון ממשי, ולכן אין למחוק תוכן מהתמליל שמשמש לניתוח.
- **OpusClip:** הוא היחיד שמצהיר על ניתוח פריים־פריים שכולל טקסט על המסך, אבל המטרה היא ויראליות ולא הבנה. עברית חסומה במפורש. מה לומדים: מספיקה יכולת חזותית בסיסית (OCR ותיאור סצנה) כדי להיות "רב־מודלי" בעיני השוק. הפער הוא בהפניית היכולת להבנת תוכן לימודי ועסקי.
- **Castmagic:** החוזקה היא שאלות על ספרייה שלמה ו־MCP שמצטט "exact moments". החולשה היא סתירה במספר השפות ומודל קרדיטים שנחווה כיקר. מה לומדים: השאלה "שאל את כל ההרצאות שלי" עם ציטוט רגע מדויק היא יכולת שמשתמשים מקבלים כבר היום בשוק התוכן.
- **Riverside:** החוזקה היא קצב השקות גבוה (סוכנים, MCP, מילון מונחים). החולשה היא תצוגה משמאל לימין לעברית במובייל, ותלונות על עומס של פיצ'רי AI. מה לומדים: מילון מונחים ושמות שהמשתמש מתקן פעם אחת והוא חל על כל התמלולים הבאים הוא יכולת זולה וחשובה לעברית (שמות פרטיים, מונחים מקצועיים).
- **Vizard ו־Munch:** הקטגוריה מתכנסת לשירותי תוכן לרשתות (Munch עבר ל־"done-for-you"). מה לומדים: שוק הקליפים הוויראליים צפוף ומתמסחר, ולא שם הבידול של ניתוח הרצאות.
- **Swell, ‏Podium, ‏Headliner:** כלי פודקאסט שנראים מקובעים (נתונים מ־2023–2024, עמודים שלא נטענים) או ידניים. מה לומדים: show notes עם זמנים ופרקים הם כבר commodity, ואין בהם לבדם בידול.
- **Snipd ו־Podwise:** כלי צד המאזין: לכידת רגע, סיכום לפרק, צ'אט וייצוא למערכות ידע אישיות. ל־Podwise יש גם Skills ו־MCP. מה לומדים: ייצוא נקי ל־Markdown ולמערכות ידע (Obsidian, ‏Notion, ‏Readwise), עם זמנים בכל פסקה, הוא ציפייה בסיסית של "לומדים".
- **Shortform ו־Blinkist:** מדגישים "הקשר וטיעוני נגד" (Shortform) וסיכום בפורמט קבוע של 15 דקות (Blinkist Extracts). מה לומדים: שכבת ביקורת (טיעוני נגד, הקשר רחב) היא מה שהופך סיכום ל"ניתוח", וזה מתאים לשכבת הסינתזה שלנו.
- **Readwise, ‏Matter, ‏Glasp, ‏Heptabase:** כולם תלויים בתמליל ובכתוביות YouTube (ב־Heptabase אי אפשר לבחור את שפת הכתוביות). מה לומדים: לסרטון עברי בלי כתוביות טובות אין לכלים האלה בסיס. תמלול עצמאי עם זמנים ברמת מילה הוא יתרון מבני.
- **Obsidian ו־Logseq:** הקהילה בונה בעצמה צילום פריים עם קישור זמן ו־OCR לצילום (Media Extended v4 בתשלום). מה לומדים: יש ביקוש ל"צילום שקף + קישור זמן + טקסט השקף" בתוך ההערות, והוא מסופק כיום ידנית.
- **Notion, ‏Mem, ‏Reflect:** תמלול וסיכום הם פיצ'ר בתוך כלי עבודה. ל־Notion מגבלות שפה (אין עברית), ו־Reflect עובר ל־BYO-key. מה לומדים: ייצוא סיכום עם ציטוטים מקושרים לשורת התמליל (הדפוס של Notion) מתאים לשילוב בכלים שהמשתמשים כבר עובדים בהם.

### Gaps
- **Podium:** הדומיין podium.page ו־www.podium.page לא נפתרו מסביבת המחקר (EAI_AGAIN), ולכן לא נקראו העמודים הרשמיים. נתוני המחיר משניים, וייתכן שהם שייכים לחברה אחרת בשם Podium.
- **Headliner:** העמודים הרשמיים (headliner.app, ‏/pricing) חזרו ריקים כי הם נטענים ב־JavaScript. השוואת מחירים רשמית לא בוצעה. גם פיצ'ר הסיכום "tl;dl" שהוזכר במקור משני לא אומת.
- **Riverside:** עמודי מרכז העזרה (רשימת שפות התמלול, AI at Riverside) החזירו 403. לא אומת אם עברית נתמכת בדסקטופ ואם תקלת התצוגה משמאל לימין תוקנה.
- **Blinkist:** עמוד ה־learn החזיר 403. שפות Blinkist AI ומחירים רשמיים לא אומתו.
- **Swell ו־Podwise:** עמודי /pricing החזירו 404, והמחירים לקוחים מדפי הבית.
- **Vizard:** מחירי התוכניות בתשלום מוצגים כתמונה ולא נקראו. מספר שפות התמלול בפועל לא ידוע.
- **Castmagic:** הסתירה בין 60+, 70+ ו־5 שפות לא הוכרעה. לא נמצא אם עברית נתמכת.
- **Heptabase:** הטענה שבדצמבר 2025 נוספו MCP ופעולות AI על כרטיסים הגיעה ממקור צד שלישי ולא אומתה ב־changelog. מחיר Media Extended v4 לא נמצא.
- לא נעשו בדיקות מעשיות על סרטון עברי בכלים האלה. כל המסקנות על עברית נשענות על תיעוד, ולא על מדידה.
- תקציב החיפוש המשותף נגמר אחרי כ־45 חיפושים של סוכן זה. Product Hunt, ‏TAAFT, ‏AlternativeTo ו־Toolify נחסמו (403) בחלק מהעמודים, ולכן חלק מהביקורות לא נאספו (Reddit לא נבדק).

## א2. מה משותף לכלים, אילו דפוסים התגבשו ב־2025–2026, ומה עדיין חסר

### Takeaway
ב־2026 השוק התכנס לחמישה דפוסים: (1) סוכן עריכה או סוכן תוכן עם MCP; (2) בורר מודלים שכולל Claude; (3) עיגון לזמן, כלומר לחיצה על תובנה מקפיצה לרגע בסרטון; (4) "שאל את כל הספרייה" עם ציטוטים; (5) תמחור בקרדיטים או בדקות, שמייצר את רוב התלונות. מה שחסר עדיין: ניתוח חזותי שמכוון להבנה (שקפים, גרפים, קוד) ולא לוויראליות, ותמיכה אמיתית בעברית ובכיוון RTL.

### Cited Findings
- **MCP וסוכנים הפכו לסטנדרט ב־2026:** ל־Descript יש API ו־MCP, וחיפוש המדיה עובד גם דרך MCP (3/11/2026) — [Descript blog](https://www.descript.com/blog/article/descript-updates-oct-2026). ל־OpusClip יש שרת MCP עם 27 או 29 כלים (אוגוסט 2026) — [OpusClip llms.txt](https://www.opus.pro/llms.txt). ‏Castmagic × Claude מסומן "Live now" — [Castmagic](https://www.castmagic.io/). ‏Riverside MCP הושק ב־31/8/2026 ו־Riverside Agents ב־26/10/2026 — [Riverside updates](https://riverside.com/university/product-updates). ל־Podwise יש MCP, ‏CLI ו־Skills — [Podwise](https://podwise.ai/). ל־Readwise יש MCP ו־CLI — [Readwise Reader](https://readwise.io/read). ל־Heptabase יש "MCP & CLI" כבר בתוכנית Pro — [Heptabase pricing](https://heptabase.com/pricing)
- **בורר מודלים שכולל Claude:** ב־Descript אפשר לבחור Claude Fable 5 ‏(premium) ו־Claude Sonnet 5 (5/8/2026) — [Descript changelog](https://feedback.descript.com/changelog/release-round-upaugust-5th-2026). ב־Glasp אפשר לבחור ChatGPT, ‏Claude, ‏Gemini או Mistral — [Glasp](https://glasp.co/youtube-summary). ב־Heptabase Premium הסוכן עובד עם "GPT, Claude, Gemini" — [Heptabase pricing](https://heptabase.com/pricing). לעומתם, Ghostreader של Readwise מציע רק מודלים של OpenAI — [Readwise docs](https://docs.readwise.io/reader/docs/faqs/ghostreader)
- **עיגון לזמן כציפייה בסיסית:** ב־Glasp לחיצה על נקודת מפתח קופצת לרגע בסרטון — [Glasp](https://glasp.co/youtube-summary). ב־Heptabase כל תובנה "linking to the respective timestamps" — [Heptabase wiki](https://wiki.heptabase.com/pdf-annotation). ב־Podwise התשובות מצביעות על רגעים (02:14) — [Podwise](https://podwise.ai/). ב־Notion ציטוט בסיכום מקושר לשורת התמליל — [Notion Help](https://www.notion.com/help/ai-meeting-notes). ‏Castmagic מאפשר ל־Claude ‏"cite exact moments" — [Castmagic](https://www.castmagic.io/). ב־Readwise וב־Matter התמליל מסונכרן לזמן — [Readwise docs](https://docs.readwise.io/reader/docs/faqs/videos); [Matter](https://getmatter.com/)
- **תלות בכתוביות:** ב־Glasp התמליל זמין רק כשיש כתוביות YouTube — [Glasp](https://glasp.co/youtube-summary). ב־Readwise האפשרויות מוגבלות לכתוביות שקיימות בסרטון — [Readwise docs](https://docs.readwise.io/reader/docs/faqs/videos). ב־Heptabase בוחרים את רצועת הכתוביות אוטומטית, בלי בחירת שפה — [Heptabase support](https://support.heptabase.com/en/articles/11991474-how-do-i-use-a-video-with-the-heptabase-ai-agent). ‏Media Extended מסתמך על קובצי ‎.srt/.vtt — [GitHub media-extended](https://github.com/aidenlx/media-extended)
- **ניתוח חזותי — נדיר, ומכוון לגזירת קליפים או לחיפוש:** ‏OpusClip ClipAnything מנתח פריים־פריים, כולל טקסט על המסך — [OpusClip](https://www.opus.pro/clipanything). ל־Descript יש חיפוש ויזואלי "by what's on screen" ב־Enterprise בלבד — [Descript blog](https://www.descript.com/blog/article/descript-updates-oct-2026). ב־Heptabase ה־AI "doesn't read the raw video", ו־OCR קיים רק ל־PDF — [Heptabase support](https://support.heptabase.com/en/articles/11991474-how-do-i-use-a-video-with-the-heptabase-ai-agent); [Heptabase pricing](https://heptabase.com/pricing). ב־Media Extended v4, ‏OCR לצילומי מסך הוא פיצ'ר בתשלום (תקציר חיפוש) — [GitHub PKM-er](https://github.com/PKM-er/media-extended)
- **הוראות קבועות, "מיומנויות" וקול מותג:** ‏Descript Underlord Skills — [Descript blog](https://www.descript.com/blog/article/descript-updates-oct-2026). ‏Castmagic Brand voice — [Castmagic](https://www.castmagic.io/). ב־Snipd פרומפטים מותאמים — [Snipd](https://www.snipd.com/). ב־Glasp פרומפט מותאם — [Glasp](https://glasp.co/youtube-summary). ב־Readwise עריכת כל פרומפט — [Readwise docs](https://docs.readwise.io/reader/docs/faqs/ghostreader)
- **שכבת ביקורת והקשר:** תוסף Shortform מוסיף "background context and counter-arguments" לסיכום YouTube — [Chrome Web Store](https://chromewebstore.google.com/detail/shortform-summarize-anyth/anfegbjckcheemfbibglojdmjadgiepe). בקוד פתוח, fabric מושך תמליל YouTube (עם הדגל ‎-t‎ לזמנים) ומעביר אותו לתבנית extract_wisdom. יש לו אינטגרציה מובנית עם Anthropic, רישיון MIT ו־44.6K כוכבים — [GitHub fabric](https://github.com/danielmiessler/fabric)
- **תמחור בקרדיטים ודקות, ותלונות:** ב־Descript קרדיטי AI לחודש — [Descript pricing](https://www.descript.com/pricing). ב־Vizard ‏"1 credit = 1 minute of video" — [Vizard pricing](https://vizard.ai/pricing). ב־Snipd ‏900 דקות עיבוד — [Snipd pricing](https://www.snipd.com/pricing). ב־Mem שעות Voice Mode — [Mem pricing](https://get.mem.ai/pricing). התלונות על קרדיטים חוזרות ב־Descript, ב־OpusClip וב־Castmagic — [Trustpilot Descript](https://www.trustpilot.com/review/descript.com); [Trustpilot OpusClip](https://www.trustpilot.com/review/opus.pro); [Trustpilot Castmagic](https://www.trustpilot.com/review/castmagic.io)
- **פער עברית ו־RTL:** ‏Descript תומך רק באלפבית לטיני — [Descript Help](https://help.descript.com/script-editing/supported-transcription-languages.md). ‏OpusClip לא תומך ב־RTL — [OpusClip Help](https://help.opus.pro/docs/article/does-opusclip-support-languages-right-left.md). ב־Notion אין עברית — [Notion Help](https://www.notion.com/help/ai-meeting-notes). ב־Riverside התמליל מוצג משמאל לימין (תקציר חיפוש) — [Riverside support](https://support.riverside.com/hc/en-us/articles/10446154802589)

### Inferences
- **הזדמנות מבנית:** נכון ל־9/11/2026 אף אחד מ־21 הכלים לא מציע יחד את שלושת אלה: (א) הבנת תוכן חזותי (שקפים, גרפים, קוד) לצורך סינתזה, (ב) זמנים מדויקים ברמת מילה שאפשר ללחוץ עליהם, (ג) עברית מלאה עם RTL נכון. השילוב הזה הוא בידול ברור ללשונית "ניתוח וידאו".
- **מה מצופה כבסיס (כבר commodity):** סיכום עם זמנים, פרקים, ציטוטים, שאלות על הסרטון, ייצוא Markdown ו־Notion. מה מבדל: ביקורת וטיעוני נגד, "התמונה הגדולה", עקרונות, וציטוט של שקף לצד המשפט שנאמר.
- **תמחור:** תלונות על קרדיטים שנשרפים בלי תוצאה חוזרות אצל שלושה ספקים. מחיר צפוי לכל ניתוח, שמוצג לפני ההרצה, יכול להיות יתרון אמון.
- **מילון מונחים:** הכלים שהשיקו מילון שמות ומונחים (Riverside, ספטמבר 2026) מצביעים על כאב אמיתי. בעברית הכאב גדול יותר (שמות, ראשי תיבות, מונחים באנגלית).
- **MCP:** רוב המתחרים חשפו את הספרייה לסוכנים חיצוניים. זה כיוון אפשרי לשלב מאוחר, לא הכרחי בגל הראשון.

### Gaps
- הדפוסים מבוססים על עמודי שיווק ותיעוד. לא נמדדו איכות הסיכום, דיוק הזמנים או איכות ה־OCR בפועל.
- לא נמצאו נתוני שימוש או נטישה לפי פיצ'ר (למשל כמה משתמשים מקליקים על זמנים), ולכן "מה מצופה" הוא הסקה.

## ב1. מי באמת תומך בעברית — קלט שמע עברי ופלט עברי (מפת ראיות, נכון ל־9/11/2026)

### Takeaway
"תמיכה בעברית" ברוב הכלים היא שורה ברשימת 100+ שפות, ולא תמיכה מוכחת. רק מעטים מתעדים טיפול ייעודי בעברית: RTL נכון, כתיב בלי ניקוד, ומעברים בין עברית לאנגלית. אלה Speak AI, ‏Sonix ו־Soniox, וכן ivrit.ai כתשתית פתוחה. שני כלים ארגוניים מתעדים עברית במפורש: Kaltura (‏VOD ASR, אבל "Mixed-language audio isn't supported") ו־Gong ("Hebrew (Israel)"). שלושה כלים מרכזיים סוגרים את הדלת: Descript, ‏OpusClip ו־Notion. ב־Transkriptor יש סתירה: דפי השיווק בעברית, אבל רשימת השפות באפליקציה לא כוללת עברית. NotebookLM השתפר מ"לא עובד בעברית" (סוף 2024) ל"תומך בעברית" במדריך משרד החינוך (דצמבר 2025).

### Cited Findings

| כלי | קלט שמע עברי | פלט עברי ו־RTL | חוזק הראיה ותאריך | מקור |
|---|---|---|---|---|
| Kaltura VOD ASR | כן — עברית ברשימת זיהוי השפה האוטומטי. "Detects one main language per video", ‏"Mixed-language audio isn't supported" | כתוביות | תיעוד רשמי, עודכן 10/11/2025 | [Kaltura ASR](https://knowledge.kaltura.com/help/kaltura-asr-services-overview) |
| Gong | כן — "Hebrew (Israel)" ברשימה (70+ שפות). חלק מהפיצ'רים באנגלית בלבד (תוויות מייל, red flags, משימות מומלצות) | — | תיעוד רשמי, עודכן 8/11/2026 | [Gong Help](https://help.gong.io/docs/what-languages-are-supported-in-gong.md) |
| Sonix | כן | "Transcripts for Arabic, Hebrew, Persian and Urdu come back in their native right-to-left scripts" | תיעוד רשמי, נבדק 9/11/2026 | [Sonix languages](https://sonix.ai/languages) |
| Speak AI | כן, כולל מעברים בין עברית לאנגלית וכתיב בלי ניקוד (לפי הספק). כמה מנועי תמלול לבחירה | RTL "מעוצבים כראוי". צ'אט AI "מופעל על ידי Claude, Gemini ו GPT" | דף שיווק בעברית, נבדק 9/11/2026 | [Speak AI עברית](https://speakai.co/he/%D7%90%D7%99%D7%9A-%D7%9C%D7%AA%D7%9E%D7%9C%D7%9C-%D7%A2%D7%91%D7%A8%D7%99%D7%AA/) |
| Soniox App | כן — "Handles Hebrew across varieties like Israeli Hebrew and Mizrahi Hebrew" | סיכומי הרצאות "with key points, decisions, and action items" | דף שיווק, נבדק 9/11/2026 | [Soniox App](https://soniox.com/soniox-app/for/university-students-lecture-summaries-in-hebrew) |
| ivrit.ai | מודלי Whisper מכוונים לעברית, מאגר של 22,000+ שעות (יולי 2025), ושירות תמלול חינמי | שמירה ל־Google Drive של המשתמש | אתר הפרויקט ו־Hugging Face, נבדקו 9/11/2026 | [ivrit.ai](https://www.ivrit.ai/); [Hugging Face](https://huggingface.co/ivrit-ai); [transcribe.ivrit.ai](https://transcribe.ivrit.ai/) |
| SpeechText.AI | כן, כולל עברית→אנגלית בצעד אחד | ייצוא Word, ‏PDF ו־SRT | דף ספק עם טבלת דיוק שהספק עצמו פרסם (ראו למטה) | [SpeechText.AI](https://speechtext.ai/hebrew-transcription) |
| Happy Scribe | כן ("up to 98% accurate", לא ברור אם זה נמדד בעברית) | SRT. ‏RTL לא מוזכר | דף שיווק, נבדק 9/11/2026 | [Happy Scribe](https://www.happyscribe.com/transcribe-hebrew) |
| TurboScribe | כן (מבוסס Whisper). בחינם 3 תמלולים של 30 דקות ביום. $10 לחודש בחיוב שנתי | — | תקציר חיפוש (העמוד החזיר 403) | [TurboScribe](https://turboscribe.ai/he/transcription/Hebrew) |
| tl;dv | כן — עברית ברשימת "100+ languages" | סיכומי פגישות | דף הבית, נבדק 9/11/2026 | [tl;dv](https://tldv.io/) |
| Grain | כן, אבל בדרגה שנייה: "Over 100 additional languages including Arabic, Hebrew, and Thai". הדיוק הגבוה וזיהוי הדוברים שמורים לשפות הראשיות | — | דף הבית, נבדק 9/11/2026 | [Grain](https://grain.com/) |
| Klap | כן — עברית ברשימת "99+ languages" | כתוביות לקליפים (RTL לא מוזכר) | דף הבית, נבדק 9/11/2026 | [Klap](https://klap.app/) |
| Submagic | עברית ברשימת מחולל הכתוביות | כתוביות | דף הבית, נבדק 9/11/2026 | [Submagic](https://www.submagic.co/) |
| VEED | מחולל כתוביות בעברית. SRT ו־VTT בתוכניות פרימיום | ממשק בעברית ("עברית (ישראל)") | תקציר חיפוש ודף הבית | [VEED Hebrew subtitles](https://www.veed.io/tools/auto-subtitle-generator-online/hebrew-subtitles); [VEED](https://www.veed.io/) |
| AudioPen | עברית ברשימת השפות | — | דף הבית, נבדק 9/11/2026 | [AudioPen](https://audiopen.ai/) |
| "תמלול אודיו" (Skylab Software) | עברית כשפה ראשית ועוד 46 שפות. מודלים על המכשיר, עובד בלי רשת | "Improve with AI": תקציר נקודות ופרוטוקול (גרסה 5.0) | App Store ישראל, נבדק 9/11/2026 | [App Store](https://apps.apple.com/il/app/%D7%AA%D7%9E%D7%9C%D7%95%D7%9C-%D7%90%D7%95%D7%93%D7%99%D7%95-%D7%94%D7%9E%D7%A8%D7%AA-%D7%90%D7%95%D7%93%D7%99%D7%95-%D7%9C%D7%98%D7%A7%D7%A1%D7%98/id1503180824?l=he) |
| Katav | עברית נוספה בגרסה 1.9.0 ‏(26/10) | סיכומים, כרטיסיות ומבחנים | App Store, נבדק 9/11/2026 | [App Store Katav](https://apps.apple.com/ca/app/katav/id6772588945) |
| Riverside | רק באפליקציה, ו־"transcriptions will display as left-to-right" | תצוגה שגויה | תקציר חיפוש של מרכז העזרה | [Riverside support](https://support.riverside.com/hc/en-us/articles/10446154802589) |
| NotebookLM | 12/2024: "האם זה עובד גם בעברית... התשובה היא לא". ‏1/2025: "הפלטפורמה מקרטעת" ו־"אין כל אפשרות ליצור פודקאסט בשפתנו". ‏12/2025: "המערכת תומכת בעברית"; סרטוני YouTube "הוא מתמלל ומנתח אותם" | בחירת שפת פלט (מאפריל 2025) | עיתונות, מדריך רשמי של משרד החינוך ובלוג של Google | [ynet](https://www.ynet.co.il/digital/technews/article/rymfs00n1g); [מעריב](https://www.maariv.co.il/economy/tech/article-1162115); [מדריך משרד החינוך](https://meyda.education.gov.il/files/Pop/0files/lemida-metukshevet/tools/NotebookLM-guide.pdf); [Google blog](https://blog.google/technology/google-labs/notebooklm-audio-overviews-50-languages/) |
| WhatsApp (מובנה) | תמלול הודעות קוליות בעברית, על המכשיר, מ־27/12/2024. באנדרואיד הראיות סותרות | — | עיתונות 2024–2026 | [מעריב](https://www.maariv.co.il/economy/tech/article-1159590); [mako 10/2026](https://www.mako.co.il/nexter-news/Article-f03b229f8cb01a1027.htm) |
| Transkriptor | דף בעברית לסיכום YouTube ("100+ languages", ‏"up to 99%"), ואינטגרציה עם Claude ועם ChatGPT | TXT ו־SRT, נקודות עם זמנים | **סתירה**: ב־App Store ישראל רשימת 33 שפות התמלול לא כוללת עברית | [Transkriptor עברית](https://transkriptor.com/he/%D7%A1%D7%99%D7%9B%D7%95%D7%9D-%D7%95%D7%99%D7%93%D7%90%D7%95-%D7%91%D7%99%D7%95%D7%98%D7%99%D7%95%D7%91/); [App Store](https://apps.apple.com/il/app/%D7%AA%D7%9E%D7%9C%D7%95%D7%9C-%D7%93%D7%99%D7%91%D7%95%D7%A8-%D7%9C%D7%98%D7%A7%D7%A1%D7%98/id1610386353?l=he) |
| Descript | **לא** — "Every supported language is written in the Latin alphabet" | — | תיעוד רשמי | [Descript Help](https://help.descript.com/script-editing/supported-transcription-languages.md) |
| OpusClip | **לא** — "do not support any languages that read right to left, including Hebrew" | — | תיעוד רשמי | [OpusClip Help](https://help.opus.pro/docs/article/does-opusclip-support-languages-right-left.md) |
| Notion AI Meeting Notes | **לא** — 16 שפות בלי עברית | — | תיעוד רשמי | [Notion Help](https://www.notion.com/help/ai-meeting-notes) |
| Castmagic | לא מוזכר. ה־API: en, ‏de, ‏es, ‏fr, ‏hi | — | סותר (60+ / 70+) | [Castmagic API docs](https://docs.castmagic.io/reference/supported-languages) |
| Rev | לא מוזכר. Free באנגלית בלבד, Pro ‏"37+" | — | עמוד מחירים, נבדק 9/11/2026 | [Rev pricing](https://www.rev.com/pricing) |
| Fireflies | לא מוזכר בפוסט מ־31/8/2026 (מוזכרים "100+" ו־95% דיוק לשפות שאינן אנגלית) | — | בלוג רשמי | [Fireflies blog](https://fireflies.ai/blog/fireflies-multi-language-transcription) |
| Notta, ‏Fathom, ‏Maestra, ‏Coconote, ‏Mindgrasp | לא מוזכר (Maestra ‏"125+", Coconote ‏"100+", Mindgrasp ‏"20+") | — | עמודים רשמיים, נבדקו 9/11/2026 | [Notta](https://www.notta.ai/en/pricing); [Fathom](https://www.fathom.ai/pricing); [Maestra](https://maestra.ai/pricing); [Coconote](https://coconote.app/); [Mindgrasp](https://www.mindgrasp.ai/) |
| Snipd, ‏Podwise, ‏Vizard | לא מוזכר | — | עמודים רשמיים | [Snipd](https://www.snipd.com/); [Podwise](https://podwise.ai/); [Vizard pricing](https://vizard.ai/pricing) |
| Glasp, ‏Readwise, ‏Heptabase | תלוי בכתוביות YouTube. ב־Heptabase אי אפשר לבחור שפת כתוביות | — | תיעוד רשמי | [Glasp](https://glasp.co/youtube-summary); [Readwise](https://docs.readwise.io/reader/docs/faqs/videos); [Heptabase](https://support.heptabase.com/en/articles/11991474-how-do-i-use-a-video-with-the-heptabase-ai-agent) |

- **מדד דיוק לעברית שפרסם ספק (לא מדידה עצמאית):** SpeechText.AI מציג טבלת "Accuracy (Hebrew)" תחת הכותרת "Interspeech 2026 benchmark", על הסטים ivrit/eval-d1 ו־SASpeech: ‏SpeechText.AI ‏92.7–95.6%, ‏Amazon Transcribe ‏89.2–91.7%, ‏Whisper ‏86–90.6%, ‏Azure ‏84.2–86.5%, ‏ElevenLabs ‏84.8%, ‏Google Cloud ‏78.8–81.1%, ‏AssemblyAI ‏65–76%. באותו עמוד מופיעה גם הטענה "up to 99%", שגבוהה מהטבלה עצמה — [SpeechText.AI](https://speechtext.ai/hebrew-transcription). על לוח התוצאות הציבורי לתמלול עברית ("Hebrew Transcription Leaderboard") ראו גם מחקר 04 — [ivrit.ai HF](https://huggingface.co/ivrit-ai)
- **אנשים מדווחים על עברית בפועל (פורום, 5–8/9/2026):** NotebookLM "עובד מדהים ויחסית מדויק!" על סרטון YouTube, כשהוא מושך מהתרגום האוטומטי לעברית. פלט שמע בעברית "עובד בצורה סבירה למדי". סיכום מאנגלית לעברית מדויק בכ־95%, אבל שמות ומונחים פחות שכיחים יוצאים לא תקניים — [הסולידית](https://www.hasolidit.com/kehila/threads/%D7%A6%D7%99%D7%95%D7%9F-%D7%9C%D7%A9%D7%91%D7%97-%D7%A4%D7%99%D7%A6%D7%A8-%D7%9E%D7%A1%D7%95%D7%99%D7%9D-%D7%91-notebook-lm.37018/)

### Inferences
- **"תמיכה" לא שווה "איכות".** רק שלושה ספקים מסחריים מתעדים בעיות ספציפיות לעברית: RTL, כתיב בלי ניקוד ומעברי שפה. מי שיציג את שלושתן היטב, עם הוכחה (מדידה על סט עברי ציבורי), יבלוט.
- **מעברי שפה הם נקודת כשל מתועדת.** ‏Kaltura כותבת במפורש שאודיו מעורב לא נתמך. בהרצאות ובפגישות עסקיות בישראל יש הרבה אנגלית בתוך עברית, ולכן טיפול מוצהר במעברים כאלה (מונחים באנגלית בתוך משפט עברי) הוא בידול.
- **פלט עברי נכון חשוב לא פחות מהתמלול.** הכשל של Riverside (תמלול נכון שמוצג משמאל לימין) מראה שגם ספק גדול נכשל בשכבת התצוגה. ממשק RTL מלא, כולל זמנים ומספרים בתוך טקסט עברי, הוא דרישת סף.
- **ivrit.ai הוא תשתית פתוחה, לא מתחרה.** המודלים והשירות החינמי מורידים את רף הכניסה לתמלול עברי. הבידול צריך להיות בשכבת הניתוח (תמונה ותמליל יחד, סינתזה, זמנים לחיצים), ולא בתמלול עצמו.

### Gaps
- לא נמצא תיעוד רשמי של Verbit, ‏Fireflies, ‏Rev, ‏Notta, ‏Maestra, ‏Coconote, ‏Mindgrasp, ‏Snipd או Podwise שמאשר או שולל עברית. לא נבדקו Zoom AI Companion, ‏Google Meet ו־Microsoft Teams/Copilot: עמודי השפות של Microsoft 365 Copilot החזירו 404 בשתי כתובות, ותקציב החיפוש נגמר.
- תקציר חיפוש טען שמאמר המונחים של Kaltura REACH מציג עברית בכתוביות מכונה ב־"70-80 percent accuracy", אבל העמוד המקורי לא זוהה. גם מצב העברית בכתוביות חיות ב־Kaltura לא אומת.
- דף התמלול בעברית של TurboScribe ועמוד המחירים שלו החזירו 403, והנתונים לקוחים מתקציר חיפוש בלבד.
- אין מדידה עצמאית של איכות עברית לאף כלי בקטע הזה. טבלת SpeechText.AI היא פרסום של ספק, והדיוק במדד אינו WER.

## ב2. מי השחקנים הישראליים — חברות, סטארטאפים, אדטק ומוסדות — ומה האוניברסיטאות עושות עם הקלטות ההרצאות?

### Takeaway
בישראל יש שחקני תשתית חזקים, וכולם מוכרים לארגונים ולמוסדות. Verbit מתמללת ומכתבת. ל־Kaltura יש מאז יולי 2025 עוזר (Genie) שקורא שקפים ולוחות ב־OCR, ובנובמבר 2025 היא רכשה את eSelf. Gong מנתחת שיחות מכירה וגם בעברית. Annoto מוסיפה לסרטוני קורס שכבה אינטראקטיבית, ובה כתוביות, פרקים וסיכומים. **אף אחד מהם לא מוכר למשתמש היחיד — סטודנט או איש עסקים דובר עברית — ניתוח עמוק של סרטון ארוך כלשהו, משמע ומהמסך, עם זמנים לחיצים.**
המערכת האקדמית מאיצה את השימוש ב־AI בתשפ"ו:
- למיט"ל יש הסכם עם Google.
- המיזם Academy-Tech, בחסות Microsoft, מכניס לפיילוטים סטארטאפים שהופכים הרצאות לחומרי למידה (YedaLabs, ‏Xarcam ועוד).
- קמפוס IL והאוניברסיטה הפתוחה בונים כלים משלהם (Pexor, ‏brAIny).

האוניברסיטאות הגדולות מקליטות הרצאות ל־Panopto. הקלטה שלא צפו בה כמה חודשים עד שנה עוברת לארכיון ובסוף נמחקת.

### Cited Findings

#### Verbit
- ב־2024 תוארה Verbit כ־"Israeli company Verbit". היא נוסדה בתל אביב ב־2017 והגיעה לשווי של 2 מיליארד דולר. לפי הכתבה היא משרתת יותר מ־2,000 עסקים ומתמללת כ־4 מיליון שעות בשנה ב־51 שפות. באותה עת השיקה את Legal Real-Time — [israel21c, ‏27/6/2024](https://archive.israel21c.org/new-ai-app-aims-to-replace-traditional-court-reporters/)
- **האתר היום (נבדק 9/11/2026):**
  - כתובת המטה בניו יורק.
  - קווי מוצר: Captivate, ‏Legal Visor, ‏Legal Capture, ‏Campus Complete (ממוצב לעמידה ב־ADA Title II), ‏Verbit Dub, ‏Captivate Post, ‏Enterprise Capture, ‏Venue Live ו־AI Audio Description.
  - סיכומי AI וחיפוש, ותרגום ל־"50+ languages".
  - האתר מציג את החברה כ־"Home of" ‏VITAC ו־AST.
  - עברית לא מוזכרת בדף הבית.
  — [Verbit](https://verbit.ai/)
- ב־8/2023 השיק "סטארטאפ תמלול" שנוסד ב־2017, עם משרדים בגבעתיים ובניו יורק, סיכומי הרצאות ב־GenAI להשכלה גבוהה. זה כנראה Verbit, אבל לא אומת: העמוד החזיר 503, והפרטים מתקציר חיפוש — [NoCamels](https://nocamels.com/2023/08/transcription-startup-unveils-new-generative-ai-tool-for-higher-ed/)
- פוסט של Verbit מ־3/2026 על תמלול בבתי משפט מתאר מודל היברידי של AI ומתמללים אנושיים (תקציר חיפוש) — [Verbit blog](https://verbit.ai/resource/insights-from-iaca-dubai-learnings-on-court-transcription/)

#### Kaltura (וחברת eSelf שנרכשה)
- **רקע:** Kaltura נוסדה בישראל. ב־2022 קיבלה הצעת מיזוג מ־Panopto לפי שווי של 383 מיליון דולר (תקציר חיפוש) — [Calcalist Tech](https://calcalistech.com/tags/Kaltura). כותרת דף הבית היום: "Agentic Video & AI Avatar Platform" (נבדק 9/11/2026) — [Kaltura](https://corp.kaltura.com/)
- **Genie — יומן השחרורים** — [Kaltura Genie](https://knowledge.kaltura.com/help/genie):
  - **יולי 2025:** קריאת טקסט מהמסך. ציטוט: "Genie now leverages OCR (Optical Character Recognition) technology to extract text from videos", ‏"particularly helpful for videos featuring speakers with presentation slides, classroom recordings showing whiteboards". כדי לקבל את נתוני ה־OCR צריך משימת REACH.
  - **אוגוסט 2025:** התשובות ניתנות בשפת השאלה.
  - **14/6/2026:** שיתוף מסך בשיחה עם אווטאר.
  - **6/7/2026:** ‏Agentic Avatars מציגים קטעי וידאו ו־"formatted text slides generated in real time" זה לצד זה.
- **רכישת eSelf** — [ynetnews](https://www.ynetnews.com/business/article/bkihyygl11l):
  - נחתמה ב־5/11/2025. סך העסקה כ־27 מיליון דולר: ‏7.5 מיליון מראש, עד 12.5 מיליון לאורך שלוש שנים, ועוד 4,690,025 מניות (כ־3%).
  - eSelf נוסדה ב־2023. האווטארים שלה תומכים ב־30+ שפות ומסוגלים "hear, speak, and visually analyze user screens in real time". הם ישולבו ב־"Genies" של Kaltura.
  - ההשלמה נצפתה לרבעון הרביעי של 2025 (תקציר חיפוש) — [Pulse 2.0](https://pulse2.com/kaltura-to-acquire-eself-ai-in-27-million-deal-to-expand-ai-virtual-agent-capabilities)
- **eSelf ומט"ח (22/4/2025):** יוזמה לאומית של מורים פרטיים מבוססי AI לכיתות א'–י"ב, בליווי Harvard. הפיילוט מתחיל בהוראת עברית. ציטוטים: "giving every K–12 student access to a private AI tutor"; ‏"the first time any country has attempted to implement AI tutoring at a national scale" — [Calcalist Tech](https://www.calcalistech.com/ctechnews/article/r1tkoce1gg)
- **עברית בכתוביות:** דף האינטגרציה של Kaltura עם Verbit מונה עברית בכתוביות מכונה, עם הערה ש־"some languages are not out of box" (תקציר חיפוש) — [Kaltura Knowledge Center](https://knowledge.kaltura.com/help/verbit-translations). מצב העברית במנוע ה־ASR של Kaltura מפורט ב־ב1.

#### Gong
- עברית ("Hebrew (Israel)") נתמכת, אבל חלק מהיכולות באנגלית בלבד. הפירוט ב־ב1 — [Gong Help](https://help.gong.io/docs/what-languages-are-supported-in-gong.md)

#### Annoto
- **ממפגש "AI Coffee break" של מיט"ל, 20/5/2025** — [מיט"ל](https://meital.iucc.ac.il/wp-content/uploads/2025/05/AI-Coffee-break.pdf):
  - שכבה אינטראקטיבית על וידאו קיים, שמתחברת בלי פיתוח (plug-and-play) ל־Moodle ול־Canvas.
  - דיונים מתויגי־זמן, שאלונים בתוך הסרטון שמקושרים לציון, נקודות רפלקציה, ומטלות וידאו עם משוב מתויג־זמן.
  - יכולות AI: יצירה אוטומטית של שאלונים ונקודות רפלקציה, חיפוש בשפה טבעית וניתוח התקדמות.
  - הנגשה: "כתוביות אוטומטיות, פרקים וסיכומים לווידאו".
- דף הבית: "video learning design platform that turns course video into active learning" — [Annoto](https://www.annoto.net/)
- נוסדה ב־2015. המדריכים חלוקים על המטה: תל אביב או פתח תקווה — [Startupim](https://slimpages.startupim.com/company_page/annoto); [StartupHub.ai](https://www.startuphub.ai/startups/annoto)
- פועלת גם כתוסף לנגן של Kaltura (תקציר חיפוש) — [Kaltura Knowledge Center](https://knowledge.kaltura.com/help/introduction-to-annoto)

#### מיט"ל — דוח תשפ"ו (2025–2026)
המקור לכל הסעיפים כאן: [דוח מיט"ל 2026](https://meitalconf.iucc.ac.il/wp-content/uploads/2026/07/Meital_conf_2026.pdf)
- "שנת תשפ"ו התאפיינה בהאצה משמעותית של תהליכי השילוב של בינה מלאכותית במערכת ההשכלה".
- **סל הטכנולוגיות** התרחב ל־monday.com בשילוב Make ולמערכת Explorance.
- **הסכם Google:** מיט"ל, בהובלת מחב"א, מקדמת הסכם עם Google שיאפשר למוסדות החברים לאמץ את Google Workspace for Education ואת יכולות הבינה המלאכותית של Google.
- **Academy-Tech, בחסות Microsoft:** קול קורא לסטארטאפים, אירוע חשיפה, ובחירת חברות לפיילוטים מלווים במוסדות. החברות שנבחרו:
  - **אהרון הינשוף:** בניית קורסים, חומרי לימוד ומבחנים, הנגשה רב־לשונית ומעקב אחר התקדמות.
  - **YedaLabs:** "פלטפורמה המשלבת סוכני AI המבוססים על חומרי הקורס לצד נגן וידאו אינטראקטיבי והנגשה אוטומטית", עם אינטגרציה מלאה ל־Moodle.
  - **Katie:** סוכני הוראה אישיים עם דיאלוג ומשוב בזמן אמת, ושילוב ב־LMS.
  - **בטא ידע:** "מסעות למידה" מחומרי הקורס, ב־Moodle, עם סנכרון ציונים.
  - **Xarcam:** "פלטפורמת בינה מלאכותית ההופכת הרצאות, מצגות וסרטונים קיימים לחוויית למידה מותאמת אישית". המערכת מייצרת אוטומטית חומרים, תרגולים והערכות, ומציגה לוח בקרה למרצה.
- **מפגשים מקצועיים:**
  - מפגש Moodle שבו הציגו OpenApp, ‏אהרון הינשוף, ‏Devlion, ‏Tipli, ‏Originality ו־Annoto.
  - מפגש Zoom של Naotech.
  - מפגש Turnitin על יושרה אקדמית.
  - פיתוח משותף עם MindCET של סוכן לתרגול דיבור באנגלית.

#### קמפוס IL
המקור לכל הסעיפים כאן: הרצאה בכנס מיט"ל 2024, קמפוס IL עם AWS — [מצגת מיט"ל 2024](https://meitalconf.iucc.ac.il/wp-content/uploads/2024/08/Meitalconf24_idan_nabati.pdf); [קמפוס IL](https://campus.gov.il/)
- **היקף:** "¼Million Active Students", ‏"600+ courses by 80+ partners", ‏"13 millions video watches last year sum to 93+ playback years".
- **Pexor:** "Gen AI Based module that analyze course videos combined with student profile & performance and come up with personalized AI generated exercises". הצנרת: שמע → זיהוי דיבור → שאלות בחמש רמות.
- **יעדים:** חיסכון של 30% בעלויות הכנת קורס ועלייה של 40% במעורבות. האקתון AWS התקיים ב־10/6/2024.

#### האוניברסיטה הפתוחה
המקור: מצגת "המהפכה החכמה מגיעה לסמארט אופל" (לא מתוארכת) — [האוניברסיטה הפתוחה](https://www.openu.ac.il/Lists/MediaServer_Documents/amir%20vinner.pdf)
- **עקרון "אדישות למודל השפה":** "האפשרות לעשות שימוש מקביל במספר מודלי שפה LLM".
- **"נבחרת brAIny"**, ארבע פרסונות:
  - **SPOK:** לסטודנטים. "מכיר את כל תכני הקורס", עונה ומתרגל.
  - **BEE:** ניהול זמנים ועומסים.
  - **SPARK:** לסגל. סיעור מוחות וגישה לאינטרנט.
  - **Q:** לסגל. כתיבת מבחנים, משוב על מטלות ואנליטיקות למידה.

#### האוניברסיטאות — הקלטות הרצאות בפועל
- **הטכניון** — [Technion Promoteach](https://promoteach.technion.ac.il/en/panopto/):
  - Panopto משמש ל־"managing lectures, tutorials and labs". המערכת מקליטה בסנכרון את המרצה, את המסך ואת המצגת, והקלטות Zoom נשמרות אליה אוטומטית.
  - מדיניות שמירה מאוקטובר 2021: הקלטה שלא נצפתה 12 חודשים עוברת לארכיון. אחרי 12 חודשים נוספים היא עוברת לסל המחזור ל־90 יום, ואז נמחקת.
  - בעמוד אין אזכור של כתוביות או AI.
- **אוניברסיטת תל אביב** (תקצירי חיפוש) — [TAU Engineering](https://engineering.tau.ac.il/sites/engineering.tau.ac.il/files/media_server/Engineering/Site_Faculty/Guidelines_staff/File%20sharing%20in%20Panopto.pdf); [TAU virtual training](https://virtualtraining-en.sites.tau.ac.il/panopto-recordings):
  - תיקיות Panopto לפי קורס, ורכיב Panopto בתוך Moodle.
  - הקלטה שלא נצפתה חצי שנה עוברת לארכיון.
  - הקלטות Zoom מועברות מ־My Folder.
- **האוניברסיטה העברית** (תקצירי חיפוש) — [HUJI](https://en.huca.huji.ac.il/book/export/html/1083178):
  - הקלטות ענן של Zoom הועברו ל־Panopto (עד 15/7/2021).
  - הקלטה שלא נצפתה שנה נמחקת.
  - מדריך TLCE החזיר 503.
- **מכון ויצמן:** עמוד "The Panopto System" (כותרת בלבד) — [Weizmann WIT](https://www.weizmann.ac.il/WIT/node/1758). ‏Panopto מתארת את עצמה כ־"video knowledge platform for training, onboarding and lecture capture" — [Panopto](https://www.panopto.com/)
- **בר־אילן:** השיקה עוזר הוראה מבוסס AI שעונה בעברית (תקציר חיפוש; העמוד החזיר 410) — [JPost](https://www.jpost.com/brandblend/opening-the-academic-year-bar-ilan-university-launches-ai-based-teaching-assistant-825140)
- **המכללה האקדמית תל אביב־יפו:** פרויקט סטודנטים בשם "Accessible Academic":
  - תמלול עברי עם "synchronized word-level timestamps".
  - "structured bulleted summaries" שמפיק LLM, וכרטיסיות.
  - המאגר ב־GitHub החזיר 404.
  — [MTA projects](https://www.projects.mta.ac.il/projects/accessible-academic)

#### עוד שחקנים ישראליים או רלוונטיים
- **ivrit.ai** (תשתית פתוחה; פירוט הדיוק ב־ב1) — [ivrit.ai](https://www.ivrit.ai/); [Hugging Face](https://huggingface.co/ivrit-ai):
  - **אפשרות בוואטסאפ:** אפשר לשלוח הודעות קוליות ל"אליעזר" לתמלול. מהעמוד לא ברור אם זה בוט או איש קשר.
  - **מרחבים ב־Hugging Face:** ‏"Hebrew Transcription Leaderboard" (עודכן לפני 26 יום, כלומר באמצע אוקטובר 2026), ‏"TTS Arena Hebrew", ‏"Hebrew Handwriting OCR Leaderboard" (4/9) ותצוגה של מאגר מליאות הכנסת.
  - **מודלים:**
    - ‏whisper-large-v3-turbo-ct2 ‏(27/10/2025)
    - ‏whisper-large-v3 ‏(22/5/2025)
    - ‏turbo-onnx ‏(20/12/2025)
    - ‏zipformer2-66m-streaming-he לזמן אמת על המכשיר (אמצע אוקטובר 2026)
    - מודל להפרדת דוברים מבוסס pyannote
- **Deepdub:** דיבוב AI עם קולות בעברית, "5,000+ titles". המוצא הישראלי של החברה לא אומת בסבב הזה — [Deepdub](https://deepdub.ai/)
- **D-ID:** וידאו מחולל עם מגיש AI, ואינטגרציה ל־Moodle (תקציר חיפוש). המוצא הישראלי של החברה לא אומת בסבב הזה — [D-ID](https://www.d-id.com/); [D-ID Moodle](https://www.d-id.com/?p=8926)
- **WSC Sports:** תוכן ספורט מותאם אישית ב־AI. המוצא הישראלי של החברה לא אומת בסבב הזה — [WSC Sports](https://wsc-sports.com/)
- **Tachles:** סטארטאפ מגבעתיים שנוסד ב־2021 ומפתח מסכם טקסט (תקציר חיפוש) — [Startupim](https://slimpages.startupim.com/min_company_page/tachles1)
- **Katav:** אפליקציית סטודנטים שמקליטה הרצאות ומפיקה תמליל, סיכומים, כרטיסיות ומבחנים. העברית נוספה בגרסה 1.9.0 ‏(26/10).
  - מחירים: PRO ‏$9.99 לחודש או $39.99 לשנה, MAX ‏$12.99 לחודש או $59.99 לשנה.
  - דירוג 4.8 מארבעה מדרגים. ארץ המפתח לא מצוינת.
  — [App Store](https://apps.apple.com/ca/app/katav/id6772588945)

### Inferences
- **השחקנים הגדולים בישראל מוכרים למוסדות, לא ליחיד.** ‏Verbit, ‏Kaltura, ‏Gong ו־Panopto באוניברסיטאות פונים לארגונים. אין מוצר ישראלי ישיר לסטודנט או לאיש עסקים שמנתח סרטון ארוך כלשהו לעומק. לכן פיצ'ר Video Analysis בסטודיו לא מתחרה ראש בראש בענקיות. הוא מתחרה בכלים הכלליים החינמיים (ראו ב3).
- **היכולת הקרובה ביותר ל"שקפים ותמליל יחד" באקדמיה הישראלית היא ה־OCR של Kaltura Genie.** אבל היא קשורה לרישוי מוסדי (משימת REACH). גם מנוע ה־ASR של Kaltura לא תומך באודיו מעורב (ב1). ובמוסדות שעובדים עם Panopto (הטכניון, ת"א, העברית) לא נמצא תיעוד של יכולת חזותית דומה לסטודנט.
- **הקלטות נעלמות.** מדיניות ארכיון ומחיקה של 6 עד 12 חודשים מעניקה ערך מתמשך לתוצר אישי: סיכום עם זמנים ותמונות שקפים שנשאר אצל הסטודנט. מנגד, זכויות היוצרים בהרצאה ותנאי המוסד מחייבים זהירות. ראו מחקר 07, ובפורום (ב3) עלה החשש ממדיניות הקורס.
- **הסכם Google של מיט"ל יחזק את הכלי החינמי של Google כברירת מחדל מוסדית.** לכן הבידול צריך להיות במה שהכלי הזה לא עושה: קריאת המסך, זמנים מדויקים ברמת מילה, דיוק עברי ו־RTL, וסינתזה וביקורת.
- **סטארטאפי Academy-Tech מוכרים למרצים ולמוסדות.** הם ערוץ או שותף אפשרי יותר מאשר מתחרים. Xarcam ‏("הרצאות, מצגות וסרטונים קיימים" → למידה מותאמת) הוא הקרוב ביותר בפונקציה. Pexor של קמפוס IL עובד משמע בלבד. בשניהם לא מתועד ניתוח חזותי.
- **המגמה של רכישת eSelf היא אווטארים שרואים מסך.** היא מראה שהשחקנים המוסדיים מתקדמים לכיוון "וידאו שמבין את המסך". חלון ההזדמנות ליחיד דובר עברית קיים עכשיו, אבל הוא לא אינסופי.

### Gaps
- **מוצא ותיעוד שלא אומתו:**
  - המוצא הישראלי של Gong, ‏Deepdub, ‏D-ID ו־WSC Sports לא אומת במקור ראשוני בסבב הזה.
  - לא נמצא תיעוד שמאשר עברית ב־Verbit.
  - לא נמצא חוזה של Verbit עם בתי המשפט או עם הכנסת.
- **סטארטאפים בלי נוכחות ברשת:** ל־YedaLabs, ‏Xarcam, ‏Katie ובטא ידע לא נמצאה נוכחות ברשת. החיפושים לא העלו דבר, ותקציב החיפוש נגמר. מצב הפיילוטים לא ידוע.
- **מוסדות שלא נבדקו או לא נגישים:**
  - לא נבדקו אוניברסיטת בן־גוריון (החיפוש לא העלה דבר), אוניברסיטת חיפה, אוניברסיטת אריאל והמכללות.
  - עמוד TLCE של העברית החזיר 503, ועמוד בר־אילן החזיר 410.
- **חברות שלא נבדקו:**
  - Hour One ו־AudioCodes Meeting Insights: הראשון לא ענה, והשני החזיר 404.
  - Peech: ‏www.peech-ai.com לא נפתר (ENOTFOUND). כדי לבדוק אותו צריך לאשר את הדומיין בהגדרות הרשת של הסשן.
- **אין נתוני שוק:** לא נמצאו נתונים על היקף הקלטות ההרצאות בעברית או על נתחי שוק של Panopto ו־Kaltura בישראל.

## ב3. איך דוברי עברית פותרים היום את "אין לי זמן לצפות" — ומה הם מספרים על זה?

### Takeaway
בפועל, הפתרון העברי של 2025–2026 הוא כלי כללי וחינמי: מחברת ה־AI של Google, ‏NotebookLM, שנקראת מ־16/7/2026 ‏Gemini Notebook. משרד החינוך פרסם עליה מדריך בדצמבר 2025, ובפורום ישראלי בספטמבר 2026 שיבחו אותה ("עובד מדהים ויחסית מדויק!"). בהודעות קוליות הפתרון הוא תמלול מובנה בוואטסאפ: באייפון מדצמבר 2024, באנדרואיד הוא מפגר. לצדו יש בוטים קהילתיים: "אמנון המתמלל" מ־2022 ו־Ramble, קוד פתוח מאוקטובר 2026. ספקים זרים מחזיקים דפי נחיתה בעברית לסטודנטים ולסיכום YouTube.
**התלונה החוזרת של המשתמשים היא בדיוק הפער שלנו:** הסיכום מפספס את מה שעל המסך — שקפים, נוסחאות, גרפים, וטקסט שכתוב בשקף ולא נאמר בקול.
לא נמצאו ראיות על קבוצות לשיתוף סיכומים או על שוק הוובינרים בעברית: המקורות הרלוונטיים חסומים.

### Cited Findings

#### המחברת של Google (NotebookLM ← Gemini Notebook) — ציר זמן עברי
- **12/2024 ו־6/1/2025:** עדיין לא עובד בעברית. מעריב כתב "הפלטפורמה מקרטעת" ו־"אין כל אפשרות ליצור פודקאסט בשפתנו", ובכל זאת הדגיש שסטודנטים מקבלים "תשובות עם הפניות מדויקות". הפירוט ב־ב1 — [מעריב, 6/1/2025](https://www.maariv.co.il/economy/tech/article-1162115)
- **29/4/2025:** סקירות האודיו נפתחו ב־"more than 50 languages", עם הגדרה לבחירת שפת הפלט — [Google Blog](https://blog.google/technology/google-labs/notebooklm-audio-overviews-50-languages/)
- **12/2025 — מדריך רשמי של משרד החינוך:**
  - "המערכת תומכת בעברית ובשפות רבות נוספות. ניתן לבקש תשובות בעברית גם אם המקור באנגלית".
  - על סרטוני YouTube: "(הוא מתמלל ומנתח אותם)".
  - "עד 50 קבצים למחברת", ואינטגרציה עם Google Classroom.
  — [מדריך NotebookLM, משרד החינוך](https://meyda.education.gov.il/files/Pop/0files/lemida-metukshevet/tools/NotebookLM-guide.pdf). לצדו פורסם דף עבודה לתלמידים שבו מכינים פודקאסט — [משרד החינוך](https://meyda.education.gov.il/files/Pop/0files/lemida-metukshevet/AI/Summer-Podcast-M.pdf)
- **16/7/2026:** השם שונה ל־Gemini Notebook. לפי הערת מחקר 11 — [Google Blog](https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/)
- **מגבלות לפי Scrimba (11/8/2026):** ‏50 מקורות במחברת, עד 500,000 מילים או 200MB למקור. העלאות מ־72 השעות האחרונות לא תמיד נקלטות. עוזר כללי שמדביקים לו תמליל "no clickable timestamps" — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/)
- **פורום "הסולידית", 5–8/9/2026 — שרשור "ציון לשבח פיצ'ר מסוים ב־Notebook LM"** — [הסולידית](https://www.hasolidit.com/kehila/threads/%D7%A6%D7%99%D7%95%D7%9F-%D7%9C%D7%A9%D7%91%D7%97-%D7%A4%D7%99%D7%A6%D7%A8-%D7%9E%D7%A1%D7%95%D7%99%D7%9D-%D7%91-notebook-lm.37018/):
  - **הדרך:** מדביקים קישור YouTube, והכלי מושך את המידע מהתרגום האוטומטי לעברית. ציטוט: "עובד מדהים ויחסית מדויק!".
  - **פורמטים:** הסיכום ניתן להתאמה: קצר או ארוך, שאלות ותשובות, מילות מפתח, תרשים זרימה.
  - **שימושים:** הפעיל אותו על קורס שלם, והוא עוזר למי ש"סרטון של רבע שעה" מעייף אותו. אחרים מסכמים פוליסות ביטוח, סיכומים רפואיים, חוזי נדל"ן וספרי השקעות. אחד מציע לפתוח צ'אט Gemini על בסיס המחברת.
  - **הפער:** משתתף אחד מציין שהסיכומים מפספסים תוכן חזותי — שקפים, נוסחאות וגרפים — ודברים שכתובים בשקף ולא נאמרים בקול.
  - **קורסים בתשלום:** אם הקורס מתיר להוריד את השמע או את הווידאו, אפשר להעלות את הקובץ. אבל קודם בודקים את מדיניות הקורס.
  - **פרטיות:** שאלה אם Google רואה את החומר קיבלה תשובות סותרות. מישהו טען שהמודלים מתאמנים על הנתונים. מישהו אחר אמר שזה תלוי בסוג החשבון (Workspace שונה), והודה שזה "מהזיכרון".

#### וואטסאפ — התמלול המובנה והבוטים
- **21/7/2022 — "אמנון המתמלל":** בוט וואטסאפ שבנה מהנדס ב־Wix. מעבירים אליו הודעה קולית, והוא מחזיר תמליל. "אמנון יודע לתמלל היום 60 שניות בלבד, ורק בעברית".
  - דמי ה־API של וואטסאפ הגיעו לכ־200 דולר ביום אחד.
  - המפתח דחה הצעות שותפות כדי לשמור על פרטיות המשתמשים, וביקש תרומות.
  — [כלכליסט](https://www.calcalist.co.il/calcalistech/article/hyva5ol2q)
- **20/3/2024 — התמלול המובנה בדרך:** "עברית לא תהיה בין השפות הראשונות". רוב הבוטים הקיימים גובים תשלום, ויש בוט שמפיק "סיכום שיחה" מקובץ שמע. התמלול המובנה דורש הורדה של כ־150MB, רץ במכשיר, והתמלולים "מוצפנים מקצה לקצה" — [mako](https://www.mako.co.il/nexter-news/Article-9abba29a77b5e81026.htm)
- **27/12/2024 — עברית נפתחה:** תמלול הודעות קוליות בעברית ש־"מתבצע במכשיר עצמו ולא בענן". ההגדרה נקראת "תמלילים של הודעות קוליות". הדיוק טוב "ברוב המקרים", ובחלק ממכשירי האנדרואיד העדכון עוד לא הגיע — [מעריב](https://www.maariv.co.il/economy/tech/article-1159590)
- **אנדרואיד:** "בחדרי חרדים" כותב שבאייפון עברית נתמכת החל מ־iOS 17, ובאנדרואיד אי אפשר לבחור עברית (תקציר חיפוש) — [בחדרי חרדים](https://www.bhol.co.il/news/1738773)
- **5/10/2026 — Ramble:** כלי בקוד פתוח של מפתח ישראלי. הוא מתמלל כל הודעה קולית ומציג את הטקסט בתוך השיחה. מתחברים אליו בסריקת QR.
  - לפי הכתבה, ההקלטות והתמלולים לא נשמרים.
  - נבנה עם Claude Code ו־Codex.
  - חינם בינתיים, עד 30 דקות ביום.
  - הכתבה מציינת שהתמלול של וואטסאפ עצמה זמין בעברית למשתמשי Apple בלבד, ולא באנדרואיד.
  — [mako](https://www.mako.co.il/nexter-news/Article-f03b229f8cb01a1027.htm)
- **ivrit.ai:** מציע גם שליחת הודעות קוליות בוואטסאפ לתמלול (ב2) — [ivrit.ai](https://www.ivrit.ai/)

#### טלגרם
- לא נמצא בוט טלגרם עברי לסיכום סרטונים. נמצאו רק תבניות n8n כלליות: ‏YouTube → סיכום ב־Gemini → טלגרם, ובוט טלגרם רב־משתמשים עם GPT-4o — [GrowwStacks](https://www.growwstacks.com/workflows/youtube-to-telegram-summary-bot-with-decodo-and-gemini-ai); [GrowwStacks](https://growwstacks.com/workflows/multi-user-telegram-bot-to-summarize-and-repurpose-youtube-videos-with-gpt-4o)

#### אפליקציות ודפי נחיתה בעברית
- **Transkriptor (App Store ישראל):**
  - ממשק בעברית, אבל עברית לא ברשימת 33 שפות התמלול. מבקר אחד כתב "Great for Hebrew", וזו עדות אנקדוטלית בלבד.
  - 90 דקות חינם. מסלולים בין ‏₪34.90 ל־‏₪399.90.
  - דירוג 4.5 מ־233 מדרגים. הגרסה הקודמת, 2.1.11, מתוארכת 20/12/2025.
  — [App Store](https://apps.apple.com/il/app/%D7%AA%D7%9E%D7%9C%D7%95%D7%9C-%D7%93%D7%99%D7%91%D7%95%D7%A8-%D7%9C%D7%98%D7%A7%D7%A1%D7%98/id1610386353?l=he)
- **"תמלול אודיו" (Skylab Software):** עברית כשפה ראשית ועוד 46 שפות, ומודלים שרצים במכשיר. הגרסה 5.0 מוסיפה "Improve with AI": נקודות ופרוטוקול. רכישות של ‏₪29.90 ו־‏₪249.90. אין מספיק דירוגים בישראל — [App Store](https://apps.apple.com/il/app/%D7%AA%D7%9E%D7%9C%D7%95%D7%9C-%D7%90%D7%95%D7%93%D7%99%D7%95-%D7%94%D7%9E%D7%A8%D7%AA-%D7%90%D7%95%D7%93%D7%99%D7%95-%D7%9C%D7%98%D7%A7%D7%A1%D7%98/id1503180824?l=he)
- **דפי נחיתה בעברית של ספקים זרים** (תקצירי חיפוש, נבדקו כקישורים ב־9/11/2026):
  - **Speak AI:** דף "סיכום יוטיוב של AI" — [Speak AI](https://speakai.co/he/%D7%A1%D7%99%D7%9B%D7%95%D7%9D-%D7%99%D7%95%D7%98%D7%99%D7%95%D7%91-%D7%A9%D7%9C-ai/)
  - **Sozai:** דף "סיכומי הרצאות" — [Sozai](https://sozai.app/he/lecture-notes/). מדריך שלו להרצאות רפואה מזהיר שתמליל AI הוא טיוטה, ושמות תרופות שנשמעים דומה נכשלים — [Sozai](https://sozai.app/he/transcribe-medical-lectures-dictation/)
  - **Sider:** מסכם YouTube עם "רגעי מפתח" — [Sider](https://sider.ai/he/extensions/chatgpt-youtube-summarizer)
  - **MindMap AI:** מסכם וידאו למפת חשיבה — [MindMap AI](https://mindmapai.app/he/video-summarizer)
  - **TurboScribe:** דף "תמלול הרצאות וסמינרים" — [TurboScribe](https://turboscribe.ai/he/u/transcribe-lectures-and-seminars-to-text)
  - **Google Workspace Marketplace:** תוספי תמלול בממשק עברי — [Workspace Marketplace](https://workspace.google.com/marketplace/app/transcription_literoi_puhe_tekstiksi/869047623675?hl=iw)
  - **Soniox:** דף סיכומי הרצאות בעברית לסטודנטים (ב1) — [Soniox](https://soniox.com/soniox-app/for/university-students-lecture-summaries-in-hebrew)

#### תרבות שיתוף הסיכומים
- **Studocu:** מחזיק גרסה בכתובת ‎/il/ עם "Ask AI", ‏"AI Notes" ו־"AI Quiz". העמוד לא מציג מוסדות ישראליים או מספרים, ולכן זו ראיה חלשה בלבד לנוכחות בישראל — [Studocu IL](https://www.studocu.com/il)

### Inferences
- **רף התחרות הוא "חינם וטוב מספיק".** ‏Gemini Notebook, ‏וואטסאפ והתרגום האוטומטי של YouTube מכסים את רוב הצורך הבסיסי. מה שהם לא נותנים, לפי הראיות:
  - קריאת המסך — הפער עלה במפורש בפורום.
  - זמנים לחיצים — Scrimba כותב שאין כאלה בעוזר כללי.
  - עברית שאינה תרגום־של־תרגום: בפורום הסיכום נשען על התרגום האוטומטי של YouTube.
  - סינתזה עמוקה עם ביקורת.
  זה בדיוק תחום הבידול של לשונית הניתוח.
- **המשתמשים כבר מורגלים לזרימה:** מדביקים קישור או מעלים קובץ, בוחרים פורמט (קצר, ארוך, שאלות ותשובות, מילות מפתח, תרשים), שואלים שאלות המשך ומקבלים סקירת שמע. משרד החינוך וההסכם המוסדי של מיט"ל (ב2) מעמיקים את ההרגל. מה שמשתמש עברי מצפה לו כבר מהיום הראשון: בחירת פורמט, שיחת המשך על הסרטון וסקירה קולית בעברית.
- **פרטיות היא נקודת חשש מוצהרת.** היא עלתה בפורום וגם בסיפורי הבוטים. Ramble מדגיש "לא נשמר", ואמנון דחה שותפויות. עיבוד בשרת שלנו עם מדיניות שמירה ברורה, בלי אימון על תוכן המשתמש, הוא יתרון שאפשר לתקשר.
- **וואטסאפ הוא ערוץ ההפצה הישראלי לקול.** בוטים בוואטסאפ נתקלים בעלויות API ובשאלות פרטיות. כניסה דרך "שיתוף" מהטלפון (Share אל הסטודיו) יכולה להוריד חיכוך בלי בוט. צריך לבדוק אותה מול אפליקציות האנדרואיד הקיימות.
- **חשש מזכויות בתוכן קורס בתשלום עלה מיוזמת המשתמשים.** תנאי שימוש שמטילים את האחריות על המשתמש, ועיבוד פרטי כברירת מחדל, הם דרישת סף (מחקר 07).

### Gaps
- **אין נתון כמותי:** לא נמצאו סקרים על שיעור הסטודנטים או אנשי העסקים בישראל שמשתמשים במסכמי AI.
- **מקורות קהילתיים חסומים:** פייסבוק, Reddit וערוצי טלגרם לא נגישים. לכן אין ראיות על קבוצות לשיתוף סיכומים (Drive, פייסבוק, וואטסאפ) או על שוק סיכומים בתשלום.
- **שוק הוובינרים בעברית לא נחקר:** פלטפורמות ישראליות, היקף והרגלי צפייה לא נבדקו, כי תקציב החיפוש נגמר.
- **Ramble:** הפרטים מהכתבה בלבד. המאגר שלו לא נבדק, ולא ידוע באיזה מנוע תמלול הוא משתמש.
- **התמלול של וואטסאפ באנדרואיד:** הראיות סותרות. מעריב (12/2024) כותב שהעדכון "עוד לא הגיע". ‏mako (10/2026) ובחדרי חרדים כותבים שאין עברית באנדרואיד. לא נבדק במכשיר.
