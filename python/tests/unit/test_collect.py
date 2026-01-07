"""Tests for data collection functions (with mocked models)."""

import pytest


# Note: Full collection function tests require integration tests
# as they depend on nnsight's trace context and model architecture.
# See tests/integration/ for those tests.

# The collect_logit_lens function returns data with a 'vocab' dict
# that already maps token indices to strings, so no separate decode
# function is needed.
