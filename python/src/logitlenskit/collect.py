"""
Logit lens data collection using nnsight for model access.

This module provides functions to collect logit lens data from transformer
language models, optimized for remote execution via NDIF where bandwidth
between server and client is the primary bottleneck.
"""

import torch
import math
from typing import List, Dict, Optional, Any


def _compute_entropy(probs: torch.Tensor) -> torch.Tensor:
    """
    Compute entropy of probability distribution(s).

    Args:
        probs: Tensor of probabilities, last dim is the distribution

    Returns:
        Entropy value(s) in nats. Same shape as input minus last dim.
    """
    # Clamp to avoid log(0)
    probs_clamped = probs.clamp(min=1e-10)
    # H = -sum(p * log(p))
    return -(probs_clamped * probs_clamped.log()).sum(dim=-1)


# =============================================================================
# Model Configuration (inlined to avoid serialization issues with NDIF)
# =============================================================================
# When running remotely, nnsight serializes the trace context. Any cross-module
# imports can cause "Module not whitelisted" errors. We inline configs here.

_MODEL_CONFIGS: Dict[str, Dict[str, str]] = {
    "llama": {
        "layers": "model.layers",
        "norm": "model.norm",
        "lm_head": "lm_head",
        "n_layers": "config.num_hidden_layers",
    },
    "mistral": {
        "layers": "model.layers",
        "norm": "model.norm",
        "lm_head": "lm_head",
        "n_layers": "config.num_hidden_layers",
    },
    "qwen2": {
        "layers": "model.layers",
        "norm": "model.norm",
        "lm_head": "lm_head",
        "n_layers": "config.num_hidden_layers",
    },
    "gpt2": {
        "layers": "transformer.h",
        "norm": "transformer.ln_f",
        "lm_head": "lm_head",
        "n_layers": "config.n_layer",
    },
    "gptj": {
        "layers": "transformer.h",
        "norm": "transformer.ln_f",
        "lm_head": "lm_head",
        "n_layers": "config.n_layer",
    },
    "gpt_neox": {
        "layers": "gpt_neox.layers",
        "norm": "gpt_neox.final_layer_norm",
        "lm_head": "embed_out",
        "n_layers": "config.num_hidden_layers",
    },
    "olmo": {
        "layers": "model.transformer.blocks",
        "norm": "model.transformer.ln_f",
        "lm_head": "model.transformer.ff_out",
        "n_layers": "config.n_layers",
    },
    "phi": {
        "layers": "model.layers",
        "norm": "model.final_layernorm",
        "lm_head": "lm_head",
        "n_layers": "config.num_hidden_layers",
    },
    "gemma": {
        "layers": "model.layers",
        "norm": "model.norm",
        "lm_head": "lm_head",
        "n_layers": "config.num_hidden_layers",
    },
}

_MODEL_ALIASES: Dict[str, str] = {
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


def _resolve_accessor(model, accessor: str) -> Any:
    """Resolve a dot-separated path to get a module or value."""
    obj = model
    for attr in accessor.split("."):
        obj = getattr(obj, attr)
    return obj


def _detect_model_type(model) -> str:
    """Auto-detect model type from config."""
    model_type = getattr(model.config, "model_type", "").lower()

    if model_type in _MODEL_CONFIGS:
        return model_type
    if model_type in _MODEL_ALIASES:
        return _MODEL_ALIASES[model_type]

    # Try architectures field
    archs = getattr(model.config, "architectures", [])
    for arch in archs:
        arch_lower = arch.lower()
        for key in _MODEL_CONFIGS:
            if key in arch_lower:
                return key

    raise ValueError(
        f"Unknown model type: {model_type}. "
        f"Supported: {list(_MODEL_CONFIGS.keys())}"
    )


def _get_model_config(model, model_type: Optional[str] = None) -> Dict[str, str]:
    """Get model configuration, auto-detecting if not specified."""
    if model_type is None:
        model_type = _detect_model_type(model)

    model_type = model_type.lower()
    if model_type in _MODEL_ALIASES:
        model_type = _MODEL_ALIASES[model_type]

    if model_type not in _MODEL_CONFIGS:
        raise ValueError(f"Unknown model type: {model_type}")

    return _MODEL_CONFIGS[model_type]


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
    config = _get_model_config(model, model_type)

    # Resolve model components BEFORE entering trace context
    # This avoids serialization issues with NDIF remote execution
    layers_module = _resolve_accessor(model, config["layers"])
    n_total_layers = _resolve_accessor(model, config["n_layers"])
    norm_module = _resolve_accessor(model, config["norm"])
    lm_head_module = _resolve_accessor(model, config["lm_head"])

    # Tokenize once, client-side
    token_ids = model.tokenizer.encode(prompt)
    n_pos = len(token_ids)

    # Default: all layers
    if layers is None:
        layers = list(range(n_total_layers))
    n_layers = len(layers)

    # Run model, compute logit lens (computation happens server-side if remote=True)
    with model.trace(token_ids, remote=remote):
        # Collect probabilities, top-k, and entropy for each layer
        all_probs = []  # List of [n_pos, vocab_size] tensors
        all_topk = []   # List of [n_pos, k] tensors
        all_entropy = []  # List of [n_pos] tensors

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

            # Compute entropy of the probability distribution at each position
            entropy = _compute_entropy(probs)  # [n_pos]
            all_entropy.append(entropy)

        # Save individual layer results - stacking happens client-side
        result = {"all_topk": all_topk, "all_probs": all_probs, "all_entropy": all_entropy}.save()

    # Client-side: stack and compute tracked tokens
    topk = torch.stack(result["all_topk"], dim=0)  # [n_layers, n_pos, k]
    all_probs = result["all_probs"]  # List of [n_pos, vocab_size]
    entropy = torch.stack(result["all_entropy"], dim=0)  # [n_layers, n_pos]

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
        "entropy": entropy,  # [n_layers, n_pos] - entropy at each layer/position
        "vocab": vocab,
    }
