"""Tests for graphql_schema — derived from contracts/graphql_schema.md.

Unit tests mock fetch_structures to verify resolver logic and schema contracts
without requiring live services.
Integration tests (marked) require a live NOMAD endpoint.
"""

from contextlib import contextmanager
from unittest.mock import patch

import pytest
from strawberry.relay.utils import from_base64, to_base64

from dantec_optimade.graphql_schema import schema


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NOMAD_RECORD = {
    "id": "entry123",
    "provider": "nomad",
    "elements": ["Fe", "O"],
    "nelements": 2,
    "chemical_formula_reduced": "FeO",
    "chemical_formula_hill": "FeO",
    "nsites": 4,
    "nperiodic_dimensions": 3,
    "dimension_types": [1, 1, 1],
    "last_modified": "2024-01-15T10:30:00Z",
}


def _make_record(**overrides):
    rec = _NOMAD_RECORD.copy()
    rec.update(overrides)
    return rec


def _global_id(raw_id: str) -> str:
    """Encode a raw node ID as a Relay global ID for Structure."""
    return to_base64("Structure", raw_id)


@contextmanager
def _mocks(fetch_return=None):
    """Patch fetch_structures for the duration of a with block."""
    if fetch_return is None:
        fetch_return = []
    with patch(
        "dantec_optimade.graphql_schema.fetch_structures", return_value=fetch_return
    ):
        yield


def _run(query, *, variables=None, fetch_return=None):
    """Execute a GraphQL query against the schema with fetch_structures mocked."""
    ctx = {"_warnings": []}
    with _mocks(fetch_return=fetch_return or []):
        return schema.execute_sync(query, variable_values=variables, context_value=ctx)


# ---------------------------------------------------------------------------
# Base queries used across multiple tests
# ---------------------------------------------------------------------------

_Q_STRUCTURES = """
{
  structures {
    edges {
      cursor
      node {
        id
        provider
        elements
        nelements
        chemicalFormulaReduced
        chemicalFormulaHill
        nsites
        nperiodicDimensions
        dimensionTypes
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
"""

_Q_STRUCTURE_BY_ID = """
query ById($id: ID!) {
  structure(id: $id) {
    id
    provider
    elements
    nelements
  }
}
"""


# ---------------------------------------------------------------------------
# StructureConnection shape
# ---------------------------------------------------------------------------

class TestConnectionShape:
    def test_empty_result_returns_empty_edges(self):
        result = _run(_Q_STRUCTURES, fetch_return=[])
        assert result.errors is None
        conn = result.data["structures"]
        assert conn["edges"] == []

    def test_single_record_produces_one_edge(self):
        result = _run(_Q_STRUCTURES, fetch_return=[_make_record()])
        assert result.errors is None
        assert len(result.data["structures"]["edges"]) == 1

    def test_page_info_present(self):
        result = _run(_Q_STRUCTURES, fetch_return=[])
        conn = result.data["structures"]
        assert "pageInfo" in conn
        assert "hasNextPage" in conn["pageInfo"]

    def test_end_cursor_null_when_no_edges(self):
        result = _run(_Q_STRUCTURES, fetch_return=[])
        assert result.data["structures"]["pageInfo"]["endCursor"] is None

    def test_end_cursor_present_when_edges_exist(self):
        result = _run(_Q_STRUCTURES, fetch_return=[_make_record()])
        end_cursor = result.data["structures"]["pageInfo"]["endCursor"]
        assert end_cursor is not None

    def test_edge_has_cursor(self):
        result = _run(_Q_STRUCTURES, fetch_return=[_make_record()])
        edge = result.data["structures"]["edges"][0]
        assert "cursor" in edge
        assert edge["cursor"] is not None


# ---------------------------------------------------------------------------
# Identity cluster
# ---------------------------------------------------------------------------

class TestIdentityCluster:
    def test_id_is_relay_global_id(self):
        record = _make_record(id="entry123", provider="nomad")
        result = _run(_Q_STRUCTURES, fetch_return=[record])
        node_id = result.data["structures"]["edges"][0]["node"]["id"]
        type_name, raw_id = from_base64(node_id)
        assert type_name == "Structure"
        assert raw_id == "nomad/entry123"

    def test_provider_field_reflects_record_provider(self):
        record = _make_record(provider="nomad")
        result = _run(_Q_STRUCTURES, fetch_return=[record])
        assert result.data["structures"]["edges"][0]["node"]["provider"] == "nomad"

    def test_global_id_decodes_to_provider_slash_optimade_id(self):
        record = _make_record(id="abc456", provider="nomad")
        result = _run(_Q_STRUCTURES, fetch_return=[record])
        raw_global = result.data["structures"]["edges"][0]["node"]["id"]
        _, raw_id = from_base64(raw_global)
        assert "/" in raw_id
        provider, optimade_id = raw_id.split("/", 1)
        assert provider == "nomad"
        assert optimade_id == "abc456"


# ---------------------------------------------------------------------------
# Composition cluster
# ---------------------------------------------------------------------------

class TestCompositionCluster:
    def test_elements_returned(self):
        result = _run(_Q_STRUCTURES, fetch_return=[_make_record(elements=["Fe", "O"])])
        node = result.data["structures"]["edges"][0]["node"]
        assert node["elements"] == ["Fe", "O"]

    def test_nelements_returned(self):
        result = _run(_Q_STRUCTURES, fetch_return=[_make_record(nelements=2)])
        assert result.data["structures"]["edges"][0]["node"]["nelements"] == 2

    def test_chemical_formula_reduced_returned(self):
        result = _run(_Q_STRUCTURES, fetch_return=[_make_record(chemical_formula_reduced="FeO")])
        assert result.data["structures"]["edges"][0]["node"]["chemicalFormulaReduced"] == "FeO"

    def test_chemical_formula_hill_returned(self):
        result = _run(_Q_STRUCTURES, fetch_return=[_make_record(chemical_formula_hill="FeO")])
        assert result.data["structures"]["edges"][0]["node"]["chemicalFormulaHill"] == "FeO"

    def test_nsites_returned(self):
        result = _run(_Q_STRUCTURES, fetch_return=[_make_record(nsites=4)])
        assert result.data["structures"]["edges"][0]["node"]["nsites"] == 4

    def test_nperiodic_dimensions_returned(self):
        result = _run(_Q_STRUCTURES, fetch_return=[_make_record(nperiodic_dimensions=3)])
        assert result.data["structures"]["edges"][0]["node"]["nperiodicDimensions"] == 3

    def test_dimension_types_returned(self):
        result = _run(_Q_STRUCTURES, fetch_return=[_make_record(dimension_types=[1, 1, 1])])
        assert result.data["structures"]["edges"][0]["node"]["dimensionTypes"] == [1, 1, 1]

    def test_null_optional_field_returns_null(self):
        record = _make_record(chemical_formula_reduced=None)
        result = _run(_Q_STRUCTURES, fetch_return=[record])
        assert result.data["structures"]["edges"][0]["node"]["chemicalFormulaReduced"] is None


# ---------------------------------------------------------------------------
# lastModified resolver
# ---------------------------------------------------------------------------

class TestLastModified:
    _Q = """
    {
      structures {
        edges { node { lastModified } }
      }
    }
    """

    def test_iso_datetime_with_z_suffix_is_parsed(self):
        record = _make_record(last_modified="2024-01-15T10:30:00Z")
        result = _run(self._Q, fetch_return=[record])
        lm = result.data["structures"]["edges"][0]["node"]["lastModified"]
        assert lm is not None
        assert "2024" in lm

    def test_null_last_modified_returns_null(self):
        record = _make_record(last_modified=None)
        result = _run(self._Q, fetch_return=[record])
        assert result.data["structures"]["edges"][0]["node"]["lastModified"] is None

    def test_missing_last_modified_returns_null(self):
        record = _make_record()
        record.pop("last_modified", None)
        result = _run(self._Q, fetch_return=[record])
        assert result.data["structures"]["edges"][0]["node"]["lastModified"] is None

    def test_invalid_datetime_string_returns_null(self):
        record = _make_record(last_modified="not-a-date")
        result = _run(self._Q, fetch_return=[record])
        assert result.data["structures"]["edges"][0]["node"]["lastModified"] is None


# ---------------------------------------------------------------------------
# Heavy clusters (geometry, symmetry, sites)
# ---------------------------------------------------------------------------

class TestHeavyClusters:
    _Q_HEAVY = """
    {
      structures {
        edges {
          node {
            latticeVectors
            cartesianSitePositions
            spaceGroupSymbol
            spaceGroupItNumber
            species
            speciesAtSites
          }
        }
      }
    }
    """

    def test_lattice_vectors_returned_when_present(self):
        lv = [[5.0, 0.0, 0.0], [0.0, 5.0, 0.0], [0.0, 0.0, 5.0]]
        record = _make_record(lattice_vectors=lv)
        result = _run(self._Q_HEAVY, fetch_return=[record])
        assert result.data["structures"]["edges"][0]["node"]["latticeVectors"] == lv

    def test_lattice_vectors_null_when_absent(self):
        result = _run(self._Q_HEAVY, fetch_return=[_make_record()])
        assert result.data["structures"]["edges"][0]["node"]["latticeVectors"] is None

    def test_cartesian_site_positions_returned_when_present(self):
        csp = [[0.0, 0.0, 0.0], [2.5, 2.5, 0.0]]
        record = _make_record(cartesian_site_positions=csp)
        result = _run(self._Q_HEAVY, fetch_return=[record])
        assert result.data["structures"]["edges"][0]["node"]["cartesianSitePositions"] == csp

    def test_space_group_symbol_returned(self):
        record = _make_record(space_group_symbol="R-3c")
        result = _run(self._Q_HEAVY, fetch_return=[record])
        assert result.data["structures"]["edges"][0]["node"]["spaceGroupSymbol"] == "R-3c"

    def test_space_group_it_number_returned(self):
        record = _make_record(space_group_it_number=167)
        result = _run(self._Q_HEAVY, fetch_return=[record])
        assert result.data["structures"]["edges"][0]["node"]["spaceGroupItNumber"] == 167

    def test_species_returned_as_json(self):
        species = [{"name": "Fe", "chemical_symbols": ["Fe"]}]
        record = _make_record(species=species)
        result = _run(self._Q_HEAVY, fetch_return=[record])
        assert result.data["structures"]["edges"][0]["node"]["species"] == species

    def test_species_at_sites_returned(self):
        record = _make_record(species_at_sites=["Fe", "Fe", "O", "O"])
        result = _run(self._Q_HEAVY, fetch_return=[record])
        assert result.data["structures"]["edges"][0]["node"]["speciesAtSites"] == ["Fe", "Fe", "O", "O"]

    def test_all_heavy_fields_null_when_absent(self):
        result = _run(self._Q_HEAVY, fetch_return=[_make_record()])
        node = result.data["structures"]["edges"][0]["node"]
        assert node["latticeVectors"] is None
        assert node["cartesianSitePositions"] is None
        assert node["spaceGroupSymbol"] is None
        assert node["spaceGroupItNumber"] is None
        assert node["species"] is None
        assert node["speciesAtSites"] is None


# ---------------------------------------------------------------------------
# ProviderMetadata dispatch
# ---------------------------------------------------------------------------

class TestProviderMetadata:
    _Q = """
    {
      structures {
        edges {
          node {
            providerMetadata {
              raw
              ... on NomadMetadata {
                uploadId
                entryId
                archiveUrl
                programName
                programVersion
              }
            }
          }
        }
      }
    }
    """

    _Q_TYPENAME = """
    {
      structures {
        edges {
          node {
            providerMetadata {
              __typename
              raw
            }
          }
        }
      }
    }
    """

    def test_nomad_provider_returns_nomad_metadata_type(self):
        record = _make_record(provider="nomad")
        result = _run(self._Q_TYPENAME, fetch_return=[record])
        assert result.errors is None
        typename = result.data["structures"]["edges"][0]["node"]["providerMetadata"]["__typename"]
        assert typename == "NomadMetadata"

    def test_nomad_metadata_fields_populated_from_raw(self):
        record = _make_record(
            provider="nomad",
            _nomad_upload_id="upload-abc",
            _nomad_entry_id="entry-def",
            _nomad_archive_url="https://nomad-lab.eu/archive/entry-def",
            _nomad_program_name="VASP",
            _nomad_program_version="6.3",
        )
        result = _run(self._Q, fetch_return=[record])
        assert result.errors is None
        meta = result.data["structures"]["edges"][0]["node"]["providerMetadata"]
        assert meta["uploadId"] == "upload-abc"
        assert meta["entryId"] == "entry-def"
        assert meta["archiveUrl"] == "https://nomad-lab.eu/archive/entry-def"
        assert meta["programName"] == "VASP"
        assert meta["programVersion"] == "6.3"

    def test_nomad_metadata_fields_null_when_absent(self):
        record = _make_record(provider="nomad")
        result = _run(self._Q, fetch_return=[record])
        assert result.errors is None
        meta = result.data["structures"]["edges"][0]["node"]["providerMetadata"]
        assert meta["uploadId"] is None
        assert meta["entryId"] is None

    def test_non_nomad_provider_returns_generic_metadata(self):
        # fetch_structures returns a record with a non-nomad provider field;
        # providerMetadata dispatch is based on record["provider"], not the URL
        record = _make_record(id="entry-x", provider="other")
        result = _run(self._Q_TYPENAME, fetch_return=[record])
        assert result.errors is None
        typename = result.data["structures"]["edges"][0]["node"]["providerMetadata"]["__typename"]
        assert typename == "GenericProviderMetadata"

    def test_provider_metadata_raw_contains_full_record(self):
        record = _make_record(provider="nomad", elements=["Fe", "O"])
        result = _run(self._Q_TYPENAME, fetch_return=[record])
        raw = result.data["structures"]["edges"][0]["node"]["providerMetadata"]["raw"]
        assert raw is not None
        assert "elements" in raw


# ---------------------------------------------------------------------------
# first argument and hasNextPage
# ---------------------------------------------------------------------------

class TestFirstArgument:
    def test_first_over_100_raises_graphql_error(self):
        result = _run("{ structures(first: 101) { edges { node { id } } pageInfo { hasNextPage } } }")
        assert result.errors is not None
        assert any("≤ 100" in str(e) for e in result.errors)

    def test_has_next_page_true_when_page_full(self):
        records = [_make_record(id=f"entry{i}") for i in range(3)]
        result = _run(
            "{ structures(first: 3) { edges { node { id } } pageInfo { hasNextPage } } }",
            fetch_return=records,
        )
        assert result.data["structures"]["pageInfo"]["hasNextPage"] is True

    def test_has_next_page_false_when_fewer_than_first(self):
        records = [_make_record(id="entry1")]
        result = _run(
            "{ structures(first: 3) { edges { node { id } } pageInfo { hasNextPage } } }",
            fetch_return=records,
        )
        assert result.data["structures"]["pageInfo"]["hasNextPage"] is False

    def test_default_first_is_10(self):
        # fetch_structures returns exactly 10 records → hasNextPage True (default first=10)
        records = [_make_record(id=f"entry{i}") for i in range(10)]
        result = _run(
            "{ structures { edges { node { id } } pageInfo { hasNextPage } } }",
            fetch_return=records,
        )
        assert result.data["structures"]["pageInfo"]["hasNextPage"] is True

    def test_default_first_at_most_10_edges(self):
        records = [_make_record(id=f"entry{i}") for i in range(10)]
        result = _run(
            "{ structures { edges { node { id } } } }",
            fetch_return=records,
        )
        assert len(result.data["structures"]["edges"]) == 10


# ---------------------------------------------------------------------------
# Cursor pagination
# ---------------------------------------------------------------------------

class TestCursorPagination:
    def test_invalid_cursor_raises_graphql_error(self):
        result = _run(
            '{ structures(after: "not-valid-base64!!") { edges { node { id } } pageInfo { hasNextPage } } }'
        )
        assert result.errors is not None
        assert any("cursor" in str(e).lower() for e in result.errors)

    def test_cursor_on_edge_is_valid_base64(self):
        result = _run(
            "{ structures(first: 1) { edges { cursor node { id } } } }",
            fetch_return=[_make_record()],
        )
        cursor = result.data["structures"]["edges"][0]["cursor"]
        import base64 as _b64
        decoded = _b64.b64decode(cursor.encode()).decode()
        assert decoded.isdigit()

    def test_second_page_cursor_advances_offset(self):
        import base64 as _b64

        # First page: first=2, no after
        records_p1 = [_make_record(id=f"e{i}") for i in range(2)]
        result1 = _run(
            "{ structures(first: 2) { edges { cursor node { id } } pageInfo { endCursor } } }",
            fetch_return=records_p1,
        )
        end_cursor = result1.data["structures"]["pageInfo"]["endCursor"]
        # endCursor encodes offset=2
        assert _b64.b64decode(end_cursor.encode()).decode() == "2"

        # Second page: first=2, after=end_cursor
        # fetch_structures must return 4 total records so slice [2:4] yields records 2 and 3
        records_p2_all = [_make_record(id=f"e{i}") for i in range(4)]
        result2 = _run(
            "{ structures(first: 2, after: $cursor) { edges { node { id } } } }".replace(
                "$cursor", f'"{end_cursor}"'
            ),
            fetch_return=records_p2_all,
        )
        # GraphQL inline variable replacement doesn't work; use variables
        ctx = {"_warnings": []}
        with _mocks(fetch_return=records_p2_all):
            result2 = schema.execute_sync(
                "query P2($cur: String!) { structures(first: 2, after: $cur) { edges { node { id } } } }",
                variable_values={"cur": end_cursor},
                context_value=ctx,
            )
        assert result2.errors is None
        ids = [e["node"]["id"] for e in result2.data["structures"]["edges"]]
        # Records 2 and 3 from the fetch (index 2 and 3) should appear
        assert len(ids) == 2


# ---------------------------------------------------------------------------
# Provider warnings
# ---------------------------------------------------------------------------

class TestProviderWarnings:
    def test_unknown_provider_key_generates_warning_in_extensions(self):
        ctx = {"_warnings": []}
        with _mocks(fetch_return=[]):
            result = schema.execute_sync(
                '{ structures(providers: ["bad-provider"]) { edges { node { id } } } }',
                context_value=ctx,
            )
        assert result.errors is None
        assert result.extensions is not None
        warnings = result.extensions.get("warnings", [])
        assert any("bad-provider" in w for w in warnings)

    def test_unknown_provider_still_returns_connection(self):
        result = _run(
            '{ structures(providers: ["bad-provider"]) { edges { node { id } } } }',
        )
        assert result.errors is None
        assert result.data["structures"]["edges"] == []

    def test_unreachable_provider_generates_warning(self):
        ctx = {"_warnings": []}
        with patch(
            "dantec_optimade.graphql_schema.fetch_structures",
            side_effect=RuntimeError("connection refused"),
        ):
            result = schema.execute_sync(
                "{ structures { edges { node { id } } } }",
                context_value=ctx,
            )
        assert result.errors is None
        warnings = (result.extensions or {}).get("warnings", [])
        assert any("unreachable" in w or "nomad" in w for w in warnings)

    def test_unreachable_provider_returns_empty_edges_not_error(self):
        ctx = {"_warnings": []}
        with patch(
            "dantec_optimade.graphql_schema.fetch_structures",
            side_effect=RuntimeError("timeout"),
        ):
            result = schema.execute_sync(
                "{ structures { edges { node { id } } } }",
                context_value=ctx,
            )
        assert result.errors is None
        assert result.data["structures"]["edges"] == []


# ---------------------------------------------------------------------------
# structure(id) query — lookup by global ID
# ---------------------------------------------------------------------------

class TestStructureById:
    def test_fetch_structures_called_with_id_filter(self):
        record = _make_record(id="entry123", provider="nomad")
        global_id = _global_id("nomad/entry123")
        ctx = {"_warnings": []}
        with patch("dantec_optimade.graphql_schema.fetch_structures", return_value=[record]) as mock_fetch:
            result = schema.execute_sync(
                _Q_STRUCTURE_BY_ID, variable_values={"id": global_id}, context_value=ctx
            )
            mock_fetch.assert_called_once()
            args, _ = mock_fetch.call_args
            assert "entry123" in args[0]
        assert result.errors is None
        assert result.data["structure"]["provider"] == "nomad"

    def test_not_found_returns_null(self):
        global_id = _global_id("nomad/nonexistent")
        result = _run(_Q_STRUCTURE_BY_ID, variables={"id": global_id}, fetch_return=[])
        assert result.errors is None
        assert result.data["structure"] is None

    def test_malformed_id_raises_graphql_error(self):
        result = _run(_Q_STRUCTURE_BY_ID, variables={"id": "not-base64!!!"})
        assert result.errors is not None
        assert any("malformed" in str(e).lower() for e in result.errors)

    def test_wrong_type_name_raises_graphql_error(self):
        wrong_id = to_base64("Provider", "nomad/entry123")
        result = _run(_Q_STRUCTURE_BY_ID, variables={"id": wrong_id})
        assert result.errors is not None
        assert any("malformed" in str(e).lower() for e in result.errors)

    def test_no_slash_in_raw_id_raises_graphql_error(self):
        # Valid base64("Structure:noslash") but no "/" separating provider/id
        no_slash_id = to_base64("Structure", "noslash")
        result = _run(_Q_STRUCTURE_BY_ID, variables={"id": no_slash_id})
        assert result.errors is not None
        assert any("malformed" in str(e).lower() for e in result.errors)

    def test_unknown_provider_returns_null(self):
        global_id = _global_id("unknown-prov/entry123")
        result = _run(_Q_STRUCTURE_BY_ID, variables={"id": global_id}, fetch_return=[])
        assert result.errors is None
        assert result.data["structure"] is None

    def test_fetch_timeout_returns_null_with_warning(self):
        global_id = _global_id("nomad/entry123")
        ctx = {"_warnings": []}
        with patch("dantec_optimade.graphql_schema.fetch_structures",
                   side_effect=TimeoutError("timed out")):
            result = schema.execute_sync(
                _Q_STRUCTURE_BY_ID, variable_values={"id": global_id}, context_value=ctx
            )
        assert result.errors is None
        assert result.data["structure"] is None
        warnings = (result.extensions or {}).get("warnings", [])
        assert any("nomad" in w and "unreachable" in w for w in warnings)


# ---------------------------------------------------------------------------
# WarningsExtension
# ---------------------------------------------------------------------------

class TestWarningsExtension:
    def test_no_warnings_no_extensions_warnings_key(self):
        result = _run(_Q_STRUCTURES, fetch_return=[_make_record()])
        warnings = (result.extensions or {}).get("warnings")
        assert warnings is None

    def test_unknown_provider_warning_appears_in_extensions(self):
        ctx = {"_warnings": []}
        with _mocks():
            result = schema.execute_sync(
                '{ structures(providers: ["ghost"]) { edges { node { id } } } }',
                context_value=ctx,
            )
        warnings = (result.extensions or {}).get("warnings", [])
        assert len(warnings) >= 1
        assert any("ghost" in w for w in warnings)


# ---------------------------------------------------------------------------
# FastAPI integration — schema is mountable
# ---------------------------------------------------------------------------

class TestFastAPIMount:
    def test_app_includes_graphql_router(self):
        from dantec_optimade.app import app
        from dantec_optimade.graphql_schema import graphql_router
        included = [
            r.original_router
            for r in app.routes
            if hasattr(r, "original_router")
        ]
        assert graphql_router in included


# ---------------------------------------------------------------------------
# Integration tests — live NOMAD + RavenDB
# ---------------------------------------------------------------------------

@pytest.mark.integration
class TestGraphQLIntegration:
    """Requires live NOMAD OPTIMADE endpoint and a running RavenDB instance."""

    def _exec(self, query, variables=None):
        ctx = {"_warnings": []}
        return schema.execute_sync(query, variable_values=variables, context_value=ctx)

    def test_structures_returns_edges(self):
        result = self._exec('{ structures(first: 3) { edges { node { id provider } } } }')
        assert result.errors is None
        assert len(result.data["structures"]["edges"]) >= 1

    def test_fe_filter_returns_iron_structures(self):
        result = self._exec('{ structures(filter: "elements HAS \\"Fe\\"", first: 2) { edges { node { elements } } } }')
        assert result.errors is None
        for edge in result.data["structures"]["edges"]:
            assert "Fe" in edge["node"]["elements"]

    def test_structure_by_id_roundtrip(self):
        list_result = self._exec('{ structures(first: 1) { edges { node { id provider } } } }')
        assert list_result.errors is None
        node_id = list_result.data["structures"]["edges"][0]["node"]["id"]
        provider = list_result.data["structures"]["edges"][0]["node"]["provider"]

        detail_result = self._exec(
            "query D($id: ID!) { structure(id: $id) { id provider } }",
            variables={"id": node_id},
        )
        assert detail_result.errors is None
        assert detail_result.data["structure"]["id"] == node_id
        assert detail_result.data["structure"]["provider"] == provider

    def test_nomad_provider_metadata_type(self):
        result = self._exec(
            '{ structures(first: 1) { edges { node { providerMetadata { __typename } } } } }'
        )
        assert result.errors is None
        typename = result.data["structures"]["edges"][0]["node"]["providerMetadata"]["__typename"]
        assert typename == "NomadMetadata"

    def test_unknown_provider_warning_live(self):
        ctx = {"_warnings": []}
        result = schema.execute_sync(
            '{ structures(providers: ["nomad", "does-not-exist"], first: 2) { edges { node { id } } } }',
            context_value=ctx,
        )
        assert result.errors is None
        warnings = (result.extensions or {}).get("warnings", [])
        assert any("does-not-exist" in w for w in warnings)
