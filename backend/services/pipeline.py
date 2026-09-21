from __future__ import annotations

import logging

import torch

from utils.analysis import build_analysis
from utils.demo import demo_count, demo_density
from utils.model_registry import registry
from utils.preprocessing import image_to_tensor, prepare_image
from utils.settings import settings

logger = logging.getLogger("crowd.pipeline")


def analyze_image_bytes(
    image_bytes: bytes,
    warn: float | None = None,
    crit: float | None = None,
    area_m2: float | None = None,
) -> dict:
    """Bytes -> count / level / density / heat-map. Uses CSRNet; falls back to the demo estimator if allowed."""
    pil = prepare_image(image_bytes)  # raises for invalid images
    try:
        if registry.csrnet is None:
            raise RuntimeError("CSRNet model is not loaded.")
        tensor = image_to_tensor(pil, registry.device)
        with torch.no_grad():
            output = registry.csrnet(tensor)
            if settings.tta:
                output = (output + registry.csrnet(tensor.flip(-1)).flip(-1)) / 2
        density = output.squeeze().float().clamp(min=0).cpu().numpy()
        return build_analysis(density, pil, warn, crit, area_m2, source="live")
    except ValueError:
        raise
    except Exception as exc:
        if not settings.demo_fallback:
            raise
        logger.warning("analysis falling back to demo: %s", exc)
        return build_analysis(demo_density(pil, demo_count(image_bytes)), pil, warn, crit, area_m2, source="demo-fallback")
