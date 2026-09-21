from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path

RESULTS_DIR = Path(__file__).resolve().parents[2] / "results"
LSTM_COL = "forecast | CSRNet + LSTM (predictive)"


@dataclass(frozen=True)
class ForecastRow:
    ts: datetime
    observed_now: float      # CSRNet count at the previous hour
    true_now: float          # true count at the previous hour
    true_next: float         # true count at `ts`
    lstm: float              # LSTM forecast for `ts` (made one hour earlier)
    reactive: float          # CSRNet-only forecast for `ts`
    true_risk: str
    lstm_risk: str
    lstm_accuracy: float


def _mtime(name: str) -> float:
    p = RESULTS_DIR / name
    return p.stat().st_mtime if p.exists() else 0.0


@lru_cache(maxsize=4)
def _load_forecast(mtime: float) -> tuple[ForecastRow, ...]:
    path = RESULTS_DIR / "final_forecast_predictions.csv"
    if not path.exists():
        return ()
    with path.open(newline="", encoding="utf-8") as f:
        rows = [
            ForecastRow(
                ts=datetime.fromisoformat(r["timestamp"]),
                observed_now=float(r["csrnet_count_now"]),
                true_now=float(r["true_count_now"]),
                true_next=float(r["true_next_hour"]),
                lstm=float(r[LSTM_COL]),
                reactive=float(r["forecast | CSRNet only (reactive)"]),
                true_risk=r["true_risk_next_hour"],
                lstm_risk=r["lstm_risk_forecast"],
                lstm_accuracy=float(r["lstm_accuracy_pct"]),
            )
            for r in csv.DictReader(f)
        ]
    return tuple(rows)


def forecast_rows() -> tuple[ForecastRow, ...]:
    """Held-out test stream with real CSRNet + LSTM outputs (empty if results/ has no CSV yet)."""
    return _load_forecast(_mtime("final_forecast_predictions.csv"))


@lru_cache(maxsize=4)
def _load_table(name: str, mtime: float) -> tuple[dict[str, str], ...]:
    path = RESULTS_DIR / name
    if not path.exists():
        return ()
    with path.open(newline="", encoding="utf-8") as f:
        return tuple(csv.DictReader(f))


def table(name: str) -> tuple[dict[str, str], ...]:
    return _load_table(name, _mtime(name))
