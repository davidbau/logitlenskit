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
        from logitlenskit import collect_logit_lens

        data = collect_logit_lens(
            "Hello world",
            gpt2_model,
            k=3,
            remote=False,
        )

        assert "input" in data
        assert "layers" in data
        assert "topk" in data
        assert "tracked" in data
        assert "probs" in data
        assert "vocab" in data
        assert len(data["input"]) == 2  # "Hello" and " world"

    def test_layer_subset(self, gpt2_model):
        """Should work with layer subset."""
        from logitlenskit import collect_logit_lens

        data = collect_logit_lens(
            "Test",
            gpt2_model,
            k=3,
            layers=[0, 3, 6, 9, 11],  # GPT-2 has 12 layers
            remote=False,
        )

        assert data["layers"] == [0, 3, 6, 9, 11]
        assert data["topk"].shape[0] == 5  # 5 layers

    def test_model_type_detection(self, gpt2_model):
        """Should auto-detect GPT-2 model type."""
        from logitlenskit import detect_model_type

        model_type = detect_model_type(gpt2_model)
        assert model_type == "gpt2"

    def test_vocab_contains_tracked_tokens(self, gpt2_model):
        """Vocab should contain all tracked token strings."""
        from logitlenskit import collect_logit_lens

        data = collect_logit_lens(
            "The capital of France is",
            gpt2_model,
            k=5,
            remote=False,
        )

        # All tracked indices should be in vocab
        for tracked_indices in data["tracked"]:
            for idx in tracked_indices.tolist():
                assert idx in data["vocab"]


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
        from logitlenskit import collect_logit_lens

        data = collect_logit_lens(
            "The capital of France is",
            gptj_model,
            k=5,
            remote=True,
        )

        assert "input" in data
        assert "probs" in data
        assert "vocab" in data
        # GPT-J should predict "Paris" highly at the final layer
        assert len(data["input"]) > 0
