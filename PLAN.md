# LogitLensKit Project Plan

A toolkit for logit lens visualization of transformer language models, consisting of:
- **Python library**: Efficient data collection via NDIF remote execution
- **JavaScript widget**: Interactive visualization of logit lens data
- **End-to-end integration**: Jupyter notebook support for seamless Python-to-JS workflow

## Directory Structure

```
logitlenskit/
├── README.md                    # Project overview and quick start
├── PLAN.md                      # This file
├── LICENSE                      # MIT or Apache 2.0
├── .gitignore
├── .env.local.example           # Template for API keys
│
├── python/                      # Python library
│   ├── pyproject.toml           # Local dev packaging
│   ├── src/
│   │   └── logitlenskit/
│   │       ├── __init__.py      # Public API exports
│   │       ├── collect.py       # Data collection functions
│   │       ├── models.py        # Model registry (MODEL_CONFIGS)
│   │       ├── display.py       # Jupyter HTML display (zero-install)
│   │       └── utils.py         # Helpers (get_value, etc.)
│   ├── tests/
│   │   ├── conftest.py          # pytest fixtures
│   │   ├── unit/
│   │   │   ├── test_models.py   # Model registry tests
│   │   │   ├── test_utils.py    # Utility function tests
│   │   │   └── test_collect.py  # Collection logic (mocked)
│   │   └── integration/
│   │       ├── test_fast.py     # Fast tests: GPT-2 local + small NDIF
│   │       └── test_slow.py     # Slow tests: All NDIF models
│   └── pytest.ini
│
├── js/                          # JavaScript library
│   ├── package.json             # NPM package config
│   ├── src/
│   │   ├── logit-lens-widget.js # Main widget implementation
│   │   └── index.js             # Module entry point
│   ├── dist/                    # Built/bundled output
│   │   └── logit-lens-widget.min.js
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── widget-creation.test.js
│   │   │   ├── state-serialization.test.js
│   │   │   ├── widget-linking.test.js
│   │   │   ├── data-validation.test.js
│   │   │   ├── layer-stride.test.js
│   │   │   └── color-modes.test.js
│   │   ├── integration/
│   │   │   ├── render-basic.test.js
│   │   │   ├── interactions.test.js
│   │   │   ├── resize-handles.test.js
│   │   │   ├── popup-behavior.test.js
│   │   │   └── trajectory-display.test.js
│   │   ├── fixtures/
│   │   │   ├── sample-data-small.json
│   │   │   └── sample-data-llama70b.json
│   │   └── utils/
│   │       └── test-helpers.js
│   ├── coverage/                # Generated coverage reports
│   ├── jest.config.js
│   └── .nycrc                   # NYC coverage config
│
├── notebooks/                   # End-to-end integration tests
│   ├── test_e2e_basic.ipynb     # Basic Python→JS workflow
│   ├── test_e2e_multi_model.ipynb
│   └── demo.ipynb               # User-facing demo
│
├── docs/                        # Documentation
│   ├── PYTHON_API.md            # Python API reference
│   ├── JAVASCRIPT_API.md        # JavaScript API reference
│   ├── DATA_FORMAT.md           # Data format specification
│   ├── MODEL_SUPPORT.md         # Supported models and custom configs
│   ├── DEVELOPMENT.md           # Contributing guide
│   └── ARCHITECTURE.md          # Design decisions
│
└── scripts/                     # Development scripts
    ├── build.sh                 # Build JS bundle
    ├── fetch-sample-data.py     # Generate test fixtures
    └── run-all-tests.sh         # Run full test suite
```

## Phase 1: Python Library Setup

### 1.1 Package Configuration (`python/pyproject.toml`)

```toml
[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "logitlenskit"
version = "0.1.0"
description = "Efficient logit lens data collection for transformer visualization"
readme = "README.md"
requires-python = ">=3.9"
license = {text = "MIT"}
authors = [{name = "David Bau"}]
dependencies = [
    "torch>=2.0",
    "nnsight>=0.2",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "pytest-cov>=4.0",
    "pytest-asyncio>=0.21",
    "python-dotenv>=1.0",
]
jupyter = [
    "ipywidgets>=8.0",
    "IPython>=8.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
markers = [
    "integration: marks tests requiring NDIF connection",
    "slow: marks tests that take >10s",
]

[tool.coverage.run]
source = ["src/logitlenskit"]
branch = true

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "raise NotImplementedError",
]
```

### 1.2 Source Code Organization

**`src/logitlenskit/__init__.py`**:
```python
from .collect import (
    collect_logit_lens_topk,
    collect_logit_lens_topk_efficient,
)
from .models import (
    MODEL_CONFIGS,
    MODEL_ALIASES,
    get_model_config,
    detect_model_type,
)
from .widget import LogitLensWidget

__version__ = "0.1.0"
__all__ = [
    "collect_logit_lens_topk",
    "collect_logit_lens_topk_efficient",
    "MODEL_CONFIGS",
    "MODEL_ALIASES",
    "get_model_config",
    "detect_model_type",
    "LogitLensWidget",
]
```

### 1.3 Unit Tests

Unit tests should mock nnsight/NDIF and test:
- Model registry resolution
- Accessor string parsing
- Callable accessor handling
- Data format validation
- Error handling for unknown models

### 1.4 Integration Tests

Integration tests require `.env.local` with:
```
NDIF_API=your_ndif_api_key
HF_TOKEN=your_huggingface_token
```

#### Fast Tests (~2 minutes)
Run with: `pytest tests/integration/ -m fast`

| Model | Type | Remote | Purpose |
|-------|------|--------|---------|
| openai-community/gpt2 | gpt2 | No | Local baseline (no NDIF) |
| EleutherAI/gpt-j-6B | gptj | Yes | Quick NDIF sanity check |

#### Slow Tests (comprehensive)
Run with: `pytest tests/integration/ -m slow`

| Model | Type | Remote | Purpose |
|-------|------|--------|---------|
| meta-llama/Llama-3.1-8B | llama | Yes | Primary Llama target |
| meta-llama/Llama-3.1-70B | llama | Yes | Large model |
| EleutherAI/gpt-j-6B | gptj | Yes | GPT-J architecture |
| (more NDIF models) | various | Yes | Full coverage |

Run all integration: `pytest tests/integration/ -m integration`

## Phase 2: JavaScript Library Setup

### 2.1 Package Configuration (`js/package.json`)

```json
{
  "name": "logit-lens-widget",
  "version": "0.1.0",
  "description": "Interactive logit lens visualization widget",
  "main": "dist/logit-lens-widget.min.js",
  "module": "src/index.js",
  "files": ["dist/", "src/"],
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit/",
    "test:integration": "jest tests/integration/ --runInBand",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "build": "esbuild src/index.js --bundle --minify --outfile=dist/logit-lens-widget.min.js",
    "lint": "eslint src/ tests/"
  },
  "jest": {
    "testEnvironment": "jsdom",
    "testMatch": ["**/tests/**/*.test.js"],
    "coverageDirectory": "coverage",
    "collectCoverageFrom": ["src/**/*.js"]
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "esbuild": "^0.19.0",
    "eslint": "^8.50.0",
    "nyc": "^17.0.0"
  }
}
```

### 2.2 Unit Tests

Test categories:
1. **Widget Creation**: Constructor arguments, container resolution, defaults
2. **State Serialization**: getState()/restore round-trip, all properties
3. **Widget Linking**: linkColumnsTo, unlinkColumns, bidirectional sync
4. **Data Validation**: Required fields, malformed data handling
5. **Layer Stride**: Calculation with various column counts
6. **Color Modes**: top/none/specific token coloring

### 2.3 Integration Tests (jsdom + simulated interactions)

Test scenarios:
1. **Render Basic**: Widget renders with sample data
2. **Interactions**: Click, hover, drag behaviors
3. **Resize Handles**: Column, row, chart resizing
4. **Popup Behavior**: Token pinning, group creation
5. **Trajectory Display**: Line rendering, multi-row comparison

### 2.4 Coverage Target

- Statement coverage: >90%
- Branch coverage: >80%
- Function coverage: >95%

## Phase 3: End-to-End Integration

### 3.1 Notebook Test Structure

**`notebooks/test_e2e_basic.ipynb`**:
```python
# Cell 1: Setup
import os
from dotenv import load_dotenv
load_dotenv('../.env.local')

from nnsight import LanguageModel
from logitlenskit import collect_logit_lens_topk_efficient

# Cell 2: Collect data
model = LanguageModel("meta-llama/Llama-3.1-8B", device_map="auto")
data = collect_logit_lens_topk_efficient(
    "The capital of France is",
    model,
    top_k=5,
    track_across_layers=True,
    remote=True
)

# Cell 3: Validate data structure
assert "tokens" in data
assert "layers" in data
assert "top_indices" in data
assert "tracked_probs" in data

# Cell 4: Render widget
from logitlenskit import LogitLensWidget
widget = LogitLensWidget(data)
display(widget)

# Cell 5: Verify widget rendered (automated check)
# This uses ipywidgets inspection or screenshot comparison
```

### 3.2 Test Automation

Run notebooks with `pytest-notebook` or `nbmake`:
```bash
pytest --nbmake notebooks/test_*.ipynb
```

Or use `papermill` for parameterized execution:
```bash
papermill notebooks/test_e2e_basic.ipynb /tmp/output.ipynb
```

## Phase 4: Documentation

### 4.1 Core Documentation Files

| File | Contents |
|------|----------|
| `PYTHON_API.md` | Function signatures, parameters, return types, examples |
| `JAVASCRIPT_API.md` | Constructor, methods, events, CSS customization |
| `DATA_FORMAT.md` | JSON schema for widget data, field descriptions |
| `MODEL_SUPPORT.md` | Supported models, adding custom configs |
| `DEVELOPMENT.md` | Dev setup, running tests, contributing |
| `ARCHITECTURE.md` | Design decisions, bandwidth optimization rationale |

### 4.2 README Structure

1. Quick Start (install, 3-line example)
2. Features overview
3. Installation (pip, npm, CDN)
4. Basic usage examples
5. Links to detailed docs

## Phase 5: CI/CD (Future)

### GitHub Actions Workflow

```yaml
name: Tests
on: [push, pull_request]

jobs:
  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -e "./python[dev]"
      - run: pytest python/tests/unit/ --cov

  javascript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd js && npm ci && npm test -- --coverage

  integration:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    env:
      NDIF_API: ${{ secrets.NDIF_API }}
      HF_TOKEN: ${{ secrets.HF_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: pip install -e "./python[dev]"
      - run: pytest python/tests/integration/ -m integration
```

## Development Environment

### Python: Virtual Environment (venv)

```bash
cd python/
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

The `.gitignore` should exclude:
```
python/.venv/
python/*.egg-info/
python/__pycache__/
```

### JavaScript: Local npm

```bash
cd js/
npm install
npm test
```

The `.gitignore` should exclude:
```
js/node_modules/
js/coverage/
js/dist/
```

### Environment Variables

Create `.env.local` at project root (not committed):
```bash
cp .env.local.example .env.local
# Edit to add your keys
```

Both Python and JavaScript tests will load from this file.

## Implementation Order

### Week 1: Foundation
1. Create directory structure
2. Set up Python package with pyproject.toml
3. Move and refactor source code from week1/
4. Write Python unit tests (mocked)

### Week 2: JavaScript
1. Set up npm package
2. Extract widget to standalone module
3. Write JavaScript unit tests
4. Set up coverage reporting

### Week 3: Integration
1. Write Python NDIF integration tests
2. Write JavaScript DOM integration tests
3. Create sample data fixtures

### Week 4: End-to-End
1. Create Jupyter widget wrapper
2. Write notebook-based E2E tests
3. Documentation
4. README and examples

## Decisions

1. **Licensing**: MIT

2. **Distribution**: Local package only (no npm/PyPI). Intended for eventual integration into nnsight.

3. **Jupyter Widget**: Plain HTML output (zero installation required)

4. **Browser Support**: Modern only (Chrome 105+, Safari 15.4+, Firefox 121+) - covers ~90% of traffic

5. **Model Test Coverage**: Two tiers
   - **Fast tests** (~2 min): GPT-2 local, small NDIF model
   - **Slow tests** (comprehensive): All NDIF-hosted models (GPT-J, Llama variants, etc.)
