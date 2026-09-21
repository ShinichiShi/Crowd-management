from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class PredictFutureRequest(BaseModel):
    past_counts: list[float] = Field(..., min_length=2)
    last_timestamp: datetime | None = Field(
        default=None,
        description="Time of the newest value in past_counts (hourly steps). Used when the LSTM was trained with time features; defaults to now.",
    )

    @field_validator("past_counts")
    @classmethod
    def validate_counts(cls, values: list[float]) -> list[float]:
        if any(v < 0 for v in values):
            raise ValueError("past_counts must contain non-negative values only.")
        return values


class PredictFutureResponse(BaseModel):
    predicted_next_count: float


class PredictCountResponse(BaseModel):
    predicted_count: float


class RiskRequest(BaseModel):
    current_count: float = Field(..., ge=0)
    predicted_count: float = Field(..., ge=0)
    previous_count: float = Field(..., ge=0)


class RiskResponse(BaseModel):
    risk_score: float
    level: str
    count_level: str | None = None
