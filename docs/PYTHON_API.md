# Python API Reference

The Python API provides two main functions that divide the work between server and client:

1. **`collect_logit_lens()`** — Runs the forward pass on NDIF and performs server-side reduction, returning compact tensor data over the network.
2. **`show_logit_lens()`** — Converts the tensor data to the widget's JSON format and renders an interactive visualization in Jupyter.

This separation optimizes for NDIF's remote execution model. Expensive computation (forward passes, softmax, top-k selection) happens on GPU servers, while only ~1 MB of summary data travels over the network. The client then handles the lightweight task of formatting and display.

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

These functions run model inference and extract logit lens data. The main function `collect_logit_lens()` handles the complete workflow, while helper functions provide finer control for advanced use cases.

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

This is the primary entry point for collecting logit lens data. It runs a forward pass through the model, extracts hidden states at each layer, projects them to vocabulary space, and identifies the top-k predictions. To enable trajectory visualization, it also tracks the probability of every token that appears in top-k at any layer, recording how each token's probability evolves from early to late layers.

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

This utility function converts the numeric token indices in the `tracked` field back to human-readable strings. It is useful when you want to inspect which tokens are being tracked at each position without going through the full widget conversion.

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

These functions handle the conversion from tensor data to widget JSON format and render the interactive visualization. In most cases, you will use `show_logit_lens()` directly, but `format_data_for_widget()` is available when you need the JSON data for other purposes.

### `show_logit_lens`

```python
def show_logit_lens(
    data: Dict,
    tokenizer,
    title: Optional[str] = None,
    container_id: Optional[str] = None,
) -> HTML
```

This function converts the raw tensor data to JSON format and renders an interactive logit lens visualization in Jupyter. The output is self-contained HTML that includes all necessary JavaScript and CSS, so it works without any widget installation or external dependencies. The visualization supports clicking cells to see top-k predictions, pinning tokens to compare trajectories, and resizing columns to explore different layers.

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

This convenience function combines `show_logit_lens()` with IPython's `display()` call. Use it when you want to render the widget immediately without capturing the HTML object. It is equivalent to calling `display(show_logit_lens(data, tokenizer, title))`.

---

### `format_data_for_widget`

```python
def format_data_for_widget(data: Dict, tokenizer) -> Dict
```

This function converts the raw tensor data from `collect_logit_lens()` into the V2 JSON format that the JavaScript widget expects. Use it when you need the formatted data for purposes other than immediate display—for example, saving to a file, sending to a web server, or embedding in a custom HTML page.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | Dict | Raw data from collection function |
| `tokenizer` | Tokenizer | Model tokenizer |

#### Returns

Dict in widget-compatible format (see [DATA_FORMAT.md](DATA_FORMAT.md)).

---

## Model Configuration

Different transformer architectures organize their layers, normalization, and output projection differently. These functions provide a unified interface to access these components regardless of whether you're working with Llama, GPT-2, Pythia, or other architectures.

### `get_model_config`

```python
def get_model_config(model, model_type: Optional[str] = None) -> Dict[str, Any]
```

This function returns accessor paths for a model's key components: the layer list, final normalization, and language model head. If `model_type` is not specified, it attempts to auto-detect the architecture from the model's configuration. The returned config can be used to access hidden states and compute logits in a model-agnostic way.

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

This function examines a model's configuration to determine its architecture type. It checks the `model_type` field in the HuggingFace config and maps it to one of the supported architecture configurations. Use this when you need to know what kind of model you're working with before proceeding with analysis.

#### Returns

Model type string (e.g., "llama", "gpt2", "gpt_neox").

#### Raises

`ValueError` if model type cannot be detected.

---

### `MODEL_CONFIGS`

```python
MODEL_CONFIGS: Dict[str, Dict[str, Any]]
```

This dictionary contains the accessor configurations for each supported model architecture. Each entry specifies how to access the layer list, final normalization, language model head, and layer count for that architecture. When adding support for a new model type, you would add an entry here. See [MODEL_SUPPORT.md](MODEL_SUPPORT.md) for the complete list of supported architectures.

---

### `MODEL_ALIASES`

```python
MODEL_ALIASES: Dict[str, str]
```

This dictionary maps common model names to their canonical architecture types. For example, "pythia" maps to "gpt_neox" since Pythia models use the GPT-NeoX architecture. The aliases allow users to specify familiar model names without needing to know the underlying architecture.

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

These helper functions handle the low-level details of working with nnsight's tracing system and accessing model components. They are primarily used internally but are exposed for advanced use cases where you need finer control over the logit lens computation.

### `get_value`

```python
def get_value(saved) -> Any
```

This function extracts the actual tensor value from an nnsight proxy object. When running remotely on NDIF, saved values are proxy objects that need to be resolved after the trace completes. This helper handles both cases uniformly, returning the tensor whether execution was local or remote.

```python
# Works with both remote (proxy) and local (tensor) execution
tensor = get_value(saved_result)
```

### `resolve_accessor`

```python
def resolve_accessor(model, accessor: Union[str, Callable]) -> Any
```

This function resolves an accessor specification to an actual module or value from the model. Accessors can be either dot-separated string paths (like `"model.layers"`) or callable functions that take the model and return the desired component. The flexibility allows model configurations to work across different model interfaces.

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

This function applies a normalization layer or language model head to hidden states. It handles the variety of ways these components can be specified in model configurations: as a string path to a module, as a callable that returns a module, as a callable that directly transforms the hidden states, or as a callable that returns weight matrices for manual multiplication. This flexibility is necessary because different model architectures expose these components differently.

The function handles four patterns:
1. String path to module → `module(hidden)`
2. Callable returning module → `callable(model)(hidden)`
3. Callable with 2 args → `callable(model, hidden)`
4. Callable returning weights → `hidden @ weights`
