"""Tests for data collection functions (with mocked models)."""

import pytest
from unittest.mock import Mock, MagicMock, patch
import torch

from logitlenskit.collect import decode_tracked_tokens


class TestDecodeTrackedTokens:
    """Test decode_tracked_tokens function."""

    def test_basic_decode(self):
        """Should decode token indices to strings."""
        tokenizer = Mock()
        tokenizer.decode = lambda ids: f"token_{ids[0]}"

        data = {
            "tracked_indices": [
                torch.tensor([100, 200]),
                torch.tensor([300]),
            ]
        }

        result = decode_tracked_tokens(data, tokenizer)

        assert result[0] == ["token_100", "token_200"]
        assert result[1] == ["token_300"]

    def test_empty_indices(self):
        """Should handle empty tracked indices."""
        tokenizer = Mock()
        tokenizer.decode = lambda ids: f"token_{ids[0]}"

        data = {
            "tracked_indices": [
                torch.tensor([]),
            ]
        }

        result = decode_tracked_tokens(data, tokenizer)
        assert result[0] == []


# Note: Full collection function tests require integration tests
# as they depend on nnsight's trace context and model architecture.
# See tests/integration/ for those tests.
