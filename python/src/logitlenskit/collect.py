"""
Logit lens data collection using nnsight for model access.

This module provides functions to collect logit lens data from transformer
language models, optimized for remote execution via NDIF where bandwidth
between server and client is the primary bottleneck.
"""

import torch
from typing import List, Dict, Optional, Union

from .models import get_model_config, resolve_accessor


def collect_logit_lens(
    prompt: str,
    model,
    k: int = 5,
    layers: Optional[List[int]] = None,
    model_type: Optional[str] = None,
    remote: bool = True,
) -> Dict:
    """
    Collect logit lens data: top-k predictions and probability trajectories.

    This function extracts how the model's predictions evolve across layers
    by projecting intermediate hidden states to vocabulary probabilities.

    Args:
        prompt: Input text to analyze
        model: nnsight LanguageModel
        k: Number of top predictions to track per layer/position (default: 5)
        layers: Specific layer indices to analyze (default: all layers)
        model_type: Model architecture type (auto-detected if not provided)
        remote: Use NDIF remote execution (default: True)

    Returns:
        Dict with:
            model: Model name/path
            input: List of input token strings
            layers: List of layer indices analyzed
            topk: Tensor[int32] of shape [n_layers, n_positions, k]
            tracked: List of Tensor[int32] per position (unique token indices)
            probs: List of Tensor[float32] per position [n_layers, n_tracked]
            vocab: Dict mapping token indices to strings

    Example:
        >>> from nnsight import LanguageModel
        >>> model = LanguageModel("openai-community/gpt2", device_map="auto")
        >>> data = collect_logit_lens("The capital of France is", model)
        >>> print(data["input"])  # ['The', ' capital', ' of', ' France', ' is']
    """
    # Get model configuration for this architecture
    config = get_model_config(model, model_type)

    # Resolve model components BEFORE entering trace context
    # This avoids serializing logitlenskit.models to the NDIF server
    layers_module = resolve_accessor(model, config["layers"])
    n_total_layers = resolve_accessor(model, config["n_layers"])
    norm_module = resolve_accessor(model, config["norm"])
    lm_head_module = resolve_accessor(model, config["lm_head"])

    # Tokenize once, client-side
    token_ids = model.tokenizer.encode(prompt)
    n_pos = len(token_ids)

    # Default: all layers
    if layers is None:
        layers = list(range(n_total_layers))
    n_layers = len(layers)

    # Run model, compute logit lens (computation happens server-side if remote=True)
    with model.trace(token_ids, remote=remote):
        # Collect probabilities and top-k for each layer
        all_probs = []  # List of [n_pos, vocab_size] tensors
        all_topk = []   # List of [n_pos, k] tensors

        for li in layers:
            # Get hidden state from layer output
            # .output[0] gives the hidden state tensor
            hidden = layers_module[li].output[0]

            # Project hidden state to vocabulary: hidden -> norm -> lm_head
            normed = norm_module(hidden)
            logits = lm_head_module(normed)

            # Handle batch dimension: local mode has [batch, n_pos, vocab],
            # remote mode has [n_pos, vocab]. Squeeze batch if present.
            if logits.dim() == 3:
                logits = logits.squeeze(0)  # Remove batch dim
            probs = torch.softmax(logits, dim=-1)  # [n_pos, vocab_size]
            all_probs.append(probs)
            all_topk.append(probs.topk(k, dim=-1).indices.to(torch.int32))  # [n_pos, k]

        # Save individual layer results - stacking happens client-side
        result = {"all_topk": all_topk, "all_probs": all_probs}.save()

    # Client-side: stack and compute tracked tokens
    topk = torch.stack(result["all_topk"], dim=0)  # [n_layers, n_pos, k]
    all_probs = result["all_probs"]  # List of [n_pos, vocab_size]

    # For each position: find unique tokens across all layers, extract trajectories
    tracked = []
    probs_out = []
    for pos in range(n_pos):
        # Union of all tokens appearing in top-k at any layer for this position
        pos_topk = topk[:, pos, :].flatten()
        unique = torch.unique(pos_topk).to(torch.int32)
        # Extract probability trajectory for each unique token
        traj = torch.stack([all_probs[li][pos, unique] for li in range(n_layers)], dim=0)
        tracked.append(unique)
        probs_out.append(traj)

    # Build vocabulary map (client-side, only for tracked tokens)
    all_ids = set(topk.flatten().tolist())
    for t in tracked:
        all_ids.update(t.tolist())
    vocab = {i: model.tokenizer.decode([i]) for i in all_ids}

    # Get model name
    model_name = getattr(model.config, '_name_or_path',
                         getattr(model.config, 'name_or_path', 'unknown'))

    return {
        "model": model_name,
        "input": [model.tokenizer.decode([t]) for t in token_ids],
        "layers": layers,
        "topk": topk,
        "tracked": tracked,
        "probs": probs_out,
        "vocab": vocab,
    }
