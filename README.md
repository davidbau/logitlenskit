# LogitLensKit

Interactive visualization toolkit for transformer logit lens analysis. Efficiently collect and visualize how language model predictions evolve across layers.

**[Live Demo](https://davidbau.github.io/logitlenskit/)** | [Documentation](docs/) | [Plan](PLAN.md)

## Features

- **Efficient Data Collection**: Server-side reduction via NDIF reduces bandwidth from ~800MB to ~400KB per prompt
- **Interactive Visualization**: Click to explore top-k predictions, pin tokens to track trajectories across layers
- **Multi-Model Support**: Works with Llama, GPT-2, GPT-J, Pythia, OLMo, and more
- **Zero-Install Jupyter**: Plain HTML output - no ipywidgets installation required

## Quick Start

### Python (Data Collection)

```python
from nnsight import LanguageModel
from logitlenskit import collect_logit_lens_topk_efficient

model = LanguageModel("meta-llama/Llama-3.1-70B", device_map="auto")
data = collect_logit_lens_topk_efficient(
    "The capital of France is",
    model,
    top_k=5,
    track_across_layers=True,
    remote=True
)
```

### JavaScript (Visualization)

```javascript
var widget = LogitLensWidget("#container", data);

// With custom title
var widget = LogitLensWidget("#container", data, { title: "My Analysis" });

// Link column sizing between widgets
widget1.linkColumnsTo(widget2);
```

## Installation

This package is intended for local development and eventual integration into nnsight.

```bash
# Python
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# JavaScript
cd js
npm install
npm test
```

## Project Status

Work in progress. See [PLAN.md](PLAN.md) for implementation roadmap.

## License

MIT
