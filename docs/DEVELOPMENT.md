# Development Guide

## Project Structure

```
logitlenskit/
├── python/                      # Python package
│   ├── pyproject.toml
│   ├── src/logitlenskit/
│   │   ├── __init__.py
│   │   ├── collect.py           # Data collection
│   │   ├── models.py            # Model registry
│   │   ├── display.py           # Jupyter display
│   │   └── utils.py             # Utilities
│   └── tests/
│       ├── unit/                # Mocked tests
│       └── integration/         # NDIF tests
│
├── js/                          # JavaScript package
│   ├── package.json
│   ├── src/
│   │   ├── logit-lens-widget.js # Main widget
│   │   └── index.js             # Entry point
│   └── tests/
│       ├── unit/                # Jest tests
│       └── fixtures/            # Test data
│
├── notebooks/                   # E2E tests
├── docs/                        # Documentation
├── index.html                   # GitHub Pages demo
└── preview_data.js              # Demo data
```

## Setup

### Prerequisites

- Python 3.9+
- Node.js 18+
- Git

### Environment Variables

Create `.env.local` at project root:

```bash
cp .env.local.example .env.local
# Edit to add your keys:
# NDIF_API=your_ndif_api_key
# HF_TOKEN=your_huggingface_token
```

### Python Setup

```bash
cd python
python3 -m venv .venv
source .venv/bin/activate  # or `.venv\Scripts\activate` on Windows
pip install -e ".[dev]"
```

### JavaScript Setup

```bash
cd js
npm install
```

## Running Tests

### Python Tests

```bash
cd python
source .venv/bin/activate

# Unit tests (no NDIF required)
pytest tests/unit/

# Fast integration tests (~2 min)
pytest tests/integration/test_fast.py -m fast

# Slow integration tests (all NDIF models)
pytest tests/integration/test_slow.py -m slow

# All tests with coverage
pytest --cov=src/logitlenskit --cov-report=html
```

### JavaScript Tests

```bash
cd js

# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Test Markers

### Python

| Marker | Description |
|--------|-------------|
| `@pytest.mark.fast` | Fast integration tests (~2 min total) |
| `@pytest.mark.slow` | Slow integration tests (all NDIF models) |
| `@pytest.mark.integration` | All integration tests |

```bash
# Run only fast tests
pytest -m fast

# Run only slow tests
pytest -m slow

# Exclude integration tests
pytest -m "not integration"
```

### JavaScript

Tests are organized by directory:
- `tests/unit/` - Fast, no DOM interaction
- `tests/integration/` - DOM-based tests

## Adding New Features

### Adding a New Model

1. Add config to `MODEL_CONFIGS` in `python/src/logitlenskit/models.py`:

```python
MODEL_CONFIGS["new_model"] = {
    "layers": "path.to.layers",
    "norm": "path.to.norm",
    "lm_head": "path.to.lm_head",
    "n_layers": "config.num_layers",
}
```

2. Add alias if needed:

```python
MODEL_ALIASES["alias_name"] = "new_model"
```

3. Add tests in `tests/unit/test_models.py`:

```python
def test_new_model_config_exists(self):
    assert "new_model" in MODEL_CONFIGS
```

4. Add integration test if NDIF-hosted.

### Adding Widget Features

1. Edit `js/src/logit-lens-widget.js`
2. Add unit test in `js/tests/unit/`
3. Update `docs/JAVASCRIPT_API.md`

### Updating Data Format

1. Update Python conversion in `python/src/logitlenskit/display.py`
2. Update JavaScript expectations in widget
3. Update `docs/DATA_FORMAT.md`
4. Update test fixtures in `js/tests/fixtures/`

## Code Style

### Python

- Follow PEP 8
- Use type hints for public functions
- Docstrings for all public functions

```python
def my_function(param: str, count: int = 5) -> Dict[str, Any]:
    """
    Short description.

    Args:
        param: Description of param
        count: Description of count

    Returns:
        Description of return value
    """
    pass
```

### JavaScript

- Use `var` (for browser compatibility)
- JSDoc comments for public functions
- 4-space indentation

```javascript
/**
 * Short description.
 * @param {string} param - Description
 * @returns {Object} Description
 */
function myFunction(param) {
    // ...
}
```

## Building

### JavaScript Bundle

```bash
cd js
npm run build
# Output: dist/logit-lens-widget.min.js
```

### Python Package

The package uses `pyproject.toml` and installs in editable mode:

```bash
pip install -e ".[dev]"
```

## Debugging

### Python

```python
# Check model detection
from logitlenskit import detect_model_type, get_model_config
print(detect_model_type(model))
print(get_model_config(model))

# Debug collection
data = collect_logit_lens_topk_efficient(
    prompt, model,
    remote=False,  # Run locally for easier debugging
)
```

### JavaScript

```javascript
// Debug in browser console
var widget = LogitLensWidget("#viz", data);
console.log(widget.getState());

// Check DOM
document.querySelector(`#${widget.uid}`);
```

## GitHub Pages

The demo is hosted at https://davidbau.github.io/logitlenskit/

Files served:
- `index.html` - Demo page with embedded widget
- `preview_data.js` - Sample Llama 70B data (JSONP format)

To update the demo:
1. Edit `index.html` or regenerate `preview_data.js`
2. Commit and push to main branch
3. GitHub Pages auto-deploys from main branch root

### Regenerating Preview Data

```python
cd python
source .venv/bin/activate
python ../scripts/fetch-preview-data.py
# Creates preview_data.js in project root
```

## Release Checklist

1. Update version in:
   - `python/pyproject.toml`
   - `js/package.json`
   - `python/src/logitlenskit/__init__.py`

2. Run all tests:
   ```bash
   cd python && pytest
   cd ../js && npm test
   ```

3. Update documentation if needed

4. Commit and tag:
   ```bash
   git add -A
   git commit -m "Release vX.Y.Z"
   git tag vX.Y.Z
   git push && git push --tags
   ```

## Troubleshooting

### Python Import Errors

```bash
# Ensure you're in the venv
which python  # Should be .venv/bin/python

# Reinstall in editable mode
pip install -e ".[dev]"
```

### JavaScript Test Failures

```bash
# Clear Jest cache
npm test -- --clearCache

# Run single test file
npm test -- tests/unit/widget-creation.test.js
```

### NDIF Connection Issues

```bash
# Check API key is set
echo $NDIF_API

# Test connection
python -c "from nnsight import CONFIG; print(CONFIG.API_KEY)"
```

## Project Goals

This package is intended for eventual integration into nnsight. Design priorities:

1. **Bandwidth efficiency** - Minimize data transfer for remote execution
2. **Zero-install Jupyter** - Plain HTML output, no widget dependencies
3. **Multi-model support** - Registry pattern for different architectures
4. **Interactive visualization** - Rich UI for exploring predictions
