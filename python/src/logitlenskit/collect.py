"""
Efficient logit lens data collection for NDIF remote execution.

This module provides functions to collect logit lens data from transformer
language models, optimized for remote execution via NDIF where bandwidth
between server and client is the primary bottleneck.

Key insight: For a 70B model with 80 layers and 128k vocabulary, naive
transmission of full logits would require ~800MB per prompt. By computing
top-k and trajectory extraction on the server, we reduce this to ~400KB.
"""

import torch
from typing import List, Dict, Optional

from .models import get_model_config, resolve_accessor, apply_module_or_callable
from .utils import get_value


def collect_logit_lens_topk(
    prompt: str,
    model,
    top_k: int = 5,
    track_across_layers: bool = False,
    remote: bool = True,
    layers: Optional[List[int]] = None,
    model_type: Optional[str] = None,
) -> Dict:
    """
    Collect logit lens data for visualization.

    This version downloads full logits from the server before processing.
    For bandwidth-efficient collection, use collect_logit_lens_topk_efficient.

    Args:
        prompt: Input text
        model: nnsight LanguageModel
        top_k: Number of top predictions to track
        track_across_layers: If True, find tokens in top-k at ANY layer,
            then track their probabilities at ALL layers. If False, just
            return top-k at each layer independently.
        remote: Use NDIF remote execution
        layers: Specific layers to analyze (default: all layers)
        model_type: Model architecture type (auto-detected if None)

    Returns:
        Dict with:
            - tokens: List of input token strings
            - layers: List of layer indices analyzed
            - If track_across_layers=False:
                - top_indices: [n_layers, seq_len, k] token indices
                - top_probs: [n_layers, seq_len, k] probabilities
            - If track_across_layers=True:
                - tracked_indices: [seq_len, n_tracked] unique token indices per position
                - tracked_probs: [n_layers, seq_len, n_tracked] probabilities
                - top_indices: [n_layers, seq_len, k] which of tracked are top-k per layer
    """
    # Get model-specific configuration
    cfg = get_model_config(model, model_type)
    n_layers = resolve_accessor(model, cfg["n_layers"])
    model_layers = resolve_accessor(model, cfg["layers"])

    if layers is None:
        layers = list(range(n_layers))

    # Tokenize
    token_ids = model.tokenizer.encode(prompt)
    token_strs = [model.tokenizer.decode([t]) for t in token_ids]
    seq_len = len(token_ids)

    # Collect logits at all layers - use list.save()
    saved_logits = None
    with model.trace(prompt, remote=remote):
        logits_list = []
        for layer_idx in layers:
            hidden = model_layers[layer_idx].output[0]
            normed = apply_module_or_callable(model, cfg["norm"], hidden)
            logits = apply_module_or_callable(model, cfg["lm_head"], normed)
            # Remove batch dim if present: [seq_len, vocab]
            seq_logits = logits[0] if len(logits.shape) == 3 else logits
            logits_list.append(seq_logits)
        saved_logits = logits_list.save()

    # Stack into [n_layers, seq_len, vocab]
    all_logits = torch.stack([get_value(t).float() for t in saved_logits])

    # Compute probabilities
    all_probs = torch.softmax(all_logits, dim=-1)

    # Get top-k at each layer/position
    top_probs, top_indices = all_probs.topk(top_k, dim=-1)
    # Shape: [n_layers, seq_len, k]

    if not track_across_layers:
        return {
            "tokens": token_strs,
            "layers": layers,
            "top_indices": top_indices,
            "top_probs": top_probs,
        }

    # Track across layers mode:
    # Find union of top-k tokens at each position across all layers
    tracked_indices_per_pos = []
    tracked_probs_per_pos = []

    for pos in range(seq_len):
        # Collect all tokens that appear in top-k at any layer for this position
        all_top_at_pos = top_indices[:, pos, :].reshape(-1)  # [n_layers * k]
        unique_tokens = torch.unique(all_top_at_pos)

        # Get probabilities for these tokens at all layers
        # all_probs[:, pos, :] is [n_layers, vocab]
        probs_for_tracked = all_probs[:, pos, :][:, unique_tokens]  # [n_layers, n_unique]

        tracked_indices_per_pos.append(unique_tokens)
        tracked_probs_per_pos.append(probs_for_tracked)

    return {
        "tokens": token_strs,
        "layers": layers,
        "tracked_indices": tracked_indices_per_pos,  # List of [n_tracked] per position
        "tracked_probs": tracked_probs_per_pos,  # List of [n_layers, n_tracked] per position
        "top_indices": top_indices,  # [n_layers, seq_len, k] for identifying top-k
        "top_probs": top_probs,  # [n_layers, seq_len, k]
    }


def collect_logit_lens_topk_efficient(
    prompt: str,
    model,
    top_k: int = 5,
    track_across_layers: bool = False,
    remote: bool = True,
    layers: Optional[List[int]] = None,
    model_type: Optional[str] = None,
) -> Dict:
    """
    Collect logit lens data with server-side reduction for minimal bandwidth.

    This is the recommended function for NDIF remote execution. All heavy
    computation (softmax, top-k, unique, indexing) happens on the server,
    transmitting only the essential results back to the client.

    Bandwidth comparison for Llama-70B (80 layers, 128k vocab, 20 tokens):
        - Naive (full logits):     80 * 20 * 128k * 4 bytes = 819 MB
        - This function (top-5):   80 * 20 * 5 * 8 bytes   = 64 KB
        - With trajectories:       + ~80 * 20 * 50 * 4     = ~320 KB total

    The trajectory tracking identifies which tokens appear in top-k at ANY
    layer for each position, then extracts just those tokens' probabilities
    across all layers. This enables visualization of how predictions evolve
    without downloading the full probability distribution.

    Args:
        prompt: Input text to analyze
        model: nnsight LanguageModel instance
        top_k: Number of top predictions per layer/position (default: 5)
        track_across_layers: If True, track probability trajectories for
            tokens appearing in top-k at any layer. Required for trajectory
            visualization in LogitLensWidget. (default: False)
        remote: Use NDIF remote execution (default: True)
        layers: Specific layer indices to analyze (default: all layers)
        model_type: Model architecture type (auto-detected if None).
            Supported: llama, gpt2, gptj, gpt_neox, pythia, olmo, phi, gemma, etc.

    Returns:
        Dict containing:
            tokens: List[str] - Input token strings
            layers: List[int] - Layer indices analyzed
            top_indices: Tensor[n_layers, seq_len, k] - Top-k token indices
            top_probs: Tensor[n_layers, seq_len, k] - Top-k probabilities

        If track_across_layers=True, additionally:
            tracked_indices: List[Tensor] - Unique token indices per position
            tracked_probs: List[Tensor[n_layers, n_tracked]] - Trajectories

    Example:
        >>> data = collect_logit_lens_topk_efficient(
        ...     "The capital of France is",
        ...     model,
        ...     top_k=5,
        ...     track_across_layers=True,
        ...     remote=True
        ... )
        >>> # Check top prediction at final layer for last token
        >>> final_layer = len(data["layers"]) - 1
        >>> last_pos = len(data["tokens"]) - 1
        >>> top_token_idx = data["top_indices"][final_layer, last_pos, 0]
        >>> print(model.tokenizer.decode([top_token_idx]))  # " Paris"
    """
    # Get model-specific configuration
    cfg = get_model_config(model, model_type)
    n_layers = resolve_accessor(model, cfg["n_layers"])
    model_layers = resolve_accessor(model, cfg["layers"])

    if layers is None:
        layers = list(range(n_layers))

    # Tokenize
    token_ids = model.tokenizer.encode(prompt)
    token_strs = [model.tokenizer.decode([t]) for t in token_ids]

    if not track_across_layers:
        # Simple mode: just get top-k at each layer
        saved_data = None
        with model.trace(prompt, remote=remote):
            results = []
            for layer_idx in layers:
                hidden = model_layers[layer_idx].output[0]
                normed = apply_module_or_callable(model, cfg["norm"], hidden)
                logits = apply_module_or_callable(model, cfg["lm_head"], normed)
                seq_logits = logits[0] if len(logits.shape) == 3 else logits
                probs = torch.softmax(seq_logits, dim=-1)
                top_probs, top_indices = probs.topk(top_k, dim=-1)
                # Save as tuple
                results.append((top_probs, top_indices))
            saved_data = results.save()

        # Unpack results
        top_probs_list = []
        top_indices_list = []
        for probs, indices in saved_data:
            top_probs_list.append(get_value(probs).float())
            top_indices_list.append(get_value(indices))

        return {
            "tokens": token_strs,
            "layers": layers,
            "top_indices": torch.stack(top_indices_list),
            "top_probs": torch.stack(top_probs_list),
        }

    # Track across layers mode - single-pass approach
    # All computation happens on the server: top-k, unique, and prob extraction

    seq_len = len(token_ids)
    num_layers = len(layers)

    saved_results = None
    with model.trace(prompt, remote=remote):
        # First collect all probs and top-k for each layer
        all_probs = []  # [n_layers, seq_len, vocab]
        all_top_indices = []  # [n_layers, seq_len, k]
        all_top_probs = []  # [n_layers, seq_len, k]

        for layer_idx in layers:
            hidden = model_layers[layer_idx].output[0]
            normed = apply_module_or_callable(model, cfg["norm"], hidden)
            logits = apply_module_or_callable(model, cfg["lm_head"], normed)
            seq_logits = logits[0] if len(logits.shape) == 3 else logits
            probs = torch.softmax(seq_logits, dim=-1)
            top_p, top_i = probs.topk(top_k, dim=-1)
            all_probs.append(probs)
            all_top_indices.append(top_i)
            all_top_probs.append(top_p)

        # Stack top-k results: [n_layers, seq_len, k]
        stacked_top_indices = torch.stack(all_top_indices)
        stacked_top_probs = torch.stack(all_top_probs)

        # For each position, find unique tokens and extract their probs
        tracked_results = []
        for pos in range(seq_len):
            # Get all top-k indices at this position across layers: [n_layers * k]
            pos_indices = stacked_top_indices[:, pos, :].reshape(-1)
            unique_tokens = torch.unique(pos_indices)

            # Extract probs for these tokens at all layers
            pos_tracked_probs = []
            for li in range(num_layers):
                probs_at_layer = all_probs[li][pos, unique_tokens]  # [n_unique]
                pos_tracked_probs.append(probs_at_layer)

            # Stack: [n_layers, n_unique]
            tracked_results.append((unique_tokens, torch.stack(pos_tracked_probs)))

        # Save everything
        saved_results = (stacked_top_indices, stacked_top_probs, tracked_results).save()

    # Unpack results
    top_indices, top_probs, tracked_list = saved_results
    top_indices = get_value(top_indices)
    top_probs = get_value(top_probs).float()

    tracked_indices_per_pos = []
    tracked_probs_per_pos = []
    for unique_tokens, probs_matrix in tracked_list:
        tracked_indices_per_pos.append(get_value(unique_tokens))
        tracked_probs_per_pos.append(get_value(probs_matrix).float())

    return {
        "tokens": token_strs,
        "layers": layers,
        "tracked_indices": tracked_indices_per_pos,
        "tracked_probs": tracked_probs_per_pos,
        "top_indices": top_indices,
        "top_probs": top_probs,
    }


def decode_tracked_tokens(data: Dict, tokenizer) -> Dict[int, List[str]]:
    """
    Decode tracked token indices to strings.

    Args:
        data: Data dict from collect_logit_lens_topk_efficient
        tokenizer: Model tokenizer

    Returns:
        Dict mapping position -> list of token strings
    """
    result = {}
    for pos, indices in enumerate(data["tracked_indices"]):
        result[pos] = [tokenizer.decode([idx.item()]) for idx in indices]
    return result
