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
ARG FFMPEG_URL=https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-linux64-gpl-8.1.tar.xz
# חובה מבחוץ: ה־sha256 של הקובץ (ה־workflow לוקח אותו מ־checksums.sha256 של אותה גרסה ורושם אותו בתווית התמונה)
ARG FFMPEG_SHA256
RUN set -eu; test -n "$FFMPEG_SHA256" || { echo 'חסר FFMPEG_SHA256'; exit 1; }; \
    apt-get update -qq && apt-get install -y -qq --no-install-recommends curl xz-utils ca-certificates >/dev/null; \
    curl -fsSL -o /tmp/ff.tar.xz "$FFMPEG_URL"; \
    echo "$FFMPEG_SHA256  /tmp/ff.tar.xz" | sha256sum -c -; \
    mkdir -p /tmp/ff /opt/ffmpeg && tar -C /tmp/ff -xf /tmp/ff.tar.xz; \
    cp /tmp/ff/*/bin/ffmpeg /tmp/ff/*/bin/ffprobe /opt/ffmpeg/; \
    /opt/ffmpeg/ffmpeg -hide_banner -buildconf | grep -q -- '--enable-libsvtav1'; \
    /opt/ffmpeg/ffmpeg -hide_banner -buildconf | grep -q -- '--enable-libass'

# ---------------------------------------------------------------- ספריות Python (נעולות)
FROM ${PY_IMAGE} AS deps
COPY infra/worker/requirements.lock /tmp/requirements.lock
RUN python -m venv /opt/vt \
 && /opt/vt/bin/pip install --no-cache-dir -q --upgrade 'pip==25.*' \
 && /opt/vt/bin/pip install --no-cache-dir -q --require-hashes --only-binary=:all: --no-binary=sox \
        --extra-index-url https://download.pytorch.org/whl/cpu -r /tmp/requirements.lock \
 && /opt/vt/bin/python -c "import numpy, soundfile, onnx_asr, torch, torchaudio, qwen_asr, anthropic, PIL, fontTools; print('ok')"

# ---------------------------------------------------------------- התמונה הסופית
FROM ${PY_IMAGE}
ARG FFMPEG_SHA256
# הקומיט שממנו נבנתה התמונה — מוצג במסך השרת באפליקציה (הדופק)
ARG SNB_VERSION=dev
LABEL org.opencontainers.image.source=https://github.com/yishaiguedj1/portfolio-pwa \
      org.opencontainers.image.description="THE SNOWBALL — העובד של סטודיו התרגום" \
      snb.ffmpeg.sha256=${FFMPEG_SHA256}
# רק מה שצריך: תעודות CA ו־tini. בלי curl, בלי compilers, בלי shell נוסף.
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends ca-certificates tini >/dev/null \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 10001 --user-group --no-create-home --shell /usr/sbin/nologin snb \
 && mkdir -p /work /cache /state && chown snb:snb /work /cache /state && chmod 700 /work /cache /state
COPY --from=ffmpeg /opt/ffmpeg /opt/ffmpeg
COPY --from=deps /opt/vt /opt/vt
COPY --chown=root:root translator /app/translator
RUN rm -rf /app/translator/tests /app/translator/research /app/translator/__pycache__ \
 && find /app -type d -exec chmod 755 {} + && find /app -type f -exec chmod 644 {} +

ENV PATH=/opt/vt/bin:/opt/ffmpeg:/usr/local/bin:/usr/bin:/bin \
    PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    HOME=/tmp \
    VT_PY=/opt/vt/bin/python VT_BIN=/opt/ffmpeg VT_WORK=/work SNB_STATE=/state \
    SNB_SETUP=/bin/false \
    HF_HOME=/cache/hf TORCH_HOME=/cache/torch XDG_CACHE_HOME=/cache/xdg \
    HF_HUB_DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 \
    SNB_VERSION=${SNB_VERSION}

USER 10001:10001
WORKDIR /app
# tini = תהליך 1 קטן: מעביר את SIGTERM לסוכן (שמסיים בנקיון) ואוסף תהליכי־בן.
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/vt/bin/python", "/app/translator/agent.py"]
