"""Pytest fixtures for the FLOW AI backend test suite."""

import pathlib
import sys

import pytest

# Make `import app` work regardless of the directory pytest is invoked from.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app import app as flask_app  # noqa: E402
from app import reset_state  # noqa: E402


@pytest.fixture()
def client():
    """A test client that always starts from deterministic initial data."""
    flask_app.config["TESTING"] = True
    reset_state()
    with flask_app.test_client() as test_client:
        yield test_client
    reset_state()
