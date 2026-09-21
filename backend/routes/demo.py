from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from routes.dashboard_data import router as dashboard_router
from utils import thresholds as th
from utils.analysis import build_analysis
from utils.demo import demo_count, demo_density, demo_forecast
from utils.preprocessing import prepare_image
from utils.risk import count_level, evaluate_risk
from utils.schemas import (
    PredictCountResponse,
    PredictFutureRequest,
    PredictFutureResponse,
    RiskRequest,
    RiskResponse,
)

# Mounted at settings.demo_prefix ("/demo"): same paths and payloads as the live API, no model files required.
router = APIRouter(tags=["demo (backup)"])


@router.post("/predict-count", response_model=PredictCountResponse)
async def demo_predict_count(response: Response, image: UploadFile = File(...)) -> PredictCountResponse:
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")
    try:
        count = demo_count(data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read image: {exc}") from exc
    response.headers["X-Data-Source"] = "demo"
    return PredictCountResponse(predicted_count=count)


@router.post("/analyze-image")
async def demo_analyze_image(
    response: Response,
    image: UploadFile = File(...),
    warn: float | None = Form(None),
    crit: float | None = Form(None),
    area_m2: float | None = Form(None),
) -> dict[str, object]:
    data = await image.read()
    try:
        pil = prepare_image(data)
        total = demo_count(data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image.") from exc
    try:
        result = build_analysis(demo_density(pil, total), pil, warn, crit, area_m2, source="demo")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    response.headers["X-Data-Source"] = "demo"
    return result


@router.post("/predict-future", response_model=PredictFutureResponse)
def demo_predict_future(payload: PredictFutureRequest, response: Response) -> PredictFutureResponse:
    response.headers["X-Data-Source"] = "demo"
    return PredictFutureResponse(
        predicted_next_count=demo_forecast(payload.past_counts, payload.last_timestamp)
    )


@router.post("/risk", response_model=RiskResponse)
def demo_risk(payload: RiskRequest, response: Response) -> RiskResponse:
    score, level = evaluate_risk(payload.current_count, payload.predicted_count, payload.previous_count)
    response.headers["X-Data-Source"] = "demo"
    return RiskResponse(
        risk_score=round(score, 2),
        level=level,
        count_level=count_level(max(payload.current_count, payload.predicted_count)),
    )


@router.get("/health")
def demo_health() -> dict[str, object]:
    return {"status": "ok", "mode": "demo", "csrnet_loaded": False, "lstm_loaded": False}


router.include_router(dashboard_router)
