from __future__ import annotations

import csv
import math
import os
import random
from datetime import datetime, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
RESULTS_CSV = REPO / "results" / "final_test_predictions.csv"
IMAGES_DIR = Path(os.getenv("DEMO_IMAGES_DIR") or REPO / "kaggle_model" / "archive" / "ShanghaiTech" / "part_B" / "test_data" / "images")

# Daily crowd shape per profile, as a fraction of the camera's zone capacity: base + gaussian peaks (centre hour IST, width h, height).
PROFILES: dict[str, dict] = {
    "somnath": {"base": 0.08, "peaks": [(7.0, 1.3, 0.80), (12.5, 2.0, 0.35), (19.0, 1.5, 1.00)]},
    "dwarka": {"base": 0.07, "peaks": [(8.0, 1.5, 0.70), (17.5, 2.5, 0.85), (21.0, 1.0, 0.50)]},
    "rameswaram": {"base": 0.06, "peaks": [(5.5, 1.5, 0.90), (9.5, 2.0, 0.60), (16.0, 2.0, 0.50), (19.0, 1.2, 0.55)]},
    "nathdwara": {"base": 0.06, "peaks": [(6.5, 0.7, 0.70), (9.0, 0.7, 0.60), (12.0, 0.7, 0.65), (16.5, 0.8, 0.80), (18.0, 0.7, 0.95)]},
    "generic": {"base": 0.08, "peaks": [(7.5, 1.5, 0.75), (18.5, 1.8, 0.90)]},
}

_rows: list[dict] | None = None


def _images() -> list[dict]:
    """Part-B test images with the CSRNet counts that were measured on them (results/final_test_predictions.csv)."""
    global _rows
    if _rows is None:
        if not RESULTS_CSV.exists():
            raise ValueError("demo feed needs results/final_test_predictions.csv (install the Kaggle results first)")
        with RESULTS_CSV.open(newline="", encoding="utf-8") as f:
            rows = [
                {"image": r["image"], "actual": float(r["actual_count"]), "predicted": float(r["predicted_count"])}
                for r in csv.DictReader(f)
                if r["part"] == "B"
            ]
        _rows = sorted(rows, key=lambda r: r["actual"])
    return _rows


def pattern(profile: str, when: datetime) -> float:
    """Expected occupancy fraction of a zone at `when` (UTC datetime), evening/morning peaks, busier weekends."""
    p = PROFILES.get(profile, PROFILES["generic"])
    ist = when + timedelta(hours=5, minutes=30)
    hour = ist.hour + ist.minute / 60
    f = p["base"] + sum(a * math.exp(-(((hour - c) / w) ** 2)) for c, w, a in p["peaks"])
    if ist.weekday() >= 5:
        f *= 1.25
    return f * random.Random(f"{profile}:{ist.date()}").uniform(0.85, 1.15)


def choose(profile: str, zone_capacity: float, when: datetime) -> dict:
    """Pick the test image whose true count is closest to what the pattern says the zone holds right now."""
    rng = random.Random(f"{profile}:{zone_capacity}:{int(when.timestamp() // 300)}")
    target = min(1.15, pattern(profile, when)) * zone_capacity * rng.uniform(0.93, 1.07)
    rows = _images()
    lo, hi = 0, len(rows) - 1
    while lo < hi:  # binary search on the sorted true counts
        mid = (lo + hi) // 2
        if rows[mid]["actual"] < target:
            lo = mid + 1
        else:
            hi = mid
    window = rows[max(0, lo - 2) : lo + 3]
    return rng.choice(window)


def images_available() -> bool:
    return IMAGES_DIR.is_dir() and any(IMAGES_DIR.glob("*.jpg"))


def frame_bytes(camera: dict) -> bytes:
    row = choose(camera.get("url") or "generic", camera.get("zone_capacity") or 300, datetime.utcnow())
    path = IMAGES_DIR / row["image"]
    if not path.exists():
        raise ValueError(f"demo image not found: {path} (set DEMO_IMAGES_DIR to the ShanghaiTech part_B/test_data/images folder)")
    return path.read_bytes()


def history(profile: str, zone_capacity: float, start: datetime, end: datetime, step_minutes: int = 10):
    t = start
    while t <= end:
        yield t, choose(profile, zone_capacity, t)
        t += timedelta(minutes=step_minutes)
