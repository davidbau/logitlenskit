"""
Slow integration tests (comprehensive NDIF model coverage).

These tests cover all regularly hosted NDIF models.
Run with: pytest tests/integration/test_slow.py -m slow
"""

import pytest

# Mark all tests in this module as slow and integration
pytestmark = [pytest.mark.slow, pytest.mark.integration]


# NDIF-hosted models to test (HOT models from https://nnsight.net/status/)
NDIF_MODELS = [
    ("EleutherAI/gpt-j-6B", "gptj"),
    ("meta-llama/Llama-3.1-8B", "llama"),
    ("meta-llama/Llama-3.1-70B", "llama"),
    ("meta-llama/Llama-3.1-70B-Instruct", "llama"),
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
    def test_collect(self, ndif_setup, model_name, expected_type):
        """Collection should work for each model."""
        from nnsight import LanguageModel
        from logitlenskit import collect_logit_lens

        model = LanguageModel(model_name, device_map="auto", token=ndif_setup)

        data = collect_logit_lens(
            "The quick brown fox",
            model,
            k=5,
            remote=True,
        )

        # Basic structure checks
        assert "input" in data
        assert "layers" in data
        assert "topk" in data
        assert "tracked" in data
        assert "probs" in data
        assert "vocab" in data

        # Shape checks
        n_layers = len(data["layers"])
        n_tokens = len(data["input"])
        assert data["topk"].shape == (n_layers, n_tokens, 5)
        assert len(data["tracked"]) == n_tokens
        assert len(data["probs"]) == n_tokens

    @pytest.mark.parametrize("model_name,expected_type", NDIF_MODELS)
    def test_layer_subset(self, ndif_setup, model_name, expected_type):
        """Layer subset should work for each model."""
        from nnsight import LanguageModel
        from logitlenskit import collect_logit_lens, get_model_config, resolve_accessor

        model = LanguageModel(model_name, device_map="auto", token=ndif_setup)
        cfg = get_model_config(model)
        total_layers = resolve_accessor(model, cfg["n_layers"])

        # Use every 4th layer
        layers = list(range(0, total_layers, 4))

        data = collect_logit_lens(
            "Test",
            model,
            k=3,
            layers=layers,
            remote=True,
        )

        assert data["layers"] == layers
        assert data["topk"].shape[0] == len(layers)
