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
 && /opt/vt/bin/python -c "import numpy, soundfile, onnx, onnx_asr, torch, torchaudio, qwen_asr, anthropic, PIL, fontTools; print('ok')"

# ---------------------------------------------------------------- גרפי היישור (ONNX INT8, שלב 4.1)
# מהמודל הרשמי של Qwen בגרסה נעולה + sha256 של המשקולות (translator/aligner_export.py) — לא קבצים של צד שלישי.
# בתמונה ולא בזמן ריצה: השרת לא מייצא (זה ~6GB זיכרון רגעי), והגרסה של הגרפים = הגרסה של התמונה.
FROM deps AS aligner
COPY translator/aligner_export.py /tmp/aligner_export.py
RUN HF_HOME=/tmp/hf HF_HUB_DISABLE_TELEMETRY=1 /opt/vt/bin/python /tmp/aligner_export.py /opt/aligner \
 && rm -rf /tmp/hf

# ---------------------------------------------------------------- התמונה הסופית
FROM ${PY_IMAGE}
ARG FFMPEG_SHA256_AMD64
ARG FFMPEG_SHA256_ARM64
# הקומיט שממנו נבנתה התמונה — מוצג במסך השרת באפליקציה (הדופק)
ARG SNB_VERSION=dev
LABEL org.opencontainers.image.source=https://github.com/yishaiguedj1/portfolio-pwa \
      org.opencontainers.image.description="THE SNOWBALL — העובד של סטודיו התרגום" \
      snb.ffmpeg.sha256.amd64=${FFMPEG_SHA256_AMD64} \
      snb.ffmpeg.sha256.arm64=${FFMPEG_SHA256_ARM64}
# רק מה שצריך: תעודות CA ו־tini. בלי curl, בלי compilers, בלי shell נוסף.
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends ca-certificates tini >/dev/null \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 10001 --user-group --no-create-home --shell /usr/sbin/nologin snb \
 && mkdir -p /work /cache /state && chown snb:snb /work /cache /state && chmod 700 /work /cache /state
COPY --from=ffmpeg /opt/ffmpeg /opt/ffmpeg
COPY --from=deps /opt/vt /opt/vt
COPY --from=aligner /opt/aligner /opt/aligner
COPY --chown=root:root translator /app/translator
RUN rm -rf /app/translator/tests /app/translator/research /app/translator/__pycache__ \
 && find /app /opt/aligner -type d -exec chmod 755 {} + && find /app /opt/aligner -type f -exec chmod 644 {} +

ENV PATH=/opt/vt/bin:/opt/ffmpeg:/usr/local/bin:/usr/bin:/bin \
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
