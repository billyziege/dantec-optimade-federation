import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "integration: live network/service tests; run with -m integration",
    )
