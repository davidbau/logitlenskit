# Data Format Specification

This document describes the data formats used in LogitLensKit for communication between the Python data collection and JavaScript visualization.

## Overview

There are two data formats:

1. **Raw Python Format** - Output from `collect_logit_lens_topk_efficient()`
2. **Widget JSON Format** - Input to `LogitLensWidget()`

The `format_data_for_widget()` function converts from raw to widget format.

---

## Raw Python Format

Output from `collect_logit_lens_topk_efficient()` with `track_across_layers=True`:

```python
{
    "tokens": List[str],           # Input token strings
    "layers": List[int],           # Layer indices analyzed
    "top_indices": Tensor,         # [n_layers, seq_len, k]
    "top_probs": Tensor,           # [n_layers, seq_len, k]
    "tracked_indices": List[Tensor],  # Per-position unique tokens
    "tracked_probs": List[Tensor],    # Per-position trajectories
}
```

### Field Details

#### `tokens`
List of input token strings as decoded by the tokenizer.

```python
["<s>", "The", " quick", " brown", " fox"]
```

Note: Leading spaces are preserved (e.g., `" quick"` not `"quick"`).

#### `layers`
List of layer indices that were analyzed.

```python
[0, 1, 2, ..., 79]  # All layers
[0, 4, 8, 12, ...]  # Every 4th layer
```

#### `top_indices`
Tensor of shape `[n_layers, seq_len, k]` containing token vocabulary indices of the top-k predictions at each layer and position.

```python
# top_indices[layer_idx, position_idx, rank]
top_token_at_layer_5_pos_3 = top_indices[5, 3, 0]  # Top-1
second_token_at_layer_5_pos_3 = top_indices[5, 3, 1]  # Top-2
```

#### `top_probs`
Tensor of shape `[n_layers, seq_len, k]` containing probabilities (0-1) corresponding to `top_indices`.

```python
# top_probs[layer_idx, position_idx, rank]
prob_of_top_token = top_probs[5, 3, 0]  # e.g., 0.234
```

#### `tracked_indices`
List of length `seq_len`, where each element is a Tensor of unique token indices that appeared in top-k at ANY layer for that position.

```python
# tracked_indices[position] = Tensor of unique token indices
tracked_indices[0]  # Tensor([1234, 5678, 9012, ...])
```

The number of tracked tokens varies per position (typically 20-100 tokens).

#### `tracked_probs`
List of length `seq_len`, where each element is a Tensor of shape `[n_layers, n_tracked]` containing the probability trajectory for each tracked token.

```python
# tracked_probs[position][layer, tracked_idx]
tracked_probs[0]  # Shape: [80, 45] for 80 layers, 45 tracked tokens
tracked_probs[0][:, 0]  # Trajectory of first tracked token across all layers
```

---

## Widget JSON Format

Input to `LogitLensWidget()`. JSON-serializable structure:

```javascript
{
  "layers": [0, 1, 2, ..., 79],
  "tokens": ["<s>", "The", " quick", " brown", " fox"],
  "cells": [
    // Position 0
    [
      // Layer 0
      {
        "token": " the",
        "prob": 0.0234,
        "trajectory": [0.01, 0.02, 0.03, ...],
        "topk": [
          { "token": " the", "prob": 0.0234, "trajectory": [...] },
          { "token": " a", "prob": 0.0189, "trajectory": [...] },
          { "token": " an", "prob": 0.0123, "trajectory": [...] }
        ]
      },
      // Layer 1
      { ... },
      // ... more layers
    ],
    // Position 1
    [ ... ],
    // ... more positions
  ]
}
```

### Field Details

#### `layers`
Array of layer indices (same as Python format).

#### `tokens`
Array of input token strings (same as Python format).

#### `cells`
2D array indexed as `cells[position][layer]`. Each cell contains:

| Field | Type | Description |
|-------|------|-------------|
| `token` | string | Top-1 predicted token at this position/layer |
| `prob` | number | Probability of top-1 token (0-1) |
| `trajectory` | number[] | Top-1's probability at each layer |
| `topk` | object[] | Array of top-k predictions |

#### `topk` Array

Each element in `topk`:

| Field | Type | Description |
|-------|------|-------------|
| `token` | string | Predicted token string |
| `prob` | number | Probability at this layer (0-1) |
| `trajectory` | number[] | This token's probability at each layer |

---

## Conversion

Use `format_data_for_widget()` to convert:

```python
from logitlenskit import collect_logit_lens_topk_efficient, format_data_for_widget

# Collect raw data
raw_data = collect_logit_lens_topk_efficient(
    prompt, model,
    track_across_layers=True,
    remote=True
)

# Convert to widget format
widget_data = format_data_for_widget(raw_data, model.tokenizer)

# Now widget_data can be JSON serialized
import json
json_str = json.dumps(widget_data)
```

### Conversion Logic

For each position and layer:

1. Get top-k token indices and probabilities from `top_indices` and `top_probs`
2. Decode token indices to strings using tokenizer
3. Look up each token's trajectory in `tracked_probs` using `tracked_indices`
4. Build the cell structure with token, prob, trajectory, and topk array

```python
for pos in range(len(tokens)):
    for layer in range(len(layers)):
        top_idx = top_indices[layer, pos, 0]  # Top-1 index
        top_tok = tokenizer.decode([top_idx])
        top_prob = top_probs[layer, pos, 0]

        # Find trajectory
        tracked_list = tracked_indices[pos].tolist()
        if top_idx in tracked_list:
            ti = tracked_list.index(top_idx)
            trajectory = tracked_probs[pos][:, ti].tolist()
        else:
            trajectory = [0.0] * len(layers)

        # Build cell...
```

---

## Bandwidth Comparison

For Llama-70B (80 layers, 128k vocab, 20 tokens):

| Format | Size | Notes |
|--------|------|-------|
| Full logits | ~819 MB | 80 * 20 * 128k * 4 bytes |
| Raw Python (top-5) | ~64 KB | Indices + probs only |
| Raw Python (with trajectories) | ~320 KB | + ~50 tracked tokens per position |
| Widget JSON | ~400 KB | Decoded strings add overhead |

The key optimization is computing top-k and unique operations on the server before transmission.

---

## Example Data

### Minimal Example

```javascript
{
  "layers": [0, 1],
  "tokens": ["Hello"],
  "cells": [
    [
      {
        "token": " world",
        "prob": 0.45,
        "trajectory": [0.1, 0.45],
        "topk": [
          { "token": " world", "prob": 0.45, "trajectory": [0.1, 0.45] },
          { "token": "!", "prob": 0.2, "trajectory": [0.05, 0.2] }
        ]
      },
      {
        "token": " world",
        "prob": 0.45,
        "trajectory": [0.1, 0.45],
        "topk": [
          { "token": " world", "prob": 0.45, "trajectory": [0.1, 0.45] },
          { "token": "!", "prob": 0.2, "trajectory": [0.05, 0.2] }
        ]
      }
    ]
  ]
}
```

### Sample Data Files

- `js/tests/fixtures/sample-data-small.json` - 4 layers, 4 tokens
- `preview_data.js` - Real Llama 3.1 70B data (JSONP format)
