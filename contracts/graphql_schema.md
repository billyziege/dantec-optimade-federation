# Contract: graphql_schema

## Overview

This contract covers the GraphQL schema layer that sits above `optimade_client` and
`raven_data_access`. It defines:

- The GraphQL schema (SDL + Strawberry implementation mapping)
- Type cluster decomposition (Identity, Composition, Geometry, Symmetry, Sites)
- ProviderMetadata interface with typed implementations
- Relay Connection/Edge pagination
- Cache-aside resolver behaviour
- FastAPI mount

**Stack:** FastAPI + Strawberry (GraphQL) mounted at `/graphql`, React + Relay compiler
on the client side.

**Relay requirement:** All types returned by paginated queries must implement the Relay
`Node` interface (global `id: ID!`). Connections use `first` / `after` cursor pagination.

---

## SDL

```graphql
scalar JSON
scalar DateTime

interface Node {
  id: ID!
}

# ── Structure type ────────────────────────────────────────────────────────────
#
# Fields are grouped into five clusters. Cluster membership determines which
# OPTIMADE fields are fetched and which Relay fragments are co-located on the
# client. Heavy clusters (Geometry, Sites) are only resolved when explicitly
# requested.

type Structure implements Node {
  # Identity cluster — always resolved; never null after the record exists
  id:           ID!
  provider:     String!
  lastModified: DateTime

  # Composition cluster — cheap; returned by all OPTIMADE queries
  elements:                [String!]
  nelements:               Int
  chemicalFormulaReduced:  String
  chemicalFormulaHill:     String
  nsites:                  Int
  nperiodicDimensions:     Int
  dimensionTypes:          [Int!]

  # Geometry cluster — expensive; fetch only when requested
  latticeVectors:            [[Float!]!]
  cartesianSitePositions:    [[Float!]!]

  # Symmetry cluster — available when the provider includes symmetry data
  spaceGroupSymbol:    String
  spaceGroupItNumber:  Int

  # Sites cluster — expensive; fetch only when requested
  species:         JSON
  speciesAtSites:  [String!]

  # Provider-specific metadata (typed or generic)
  providerMetadata: ProviderMetadata
}

# ── ProviderMetadata interface ────────────────────────────────────────────────

interface ProviderMetadata {
  raw: JSON!
}

type NomadMetadata implements ProviderMetadata {
  raw:            JSON!
  uploadId:       String
  entryId:        String
  archiveUrl:     String
  programName:    String
  programVersion: String
}

type GenericProviderMetadata implements ProviderMetadata {
  raw: JSON!
}

# ── Relay Connection/Edge ──────────────────────────────────────────────────────

type StructureEdge {
  node:   Structure!
  cursor: String!
}

type StructureConnection {
  edges:    [StructureEdge!]!
  pageInfo: PageInfo!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor:   String
}

# ── Root query ─────────────────────────────────────────────────────────────────

type Query {
  structures(
    filter:    String
    providers: [String!]
    first:     Int
    after:     String
  ): StructureConnection!

  structure(id: ID!): Structure
}
```

---

## Strawberry implementation mapping

| SDL construct | Strawberry construct |
|---|---|
| `scalar JSON` | `strawberry.scalar(Any, name="JSON")` or `strawberry.scalars.JSON` |
| `scalar DateTime` | `strawberry.scalar(datetime, name="DateTime")` |
| `interface Node` | `strawberry.relay.Node` (use built-in; provides global `id`) |
| `type Structure implements Node` | `@strawberry.type` + `strawberry.relay.NodeID` on `id` |
| `interface ProviderMetadata` | `@strawberry.interface` |
| `type NomadMetadata implements ProviderMetadata` | `@strawberry.type` |
| `type GenericProviderMetadata implements ProviderMetadata` | `@strawberry.type` |
| `StructureConnection` / `StructureEdge` | `strawberry.relay.Connection[Structure]` |
| `type Query` | `@strawberry.type` passed to `strawberry.Schema(query=Query)` |
| FastAPI mount | `app.include_router(strawberry.fastapi.GraphQLRouter(schema), prefix="/graphql")` |

**Global ID encoding:** Strawberry's `strawberry.relay.Node` encodes `id` as
`base64("Structure:<provider>/<optimade_id>")`. The resolver decodes this to recover
`provider` and `optimade_id` when resolving `structure(id: ID!)`.

**ProviderMetadata dispatch:** The `providerMetadata` field resolver inspects
`record["provider"]` and returns `NomadMetadata` when `provider == "nomad"`,
`GenericProviderMetadata` otherwise. Future providers (e.g. `"dantec"`) add a new
`@strawberry.type` implementation; no existing resolver changes.

---

## Type contracts

### Structure

**Identity cluster:**
- `id`: global Relay ID, never null; encodes `provider` + OPTIMADE `id`
- `provider`: the string key of the source provider (e.g. `"nomad"`); derived from
  the base URL used to fetch the record
- `lastModified`: ISO-8601 datetime string from OPTIMADE `last_modified`; may be null
  if the provider omits it

**Composition cluster:**
- All fields sourced from OPTIMADE `attributes`; may be null if the provider omits them
- `elements`: list of capitalised element symbol strings (e.g. `["Fe", "O"]`)
- `nelements`: equals `len(elements)` when both are present
- `dimensionTypes`: list of 0/1 integers, length == 3

**Geometry cluster (heavy):**
- `latticeVectors`: 3×3 matrix of floats in Ångström; null for non-periodic structures
  (`nperiodicDimensions == 0`)
- `cartesianSitePositions`: N×3 matrix of floats in Ångström; N == `nsites`
- These fields are fetched from OPTIMADE only when present in the query; the resolver
  does not request them from the provider if they are absent from the selection set

**Symmetry cluster:**
- `spaceGroupSymbol`: Hermann–Mauguin symbol string; null when provider omits it
- `spaceGroupItNumber`: International Tables number 1–230; null when provider omits it

**Sites cluster (heavy):**
- `species`: raw JSON list of OPTIMADE species objects; structure is provider-defined
- `speciesAtSites`: list of species label strings, length == `nsites`
- Fetched from OPTIMADE only when present in the selection set

**ProviderMetadata:**
- `NomadMetadata.raw`: the full OPTIMADE response `attributes` dict for this record
- `NomadMetadata.uploadId`, `entryId`, `archiveUrl`: extracted from NOMAD-specific
  attributes; null if absent
- `GenericProviderMetadata.raw`: the full OPTIMADE `attributes` dict

### StructureConnection

- `edges`: may be empty (`[]`) when no records match the filter; never null
- `pageInfo.hasNextPage`: true when the OPTIMADE provider returned exactly `first`
  records (i.e. there may be more); false otherwise
- `pageInfo.endCursor`: the cursor of the last edge; null when `edges` is empty
- Cursors are opaque to the client; the server encodes pagination state in them

---

## Query contracts

### `structures(filter, providers, first, after)`

**Preconditions:**
- `filter`: a syntactically valid OPTIMADE filter string, or null/omitted (matches all)
- `providers`: list of provider key strings (e.g. `["nomad"]`); when null/omitted,
  defaults to `["nomad"]`
- `first`: positive integer ≤ 100; when null/omitted, defaults to 10
- `after`: an opaque cursor string from a prior `pageInfo.endCursor`; null for the
  first page

**Postconditions:**
- Returns a `StructureConnection` (never null; edges may be empty)
- Every edge's `node` satisfies all Identity cluster field contracts
- Composition cluster fields are populated when the provider returns them
- Heavy cluster fields (`latticeVectors`, `cartesianSitePositions`, `species`,
  `speciesAtSites`) are populated only when requested in the selection set
- Records from all listed providers are merged into a single edge list
- The `provider` field on each `Structure` identifies its source

**Error conditions:**
- Invalid OPTIMADE filter string: raises `GraphQLError` with message from
  `OptimadeClient`; no partial results returned
- Provider unreachable: that provider's results are omitted; remaining providers'
  results are returned; a non-fatal warning is added to `extensions.warnings`
- `first` > 100: raises `GraphQLError("first must be ≤ 100")`
- Invalid `after` cursor: raises `GraphQLError("invalid cursor")`

---

### `structure(id: ID!)`

**Preconditions:**
- `id` is a valid global Relay ID of type `Structure`

**Postconditions:**
- Returns the `Structure` node if found in RavenDB cache or reachable from the provider
- Returns `null` if not found anywhere (not an error)

**Error conditions:**
- Malformed global ID (not decodable): raises `GraphQLError("malformed id")`

---

## Cache-aside resolver behaviour

The resolver for `structures` uses a **record-level, lazy-loading cache** in RavenDB
keyed by the OPTIMADE `id` field.

**For the `structures` query:**
1. Call `optimade_client.fetch_structures(filter, base_urls=...)` to get a page of
   flat records from the provider
2. For each record: call `raven_client.get_document(record["id"])`
   - Cache hit: merge cached supplementary data over the live record (cached data
     wins for any key it provides)
   - Cache miss: call `raven_client.insert_single_document(record)` to populate the
     cache; use the live record
3. Return the merged records as `Structure` nodes

**For the `structure(id)` query:**
1. Decode the global ID to extract `provider` and `optimade_id`
2. Call `raven_client.get_document(optimade_id)`
   - Cache hit: return immediately without calling OPTIMADE
   - Cache miss: call `fetch_structures` with filter `id = "<optimade_id>"`, store
     result in RavenDB, return

**Heavy-cluster resolver behaviour:**
- `latticeVectors`, `cartesianSitePositions`, `species`, `speciesAtSites` are not
  included in the flat records returned by `fetch_structures` (which uses the
  default OPTIMADE response fields)
- When a client requests these fields, the resolver fetches the full OPTIMADE record
  via a single-ID filter query, caches it, and populates the heavy fields
- Strawberry lazy resolvers (`strawberry.lazy`) are used so this fetch only occurs
  when the field is in the client's selection set

---

## FastAPI integration contract

**Preconditions:**
- A `FastAPI()` app instance exists
- A `RavenDBClient` instance and one or more OPTIMADE base URLs are configured
  (via environment variables or constructor injection)

**Mount:**
```python
schema = strawberry.Schema(query=Query)
graphql_router = GraphQLRouter(schema)
app.include_router(graphql_router, prefix="/graphql")
```

**Postconditions:**
- `GET /graphql` serves the GraphiQL IDE in development mode
- `POST /graphql` accepts JSON body `{"query": "...", "variables": {...}}` and returns
  `{"data": {...}}` or `{"errors": [...]}` per the GraphQL-over-HTTP spec
- The Strawberry schema is constructed once at startup; resolvers share a single
  `RavenDBClient` instance via dependency injection or module-level singleton

---

## Examples

All examples are self-contained GraphQL operation strings with expected response shapes.

### 1. Composition-only search (lightweight)

```graphql
query IronStructures {
  structures(filter: "elements HAS \"Fe\"", first: 3) {
    edges {
      node {
        id
        provider
        elements
        nelements
        chemicalFormulaReduced
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

Expected shape:
```json
{
  "data": {
    "structures": {
      "edges": [
        {
          "node": {
            "id": "U3RydWN0dXJlOm5vbWFkL...",
            "provider": "nomad",
            "elements": ["Fe", "O"],
            "nelements": 2,
            "chemicalFormulaReduced": "FeO"
          }
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "endCursor": "Y3Vyc29yOjM="
      }
    }
  }
}
```

---

### 2. Detail view with geometry (heavy clusters)

```graphql
query StructureDetail($id: ID!) {
  structure(id: $id) {
    id
    provider
    chemicalFormulaHill
    nsites
    latticeVectors
    cartesianSitePositions
    spaceGroupSymbol
    spaceGroupItNumber
  }
}
```

Expected shape:
```json
{
  "data": {
    "structure": {
      "id": "U3RydWN0dXJlOm5vbWFkL...",
      "provider": "nomad",
      "chemicalFormulaHill": "Fe2O3",
      "nsites": 10,
      "latticeVectors": [[5.03, 0.0, 0.0], [0.0, 5.03, 0.0], [0.0, 0.0, 13.75]],
      "cartesianSitePositions": [[0.0, 0.0, 0.0], "..."],
      "spaceGroupSymbol": "R-3c",
      "spaceGroupItNumber": 167
    }
  }
}
```

---

### 3. Cursor pagination (second page)

```graphql
query Page2($cursor: String!) {
  structures(filter: "nelements = 2", first: 5, after: $cursor) {
    edges {
      node {
        id
        chemicalFormulaReduced
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

`$cursor` is the `endCursor` value from the prior page response.

---

### 4. NOMAD-typed provider metadata

```graphql
query WithNomadMeta {
  structures(filter: "elements HAS \"Fe\"", first: 1) {
    edges {
      node {
        id
        providerMetadata {
          raw
          ... on NomadMetadata {
            uploadId
            entryId
            archiveUrl
            programName
          }
        }
      }
    }
  }
}
```

Expected shape when provider is NOMAD:
```json
{
  "data": {
    "structures": {
      "edges": [
        {
          "node": {
            "id": "U3RydWN0dXJlOm5vbWFkL...",
            "providerMetadata": {
              "raw": { "...": "full OPTIMADE attributes dict" },
              "uploadId": "abc123",
              "entryId": "def456",
              "archiveUrl": "https://nomad-lab.eu/prod/v1/api/v1/entries/def456/archive",
              "programName": "VASP"
            }
          }
        }
      ]
    }
  }
}
```

---

### 5. Unknown provider (generic metadata fallback)

```graphql
query GenericMeta {
  structures(providers: ["some-other-provider"], first: 1) {
    edges {
      node {
        id
        providerMetadata {
          raw
          ... on NomadMetadata {
            uploadId
          }
        }
      }
    }
  }
}
```

Expected shape: `providerMetadata` resolves to `GenericProviderMetadata`; the
`... on NomadMetadata` fragment is not applied; `raw` contains the full attributes dict.

---

### 6. Provider unreachable (partial result + warning)

```graphql
query MultiProvider {
  structures(providers: ["nomad", "bad-provider"], first: 3) {
    edges {
      node { id provider }
    }
  }
}
```

Expected response: NOMAD edges are returned normally; `extensions.warnings` contains
a message about `"bad-provider"` being unreachable. The `errors` array is absent
(unreachable provider is not a fatal error).
