"""
Fast integration tests (~2 minutes total).

These tests run quickly and are suitable for CI on every commit.
- Local GPT-2 (no NDIF required)
- Small NDIF model (GPT-J 6B)
"""

import pytest

# Mark all tests in this module as fast and integration
pytestmark = [pytest.mark.fast, pytest.mark.integration]


@pytest.fixture(scope="module")
def gpt2_model():
    """Load GPT-2 locally (no NDIF)."""
    pytest.importorskip("nnsight")
    from nnsight import LanguageModel

    model = LanguageModel("openai-community/gpt2", device_map="auto")
    return model


class TestLocalGPT2:
    """Test with local GPT-2 model (no NDIF required)."""

    def test_collect_basic(self, gpt2_model):
        """Basic collection should work."""
        from logitlenskit import collect_logit_lens_topk_efficient

        data = collect_logit_lens_topk_efficient(
            "Hello world",
            gpt2_model,
            top_k=3,
            track_across_layers=False,
            remote=False,
        )

        assert "tokens" in data
        assert "layers" in data
        assert "top_indices" in data
        assert "top_probs" in data
        assert len(data["tokens"]) == 2  # "Hello" and " world"

    def test_collect_with_tracking(self, gpt2_model):
        """Collection with trajectory tracking should work."""
        from logitlenskit import collect_logit_lens_topk_efficient

        data = collect_logit_lens_topk_efficient(
            "The quick brown fox",
            gpt2_model,
            top_k=5,
            track_across_layers=True,
            remote=False,
        )

        assert "tracked_indices" in data
        assert "tracked_probs" in data
        assert len(data["tracked_indices"]) == len(data["tokens"])

    def test_layer_subset(self, gpt2_model):
        """Should work with layer subset."""
        from logitlenskit import collect_logit_lens_topk_efficient

        data = collect_logit_lens_topk_efficient(
            "Test",
            gpt2_model,
            top_k=3,
            layers=[0, 3, 6, 9, 11],  # GPT-2 has 12 layers
            remote=False,
        )

        assert data["layers"] == [0, 3, 6, 9, 11]
        assert data["top_indices"].shape[0] == 5  # 5 layers

    def test_model_type_detection(self, gpt2_model):
        """Should auto-detect GPT-2 model type."""
        from logitlenskit import detect_model_type

        model_type = detect_model_type(gpt2_model)
        assert model_type == "gpt2"


class TestNDIFGPTJ:
    """Test with GPT-J via NDIF (requires NDIF_API key)."""

    @pytest.fixture(scope="class")
    def gptj_model(self, ndif_available, hf_token):
        """Load GPT-J via NDIF."""
        if not ndif_available:
            pytest.skip("NDIF_API key not available")

        pytest.importorskip("nnsight")
        from nnsight import LanguageModel, CONFIG
        import os

        CONFIG.set_default_api_key(os.environ["NDIF_API"])
        model = LanguageModel("EleutherAI/gpt-j-6B", device_map="auto", token=hf_token)
        return model

    def test_collect_remote(self, gptj_model):
        """Basic remote collection should work."""
        from logitlenskit import collect_logit_lens_topk_efficient

        data = collect_logit_lens_topk_efficient(
            "The capital of France is",
            gptj_model,
            top_k=5,
            track_across_layers=True,
            remote=True,
        )

        assert "tokens" in data
        assert "tracked_probs" in data
        # GPT-J should predict "Paris" highly at the final layer
        assert len(data["tokens"]) > 0
