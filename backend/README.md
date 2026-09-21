# Backend (FastAPI)

Crowd counting (CSRNet), next-hour forecasting (LSTM), risk levels, and temple / camera management.
The full documentation, architecture and results are in the [root README](../README.md).

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt     # CPU-only torch: pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cpu
uvicorn main:app --port 8000        # docs: http://127.0.0.1:8000/docs
```
(or run `./start.sh` in the repository root, which does all of this and also starts the web app).

## Layout

```
main.py                app, CORS, startup (model load, database, camera poller)
db.py                  SQLite schema and helpers (temples, cameras, readings)
routes/                inference.py, dashboard_data.py, thresholds.py, temples.py, demo.py (/demo backup API)
services/              frames.py (grab frames), pipeline.py (analysis), capture.py, poller.py, status.py, demo_feed.py
utils/                 model_defs.py, model_registry.py, preprocessing.py, analysis.py, thresholds.py, risk.py, ...
scripts/               install_models.py (install weights from Kaggle), seed_demo.py (demo temples)
models/                csrnet_model.pth, lstm_model.pth, lstm_scaler.json
```

## Main endpoints

| | |
|---|---|
| `POST /predict-count` | photo → people count |
| `POST /analyze-image` | photo → count, risk level, density stats, heat-map |
| `POST /predict-future` | last 24 counts (+ `last_timestamp`) → next-hour count |
| `POST /risk`, `GET/PUT/DELETE /thresholds` | risk levels and their thresholds |
| `GET/POST /temples`, `/temples/{id}`, `/temples/{id}/cameras`, `/cameras/{id}/capture`, `POST /ingest/{api_key}` | temples, camera feeds, push ingestion |
| `GET /dashboard-data`, `/analytics-data`, `/alerts-data`, `/health` | pages and monitoring |
| `/demo/...` | same paths, no models needed (backup) |

Models load once at startup on CUDA if available, else CPU. If a model file is missing the API stays up and answers from the demo logic (`X-Data-Source: demo-fallback`); set `DEMO_FALLBACK=0` for hard errors. See `.env.example` in the repository root for all settings.
