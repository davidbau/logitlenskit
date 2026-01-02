"""
Logit lens data collection using nnterp for standardized model access.

This module provides functions to collect logit lens data from transformer
language models, optimized for remote execution via NDIF where bandwidth
between server and client is the primary bottleneck.
"""

import torch
from typing import List, Dict, Optional, Union


def collect_logit_lens(
    prompt: str,
    model,
    k: int = 5,
    layers: Optional[List[int]] = None,
    remote: bool = True,
) -> Dict:
    """
    Collect logit lens data: top-k predictions and probability trajectories.

    This function extracts how the model's predictions evolve across layers
    by projecting intermediate hidden states to vocabulary probabilities.

    Args:
        prompt: Input text to analyze
        model: nnterp StandardizedTransformer or nnsight LanguageModel
        k: Number of top predictions to track per layer/position (default: 5)
        layers: Specific layer indices to analyze (default: all layers)
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
        >>> from nnterp import StandardizedTransformer
        >>> model = StandardizedTransformer("openai-community/gpt2")
        >>> data = collect_logit_lens("The capital of France is", model)
        >>> print(data["input"])  # ['The', ' capital', ' of', ' France', ' is']
    """
    # Tokenize once, client-side
    token_ids = model.tokenizer.encode(prompt)
    n_pos = len(token_ids)

    # Default: all layers
    if layers is None:
        layers = list(range(model.num_layers))
    n_layers = len(layers)

    # Run model, compute logit lens (computation happens server-side if remote=True)
    with model.trace(token_ids, remote=remote):
        all_probs = []
        all_topk = []

        for li in layers:
            # Project hidden state to vocabulary: hidden -> norm -> lm_head
            logits = model.lm_head(model.ln_final(model.layers_output[li]))
            probs = torch.softmax(logits[0], dim=-1)
            all_probs.append(probs)
            all_topk.append(probs.topk(k, dim=-1).indices)

        # Stack top-k indices: [n_layers, n_pos, k]
        topk = torch.stack(all_topk).to(torch.int32)

        # For each position: find unique tokens across all layers, extract trajectories
        tracked = []
        probs_out = []
        for pos in range(n_pos):
            # Union of all tokens appearing in top-k at any layer for this position
            unique = torch.unique(topk[:, pos, :].flatten()).to(torch.int32)
            # Extract probability trajectory for each unique token
            traj = torch.stack([all_probs[li][pos, unique] for li in range(n_layers)])
            tracked.append(unique)
            probs_out.append(traj)

        # Save results to transmit from server
        result = {"topk": topk, "tracked": tracked, "probs": probs_out}.save()

    # Build vocabulary map (client-side, only for tracked tokens)
    all_ids = set(result["topk"].flatten().tolist())
    for t in result["tracked"]:
        all_ids.update(t.tolist())
    vocab = {i: model.tokenizer.decode([i]) for i in all_ids}

    # Get model name
    model_name = getattr(model.config, '_name_or_path',
                         getattr(model.config, 'name_or_path', 'unknown'))

    return {
        "model": model_name,
        "input": [model.tokenizer.decode([t]) for t in token_ids],
        "layers": layers,
        "topk": result["topk"],
        "tracked": result["tracked"],
        "probs": result["probs"],
        "vocab": vocab,
    }
