"""
Jupyter display utilities for logit lens visualization.

Provides zero-install HTML output - no ipywidgets required.
"""

import json
from typing import Dict, Optional, Union
from IPython.display import HTML, display


# The LogitLensWidget JavaScript code will be embedded here
_WIDGET_JS_URL = "https://davidbau.github.io/logitlenskit/js/dist/logit-lens-widget.min.js"


def to_js_format(data: Dict) -> Dict:
    """
    Convert Python API format to JavaScript V2 format.

    Args:
        data: Dict from collect_logit_lens() with keys:
            model, input, layers, topk, tracked, probs, vocab

    Returns:
        Dict in JavaScript V2 format with keys:
            meta, input, layers, topk, tracked

    Example:
        >>> js_data = to_js_format(data)
        >>> json.dumps(js_data)  # Ready for JavaScript
    """
    vocab = data["vocab"]
    n_layers = len(data["layers"])
    n_pos = len(data["input"])

    # topk: [n_layers, n_pos, k] indices -> [n_layers][n_pos] string lists
    topk_js = [
        [[vocab[idx.item()] for idx in data["topk"][li, pos]]
         for pos in range(n_pos)]
        for li in range(n_layers)
    ]

    # tracked/probs: parallel arrays -> {token: trajectory} dicts per position
    tracked_js = [
        {
            vocab[idx.item()]: [round(p, 5) for p in data["probs"][pos][:, i].tolist()]
            for i, idx in enumerate(data["tracked"][pos])
        }
        for pos in range(n_pos)
    ]

    return {
        "meta": {"version": 2, "model": data["model"]},
        "input": data["input"],
        "layers": data["layers"],
        "topk": topk_js,
        "tracked": tracked_js,
    }


def _is_js_format(data: Dict) -> bool:
    """Check if data is already in JavaScript V2 format."""
    return "meta" in data and "tracked" in data and isinstance(data["tracked"][0], dict)


def _is_python_format(data: Dict) -> bool:
    """Check if data is in Python API format."""
    return "vocab" in data and "topk" in data and "probs" in data


def show_logit_lens(
    data: Dict,
    title: Optional[str] = None,
    container_id: Optional[str] = None,
) -> HTML:
    """
    Display interactive logit lens visualization in Jupyter.

    This generates self-contained HTML that works without any widget
    installation. The visualization is fully interactive.

    Args:
        data: Data from collect_logit_lens() (Python format) or
              already converted to_js_format() (JavaScript V2 format)
        title: Optional title for the widget
        container_id: Optional container ID (auto-generated if not provided)

    Returns:
        IPython HTML object that displays the widget

    Example:
        >>> data = collect_logit_lens("The capital of France is", model)
        >>> show_logit_lens(data, title="GPT-2 Analysis")
    """
    import uuid

    if container_id is None:
        container_id = f"logit-lens-{uuid.uuid4().hex[:8]}"

    # Convert to JS format if needed
    if _is_python_format(data):
        widget_data = to_js_format(data)
    elif _is_js_format(data):
        widget_data = data
    else:
        raise ValueError(
            "Unrecognized data format. Expected output from collect_logit_lens() "
            "or to_js_format()."
        )

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
    title: Optional[str] = None,
) -> None:
    """
    Display interactive logit lens visualization in Jupyter (convenience function).

    Same as show_logit_lens but calls display() automatically.

    Args:
        data: Data from collect_logit_lens() or to_js_format()
        title: Optional title for the widget
    """
    display(show_logit_lens(data, title))
