# Smart Crowd Management — CSRNet + LSTM

Count the people in a camera frame, forecast the next hour, and turn both into a risk level for a temple/event dashboard.

| Piece | What it is | Where |
|---|---|---|
| **CSRNet** | Deep network that turns a photo into a *density map*; its sum is the head count | `kaggle_model/*.ipynb` → `backend/models/csrnet_model.pth` |
| **LSTM** | Reads the last 24 hourly CSRNet counts and predicts the next hour | `kaggle_model/*.ipynb` → `backend/models/lstm_model.pth` |
| **FastAPI backend** | Serves both models + risk formula + dashboard data, with a `/demo` backup | `backend/` |
| **Next.js frontend** | Dashboard, alerts, analytics; reroutes to `/demo` if the live API fails | `client/` |

## Quick start

```bash
git clone https://github.com/ShinichiShi/Crowd-management.git
cd Crowd-management
./start.sh --seed          # Windows: .\start.ps1 -Seed
```

The first run creates a Python virtual environment, installs the dependencies (CPU-only PyTorch unless an NVIDIA GPU is found) and the Node packages, starts the API and the web app, waits until both answer and prints the addresses:

* Web app: <http://localhost:3000> — dashboard, temples, alerts, analytics (light / dark mode)
* API docs: <http://localhost:8000/docs>

`--seed` adds four demo temples with two days of history so the charts are not empty; leave it out to start empty and register your own temples. Other options: `--prod` (production build of the web app), `--install-only`, `--no-frontend`, `--reset-demo`; environment variables `BACKEND_PORT`, `FRONTEND_PORT`, `HOST` (see `.env.example`). Requirements: Python 3.10+, Node.js 18+, ~1.5 GB of disk. Ctrl-C stops everything; logs are in `logs/`. The trained weights ship in `backend/models/`, so nothing needs training or downloading.

![System architecture](docs/images/system_architecture.png)

---

## 1. Results at a glance

Measured on **held-out test data** in the Kaggle v2 run (T4 GPU, 100 epochs, Part A + B). Every number below is reproducible from the CSVs in [`results/`](results/): [`final_accuracy_summary.csv`](results/final_accuracy_summary.csv), [`final_test_predictions.csv`](results/final_test_predictions.csv) (every test image), [`final_forecast_predictions.csv`](results/final_forecast_predictions.csv) (every test hour), [`usecase_comparison.csv`](results/usecase_comparison.csv), [`lstm_variants.csv`](results/lstm_variants.csv). "Accuracy" = 100 − MAPE.

**Counting people (optimised CSRNet + flip-TTA vs the original notebook recipe)**

| Test set | Model | MAE (people) | RMSE | MAPE | Accuracy | R² | within ±10 % | within ±20 % | risk-level acc. |
|---|---|---|---|---|---|---|---|---|---|
| Part A — dense (182 imgs) | original recipe | 166.03 | 232.93 | 50.9 % | 49.1 % | 0.566 | – | – | – |
| Part A — dense (182 imgs) | **optimised** | **71.11** | **116.19** | **16.7 %** | **83.3 %** | **0.892** | 41.2 % | 68.7 % | 88.5 % |
| Part B — street (316 imgs) | original recipe | 45.99 | 68.22 | 54.4 % | 45.6 % | 0.486 | – | – | – |
| Part B — street (316 imgs) | **optimised** | **12.70** | **24.22** | **10.2 %** | **89.8 %** | **0.935** | 64.2 % | 91.5 % | 92.1 % |

Published CSRNet (paper, ~1000 epochs): Part A MAE 68.2 / RMSE 115.0, Part B MAE 10.6 / RMSE 16.0. An earlier Part-B-only run of this notebook reached MAE 10.31 on B; training on A + B trades ~2.4 people of Part-B accuracy for a model that also handles dense crowds (A: 71 vs 166).

**Forecasting the next hour (1,311 chronological test hours)**

| Method | MAE | RMSE | Accuracy | R² | Risk-level acc. | Surge onsets caught (of 92) | False alarms | Critical precision / recall |
|---|---|---|---|---|---|---|---|---|
| CSRNet only (reactive) | 35.16 | 54.11 | 61.3 % | 0.536 | 71.9 % | **0** | 75 | 59.0 % / 49.3 % |
| CSRNet + moving average (3 h) | 48.80 | 68.07 | 38.1 % | 0.265 | 67.0 % | 1 | 62 | 47.0 % / 25.1 % |
| CSRNet + seasonal (same hour yesterday) | 28.82 | 48.64 | 78.4 % | 0.625 | 78.7 % | 38 | 67 | 63.4 % / 53.0 % |
| **CSRNet + LSTM** | **12.11** | **21.82** | **90.2 %** | **0.924** | **92.7 %** | **63** | **31** | **85.1 % / 80.8 %** |

**Reading this honestly**

* CSRNet alone caught **none** of the 92 surge onsets — by construction it reports the crowd that is already there. CSRNet + LSTM caught 63 (68 %) with less than half the false alarms.
* The LSTM's big gain comes from the **time-of-day features** (see 4.2). The simulated crowd follows a strict hour/weekday pattern, which those features capture directly — on a real temple the gain will depend on how regular the real crowd is.
* Part B accuracy dropped slightly versus a B-only model (12.7 vs 10.3 MAE); dense Part A accuracy is 71 vs 68 in the paper.
* The forecasting stream is **simulated** (ShanghaiTech has no time axis) — see [limitations](#8-limitations).

---

## 2. How it works, end to end

![End-to-end pipeline](docs/images/training_pipeline.png)

1. **Data** — ShanghaiTech: Part A (482 dense internet images) and Part B (716 street-camera images). Every image comes with a `.mat` file of head coordinates.
2. **Density maps** — each head becomes a small Gaussian blob that integrates to exactly 1, so *the sum of the map is the count*.
3. **Train CSRNet** to predict that map from the image.
4. **Evaluate** on images it never saw.
5. **Simulate a camera stream** (ShanghaiTech has no time axis — see [limitations](#8-limitations)).
6. **Train the LSTM** on the counts CSRNet produced.
7. **Compare** CSRNet-only vs CSRNet + LSTM.
8. **Export** weights in the format the backend loads.

### 2.1 Ground truth: points → density map

![Density map generation](docs/images/density_map_generation.png)

Part B uses a fixed Gaussian (σ = 15 px). Part A is far denser and perspective-heavy, so the final model uses *geometry-adaptive* kernels (σᵢ = 0.3 × mean distance to the 3 nearest heads). Targets are built directly on the network's 1/8 output grid, so nothing is resized and the count stays exact.

---

## 3. Model 1 — CSRNet (counting)

![CSRNet architecture](docs/images/csrnet_architecture.png)

* **Frontend** = the first 23 layers of **VGG16** (up to `conv4_3`), pretrained on ImageNet. It extracts features and shrinks the image 8×.
* **Backend** = four **dilated** 3×3 convolutions (rate 2, so each sees a wide context without losing resolution) then a 1×1 conv to a single channel.
* **Output** is a density map at 1/8 resolution; **count = sum of all pixels**.
* 11,543,873 parameters. Checkpoint keys are `frontend.N.*` / `backend.N.*`, saved as a plain `state_dict`.

### 3.1 What was wrong with the original notebook

The old CSV showed predictions ≈ 50 % below the truth. Root causes, all fixed:

| # | Problem | Fix |
|---|---|---|
| 1 | VGG16 built with `weights=None` — pretrained weights **never loaded** | Load ImageNet weights |
| 2 | No ImageNet normalisation in training, but the backend normalises | Same normalisation everywhere |
| 3 | Adam 1e-5 for every layer, constant LR, only 3 of 35 epochs ran | Separate LRs (front 1e-5, back 1e-4), warm-up + cosine |
| 4 | No augmentation, full 768×1024 images | Random crops, flip, colour jitter, mixed precision |
| 5 | CSV and metrics computed on the **training** set, shuffled | Validation split + untouched test set, ordered CSV |
| 6 | Loss printed as a sum, `loss_history = ...` placeholder | Recorded per-epoch train/val curves |
| 7 | `DataParallel` → `module.` key prefix → backend cannot load | Plain `state_dict` |
| 8 | Later cells used undefined variables; CSRNet & LSTM curves plotted the same list | Clean linear pipeline |
| 9 | LSTM was a 20-feature bidirectional+attention model the backend cannot run | Univariate `lstm`+`fc` matching the backend |
| 10 | Early stopping kept a *shallow* copy of weights (so "best" = last) | `copy.deepcopy` |

### 3.2 Training curves

![CSRNet loss curves](docs/images/csrnet_loss_curves.png)

Red = original recipe, green = optimised. The optimised run reaches lower density-MSE and a far lower validation error. The optimised run uses EMA weights and a relative-MAE model-selection criterion (the raw validation MAE of an earlier run swung between 7 and 50 from epoch to epoch).

### 3.3 Test results

![CSRNet test results](docs/images/csrnet_test_results.png)

![CSRNet density samples](docs/images/csrnet_density_samples.png)

Left → right: photo, ground-truth density, predicted density with the predicted count in the title.

---

## 4. Model 2 — LSTM (forecasting) and the use case

![LSTM architecture](docs/images/lstm_architecture.png)

* Input: last **24 hourly CSRNet counts**, min-max scaled with the saved `lstm_scaler.json`, plus 4 time channels (sin/cos of hour and weekday) in the selected model.
* 2-layer LSTM (hidden 64) → last hidden state → `Linear(64→1)` → optional **residual** (add the latest count) → denormalise.
* ~51 K parameters; the exported file carries its own config (`residual`, `time_features`, `sequence_length`, scaler), so the backend adapts automatically.

### 4.1 Why "CSRNet vs CSRNet + LSTM"?

* **CSRNet alone is reactive.** It tells you the crowd *now*. If asked about the next hour it can only assume nothing changes.
* **CSRNet + LSTM is predictive.** It learns daily/weekly rhythm and rising trends, so it can flag a surge *before* the crowd crosses the risk threshold — which is when staff still have time to act.

![LSTM loss and timeline](docs/images/lstm_loss_and_timeline.png)

![Use-case metrics](docs/images/usecase_metrics.png)

![Risk / early warning](docs/images/usecase_risk.png)

Risk levels used in the study: Safe < 100, Warning 100–200, Critical ≥ 200 people. A **surge onset** is an hour where the crowd is still below 200 now but exceeds it next hour — the case where a reactive system is, by construction, too late.

### 4.2 LSTM variant ablation

Five variants were trained automatically; the one with the lowest **validation** loss is exported (`lstm_model.pth` carries its config).

| Variant | Test MAE | Val loss | Surge onsets caught (of 92) | False alarms |
|---|---|---|---|---|
| univariate (run-1 design) | 13.70 | 0.00271 | 55 | 38 |
| + residual output | 13.75 | 0.00285 | 55 | 32 |
| **+ time-of-day features (selected)** | **12.11** | **0.00204** | 63 | 31 |
| + time features + residual | 12.39 | 0.00206 | 68 | 36 |
| + time + residual + peak-weighted loss | 12.67 | 0.00212 | 68 | 35 |

![LSTM variants](docs/images/lstm_variants.png)

Time features are the clear win; residual/peak-weighted variants catch a few more onsets (68 vs 63) at the price of more false alarms, and validation loss (the honest selection criterion) prefers the time-only model.

---

## 5. What was optimised (notebook `final-optimised-crowd-count.ipynb`)

| Area | Change | Reason |
|---|---|---|
| Data | Train on **Part A + B** (700 images), adaptive kernels for A, padded crops | 75 % more data; dense scenes resemble temples |
| CSRNet | **EMA weights**; model chosen on per-part relative MAE | Validation MAE jumped 7 → 50 between epochs in the first run |
| CSRNet | **Flip test-time augmentation**, 100 epochs | Curve still improving; TTA is free accuracy |
| LSTM | 365 simulated days (was 90) | First LSTM early-stopped with val > train |
| LSTM | Auto-ablation of 5 variants, pick on validation loss | Seasonal baseline beat the univariate LSTM on onsets |
| Outputs | Per-image / per-hour CSVs, accuracy summary, `backend_models/` | One place for every test output and its accuracy |

Result of these changes: see section 1. The first, Part-B-only run (MAE 10.31 on B; univariate LSTM MAE 17.5 on a 90-day stream) is kept in git history of the notebook for comparison.

---

## 6. Backend (FastAPI)

```
backend/
  db.py                   SQLite schema + helpers (temples, cameras, readings)
  services/               frames.py (grab pull frames), pipeline.py (shared analysis), capture.py, poller.py, status.py
  routes/temples.py       temple / camera CRUD, capture, ingest, readings
  main.py                 app, CORS, lifespan (model load; survives failure when DEMO_FALLBACK=1)
  routes/inference.py     /predict-count  /predict-future  /risk  /health   (+ automatic demo fallback)
  routes/dashboard_data.py /dashboard-data  /analytics-data  /alerts-data
  routes/demo.py          same API under /demo (no model files needed)
  utils/model_defs.py     CSRNet, CrowdLSTM (residual option)
  utils/model_registry.py loads state_dict / TorchScript / module; reads LSTM config + scaler
  utils/preprocessing.py  ImageNet normalisation, min-max scaler, hour/weekday features
  utils/demo.py           model-free stand-ins
  scripts/install_models.py  install + verify weights from a Kaggle run
  models/                 csrnet_model.pth  lstm_model.pth  lstm_scaler.json
```

| Endpoint | Input | Output |
|---|---|---|
| `POST /predict-count` | multipart `image` | `{"predicted_count": 124.5}` |
| `POST /analyze-image` | multipart `image`, optional form fields `warn`, `crit` (people), `area_m2` | count, risk `level`, `thresholds` used, density stats (people/megapixel, busiest spot, people/m² + band if `area_m2` given), `overlay_image` (heat-map on the photo) and `density_map_image` (base64) |
| `GET / POST /temples`, `GET / PUT / DELETE /temples/{id}` | temple JSON (name, deity, city, state, address, lat/lng, `capacity`, `area_m2`, `warn`, `crit`, timings, contact, notes) | temple + live status (`current_count`, `occupancy_pct`, `level`, cameras online) |
| `POST /temples/{id}/cameras`, `PUT / DELETE /cameras/{id}` | `{name, source_type: snapshot\|mjpeg\|stream\|push\|file, url, area_m2, zone_capacity, interval_seconds, enabled}` | camera (push cameras also return their `api_key` once) |
| `POST /cameras/{id}/capture?store=true\|false` | – | pulls a frame now, returns the analysis (`store=false` = test the feed only) |
| `POST /ingest/{api_key}` | multipart `image` | `{ts, count, level}` — push endpoint for cameras / edge devices |
| `GET /temples/{id}/readings?hours=24` | – | bucketed total-people series + thresholds |
| `GET /cameras/{id}/integration`, `GET /cameras/{id}/latest.jpg` | – | ingest URL + curl / ffmpeg / Python snippets; latest annotated frame |
| `GET / PUT / DELETE /thresholds` | PUT: `{"warn": 100, "crit": 200}` | active Safe/Warning/Critical cut-offs, where they came from, and a data-based suggestion |
| `POST /predict-future` | `{"past_counts": [24+ numbers], "last_timestamp": "2025-01-06T18:00:00"}` (timestamp optional, used by time-feature models) | `{"predicted_next_count": 187.2}` |
| `POST /risk` | `{"current_count","predicted_count","previous_count"}` | `{"risk_score","level"}` — `0.4·cur + 0.3·(cur−prev) + 0.3·pred` |
| `GET /health` | – | `mode: live \| demo-fallback`, model status, LSTM config |
| `GET /dashboard-data`, `/analytics-data`, `/alerts-data` | – | payloads for the three pages |

Every response carries `X-Data-Source: live | demo-fallback | demo`.

**How the risk thresholds work (they are set, not calculated)**

* Safe `< warn` · Warning `warn … crit` · Critical `≥ crit`, in **people counted**. The defaults (100 / 200) come from the original notebook's `get_risk_level`; nothing learns them from data.
* Priority: saved value (`PUT /thresholds` or the dashboard's *Save thresholds as default*, stored in `backend/config/thresholds.json`) › env `RISK_WARN` / `RISK_CRIT` › defaults 100 / 200. `DELETE /thresholds` resets.
* A single request can override them (`warn` / `crit` form fields on `/analyze-image`, or the boxes on the dashboard) without saving.
* The saved values drive `count_level`, the forecast-driven alerts and the dashboard risk card. `GET /thresholds` also returns a *suggestion* (75th / 90th percentile of the test-stream counts) as a starting point.
* Pick them from your venue: e.g. Warning = 70 % and Critical = 90 % of the safe capacity of the camera's area. The optional `area_m2` field adds people/m² with a commonly cited guidance band (≥ 4 people/m² is dangerous, ≥ 5 approaches crush conditions).
* The `/risk` score (`0.4·cur + 0.3·Δ + 0.3·pred`, cut-offs 2000 / 5000 / 9000) is a separate legacy formula for crowds in the thousands and is not configurable.

**Behaviour that mirrors the reported results**

* `/predict-count` applies the same **flip test-time augmentation** as the reported test numbers (`TTA=0` disables it), crops to multiples of 8 exactly like training, and scales photos larger than 1024 px down (ShanghaiTech images are ≤ 1024 px).
* `/risk` also returns `count_level` (Safe < 100 · Warning 100–200 · Critical ≥ 200 people, the study's thresholds) next to the original `level`, whose formula is tuned for crowds in the thousands.
* `/dashboard-data`, `/analytics-data` and `/alerts-data` are computed from `results/final_forecast_predictions.csv` and `final_accuracy_summary.csv` — a **replay of the held-out test stream** with real CSRNet counts and real LSTM forecasts (24 h chart, MAE/RMSE/accuracy cards, per-day actual vs forecast, forecast-driven alerts). `?end=2024-12-30T19:00` moves the replay clock (default: the last 19:00). If `results/` has no CSV they fall back to static sample data.

**Verified end to end:** live `/predict-count` reproduces the Kaggle test predictions within 0.11 people on 4 Part-A and 4 Part-B images (difference is fp16 vs fp32).

### 6.1 The train ↔ serve contract

Things that must match between the notebook and the backend (checked by the notebook's last section):
ImageNet mean/std · `count = sum(output)` · plain `state_dict` keys with no `module.` prefix · same min-max scaler · same hour/weekday features. Note the LSTM asks for **at least 24** values.

### 6.2 `/demo` backup

![Backup routing](docs/images/demo_fallback.png)

* **Server-side:** if a model is missing or inference throws, the live endpoint answers with demo logic and header `demo-fallback` instead of a 500. A failed model load at startup no longer kills the app. Disable with `DEMO_FALLBACK=0`.
* **Client-side:** `client/lib/api.ts` retries the same path under `/demo` if the API is unreachable or returns 5xx. 4xx (bad input) is not rerouted. If even `/demo` fails, pages keep built-in sample data.
* Demo logic: image edge-energy → a deterministic count; forecast = 0.6·latest + 0.4·24 h ago; same risk formula.

---

## 7. Frontend (Next.js)

* `lib/api.ts` — `apiFetch()` with timeout and `/demo` reroute; `lib/use-api.ts` — hook for pages.
* Dashboard, Alerts and Analytics load from the API; **Temples** (`/temples`, `/temples/[id]`) manages temples and cameras (see 7b); a **source badge** shows *Live*, *Demo backup* or *Offline sample data*.
* Dashboard has an **image analyser**: upload a photo → `/analyze-image` → count, risk level, crowd density, busiest spot, heat-map overlay and density map; thresholds and area are editable and can be saved as the default.
* Set the API address with `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000`).

---

## 7b. Temple management and camera integration

![Temple management and camera integration](docs/images/camera_integration.png)

**Register temples** at `/temples`: name, deity, city/state/address, latitude/longitude, **safe capacity**, area, **Warning / Critical levels** (empty = 70 % / 90 % of capacity), opening hours, control-room contact and notes. Everything is stored in SQLite (`backend/data/crowd.db`, git-ignored).

**Connect camera feeds** on each temple page. Two ways, pick per camera:

| Mode | Source type | How it works |
|---|---|---|
| Pull | `snapshot` | server fetches a JPEG from an http(s) URL every interval (most IP cameras) |
| Pull | `mjpeg` | server opens the motion-JPEG stream, takes one frame |
| Pull | `stream` | RTSP / RTMP / HLS / webcam index via OpenCV (`opencv-python-headless`, in `requirements.txt`) |
| Push | `push` | the camera or an edge box POSTs JPEGs to `/ingest/<api_key>` — for cameras behind NAT. The page shows ready-to-paste **curl**, **ffmpeg loop** and **Python** snippets |
| Demo | `demo` | no hardware: replays ShanghaiTech test images through the real CSRNet pipeline on a daily crowd pattern (`url` = pattern name: `somnath`, `dwarka`, `rameswaram`, `nathdwara`, or empty) |
| Demo | `file` | replays a recorded video/image on the server as if live; needs `ALLOW_FILE_CAMERAS=1` |

A background poller (asyncio task, `CAMERA_POLLING=0` disables it) captures every enabled pull camera at its interval, runs the same CSRNet pipeline as `/analyze-image` (with flip-TTA), stores a reading, and keeps the latest annotated frame. Failures are recorded on the camera (`error` + message) and never stop the poller.

**Demo data.** `python backend/scripts/seed_demo.py` creates four temples (Somnath, Dwarkadhish, Ramanathaswamy, Shreenathji; 9 cameras) with 48 h of history (`--hours`, `--reset` to recreate). History readings use the CSRNet counts already measured on the ShanghaiTech test images (`results/final_test_predictions.csv`); afterwards each `demo` camera keeps feeding a test image through the live model every 5 minutes, so the curves keep growing and the temples stay online. Needs the ShanghaiTech test images (`DEMO_IMAGES_DIR`, default `kaggle_model/archive/.../part_B/test_data/images`).

How the numbers combine:

* **Temple total = sum of the latest reading of every online camera** — give each camera a *different* part of the temple (overlapping views would double count).
* A camera with a **zone capacity** is judged on 70 % / 90 % of that zone; otherwise on the temple's Warning / Critical values.
* A camera with no reading for 15 minutes (`STALE_MINUTES`) is *offline* and excluded from the total.
* The dashboard's temple status and pie chart, and the alerts page, use these real readings as soon as temples exist (alerts = Warning/Critical readings of the last 24 h); with no temples they fall back to the test-stream replay.
* Readings older than 30 days are purged hourly.

**Security notes**

* Set `ADMIN_API_KEY` on the server to require an `X-API-Key` header on every create / edit / delete / capture call (the web app sends `NEXT_PUBLIC_ADMIN_KEY` if you set it). Reads and the ingest endpoint stay open; **ingest is authorised only by the per-camera secret in its URL** — keep it private and rotate by re-adding the camera.
* Camera URLs may contain credentials (`rtsp://user:pass@host`). They are stored server-side and **masked** (`rtsp://***@host`) in every API response.
* Pull sources make the *server* open URLs you give it, so only trusted operators should have management access (use `ADMIN_API_KEY` and a private network). `file` sources are off by default.

| Environment variable | Default | Meaning |
|---|---|---|
| `ADMIN_API_KEY` | unset | require `X-API-Key` for management calls |
| `CAMERA_POLLING` | `1` | run the background poller |
| `STALE_MINUTES` | `15` | a camera without a reading this long is offline |
| `ALLOW_FILE_CAMERAS` | `0` | allow `file` sources (demos) |
| `CROWD_DB` | `backend/data/crowd.db` | SQLite path |
| `TTA`, `DEMO_FALLBACK`, `RISK_WARN`, `RISK_CRIT` | see above | inference and threshold defaults |

**Dark mode:** a sun/moon button (bottom-right on every page) switches themes; the choice is remembered and defaults to the system setting. Charts, cards, badges and status colours all have dark variants.

---

## 8. Limitations

* **The forecasting stream is simulated.** ShanghaiTech images have no timestamps; a synthetic temple-style hourly pattern picks which test image is "seen" each hour, and the LSTM's time features exploit exactly that pattern. Results show the *method* works, not accuracy on a real temple. Replace the stream with real per-camera counts when available.
* Until you register temples and cameras, the dashboard/alerts/analytics pages replay the test stream. The **festival comparison is still static sample data** (no festival data exists yet); the temple pie and status overview use your registered temples once they have readings.
* Camera counts are only as good as the camera view: CSRNet was trained on ShanghaiTech (mostly elevated, outdoor views), so accuracy on your own cameras should be validated against manual counts before relying on alerts.
* Risk thresholds (100/200 people) are illustrative; set them per site.
* Part A + B training slightly lowers Part-B accuracy versus B-only (12.7 vs 10.3 MAE).

---

## 9. Run it

**Everything at once:** `./start.sh` (see [Quick start](#quick-start)).

**Manually**
```bash
# backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt            # CPU-only torch: pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cpu
uvicorn main:app --port 8000               # docs at http://127.0.0.1:8000/docs

# frontend (second terminal)
cd client && npm install && npm run dev    # http://localhost:3000
```

**Train (Kaggle, GPU T4)** — attach the ShanghaiTech dataset and a `vgg16-397923af.pth` weights dataset (or enable Internet), open `kaggle_model/final-optimised-crowd-count.ipynb` (its first cell lists the two inputs to attach), *Run All*.

**Bring trained weights back here** (the weights currently in `backend/models/` are from the v2 run above)
```bash
# a) after downloading the notebook output (folder or .zip) from Kaggle > Output
python backend/scripts/install_models.py ~/Downloads/backend_models --figures
# b) or straight from Kaggle (needs the Kaggle CLI and ~/.kaggle/kaggle.json)
python backend/scripts/install_models.py --kaggle <user>/<notebook-slug> --figures
```
The script backs up the current weights, installs the new ones, loads them with the real backend code (rolling back if that fails), and copies the result CSVs into `results/` and figures into `docs/images/`. Restart the API and check `GET /health` → `"mode": "live"`.

**Regenerate diagrams:** `python docs/make_diagrams.py`.

---

## 10. Repository map

```
start.sh / start.ps1  one-command setup and launch
backend/              FastAPI service (see 6 and 7b; backend/README.md)
client/               Next.js app (see 7)
kaggle_model/         notebooks (the ShanghaiTech dataset in archive/ is git-ignored)
  final-optimised-crowd-count.ipynb   final notebook, executed on Kaggle (Part A+B, EMA, TTA, LSTM ablation, final CSVs)
  crowd-counting-optimised.ipynb      first optimised run (Part B only, with saved outputs)
  crowd-counting-research (1).ipynb   the original notebook, untouched
results/              result CSVs/JSON of the final run (the API reads final_forecast_predictions.csv, final_accuracy_summary.csv,
                      usecase_comparison.csv; the demo feed reads final_test_predictions.csv)
docs/                 diagrams (make_diagrams.py) and result figures
.env.example          every optional setting
```

Runtime data (`backend/data/` SQLite database and frames, `backend/config/` saved thresholds, `logs/`) is created on first run and is git-ignored.
