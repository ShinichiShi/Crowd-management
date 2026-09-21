from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from utils import thresholds as th

router = APIRouter(tags=["thresholds"])


class ThresholdsIn(BaseModel):
    warn: float = Field(..., gt=0, description="People count at which the level becomes Warning")
    crit: float = Field(..., gt=0, description="People count at which the level becomes Critical")


def _payload() -> dict[str, object]:
    return {**th.get(), "source": th.source(), "defaults": th.DEFAULT, "suggested": th.suggest()}


@router.get("/thresholds")
def get_thresholds() -> dict[str, object]:
    """Active Safe / Warning / Critical cut-offs (people). Not computed from data: set by you (see PUT)."""
    return _payload()


@router.put("/thresholds")
def set_thresholds(body: ThresholdsIn) -> dict[str, object]:
    try:
        th.save(body.warn, body.crit)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _payload()


@router.delete("/thresholds")
def reset_thresholds() -> dict[str, object]:
    th.reset()
    return _payload()
