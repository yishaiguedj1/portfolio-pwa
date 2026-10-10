#!/usr/bin/env python3
"""בניית גרפי ה־ONNX של היישור מהמודל הרשמי (שלב 4.1 בתוכנית, 10/10/2026). רץ בבניית תמונת העובד.

למה לא קבצים מוכנים מהרשת: שרשרת אספקה — גם ייצוא שמישהו פרסם (Noir-Lime) הוא משקולות של צד שלישי.
כאן: המודל הרשמי של Qwen בגרסה נעולה (REVISION) + sha256 של המשקולות, ייצוא בעצמנו, ואז כיווץ דינמי
ל־INT8 (משקולות per-tensor, הפעלות דינמיות) של כל MatMul במקודד ובמפענח; הקונבולוציות נשארות FP32.

  python3 translator/aligner_export.py <תיקיית יעד> [--snapshot <תיקייה>] [--quant int8|fp32]

התוצר (manifest.json עם sha256 לכל קובץ — align_onnx.verify בודק לפני טעינה):
  audio-conv.onnx · audio-encoder.onnx · text-decoder.onnx · embed.npy (float16) · pos.npy · model/ (תצורה וטוקנייזר)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import time

MODEL_ID = "Qwen/Qwen3-ForcedAligner-0.6B"
REVISION = "c7cbfc2048c462b0d63a45797104fc9db3ad62b7"
# ה־LFS oid של model.safetensors בגרסה הזו (מה־API של Hugging Face, ונבדק מול הקובץ, 10/10/2026)
WEIGHTS_SHA256 = "47831d0e82f96b20e9034dba01a075ee06436654719f6a68289e49f1b65ce0e7"
# MMS_FA של torchaudio (dl.fbaipublicfiles.com/mms/torchaudio/ctc_alignment_mling_uroman/model.pt) — המנוע השני
CTC_SHA256 = "20ef12963ab4924bef49ac4fc7f58ad5da2ee43b2c11bc8c853c9b90ecdbc680"
OPSET = 17


def sha256(p: str) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 22), b""):
            h.update(b)
    return h.hexdigest()


def fetch_snapshot() -> str:
    from huggingface_hub import snapshot_download
    return snapshot_download(MODEL_ID, revision=REVISION)


def export(snap: str, out: str) -> None:
    import numpy as np
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from qwen_asr import Qwen3ForcedAligner
    from qwen_asr.core.transformers_backend.modeling_qwen3_asr import apply_rotary_pos_emb

    m = Qwen3ForcedAligner.from_pretrained(snap, dtype=torch.float32, device_map="cpu")
    m.model.requires_grad_(False)
    th = m.model.thinker
    at, tm = th.audio_tower, th.model
    win = 13 * (at.n_window_infer // (at.n_window * 2))      # 104 פריימים לחלון קשב (cu_seqlens של Qwen)

    # כל עטיפה רושמת את המודל כתת־מודול: המשקולות נכנסות כ־initializers (רק כך quantize_dynamic מכווץ אותן)
    class Wrap(nn.Module):
        def __init__(self):
            super().__init__()
            self.at, self.tm, self.head = at, tm, th.lm_head

    class Conv(Wrap):
        def forward(self, x):                                  # (N,1,128,100) → (N,13,1024)
            y = F.gelu(at.conv2d1(x))
            y = F.gelu(at.conv2d2(y))
            y = F.gelu(at.conv2d3(y))
            b, c, f, t = y.shape
            return at.conv_out(y.permute(0, 3, 1, 2).reshape(b, t, c * f))

    class Enc(Wrap):
        def forward(self, h):                                  # (T,1024): קשב רק בתוך חלון (מסכה בלוקית)
            T = h.shape[0]
            g = torch.arange(T) // win
            mask = torch.where(g[:, None] == g[None, :], 0.0, -1e9).to(h.dtype)[None, None]
            for L in at.layers:
                a = L.self_attn
                x = L.self_attn_layer_norm(h)
                q, k, v = (p(x).reshape(T, a.num_heads, -1).transpose(0, 1)[None] for p in (a.q_proj, a.k_proj, a.v_proj))
                w = torch.softmax(q @ k.transpose(2, 3) * a.scaling + mask, -1)
                h = h + a.out_proj((w @ v)[0].transpose(0, 1).reshape(T, -1))
                h = h + L.fc2(L.activation_fn(L.fc1(L.final_layer_norm(h))))
            return at.proj2(at.act(at.proj1(at.ln_post(h))))

    class Dec(Wrap):
        def forward(self, e):                                  # (1,L,1024) → (1,L) מזהי המחלקה (argmax בגרף)
            L = e.shape[1]
            cos, sin = tm.rotary_emb(e, torch.arange(L)[None, None].expand(3, 1, L))
            i = torch.arange(L)
            mask = torch.where(i[None, :] <= i[:, None], 0.0, -1e9).to(e.dtype)[None, None]
            h = e
            for Ly in tm.layers:
                a = Ly.self_attn
                x = Ly.input_layernorm(h)
                shp = (1, L, -1, a.head_dim)
                q = a.q_norm(a.q_proj(x).view(shp)).transpose(1, 2)
                k = a.k_norm(a.k_proj(x).view(shp)).transpose(1, 2)
                v = a.v_proj(x).view(shp).transpose(1, 2)
                q, k = apply_rotary_pos_emb(q, k, cos, sin)
                k = k.repeat_interleave(a.num_key_value_groups, 1)
                v = v.repeat_interleave(a.num_key_value_groups, 1)
                w = torch.softmax(q @ k.transpose(2, 3) * a.scaling + mask, -1)
                h = h + a.o_proj((w @ v).transpose(1, 2).reshape(1, L, -1))
                h = h + Ly.mlp(Ly.post_attention_layernorm(h))
            return th.lm_head(tm.norm(h)).argmax(-1)

    os.makedirs(out, exist_ok=True)
    kw = dict(dynamo=False, opset_version=OPSET)
    with torch.no_grad():
        torch.onnx.export(Conv().eval(), (torch.randn(3, 1, 128, 100),), f"{out}/audio-conv.onnx",
                          input_names=["x"], output_names=["y"], dynamic_axes={"x": {0: "n"}, "y": {0: "n"}}, **kw)
        torch.onnx.export(Enc().eval(), (torch.randn(300, 1024),), f"{out}/audio-encoder.onnx",
                          input_names=["h"], output_names=["y"], dynamic_axes={"h": {0: "t"}, "y": {0: "t"}}, **kw)
        torch.onnx.export(Dec().eval(), (torch.randn(1, 64, 1024),), f"{out}/text-decoder.onnx",
                          input_names=["e"], output_names=["ids"], dynamic_axes={"e": {1: "l"}, "ids": {1: "l"}}, **kw)
    np.save(f"{out}/embed.npy", tm.embed_tokens.weight.float().numpy().astype(np.float16))
    np.save(f"{out}/pos.npy", at.positional_embedding.positional_embedding.float().numpy())


def export_ctc(out: str) -> str:
    """המנוע השני של היישור (MMS_FA של torchaudio, wav2vec2 של 315M) — גרף אחד: גל קול → הסתברויות התווים.
    המשקולות מהכתובת של torchaudio, נבדקות מול CTC_SHA256 לפני הייצוא."""
    import torch
    import torch.nn as nn
    import torchaudio
    b = torchaudio.pipelines.MMS_FA
    w = b.get_model(with_star=True).eval().requires_grad_(False)
    ck = os.path.join(torch.hub.get_dir(), "checkpoints", os.path.basename(b._path))
    got = sha256(ck)
    if got != CTC_SHA256:
        raise SystemExit(f"✗ משקולות ה־CTC לא תואמות: {got}")

    class Ctc(nn.Module):
        def __init__(self):
            super().__init__()
            self.w = w                                         # תת־מודול: משקולות כ־initializers

        def forward(self, x):                                  # (1, N) → (1, T, C+1)
            if w.normalize_waveform:                           # layer_norm על כל הגל (בלי צורה קבועה בגרף)
                x = (x - x.mean()) / torch.sqrt(x.var(unbiased=False) + 1e-5)
            y, _ = w.model(x)
            if w.apply_log_softmax:
                y = torch.log_softmax(y, -1)
            if w.append_star:
                y = torch.cat((y, torch.zeros_like(y[:, :, :1])), -1)
            return y

    with torch.no_grad():
        torch.onnx.export(Ctc().eval(), (torch.randn(1, 16000 * 3),), f"{out}/ctc.onnx", dynamo=False,
                          opset_version=OPSET, input_names=["x"], output_names=["em"],
                          dynamic_axes={"x": {1: "n"}, "em": {1: "t"}})
    with open(f"{out}/ctc-dict.json", "w") as fh:
        json.dump(b.get_dict(star="*"), fh)
    return got


def quantize(out: str) -> None:
    from onnxruntime.quantization import QuantType, quantize_dynamic
    for f in ("audio-encoder.onnx", "text-decoder.onnx", "ctc.onnx"):
        src = f"{out}/{f}.fp32"
        os.replace(f"{out}/{f}", src)
        quantize_dynamic(src, f"{out}/{f}", weight_type=QuantType.QInt8, op_types_to_quantize=["MatMul"],
                         extra_options={"MatMulConstBOnly": True})
        os.remove(src)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--snapshot")
    ap.add_argument("--quant", choices=("int8", "fp32"), default="int8")
    a = ap.parse_args(argv)
    t0 = time.time()
    snap = a.snapshot or fetch_snapshot()
    got = sha256(os.path.join(snap, "model.safetensors"))
    if got != WEIGHTS_SHA256:
        print(f"✗ המשקולות לא תואמות: {got}", file=sys.stderr)
        return 1
    export(snap, a.out)
    ctc_got = export_ctc(a.out)
    if a.quant == "int8":
        quantize(a.out)
    os.makedirs(f"{a.out}/model", exist_ok=True)
    for f in sorted(os.listdir(snap)):
        if f != "model.safetensors" and os.path.isfile(os.path.join(snap, f)):
            shutil.copy(os.path.realpath(os.path.join(snap, f)), f"{a.out}/model/{f}")
    files = ("audio-conv.onnx", "audio-encoder.onnx", "text-decoder.onnx", "embed.npy", "pos.npy",
             "ctc.onnx", "ctc-dict.json")
    man = {"model": MODEL_ID, "revision": REVISION, "weights_sha256": got, "ctc_sha256": ctc_got,
           "quant": a.quant, "opset": OPSET,
           "sha256": {f: sha256(f"{a.out}/{f}") for f in files}}
    with open(f"{a.out}/manifest.json", "w") as fh:
        json.dump(man, fh, indent=1)
    print(f"✓ גרפי היישור ({a.quant}) מוכנים ב־{a.out} ({time.time() - t0:.0f} שנ׳)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
