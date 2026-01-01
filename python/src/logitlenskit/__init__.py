"""
LogitLensKit - Efficient logit lens data collection and visualization.

This package provides tools for collecting and visualizing logit lens data
from transformer language models, optimized for NDIF remote execution.

Main components:
- Data collection: collect_logit_lens_topk_efficient (bandwidth-optimized)
- Model support: MODEL_CONFIGS registry for different architectures
- Visualization: show_logit_lens for Jupyter display
"""

from .collect import (
    collect_logit_lens_topk,
    collect_logit_lens_topk_efficient,
    decode_tracked_tokens,
)
from .models import (
    MODEL_CONFIGS,
    MODEL_ALIASES,
    get_model_config,
    detect_model_type,
    resolve_accessor,
    apply_module_or_callable,
)
from .display import (
    show_logit_lens,
    display_logit_lens,
    format_data_for_widget,
)
from .utils import get_value

__version__ = "0.1.0"

__all__ = [
    # Collection
    "collect_logit_lens_topk",
    "collect_logit_lens_topk_efficient",
    "decode_tracked_tokens",
    # Models
    "MODEL_CONFIGS",
    "MODEL_ALIASES",
    "get_model_config",
    "detect_model_type",
    "resolve_accessor",
    "apply_module_or_callable",
    # Display
    "show_logit_lens",
    "display_logit_lens",
    "format_data_for_widget",
    # Utils
    "get_value",
]
