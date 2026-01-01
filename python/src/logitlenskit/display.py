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


def format_data_for_widget(data: Dict, tokenizer) -> Dict:
    """
    Convert raw collection data to widget-compatible JSON format.

    Args:
        data: Raw data from collect_logit_lens_topk_efficient
        tokenizer: Model tokenizer for decoding token indices

    Returns:
        Dict in the format expected by LogitLensWidget
    """
    n_layers_total = len(data["layers"])

    js_data = {
        "layers": data["layers"],
        "tokens": data["tokens"],
        "cells": []
    }

    for pos in range(len(data["tokens"])):
        pos_data = []
        tracked_idx_list = data["tracked_indices"][pos].tolist()
        tracked_probs_matrix = data["tracked_probs"][pos]

        for li in range(n_layers_total):
            top_p = data["top_probs"][li, pos]
            top_i = data["top_indices"][li, pos]

            top1_idx = top_i[0].item()
            top1_tok = tokenizer.decode([top1_idx])
            top1_prob = top_p[0].item()

            if top1_idx in tracked_idx_list:
                ti = tracked_idx_list.index(top1_idx)
                top1_trajectory = tracked_probs_matrix[:, ti].tolist()
            else:
                top1_trajectory = [0.0] * n_layers_total

            topk_list = []
            for ki in range(len(top_i)):
                tok_idx = top_i[ki].item()
                tok_str = tokenizer.decode([tok_idx])
                tok_prob = top_p[ki].item()

                if tok_idx in tracked_idx_list:
                    ti = tracked_idx_list.index(tok_idx)
                    trajectory = tracked_probs_matrix[:, ti].tolist()
                else:
                    trajectory = [0.0] * n_layers_total

                topk_list.append({
                    "token": tok_str,
                    "prob": round(tok_prob, 5),
                    "trajectory": [round(p, 5) for p in trajectory]
                })

            pos_data.append({
                "token": top1_tok,
                "prob": round(top1_prob, 5),
                "trajectory": [round(p, 5) for p in top1_trajectory],
                "topk": topk_list
            })

        js_data["cells"].append(pos_data)

    return js_data


def show_logit_lens(
    data: Dict,
    tokenizer,
    title: Optional[str] = None,
    container_id: Optional[str] = None,
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
    widget_data = format_data_for_widget(data, tokenizer)

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
) -> None:
    """
    Display interactive logit lens visualization in Jupyter (convenience function).

    Same as show_logit_lens but calls display() automatically.

    Args:
        data: Data from collect_logit_lens_topk_efficient with track_across_layers=True
        tokenizer: Model tokenizer for decoding token indices
        title: Optional title for the widget
    """
    display(show_logit_lens(data, tokenizer, title))
