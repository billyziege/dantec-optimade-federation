# DANTEc OPTIMADE Federation

A provider-agnostic [OPTIMADE](https://www.optimade.org/) federation layer that
aggregates materials-structure search across multiple OPTIMADE endpoints and
exposes the result through a GraphQL API with an interactive React frontend.

Currently configured provider: **NOMAD** (`https://nomad-lab.eu/prod/v1/optimade`).
The architecture supports adding further OPTIMADE-compliant endpoints with minimal
effort (see [Adding a provider](#adding-a-provider)).

This is a [DANTEc](https://dantec.eu/) / University of West Bohemia (UWB) deliverable.
It serves as the discovery layer that links computational materials data (NOMAD
structures) to experimental research activities recorded in the DANTEc InvenioRDM
repository.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Browser  (React + Relay + Tailwind)                 │
│  Vite dev server  :5173  →  proxy /graphql → :8000  │
└──────────────┬───────────────────────────────────────┘
               │ GraphQL  POST /graphql
┌──────────────▼───────────────────────────────────────┐
│  FastAPI + Strawberry  :8000                         │
│  Parallel provider fetch via ThreadPoolExecutor      │
└──────────────┬───────────────────────────────────────┘
               │ OPTIMADE REST
┌──────────────▼───────────────────────────────────────┐
│  OPTIMADE provider(s)  (NOMAD, …)                    │
└──────────────────────────────────────────────────────┘
```

| Layer | Stack |
|-------|-------|
| Backend | Python 3.13, FastAPI, Strawberry GraphQL, `optimade[client]` |
| Frontend | React 18, Relay, Vite, Tailwind CSS |
| Testing | pytest (backend), Vitest + React Testing Library (frontend) |

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Python | 3.13 | `.python-version` pins this; use `pyenv` or `uv` |
| [uv](https://docs.astral.sh/uv/) | any recent | recommended Python package manager |
| Node.js | 18+ | |
| npm | 9+ | bundled with Node.js |

---

## Installation

Clone the repository, then set up the backend and frontend separately.

### Backend

```bash
# From the repo root
uv sync
```

This creates `.venv/` and installs all Python dependencies from `uv.lock`.

### Frontend

```bash
cd frontend
npm install
```

---

## Running the application

The frontend Vite dev server proxies all `/graphql` requests to the backend
(`http://localhost:8000`), so **both processes must be running simultaneously**.

### 1 — Start the backend

```bash
# From the repo root
source .venv/bin/activate
uvicorn dantec_optimade.app:app --reload
```

The API is now available at `http://localhost:8000`.  
The Strawberry GraphiQL explorer is at `http://localhost:8000/graphql`.

### 2 — Start the frontend (separate terminal)

```bash
cd frontend
npm run dev
```

The application is now available at `http://localhost:5173`.

---

## Configuration

| Environment variable | Default | Description |
|----------------------|---------|-------------|
| `OPTIMADE_HTTP_TIMEOUT` | `5.0` | Seconds before an OPTIMADE provider request times out |

---

## Running tests

### Backend

```bash
source .venv/bin/activate
pytest
```

88 tests covering the OPTIMADE client, RavenDB data access layer, and GraphQL
schema resolvers.

### Frontend

```bash
cd frontend
npm test
```

42 tests covering the Relay environment, Relay query resolution, component
rendering, interaction behaviour (filter derivation, element selection), and
the warning store.

---

## Building for production

```bash
cd frontend

# 1. Compile Relay query artifacts (required before every build)
npm run relay

# 2. Build the static bundle
npm run build
```

The compiled output is written to `frontend/dist/`.  To serve it, configure
your web server to route all requests to `index.html` (standard SPA pattern)
and proxy `/graphql` to the backend.

---

## Adding a provider

1. Add an entry to `PROVIDER_URLS` in
   `src/dantec_optimade/graphql_schema.py`:

   ```python
   PROVIDER_URLS: dict[str, str] = {
       "nomad": "https://nomad-lab.eu/prod/v1/optimade",
       "my_provider": "https://my-provider.example.com/optimade",
   }
   ```

2. Optionally add a typed `ProviderMetadata` subclass (analogous to
   `NomadMetadata`) and wire it into the `Structure.provider_metadata`
   resolver.  Generic JSON fallback (`GenericProviderMetadata`) is used
   automatically for any provider without a typed implementation.

3. Add the new key to `DEFAULT_PROVIDERS` if it should be queried by default.

---

## GraphQL schema overview

```graphql
type Query {
  structures(
    filter: String     # OPTIMADE filter string, e.g. 'elements HAS ALL "Fe","O"'
    providers: [String!]
    first: Int         # page size, max 100
    after: String      # Relay cursor
  ): StructureConnection!

  structure(id: ID!): Structure  # fetch a single record by Relay global ID
}
```

The schema uses the [Relay cursor-connection spec](https://relay.dev/graphql/connections.htm).
Provider-level warnings (timeouts, unknown providers, etc.) are returned in
`extensions.warnings` on the GraphQL response.

---

## Project structure

```
.
├── contracts/                 # Design contracts (source of truth for implementation)
│   ├── frontend_ui.md
│   ├── graphql_schema.md
│   ├── optimade_client.md
│   └── raven_data_access.md
├── src/
│   └── dantec_optimade/
│       ├── app.py             # FastAPI application entry point
│       ├── graphql_schema.py  # Strawberry schema, resolvers, provider registry
│       ├── optimade_client.py # OPTIMADE REST client wrapper
│       └── raven_data_access.py  # RavenDB access layer (future DANTEc provider)
├── tests/                     # Backend pytest suite
├── frontend/
│   ├── src/
│   │   ├── components/        # React components (FilterBar, PeriodicTableSelector, …)
│   │   ├── pages/             # Top-level page components
│   │   ├── relay/             # Relay environment
│   │   ├── lib/               # Utilities and state stores
│   │   └── __tests__/         # Vitest test suite
│   ├── schema.graphql         # GraphQL schema (consumed by Relay compiler)
│   └── relay.config.json
├── DEFERRED.md                # Deferred design ideas with reasoning
├── pyproject.toml
└── uv.lock
```

---

## License

This project is part of the [DANTEc](https://dantec.eu/) consortium infrastructure.
Licensing terms to be determined by the consortium.

---

## Contact

Brandon S. Zerbe — brandon.s.zerbe@gmail.com  
University of West Bohemia, DANTEc / UWB deliverable
