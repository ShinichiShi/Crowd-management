from __future__ import annotations

import json
import os
import threading
from pathlib import Path

import numpy as np

CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "thresholds.json"
DEFAULT = {"warn": 100.0, "crit": 200.0}
_lock = threading.Lock()


def validate(warn: float, crit: float) -> None:
    if not (0 < warn < crit):
        raise ValueError("Thresholds must satisfy 0 < warn < crit.")


def source() -> str:
    if CONFIG_PATH.exists():
        return "file"
    return "env" if ("RISK_WARN" in os.environ or "RISK_CRIT" in os.environ) else "default"


def get() -> dict[str, float]:
    """Priority: saved file (PUT /thresholds) > env RISK_WARN / RISK_CRIT > defaults (100 / 200 people)."""
    with _lock:
        if CONFIG_PATH.exists():
            try:
                data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
                warn, crit = float(data["warn"]), float(data["crit"])
                validate(warn, crit)
                return {"warn": warn, "crit": crit}
            except Exception:
                pass
    try:
        warn = float(os.getenv("RISK_WARN", DEFAULT["warn"]))
        crit = float(os.getenv("RISK_CRIT", DEFAULT["crit"]))
        validate(warn, crit)
        return {"warn": warn, "crit": crit}
    except ValueError:
        return dict(DEFAULT)


def save(warn: float, crit: float) -> dict[str, float]:
    validate(warn, crit)
    with _lock:
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(json.dumps({"warn": warn, "crit": crit}), encoding="utf-8")
    return get()


def reset() -> dict[str, float]:
    with _lock:
        CONFIG_PATH.unlink(missing_ok=True)
    return get()


def suggest() -> dict[str, object] | None:
    """Data-driven starting point: 75th / 90th percentile of the counts seen in the test stream."""
    from utils import results_store

    rows = results_store.forecast_rows()
    if not rows:
        return None
    counts = np.array([r.true_next for r in rows])
    warn, crit = float(np.percentile(counts, 75)), float(np.percentile(counts, 90))
    if warn >= crit:
        return None
    return {"warn": round(warn), "crit": round(crit), "basis": "75th / 90th percentile of the test-stream counts"}
