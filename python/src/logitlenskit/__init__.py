"""
LogitLensKit - Efficient logit lens data collection and visualization.

This package provides tools for collecting and visualizing logit lens data
from transformer language models, optimized for NDIF remote execution.

Example:
    >>> from nnsight import LanguageModel
    >>> from logitlenskit import collect_logit_lens, show_logit_lens
    >>>
    >>> model = LanguageModel("openai-community/gpt2", device_map="auto")
    >>> data = collect_logit_lens("The capital of France is", model)
    >>> show_logit_lens(data)
"""

from .collect import collect_logit_lens
from .display import show_logit_lens, display_logit_lens, to_js_format
from .models import detect_model_type, get_model_config, resolve_accessor

__version__ = "0.2.0"

__all__ = [
    "collect_logit_lens",
    "show_logit_lens",
    "display_logit_lens",
    "to_js_format",
    "detect_model_type",
    "get_model_config",
    "resolve_accessor",
]
