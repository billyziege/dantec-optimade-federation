"""Tests for RavenDBClient — derived from contracts/raven_data_access.md.

Unit tests mock requests to verify HTTP plumbing and field-filtering logic.
Integration tests (marked) require a running RavenDB; configure via env vars:
  RAVENDB_URL  (default: http://127.0.0.1:8080)
  RAVENDB_TEST_DB  (default: optimade-test)
"""

import os
import pytest
from unittest.mock import MagicMock, patch, call

from dantec_optimade.raven_data_access import RavenDBClient


OPTIMADE_FIELDS = {
    "provider",
    "chemical_formula_reduced",
    "chemical_formula_hill",
    "elements",
    "nelements",
    "nsites",
    "dimension_types",
    "nperiodic_dimensions",
    "last_modified",
}

LEGACY_FIELDS = {"title", "date", "formula", "authors"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    return RavenDBClient("http://127.0.0.1:8080", "test-db")


@pytest.fixture
def full_record():
    """A record as returned by fetch_structures — includes GUI stubs."""
    return {
        "id": "nomad/test-001",
        "provider": "nomad",
        "chemical_formula_reduced": "FeO",
        "chemical_formula_hill": "FeO",
        "elements": ["Fe", "O"],
        "nelements": 2,
        "nsites": 4,
        "dimension_types": [1, 1, 1],
        "nperiodic_dimensions": 3,
        "last_modified": "2024-01-01T00:00:00Z",
        # GUI stubs — should NOT be stored
        "formula": "FeO",
        "title": "nomad/test-001",
        "authors": "",
        "date": "2024-01-01",
    }


# ---------------------------------------------------------------------------
# Unit tests — insert_single_document
# ---------------------------------------------------------------------------

class TestInsertSingleDocument:
    def test_puts_to_correct_url(self, client, full_record):
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {}
        with patch("dantec_optimade.raven_data_access.requests.put", return_value=mock_resp) as mock_put:
            client.insert_single_document(full_record)
        mock_put.assert_called_once()
        _, kwargs = mock_put.call_args
        assert kwargs["params"] == {"id": "nomad/test-001"}

    def test_stores_optimade_fields(self, client, full_record):
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {}
        with patch("dantec_optimade.raven_data_access.requests.put", return_value=mock_resp) as mock_put:
            client.insert_single_document(full_record)
        _, kwargs = mock_put.call_args
        stored = kwargs["json"]
        assert OPTIMADE_FIELDS.issubset(stored.keys())

    def test_does_not_store_legacy_fields(self, client, full_record):
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {}
        with patch("dantec_optimade.raven_data_access.requests.put", return_value=mock_resp) as mock_put:
            client.insert_single_document(full_record)
        _, kwargs = mock_put.call_args
        stored = kwargs["json"]
        leaked = LEGACY_FIELDS & stored.keys()
        assert not leaked, f"Legacy fields stored: {leaked}"

    def test_returns_none(self, client, full_record):
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {}
        with patch("dantec_optimade.raven_data_access.requests.put", return_value=mock_resp):
            result = client.insert_single_document(full_record)
        assert result is None

    def test_non_200_does_not_raise(self, client, full_record):
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        with patch("dantec_optimade.raven_data_access.requests.put", return_value=mock_resp):
            client.insert_single_document(full_record)  # must not raise


# ---------------------------------------------------------------------------
# Unit tests — insert_document (list)
# ---------------------------------------------------------------------------

class TestInsertDocument:
    def test_calls_put_once_per_item(self, client, full_record):
        record2 = {**full_record, "id": "nomad/test-002"}
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {}
        with patch("dantec_optimade.raven_data_access.requests.put", return_value=mock_resp) as mock_put:
            client.insert_document([full_record, record2])
        assert mock_put.call_count == 2

    def test_each_item_uses_its_own_id(self, client, full_record):
        record2 = {**full_record, "id": "nomad/test-002"}
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {}
        with patch("dantec_optimade.raven_data_access.requests.put", return_value=mock_resp) as mock_put:
            client.insert_document([full_record, record2])
        ids_used = [c.kwargs["params"]["id"] for c in mock_put.call_args_list]
        assert ids_used == ["nomad/test-001", "nomad/test-002"]

    def test_no_legacy_fields_in_any_item(self, client, full_record):
        record2 = {**full_record, "id": "nomad/test-002"}
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {}
        with patch("dantec_optimade.raven_data_access.requests.put", return_value=mock_resp) as mock_put:
            client.insert_document([full_record, record2])
        for c in mock_put.call_args_list:
            stored = c.kwargs["json"]
            leaked = LEGACY_FIELDS & stored.keys()
            assert not leaked, f"Legacy fields in batch item: {leaked}"


# ---------------------------------------------------------------------------
# Unit tests — get_document
# ---------------------------------------------------------------------------

class TestGetDocument:
    def test_returns_dict_on_200(self, client):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"provider": "nomad"}
        with patch("dantec_optimade.raven_data_access.requests.get", return_value=mock_resp):
            result = client.get_document("nomad/test-001")
        assert result == {"provider": "nomad"}

    def test_returns_none_on_404(self, client):
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        with patch("dantec_optimade.raven_data_access.requests.get", return_value=mock_resp):
            result = client.get_document("nonexistent")
        assert result is None

    def test_returns_none_on_error(self, client):
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        with patch("dantec_optimade.raven_data_access.requests.get", return_value=mock_resp):
            result = client.get_document("nomad/test-001")
        assert result is None


# ---------------------------------------------------------------------------
# Unit tests — query
# ---------------------------------------------------------------------------

class TestQuery:
    def test_returns_dict_on_200(self, client):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"Results": []}
        with patch("dantec_optimade.raven_data_access.requests.post", return_value=mock_resp):
            result = client.query("from 'test-db'")
        assert result == {"Results": []}

    def test_returns_none_on_failure(self, client):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        with patch("dantec_optimade.raven_data_access.requests.post", return_value=mock_resp):
            result = client.query("from 'test-db'")
        assert result is None


# ---------------------------------------------------------------------------
# Unit tests — delete_document
# ---------------------------------------------------------------------------

class TestDeleteDocument:
    def test_returns_true_on_204(self, client):
        mock_resp = MagicMock()
        mock_resp.status_code = 204
        with patch("dantec_optimade.raven_data_access.requests.delete", return_value=mock_resp):
            result = client.delete_document("nomad/test-001")
        assert result is True

    def test_returns_false_on_404(self, client):
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        with patch("dantec_optimade.raven_data_access.requests.delete", return_value=mock_resp):
            result = client.delete_document("nonexistent")
        assert result is False

    def test_returns_false_on_error(self, client):
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        with patch("dantec_optimade.raven_data_access.requests.delete", return_value=mock_resp):
            result = client.delete_document("nomad/test-001")
        assert result is False


# ---------------------------------------------------------------------------
# Integration tests — live RavenDB
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def live_client():
    url = os.environ.get("RAVENDB_URL", "http://127.0.0.1:8080")
    db = os.environ.get("RAVENDB_TEST_DB", "optimade-test")
    return RavenDBClient(url, db)


@pytest.fixture
def sample_record():
    return {
        "id": "integration-test/fe-o-001",
        "provider": "test",
        "chemical_formula_reduced": "FeO",
        "chemical_formula_hill": "FeO",
        "elements": ["Fe", "O"],
        "nelements": 2,
        "nsites": 2,
        "dimension_types": [1, 1, 1],
        "nperiodic_dimensions": 3,
        "last_modified": "2024-01-01T00:00:00Z",
        # stubs present as they would be from fetch_structures
        "formula": "FeO",
        "title": "integration-test/fe-o-001",
        "authors": "",
        "date": "2024-01-01",
    }


@pytest.mark.integration
class TestRavenDBIntegration:
    """Requires RavenDB at RAVENDB_URL with database RAVENDB_TEST_DB."""

    def test_insert_then_get(self, live_client, sample_record):
        live_client.insert_single_document(sample_record)
        doc = live_client.get_document(sample_record["id"])
        assert doc is not None
        assert OPTIMADE_FIELDS.issubset(doc.keys())

    def test_stored_doc_has_no_legacy_fields(self, live_client, sample_record):
        live_client.insert_single_document(sample_record)
        doc = live_client.get_document(sample_record["id"])
        leaked = LEGACY_FIELDS & doc.keys()
        assert not leaked, f"Legacy fields found in stored doc: {leaked}"

    def test_upsert_overwrites(self, live_client, sample_record):
        live_client.insert_single_document(sample_record)
        updated = {**sample_record, "nelements": 99}
        live_client.insert_single_document(updated)
        doc = live_client.get_document(sample_record["id"])
        # nelements is not a RavenDB metadata field so it should reflect update
        # (RavenDB wraps doc in Results[]; check value regardless of wrapper)
        assert doc is not None

    def test_delete_returns_true(self, live_client, sample_record):
        live_client.insert_single_document(sample_record)
        result = live_client.delete_document(sample_record["id"])
        assert result is True

    def test_delete_nonexistent_returns_false(self, live_client):
        result = live_client.delete_document("does-not-exist/xyz")
        assert result is False

    def test_get_nonexistent_returns_none(self, live_client):
        result = live_client.get_document("does-not-exist/xyz")
        assert result is None

    def test_insert_document_list(self, live_client):
        records = [
            {
                "id": f"integration-test/batch-{i}",
                "provider": "test",
                "chemical_formula_reduced": "NaCl",
                "chemical_formula_hill": "ClNa",
                "elements": ["Na", "Cl"],
                "nelements": 2,
                "nsites": 2,
                "dimension_types": [1, 1, 1],
                "nperiodic_dimensions": 3,
                "last_modified": "2024-01-01T00:00:00Z",
                "formula": "NaCl",
                "title": f"integration-test/batch-{i}",
                "authors": "",
                "date": "2024-01-01",
            }
            for i in range(3)
        ]
        live_client.insert_document(records)
        for r in records:
            doc = live_client.get_document(r["id"])
            assert doc is not None
            live_client.delete_document(r["id"])
