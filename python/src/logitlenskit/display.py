"""
Jupyter display utilities for logit lens visualization.

Provides zero-install HTML output - no ipywidgets required.
"""

import json
from pathlib import Path
from typing import Dict, Optional, Union
from IPython.display import HTML, display


# Load widget JS at import time (bundled with package)
_WIDGET_JS_PATH = Path(__file__).parent / "static" / "logit-lens-widget.min.js"
_WIDGET_JS = _WIDGET_JS_PATH.read_text() if _WIDGET_JS_PATH.exists() else None


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


def _to_camel_case(snake_str: str) -> str:
    """Convert snake_case to camelCase."""
    parts = snake_str.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def show_logit_lens(
    data: Dict,
    title: Optional[str] = None,
    container_id: Optional[str] = None,
    **ui_options,
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
        **ui_options: Additional UI options (snake_case converted to camelCase):
            - dark_mode: bool - Force dark/light mode (None for auto)
            - chart_height: int - Height of the chart area in pixels
            - input_token_width: int - Width of input token column (default: 100)
            - cell_width: int - Width of prediction cells (default: 44)
            - max_rows: int - Maximum rows to display (None for all)
            - max_table_width: int - Maximum table width in pixels
            - plot_min_layer: int - Minimum layer shown in chart
            - color_modes: list[str] - Color modes, e.g. ["top", "Paris"]
            - heatmap_base_color: str - Base heatmap color (hex)
            - heatmap_next_color: str - Next-token heatmap color (hex)
            - pinned_rows: list - Pinned rows, e.g. [{"pos": 4, "line": "solid"}]
                           Pass [] to disable auto-pinning of last row
            - pinned_groups: list - Pinned token groups

    Returns:
        IPython HTML object that displays the widget

    Example:
        >>> data = collect_logit_lens("The capital of France is", model)
        >>> show_logit_lens(data, title="GPT-2 Analysis")
        >>> show_logit_lens(data, dark_mode=True, pinned_rows=[])
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

    # Build UI state from kwargs (convert snake_case to camelCase)
    ui_state = {_to_camel_case(k): v for k, v in ui_options.items()}
    if title:
        ui_state["title"] = title

    # Generate HTML with embedded widget
    if _WIDGET_JS is None:
        return HTML(f'<div style="color: red;">Error: Widget JS not found at {_WIDGET_JS_PATH}</div>')

    html = f"""
    <div id="{container_id}" style="background: white; padding: 20px; border-radius: 8px;"></div>
    <script>
    (function() {{
        // Embed widget code if not already loaded
        if (typeof LogitLensWidget === 'undefined') {{
            {_WIDGET_JS}
        }}

        var containerId = "{container_id}";
        var data = {json.dumps(widget_data)};
        var uiState = {json.dumps(ui_state)};

        // Wait for container to exist in DOM (handles async rendering)
        function initWidget() {{
            var container = document.getElementById(containerId);
            if (container) {{
                LogitLensWidget("#" + containerId, data, uiState);
            }} else {{
                setTimeout(initWidget, 10);
            }}
        }}
        initWidget();
    }})();
    </script>
    """

    return HTML(html)


def display_logit_lens(
    data: Dict,
    title: Optional[str] = None,
    **ui_options,
) -> None:
    """
    Display interactive logit lens visualization in Jupyter (convenience function).

    Same as show_logit_lens but calls display() automatically.

    Args:
        data: Data from collect_logit_lens() or to_js_format()
        title: Optional title for the widget
        **ui_options: See show_logit_lens for available options
    """
    display(show_logit_lens(data, title, **ui_options))
