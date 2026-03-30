"""
Supervised fine-tuning entrypoint for Zhipu GLM-5 (Hugging Face).

GLM-5 is a very large MoE model; practical training needs a multi-GPU cluster,
recent transformers (often `pip install git+https://github.com/huggingface/transformers.git`),
and enough aggregate memory for weights + activations. See:
https://github.com/zai-org/GLM-5

Install deps: uv sync --extra train
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


DEFAULT_GLM5_MODEL = "zai-org/GLM-5"
DEFAULT_GLM5_FP8 = "zai-org/GLM-5-FP8"


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="SFT for GLM-5 (TRL + Hugging Face)")
    p.add_argument(
        "--model",
        default=DEFAULT_GLM5_MODEL,
        help=f"HF model id or local path (defaults: full {DEFAULT_GLM5_MODEL} or FP8 {DEFAULT_GLM5_FP8})",
    )
    p.add_argument(
        "--dataset",
        required=True,
        help="HF dataset name (e.g. trl-lib/Capybara) or path to JSONL with a `messages` column",
    )
    p.add_argument(
        "--dataset-split",
        default="train",
        help="Split name when loading a Hub dataset",
    )
    p.add_argument(
        "--output-dir",
        type=Path,
        default=Path("outputs/glm5-sft"),
        help="Directory for checkpoints and logs",
    )
    p.add_argument(
        "--max-steps",
        type=int,
        default=-1,
        help="Max training steps (-1 = derive from epochs)",
    )
    p.add_argument(
        "--num-train-epochs",
        type=float,
        default=1.0,
        help="Used when --max-steps is -1",
    )
    p.add_argument(
        "--per-device-train-batch-size",
        type=int,
        default=1,
    )
    p.add_argument(
        "--gradient-accumulation-steps",
        type=int,
        default=8,
    )
    p.add_argument(
        "--learning-rate",
        type=float,
        default=2e-5,
    )
    p.add_argument(
        "--warmup-ratio",
        type=float,
        default=0.03,
    )
    p.add_argument(
        "--logging-steps",
        type=int,
        default=10,
    )
    p.add_argument(
        "--save-steps",
        type=int,
        default=500,
    )
    p.add_argument(
        "--max-seq-length",
        type=int,
        default=4096,
    )
    p.add_argument(
        "--lora",
        action="store_true",
        help="Train with PEFT LoRA adapters instead of full weights",
    )
    p.add_argument(
        "--lora-r",
        type=int,
        default=16,
    )
    p.add_argument(
        "--lora-alpha",
        type=int,
        default=32,
    )
    p.add_argument(
        "--lora-target-modules",
        default="q_proj,k_proj,v_proj,o_proj,gate_proj,up_proj,down_proj",
        help="Comma-separated module name substrings for LoRA targets",
    )
    p.add_argument(
        "--bf16",
        action="store_true",
        help="Use bfloat16 for the base model (recommended on supported GPUs)",
    )
    p.add_argument(
        "--no-trust-remote-code",
        action="store_true",
        help="Do not pass trust_remote_code=True to from_pretrained",
    )
    p.add_argument(
        "--output-router-logits",
        action="store_true",
        help="For MoE (GLM-5), pass output_router_logits=True so router/auxiliary loss can be included",
    )
    return p.parse_args()


def _load_train_dataset(path_or_name: str, split: str):
    from datasets import load_dataset

    p = Path(path_or_name)
    if p.is_file() and p.suffix.lower() == ".jsonl":
        return load_dataset("json", data_files=str(p), split="train")
    if p.is_dir():
        files = sorted(p.glob("*.jsonl"))
        if not files:
            raise FileNotFoundError(f"No .jsonl files under directory: {p}")
        return load_dataset("json", data_files=[str(f) for f in files], split="train")
    return load_dataset(path_or_name, split=split)


def main() -> None:
    args = _parse_args()

    if DEFAULT_GLM5_MODEL in args.model or DEFAULT_GLM5_FP8 in args.model:
        print(
            "Note: GLM-5 is a 744B-A40B MoE; training needs large multi-GPU setups and "
            "a transformers build that registers the GLM-5 architecture.",
            file=sys.stderr,
        )

    try:
        import torch
        from peft import LoraConfig
        from trl import SFTConfig, SFTTrainer
    except ImportError as e:
        raise SystemExit(
            "Missing training dependencies. Run: uv sync --extra train\n" f"Import error: {e}"
        ) from e

    train_ds = _load_train_dataset(args.dataset, args.dataset_split)

    trust_remote_code = not args.no_trust_remote_code
    torch_dtype = torch.bfloat16 if args.bf16 else None
    model_init_kwargs: dict = {"trust_remote_code": trust_remote_code}
    if torch_dtype is not None:
        model_init_kwargs["torch_dtype"] = torch_dtype
    if args.output_router_logits:
        model_init_kwargs["output_router_logits"] = True

    sft_args = SFTConfig(
        output_dir=str(args.output_dir),
        per_device_train_batch_size=args.per_device_train_batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        learning_rate=args.learning_rate,
        warmup_ratio=args.warmup_ratio,
        logging_steps=args.logging_steps,
        save_steps=args.save_steps,
        num_train_epochs=args.num_train_epochs,
        max_steps=args.max_steps,
        bf16=args.bf16,
        gradient_checkpointing=True,
        max_length=args.max_seq_length,
        model_init_kwargs=model_init_kwargs,
        report_to="none",
    )

    peft_config = None
    if args.lora:
        targets = [t.strip() for t in args.lora_target_modules.split(",") if t.strip()]
        peft_config = LoraConfig(
            r=args.lora_r,
            lora_alpha=args.lora_alpha,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
            target_modules=targets,
        )

    trainer = SFTTrainer(
        model=args.model,
        args=sft_args,
        train_dataset=train_ds,
        peft_config=peft_config,
    )
    trainer.train()
    trainer.save_model(str(args.output_dir))


if __name__ == "__main__":
    main()
