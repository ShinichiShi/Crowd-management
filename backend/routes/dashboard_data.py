from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from collections import defaultdict

from services.status import recent_alerts
from utils import results_store
from utils.risk import count_level, evaluate_risk


router = APIRouter(tags=["frontend-data"])


def _anchor(rows, end: str | None) -> int:
    """Index of the replay 'now': given ISO time, else the latest 19:00 (evening peak) in the data, else the last row."""
    if end:
        target = datetime.fromisoformat(end)
        return min(range(len(rows)), key=lambda i: abs((rows[i].ts - target).total_seconds()))
    peaks = [i for i, r in enumerate(rows) if r.ts.hour == 19]
    return peaks[-1] if peaks else len(rows) - 1


def _dashboard_from_results(end: str | None = None) -> dict[str, object] | None:
    all_rows = results_store.forecast_rows()
    if len(all_rows) < 25:
        return None
    idx = _anchor(all_rows, end)
    rows = all_rows[: idx + 1]
    if len(rows) < 24:
        return None
    win = rows[-24:]
    last = rows[-1]
    now, nxt = last.true_now, last.lstm
    return {
        "summary": {
            "current_crowd": round(now),
            "risk_level": count_level(max(now, nxt)),
            "risk_score": round(nxt, 2),
            "next_hour_surge_percent": round(((nxt - now) / max(now, 1)) * 100, 2),
            "response_time_seconds": 0.24,
            "last_updated": last.ts.isoformat(),
            "next_hour_forecast": round(nxt),
            "data_source": "test-replay",
            "note": "Replay of the held-out test stream: real CSRNet counts and real LSTM next-hour forecasts.",
        },
        "crowd_data": [
            {"time": r.ts.strftime("%H:%M"), "crowd": round(r.true_next), "prediction": round(r.lstm)} for r in win
        ],
        "temple_metrics": _MOCK_TEMPLE_METRICS,
    }


_MOCK_TEMPLE_METRICS = [
    {"name": "Somnath", "value": 35, "color": "#EA6E3C"},
    {"name": "Dwarkadhish", "value": 28, "color": "#4C3A7F"},
    {"name": "Ramnath", "value": 22, "color": "#10B981"},
    {"name": "Shreenathji", "value": 15, "color": "#F59E0B"},
]


@router.get("/dashboard-data")
def get_dashboard_data(end: str | None = None) -> dict[str, object]:
    real = _dashboard_from_results(end)
    if real is not None:
        return real

    crowd_data = [
        {"time": "00:00", "crowd": 2400, "prediction": 2210},
        {"time": "04:00", "crowd": 1398, "prediction": 2290},
        {"time": "08:00", "crowd": 9800, "prediction": 2000},
        {"time": "12:00", "crowd": 3908, "prediction": 2108},
        {"time": "16:00", "crowd": 4800, "prediction": 2200},
        {"time": "20:00", "crowd": 3800, "prediction": 2100},
        {"time": "23:59", "crowd": 4300, "prediction": 2300},
    ]

    temple_metrics = [
        {"name": "Somnath", "value": 35, "color": "#EA6E3C"},
        {"name": "Dwarkadhish", "value": 28, "color": "#4C3A7F"},
        {"name": "Ramnath", "value": 22, "color": "#10B981"},
        {"name": "Shreenathji", "value": 15, "color": "#F59E0B"},
    ]

    current = crowd_data[-1]["crowd"]
    previous = crowd_data[-2]["crowd"]
    predicted = crowd_data[-1]["prediction"]
    risk_score, risk_level = evaluate_risk(current=current, predicted=predicted, previous=previous)

    return {
        "summary": {
            "current_crowd": current,
            "risk_level": risk_level,
            "risk_score": round(risk_score, 2),
            "next_hour_surge_percent": round(max(0.0, ((predicted - current) / max(current, 1)) * 100), 2),
            "response_time_seconds": 0.24,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        },
        "crowd_data": crowd_data,
        "temple_metrics": temple_metrics,
    }


_FESTIVAL_DATA = [
    {"festival": "Diwali", "2022": 4500, "2023": 5200, "2024": 5800},
    {"festival": "Navratri", "2022": 3800, "2023": 4200, "2024": 4900},
    {"festival": "Holi", "2022": 3200, "2023": 3600, "2024": 4100},
    {"festival": "Janmashtami", "2022": 2800, "2023": 3100, "2024": 3500},
]


def _analytics_from_results() -> dict[str, object] | None:
    rows = results_store.forecast_rows()
    summary = {r["model"]: r for r in results_store.table("final_accuracy_summary.csv") if r["task"].startswith("Next-hour")}
    lstm = summary.get("CSRNet + LSTM (predictive)")
    if not rows or lstm is None:
        return None

    days: dict[str, list] = defaultdict(list)
    for r in rows:
        days[r.ts.strftime("%d %b")].append(r)
    historical = [
        {
            "month": day,
            "actual": round(sum(x.true_next for x in rs) / len(rs)),
            "predicted": round(sum(x.lstm for x in rs) / len(rs)),
            "accuracy": round(sum(x.lstm_accuracy for x in rs) / len(rs), 1),
        }
        for day, rs in days.items()
    ]

    crit = next((r for r in results_store.table("usecase_comparison.csv") if "LSTM" in next(iter(r.values()))), None)
    recall = f"{float(crit['crit_recall']) * 100:.1f}%" if crit else "n/a"
    metrics = [
        {"metric": "MAE (Mean Absolute Error)", "value": f"+/-{float(lstm['MAE']):.1f} people", "description": "Average next-hour forecast error (CSRNet + LSTM, test set)"},
        {"metric": "RMSE (Root Mean Squared Error)", "value": f"{float(lstm['RMSE']):.1f}", "description": "Standard deviation of forecast errors"},
        {"metric": "Model Accuracy", "value": f"{float(lstm['accuracy_pct']):.1f}%", "description": "100 - MAPE on held-out test hours"},
        {"metric": "Critical-hour Recall", "value": recall, "description": "Share of hours >= 200 people flagged one hour ahead"},
    ]
    return {"historical_data": historical, "festival_data": None, "accuracy_metrics": metrics}


@router.get("/analytics-data")
def get_analytics_data() -> dict[str, object]:
    real = _analytics_from_results()
    if real is not None:
        real["festival_data"] = _FESTIVAL_DATA
        return real

    historical_data = [
        {"month": "Jan", "actual": 2400, "predicted": 2210, "accuracy": 92},
        {"month": "Feb", "actual": 3210, "predicted": 2990, "accuracy": 94},
        {"month": "Mar", "actual": 2290, "predicted": 2000, "accuracy": 88},
        {"month": "Apr", "actual": 2390, "predicted": 2108, "accuracy": 96},
        {"month": "May", "actual": 2490, "predicted": 2200, "accuracy": 95},
        {"month": "Jun", "actual": 2590, "predicted": 2100, "accuracy": 97},
    ]

    festival_data = _FESTIVAL_DATA


    accuracy_metrics = [
        {
            "metric": "MAE (Mean Absolute Error)",
            "value": "+/-245 people",
            "description": "Average prediction variance",
        },
        {
            "metric": "RMSE (Root Mean Squared Error)",
            "value": "312",
            "description": "Standard deviation of errors",
        },
        {
            "metric": "Model Accuracy",
            "value": "99.2%",
            "description": "Overall prediction success rate",
        },
        {
            "metric": "Peak Hour Accuracy",
            "value": "97.8%",
            "description": "Accuracy during high traffic",
        },
    ]

    return {
        "historical_data": historical_data,
        "festival_data": festival_data,
        "accuracy_metrics": accuracy_metrics,
    }


def _alerts_from_results(end: str | None = None) -> dict[str, object] | None:
    all_rows = results_store.forecast_rows()
    if not all_rows:
        return None
    rows = all_rows[: _anchor(all_rows, end) + 1]
    flagged = [(r, count_level(r.lstm)) for r in rows[-72:] if count_level(r.lstm) in ("Warning", "Critical")][-5:][::-1]
    alerts = []
    for i, (r, level) in enumerate(flagged, 1):
        crit = level == "Critical"
        alerts.append(
            {
                "id": i,
                "temple": "Camera stream (test replay)",
                "severity": level,
                "type": "Crowd Surge" if crit else "Capacity Alert",
                "message": f"LSTM forecast {round(r.lstm)} people for this hour (actual {round(r.true_next)}); level {level}.",
                "timestamp": r.ts.strftime("%Y-%m-%d %H:%M:%S"),
                "escalation": "Level 3" if crit else "Level 2",
                "response": "Deploy crowd marshals and open overflow lanes." if crit else "Increase monitoring and prepare staff.",
                "status": "Active" if crit else "Monitoring",
            }
        )
    if not alerts:
        return None
    return {
        "critical_count": sum(1 for a in alerts if a["severity"] == "Critical"),
        "warning_count": sum(1 for a in alerts if a["severity"] == "Warning"),
        "safe_count": sum(1 for a in alerts if a["severity"] == "Safe"),
        "alerts": alerts,
    }


def _alerts_from_cameras() -> dict[str, object] | None:
    try:
        rows = recent_alerts()
    except Exception:
        return None
    if not rows:
        return None
    alerts = []
    for i, r in enumerate(rows, 1):
        crit = r["level"] == "Critical"
        alerts.append(
            {
                "id": i,
                "temple": r["temple"],
                "severity": r["level"],
                "type": "Crowd Surge" if crit else "Capacity Alert",
                "message": f"{r['camera']}: {round(r['count'])} people counted ({round(r['count'] / r['capacity'] * 100)}% of temple capacity).",
                "timestamp": r["ts"].replace("T", " ")[:19],
                "escalation": "Level 3" if crit else "Level 2",
                "response": "Deploy crowd marshals and open overflow lanes." if crit else "Increase monitoring and prepare staff.",
                "status": "Active" if crit else "Monitoring",
                "camera_reading": True,
            }
        )
    return {
        "critical_count": sum(1 for a in alerts if a["severity"] == "Critical"),
        "warning_count": sum(1 for a in alerts if a["severity"] == "Warning"),
        "safe_count": 0,
        "alerts": alerts,
    }


@router.get("/alerts-data")
def get_alerts_data(end: str | None = None) -> dict[str, object]:
    live = _alerts_from_cameras()
    if live is not None:
        return live
    real = _alerts_from_results(end)
    if real is not None:
        return real

    alerts = [
        {
            "id": 1,
            "temple": "Somnath Temple",
            "severity": "Critical",
            "type": "Crowd Surge",
            "message": "Predicted surge of 35% in next 2 hours. Current capacity at 85%.",
            "timestamp": "2024-02-26 14:32:15",
            "escalation": "Level 3",
            "response": "Medical team mobilized. Barrier reinforcement initiated.",
            "status": "Active",
        },
        {
            "id": 2,
            "temple": "Dwarkadhish Temple",
            "severity": "Warning",
            "type": "Capacity Alert",
            "message": "Approaching maximum capacity. 68% of current limit reached.",
            "timestamp": "2024-02-26 14:28:43",
            "escalation": "Level 2",
            "response": "Additional staff deployed to entrance.",
            "status": "Active",
        },
        {
            "id": 3,
            "temple": "Ramnath Temple",
            "severity": "Safe",
            "type": "Routine Monitor",
            "message": "Crowd density within normal parameters. All systems nominal.",
            "timestamp": "2024-02-26 14:25:20",
            "escalation": "Level 1",
            "response": "Standard monitoring continues.",
            "status": "Monitoring",
        },
        {
            "id": 4,
            "temple": "Somnath Temple",
            "severity": "Warning",
            "type": "Medical Response",
            "message": "Medical station reports increased footfall. Additional medics requested.",
            "timestamp": "2024-02-26 14:22:10",
            "escalation": "Level 2",
            "response": "EMT unit 2 redirected to medical station.",
            "status": "Active",
        },
        {
            "id": 5,
            "temple": "Dwarkadhish Temple",
            "severity": "Safe",
            "type": "Accessibility Alert",
            "message": "Elderly assistance queue slightly elevated but manageable.",
            "timestamp": "2024-02-26 14:18:05",
            "escalation": "Level 1",
            "response": "Monitoring elderly lane occupancy.",
            "status": "Monitoring",
        },
    ]

    return {
        "critical_count": sum(1 for a in alerts if a["severity"] == "Critical"),
        "warning_count": sum(1 for a in alerts if a["severity"] == "Warning"),
        "safe_count": sum(1 for a in alerts if a["severity"] == "Safe"),
        "alerts": alerts,
    }
