"""
Jupyter display utilities for logit lens visualization.

Provides zero-install HTML output - no ipywidgets required.
"""

import json
from typing import Dict, Optional
from IPython.display import HTML, display


# The LogitLensWidget JavaScript code will be embedded here
# For now, we reference it from a CDN or inline it
_WIDGET_JS_URL = "https://davidbau.github.io/logitlenskit/js/dist/logit-lens-widget.min.js"


def format_data_for_widget(
    data: Dict,
    tokenizer,
    model_name: Optional[str] = None,
) -> Dict:
    """
    Convert raw collection data to widget-compatible JSON format.

    Args:
        data: Raw data from collect_logit_lens_topk_efficient
        tokenizer: Model tokenizer for decoding token indices
        model_name: Optional model name for metadata

    Returns:
        Dict in the compact format expected by LogitLensWidget:
        {
            "meta": { "model": "...", "timestamp": "...", "version": 2 },
            "layers": [0, 4, 8, ...],
            "input": ["The", " quick", ...],
            "tracked": [
                { "fox": [0.01, 0.1, ...], "dog": [...] },  # position 0
                { ... },  # position 1
                ...
            ],
            "topk": [
                [["fox", "dog"], ["the", "a"], ...],  # layer 0
                ...
            ]
        }
    """
    from datetime import datetime, timezone

    n_layers = len(data["layers"])
    n_positions = len(data["tokens"])

    # Build metadata
    meta = {
        "version": 2,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if model_name:
        meta["model"] = model_name

    # Build tracked tokens per position: { tokenString: trajectory }
    tracked = []
    for pos in range(n_positions):
        tracked_idx_list = data["tracked_indices"][pos].tolist()
        tracked_probs_matrix = data["tracked_probs"][pos]

        pos_tracked = {}
        for ti, tok_idx in enumerate(tracked_idx_list):
            tok_str = tokenizer.decode([tok_idx])
            trajectory = tracked_probs_matrix[:, ti].tolist()
            pos_tracked[tok_str] = [round(p, 5) for p in trajectory]

        tracked.append(pos_tracked)

    # Build topk: [n_layers][n_positions] -> list of token strings
    topk = []
    for li in range(n_layers):
        layer_topk = []
        for pos in range(n_positions):
            top_indices = data["top_indices"][li, pos]
            pos_topk = [tokenizer.decode([idx.item()]) for idx in top_indices]
            layer_topk.append(pos_topk)
        topk.append(layer_topk)

    return {
        "meta": meta,
        "layers": data["layers"],
        "input": data["tokens"],
        "tracked": tracked,
        "topk": topk,
    }


def show_logit_lens(
    data: Dict,
    tokenizer,
    title: Optional[str] = None,
    container_id: Optional[str] = None,
    model_name: Optional[str] = None,
) -> HTML:
    """
    Display interactive logit lens visualization in Jupyter.

    This generates self-contained HTML that works without any widget
    installation. The visualization is fully interactive.

    Args:
        data: Data from collect_logit_lens_topk_efficient with track_across_layers=True
        tokenizer: Model tokenizer for decoding token indices
        title: Optional title for the widget
        container_id: Optional container ID (auto-generated if not provided)
        model_name: Optional model name for metadata

    Returns:
        IPython HTML object that displays the widget

    Example:
        >>> data = collect_logit_lens_topk_efficient(prompt, model, track_across_layers=True)
        >>> show_logit_lens(data, model.tokenizer, title="My Analysis")
    """
    import uuid

    if container_id is None:
        container_id = f"logit-lens-{uuid.uuid4().hex[:8]}"

    # Format data for widget
    widget_data = format_data_for_widget(data, tokenizer, model_name=model_name)

    # Build UI state
    ui_state = {}
    if title:
        ui_state["title"] = title

    # Generate HTML with embedded widget
    html = f"""
    <div id="{container_id}" style="background: white; padding: 20px; border-radius: 8px;"></div>
    <script>
    (function() {{
        var data = {json.dumps(widget_data)};
        var uiState = {json.dumps(ui_state)};

        // Check if LogitLensWidget is already loaded
        if (typeof LogitLensWidget !== 'undefined') {{
            LogitLensWidget("#{container_id}", data, uiState);
        }} else {{
            // Load widget script
            var script = document.createElement('script');
            script.src = "{_WIDGET_JS_URL}";
            script.onload = function() {{
                LogitLensWidget("#{container_id}", data, uiState);
            }};
            document.head.appendChild(script);
        }}
    }})();
    </script>
    """

    return HTML(html)


def display_logit_lens(
    data: Dict,
    tokenizer,
    title: Optional[str] = None,
    model_name: Optional[str] = None,
) -> None:
    """
    Display interactive logit lens visualization in Jupyter (convenience function).

    Same as show_logit_lens but calls display() automatically.

    Args:
        data: Data from collect_logit_lens_topk_efficient with track_across_layers=True
        tokenizer: Model tokenizer for decoding token indices
        title: Optional title for the widget
        model_name: Optional model name for metadata
    """
    display(show_logit_lens(data, tokenizer, title, model_name=model_name))
