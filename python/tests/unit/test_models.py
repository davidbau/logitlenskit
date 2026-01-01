"""Tests for model registry and accessor functions."""

import pytest
from unittest.mock import Mock, MagicMock

from logitlenskit.models import (
    MODEL_CONFIGS,
    MODEL_ALIASES,
    resolve_accessor,
    apply_module_or_callable,
    detect_model_type,
    get_model_config,
)


class TestModelConfigs:
    """Test MODEL_CONFIGS registry."""

    def test_llama_config_exists(self):
        """Llama config should have all required keys."""
        assert "llama" in MODEL_CONFIGS
        cfg = MODEL_CONFIGS["llama"]
        assert "layers" in cfg
        assert "norm" in cfg
        assert "lm_head" in cfg
        assert "n_layers" in cfg

    def test_gpt2_config_exists(self):
        """GPT-2 config should have all required keys."""
        assert "gpt2" in MODEL_CONFIGS
        cfg = MODEL_CONFIGS["gpt2"]
        assert cfg["layers"] == "transformer.h"
        assert cfg["norm"] == "transformer.ln_f"

    def test_all_configs_have_required_keys(self):
        """All configs should have the required keys."""
        required_keys = {"layers", "norm", "lm_head", "n_layers"}
        for model_type, cfg in MODEL_CONFIGS.items():
            assert required_keys.issubset(cfg.keys()), f"{model_type} missing keys"


class TestModelAliases:
    """Test MODEL_ALIASES mapping."""

    def test_pythia_aliases_to_gpt_neox(self):
        assert MODEL_ALIASES["pythia"] == "gpt_neox"

    def test_llama_variants_alias_to_llama(self):
        assert MODEL_ALIASES["llama2"] == "llama"
        assert MODEL_ALIASES["llama3"] == "llama"
        assert MODEL_ALIASES["codellama"] == "llama"


class TestResolveAccessor:
    """Test resolve_accessor function."""

    def test_string_path_single_attr(self):
        """Should resolve single attribute."""
        model = Mock()
        model.config = Mock(n_layer=12)
        result = resolve_accessor(model, "config")
        assert result == model.config

    def test_string_path_nested(self):
        """Should resolve nested path."""
        model = Mock()
        model.config = Mock(num_hidden_layers=32)
        result = resolve_accessor(model, "config.num_hidden_layers")
        assert result == 32

    def test_callable_accessor(self):
        """Should call callable and return result."""
        model = Mock()
        model.custom = Mock(path=42)
        accessor = lambda m: m.custom.path
        result = resolve_accessor(model, accessor)
        assert result == 42


class TestApplyModuleOrCallable:
    """Test apply_module_or_callable function."""

    def test_string_path_to_module(self):
        """Should resolve string path and call module."""
        model = Mock()
        norm_module = Mock(return_value="normed")
        model.model = Mock(norm=norm_module)

        result = apply_module_or_callable(model, "model.norm", "hidden")
        norm_module.assert_called_once_with("hidden")
        assert result == "normed"

    def test_callable_single_arg(self):
        """Callable(model) returning module should be called with hidden."""
        model = Mock()
        norm_module = Mock(return_value="normed")
        accessor = lambda m: norm_module

        result = apply_module_or_callable(model, accessor, "hidden")
        norm_module.assert_called_once_with("hidden")
        assert result == "normed"

    def test_callable_two_args(self):
        """Callable(model, hidden) should be called directly."""
        model = Mock()
        accessor = lambda m, h: f"processed_{h}"

        result = apply_module_or_callable(model, accessor, "hidden")
        assert result == "processed_hidden"


class TestDetectModelType:
    """Test detect_model_type function."""

    def test_direct_match(self):
        """Should detect model_type directly from config."""
        model = Mock()
        model.config = Mock(model_type="llama")
        assert detect_model_type(model) == "llama"

    def test_alias_match(self):
        """Should resolve aliases."""
        model = Mock()
        model.config = Mock(model_type="pythia", architectures=[])
        assert detect_model_type(model) == "gpt_neox"

    def test_architecture_fallback(self):
        """Should detect from architectures field."""
        model = Mock()
        model.config = Mock(model_type="", architectures=["LlamaForCausalLM"])
        assert detect_model_type(model) == "llama"

    def test_unknown_model_raises(self):
        """Should raise ValueError for unknown model."""
        model = Mock()
        model.config = Mock(model_type="unknown", architectures=[])
        with pytest.raises(ValueError, match="Unknown model type"):
            detect_model_type(model)


class TestGetModelConfig:
    """Test get_model_config function."""

    def test_explicit_model_type(self):
        """Should use explicit model_type if provided."""
        model = Mock()
        model.config = Mock(model_type="gpt2")  # This should be ignored
        cfg = get_model_config(model, model_type="llama")
        assert cfg == MODEL_CONFIGS["llama"]

    def test_auto_detect(self):
        """Should auto-detect if model_type is None."""
        model = Mock()
        model.config = Mock(model_type="gpt2", architectures=[])
        cfg = get_model_config(model)
        assert cfg == MODEL_CONFIGS["gpt2"]

    def test_alias_resolution(self):
        """Should resolve aliases in explicit model_type."""
        model = Mock()
        cfg = get_model_config(model, model_type="pythia")
        assert cfg == MODEL_CONFIGS["gpt_neox"]
