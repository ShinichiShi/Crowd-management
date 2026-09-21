from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    project_name: str = "Smart Crowd Management Backend"
    api_prefix: str = ""
    demo_prefix: str = "/demo"
    tta: bool = os.getenv("TTA", "1") != "0"
    demo_fallback: bool = os.getenv("DEMO_FALLBACK", "1") != "0"
    cors_origins: tuple[str, ...] = ("*",)
    model_dir: Path = Path(__file__).resolve().parent.parent / "models"
    csrnet_path: Path = model_dir / "csrnet_model.pth"
    lstm_path: Path = model_dir / "lstm_model.pth"
    lstm_scaler_path: Path = model_dir / "lstm_scaler.json"
    device: str = "cuda" if os.getenv("FORCE_CPU", "0") != "1" else "cpu"


settings = Settings()
