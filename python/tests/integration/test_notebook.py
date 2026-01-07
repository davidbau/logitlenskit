"""
Tests for running notebooks with live NDIF execution.

These tests require:
- NDIF_API_KEY environment variable set
- Network access to NDIF servers

Run with: pytest tests/integration/test_notebook.py -v
"""

import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

# Skip all tests if NDIF_API_KEY not set
pytestmark = pytest.mark.skipif(
    not os.environ.get("NDIF_API_KEY"),
    reason="NDIF_API_KEY environment variable required for notebook tests",
)


def get_notebook_path(name: str) -> Path:
    """Get the path to a notebook in the notebooks directory."""
    repo_root = Path(__file__).parent.parent.parent.parent
    return repo_root / "notebooks" / name


def run_notebook(notebook_path: Path, timeout: int = 300) -> dict:
    """
    Execute a notebook using nbconvert and return results.

    Args:
        notebook_path: Path to the .ipynb file
        timeout: Maximum execution time in seconds

    Returns:
        dict with 'success', 'output', 'error' keys
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = Path(tmpdir) / "output.ipynb"

        cmd = [
            sys.executable,
            "-m",
            "jupyter",
            "nbconvert",
            "--to",
            "notebook",
            "--execute",
            "--output",
            str(output_path),
            "--ExecutePreprocessor.timeout",
            str(timeout),
            str(notebook_path),
        ]

        # Set up environment with NDIF key
        env = os.environ.copy()
        if "NDIF_API_KEY" in env and "NDIF_API" not in env:
            env["NDIF_API"] = env["NDIF_API_KEY"]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout + 30,
                env=env,
            )

            return {
                "success": result.returncode == 0,
                "output": result.stdout,
                "error": result.stderr,
                "returncode": result.returncode,
            }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "output": "",
                "error": f"Notebook execution timed out after {timeout} seconds",
                "returncode": -1,
            }


class TestNotebookExecution:
    """Test notebook execution with live NDIF."""

    @pytest.mark.slow
    @pytest.mark.integration
    def test_smoke_test_notebook(self):
        """Run the smoke_test.ipynb notebook end-to-end."""
        notebook_path = get_notebook_path("smoke_test.ipynb")

        if not notebook_path.exists():
            pytest.skip(f"Notebook not found: {notebook_path}")

        result = run_notebook(notebook_path, timeout=300)

        if not result["success"]:
            print("STDOUT:", result["output"])
            print("STDERR:", result["error"])

        assert result["success"], f"Notebook failed: {result['error']}"

    @pytest.mark.slow
    @pytest.mark.integration
    def test_tutorial_notebook(self):
        """Run the tutorial.ipynb notebook end-to-end."""
        notebook_path = get_notebook_path("tutorial.ipynb")

        if not notebook_path.exists():
            pytest.skip(f"Notebook not found: {notebook_path}")

        # Tutorial is longer, give it more time
        result = run_notebook(notebook_path, timeout=600)

        if not result["success"]:
            print("STDOUT:", result["output"])
            print("STDERR:", result["error"])

        assert result["success"], f"Notebook failed: {result['error']}"


class TestNotebookContent:
    """Test notebook content without full execution."""

    def test_smoke_test_notebook_exists(self):
        """Verify smoke_test.ipynb exists and has expected structure."""
        notebook_path = get_notebook_path("smoke_test.ipynb")
        assert notebook_path.exists(), f"Notebook not found: {notebook_path}"

        import json

        with open(notebook_path) as f:
            nb = json.load(f)

        # Should have cells
        assert "cells" in nb
        assert len(nb["cells"]) > 0

        # Should have code cells
        code_cells = [c for c in nb["cells"] if c.get("cell_type") == "code"]
        assert len(code_cells) > 0

        # First cell should be markdown with title
        first_cell = nb["cells"][0]
        assert first_cell.get("cell_type") == "markdown"
        assert "LogitLensKit" in "".join(first_cell.get("source", []))

    def test_tutorial_notebook_exists(self):
        """Verify tutorial.ipynb exists and has expected structure."""
        notebook_path = get_notebook_path("tutorial.ipynb")
        assert notebook_path.exists(), f"Notebook not found: {notebook_path}"

        import json

        with open(notebook_path) as f:
            nb = json.load(f)

        # Should have cells
        assert "cells" in nb
        assert len(nb["cells"]) > 0
