from __future__ import annotations

import torch
import torch.nn as nn
import os
from torchvision import models


class CSRNet(nn.Module):
    """CSRNet-style crowd counting architecture.

    This implementation is compatible with common CSRNet checkpoints that store
    state_dict values under keys matching VGG16 frontend and dilated backend.
    """

    def __init__(self) -> None:
        super().__init__()

        vgg16 = models.vgg16(weights=None)
        frontend_features = list(vgg16.features.children())[:23]
        self.frontend = nn.Sequential(*frontend_features)
        self.backend = self._make_layers(
            [512, 256, 128, 64], in_channels=512, dilation=True
        )
        self.backend.append(nn.Conv2d(64, 1, kernel_size=1))

    def _make_layers(
        self, cfg: list[int], in_channels: int, dilation: bool = False
    ) -> nn.Sequential:
        d_rate = 2 if dilation else 1
        layers: list[nn.Module] = []
        for value in cfg:
            layers.append(
                nn.Conv2d(
                    in_channels,
                    value,
                    kernel_size=3,
                    padding=d_rate,
                    dilation=d_rate,
                )
            )
            layers.append(nn.ReLU(inplace=True))
            in_channels = value
        return nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.frontend(x)
        x = self.backend(x)
        return x


class CrowdLSTM(nn.Module):
    """Simple LSTM regressor for univariate crowd count forecasting."""

    def __init__(
        self,
        input_size: int = 1,
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.0,
        residual: bool = False,
    ) -> None:
        super().__init__()
        self.residual = residual
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        output, _ = self.lstm(x)
        out = self.fc(output[:, -1, :])
        if self.residual:
            out = out + x[:, -1, :1]
        return out


def get_device() -> torch.device:
    if os.getenv("FORCE_CPU", "0") == "1":
        return torch.device("cpu")
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")
