# מודלים שמצורפים לעובד

| קובץ | מה | מקור | רישיון | sha256 |
|---|---|---|---|---|
| `face_detection_yunet_2023mar.onnx` | זיהוי פנים (YuNet) — מסגור אוטומטי לדובר בהפקה מחדש (סבב 9, `translator/frame.py`) | [OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | MIT (`LICENSE-yunet`) | `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4` |

- רץ ב־onnxruntime (כבר בתמונת השרת ובסביבת ה־Routine דרך onnx-asr) — בלי OpenCV.
- `frame.py` בודק את ה־sha256 לפני הטעינה; קובץ אחר = בלי מסגור אוטומטי (המיקום הקבוע מהעריכה).
- שדרוג מודל = לעדכן כאן, את `MODEL_SHA256` ב־frame.py, ולהריץ את `translator/tests/test_frame.py`.
