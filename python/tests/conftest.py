"""
Pytest configuration and fixtures for logitlenskit tests.
"""

import os
import pytest
from pathlib import Path


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "fast: fast integration tests (~2 min total)")
    config.addinivalue_line("markers", "slow: slow integration tests (all NDIF models)")
    config.addinivalue_line("markers", "integration: all integration tests (fast + slow)")


@pytest.fixture(scope="session")
def env_file():
    """Load environment variables from .env.local if present."""
    env_path = Path(__file__).parent.parent.parent.parent / ".env.local"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, val = line.strip().split("=", 1)
                    val = val.strip("\"'")
                    os.environ[key] = val
        return True
    return False


@pytest.fixture(scope="session")
def ndif_available(env_file):
    """Check if NDIF API key is available."""
    return "NDIF_API" in os.environ


@pytest.fixture(scope="session")
def hf_token(env_file):
    """Get HuggingFace token if available."""
    return os.environ.get("HF_TOKEN")


@pytest.fixture
def sample_widget_data():
    """Sample widget data for testing display functions."""
    return {
        "layers": [0, 1, 2, 3],
        "tokens": ["The", " quick", " brown", " fox"],
        "cells": [
            [
                {"token": " the", "prob": 0.1, "trajectory": [0.1, 0.15, 0.2, 0.25],
                 "topk": [{"token": " the", "prob": 0.1, "trajectory": [0.1, 0.15, 0.2, 0.25]}]}
            ] * 4
        ] * 4
    }
