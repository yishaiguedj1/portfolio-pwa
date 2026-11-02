# הקופסה של העובד בשרת (מצב "API של המערכת"): vt + מנועי התמלול + ffmpeg + הסוכן שמושך עבודות.
# נבנית ב־GitHub Actions (.github/workflows/worker-image.yml) ונשמרת ב־GHCR. השרת מריץ רק תמונה שקודמה לתג prod.
#
# אבטחה — לפי הספר:
#   • תמונת בסיס נעולה ב־digest (לא "latest" שמשתנה מתחת לרגליים). עדכון = שינוי מכוון כאן (Dependabot יציע).
#   • כל ספריית Python נעולה בגרסה וב־hash (requirements.lock, ‏pip --require-hashes) — חבילה מזויפת לא תותקן.
#     רק גלגלים מוכנים; חריג יחיד: sox (שאין לו גלגל — נבנה מהמקור, גם הוא נבדק מול hash).
#   • ffmpeg (בנייה סטטית של BtbN, ענף 8.1 — אותה שבה כויל ה־CRF של vt) נבדק מול sha256 לפני שנפתח.
#   • רץ כמשתמש רגיל (uid 10001), בלי shell לכניסה; מערכת הקבצים לקריאה בלבד (compose.yaml), בלי הרשאות מיוחדות.
#   • בלי סודות בתמונה: המפתחות מגיעים ממשתני הסביבה של הקונטיינר בשרת בלבד.

ARG PY_IMAGE=python:3.12-slim-trixie@sha256:05cda9777409a9c3ffddd94a4c476b79f0769a0b4857f0c7ed9226b6800b0d6f

# ---------------------------------------------------------------- ffmpeg (מאומת)
FROM ${PY_IMAGE} AS ffmpeg
# שתי ארכיטקטורות (Intel/AMD ו־Arm — שרתי CAX של Hetzner): אותה גרסה, הקובץ לפי הארכיטקטורה שנבנית
ARG TARGETARCH
ARG FFMPEG_BASE=https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest
# חובה מבחוץ: ה־sha256 של כל קובץ (ה־workflow לוקח אותם מ־checksums.sha256 של אותה גרסה ורושם אותם בתווית התמונה)
ARG FFMPEG_SHA256_AMD64
ARG FFMPEG_SHA256_ARM64
RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) f=linux64; s="$FFMPEG_SHA256_AMD64" ;; \
      arm64) f=linuxarm64; s="$FFMPEG_SHA256_ARM64" ;; \
      *) echo "ארכיטקטורה לא נתמכת: $TARGETARCH"; exit 1 ;; \
    esac; \
    test -n "$s" || { echo 'חסר FFMPEG_SHA256'; exit 1; }; \
    apt-get update -qq && apt-get install -y -qq --no-install-recommends curl xz-utils ca-certificates >/dev/null; \
    curl -fsSL -o /tmp/ff.tar.xz "$FFMPEG_BASE-$f-gpl-8.1.tar.xz"; \
    echo "$s  /tmp/ff.tar.xz" | sha256sum -c -; \
    mkdir -p /tmp/ff /opt/ffmpeg && tar -C /tmp/ff -xf /tmp/ff.tar.xz; \
    cp /tmp/ff/*/bin/ffmpeg /tmp/ff/*/bin/ffprobe /opt/ffmpeg/; \
    /opt/ffmpeg/ffmpeg -hide_banner -buildconf | grep -q -- '--enable-libsvtav1'; \
    /opt/ffmpeg/ffmpeg -hide_banner -buildconf | grep -q -- '--enable-libass'

# ---------------------------------------------------------------- Deno (מאומת) — 22/10/2026: הורדה מקישור
# yt-dlp צריך מנוע JavaScript כדי לפתור את האתגרים של יוטיוב (EJS; בלעדיו — פורמטים חסרים). הבינארי הרשמי של Deno
# מ־GitHub (לא ההפצה ב־PyPI — היא של צד שלישי), בגרסה נעולה ומול ה־sha256 שה־workflow לוקח מקובץ ה־sha256sum של אותה גרסה.
FROM ${PY_IMAGE} AS deno
ARG TARGETARCH
ARG DENO_VERSION=2.6.4
ARG DENO_SHA256_AMD64
ARG DENO_SHA256_ARM64
RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) f=x86_64-unknown-linux-gnu; s="$DENO_SHA256_AMD64" ;; \
      arm64) f=aarch64-unknown-linux-gnu; s="$DENO_SHA256_ARM64" ;; \
      *) echo "ארכיטקטורה לא נתמכת: $TARGETARCH"; exit 1 ;; \
    esac; \
    test -n "$s" || { echo 'חסר DENO_SHA256'; exit 1; }; \
    apt-get update -qq && apt-get install -y -qq --no-install-recommends curl unzip ca-certificates >/dev/null; \
    curl -fsSL -o /tmp/deno.zip "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-$f.zip"; \
    echo "$s  /tmp/deno.zip" | sha256sum -c -; \
    mkdir -p /opt/deno && unzip -q /tmp/deno.zip -d /opt/deno && chmod 755 /opt/deno/deno; \
    /opt/deno/deno --version | grep -q "deno ${DENO_VERSION}"

# ---------------------------------------------------------------- PO token ליוטיוב (bgutil, מאומת) — 25/10/2026
# הסקריפט שמייצר PO token (bgutil-ytdlp-pot-provider, GPL-3.0) — בתגית ובקומיט נעולים, התלויות לפי deno.lock (--frozen).
# הפלאגין (requirements.lock) מריץ אותו ב־Deno רק כשיוטיוב מבקש token; בלי שרת שרץ כל הזמן (script-deno). רק לקישורי
# יוטיוב (fetchurl.py). בארכיטקטורה שאין לה גרסה מוכנה של canvas — בלי (התיקייה ריקה ו־fetchurl מדלג), לא נכשלים
FROM ${PY_IMAGE} AS bgutil
ARG TARGETARCH
ARG BGUTIL_TAG=2.0.2
ARG BGUTIL_COMMIT=26475e9d3665b972c4aeb83b4dbaafcf64b88438
COPY --from=deno /opt/deno /opt/deno
RUN set -eu; \
    apt-get update -qq && apt-get install -y -qq --no-install-recommends git ca-certificates >/dev/null; \
    git clone -q --depth 1 --branch "$BGUTIL_TAG" https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /tmp/b; \
    test "$(git -C /tmp/b rev-parse HEAD)" = "$BGUTIL_COMMIT"; \
    mkdir -p /opt/bgutil/server; \
    if (cd /tmp/b/server && DENO_DIR=/tmp/dd /opt/deno/deno install --allow-scripts=npm:canvas --frozen); then \
      cp -r /tmp/b/server/src /tmp/b/server/node_modules /tmp/b/server/deno.json /tmp/b/server/deno.lock /tmp/b/server/package.json /opt/bgutil/server/; \
      cp /tmp/b/LICENSE /opt/bgutil/; \
      test -f /opt/bgutil/server/src/generate_once.ts; \
    elif [ "$TARGETARCH" = arm64 ]; then echo 'bgutil: בלי PO token בארכיטקטורה הזו'; else exit 1; fi; \
    chmod -R a+rX /opt/bgutil

# ---------------------------------------------------------------- ספריות Python (נעולות)
FROM ${PY_IMAGE} AS deps
ARG TARGETARCH
# אותן גרסאות בשתי הארכיטקטורות; לכל אחת קובץ נעול משלה (ה־hash של הגלגלים שונה) — infra/README.md
COPY infra/worker/requirements.lock infra/worker/requirements-arm64.lock /tmp/
RUN set -eu; lock=/tmp/requirements.lock; [ "$TARGETARCH" = arm64 ] && lock=/tmp/requirements-arm64.lock; \
    python -m venv /opt/vt \
 && /opt/vt/bin/pip install --no-cache-dir -q --upgrade 'pip==25.*' \
 && /opt/vt/bin/pip install --no-cache-dir -q --require-hashes --only-binary=:all: --no-binary=sox \
        --extra-index-url https://download.pytorch.org/whl/cpu -r "$lock" \
 && /opt/vt/bin/python -c "import numpy, soundfile, onnx, onnx_asr, torch, torchaudio, qwen_asr, anthropic, PIL, fontTools, yt_dlp, yt_dlp_ejs, curl_cffi; print('ok')"

# ---------------------------------------------------------------- גרפי היישור (ONNX INT8, שלב 4.1)
# מהמודל הרשמי של Qwen בגרסה נעולה + sha256 של המשקולות (translator/aligner_export.py) — לא קבצים של צד שלישי.
# בתמונה ולא בזמן ריצה: השרת לא מייצא (זה ~6GB זיכרון רגעי), והגרסה של הגרפים = הגרסה של התמונה.
FROM deps AS aligner
COPY translator/aligner_export.py /tmp/aligner_export.py
RUN HF_HOME=/tmp/hf HF_HUB_DISABLE_TELEMETRY=1 /opt/vt/bin/python /tmp/aligner_export.py /opt/aligner \
 && rm -rf /tmp/hf

# ---------------------------------------------------------------- זיהוי דוברים (22/10/2026, translator/vt/diarize.py)
# WeSpeaker ResNet34-LM ‏(ONNX, ‏CC-BY-4.0) — מהריפו הרשמי בגרסה נעולה, נבדק מול sha256. בלי המודל: בלי דוברים, כמו קודם.
FROM deps AS speaker
RUN HF_HOME=/tmp/hf HF_HUB_DISABLE_TELEMETRY=1 /opt/vt/bin/python -c \
    "from huggingface_hub import hf_hub_download as d; d('Wespeaker/wespeaker-voxceleb-resnet34-LM', 'voxceleb_resnet34_LM.onnx', revision='f0c48c298fd835726c27956a5d617bad7115627e', local_dir='/opt/speaker')" \
 && echo "7bb2f06e9df17cdf1ef14ee8a15ab08ed28e8d0ef5054ee135741560df2ec068  /opt/speaker/voxceleb_resnet34_LM.onnx" | sha256sum -c - \
 && rm -rf /tmp/hf /opt/speaker/.cache

# ---------------------------------------------------------------- שבירת שורות (25/10/2026, translator/vt/linebreak.py)
# DictaBERT tiny joint (‏dicta-il, ‏CC-BY-4.0, ‏181MB): ניתוח תחבירי עברי — איפה לשבור כתובית לשתי שורות. המשקולות
# מ־dictabert-tiny-joint והקוד של המודל (BertFor*.py, בלי רשת ובלי subprocess) מ־dictabert-joint — שניהם בגרסה נעולה
# ונבדקים מול sha256. בלי המודל: הכללים של vt/hebrew.py, כמו קודם.
FROM deps AS linebreak
RUN HF_HOME=/tmp/hf HF_HUB_DISABLE_TELEMETRY=1 /opt/vt/bin/python -c \
    "from huggingface_hub import hf_hub_download as d; [d('dicta-il/dictabert-tiny-joint', f, revision='708026b7297ffde293f14a3a592f8cf649f12c38', local_dir='/opt/linebreak') for f in ('config.json', 'model.safetensors', 'special_tokens_map.json', 'tokenizer.json', 'tokenizer_config.json', 'vocab.txt')]; [d('dicta-il/dictabert-joint', f, revision='7b1256fc0846e22d1af431eae299e2dcecee2778', local_dir='/opt/linebreak') for f in ('BertForJointParsing.py', 'BertForMorphTagging.py', 'BertForPrefixMarking.py', 'BertForSyntaxParsing.py')]" \
 && cd /opt/linebreak && printf '%s\n' \
    "7fdddffe2722c800c111d201ed2b35c45ef9de1fcbfae6be700a1a58ea242bde  config.json" \
    "577997e9eded405f391d77db60072c0d1bcf37354865aacfdb514297288c6f90  model.safetensors" \
    "5d5b662e421ea9fac075174bb0688ee0d9431699900b90662acd44b2a350503a  special_tokens_map.json" \
    "00657b39a8a73b96ddcc3cda245c5e8fa02be36e31e318bd13a9169eb89c999b  tokenizer.json" \
    "53fde6fe26f7b0f5c9e9e6cdaa549888b35266fb08dc8a57b60e385d4f860eb7  tokenizer_config.json" \
    "0fb90bfa35244d26f0065d1fcd0b5becc3da3d44d616a7e2aacaf6320b9fa2d0  vocab.txt" \
    "adff43130f5ab6a3c6c580c507f206709d4a51028db1a8eff2bbd92bcf244daa  BertForJointParsing.py" \
    "f16fbd2a640194a07c3a52fd809000241746a19f491a7af6702f4eb86a2f7093  BertForMorphTagging.py" \
    "6fed41e6041d824b4b5ed3b26ccf32b41ceb9b4ddaf1e961375064a2d0ded1d4  BertForPrefixMarking.py" \
    "2aebe51bf2ca5f090e2e9347786a4b2c032517efd08ee379b5af790456fe2646  BertForSyntaxParsing.py" \
    | sha256sum -c - \
 && rm -rf /tmp/hf /opt/linebreak/.cache

# ---------------------------------------------------------------- קריוקי — הפרדת קול וליווי (26/10/2026, translator/karaoke.py)
# audio-separator 0.47.1 (MIT) לתוך /opt/sepdeps בלבד (requirements-karaoke.lock, --no-deps) — /opt/vt לא משתנה.
# המודלים (רק ברישיון פתוח — החלטת המשתמש), מהמקורות ש־audio-separator עצמו מוריד מהם, נבדקים מול sha256:
#   • "בלי שום קול": MelBand RoFormer של Kimberley Jensen ‏(MIT) — המוביל החינמי לקול/ליווי (SDR 17.3 ב־MVSEP)
#   • "עם קולות רקע": BS RoFormer karaoke של anvuew ‏(GPL-3.0) — הקול הראשי מול קולות הרקע
# נמדד בסקרץ' (4 ליבות, autocast): כ־3 דק׳ לדקת שיר ל־Kim, שיא זיכרון ~3GB. download_checks.json — רשימת נתונים בלבד.
FROM deps AS separator
COPY infra/worker/requirements-karaoke.lock /tmp/requirements-karaoke.lock
RUN /opt/vt/bin/pip install --no-cache-dir -q --require-hashes --no-deps --only-binary=:all: \
        --target /opt/sepdeps -r /tmp/requirements-karaoke.lock \
 && PYTHONPATH=/opt/sepdeps PYTEST_CURRENT_TEST=build /opt/vt/bin/python -c \
    "from audio_separator.separator import Separator as S; s = S(model_file_dir='/opt/separator', output_dir='/tmp/o'); [s.download_model_files(m) for m in ('vocals_mel_band_roformer.ckpt', 'bs_roformer_karaoke_anvuew.ckpt')]" \
 && cd /opt/separator && printf '%s\n' \
    '87201f4d31afb5bc79993230fc49446918425574db48c01c405e44f365c7559e  vocals_mel_band_roformer.ckpt' \
    'b958b29c8f7195f0d86bee6759a33980db675c4ecaf2fcaa80fa125828e6cd38  vocals_mel_band_roformer.yaml' \
    '206d04757cb5f75ca3b55f8a0a48f5c26aa2351d4ff3c7adbfc9affa30ea3ae4  bs_roformer_karaoke_anvuew.ckpt' \
    '5cb3f127ecbc6a8e37f31ea7e05f60f360a44da43e857bde805b7b68558f6338  config_bs_roformer_karaoke_anvuew.yaml' \
    | sha256sum -c - \
 && test -s download_checks.json && rm -rf /tmp/o

# ---------------------------------------------------------------- קריוקי בעברית — סנכרון המילים (31/10/2026, translator/vt/align_he.py)
# ivrit-ai/whisper-large-v3-turbo-ct2 ‏(Apache-2.0, ‏1.6GB) — תמלול לעוגנים + stable-ts align; imvladikon/wav2vec2-large-xlsr-53-hebrew
# ‏(Apache-2.0, ‏1.2GB) — CTC עברי בחלונות. שניהם בגרסה נעולה ונבדקים מול sha256. stable-ts-whisperless 2.19.1 ‏(MIT) מופץ רק
# כקוד מקור טהור (בלי שלב בנייה): ה־tar.gz נבדק מול sha256 ורק התיקייה stable_whisper נפתחת (filter='data') ל־/opt/karaoke-he/py.
# faster-whisper ו־ctranslate2 — ב־requirements-karaoke.lock (/opt/sepdeps). בלי המודלים: השרשרת האנגלית, כמו קודם.
FROM deps AS karaokehe
RUN HF_HOME=/tmp/hf HF_HUB_DISABLE_TELEMETRY=1 /opt/vt/bin/python -c \
    "from huggingface_hub import hf_hub_download as d; [d('ivrit-ai/whisper-large-v3-turbo-ct2', f, revision='72ad623a37947395efcc3933132353790e5a12f5', local_dir='/opt/karaoke-he/ivrit') for f in ('config.json', 'model.bin', 'preprocessor_config.json', 'tokenizer.json', 'vocabulary.json')]; [d('imvladikon/wav2vec2-large-xlsr-53-hebrew', f, revision='3dd308dda70b20507a6920b459052635973ae3cd', local_dir='/opt/karaoke-he/ctc') for f in ('added_tokens.json', 'config.json', 'model.safetensors', 'preprocessor_config.json', 'special_tokens_map.json', 'tokenizer_config.json', 'vocab.json')]" \
 && cd /opt/karaoke-he && printf '%s\n' \
    "c805eff43fc2a1d00d5cfa315e4b2230895f34994257c185959808a116e7c4f0  ivrit/config.json" \
    "db2a2265aa012c16c7db9edda3d699c99f984efdd3f2e22a72a8ce7e9720f3a2  ivrit/model.bin" \
    "654cf18d3e163b948ceaf9766da56ce0b52de265d58673cf61c9376f126bd499  ivrit/preprocessor_config.json" \
    "297b13372ac43916285644fb9687add3cc62ee2a1adb60da3dc25cc94c1871fd  ivrit/tokenizer.json" \
    "c69260f2ab26d659b7c398f9a2b2b48ed0df16c3b47d7326782fd9cba71690c1  ivrit/vocabulary.json" \
    "9673c4a07605742b38d4604c7932b9991007ad2ad72ea5e7fd45d4b72c06186c  ctc/added_tokens.json" \
    "91deb85f6bc8a7055b4036d51727d900e83f407891d0c1fe1f1d5eb6fd7844f7  ctc/config.json" \
    "ccb343830f577a24d1c7aa866a459ac93fbc00bd205abb1b90728cf1f767e0da  ctc/model.safetensors" \
    "c403ce09975b90dff0dd8302c42d422e9de1f166cd7772df23490069893cb0cf  ctc/preprocessor_config.json" \
    "bb7068de1150661a10b55f9e4b12a0e77af8bf91f5e45e1b58afaf1d0e17f675  ctc/special_tokens_map.json" \
    "768fe81239d56919fcb7d7bba11878a79c843e386719ebf38622257291a00569  ctc/tokenizer_config.json" \
    "9682dbaf1cca6f1354a33a3caeb03cab5d5ba8f5c5c4c5fe0ed53f3726e1bf62  ctc/vocab.json" \
    | sha256sum -c - \
 && /opt/vt/bin/python -c \
    "import hashlib, io, tarfile, urllib.request; u='https://files.pythonhosted.org/packages/94/c4/ae003984207b2de10b901549b0d593b71df41e484db8e4801335a53255ed/stable_ts_whisperless-2.19.1.tar.gz'; b=urllib.request.urlopen(u, timeout=120).read(); assert hashlib.sha256(b).hexdigest() == '5a9313dce19aab79fc08f9db89cee0e93ca14091da6e33d79dd507586990f605', 'stable-ts'; t=tarfile.open(fileobj=io.BytesIO(b)); p='stable_ts_whisperless-2.19.1/'; m=[x for x in t.getmembers() if x.name.startswith(p + 'stable_whisper/') and (x.isfile() or x.isdir())]; [setattr(x, 'name', x.name[len(p):]) for x in m]; t.extractall('/opt/karaoke-he/py', members=m, filter='data')" \
 && test -s /opt/karaoke-he/py/stable_whisper/alignment.py \
 && rm -rf /tmp/hf /opt/karaoke-he/ivrit/.cache /opt/karaoke-he/ctc/.cache

# ---------------------------------------------------------------- קטעים שאינם באנגלית (01/11/2026, translator/vt/lang.py — A12)
# Systran/faster-whisper-small ‏(MIT, ‏~480MB, ct2) — זיהוי שפה ותמלול של קטע בשפה אחרת; faster-whisper מ־/opt/sepdeps
FROM deps AS lid
RUN HF_HOME=/tmp/hf HF_HUB_DISABLE_TELEMETRY=1 /opt/vt/bin/python -c \
    "from huggingface_hub import hf_hub_download as d; [d('Systran/faster-whisper-small', f, revision='536b0662742c02347bc0e980a01041f333bce120', local_dir='/opt/lid/whisper-small') for f in ('config.json', 'model.bin', 'tokenizer.json', 'vocabulary.txt')]" \
 && cd /opt/lid && printf '%s\n' \
    "b55496ac7940a7ae47d2c01eab40edfd8701feec1229d9cce3b40014383fb828  whisper-small/config.json" \
    "3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671  whisper-small/model.bin" \
    "fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab  whisper-small/tokenizer.json" \
    "34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913  whisper-small/vocabulary.txt" \
    | sha256sum -c - \
 && rm -rf /tmp/hf /opt/lid/whisper-small/.cache

# ---------------------------------------------------------------- טקסט שעל המסך (25/10/2026, translator/vt/burnin.py)
# PP-OCRv3 det + rec (‏PaddleOCR, ‏Apache-2.0) מהגלגל הרשמי של rapidocr_onnxruntime 1.2.3 ב־PyPI — הגלגל והמודלים נבדקים
# מול sha256. det מזהה איפה יש טקסט בפסים העליון/התחתון, rec מאשר שזה טקסט — הכתוביות מורמות מעליו. בלי המודלים: כמו קודם.
FROM deps AS burnin
RUN /opt/vt/bin/python -c \
    "import hashlib, io, urllib.request, zipfile, os; u='https://files.pythonhosted.org/packages/b7/ef/0df9a58310895ab357f85df67935af6a8fb98f0965c7476cee6fcb966a7e/rapidocr_onnxruntime-1.2.3-py3-none-any.whl'; b=urllib.request.urlopen(u, timeout=120).read(); assert hashlib.sha256(b).hexdigest() == 'c707d3a6eb72d13119afe9602d3cc36d8b2a4a4d74e9575cf1b0e67ed6a27819', 'wheel'; z=zipfile.ZipFile(io.BytesIO(b)); os.makedirs('/opt/burnin', exist_ok=True); [open('/opt/burnin/' + f, 'wb').write(z.read('rapidocr_onnxruntime/models/' + f)) for f in ('ch_PP-OCRv3_det_infer.onnx', 'ch_PP-OCRv3_rec_infer.onnx')]" \
 && cd /opt/burnin && printf '%s\n' \
    "3439588c030faea393a54515f51e983d8e155b19a2e8aba7891934c1cf0de526  ch_PP-OCRv3_det_infer.onnx" \
    "897a3ededb38fee0dae2c1ccee38241f37df202c9509e3abca02e9217c5ee615  ch_PP-OCRv3_rec_infer.onnx" \
    | sha256sum -c -

# ---------------------------------------------------------------- התמונה הסופית
FROM ${PY_IMAGE}
# 24/10/2026: ARG שמשתנה בכל בנייה (הקומיט, ה־sha של ffmpeg) נכנס לסביבה של כל RUN אחריו ומבטל את המטמון שלו —
# לכן הם אחרי השכבות הכבדות (ראו למטה), כדי שבנייה חדשה תחלוק איתן שכבות ולא תתפוס עוד ~5GB בשרת.
# רק מה שצריך: תעודות CA ו־tini. בלי curl, בלי compilers, בלי shell נוסף.
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends ca-certificates tini >/dev/null \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 10001 --user-group --no-create-home --shell /usr/sbin/nologin snb \
 && mkdir -p /work /cache /state && chown snb:snb /work /cache /state && chmod 700 /work /cache /state
COPY --from=ffmpeg /opt/ffmpeg /opt/ffmpeg
COPY --from=deno /opt/deno /opt/deno
COPY --from=bgutil /opt/bgutil /opt/bgutil
COPY --from=deps /opt/vt /opt/vt
COPY --from=aligner /opt/aligner /opt/aligner
COPY --from=speaker /opt/speaker /opt/speaker
COPY --from=linebreak /opt/linebreak /opt/linebreak
COPY --from=burnin /opt/burnin /opt/burnin
COPY --from=separator /opt/sepdeps /opt/sepdeps
COPY --from=separator /opt/separator /opt/separator
COPY --from=karaokehe /opt/karaoke-he /opt/karaoke-he
COPY --from=lid /opt/lid /opt/lid
COPY --chown=root:root translator /app/translator
# 16/10/2026: הגדרת השרת לעדכון ידני בלי שרת חדש — נתונים בלבד, שום דבר לא מריץ אותם לבד (infra/worker/snb-host-apply)
COPY --chown=root:root infra/host/snb-common.sh infra/compose.yaml infra/host/snb-update /opt/snb-host/
COPY --chown=root:root --chmod=755 infra/worker/snb-host-apply /opt/snb-host/apply
RUN rm -rf /app/translator/tests /app/translator/research /app/translator/__pycache__ \
 && find /app /opt/aligner /opt/speaker -type d -exec chmod 755 {} + && find /app /opt/aligner /opt/speaker -type f -exec chmod 644 {} + \
 && find /opt/linebreak -type d -exec chmod 755 {} + && find /opt/linebreak -type f -exec chmod 644 {} + \
 && find /opt/burnin -type d -exec chmod 755 {} + && find /opt/burnin -type f -exec chmod 644 {} + \
 && find /opt/sepdeps /opt/separator /opt/karaoke-he /opt/lid -type d -exec chmod 755 {} + && find /opt/sepdeps /opt/separator /opt/karaoke-he /opt/lid -type f -exec chmod 644 {} + \
 && chmod 644 /opt/snb-host/snb-common.sh /opt/snb-host/compose.yaml /opt/snb-host/snb-update
# 20/10/2026: בדיקת עשן מול הספריות האמיתיות שבתמונה (הבדיקות ב־CI רצות בלי anthropic) — בניית הלקוח של Claude
# בלי רשת. anthropic 1.x עבר ל־httpx2 ודחה httpx.Timeout ב־TypeError: כל עבודה בשרת קרסה בקריאה הראשונה, והבנייה עברה
# 22/10/2026: הורדה מקישור — yt-dlp רואה את Deno (מנוע ה־JavaScript של יוטיוב) ואת ההתחזות לדפדפן, בלי רשת
RUN PATH=/opt/vt/bin:/opt/deno:$PATH /opt/vt/bin/python -c "import shutil, yt_dlp, curl_cffi; assert shutil.which('deno'), 'deno'; print(yt_dlp.version.__version__)"
# 25/10/2026: הפלאגין של ה־PO token נטען (ובאמד64 גם הסקריפט שלו קיים)
RUN /opt/vt/bin/python -c "import os, yt_dlp_plugins.extractor.getpot_bgutil_script as g; f = os.path.isfile('/opt/bgutil/server/src/generate_once.ts'); print('bgutil', f); assert f or os.uname().machine != 'x86_64'"
# 25/10/2026: מודל שבירת השורות נטען ומנתח משפט, בלי רשת (בלי זה ה־build נופל בשקט לכללים)
RUN cd /app/translator && HF_HUB_OFFLINE=1 /opt/vt/bin/python -c "from vt import linebreak as L; m = L.DepModel(); t = m.toks('הלכתי אתמול לבית הספר החדש'); assert t and len(t) >= 5, t; assert len(t[0]) == 7 and any(x[4] for x in t), ('בלי מורפולוגיה', t); print('linebreak', len(t))"
RUN cd /app/translator && /opt/vt/bin/python -c "from vt import burnin as B; import numpy as np; assert B.available(), 'burnin'; d = B.Detector(); print('burnin', len(d.frame(np.zeros((360, 640, 3), np.uint8), 0.0)))"
# 26/10/2026: קריוקי — הספרייה נטענת מ־/opt/sepdeps, ושני המודלים נמצאים (בלי רשת; diffq/onnx2torch לא נדרשים ל־RoFormer)
RUN cd /app/translator && /opt/vt/bin/python -c "import karaoke as K; assert K.sep_ready(), 'karaoke'; from audio_separator.separator import Separator; print('karaoke', K.SEP_DEFAULT, K.KAR_DEFAULT)"
# 31/10/2026: הסנכרון בעברית — שני המודלים, stable-ts (מ־/opt/karaoke-he/py), faster-whisper ו־ctranslate2 נטענים בלי רשת
RUN cd /app/translator && HF_HUB_OFFLINE=1 /opt/vt/bin/python -c "import karaoke; from vt import align_he as H; assert H.ready(), 'karaoke-he'; import stable_whisper, faster_whisper, ctranslate2; m = H.load_ivrit(); c, d = H.load_ctc(); assert '[pad]' in d; print('karaoke-he', stable_whisper.__version__, ctranslate2.__version__)"
# 01/11/2026 (A12): מודל זיהוי השפה נטען בלי רשת
RUN cd /app/translator && HF_HUB_OFFLINE=1 /opt/vt/bin/python -c "from vt import lang as L; assert L.ready(), 'lid'; m = L._model(); print('lid', L.LID_DIR)"
RUN cd /app/translator && ANTHROPIC_API_KEY=build-check /opt/vt/bin/python -B -c \
    "import llm; c = llm.Engine(llm.Spec.of(llm.DEFAULT_MODE))._client_or_new(); assert c.timeout.read == llm.API_READ_TIMEOUT, c.timeout" \
 && cd /app/translator && /opt/vt/bin/python -B -c \
    "from vt import diarize as d; p = d.model_path(); assert p, 'speaker model'; import numpy as n; assert d.Embedder(p)(n.zeros(16000, 'float32') + 1e-3).shape == (256,)"

ARG FFMPEG_SHA256_AMD64
ARG FFMPEG_SHA256_ARM64
# הקומיט שממנו נבנתה התמונה — מוצג במסך השרת באפליקציה (הדופק)
ARG SNB_VERSION=dev
LABEL org.opencontainers.image.source=https://github.com/yishaiguedj1/portfolio-pwa \
      org.opencontainers.image.description="THE SNOWBALL — העובד של סטודיו התרגום" \
      snb.ffmpeg.sha256.amd64=${FFMPEG_SHA256_AMD64} \
      snb.ffmpeg.sha256.arm64=${FFMPEG_SHA256_ARM64}
ENV PATH=/opt/vt/bin:/opt/ffmpeg:/opt/deno:/usr/local/bin:/usr/bin:/bin \
    PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    HOME=/tmp \
    VT_PY=/opt/vt/bin/python VT_BIN=/opt/ffmpeg VT_WORK=/work SNB_STATE=/state \
    SNB_SETUP=/bin/false \
    HF_HOME=/cache/hf TORCH_HOME=/cache/torch XDG_CACHE_HOME=/cache/xdg \
    HF_HUB_DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 \
    MALLOC_ARENA_MAX=2 \
    SNB_VERSION=${SNB_VERSION}
# MALLOC_ARENA_MAX=2: בלי זה glibc פותח arena לכל ליבה×8 — ב־torch מרובה־תהליכונים זה מאות MB של
# זיכרון "רפאים", והיישור כבר רץ צמוד לתקרת ה־6GB של הקונטיינר (המלצת מחקר ה־Arm, 09/10/2026).

USER 10001:10001
WORKDIR /app
# tini = תהליך 1 קטן: מעביר את SIGTERM לסוכן (שמסיים בנקיון) ואוסף תהליכי־בן.
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/vt/bin/python", "/app/translator/agent.py"]
