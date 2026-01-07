# LogitLensKit Documentation

LogitLensKit is a toolkit for visualizing **logit lens** analysis of transformer language models. It's designed for the specific workflow of collecting data from large models running on remote GPU servers (via [NDIF](https://ndif.us/)) and displaying interactive visualizations in Jupyter notebooks or web pages.

## Getting Started

The fastest way to try LogitLensKit is the **tutorial notebook**, which runs Llama-8B on NDIF's free GPU servers:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/davidbau/logitlenskit/blob/main/notebooks/tutorial.ipynb)

## Quick Links

| Document | Description |
|----------|-------------|
| [PYTHON_API](PYTHON_API.md) | Python functions for collecting and displaying logit lens data |
| [JAVASCRIPT_API](JAVASCRIPT_API.md) | JavaScript widget API for custom integrations |
| [DATA_FORMAT](DATA_FORMAT.md) | How data flows from server to widget, and why each format exists |
| [MODEL_SUPPORT](MODEL_SUPPORT.md) | Supported model architectures and how to add new ones |
| [DEVELOPMENT](DEVELOPMENT.md) | Contributing, testing, and project structure |

## The Core Problem

A single forward pass through Llama-70B produces **~550 MB** of logit data per prompt. Transmitting this for every analysis would be impractical. LogitLensKit solves this by:

1. **Server-side reduction** — Computing top-k and trajectory extraction on NDIF
2. **Efficient formats** — Transmitting only ~1 MB of essential data
3. **Interactive visualization** — Exploring results without re-running the model

## Typical Workflow

```python
from nnsight import LanguageModel
from logitlenskit import collect_logit_lens, show_logit_lens

# Load model (runs on NDIF)
model = LanguageModel("meta-llama/Llama-3.1-8B", device_map="auto")

# Collect logit lens data (~1 MB transmitted)
data = collect_logit_lens("The capital of France is", model, remote=True)

# Display interactive widget (last row auto-pinned by default)
show_logit_lens(data, title="Capital of France")

# Customize the display
show_logit_lens(data,
    title="Dark mode analysis",
    dark_mode=True,
    chart_height=200,
    pinned_rows=[]  # Disable auto-pinning
)
```

## Live Demo

Try the widget: [davidbau.github.io/logitlenskit](https://davidbau.github.io/logitlenskit/)

## Source Code

GitHub: [github.com/davidbau/logitlenskit](https://github.com/davidbau/logitlenskit)
