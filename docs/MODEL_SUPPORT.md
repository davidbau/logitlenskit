# Model Support

LogitLensKit supports multiple transformer architectures through a registry pattern. Each model family has different internal structure (layer paths, normalization, output projection), and the registry provides a unified interface.

## Supported Models

| Model Type | Architecture | Layers Path | Norm | lm_head | Examples |
|------------|--------------|-------------|------|---------|----------|
| `llama` | LlamaForCausalLM | `model.layers` | `model.norm` | `lm_head` | Llama 2, Llama 3, CodeLlama |
| `mistral` | MistralForCausalLM | `model.layers` | `model.norm` | `lm_head` | Mistral 7B, Mixtral |
| `qwen2` | Qwen2ForCausalLM | `model.layers` | `model.norm` | `lm_head` | Qwen 2 |
| `gpt2` | GPT2LMHeadModel | `transformer.h` | `transformer.ln_f` | `lm_head` | GPT-2 (all sizes) |
| `gptj` | GPTJForCausalLM | `transformer.h` | `transformer.ln_f` | `lm_head` | GPT-J 6B |
| `gpt_neox` | GPTNeoXForCausalLM | `gpt_neox.layers` | `gpt_neox.final_layer_norm` | `embed_out` | GPT-NeoX, Pythia |
| `olmo` | OLMoForCausalLM | `model.transformer.blocks` | `model.transformer.ln_f` | `model.transformer.ff_out` | OLMo |
| `phi` | PhiForCausalLM | `model.layers` | `model.final_layernorm` | `lm_head` | Phi-3 |
| `gemma` | GemmaForCausalLM | `model.layers` | `model.norm` | `lm_head` | Gemma, Gemma 2 |

## Aliases

Common model names are aliased to their canonical types:

```python
MODEL_ALIASES = {
    "llama2": "llama",
    "llama3": "llama",
    "codellama": "llama",
    "pythia": "gpt_neox",
    "gpt-j": "gptj",
    "gpt-neox": "gpt_neox",
    "qwen": "qwen2",
    "gemma2": "gemma",
    "phi3": "phi",
    "phi-3": "phi",
}
```

## Auto-Detection

Model type is automatically detected from the model config:

```python
from logitlenskit import detect_model_type, collect_logit_lens_topk_efficient

# Auto-detection (recommended)
data = collect_logit_lens_topk_efficient(prompt, model)

# Explicit model type (if auto-detection fails)
data = collect_logit_lens_topk_efficient(prompt, model, model_type="llama")
```

Detection checks:
1. `model.config.model_type` - Direct match or alias
2. `model.config.architectures` - Pattern matching in class names

## Adding Custom Models

### Option 1: String Paths (Simple)

For models with standard module structure:

```python
from logitlenskit import MODEL_CONFIGS

MODEL_CONFIGS["my_model"] = {
    "layers": "backbone.transformer.layers",
    "norm": "backbone.transformer.final_norm",
    "lm_head": "output_head",
    "n_layers": "config.num_layers",
}
```

String paths are dot-separated attribute names resolved at runtime.

### Option 2: Callables (Flexible)

For models with non-standard access patterns:

```python
from logitlenskit import MODEL_CONFIGS

MODEL_CONFIGS["custom_model"] = {
    # Callable returning module
    "layers": lambda m: m.get_layers(),

    # Callable with 2 args: (model, hidden) -> normalized
    "norm": lambda m, h: m.custom_normalize(h),

    # Callable returning weight matrix (for tied embeddings)
    "lm_head": lambda m: m.embeddings.weight.T,

    # Callable returning int
    "n_layers": lambda m: len(m.get_layers()),
}
```

Callable signatures:
- **1-arg** `fn(model)` - Returns module, weight matrix, or value
- **2-arg** `fn(model, hidden)` - Applies transformation directly

### Example: Custom Model with Tied Embeddings

```python
MODEL_CONFIGS["tied_embedding_model"] = {
    "layers": "model.layers",
    "norm": "model.ln_f",
    # Tied embedding: lm_head uses transposed embedding weights
    "lm_head": lambda m: m.model.embed_tokens.weight,
    "n_layers": "config.num_hidden_layers",
}
```

## Registry Configuration Details

Each config dict must have these keys:

### `layers`
Path to the layer list (ModuleList). Used to access individual layers by index:

```python
layers = resolve_accessor(model, cfg["layers"])
hidden = layers[layer_idx].output[0]
```

### `norm`
Final layer normalization. Applied to hidden states before the output projection:

```python
normed = apply_module_or_callable(model, cfg["norm"], hidden)
```

### `lm_head`
Output projection (language model head). Converts hidden states to logits:

```python
logits = apply_module_or_callable(model, cfg["lm_head"], normed)
```

Can be:
- Module with `forward()` method
- Weight matrix (applied as `hidden @ weights`)
- Callable that applies custom projection

### `n_layers`
Number of transformer layers. Used to determine default layer range:

```python
n_layers = resolve_accessor(model, cfg["n_layers"])
layers = list(range(n_layers))  # Default: all layers
```

## Architecture Differences

### Normalization

Most models use RMSNorm or LayerNorm before the output projection:

| Model | Norm Type | Location |
|-------|-----------|----------|
| Llama | RMSNorm | `model.norm` |
| GPT-2 | LayerNorm | `transformer.ln_f` |
| GPT-NeoX | LayerNorm | `gpt_neox.final_layer_norm` |

### Output Projection

| Model | lm_head Type | Notes |
|-------|--------------|-------|
| Llama | Linear | Separate `lm_head` module |
| GPT-2 | Linear | `lm_head` module |
| GPT-NeoX | Embedding | `embed_out` (may be tied) |
| OLMo | Linear | `ff_out` in transformer block |

### Hidden State Access

All models use `layer.output[0]` to get hidden states from layer output.

## NDIF-Hosted Models

For NDIF remote execution, these models are regularly available:

| Model | HuggingFace ID | Notes |
|-------|----------------|-------|
| GPT-J 6B | `EleutherAI/gpt-j-6B` | Fast, good for testing |
| Llama 3.1 8B | `meta-llama/Llama-3.1-8B` | Requires HF token |
| Llama 3.1 70B | `meta-llama/Llama-3.1-70B` | Large, production target |

Check [NDIF documentation](https://ndif.us) for current availability.

## Troubleshooting

### "Unknown model type" Error

```python
ValueError: Unknown model type: xyz. Supported types: ['llama', 'gpt2', ...]
```

Solutions:
1. Pass `model_type` explicitly: `collect_logit_lens_topk_efficient(..., model_type="llama")`
2. Add custom config to `MODEL_CONFIGS`

### Model Detection Incorrect

If auto-detection chooses the wrong type:

```python
from logitlenskit import detect_model_type

# Check what was detected
detected = detect_model_type(model)
print(f"Detected: {detected}")

# Override with correct type
data = collect_logit_lens_topk_efficient(..., model_type="correct_type")
```

### Custom Model Not Working

Debug with:

```python
from logitlenskit import resolve_accessor, get_model_config

cfg = get_model_config(model, model_type="my_model")

# Test each accessor
layers = resolve_accessor(model, cfg["layers"])
print(f"Layers: {type(layers)}, count: {len(layers)}")

n_layers = resolve_accessor(model, cfg["n_layers"])
print(f"n_layers: {n_layers}")
```
