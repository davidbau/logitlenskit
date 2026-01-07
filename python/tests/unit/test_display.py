"""
Tests for logitlenskit.display module.

Tests the HTML generation, unique IDs, and multi-widget scenarios.
"""

import json
import re
import pytest
import torch
from unittest.mock import MagicMock, patch

from logitlenskit.display import (
    show_logit_lens,
    display_logit_lens,
    to_js_format,
    _is_python_format,
    _is_js_format,
    HTML,
)


# Sample data in Python format (from collect_logit_lens)
@pytest.fixture
def sample_python_data():
    """Sample data in Python API format."""
    return {
        "model": "test-model",
        "input": ["The", " cat"],
        "layers": [0, 1, 2],
        "topk": torch.tensor([
            [[1, 2], [3, 4]],  # layer 0: pos 0, pos 1
            [[1, 2], [3, 4]],  # layer 1
            [[1, 2], [5, 4]],  # layer 2
        ], dtype=torch.int32),
        "tracked": [
            torch.tensor([1, 2], dtype=torch.int32),  # pos 0
            torch.tensor([3, 4, 5], dtype=torch.int32),  # pos 1
        ],
        "probs": [
            torch.tensor([[0.5, 0.3], [0.6, 0.2], [0.7, 0.1]]),  # pos 0: [n_layers, n_tracked]
            torch.tensor([[0.4, 0.3, 0.1], [0.5, 0.2, 0.1], [0.6, 0.1, 0.2]]),  # pos 1
        ],
        "vocab": {1: "a", 2: "b", 3: "c", 4: "d", 5: "e"},
    }


@pytest.fixture
def sample_js_data():
    """Sample data already in JavaScript V2 format."""
    return {
        "meta": {"version": 2, "model": "test-model"},
        "input": ["Hello", " world"],
        "layers": [0, 1],
        "topk": [
            [["foo", "bar"], ["baz", "qux"]],  # layer 0
            [["foo", "bar"], ["baz", "qux"]],  # layer 1
        ],
        "tracked": [
            {"foo": [0.5, 0.6], "bar": [0.3, 0.2]},
            {"baz": [0.4, 0.5], "qux": [0.3, 0.2]},
        ],
    }


class TestShowLogitLens:
    """Tests for show_logit_lens function."""

    def test_returns_html_object(self, sample_python_data):
        """show_logit_lens should return an HTML object."""
        result = show_logit_lens(sample_python_data)
        # HTML object has a data attribute with the HTML string
        html = result.data
        assert isinstance(html, str)
        assert "<div" in html
        assert "<script>" in html

    def test_unique_container_id_generated(self, sample_python_data):
        """Each call should generate a unique container ID."""
        html1 = show_logit_lens(sample_python_data).data
        html2 = show_logit_lens(sample_python_data).data

        # Extract container IDs
        id_pattern = r'id="(logit-lens-[a-f0-9]+)"'
        ids1 = re.findall(id_pattern, html1)
        ids2 = re.findall(id_pattern, html2)

        assert len(ids1) >= 1, "Should have container ID"
        assert len(ids2) >= 1, "Should have container ID"
        assert ids1[0] != ids2[0], "Container IDs should be unique"

    def test_custom_container_id(self, sample_python_data):
        """Custom container ID should be used when provided."""
        html = show_logit_lens(sample_python_data, container_id="my-custom-id").data
        assert 'id="my-custom-id"' in html
        assert 'containerId = "my-custom-id"' in html

    def test_title_included(self, sample_python_data):
        """Title should be included in uiState."""
        html = show_logit_lens(sample_python_data, title="My Title").data
        assert '"title": "My Title"' in html or '"title":"My Title"' in html

    def test_data_embedded_in_html(self, sample_python_data):
        """Widget data should be embedded as JSON in the HTML."""
        html = show_logit_lens(sample_python_data).data

        # Should contain the input tokens (note: " cat" has leading space)
        assert '"The"' in html
        assert '" cat"' in html

    def test_accepts_js_format(self, sample_js_data):
        """Should accept data already in JS format."""
        html = show_logit_lens(sample_js_data).data
        assert "<div" in html
        assert "Hello" in html

    def test_widget_js_embedded(self, sample_python_data):
        """Widget JavaScript should be embedded in the HTML."""
        html = show_logit_lens(sample_python_data).data
        # The widget defines LogitLensWidget
        assert "LogitLensWidget" in html

    def test_init_retry_mechanism(self, sample_python_data):
        """Should include retry mechanism for DOM readiness."""
        html = show_logit_lens(sample_python_data).data
        # Check for the initWidget retry pattern
        assert "initWidget" in html
        assert "setTimeout" in html


class TestMultipleWidgets:
    """Tests for multiple widget scenarios."""

    def test_three_widgets_have_unique_ids(self, sample_python_data):
        """Three widgets should have three different container IDs."""
        html1 = show_logit_lens(sample_python_data, title="Widget 1").data
        html2 = show_logit_lens(sample_python_data, title="Widget 2").data
        html3 = show_logit_lens(sample_python_data, title="Widget 3").data

        id_pattern = r'id="(logit-lens-[a-f0-9]+)"'
        id1 = re.search(id_pattern, html1).group(1)
        id2 = re.search(id_pattern, html2).group(1)
        id3 = re.search(id_pattern, html3).group(1)

        assert len({id1, id2, id3}) == 3, "All three IDs should be unique"

    def test_each_widget_has_own_data(self):
        """Each widget should have its own data embedded."""
        data1 = {
            "model": "model-1",
            "input": ["First"],
            "layers": [0],
            "topk": torch.tensor([[[1]]], dtype=torch.int32),
            "tracked": [torch.tensor([1], dtype=torch.int32)],
            "probs": [torch.tensor([[0.9]])],
            "vocab": {1: "alpha"},
        }
        data2 = {
            "model": "model-2",
            "input": ["Second"],
            "layers": [0],
            "topk": torch.tensor([[[2]]], dtype=torch.int32),
            "tracked": [torch.tensor([2], dtype=torch.int32)],
            "probs": [torch.tensor([[0.8]])],
            "vocab": {2: "beta"},
        }
        data3 = {
            "model": "model-3",
            "input": ["Third"],
            "layers": [0],
            "topk": torch.tensor([[[3]]], dtype=torch.int32),
            "tracked": [torch.tensor([3], dtype=torch.int32)],
            "probs": [torch.tensor([[0.7]])],
            "vocab": {3: "gamma"},
        }

        html1 = show_logit_lens(data1).data
        html2 = show_logit_lens(data2).data
        html3 = show_logit_lens(data3).data

        # Each HTML should contain its own data
        assert "alpha" in html1 and "beta" not in html1 and "gamma" not in html1
        assert "beta" in html2 and "alpha" not in html2 and "gamma" not in html2
        assert "gamma" in html3 and "alpha" not in html3 and "beta" not in html3

    def test_widget_js_embedded_once_pattern(self, sample_python_data):
        """Widget JS should only be defined if not already present."""
        html = show_logit_lens(sample_python_data).data
        # Check for the conditional loading pattern
        assert "typeof LogitLensWidget === 'undefined'" in html


class TestToJsFormat:
    """Tests for to_js_format conversion."""

    def test_converts_python_to_js_format(self, sample_python_data):
        """Should convert Python format to JS V2 format."""
        result = to_js_format(sample_python_data)

        assert "meta" in result
        assert result["meta"]["version"] == 2
        assert result["meta"]["model"] == "test-model"
        assert result["input"] == ["The", " cat"]
        assert result["layers"] == [0, 1, 2]
        assert "topk" in result
        assert "tracked" in result

    def test_topk_structure(self, sample_python_data):
        """topk should be [n_layers][n_pos] of string lists."""
        result = to_js_format(sample_python_data)

        # 3 layers, 2 positions
        assert len(result["topk"]) == 3
        assert len(result["topk"][0]) == 2
        # Each cell has k tokens (strings)
        assert all(isinstance(t, str) for t in result["topk"][0][0])

    def test_tracked_structure(self, sample_python_data):
        """tracked should be list of {token: trajectory} dicts."""
        result = to_js_format(sample_python_data)

        # 2 positions
        assert len(result["tracked"]) == 2
        # Each is a dict
        assert isinstance(result["tracked"][0], dict)
        # Values are trajectory lists
        for token, traj in result["tracked"][0].items():
            assert isinstance(traj, list)
            assert len(traj) == 3  # n_layers


class TestFormatDetection:
    """Tests for format detection functions."""

    def test_is_python_format(self, sample_python_data):
        """Should detect Python format correctly."""
        assert _is_python_format(sample_python_data)
        assert not _is_js_format(sample_python_data)

    def test_is_js_format(self, sample_js_data):
        """Should detect JS format correctly."""
        assert _is_js_format(sample_js_data)
        assert not _is_python_format(sample_js_data)


class TestDisplayLogitLens:
    """Tests for display_logit_lens convenience function."""

    def test_calls_display(self, sample_python_data):
        """display_logit_lens should call IPython display."""
        with patch('logitlenskit.display.display') as mock_display:
            display_logit_lens(sample_python_data, title="Test")
            mock_display.assert_called_once()
