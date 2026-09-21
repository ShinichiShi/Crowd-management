from __future__ import annotations

import os
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

MAX_BYTES = 15 * 1024 * 1024
SOURCE_TYPES = ("snapshot", "mjpeg", "stream", "push", "file", "demo")
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def validate_source(source_type: str, url: str | None) -> None:
    """Raise ValueError with a readable message if the camera source is not acceptable."""
    if source_type not in SOURCE_TYPES:
        raise ValueError(f"source_type must be one of {', '.join(SOURCE_TYPES)}")
    if source_type in ("push", "demo"):  # demo: url is an optional profile name (somnath, dwarka, rameswaram, nathdwara, generic)
        return
    if not url:
        raise ValueError("url is required for this source type")
    if source_type in ("snapshot", "mjpeg"):
        p = urlparse(url)
        if p.scheme not in ("http", "https") or not p.netloc:
            raise ValueError("url must be an http(s) address")
    elif source_type == "stream":
        p = urlparse(url)
        if not (url.isdigit() or p.scheme in ("rtsp", "rtsps", "rtmp", "http", "https")):
            raise ValueError("stream url must be rtsp://, rtmp://, http(s):// or a webcam index such as 0")
    elif source_type == "file":
        if os.getenv("ALLOW_FILE_CAMERAS", "0") != "1":
            raise ValueError("file sources are disabled (set ALLOW_FILE_CAMERAS=1 on the server)")
        if not Path(url).expanduser().exists():
            raise ValueError("file does not exist on the server")


def _http_get(url: str, timeout: float = 10.0) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "crowd-management/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - scheme validated above
        data = resp.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("snapshot is larger than 15 MB")
    return data


def _mjpeg(url: str, timeout: float = 10.0) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "crowd-management/1.0"})
    buf = b""
    deadline = time.time() + timeout
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
        while time.time() < deadline and len(buf) < MAX_BYTES:
            chunk = resp.read(16384)
            if not chunk:
                break
            buf += chunk
            start = buf.find(b"\xff\xd8")
            if start >= 0:
                end = buf.find(b"\xff\xd9", start + 2)
                if end >= 0:
                    return buf[start : end + 2]
    raise ValueError("no JPEG frame found in the MJPEG stream")


def _cv2_frame(source: str | int, pick_by_time: bool = False, interval: int = 60) -> bytes:
    try:
        import cv2
    except ImportError as exc:
        raise ValueError("OpenCV is not installed on the server (pip install opencv-python-headless)") from exc
    cap = cv2.VideoCapture(source)
    try:
        if not cap.isOpened():
            raise ValueError("could not open the video source")
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if pick_by_time and total > 1:  # emulate a live feed from a recorded video
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(time.time() // max(interval, 1)) % total)
        ok, frame = cap.read()
        if not ok:
            raise ValueError("could not read a frame from the video source")
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
        if not ok:
            raise ValueError("could not encode the frame")
        return buf.tobytes()
    finally:
        cap.release()


def grab_frame(camera: dict) -> bytes:
    kind, url = camera["source_type"], camera.get("url")
    if kind == "snapshot":
        return _http_get(url)
    if kind == "mjpeg":
        return _mjpeg(url)
    if kind == "stream":
        return _cv2_frame(int(url) if url.isdigit() else url)
    if kind == "demo":
        from services.demo_feed import frame_bytes

        return frame_bytes(camera)
    if kind == "file":
        path = Path(url).expanduser()
        if path.suffix.lower() in IMAGE_EXT:
            return path.read_bytes()
        return _cv2_frame(str(path), pick_by_time=True, interval=camera.get("interval_seconds") or 60)
    raise ValueError("push cameras are not polled: send frames to /ingest/<api_key>")
