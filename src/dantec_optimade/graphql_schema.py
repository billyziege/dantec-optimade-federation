from __future__ import annotations

import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any, Iterable, Optional

import strawberry
from strawberry import relay
from strawberry.fastapi import GraphQLRouter
from strawberry.relay.utils import from_base64
from strawberry.scalars import JSON
from strawberry.types import Info

from dantec_optimade.optimade_client import fetch_structures


# ── Provider registry ──────────────────────────────────────────────────────────

PROVIDER_URLS: dict[str, str] = {
    "nomad": "https://nomad-lab.eu/prod/v1/optimade",
}

DEFAULT_PROVIDERS = ["nomad"]


# ── ProviderMetadata interface + implementations ───────────────────────────────

@strawberry.interface
class ProviderMetadata:
    raw: JSON


@strawberry.type
class NomadMetadata(ProviderMetadata):
    raw: JSON
    upload_id: Optional[str] = None
    entry_id: Optional[str] = None
    archive_url: Optional[str] = None
    program_name: Optional[str] = None
    program_version: Optional[str] = None


@strawberry.type
class GenericProviderMetadata(ProviderMetadata):
    raw: JSON


# ── Structure type ─────────────────────────────────────────────────────────────

@strawberry.type
class Structure(relay.Node):
    """A material structure record, sourced from one OPTIMADE provider."""

    node_id: relay.NodeID[str]   # raw: "<provider>/<optimade_id>"
    _raw: strawberry.Private[dict]

    # Identity cluster — always populated
    provider: str

    # Composition cluster — cheap; from flat OPTIMADE record
    elements: Optional[list[str]] = None
    nelements: Optional[int] = None
    chemical_formula_reduced: Optional[str] = None
    chemical_formula_hill: Optional[str] = None
    nsites: Optional[int] = None
    nperiodic_dimensions: Optional[int] = None
    dimension_types: Optional[list[int]] = None

    @strawberry.field
    def last_modified(self) -> Optional[datetime]:
        lm = self._raw.get("last_modified")
        if not lm:
            return None
        try:
            return datetime.fromisoformat(lm.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None

    # Geometry cluster — heavy; populated only when full record is available
    @strawberry.field
    def lattice_vectors(self) -> Optional[list[list[float]]]:
        return self._raw.get("lattice_vectors")

    @strawberry.field
    def cartesian_site_positions(self) -> Optional[list[list[float]]]:
        return self._raw.get("cartesian_site_positions")

    # Symmetry cluster
    @strawberry.field
    def space_group_symbol(self) -> Optional[str]:
        return self._raw.get("space_group_symbol")

    @strawberry.field
    def space_group_it_number(self) -> Optional[int]:
        return self._raw.get("space_group_it_number")

    # Sites cluster — heavy
    @strawberry.field
    def species(self) -> Optional[JSON]:
        return self._raw.get("species")

    @strawberry.field
    def species_at_sites(self) -> Optional[list[str]]:
        return self._raw.get("species_at_sites")

    # Provider metadata — typed dispatch
    @strawberry.field
    def provider_metadata(self) -> Optional[ProviderMetadata]:
        raw = self._raw
        if self.provider == "nomad":
            return NomadMetadata(
                raw=raw,
                upload_id=raw.get("_nomad_upload_id"),
                entry_id=raw.get("_nomad_entry_id"),
                archive_url=raw.get("_nomad_archive_url"),
                program_name=raw.get("_nomad_program_name"),
                program_version=raw.get("_nomad_program_version"),
            )
        return GenericProviderMetadata(raw=raw)

    @classmethod
    def resolve_node(
        cls,
        node_id: str,
        *,
        info: Info,
        **kwargs: Any,
    ) -> Optional["Structure"]:
        provider, optimade_id = node_id.split("/", 1)
        base_url = PROVIDER_URLS.get(provider)
        if base_url is None:
            return None
        records = fetch_structures(
            f'id = "{optimade_id}"',
            max_results=1,
            base_urls=[base_url],
        )
        if not records:
            return None
        return _record_to_structure(records[0])

    @classmethod
    def resolve_nodes(
        cls,
        *,
        node_ids: Iterable[str],
        info: Info,
        required: bool = False,
        **kwargs: Any,
    ) -> Iterable[Optional["Structure"]]:
        return [cls.resolve_node(nid, info=info) for nid in node_ids]


# ── Relay connection types ─────────────────────────────────────────────────────

@strawberry.type
class PageInfo:
    has_next_page: bool
    end_cursor: Optional[str] = None


@strawberry.type
class StructureEdge:
    node: Structure
    cursor: str


@strawberry.type
class StructureConnection:
    edges: list[StructureEdge]
    page_info: PageInfo


# ── Warnings schema extension ──────────────────────────────────────────────────

class WarningsExtension(strawberry.extensions.SchemaExtension):
    def get_results(self) -> dict:
        ctx = self.execution_context.context
        if isinstance(ctx, dict):
            warnings = ctx.get("_warnings", [])
            if warnings:
                return {"warnings": warnings}
        return {}


# ── Helper functions ───────────────────────────────────────────────────────────

def _record_to_structure(record: dict) -> Structure:
    provider = record.get("provider", "unknown")
    optimade_id = record.get("id", "")
    node_id = f"{provider}/{optimade_id}"
    return Structure(
        node_id=node_id,
        _raw=record,
        provider=provider,
        elements=record.get("elements"),
        nelements=record.get("nelements"),
        chemical_formula_reduced=record.get("chemical_formula_reduced"),
        chemical_formula_hill=record.get("chemical_formula_hill"),
        nsites=record.get("nsites"),
        nperiodic_dimensions=record.get("nperiodic_dimensions"),
        dimension_types=record.get("dimension_types"),
    )


def _decode_cursor(cursor: str) -> int:
    """Cursor encodes the *next* offset as a base64 integer string."""
    try:
        return int(base64.b64decode(cursor.encode()).decode())
    except Exception:
        raise ValueError("invalid cursor")


def _encode_cursor(offset: int) -> str:
    return base64.b64encode(str(offset).encode()).decode()


# ── Root Query ─────────────────────────────────────────────────────────────────

@strawberry.type
class Query:
    @strawberry.field
    def structures(
        self,
        info: Info,
        filter: Optional[str] = None,
        providers: Optional[list[str]] = None,
        first: Optional[int] = None,
        after: Optional[str] = None,
    ) -> StructureConnection:
        if first is None:
            first = 10
        if first > 100:
            raise strawberry.exceptions.GraphQLError("first must be ≤ 100")
        if providers is None:
            providers = DEFAULT_PROVIDERS

        offset = 0
        if after is not None:
            try:
                offset = _decode_cursor(after)
            except ValueError:
                raise strawberry.exceptions.GraphQLError("invalid cursor")

        filter_str = filter or ""
        max_results = offset + first

        ctx = info.context if isinstance(info.context, dict) else {}
        warnings: list[str] = ctx.get("_warnings", [])

        # Resolve provider keys to URLs; warn for anything not in the registry
        valid_providers: list[tuple[str, str]] = []
        for p in providers:
            base_url = PROVIDER_URLS.get(p)
            if base_url is None:
                warnings.append(f"provider '{p}' is not configured and was skipped")
            else:
                valid_providers.append((p, base_url))

        # Fetch from all valid providers in parallel; collect per-provider warnings
        all_records: list[dict] = []

        def _fetch_one(base_url: str) -> list[dict]:
            return fetch_structures(filter_str, max_results=max_results, base_urls=[base_url])

        with ThreadPoolExecutor(max_workers=max(len(valid_providers), 1)) as executor:
            future_to_provider = {
                executor.submit(_fetch_one, url): p
                for p, url in valid_providers
            }
            for future in as_completed(future_to_provider):
                p = future_to_provider[future]
                try:
                    all_records.extend(future.result())
                except Exception as exc:
                    warnings.append(f"provider '{p}' unreachable: {exc}")

        page_records = all_records[offset : offset + first]

        edges: list[StructureEdge] = []
        for i, record in enumerate(page_records):
            structure = _record_to_structure(record)
            cursor = _encode_cursor(offset + i + 1)
            edges.append(StructureEdge(node=structure, cursor=cursor))

        has_next = len(page_records) == first
        end_cursor = edges[-1].cursor if edges else None

        return StructureConnection(
            edges=edges,
            page_info=PageInfo(has_next_page=has_next, end_cursor=end_cursor),
        )

    @strawberry.field
    def structure(self, info: Info, id: strawberry.ID) -> Optional[Structure]:
        try:
            type_name, raw_id = from_base64(id)
            if type_name != "Structure":
                raise ValueError("wrong type")
            provider, optimade_id = raw_id.split("/", 1)
        except Exception:
            raise strawberry.exceptions.GraphQLError("malformed id")

        ctx = info.context if isinstance(info.context, dict) else {}
        warnings: list[str] = ctx.get("_warnings", [])

        base_url = PROVIDER_URLS.get(provider)
        if base_url is None:
            return None

        try:
            records = fetch_structures(
                f'id = "{optimade_id}"',
                max_results=1,
                base_urls=[base_url],
            )
        except Exception as exc:
            warnings.append(f"provider '{provider}' unreachable: {exc}")
            return None

        if not records:
            return None

        return _record_to_structure(records[0])


# ── Schema and router ──────────────────────────────────────────────────────────

schema = strawberry.Schema(
    query=Query,
    types=[NomadMetadata, GenericProviderMetadata],
    extensions=[WarningsExtension],
)


async def _context_getter() -> dict:
    return {"_warnings": []}


graphql_router = GraphQLRouter(schema, context_getter=_context_getter)
