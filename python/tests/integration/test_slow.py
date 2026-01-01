"""
Slow integration tests (comprehensive NDIF model coverage).

These tests cover all regularly hosted NDIF models.
Run with: pytest tests/integration/test_slow.py -m slow
"""

import pytest

# Mark all tests in this module as slow and integration
pytestmark = [pytest.mark.slow, pytest.mark.integration]


# NDIF-hosted models to test
# TODO: Update this list based on current NDIF availability
NDIF_MODELS = [
    ("EleutherAI/gpt-j-6B", "gptj"),
    ("meta-llama/Llama-3.1-8B", "llama"),
    # ("meta-llama/Llama-3.1-70B", "llama"),  # Very slow, uncomment for full coverage
]


@pytest.fixture(scope="module")
def ndif_setup(ndif_available, hf_token):
    """Set up NDIF for all tests in this module."""
    if not ndif_available:
        pytest.skip("NDIF_API key not available")

    pytest.importorskip("nnsight")
    from nnsight import CONFIG
    import os

    CONFIG.set_default_api_key(os.environ["NDIF_API"])
    return hf_token


class TestNDIFModels:
    """Test collection across all NDIF-hosted models."""

    @pytest.mark.parametrize("model_name,expected_type", NDIF_MODELS)
    def test_model_detection(self, ndif_setup, model_name, expected_type):
        """Model type should be correctly detected."""
        from nnsight import LanguageModel
        from logitlenskit import detect_model_type

        model = LanguageModel(model_name, device_map="auto", token=ndif_setup)
        detected = detect_model_type(model)
        assert detected == expected_type

    @pytest.mark.parametrize("model_name,expected_type", NDIF_MODELS)
    def test_collect_efficient(self, ndif_setup, model_name, expected_type):
        """Efficient collection should work for each model."""
        from nnsight import LanguageModel
        from logitlenskit import collect_logit_lens_topk_efficient

        model = LanguageModel(model_name, device_map="auto", token=ndif_setup)

        data = collect_logit_lens_topk_efficient(
            "The quick brown fox",
            model,
            top_k=5,
            track_across_layers=True,
            remote=True,
        )

        # Basic structure checks
        assert "tokens" in data
        assert "layers" in data
        assert "top_indices" in data
        assert "top_probs" in data
        assert "tracked_indices" in data
        assert "tracked_probs" in data

        # Shape checks
        n_layers = len(data["layers"])
        n_tokens = len(data["tokens"])
        assert data["top_indices"].shape == (n_layers, n_tokens, 5)
        assert data["top_probs"].shape == (n_layers, n_tokens, 5)
        assert len(data["tracked_indices"]) == n_tokens
        assert len(data["tracked_probs"]) == n_tokens

    @pytest.mark.parametrize("model_name,expected_type", NDIF_MODELS)
    def test_layer_subset(self, ndif_setup, model_name, expected_type):
        """Layer subset should work for each model."""
        from nnsight import LanguageModel
        from logitlenskit import collect_logit_lens_topk_efficient, get_model_config, resolve_accessor

        model = LanguageModel(model_name, device_map="auto", token=ndif_setup)
        cfg = get_model_config(model)
        total_layers = resolve_accessor(model, cfg["n_layers"])

        # Use every 4th layer
        layers = list(range(0, total_layers, 4))

        data = collect_logit_lens_topk_efficient(
            "Test",
            model,
            top_k=3,
            layers=layers,
            remote=True,
        )

        assert data["layers"] == layers
        assert data["top_indices"].shape[0] == len(layers)
