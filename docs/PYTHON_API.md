# Python API Reference

## Installation

```bash
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Quick Start

```python
from nnsight import LanguageModel
from logitlenskit import collect_logit_lens_topk_efficient, show_logit_lens

# Load model
model = LanguageModel("meta-llama/Llama-3.1-8B", device_map="auto")

# Collect data
data = collect_logit_lens_topk_efficient(
    "The capital of France is",
    model,
    top_k=5,
    track_across_layers=True,
    remote=True
)

# Display in Jupyter
show_logit_lens(data, model.tokenizer, title="Capital of France")
```

---

## Data Collection

### `collect_logit_lens_topk_efficient`

```python
def collect_logit_lens_topk_efficient(
    prompt: str,
    model,
    top_k: int = 5,
    track_across_layers: bool = False,
    remote: bool = True,
    layers: Optional[List[int]] = None,
    model_type: Optional[str] = None,
) -> Dict
```

Collect logit lens data with server-side reduction for minimal bandwidth. **This is the recommended function for NDIF remote execution.**

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | str | required | Input text to analyze |
| `model` | LanguageModel | required | nnsight LanguageModel instance |
| `top_k` | int | 5 | Number of top predictions per layer/position |
| `track_across_layers` | bool | False | Track probability trajectories (required for visualization) |
| `remote` | bool | True | Use NDIF remote execution |
| `layers` | List[int] | None | Specific layer indices (default: all) |
| `model_type` | str | None | Model architecture (auto-detected if None) |

#### Returns

Dict containing:

| Key | Type | Description |
|-----|------|-------------|
| `tokens` | List[str] | Input token strings |
| `layers` | List[int] | Layer indices analyzed |
| `top_indices` | Tensor[n_layers, seq_len, k] | Top-k token indices |
| `top_probs` | Tensor[n_layers, seq_len, k] | Top-k probabilities |

If `track_across_layers=True`, additionally:

| Key | Type | Description |
|-----|------|-------------|
| `tracked_indices` | List[Tensor] | Unique token indices per position |
| `tracked_probs` | List[Tensor[n_layers, n_tracked]] | Probability trajectories |

#### Example

```python
# Basic collection (no trajectories)
data = collect_logit_lens_topk_efficient(
    "Hello world",
    model,
    top_k=3,
    remote=True
)

# With trajectories for visualization
data = collect_logit_lens_topk_efficient(
    "The quick brown fox",
    model,
    top_k=5,
    track_across_layers=True,
    remote=True
)

# Analyze specific layers only
data = collect_logit_lens_topk_efficient(
    "Test prompt",
    model,
    layers=[0, 10, 20, 30, 40],  # Every 10th layer
    remote=True
)
```

#### Bandwidth

For Llama-70B (80 layers, 128k vocab, 20 tokens):
- Naive (full logits): ~819 MB
- This function (top-5): ~64 KB
- With trajectories: ~320 KB total

---

### `collect_logit_lens_topk`

```python
def collect_logit_lens_topk(
    prompt: str,
    model,
    top_k: int = 5,
    track_across_layers: bool = False,
    remote: bool = True,
    layers: Optional[List[int]] = None,
    model_type: Optional[str] = None,
) -> Dict
```

Simple version that downloads full logits before processing. **Use `collect_logit_lens_topk_efficient` instead for better performance.**

Same parameters and return format as `collect_logit_lens_topk_efficient`.

---

### `decode_tracked_tokens`

```python
def decode_tracked_tokens(data: Dict, tokenizer) -> Dict[int, List[str]]
```

Decode tracked token indices to strings.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | Dict | Data from collection function |
| `tokenizer` | Tokenizer | Model tokenizer |

#### Returns

Dict mapping position index to list of token strings.

#### Example

```python
decoded = decode_tracked_tokens(data, model.tokenizer)
# {0: [" the", " a", " an"], 1: [" quick", " fast"], ...}
```

---

## Display

### `show_logit_lens`

```python
def show_logit_lens(
    data: Dict,
    tokenizer,
    title: Optional[str] = None,
    container_id: Optional[str] = None,
) -> HTML
```

Display interactive logit lens visualization in Jupyter. Returns self-contained HTML that works without any widget installation.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | Dict | required | Data from collection with `track_across_layers=True` |
| `tokenizer` | Tokenizer | required | Model tokenizer for decoding |
| `title` | str | None | Optional title for the widget |
| `container_id` | str | None | Optional container ID (auto-generated) |

#### Returns

IPython HTML object that displays the interactive widget.

#### Example

```python
from logitlenskit import collect_logit_lens_topk_efficient, show_logit_lens

data = collect_logit_lens_topk_efficient(
    "The capital of France is",
    model,
    track_across_layers=True,
    remote=True
)

# Display widget
show_logit_lens(data, model.tokenizer, title="France Capital")
```

---

### `display_logit_lens`

```python
def display_logit_lens(
    data: Dict,
    tokenizer,
    title: Optional[str] = None,
) -> None
```

Convenience function that calls `show_logit_lens` and `display()` automatically.

---

### `format_data_for_widget`

```python
def format_data_for_widget(data: Dict, tokenizer) -> Dict
```

Convert raw collection data to the JSON format expected by LogitLensWidget.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | Dict | Raw data from collection function |
| `tokenizer` | Tokenizer | Model tokenizer |

#### Returns

Dict in widget-compatible format (see [DATA_FORMAT.md](DATA_FORMAT.md)).

---

## Model Configuration

### `get_model_config`

```python
def get_model_config(model, model_type: Optional[str] = None) -> Dict[str, Any]
```

Get model configuration, auto-detecting architecture if not specified.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | LanguageModel | required | nnsight LanguageModel |
| `model_type` | str | None | Explicit type or None to auto-detect |

#### Returns

Configuration dict with keys: `layers`, `norm`, `lm_head`, `n_layers`.

---

### `detect_model_type`

```python
def detect_model_type(model) -> str
```

Auto-detect model type from config.

#### Returns

Model type string (e.g., "llama", "gpt2", "gpt_neox").

#### Raises

`ValueError` if model type cannot be detected.

---

### `MODEL_CONFIGS`

```python
MODEL_CONFIGS: Dict[str, Dict[str, Any]]
```

Registry of model configurations. See [MODEL_SUPPORT.md](MODEL_SUPPORT.md) for details.

---

### `MODEL_ALIASES`

```python
MODEL_ALIASES: Dict[str, str]
```

Mapping of common names to canonical model types.

```python
MODEL_ALIASES = {
    "pythia": "gpt_neox",
    "llama2": "llama",
    "llama3": "llama",
    # ...
}
```

---

## Utilities

### `get_value`

```python
def get_value(saved) -> Any
```

Helper to extract value from nnsight proxy or direct tensor.

```python
# Works with both remote (proxy) and local (tensor) execution
tensor = get_value(saved_result)
```

### `resolve_accessor`

```python
def resolve_accessor(model, accessor: Union[str, Callable]) -> Any
```

Resolve a string path or callable to get a module/value.

```python
# String path
layers = resolve_accessor(model, "model.layers")
n_layers = resolve_accessor(model, "config.num_hidden_layers")

# Callable
layers = resolve_accessor(model, lambda m: m.get_layers())
```

### `apply_module_or_callable`

```python
def apply_module_or_callable(model, accessor: Union[str, Callable], hidden) -> Tensor
```

Apply a norm or lm_head accessor to hidden states.

Handles:
1. String path to module → `module(hidden)`
2. Callable returning module → `callable(model)(hidden)`
3. Callable with 2 args → `callable(model, hidden)`
4. Callable returning weights → `hidden @ weights`
