from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import db
from services.capture import capture_camera, mark_error

logger = logging.getLogger("crowd.poller")
RETENTION_DAYS = 30


def _due() -> list[int]:
    now = datetime.now(timezone.utc)
    due = []
    with db.connect() as c:
        for cam in db.rows(c.execute("SELECT id, interval_seconds, last_polled_at FROM cameras WHERE enabled=1 AND source_type!='push'")):
            last = cam["last_polled_at"]
            if not last or now - datetime.fromisoformat(last) >= timedelta(seconds=cam["interval_seconds"]):
                due.append(cam["id"])
    return due


def _poll_one(camera_id: int) -> None:
    try:
        capture_camera(camera_id)
    except Exception as exc:  # recorded on the camera row; the poller keeps going
        logger.warning("camera %s: %s", camera_id, exc)
        try:
            mark_error(camera_id, str(exc))
        except Exception:
            pass


def _purge() -> None:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)).isoformat(timespec="seconds")
    with db.connect() as c:
        c.execute("DELETE FROM readings WHERE ts<?", (cutoff,))


async def poll_forever() -> None:
    last_purge = 0.0
    loop = asyncio.get_running_loop()
    while True:
        try:
            for camera_id in await asyncio.to_thread(_due):
                await asyncio.to_thread(_poll_one, camera_id)
            if loop.time() - last_purge > 3600:
                await asyncio.to_thread(_purge)
                last_purge = loop.time()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("poller iteration failed")
        await asyncio.sleep(2)
