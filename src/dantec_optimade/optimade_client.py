import os
from urllib.parse import urlparse
from typing import Optional

from optimade.client import OptimadeClient


NOMAD_BASE_URL = "https://nomad-lab.eu/prod/v1/optimade"

OPTIMADE_HTTP_TIMEOUT: float = float(os.environ.get("OPTIMADE_HTTP_TIMEOUT", "5.0"))

# Standard OPTIMADE structure fields plus NOMAD private extensions.
# response_fields must be exhaustive: servers return ONLY the requested fields
# when this parameter is present.
RESPONSE_FIELDS: list[str] = [
    # Composition
    "elements",
    "nelements",
    "chemical_formula_reduced",
    "chemical_formula_hill",
    "chemical_formula_descriptive",
    # Geometry / periodicity
    "nsites",
    "dimension_types",
    "nperiodic_dimensions",
    "lattice_vectors",
    "cartesian_site_positions",
    # Species / sites
    "species",
    "species_at_sites",
    # Symmetry (space_group_symbol not supported by NOMAD OPTIMADE endpoint)
    "space_group_it_number",
    # Provenance
    "last_modified",
    # NOMAD private extensions
    "_nomad_entry_id",
    "_nomad_upload_id",
    "_nomad_archive_url",
    "_nomad_program_name",
    "_nomad_program_version",
]

# Cache OptimadeClient instances to avoid re-fetching /info on every call.
# Keyed by (sorted url tuple, max_results) so each unique combination pays
# the /info round trip exactly once.
_client_cache: dict[tuple[tuple[str, ...], int], OptimadeClient] = {}


def _get_client(base_urls: list[str], max_results: int) -> OptimadeClient:
    key = (tuple(sorted(base_urls)), max_results)
    if key not in _client_cache:
        _client_cache[key] = OptimadeClient(
            base_urls=base_urls,
            max_results_per_provider=max_results,
            silent=True,
            http_timeout=OPTIMADE_HTTP_TIMEOUT,
        )
    return _client_cache[key]


def fetch_structures(
    filter_str: str,
    max_results: int = 10,
    base_urls: Optional[list[str]] = None,
) -> list[dict]:
    """Query OPTIMADE /structures endpoint(s) and return flat records.

    Args:
        filter_str: OPTIMADE filter string (e.g. 'elements HAS "Fe"')
        max_results: max results per provider
        base_urls: OPTIMADE provider base URLs; defaults to NOMAD only.
                   Pass None to query all registered OPTIMADE providers.
    """
    if base_urls is None:
        base_urls = [NOMAD_BASE_URL]

    client = _get_client(base_urls, max_results)
    raw = client.get(filter_str, response_fields=RESPONSE_FIELDS)

    records = []
    for filter_results in raw.get("structures", {}).values():
        for base_url, response in filter_results.items():
            provider = _provider_from_url(base_url)
            for item in response.get("data", []):
                attrs = item.get("attributes", {})
                optimade_id = item.get("id")
                last_modified = attrs.get("last_modified") or ""
                # NOMAD's _nomad_entry_id extension is always null in practice;
                # the top-level OPTIMADE id is the NOMAD entry id.
                nomad_entry_id = attrs.get("_nomad_entry_id") or (
                    optimade_id if provider == "nomad" else None
                )
                records.append({
                    # All provider attributes (standard OPTIMADE + provider extensions)
                    **attrs,
                    # Top-level OPTIMADE fields not nested under attributes
                    "id": optimade_id,
                    "provider": provider,
                    # Resolved NOMAD entry id (overrides the always-null extension field)
                    "_nomad_entry_id": nomad_entry_id,
                    # Normalize None → "" for consistency
                    "last_modified": last_modified,
                    # GUI compatibility stubs — remove when gui.py is redesigned
                    "formula": attrs.get("chemical_formula_reduced"),
                    "title": optimade_id,
                    "authors": "",
                    "date": last_modified[:10],
                })

    return records


def _provider_from_url(base_url: str) -> str:
    if "nomad-lab.eu" in base_url:
        return "nomad"
    return urlparse(base_url).netloc
