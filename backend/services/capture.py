from __future__ import annotations

import base64
import logging
import os
from pathlib import Path

import db
from services import demo_feed
from services.frames import grab_frame
from services.pipeline import analyze_image_bytes

logger = logging.getLogger("crowd.capture")
FRAMES_DIR = Path(__file__).resolve().parents[1] / "data" / "frames"
STALE_MINUTES = int(os.getenv("STALE_MINUTES", "15"))


def levels_for(camera: dict, temple: dict) -> tuple[float, float]:
    """A camera with a zone capacity is judged against 70 % / 90 % of that zone; otherwise against the temple thresholds."""
    zone = camera.get("zone_capacity")
    if zone:
        return 0.7 * zone, 0.9 * zone
    return temple["warn"], temple["crit"]


def _save_overlay(camera_id: int, data_uri: str) -> None:
    try:
        FRAMES_DIR.mkdir(parents=True, exist_ok=True)
        (FRAMES_DIR / f"{camera_id}.jpg").write_bytes(base64.b64decode(data_uri.split(",", 1)[1]))
    except Exception:
        logger.exception("could not save overlay for camera %s", camera_id)


def load_camera(camera_id: int) -> tuple[dict, dict]:
    with db.connect() as c:
        cam = db.one(c.execute("SELECT * FROM cameras WHERE id=?", (camera_id,)))
        if not cam:
            raise LookupError("camera not found")
        temple = db.one(c.execute("SELECT * FROM temples WHERE id=?", (cam["temple_id"],)))
    return cam, temple


def process_frame(camera_id: int, image_bytes: bytes, store: bool = True) -> dict:
    cam, temple = load_camera(camera_id)
    warn, crit = levels_for(cam, temple)
    result = analyze_image_bytes(image_bytes, warn, crit, cam.get("area_m2") or None)
    ts = db.now_iso()
    if store:
        with db.connect() as c:
            c.execute(
                "INSERT INTO readings(camera_id,temple_id,ts,count,level,people_per_megapixel,people_per_m2,source) VALUES(?,?,?,?,?,?,?,?)",
                (
                    camera_id, cam["temple_id"], ts, result["count"], result["level"],
                    result["density"].get("people_per_megapixel"), result["density"].get("people_per_m2"), result["source"],
                ),
            )
            c.execute("UPDATE cameras SET last_polled_at=?, last_status='ok', last_error=NULL WHERE id=?", (ts, camera_id))
        _save_overlay(camera_id, result["overlay_image"])
    return {**result, "ts": ts, "camera_id": camera_id, "temple_id": cam["temple_id"], "stored": store}


def mark_error(camera_id: int, message: str) -> None:
    with db.connect() as c:
        c.execute("UPDATE cameras SET last_polled_at=?, last_status='error', last_error=? WHERE id=?", (db.now_iso(), message[:300], camera_id))


def replay_reading(camera: dict, store: bool = True) -> dict:
    """Demo camera without the ShanghaiTech images on disk: store the CSRNet count already measured on the chosen test image."""
    from datetime import datetime, timezone

    cam, temple = load_camera(camera["id"])
    row = demo_feed.choose(cam.get("url") or "generic", cam.get("zone_capacity") or 300, datetime.now(timezone.utc))
    warn, crit = levels_for(cam, temple)
    count = row["predicted"]
    level = "Safe" if count < warn else "Warning" if count < crit else "Critical"
    ts = db.now_iso()
    area = cam.get("area_m2")
    if store:
        with db.connect() as c:
            c.execute(
                "INSERT INTO readings(camera_id,temple_id,ts,count,level,people_per_megapixel,people_per_m2,source) VALUES(?,?,?,?,?,?,?,?)",
                (cam["id"], cam["temple_id"], ts, count, level, round(count / 0.786, 1), round(count / area, 2) if area else None, "replay"),
            )
            c.execute("UPDATE cameras SET last_polled_at=?, last_status='ok', last_error=NULL WHERE id=?", (ts, cam["id"]))
    return {"ts": ts, "camera_id": cam["id"], "temple_id": cam["temple_id"], "count": count, "level": level, "source": "replay", "stored": store}


def capture_camera(camera_id: int, store: bool = True) -> dict:
    """Pull one frame from the camera source, analyse it and (optionally) store the reading."""
    cam, _ = load_camera(camera_id)
    try:
        if cam["source_type"] == "demo" and not demo_feed.images_available():
            return replay_reading(cam, store)
        frame = grab_frame(cam)
        return process_frame(camera_id, frame, store)
    except Exception as exc:
        mark_error(camera_id, str(exc))
        raise
