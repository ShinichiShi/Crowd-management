from __future__ import annotations

from datetime import datetime, timedelta, timezone

import db
from services.capture import FRAMES_DIR, STALE_MINUTES
from utils.risk import count_level

import re

COLORS = ["#EA6E3C", "#4C3A7F", "#10B981", "#F59E0B", "#3B82F6", "#EC4899", "#14B8A6", "#8B5CF6"]


def _cutoff() -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=STALE_MINUTES)).isoformat(timespec="seconds")


def latest_readings(c, temple_id: int) -> dict[int, dict]:
    cur = c.execute(
        """SELECT r.* FROM readings r JOIN
           (SELECT camera_id, MAX(ts) AS mts FROM readings WHERE temple_id=? GROUP BY camera_id) m
           ON r.camera_id=m.camera_id AND r.ts=m.mts""",
        (temple_id,),
    )
    return {r["camera_id"]: r for r in db.rows(cur)}


def mask_url(url: str | None) -> str | None:
    """rtsp://user:pass@host/x -> rtsp://***@host/x  (credentials never leave the server)."""
    return re.sub(r"(?<=//)[^/@]*@", "***@", url) if url else url


def camera_view(cam: dict, latest: dict | None) -> dict:
    fresh = bool(latest and latest["ts"] >= _cutoff())
    public = {k: v for k, v in cam.items() if k != "api_key"}
    public["url"] = mask_url(public.get("url"))
    return {
        **public,
        "enabled": bool(cam["enabled"]),
        "latest": latest,
        "online": fresh,
        "has_frame": (FRAMES_DIR / f"{cam['id']}.jpg").exists(),
    }


def temple_status(c, temple: dict, with_cameras: bool = False) -> dict:
    cams = db.rows(c.execute("SELECT * FROM cameras WHERE temple_id=? ORDER BY id", (temple["id"],)))
    latest = latest_readings(c, temple["id"])
    views = [camera_view(cam, latest.get(cam["id"])) for cam in cams]
    fresh = [v for v in views if v["online"]]
    total = round(sum(v["latest"]["count"] for v in fresh), 1) if fresh else None
    level = count_level(total, temple["warn"], temple["crit"]) if total is not None else "No data"
    out = {
        **temple,
        "current_count": total,
        "occupancy_pct": round(total / temple["capacity"] * 100, 1) if total is not None else None,
        "level": level,
        "cameras_total": len(cams),
        "cameras_online": len(fresh),
        "last_update": max((v["latest"]["ts"] for v in views if v["latest"]), default=None),
    }
    if with_cameras:
        out["cameras"] = views
    return out


def recent_alerts(hours: int = 24, limit: int = 8) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat(timespec="seconds")
    with db.connect() as c:
        return db.rows(
            c.execute(
                """SELECT r.ts, r.count, r.level, r.source, t.name AS temple, t.capacity, cam.name AS camera
                   FROM readings r JOIN temples t ON t.id=r.temple_id JOIN cameras cam ON cam.id=r.camera_id
                   WHERE r.level IN ('Warning','Critical') AND r.ts>=? ORDER BY r.ts DESC LIMIT ?""",
                (since, limit),
            )
        )
