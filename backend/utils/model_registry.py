from __future__ import annotations

from pathlib import Path
from typing import Any

import torch

from .model_defs import CSRNet, CrowdLSTM, get_device
from .preprocessing import SequenceNormalizer, load_scaler_from_json
from .settings import settings


class ModelRegistry:
    def __init__(self) -> None:
        self.device = get_device()
        self.csrnet: torch.nn.Module | None = None
        self.lstm: torch.nn.Module | None = None
        self.lstm_seq_len: int = 24
        self.lstm_time_features: bool = False
        self.lstm_step_minutes: int = 60
        self.normalizer: SequenceNormalizer = SequenceNormalizer(method="identity")

    def load_all(self) -> None:
        self.csrnet = self._load_csrnet(settings.csrnet_path)
        self.lstm, self.lstm_seq_len, self.normalizer = self._load_lstm(
            settings.lstm_path, settings.lstm_scaler_path
        )

    def _load_torch_payload(self, model_path: Path) -> Any:
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")

        try:
            scripted = torch.jit.load(str(model_path), map_location=self.device)
            scripted.eval()
            return scripted
        except Exception:
            return torch.load(str(model_path), map_location=self.device)

    @staticmethod
    def _is_raw_state_dict(payload: dict[str, Any]) -> bool:
        return bool(payload) and all(
            isinstance(value, torch.Tensor) for value in payload.values()
        )

    def _load_csrnet(self, model_path: Path) -> torch.nn.Module:
        payload = self._load_torch_payload(model_path)

        if isinstance(payload, torch.nn.Module):
            model = payload
        elif isinstance(payload, dict):
            model = CSRNet()
            if self._is_raw_state_dict(payload):
                state_dict = payload
            else:
                state_dict = payload.get("state_dict") or payload.get("model_state_dict")
            if state_dict is None:
                raise ValueError(
                    "Unsupported CSRNet checkpoint format. Expected a torch module or state_dict."
                )
            model.load_state_dict(state_dict, strict=True)
        else:
            raise ValueError("Unsupported CSRNet checkpoint payload type.")

        model.to(self.device)
        model.eval()
        return model

    def _extract_lstm_config(self, payload: dict[str, Any]) -> tuple[int, int, int, float, int]:
        # residual / time_features / step_minutes are read separately in _load_lstm
        config = payload.get("config", {})
        input_size = int(config.get("input_size", payload.get("input_size", 1)))
        hidden_size = int(config.get("hidden_size", payload.get("hidden_size", 64)))
        num_layers = int(config.get("num_layers", payload.get("num_layers", 2)))
        dropout = float(config.get("dropout", payload.get("dropout", 0.0)))
        seq_len = int(
            config.get(
                "sequence_length",
                payload.get("sequence_length", payload.get("window_size", 24)),
            )
        )
        return input_size, hidden_size, num_layers, dropout, seq_len

    def _extract_normalizer(self, payload: dict[str, Any], scaler_path: Path) -> SequenceNormalizer:
        scaler_data = payload.get("scaler") or payload.get("normalization")
        if isinstance(scaler_data, dict):
            method = str(scaler_data.get("method", "identity")).lower()
            if method == "zscore":
                return SequenceNormalizer(
                    method="zscore",
                    mean=float(scaler_data.get("mean", 0.0)),
                    std=float(scaler_data.get("std", 1.0)),
                )
            if method == "minmax":
                return SequenceNormalizer(
                    method="minmax",
                    min_value=float(scaler_data.get("min", 0.0)),
                    max_value=float(scaler_data.get("max", 1.0)),
                )

        scaler_from_file = load_scaler_from_json(scaler_path)
        if scaler_from_file is not None:
            return scaler_from_file

        return SequenceNormalizer(method="identity")

    @staticmethod
    def _infer_lstm_config_from_state_dict(
        state_dict: dict[str, torch.Tensor],
    ) -> tuple[int, int, int, float, int]:
        input_size = int(state_dict["lstm.weight_ih_l0"].shape[1])
        hidden_size = int(state_dict["lstm.weight_ih_l0"].shape[0] // 4)
        num_layers = sum(
            1 for key in state_dict if key.startswith("lstm.weight_ih_l") and "reverse" not in key
        )
        return input_size, hidden_size, num_layers, 0.0, 24

    def _load_lstm(
        self, model_path: Path, scaler_path: Path
    ) -> tuple[torch.nn.Module, int, SequenceNormalizer]:
        payload = self._load_torch_payload(model_path)

        if isinstance(payload, torch.nn.Module):
            model = payload
            sequence_length = 24
            normalizer = load_scaler_from_json(scaler_path) or SequenceNormalizer("identity")
        elif isinstance(payload, dict):
            if self._is_raw_state_dict(payload):
                state_dict = payload
                input_size, hidden_size, num_layers, dropout, sequence_length = (
                    self._infer_lstm_config_from_state_dict(state_dict)
                )
            else:
                input_size, hidden_size, num_layers, dropout, sequence_length = (
                    self._extract_lstm_config(payload)
                )
                state_dict = payload.get("state_dict") or payload.get("model_state_dict")
                if state_dict is None:
                    raise ValueError(
                        "Unsupported LSTM checkpoint format. Expected a torch module or state_dict."
                    )

            config = payload.get("config", {}) if not self._is_raw_state_dict(payload) else {}
            self.lstm_time_features = bool(config.get("time_features", False))
            self.lstm_step_minutes = int(config.get("step_minutes", 60))
            model = CrowdLSTM(
                input_size=input_size,
                hidden_size=hidden_size,
                num_layers=num_layers,
                dropout=dropout,
                residual=bool(config.get("residual", False)),
            )
            model.load_state_dict(state_dict, strict=True)
            normalizer = self._extract_normalizer(payload, scaler_path)
        else:
            raise ValueError("Unsupported LSTM checkpoint payload type.")

        model.to(self.device)
        model.eval()
        return model, sequence_length, normalizer


registry = ModelRegistry()
