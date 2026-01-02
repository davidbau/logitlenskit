# Data Format Specification

This document describes the data formats used in LogitLensKit at each stage of the pipeline, from raw model activations to JavaScript visualization.

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Size Analysis](#size-analysis)
3. [Raw Python Format](#raw-python-format)
4. [Widget JSON Formats](#widget-json-formats)
   - [V1 Format (Legacy)](#v1-format-legacy)
   - [V2 Format (Compact)](#v2-format-compact)
5. [Format Conversion](#format-conversion)
6. [Rationale and Design Decisions](#rationale-and-design-decisions)
7. [Limitations](#limitations)

---

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LOGIT LENS DATA PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Hidden    │    │    Full     │    │  Top-K +    │    │   Widget    │  │
│  │   States    │───▶│   Logits    │───▶│ Trajectories│───▶│    JSON     │  │
│  │  (Server)   │    │  (Server)   │    │  (Server)   │    │  (Client)   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│       35 MB            547 MB             491 KB            823 KB         │
│                                                                              │
│  ◀──────────────── Server Side ────────────────▶ ◀─── Transmitted ───▶     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

The key insight is performing heavy computation (softmax, top-k, unique) on the NDIF server, transmitting only essential results to the client. This reduces bandwidth by **~99.85%**.

---

## Size Analysis

### Llama 3.1 70B Example (14 tokens, 80 layers)

| Stage | Description | Size | Reduction |
|-------|-------------|------|-----------|
| Hidden States | Raw activations per layer | 35.0 MB | baseline |
| Full Logits | Projected to vocabulary | **546.9 MB** | — |
| Top-K Only | Indices + probabilities | 43.8 KB | 12,800× |
| With Trajectories | + tracked token probs | 491.1 KB | 1,140× |
| V2 JSON | Widget-ready format | 822.8 KB | **681×** |

### Actual Measurements

| Dataset | Model | Tokens | Layers | V2 Size |
|---------|-------|--------|--------|---------|
| Preview (Llama) | Llama-3.1-70B | 14 | 80 | 823 KB |
| Preview (GPT-J) | GPT-J-6B | 13 | 28 | 107 KB |
| Test fixture | Synthetic | 4 | 4 | 1.0 KB |

### V1 vs V2 Format Comparison

| Metric | V1 Format | V2 Format | Savings |
|--------|-----------|-----------|---------|
| Test fixture (4×4) | 3.3 KB | 1.0 KB | 69% |
| Trajectory arrays | 36 | 15 | 58% |
| Llama preview (est.) | 3.0 MB | 823 KB | 73% |

The V2 format achieves **~70% reduction** over V1 by eliminating trajectory duplication.

---

## Raw Python Format

Output from `collect_logit_lens_topk_efficient()` with `track_across_layers=True`:

```python
{
    "tokens": List[str],              # Input token strings
    "layers": List[int],              # Layer indices analyzed
    "top_indices": Tensor,            # [n_layers, seq_len, k] - int64
    "top_probs": Tensor,              # [n_layers, seq_len, k] - float32
    "tracked_indices": List[Tensor],  # Per-position unique token indices
    "tracked_probs": List[Tensor],    # Per-position probability trajectories
}
```

### Field Details

#### `tokens`
List of input token strings as decoded by the tokenizer. Leading spaces are preserved:
```python
["<|begin_of_text|>", "The", " quick", " brown", " fox"]
```

#### `layers`
List of layer indices that were analyzed:
```python
[0, 1, 2, ..., 79]  # All 80 layers
[0, 4, 8, 12, ...]  # Every 4th layer (for faster analysis)
```

#### `top_indices` and `top_probs`
Tensors of shape `[n_layers, seq_len, k]` containing the top-k predictions:
```python
# top_indices[layer, position, rank] -> vocabulary index
top_token_idx = top_indices[5, 3, 0]  # Top-1 at layer 5, position 3

# top_probs[layer, position, rank] -> probability (0-1)
top_prob = top_probs[5, 3, 0]  # ~0.234
```

#### `tracked_indices`
List of length `seq_len`. Each element is a Tensor of unique token indices that appeared in top-k at **any** layer for that position:
```python
tracked_indices[0]  # Tensor([1234, 5678, 9012, ...])
# Typically 20-140 unique tokens per position
```

#### `tracked_probs`
List of length `seq_len`. Each element is a Tensor of shape `[n_layers, n_tracked]`:
```python
tracked_probs[0]        # Shape: [80, 101] for 80 layers, 101 tracked tokens
tracked_probs[0][:, 0]  # Trajectory of first tracked token across all 80 layers
```

This is where the trajectory information lives - each column is one token's probability evolution across layers.

---

## Widget JSON Formats

LogitLensWidget accepts two JSON formats. V2 is recommended for new implementations.

### V2 Format (Compact)

**Recommended.** Introduced to eliminate trajectory duplication and reduce bandwidth.

```javascript
{
  "meta": {
    "version": 2,
    "timestamp": "2026-01-02T03:00:07.704214+00:00",
    "model": "meta-llama/Llama-3.1-70B"
  },
  "layers": [0, 1, 2, ..., 79],
  "input": ["<|begin_of_text|>", "Why", " do", " electric", ...],
  "tracked": [
    // Position 0: {token_string: trajectory_array}
    {
      " the": [0.05, 0.06, 0.08, ...],   // 80 values, one per layer
      " a": [0.03, 0.04, 0.05, ...],
      "Question": [0.0, 0.0, ..., 0.31]  // Only significant at final layer
    },
    // Position 1
    { ... },
    // ... more positions
  ],
  "topk": [
    // Layer 0: [[pos0 tokens], [pos1 tokens], ...]
    [[" the", " a", " an"], [" quick", " fast"], ...],
    // Layer 1
    [[" the", " a"], [" brown", " quick"], ...],
    // ... more layers
  ]
}
```

#### V2 Structure

| Field | Type | Description |
|-------|------|-------------|
| `meta` | object | Metadata (version, timestamp, model) |
| `meta.version` | number | Must be `2` |
| `meta.timestamp` | string | ISO 8601 timestamp |
| `meta.model` | string | Model identifier (optional) |
| `layers` | number[] | Layer indices analyzed |
| `input` | string[] | Input token strings |
| `tracked` | object[] | Per-position dict: token → trajectory |
| `topk` | string[][][] | `[layer][position]` → top-k token strings |

#### Key V2 Characteristics

1. **Trajectories stored once**: Each unique token's trajectory is stored exactly once in `tracked[position][token]`
2. **Token strings in topk**: No indices, just decoded strings for display
3. **Metadata included**: Model name and timestamp for provenance
4. **Input not tokens**: Field renamed from `tokens` to `input` for clarity

### V1 Format (Legacy)

Still supported for backward compatibility. Each cell duplicates trajectory data.

```javascript
{
  "layers": [0, 1, 2, 3],
  "tokens": ["The", " quick", " brown", " fox"],
  "cells": [
    // Position 0
    [
      // Layer 0
      {
        "token": " the",           // Top-1 predicted token
        "prob": 0.1234,            // Top-1 probability at this layer
        "trajectory": [0.12, 0.14, 0.16, 0.18],  // Same trajectory repeated!
        "topk": [
          {"token": " the", "prob": 0.12, "trajectory": [0.12, 0.14, 0.16, 0.18]},
          {"token": " a", "prob": 0.09, "trajectory": [0.09, 0.08, 0.07, 0.06]},
          {"token": " an", "prob": 0.05, "trajectory": [0.05, 0.04, 0.03, 0.02]}
        ]
      },
      // Layer 1 - same trajectories repeated again
      {
        "token": " the",
        "prob": 0.1456,
        "trajectory": [0.12, 0.14, 0.16, 0.18],  // Duplicate!
        "topk": [...]
      },
      // ... more layers
    ],
    // ... more positions
  ]
}
```

#### V1 Redundancy Problem

In V1, the same trajectory array appears multiple times:
- Once in `cell.trajectory` (top-1)
- Once in `cell.topk[0].trajectory` (also top-1)
- At every layer where the token appears in top-k

For 80 layers × 5 top-k × 14 positions = **5,600 trajectory copies**, when only ~1,400 unique trajectories exist. This is the **4× duplication** that V2 eliminates.

---

## Format Conversion

### Python to Widget (V2)

```python
from logitlenskit import collect_logit_lens_topk_efficient
from logitlenskit.display import format_data_for_widget

# Collect raw data from NDIF
raw_data = collect_logit_lens_topk_efficient(
    prompt,
    model,
    top_k=5,
    track_across_layers=True,
    remote=True
)

# Convert to V2 widget format
widget_data = format_data_for_widget(
    raw_data,
    model.tokenizer,
    model_name="meta-llama/Llama-3.1-70B"
)

# JSON-serializable
import json
json_str = json.dumps(widget_data)
```

### JavaScript Normalization

The widget automatically normalizes V2 to its internal format on load:

```javascript
// Both work identically
LogitLensWidget('#container', v2Data);  // V2 auto-normalized
LogitLensWidget('#container', v1Data);  // V1 used directly
```

Internally, V2 data is expanded to V1 structure, but **trajectory arrays are shared by reference**, so there's no memory duplication at runtime:

```javascript
// During normalization (simplified)
var trajectory = trackedAtPos[token];  // Reference to V2 array
topkList.push({
    token: token,
    prob: trajectory[layerIndex],
    trajectory: trajectory  // Same reference, no copy
});
```

---

## Rationale and Design Decisions

### Why Server-Side Reduction?

NDIF (National Deep Inference Fabric) runs large models on remote GPUs. The bottleneck is **network bandwidth**, not computation:

| Operation | Location | Cost |
|-----------|----------|------|
| Forward pass | Server | Cheap (GPU) |
| Softmax | Server | Cheap |
| Top-K selection | Server | Cheap |
| Unique token finding | Server | Cheap |
| Data transmission | Network | **Expensive** |

Computing top-k on the server reduces transmission from 547 MB to <1 MB.

### Why Track Across Layers?

The visualization shows how token probabilities **evolve** across layers. Without trajectory tracking, we'd only see snapshots at each layer with no continuity.

The `track_across_layers=True` option:
1. Finds all tokens appearing in top-k at **any** layer
2. Extracts their probabilities at **all** layers
3. Enables smooth trajectory visualization

### Why V2 Over V1?

| Concern | V1 | V2 |
|---------|----|----|
| File size | Larger (trajectory duplication) | ~70% smaller |
| Parse time | Slower (more data) | Faster |
| Memory (in browser) | Same after normalization | Same |
| Simplicity | Denormalized, self-contained | Normalized, requires lookup |
| Backward compat | Native | Requires normalization |

V2 was introduced for NDIF bandwidth optimization. The JavaScript normalizes V2→V1 internally, so both formats have identical runtime behavior.

### Why JSON Instead of Binary?

1. **Debuggability**: JSON is human-readable
2. **Browser compatibility**: Native `JSON.parse()` is fast
3. **Jupyter integration**: Easy embedding in HTML output
4. **Compression**: JSON compresses well with gzip (~70% reduction)

For very large datasets, binary formats (e.g., MessagePack, Protocol Buffers) could be considered, but JSON is sufficient for typical prompt lengths.

---

## Limitations

### Scalability

| Prompt Length | Layers | Approx V2 Size | Notes |
|---------------|--------|----------------|-------|
| 14 tokens | 80 | 823 KB | Comfortable |
| 100 tokens | 80 | ~6 MB | Reasonable |
| 1000 tokens | 80 | ~60 MB | May need streaming |
| 4096 tokens | 80 | ~240 MB | Not recommended |

For very long prompts, consider:
- Analyzing a subset of layers (every 4th)
- Reducing top-k from 5 to 3
- Analyzing subsequences separately

### Precision

Probabilities are stored as floats with 5 decimal places:
```python
[round(p, 5) for p in trajectory]
```

This is sufficient for visualization but may lose precision for very small probabilities (<0.00001).

### Token Decoding

Token strings depend on tokenizer behavior:
- Special tokens: `<|begin_of_text|>`, `<s>`, etc.
- Spaces preserved: `" the"` vs `"the"`
- Unicode: Some tokenizers produce unusual characters

The widget displays tokens as-is; escaping/formatting is the caller's responsibility.

### Missing Tokens

If a token appears in top-k at one layer but not in `tracked`, its trajectory will be zeros. This can happen if:
- The collection used `track_across_layers=False`
- The token was added manually to visualization

---

## Example Data Files

| File | Format | Description |
|------|--------|-------------|
| `js/tests/fixtures/sample-data-small.json` | V1 | 4 layers × 4 tokens, minimal test |
| `js/tests/fixtures/sample-data-v2.json` | V2 | 4 layers × 4 tokens, V2 test |
| `js/tests/fixtures/sample-data-12-layers.json` | V1 | 12 layers × 4 tokens |
| `preview_data.js` | V2 (JSONP) | Llama-3.1-70B, 80 layers × 14 tokens |
| `preview_data_gptj.js` | V2 (JSONP) | GPT-J-6B, 28 layers × 13 tokens |

### JSONP Wrapper

Preview data files use JSONP format for browser loading:
```javascript
var PREVIEW_DATA = { ... };
```

Strip the wrapper for pure JSON:
```javascript
const json = content.replace(/^var \w+ = /, '').replace(/;$/, '');
const data = JSON.parse(json);
```
