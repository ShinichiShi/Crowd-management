from __future__ import annotations

import io
import json
import math
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torchvision import transforms


CSRNET_TRANSFORM = transforms.Compose(
    [
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
)


MAX_SIDE = 1024  # ShanghaiTech images are <= 1024 px; larger photos are scaled down to stay in that range


def prepare_image(image_bytes: bytes) -> Image.Image:
    """RGB image, scaled down to <= 1024 px and cropped to multiples of 8 (exactly what the model saw in training)."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    longest = max(image.size)
    if longest > MAX_SIDE:
        scale = MAX_SIDE / longest
        image = image.resize((max(8, int(image.width * scale)), max(8, int(image.height * scale))), Image.BILINEAR)
    w8, h8 = (image.width // 8) * 8, (image.height // 8) * 8
    return image.crop((0, 0, max(8, w8), max(8, h8)))


def image_to_tensor(image: Image.Image, device: torch.device) -> torch.Tensor:
    return CSRNET_TRANSFORM(image).unsqueeze(0).to(device)


def preprocess_csrnet_image(image_bytes: bytes, device: torch.device) -> torch.Tensor:
    return image_to_tensor(prepare_image(image_bytes), device)


@dataclass
class SequenceNormalizer:
    method: str = "identity"
    mean: float = 0.0
    std: float = 1.0
    min_value: float = 0.0
    max_value: float = 1.0

    def normalize(self, values: np.ndarray) -> np.ndarray:
        if self.method == "zscore":
            denom = self.std if self.std != 0 else 1.0
            return (values - self.mean) / denom
        if self.method == "minmax":
            denom = self.max_value - self.min_value
            denom = denom if denom != 0 else 1.0
            return (values - self.min_value) / denom
        return values

    def denormalize(self, values: np.ndarray) -> np.ndarray:
        if self.method == "zscore":
            return values * self.std + self.mean
        if self.method == "minmax":
            return values * (self.max_value - self.min_value) + self.min_value
        return values


def load_scaler_from_json(path: Path) -> SequenceNormalizer | None:
    if not path.exists():
        return None

    payload = json.loads(path.read_text(encoding="utf-8"))
    method = payload.get("method", "identity").lower()

    if method == "zscore":
        return SequenceNormalizer(
            method="zscore",
            mean=float(payload["mean"]),
            std=float(payload["std"]),
        )

    if method == "minmax":
        return SequenceNormalizer(
            method="minmax",
            min_value=float(payload["min"]),
            max_value=float(payload["max"]),
        )

    return SequenceNormalizer(method="identity")


def time_features(last_timestamp: datetime | None, sequence_length: int, step_minutes: int = 60) -> np.ndarray:
    """[sin_hour, cos_hour, sin_weekday, cos_weekday] per input step; must match the training notebook."""
    last = last_timestamp or datetime.now(timezone.utc)
    rows = []
    for i in range(sequence_length):
        t = last - timedelta(minutes=step_minutes * (sequence_length - 1 - i))
        h, d = t.hour, t.weekday()
        rows.append(
            [
                math.sin(2 * math.pi * h / 24),
                math.cos(2 * math.pi * h / 24),
                math.sin(2 * math.pi * d / 7),
                math.cos(2 * math.pi * d / 7),
            ]
        )
    return np.asarray(rows, dtype=np.float32)


def preprocess_lstm_sequence(
    values: list[float],
    sequence_length: int,
    normalizer: SequenceNormalizer,
    device: torch.device,
    last_timestamp: datetime | None = None,
    use_time_features: bool = False,
    step_minutes: int = 60,
) -> torch.Tensor:
    raw = np.asarray(values, dtype=np.float32)
    if len(raw) < sequence_length:
        raise ValueError(
            f"past_counts must contain at least {sequence_length} values for this model."
        )

    clipped = raw[-sequence_length:]
    normalized = normalizer.normalize(clipped).astype(np.float32)[:, None]
    if use_time_features:
        normalized = np.concatenate(
            [normalized, time_features(last_timestamp, sequence_length, step_minutes)], axis=1
        )
    tensor = torch.tensor(normalized, dtype=torch.float32).unsqueeze(0)
    return tensor.to(device)
