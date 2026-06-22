import os
from urllib.parse import urlparse
from typing import Optional

from optimade.client import OptimadeClient


NOMAD_BASE_URL = "https://nomad-lab.eu/prod/v1/optimade"

OPTIMADE_HTTP_TIMEOUT: float = float(os.environ.get("OPTIMADE_HTTP_TIMEOUT", "5.0"))

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
    raw = client.get(filter_str)

    records = []
    for filter_results in raw.get("structures", {}).values():
        for base_url, response in filter_results.items():
            provider = _provider_from_url(base_url)
            for item in response.get("data", []):
                attrs = item.get("attributes", {})
                formula = attrs.get("chemical_formula_reduced")
                last_modified = attrs.get("last_modified") or ""
                records.append({
                    # OPTIMADE fields
                    "id": item.get("id"),
                    "provider": provider,
                    "chemical_formula_reduced": formula,
                    "chemical_formula_hill": attrs.get("chemical_formula_hill"),
                    "elements": attrs.get("elements", []),
                    "nelements": attrs.get("nelements"),
                    "nsites": attrs.get("nsites"),
                    "dimension_types": attrs.get("dimension_types"),
                    "nperiodic_dimensions": attrs.get("nperiodic_dimensions"),
                    "last_modified": last_modified,
                    # GUI compatibility stubs — remove when gui.py is redesigned
                    "formula": formula,
                    "title": item.get("id"),
                    "authors": "",
                    "date": last_modified[:10],
                })

    return records


def _provider_from_url(base_url: str) -> str:
    if "nomad-lab.eu" in base_url:
        return "nomad"
    return urlparse(base_url).netloc
