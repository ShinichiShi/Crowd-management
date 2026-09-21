from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

DB_PATH = Path(os.getenv("CROWD_DB") or Path(__file__).resolve().parent / "data" / "crowd.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS temples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  deity TEXT, city TEXT, state TEXT, address TEXT,
  latitude REAL, longitude REAL,
  capacity INTEGER NOT NULL,
  area_m2 REAL,
  warn REAL NOT NULL,
  crit REAL NOT NULL,
  opening_time TEXT, closing_time TEXT,
  contact_name TEXT, contact_phone TEXT, contact_email TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cameras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  temple_id INTEGER NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT,
  area_m2 REAL,
  zone_capacity INTEGER,
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  enabled INTEGER NOT NULL DEFAULT 1,
  api_key TEXT NOT NULL UNIQUE,
  last_polled_at TEXT, last_status TEXT, last_error TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  camera_id INTEGER NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  temple_id INTEGER NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  ts TEXT NOT NULL,
  count REAL NOT NULL,
  level TEXT NOT NULL,
  people_per_megapixel REAL,
  people_per_m2 REAL,
  source TEXT
);
CREATE INDEX IF NOT EXISTS idx_readings_temple_ts ON readings(temple_id, ts);
CREATE INDEX IF NOT EXISTS idx_readings_camera_ts ON readings(camera_id, ts);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def init() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as c:
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript(SCHEMA)


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    con = sqlite3.connect(DB_PATH, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def rows(cur: sqlite3.Cursor) -> list[dict[str, Any]]:
    return [dict(r) for r in cur.fetchall()]


def one(cur: sqlite3.Cursor) -> dict[str, Any] | None:
    r = cur.fetchone()
    return dict(r) if r else None
