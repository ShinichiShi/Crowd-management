from __future__ import annotations


def evaluate_risk(current: float, predicted: float, previous: float) -> tuple[float, str]:
    risk_score = 0.4 * current + 0.3 * (current - previous) + 0.3 * predicted

    if risk_score < 2000:
        level = "Safe"
    elif risk_score < 5000:
        level = "Caution"
    elif risk_score < 9000:
        level = "Warning"
    else:
        level = "Critical"

    return risk_score, level


def count_level(count: float, warn: float | None = None, crit: float | None = None) -> str:
    """Safe < warn <= Warning < crit <= Critical. Defaults come from utils.thresholds (100 / 200 people)."""
    if warn is None or crit is None:
        from utils import thresholds

        t = thresholds.get()
        warn, crit = t["warn"], t["crit"]
    if count < warn:
        return "Safe"
    if count < crit:
        return "Warning"
    return "Critical"
