# מודלים שמצורפים לעובד

| קובץ | מה | מקור | רישיון | sha256 |
|---|---|---|---|---|
| `face_detection_yunet_2023mar.onnx` | זיהוי פנים (YuNet) — מסגור אוטומטי לדובר בהפקה מחדש (סבב 9, `translator/frame.py`) | [OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | MIT (`LICENSE-yunet`) | `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4` |
| `voxceleb_resnet34_LM.onnx` (לא בריפו — 26MB; בתמונה ב־`/opt/speaker`) | טביעת קול לזיהוי דוברים (`translator/vt/diarize.py`) | [WeSpeaker ResNet34-LM](https://huggingface.co/Wespeaker/wespeaker-voxceleb-resnet34-LM), גרסה `f0c48c2` | CC-BY-4.0 (WeSpeaker, ‏Wang et al. 2023) | `7bb2f06e9df17cdf1ef14ee8a15ab08ed28e8d0ef5054ee135741560df2ec068` |
| DictaBERT tiny joint (לא בריפו — 181MB; בתמונה ב־`/opt/linebreak`) | ניתוח תחבירי עברי לשבירת כתוביות לשתי שורות (`translator/vt/linebreak.py`) | המשקולות: [dicta-il/dictabert-tiny-joint](https://huggingface.co/dicta-il/dictabert-tiny-joint) גרסה `708026b`; הקוד (`BertFor*.py`): [dicta-il/dictabert-joint](https://huggingface.co/dicta-il/dictabert-joint) גרסה `7b1256f` | CC-BY-4.0 (DICTA, ‏Shmidman et al.) | `model.safetensors`: `577997e9eded405f391d77db60072c0d1bcf37354865aacfdb514297288c6f90` (וכל הקבצים — ב־Dockerfile) |
| PP-OCRv3 det + rec (לא בריפו — 13MB; בתמונה ב־`/opt/burnin`) | טקסט שכבר על המסך (פס של ערוץ, שם הדובר, מונחים) — הכתוביות מורמות מעליו (`translator/vt/burnin.py`) | [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) דרך הגלגל `rapidocr_onnxruntime==1.2.3` ב־PyPI (‏sha256 של הגלגל ב־Dockerfile) | Apache-2.0 | det: `3439588c030faea393a54515f51e983d8e155b19a2e8aba7891934c1cf0de526` · rec: `897a3ededb38fee0dae2c1ccee38241f37df202c9509e3abca02e9217c5ee615` |

- רץ ב־onnxruntime (כבר בתמונת השרת ובסביבת ה־Routine דרך onnx-asr) — בלי OpenCV.
- `frame.py` בודק את ה־sha256 לפני הטעינה; קובץ אחר = בלי מסגור אוטומטי (המיקום הקבוע מהעריכה).
- שדרוג מודל = לעדכן כאן, את `MODEL_SHA256` ב־frame.py, ולהריץ את `translator/tests/test_frame.py`.
- `diarize.py` בודק גם הוא את ה־sha256; שדרוג = כאן, ‏`MODEL_SHA256` ב־diarize.py, ה־revision וה־sha256 ב־`infra/worker/Dockerfile`, ולהריץ את `translator/tests/test_diarize.py`.
- `linebreak.py` טוען את המודל רק כשהוא קיים; בלי המודל (הטלפון, Routine) — הכללים של `hebrew.py`. שדרוג = ה־revision וה־sha256 של כל הקבצים ב־`infra/worker/Dockerfile`, ולמדוד שוב מול תיוג השבירות (ניתוח האיכות, 25/10/2026: לא קביל 14.7% → 6.2%).
- `burnin.py` בודק את ה־sha256 של שני הקבצים; בלי המודלים (Routine, הטלפון) — הכתוביות במקומן הרגיל. שדרוג = הגלגל וה־sha256 ב־`infra/worker/Dockerfile`, ‏`SHA256` ב־burnin.py, ולהריץ את `translator/tests/test_burnin.py` עם `SNB_BURN_DIR` שמצביע על המודלים.
