# LogitLensKit Documentation

LogitLensKit is a toolkit for visualizing **logit lens** analysis of transformer language models. It's designed for the specific workflow of collecting data from large models running on remote GPU servers (via [NDIF](https://ndif.us/)) and displaying interactive visualizations in Jupyter notebooks or web pages.

## Quick Links

| Document | Description |
|----------|-------------|
| [DATA_FORMAT](DATA_FORMAT.md) | How data flows from server to widget, and why each format exists |
| [PYTHON_API](PYTHON_API.md) | Python functions for collecting and displaying logit lens data |
| [JAVASCRIPT_API](JAVASCRIPT_API.md) | JavaScript widget API for custom integrations |
| [MODEL_SUPPORT](MODEL_SUPPORT.md) | Supported model architectures and how to add new ones |
| [DEVELOPMENT](DEVELOPMENT.md) | Contributing, testing, and project structure |

## The Core Problem

A single forward pass through Llama-70B produces **~550 MB** of logit data per prompt. Transmitting this for every analysis would be impractical. LogitLensKit solves this by:

1. **Server-side reduction** — Computing top-k and trajectory extraction on NDIF
2. **Efficient formats** — Transmitting only ~1 MB of essential data
3. **Interactive visualization** — Exploring results without re-running the model

## Typical Workflow

```python
from nnterp import StandardizedTransformer
from logitlenskit import collect_logit_lens, show_logit_lens

# Load model (runs on NDIF)
model = StandardizedTransformer("meta-llama/Llama-3.1-70B-Instruct")

# Collect logit lens data (~1 MB transmitted)
data = collect_logit_lens("The capital of France is", model, remote=True)

# Display interactive widget
show_logit_lens(data, title="Capital of France")
```

## Live Demo

Try the widget: [davidbau.github.io/logitlenskit](https://davidbau.github.io/logitlenskit/)

## Source Code

GitHub: [github.com/davidbau/logitlenskit](https://github.com/davidbau/logitlenskit)
