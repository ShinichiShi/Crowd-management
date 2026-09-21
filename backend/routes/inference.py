from __future__ import annotations

import io
import logging

import numpy as np
import torch
from PIL import Image
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from services.pipeline import analyze_image_bytes
from utils import thresholds as th
from utils.analysis import build_analysis
from utils.demo import demo_count, demo_density, demo_forecast
from utils.model_registry import registry
from utils.preprocessing import image_to_tensor, prepare_image, preprocess_csrnet_image, preprocess_lstm_sequence
from utils.risk import count_level, evaluate_risk
from utils.schemas import (
    PredictCountResponse,
    PredictFutureRequest,
    PredictFutureResponse,
    RiskRequest,
    RiskResponse,
)
from utils.settings import settings


logger = logging.getLogger("crowd.inference")
router = APIRouter(tags=["inference"])

LIVE, FALLBACK = "live", "demo-fallback"


def _mark(response: Response, source: str) -> None:
    response.headers["X-Data-Source"] = source


@router.post("/predict-count", response_model=PredictCountResponse)
async def predict_count(response: Response, image: UploadFile = File(...)) -> PredictCountResponse:
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    try:
        Image.open(io.BytesIO(image_bytes)).verify()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image.") from exc

    try:
        if registry.csrnet is None:
            raise RuntimeError("CSRNet model is not loaded.")
        tensor = preprocess_csrnet_image(image_bytes, registry.device)
        with torch.no_grad():
            output = registry.csrnet(tensor)
            if settings.tta:  # same flip test-time augmentation as the reported test results
                output = (output + registry.csrnet(tensor.flip(-1)).flip(-1)) / 2

        if isinstance(output, (tuple, list)):
            output = output[0]
        if not isinstance(output, torch.Tensor):
            raise ValueError("CSRNet output must be a torch.Tensor.")

        predicted_count = max(float(torch.sum(output).item()), 0.0)
        _mark(response, LIVE)
        return PredictCountResponse(predicted_count=round(predicted_count, 2))
    except Exception as exc:
        if not settings.demo_fallback:
            code = 503 if registry.csrnet is None else 500
            raise HTTPException(status_code=code, detail=f"Failed to run crowd counting: {exc}") from exc
        logger.warning("predict-count falling back to demo: %s", exc)
        _mark(response, FALLBACK)
        return PredictCountResponse(predicted_count=demo_count(image_bytes))


@router.post("/predict-future", response_model=PredictFutureResponse)
def predict_future(payload: PredictFutureRequest, response: Response) -> PredictFutureResponse:
    if len(payload.past_counts) < registry.lstm_seq_len and registry.lstm is not None:
        raise HTTPException(
            status_code=422,
            detail=f"past_counts must contain at least {registry.lstm_seq_len} values for this model.",
        )

    try:
        if registry.lstm is None:
            raise RuntimeError("LSTM model is not loaded.")
        sequence = preprocess_lstm_sequence(
            payload.past_counts,
            sequence_length=registry.lstm_seq_len,
            normalizer=registry.normalizer,
            device=registry.device,
            last_timestamp=payload.last_timestamp,
            use_time_features=registry.lstm_time_features,
            step_minutes=registry.lstm_step_minutes,
        )

        with torch.no_grad():
            prediction = registry.lstm(sequence)

        if isinstance(prediction, (tuple, list)):
            prediction = prediction[0]
        if not isinstance(prediction, torch.Tensor):
            raise ValueError("LSTM output must be a torch.Tensor.")

        predicted_value = float(prediction.squeeze().item())
        denorm = registry.normalizer.denormalize(np.asarray([predicted_value], dtype=np.float32))
        _mark(response, LIVE)
        return PredictFutureResponse(predicted_next_count=round(float(max(0.0, denorm[0])), 2))
    except Exception as exc:
        if not settings.demo_fallback:
            code = 503 if registry.lstm is None else 500
            raise HTTPException(status_code=code, detail=f"Failed to run future prediction: {exc}") from exc
        logger.warning("predict-future falling back to demo: %s", exc)
        _mark(response, FALLBACK)
        return PredictFutureResponse(
            predicted_next_count=demo_forecast(payload.past_counts, payload.last_timestamp)
        )


@router.post("/risk", response_model=RiskResponse)
def compute_risk(payload: RiskRequest, response: Response) -> RiskResponse:
    risk_score, level = evaluate_risk(
        current=payload.current_count,
        predicted=payload.predicted_count,
        previous=payload.previous_count,
    )
    _mark(response, LIVE)
    return RiskResponse(
        risk_score=round(risk_score, 2),
        level=level,
        count_level=count_level(max(payload.current_count, payload.predicted_count)),
    )


@router.get("/health")
def health() -> dict[str, object]:
    live = registry.csrnet is not None and registry.lstm is not None
    return {
        "status": "ok",
        "mode": "live" if live else "demo-fallback",
        "device": str(registry.device),
        "csrnet_loaded": registry.csrnet is not None,
        "lstm_loaded": registry.lstm is not None,
        "lstm_sequence_length": registry.lstm_seq_len,
        "lstm_time_features": registry.lstm_time_features,
        "normalization_method": registry.normalizer.method,
        "demo_prefix": settings.demo_prefix,
    }


@router.post("/analyze-image")
async def analyze_image(
    response: Response,
    image: UploadFile = File(...),
    warn: float | None = Form(None),
    crit: float | None = Form(None),
    area_m2: float | None = Form(None),
) -> dict[str, object]:
    """Upload a photo -> people count, crowd density, risk level and a density heat-map (overlay + map)."""
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")
    try:
        pil = prepare_image(image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image.") from exc

    lo = warn if warn is not None else th.get()["warn"]
    hi = crit if crit is not None else th.get()["crit"]
    try:
        th.validate(lo, hi)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        result = analyze_image_bytes(image_bytes, lo, hi, area_m2)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to analyze image: {exc}") from exc
    _mark(response, result["source"])
    return result
