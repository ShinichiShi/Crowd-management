from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image

from utils import thresholds as th
from utils.risk import count_level


def _jet(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, 0.0, 1.0)
    r = np.clip(1.5 - np.abs(4 * x - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * x - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * x - 1), 0, 1)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)


def _data_uri(image: Image.Image, fmt: str, **kwargs) -> str:
    buf = io.BytesIO()
    image.save(buf, fmt, **kwargs)
    return f"data:image/{fmt.lower()};base64," + base64.b64encode(buf.getvalue()).decode()


def _people_per_m2_band(value: float) -> str:
    # Commonly cited crowd-safety guidance: >= 4 people/m2 is dangerous, >= 5 approaches crush conditions.
    if value < 1:
        return "Free movement"
    if value < 2:
        return "Comfortable"
    if value < 4:
        return "Dense"
    if value < 5:
        return "Very dense (dangerous)"
    return "Critical (crush risk)"


def build_analysis(
    density: np.ndarray,
    image: Image.Image,
    warn: float | None = None,
    crit: float | None = None,
    area_m2: float | None = None,
    source: str = "live",
) -> dict[str, object]:
    """Turn a 1/8-resolution density map (people per cell) into count, density stats, risk level and heat-map images."""
    d = np.maximum(np.asarray(density, dtype=np.float32), 0.0)
    count = float(d.sum())
    t = th.get()
    warn = t["warn"] if warn is None else warn
    crit = t["crit"] if crit is None else crit
    th.validate(warn, crit)

    w, h = image.size
    peak = float(d.max()) if d.size else 0.0
    py, px = np.unravel_index(int(d.argmax()), d.shape) if d.size else (0, 0)
    norm = d / peak if peak > 1e-8 else d

    heat = Image.fromarray(_jet(norm)).resize((w, h), Image.BICUBIC)
    alpha = Image.fromarray((np.clip(norm * 1.6, 0, 0.7) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    heat_rgba = heat.convert("RGBA")
    heat_rgba.putalpha(alpha)
    overlay = Image.alpha_composite(image.convert("RGBA"), heat_rgba).convert("RGB")
    small = heat.copy()
    small.thumbnail((480, 480))

    density_info: dict[str, object] = {
        "people_per_megapixel": round(count / max(w * h / 1e6, 1e-6), 1),
        "peak_cell_people": round(peak, 3),
        "peak_cell_note": "people in the busiest 8x8-pixel cell of the model output",
        "hotspot_x": round((px + 0.5) / max(d.shape[1], 1), 3),
        "hotspot_y": round((py + 0.5) / max(d.shape[0], 1), 3),
    }
    if area_m2 and area_m2 > 0:
        per_m2 = count / area_m2
        density_info["people_per_m2"] = round(per_m2, 2)
        density_info["density_band"] = _people_per_m2_band(per_m2)

    return {
        "count": round(count, 2),
        "level": count_level(count, warn, crit),
        "thresholds": {"warn": warn, "crit": crit},
        "density": density_info,
        "image_size": {"width": w, "height": h},
        "overlay_image": _data_uri(overlay, "JPEG", quality=85),
        "density_map_image": _data_uri(small, "PNG"),
        "source": source,
    }
