# Python API Reference

The Python API provides two main functions:

1. **`collect_logit_lens()`** — Runs on NDIF, returns compact tensor data
2. **`show_logit_lens()`** — Converts to widget format, displays in Jupyter

The design optimizes for NDIF's remote execution model: expensive computation happens on the server, and only ~1 MB of summary data is transmitted to the client.

## Installation

```bash
cd python
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Quick Start

```python
from nnterp import StandardizedTransformer
from logitlenskit import collect_logit_lens, show_logit_lens

# Load model via nnterp for standardized access
model = StandardizedTransformer("meta-llama/Llama-3.1-8B")

# Collect data (trajectories included by default)
data = collect_logit_lens("The capital of France is", model, remote=True)

# Display in Jupyter
show_logit_lens(data, title="Capital of France")
```

---

## Data Collection

### `collect_logit_lens`

```python
def collect_logit_lens(
    prompt: str,
    model,
    k: int = 5,
    layers: Optional[List[int]] = None,
    remote: bool = True,
) -> Dict
```

Collect logit lens data with server-side reduction for minimal bandwidth. Probability trajectories are always computed for all tokens appearing in top-k at any layer.

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | str | required | Input text to analyze |
| `model` | StandardizedTransformer | required | nnterp StandardizedTransformer instance |
| `k` | int | 5 | Number of top predictions per layer/position |
| `layers` | List[int] | None | Specific layer indices (default: all) |
| `remote` | bool | True | Use NDIF remote execution |

#### Returns

Dict containing:

| Key | Type | Description |
|-----|------|-------------|
| `model` | str | Model name/path |
| `input` | List[str] | Input token strings |
| `layers` | List[int] | Layer indices analyzed |
| `topk` | Tensor[n_layers, seq_len, k] | Top-k token indices (int32) |
| `tracked` | List[Tensor] | Unique token indices per position (int32) |
| `probs` | List[Tensor[n_layers, n_tracked]] | Probability trajectories (float32) |
| `vocab` | Dict[int, str] | Token index to string mapping |

Note: Top-k probabilities are not stored separately since they can be looked up from the `probs` trajectories, reducing bandwidth.

#### Example

```python
# Collect logit lens data
data = collect_logit_lens(
    "The capital of France is",
    model,
    k=5,
    remote=True
)

# Access results
print(data["input"])      # ['The', ' capital', ' of', ' France', ' is']
print(data["topk"].shape) # [80, 5, 5] for 80 layers, 5 positions, k=5

# Analyze specific layers only
data = collect_logit_lens(
    "Test prompt",
    model,
    layers=[0, 10, 20, 30, 40],  # Every 10th layer
    remote=True
)
```

#### Bandwidth

For Llama-70B (80 layers, 128k vocab, 20 tokens):
- Naive (full logits): ~819 MB
- This function (top-5 with trajectories): ~320 KB total

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
from logitlenskit import collect_logit_lens, show_logit_lens

data = collect_logit_lens("The capital of France is", model, remote=True)

# Display widget
show_logit_lens(data, title="France Capital")
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
