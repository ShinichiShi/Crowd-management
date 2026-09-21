#!/usr/bin/env python
"""Seed demo temples with cameras and ~2 days of history built from the ShanghaiTech test images.

Each camera is a `demo` feed: the server keeps replaying test images through the real CSRNet pipeline following a
temple-specific daily pattern, so the dashboard stays live. History readings use the CSRNet counts already measured on
those images (results/final_test_predictions.csv), so the curves start immediately.

  python scripts/seed_demo.py            # create the 4 demo temples (skips names that already exist)
  python scripts/seed_demo.py --reset    # delete and recreate the demo temples
  python scripts/seed_demo.py --hours 72 # longer history
"""
from __future__ import annotations

import argparse
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import db  # noqa: E402
from services import demo_feed  # noqa: E402
from services.capture import levels_for  # noqa: E402

TEMPLES = [
    dict(name="Somnath Temple", deity="Shiva", city="Veraval", state="Gujarat", address="Somnath Mandir Rd, Prabhas Patan",
         latitude=20.888, longitude=70.401, capacity=1000, area_m2=6000, opening_time="06:00", closing_time="21:30",
         contact_name="Somnath Trust control room", contact_phone="+91 2876 231 212", profile="somnath",
         notes="Aarti at 7:00 and 19:00; sea-facing queue on weekends.",
         cameras=[("Main gate", 400, 220), ("Sabha mandap", 350, 180), ("Sagar darshan path", 450, 260)]),
    dict(name="Dwarkadhish Temple", deity="Krishna", city="Dwarka", state="Gujarat", address="Jagat Mandir, Dwarka",
         latitude=22.238, longitude=68.968, capacity=850, area_m2=4500, opening_time="06:30", closing_time="21:00",
         contact_name="Temple office", contact_phone="+91 2892 234 080", profile="dwarka",
         notes="Janmashtami brings the largest crowds.",
         cameras=[("Jagat mandir entrance", 450, 240), ("Swarga dwar ghat", 450, 300)]),
    dict(name="Ramanathaswamy Temple", deity="Shiva", city="Rameswaram", state="Tamil Nadu", address="East Car St, Rameswaram",
         latitude=9.288, longitude=79.317, capacity=1100, area_m2=7500, opening_time="05:00", closing_time="21:00",
         contact_name="Devasthanam control room", contact_phone="+91 4573 221 223", profile="rameswaram",
         notes="Early-morning theertham bathing peak.",
         cameras=[("East gopuram", 500, 320), ("Third corridor", 500, 350)]),
    dict(name="Shreenathji Temple", deity="Krishna", city="Nathdwara", state="Rajasthan", address="Nathdwara, Rajsamand",
         latitude=24.936, longitude=73.823, capacity=600, area_m2=3000, opening_time="05:30", closing_time="20:30",
         contact_name="Tilkayat office", contact_phone="+91 2953 231 001", profile="nathdwara",
         notes="Eight darshan windows (jhankis) create sharp peaks.",
         cameras=[("Darshan queue", 350, 200), ("Main courtyard", 350, 240)]),
]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--reset", action="store_true", help="delete existing demo temples first")
    ap.add_argument("--hours", type=int, default=48, help="hours of history to create (default 48)")
    ap.add_argument("--step", type=int, default=10, help="minutes between history readings (default 10)")
    args = ap.parse_args()

    db.init()
    end = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    start = end - timedelta(hours=args.hours)
    for t in TEMPLES:
        with db.connect() as c:
            existing = db.one(c.execute("SELECT id FROM temples WHERE name=?", (t["name"],)))
            if existing and not args.reset:
                print(f"skip {t['name']} (exists; use --reset to recreate)")
                continue
            if existing:
                c.execute("DELETE FROM temples WHERE id=?", (existing["id"],))
            cap = t["capacity"]
            tid = c.execute(
                """INSERT INTO temples(name,deity,city,state,address,latitude,longitude,capacity,area_m2,warn,crit,opening_time,closing_time,
                   contact_name,contact_phone,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (t["name"], t["deity"], t["city"], t["state"], t["address"], t["latitude"], t["longitude"], cap, t["area_m2"],
                 round(0.7 * cap), round(0.9 * cap), t["opening_time"], t["closing_time"], t["contact_name"], t["contact_phone"],
                 t["notes"], db.now_iso()),
            ).lastrowid
            temple = db.one(c.execute("SELECT * FROM temples WHERE id=?", (tid,)))
            n = 0
            for name, zone, area in t["cameras"]:
                cid = c.execute(
                    """INSERT INTO cameras(temple_id,name,source_type,url,area_m2,zone_capacity,interval_seconds,enabled,api_key,created_at)
                       VALUES(?,?,?,?,?,?,?,?,?,?)""",
                    (tid, name, "demo", t["profile"], area, zone, 300, 1, secrets.token_urlsafe(24), db.now_iso()),
                ).lastrowid
                cam = {"zone_capacity": zone}
                warn, crit = levels_for(cam, temple)
                rows = []
                for when, img in demo_feed.history(t["profile"], zone, start, end - timedelta(minutes=5), args.step):
                    count = img["predicted"]  # CSRNet count already measured on this test image
                    level = "Safe" if count < warn else "Warning" if count < crit else "Critical"
                    rows.append((cid, tid, when.isoformat(timespec="seconds"), count, level, round(count / 0.786, 1), round(count / area, 2), "replay"))
                c.executemany(
                    "INSERT INTO readings(camera_id,temple_id,ts,count,level,people_per_megapixel,people_per_m2,source) VALUES(?,?,?,?,?,?,?,?)", rows
                )
                n += len(rows)
        print(f"created {t['name']}: {len(t['cameras'])} cameras, {n} readings")
    print("Done. Cameras are 'demo' feeds: the running API captures a fresh frame every 5 minutes (first one within seconds).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
