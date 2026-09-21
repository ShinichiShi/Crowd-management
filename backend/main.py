from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes.dashboard_data import router as dashboard_router
from routes.demo import router as demo_router
from routes.temples import router as temples_router
from routes.thresholds import router as thresholds_router
from services.poller import poll_forever
import db
from routes.inference import router as inference_router
from utils.model_registry import registry
from utils.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        registry.load_all()
    except Exception as exc:
        if not settings.demo_fallback:
            raise
        logging.getLogger("crowd").error("Model loading failed (%s); serving demo fallback only.", exc)
    db.init()
    poller = asyncio.create_task(poll_forever()) if os.getenv("CAMERA_POLLING", "1") != "0" else None
    try:
        yield
    finally:
        if poller:
            poller.cancel()


app = FastAPI(
    title=settings.project_name,
    version="1.0.0",
    description="Backend APIs for smart crowd counting, forecasting, and risk scoring.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    expose_headers=["X-Data-Source"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def generic_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": f"Internal server error: {exc}"})


app.include_router(inference_router, prefix=settings.api_prefix)
app.include_router(dashboard_router, prefix=settings.api_prefix)
app.include_router(thresholds_router, prefix=settings.api_prefix)
app.include_router(temples_router, prefix=settings.api_prefix)
app.include_router(demo_router, prefix=settings.demo_prefix)
