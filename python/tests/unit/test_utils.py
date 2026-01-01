"""Tests for utility functions."""

import pytest
from unittest.mock import Mock

from logitlenskit.utils import get_value


class TestGetValue:
    """Test get_value helper."""

    def test_with_value_attribute(self):
        """Should return .value if present (nnsight proxy)."""
        proxy = Mock()
        proxy.value = "tensor_data"
        assert get_value(proxy) == "tensor_data"

    def test_without_value_attribute(self):
        """Should return object directly if no .value (direct tensor)."""
        tensor = [1, 2, 3]  # Simple list as stand-in for tensor
        assert get_value(tensor) == [1, 2, 3]

    def test_with_none_value(self):
        """Should handle None value correctly."""
        proxy = Mock()
        proxy.value = None
        assert get_value(proxy) is None

    def test_with_nested_value(self):
        """Should work with complex value types."""
        proxy = Mock()
        proxy.value = {"key": [1, 2, 3]}
        assert get_value(proxy) == {"key": [1, 2, 3]}
