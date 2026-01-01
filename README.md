# LogitLensKit

Interactive visualization toolkit for transformer logit lens analysis.

## Where to Start

*   **Using the code**: Check out the [Quick Start](#quick-start) below and the [Python API Reference](docs/PYTHON_API.md).
*   **Developing**: See [PLAN.md](PLAN.md) for the implementation roadmap and project structure. The core logic is in `python/` and the visualization widget is in `js/`.
*   **Documentation**: Full documentation is located in the [`docs/`](docs/) directory.

## Background: What is the Logit Lens?

The **Logit Lens** is an interpretability technique that decodes the internal hidden states of a language model into vocabulary probabilities. By applying the model's "unembedding" matrix (the output layer) to intermediate layers, we can see what the model "thinks" the next token is at each stage of its computation.

This technique reveals how predictions evolve layer by layer, offering insights into the model's reasoning process.

*   **Original Work**: [Interpreting GPT: the logit lens](https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens) by nostalgebraist.

## Purpose

This library is designed to make logit lens analysis efficient and accessible, particularly for large models.

*   **Integration**: It is built to work seamlessly with [NNsight](https://nnsight.net/) and [NDIF](https://ndif.us/), allowing for server-side reduction of data. This means you can visualize the internal dynamics of massive models (like Llama-70B) without downloading gigabytes of data.
*   **Education**: This tool was created for the [Neural Mechanics](https://neural-mechanics.baulab.info/) course to help students explore transformer internals.

---

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