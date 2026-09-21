from __future__ import annotations

import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, model_validator

import db
from services.capture import FRAMES_DIR, capture_camera, load_camera, mark_error, process_frame
from services.frames import SOURCE_TYPES, validate_source
from services.status import COLORS, camera_view, latest_readings, temple_status

router = APIRouter(tags=["temples"])


def require_admin(x_api_key: str | None = Header(default=None)) -> None:
    """If ADMIN_API_KEY is set on the server, every management call must send it as X-API-Key."""
    expected = os.getenv("ADMIN_API_KEY")
    if expected and not secrets.compare_digest(x_api_key or "", expected):
        raise HTTPException(status_code=401, detail="Missing or wrong X-API-Key.")


admin = Depends(require_admin)


# ------------------------------------------------------------------ schemas
class TempleIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    deity: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=80)
    state: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=300)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    capacity: int = Field(gt=0, description="Maximum safe number of people present at once")
    area_m2: float | None = Field(default=None, gt=0)
    warn: float | None = Field(default=None, gt=0, description="People at which the temple becomes Warning (default 70 % of capacity)")
    crit: float | None = Field(default=None, gt=0, description="People at which the temple becomes Critical (default 90 % of capacity)")
    opening_time: str | None = Field(default=None, max_length=10)
    closing_time: str | None = Field(default=None, max_length=10)
    contact_name: str | None = Field(default=None, max_length=120)
    contact_phone: str | None = Field(default=None, max_length=40)
    contact_email: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _thresholds(self) -> "TempleIn":
        if (self.warn is None) != (self.crit is None):
            raise ValueError("Set both warn and crit, or leave both empty to use 70 % / 90 % of capacity.")
        if self.warn is not None and self.crit is not None and self.warn >= self.crit:
            raise ValueError("warn must be smaller than crit.")
        return self


class CameraIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    source_type: Literal["snapshot", "mjpeg", "stream", "push", "file", "demo"]
    url: str | None = Field(default=None, max_length=600)
    area_m2: float | None = Field(default=None, gt=0, description="Ground area the camera covers (enables people/m2)")
    zone_capacity: int | None = Field(default=None, gt=0, description="Safe capacity of the zone in view (optional)")
    interval_seconds: int = Field(default=60, ge=5, le=3600)
    enabled: bool = True

    @model_validator(mode="after")
    def _source(self) -> "CameraIn":
        validate_source(self.source_type, self.url)
        return self


def _temple_values(t: TempleIn) -> dict:
    d = t.model_dump()
    if d["warn"] is None:
        d["warn"], d["crit"] = round(0.7 * t.capacity), round(0.9 * t.capacity)
    return d


def _get_temple(c: sqlite3.Connection, temple_id: int) -> dict:
    t = db.one(c.execute("SELECT * FROM temples WHERE id=?", (temple_id,)))
    if not t:
        raise HTTPException(status_code=404, detail="Temple not found.")
    return t


# ------------------------------------------------------------------ temples
@router.get("/temples")
def list_temples() -> dict:
    with db.connect() as c:
        temples = db.rows(c.execute("SELECT * FROM temples ORDER BY name"))
        items = [temple_status(c, t) for t in temples]
    for i, t in enumerate(items):
        t["color"] = COLORS[i % len(COLORS)]
    return {"temples": items}


@router.post("/temples", status_code=201, dependencies=[admin])
def create_temple(body: TempleIn) -> dict:
    v = _temple_values(body)
    cols = ", ".join(v)
    marks = ", ".join("?" for _ in v)
    try:
        with db.connect() as c:
            cur = c.execute(f"INSERT INTO temples ({cols}, created_at) VALUES ({marks}, ?)", (*v.values(), db.now_iso()))
            return temple_status(c, _get_temple(c, cur.lastrowid), with_cameras=True)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="A temple with this name already exists.") from exc


@router.get("/temples/{temple_id}")
def get_temple(temple_id: int) -> dict:
    with db.connect() as c:
        return temple_status(c, _get_temple(c, temple_id), with_cameras=True)


@router.put("/temples/{temple_id}", dependencies=[admin])
def update_temple(temple_id: int, body: TempleIn) -> dict:
    v = _temple_values(body)
    sets = ", ".join(f"{k}=?" for k in v)
    try:
        with db.connect() as c:
            _get_temple(c, temple_id)
            c.execute(f"UPDATE temples SET {sets} WHERE id=?", (*v.values(), temple_id))
            return temple_status(c, _get_temple(c, temple_id), with_cameras=True)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="A temple with this name already exists.") from exc


@router.delete("/temples/{temple_id}", status_code=204, response_class=Response, dependencies=[admin])
def delete_temple(temple_id: int):
    with db.connect() as c:
        _get_temple(c, temple_id)
        ids = [r["id"] for r in db.rows(c.execute("SELECT id FROM cameras WHERE temple_id=?", (temple_id,)))]
        c.execute("DELETE FROM temples WHERE id=?", (temple_id,))
    for cid in ids:
        (FRAMES_DIR / f"{cid}.jpg").unlink(missing_ok=True)


@router.get("/temples/{temple_id}/readings")
def temple_readings(temple_id: int, hours: int = Query(24, ge=1, le=720), bucket_minutes: int = Query(5, ge=1, le=240)) -> dict:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat(timespec="seconds")
    with db.connect() as c:
        t = _get_temple(c, temple_id)
        raw = db.rows(c.execute("SELECT ts, camera_id, count FROM readings WHERE temple_id=? AND ts>=? ORDER BY ts", (temple_id, since)))
    buckets: dict[str, dict[int, float]] = {}
    for r in raw:
        dt = datetime.fromisoformat(r["ts"])
        floor = dt - timedelta(minutes=dt.minute % bucket_minutes, seconds=dt.second)
        buckets.setdefault(floor.isoformat(timespec="seconds"), {})[r["camera_id"]] = r["count"]  # last reading of the camera in the bucket
    points = [{"ts": k, "total": round(sum(v.values()), 1), "cameras": v} for k, v in sorted(buckets.items())]
    return {"warn": t["warn"], "crit": t["crit"], "capacity": t["capacity"], "points": points}


# ------------------------------------------------------------------ cameras
def _new_key() -> str:
    return secrets.token_urlsafe(24)


@router.post("/temples/{temple_id}/cameras", status_code=201, dependencies=[admin])
def add_camera(temple_id: int, body: CameraIn) -> dict:
    with db.connect() as c:
        _get_temple(c, temple_id)
        cur = c.execute(
            """INSERT INTO cameras(temple_id,name,source_type,url,area_m2,zone_capacity,interval_seconds,enabled,api_key,created_at)
               VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (temple_id, body.name, body.source_type, body.url, body.area_m2, body.zone_capacity, body.interval_seconds,
             int(body.enabled), _new_key(), db.now_iso()),
        )
        cam = db.one(c.execute("SELECT * FROM cameras WHERE id=?", (cur.lastrowid,)))
    return {**camera_view(cam, None), "api_key": cam["api_key"]}


@router.put("/cameras/{camera_id}", dependencies=[admin])
def update_camera(camera_id: int, body: CameraIn) -> dict:
    with db.connect() as c:
        if not db.one(c.execute("SELECT id FROM cameras WHERE id=?", (camera_id,))):
            raise HTTPException(status_code=404, detail="Camera not found.")
        url = body.url
        if url and "***@" in url:  # the client echoed the masked url back: keep the stored credentials
            url = db.one(c.execute("SELECT url FROM cameras WHERE id=?", (camera_id,)))["url"]
        c.execute(
            "UPDATE cameras SET name=?, source_type=?, url=?, area_m2=?, zone_capacity=?, interval_seconds=?, enabled=? WHERE id=?",
            (body.name, body.source_type, url, body.area_m2, body.zone_capacity, body.interval_seconds, int(body.enabled), camera_id),
        )
        cam = db.one(c.execute("SELECT * FROM cameras WHERE id=?", (camera_id,)))
        latest = latest_readings(c, cam["temple_id"]).get(camera_id)
    return camera_view(cam, latest)


@router.delete("/cameras/{camera_id}", status_code=204, response_class=Response, dependencies=[admin])
def delete_camera(camera_id: int):
    with db.connect() as c:
        if not db.one(c.execute("SELECT id FROM cameras WHERE id=?", (camera_id,))):
            raise HTTPException(status_code=404, detail="Camera not found.")
        c.execute("DELETE FROM cameras WHERE id=?", (camera_id,))
    (FRAMES_DIR / f"{camera_id}.jpg").unlink(missing_ok=True)


@router.get("/cameras/{camera_id}/integration", dependencies=[admin])
def camera_integration(camera_id: int) -> dict:
    """Ingest URL and ready-to-paste snippets for pushing frames from a camera / edge device."""
    cam, _ = load_camera_or_404(camera_id)
    path = f"/ingest/{cam['api_key']}"
    return {
        "camera_id": camera_id,
        "source_type": cam["source_type"],
        "ingest_path": path,
        "curl": f'curl -X POST "$API_BASE{path}" -F "image=@frame.jpg"',
        "ffmpeg_loop": (
            "while true; do ffmpeg -loglevel error -y -rtsp_transport tcp -i \"rtsp://USER:PASS@CAMERA_IP/stream\" "
            f"-frames:v 1 frame.jpg && curl -s -X POST \"$API_BASE{path}\" -F \"image=@frame.jpg\"; sleep 30; done"
        ),
        "python": (
            "import requests\n"
            f"requests.post(API_BASE + '{path}', files={{'image': open('frame.jpg', 'rb')}}, timeout=30)"
        ),
    }


def load_camera_or_404(camera_id: int):
    try:
        return load_camera(camera_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Camera not found.") from exc


@router.post("/cameras/{camera_id}/capture", dependencies=[admin])
def capture_now(camera_id: int, store: bool = Query(True, description="false = test the feed without saving a reading")) -> dict:
    cam, _ = load_camera_or_404(camera_id)
    if cam["source_type"] == "push":
        raise HTTPException(status_code=400, detail="Push cameras send their own frames to the ingest URL; nothing to pull.")
    try:
        return capture_camera(camera_id, store, randomize=True)  # manual click: random dataset image for demo cameras
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not read the camera: {exc}") from exc


@router.post("/ingest/{api_key}")
async def ingest_frame(api_key: str, image: UploadFile = File(...)) -> dict:
    """Push endpoint for cameras / edge devices. The per-camera key in the URL is the credential."""
    with db.connect() as c:
        cam = db.one(c.execute("SELECT id, enabled FROM cameras WHERE api_key=?", (api_key,)))
    if not cam or not cam["enabled"]:
        raise HTTPException(status_code=404, detail="Unknown or disabled camera key.")
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image.")
    try:
        r = process_frame(cam["id"], data)
    except ValueError as exc:
        mark_error(cam["id"], str(exc))
        raise HTTPException(status_code=400, detail="Not a valid image.") from exc
    return {"ts": r["ts"], "count": r["count"], "level": r["level"], "source": r["source"]}


@router.get("/cameras/{camera_id}/latest.jpg")
def latest_frame(camera_id: int) -> FileResponse:
    path = FRAMES_DIR / f"{camera_id}.jpg"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No frame captured yet.")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "no-store"})
