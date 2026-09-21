from __future__ import annotations

import io
from datetime import datetime

import numpy as np
from PIL import Image


def demo_count(image_bytes: bytes) -> float:
    """Deterministic, model-free stand-in for CSRNet: busier (higher edge energy) images give higher counts."""
    img = Image.open(io.BytesIO(image_bytes)).convert("L").resize((128, 128))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    energy = float(np.abs(np.diff(arr, axis=0)).mean() + np.abs(np.diff(arr, axis=1)).mean())
    return round(15.0 + 900.0 * min(energy, 0.5), 2)


def demo_forecast(values: list[float], last_timestamp: datetime | None = None) -> float:
    """Model-free stand-in for the LSTM: blend of the latest value and the same step one day earlier."""
    latest = float(values[-1])
    seasonal = float(values[-24]) if len(values) >= 24 else float(np.mean(values))
    return round(max(0.0, 0.6 * latest + 0.4 * seasonal), 2)


def demo_density(image: Image.Image, total: float) -> np.ndarray:
    """Model-free density map: local edge energy at 1/8 resolution, scaled to sum to `total`."""
    g = np.asarray(image.convert("L"), dtype=np.float32) / 255.0
    gy = np.abs(np.diff(g, axis=0, prepend=g[:1]))
    gx = np.abs(np.diff(g, axis=1, prepend=g[:, :1]))
    e = gx + gy
    h8, w8 = e.shape[0] // 8, e.shape[1] // 8
    cells = e[: h8 * 8, : w8 * 8].reshape(h8, 8, w8, 8).mean(axis=(1, 3))
    s = float(cells.sum())
    return cells * (total / s) if s > 0 else cells
