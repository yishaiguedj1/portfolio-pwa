# מודלים שמצורפים לעובד

| קובץ | מה | מקור | רישיון | sha256 |
|---|---|---|---|---|
| `face_detection_yunet_2023mar.onnx` | זיהוי פנים (YuNet) — מסגור אוטומטי לדובר בהפקה מחדש (סבב 9, `translator/frame.py`) | [OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | MIT (`LICENSE-yunet`) | `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4` |
| `voxceleb_resnet34_LM.onnx` (לא בריפו — 26MB; בתמונה ב־`/opt/speaker`) | טביעת קול לזיהוי דוברים (`translator/vt/diarize.py`) | [WeSpeaker ResNet34-LM](https://huggingface.co/Wespeaker/wespeaker-voxceleb-resnet34-LM), גרסה `f0c48c2` | CC-BY-4.0 (WeSpeaker, ‏Wang et al. 2023) | `7bb2f06e9df17cdf1ef14ee8a15ab08ed28e8d0ef5054ee135741560df2ec068` |

- רץ ב־onnxruntime (כבר בתמונת השרת ובסביבת ה־Routine דרך onnx-asr) — בלי OpenCV.
- `frame.py` בודק את ה־sha256 לפני הטעינה; קובץ אחר = בלי מסגור אוטומטי (המיקום הקבוע מהעריכה).
- שדרוג מודל = לעדכן כאן, את `MODEL_SHA256` ב־frame.py, ולהריץ את `translator/tests/test_frame.py`.
- `diarize.py` בודק גם הוא את ה־sha256; שדרוג = כאן, ‏`MODEL_SHA256` ב־diarize.py, ה־revision וה־sha256 ב־`infra/worker/Dockerfile`, ולהריץ את `translator/tests/test_diarize.py`.
