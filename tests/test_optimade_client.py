"""Tests for fetch_structures — derived from contracts/optimade_client.md.

Unit tests mock OptimadeClient to verify the shape-mapping postconditions.
Integration tests (marked) hit the live NOMAD OPTIMADE endpoint.
"""

import pytest
from unittest.mock import MagicMock, patch

NOMAD_BASE_URL = "https://nomad-lab.eu/prod/v1/optimade"

REQUIRED_FIELDS = {
    "id",
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_item(
    id_,
    elements,
    formula_reduced=None,
    formula_hill=None,
    nelements=None,
    nsites=4,
    last_modified="2023-01-01T00:00:00Z",
):
    return {
        "id": id_,
        "attributes": {
            "chemical_formula_reduced": formula_reduced,
            "chemical_formula_hill": formula_hill,
            "elements": elements,
            "nelements": nelements if nelements is not None else len(elements),
            "nsites": nsites,
            "dimension_types": [1, 1, 1],
            "nperiodic_dimensions": 3,
            "last_modified": last_modified,
        },
    }


def _fake_raw(filter_str, items_by_base_url):
    return {"structures": {filter_str: items_by_base_url}}


def _run(filter_str, items, base_url=NOMAD_BASE_URL, max_results=None):
    raw = _fake_raw(filter_str, {base_url: {"data": items}})
    mock_client = MagicMock()
    mock_client.get.return_value = raw
    with patch("dantec_optimade.optimade_client.OptimadeClient", return_value=mock_client):
        from dantec_optimade.optimade_client import fetch_structures
        return fetch_structures(
            filter_str,
            max_results=max_results or max(len(items), 1),
            base_urls=[base_url],
        )


# ---------------------------------------------------------------------------
# Unit tests — shape / postconditions
# ---------------------------------------------------------------------------

class TestRequiredFields:
    def test_all_required_fields_present(self):
        item = _make_item("nomad/abc", ["Fe", "O"], "FeO", "FeO", 2)
        records = _run('elements HAS "Fe"', [item])
        assert REQUIRED_FIELDS.issubset(records[0].keys())

    def test_id_passes_through(self):
        item = _make_item("nomad/abc123", ["Fe"])
        records = _run('elements HAS "Fe"', [item])
        assert records[0]["id"] == "nomad/abc123"

    def test_id_is_never_none(self):
        item = _make_item("nomad/x", ["Fe"])
        records = _run('elements HAS "Fe"', [item])
        assert records[0]["id"] is not None
        assert records[0]["id"] != ""


class TestProvider:
    def test_nomad_url_maps_to_nomad(self):
        item = _make_item("nomad/abc", ["Fe"])
        records = _run('elements HAS "Fe"', [item], base_url=NOMAD_BASE_URL)
        assert records[0]["provider"] == "nomad"

    def test_non_nomad_url_uses_netloc(self):
        url = "https://aflow.org/optimade"
        item = _make_item("aflow/xyz", ["Al"])
        records = _run('elements HAS "Al"', [item], base_url=url)
        assert records[0]["provider"] == "aflow.org"

    def test_provider_is_non_empty_string(self):
        item = _make_item("nomad/abc", ["Fe"])
        records = _run('elements HAS "Fe"', [item])
        assert isinstance(records[0]["provider"], str)
        assert records[0]["provider"] != ""


class TestElements:
    def test_elements_is_list(self):
        item = _make_item("nomad/abc", ["Fe", "O"])
        records = _run('elements HAS "Fe"', [item])
        assert isinstance(records[0]["elements"], list)

    def test_elements_contains_symbols(self):
        item = _make_item("nomad/abc", ["Fe", "O"])
        records = _run('elements HAS "Fe"', [item])
        assert "Fe" in records[0]["elements"]

    def test_nelements_matches_elements_length(self):
        elements = ["Na", "Cl"]
        item = _make_item("nomad/abc", elements, nelements=len(elements))
        records = _run('elements HAS "Na"', [item])
        r = records[0]
        assert r["nelements"] == len(r["elements"])


class TestLastModified:
    def test_last_modified_is_string(self):
        item = _make_item("nomad/abc", ["Fe"], last_modified="2024-06-01T12:00:00Z")
        records = _run('elements HAS "Fe"', [item])
        assert isinstance(records[0]["last_modified"], str)

    def test_null_last_modified_becomes_empty_string(self):
        item = _make_item("nomad/abc", ["Fe"])
        item["attributes"]["last_modified"] = None
        records = _run('elements HAS "Fe"', [item])
        assert records[0]["last_modified"] == ""


class TestEmptyAndEdgeCases:
    def test_empty_data_returns_empty_list(self):
        records = _run('elements HAS "Xy"', [])
        assert records == []

    def test_empty_structures_key_returns_empty_list(self):
        raw = {"structures": {}}
        mock_client = MagicMock()
        mock_client.get.return_value = raw
        with patch("dantec_optimade.optimade_client.OptimadeClient", return_value=mock_client):
            from dantec_optimade.optimade_client import fetch_structures
            result = fetch_structures('elements HAS "Xy"', base_urls=[NOMAD_BASE_URL])
        assert result == []

    def test_multiple_records_returned(self):
        items = [_make_item(f"nomad/{i}", ["Fe"]) for i in range(3)]
        records = _run('elements HAS "Fe"', items)
        assert len(records) == 3


class TestMultiProvider:
    def test_results_from_two_providers_combined(self):
        filter_str = "nelements = 1"
        other_url = "https://aflow.org/optimade"
        raw = _fake_raw(filter_str, {
            NOMAD_BASE_URL: {"data": [_make_item("nomad/a", ["Fe"])]},
            other_url: {"data": [_make_item("aflow/b", ["Al"])]},
        })
        mock_client = MagicMock()
        mock_client.get.return_value = raw
        with patch("dantec_optimade.optimade_client.OptimadeClient", return_value=mock_client):
            from dantec_optimade.optimade_client import fetch_structures
            records = fetch_structures(filter_str, base_urls=[NOMAD_BASE_URL, other_url])
        assert len(records) == 2
        providers = {r["provider"] for r in records}
        assert "nomad" in providers
        assert "aflow.org" in providers

    def test_provider_field_distinguishes_source(self):
        filter_str = "nelements = 1"
        other_url = "https://example-db.org/optimade"
        raw = _fake_raw(filter_str, {
            NOMAD_BASE_URL: {"data": [_make_item("nomad/a", ["Fe"])]},
            other_url: {"data": [_make_item("ext/b", ["Al"])]},
        })
        mock_client = MagicMock()
        mock_client.get.return_value = raw
        with patch("dantec_optimade.optimade_client.OptimadeClient", return_value=mock_client):
            from dantec_optimade.optimade_client import fetch_structures
            records = fetch_structures(filter_str, base_urls=[NOMAD_BASE_URL, other_url])
        id_to_provider = {r["id"]: r["provider"] for r in records}
        assert id_to_provider["nomad/a"] == "nomad"
        assert id_to_provider["ext/b"] == "example-db.org"


# ---------------------------------------------------------------------------
# Integration tests — live NOMAD endpoint
# ---------------------------------------------------------------------------

@pytest.mark.integration
class TestFetchStructuresIntegration:
    """Requires network access to https://nomad-lab.eu/prod/v1/optimade"""

    def test_fe_filter_returns_records(self):
        from dantec_optimade.optimade_client import fetch_structures
        records = fetch_structures('elements HAS "Fe"', max_results=3)
        assert len(records) >= 1

    def test_fe_records_contain_fe(self):
        from dantec_optimade.optimade_client import fetch_structures
        records = fetch_structures('elements HAS "Fe"', max_results=3)
        for r in records:
            assert "Fe" in r["elements"]

    def test_nelements_1_filter(self):
        from dantec_optimade.optimade_client import fetch_structures
        records = fetch_structures("nelements = 1", max_results=2)
        for r in records:
            assert r["nelements"] == 1

    def test_nacl_formula_filter(self):
        from dantec_optimade.optimade_client import fetch_structures
        records = fetch_structures('chemical_formula_reduced = "NaCl"', max_results=5)
        for r in records:
            assert r["chemical_formula_reduced"] == "NaCl"

    def test_nonexistent_element_returns_empty(self):
        from dantec_optimade.optimade_client import fetch_structures
        records = fetch_structures('elements HAS "Xy"', max_results=5)
        assert records == []

    def test_all_required_fields_from_live_data(self):
        from dantec_optimade.optimade_client import fetch_structures
        records = fetch_structures('elements HAS "Fe"', max_results=2)
        for r in records:
            missing = REQUIRED_FIELDS - r.keys()
            assert not missing, f"Missing fields in live record: {missing}"

    def test_provider_is_nomad_by_default(self):
        from dantec_optimade.optimade_client import fetch_structures
        records = fetch_structures('elements HAS "Fe"', max_results=2)
        for r in records:
            assert r["provider"] == "nomad"
