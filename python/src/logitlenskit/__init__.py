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

__version__ = "0.2.1"

__all__ = [
    "collect_logit_lens",
    "show_logit_lens",
    "display_logit_lens",
    "to_js_format",
]


def __getattr__(name):
    """Lazy import for models module to avoid NDIF serialization issues."""
    if name in ("detect_model_type", "get_model_config", "resolve_accessor"):
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
