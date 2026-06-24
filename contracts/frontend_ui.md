# Contract: frontend_ui

## Overview

Standalone React + Relay application that queries the GraphQL layer
(`graphql_schema`) and displays OPTIMADE structure search results.

**Stack:** React 18, Relay, Vite, Tailwind CSS, shadcn/ui  
**Entry point:** `frontend/src/`  
**GraphQL endpoint:** FastAPI server at `/graphql`

---

## Directory layout

```
frontend/
  src/
    __generated__/          # Relay compiler output — do not edit
    components/
      ElementTile.jsx             # single periodic table cell
      PeriodicTableSelector.jsx
      FilterBar.jsx
      StructureCard.jsx
      StructureList.jsx
      StructureDetailPanel.jsx
    pages/
      StructuresPage.jsx    # root query + layout
    relay/
      environment.js        # Relay Environment singleton
    data/
      elementData.json      # element grid data (Apache 2.0, adapted from NOMAD GUI)
  package.json
  relay.config.js
  vite.config.js
```

---

## Relay Environment

**File:** `frontend/src/relay/environment.js`

**Postconditions:**
- Exports a single `RelayEnvironment` instance (module-level singleton)
- Network layer sends POST requests to `/graphql` with `{ query, variables }` JSON body
- No authentication headers required (public endpoint)
- `extensions.warnings` from the GraphQL response are logged to `console.warn`
  but do not cause the network layer to reject the response

---

## PeriodicTableSelector

**File:** `frontend/src/components/PeriodicTableSelector.jsx`

**Attribution:** SVG grid layout and `elementData.json` adapted from NOMAD GUI
(`gui/src/components/search/input/InputPeriodicTable.js`), Apache License 2.0.
Original statistics/aggregation features and NOMAD search context coupling
are not included.

**Data file modifications (`elementData.json`):**
- Element 119 (Uue / Ununennium) is removed. It is a hypothetical undiscovered
  element with no experimental data in any materials database and no valid
  search results; including it is misleading.
- Lanthanide `ypos` remapped 9 → 8; actinide `ypos` remapped 10 → 9.
  The upstream file used ypos 9/10 for f-block rows, but the layout formula
  expects 8/9. Remapping the data avoids changing the formula and keeps the
  code correct as originally written.

**Props:**
```ts
selectedElements: Set<string>           // chemical symbol strings, e.g. {"Fe","O"}
onSelectionChange: (next: Set<string>) => void
mode: 'has_all' | 'has_any' | 'exact'
onModeChange: (mode: 'has_all' | 'has_any' | 'exact') => void
```

**Preconditions:**
- `selectedElements` contains only valid chemical symbol strings present in
  `elementData.json`
- `mode` is one of the three defined string literals

**Postconditions:**
- Renders a grid of 118 `ElementTile` components laid out by `xpos`/`ypos`
  from `elementData.json`; grid fills its container width
- Container uses `aspect-ratio: 18 / 9.5` (not the padding-bottom trick);
  `position: relative` on the container with tiles absolutely positioned inside
- Clicking an unselected tile adds its symbol to `selectedElements` and calls
  `onSelectionChange` with the new set
- Clicking a selected tile removes its symbol and calls `onSelectionChange`
  with the new set
- **Placeholder tiles** at `(xpos=3, ypos=6)` and `(xpos=3, ypos=7)` — the
  visual gaps between Ba→Hf and Ra→Rf respectively — render `*` and `**`.
  They are non-interactive (no `onClick`, no hover state, no category background;
  rendered in muted gray)
- **F-block row labels** appear at the left edge of the lanthanide row (ypos=8)
  and actinide row (ypos=9), reading `* lanthanides` and `** actinides`.
  Labels are positioned absolutely, aligned to the left of those rows.
- **Category legend** is rendered below the table: a flex-wrap row of swatches,
  one per category present in `CATEGORY_BG`, each showing the category pastel
  color and its human-readable label
- A segmented control (toggle button group) renders the three modes with labels:
  - `has_all` → "Contains all"
  - `has_any` → "Contains any"
  - `exact`   → "Exactly these"
- Changing the mode calls `onModeChange`; does not reset `selectedElements`
- When `selectedElements` is empty the mode control is rendered but has no effect
  on the filter string produced by `FilterBar`

**Error conditions:**
- Unknown symbol in `selectedElements`: ignored (no tile highlighted)

---

## ElementTile

**File:** `frontend/src/components/ElementTile.jsx`

**Purpose:** Single cell in the periodic table grid. Owns its hover state
internally. Communicates selection via ring (inset box-shadow) thickness rather
than background color change, so the category pastel is always visible.

**Props:**
```ts
symbol: string              // chemical symbol, e.g. "Fe"
name: string                // full element name, e.g. "Iron"
atomicNumber: number        // e.g. 26
atomicWeight: number        // e.g. 55.845
category: string            // key into CATEGORY_BG; unknown → bg-gray-50
selected: boolean
onClick: () => void
style: React.CSSProperties  // absolute-position coordinates supplied by parent
```

**Visual states:**

| Hovered | Selected | Ring               | Signal to user      |
|---------|---------|--------------------|---------------------|
| no      | no      | none               | idle                |
| yes     | no      | 2 px, blue-400     | will select         |
| no      | yes     | 4 px, blue-600     | selected            |
| yes     | yes     | 2 px, blue-500     | will deselect       |

The hover-over-selected ring (2 px) is intentionally thinner than the selected
ring (4 px): the reduction in thickness signals that clicking will deselect.

Rings are implemented via Tailwind `ring-*` utilities (inset box-shadow). Ring
thickness changes produce no layout shift because the ring sits inside the border
box and the tile is absolutely positioned.

**Hover detail:**
- The tile renders only the chemical symbol at all times.
- On hover, a Radix UI `<Tooltip>` displays a floating card containing:
  - Element name (e.g. "Iron")
  - Atomic number (e.g. "Z = 26")
  - Atomic weight (e.g. "55.845 u")
- Tooltip `delayDuration` is set to 300 ms.

**Postconditions:**
- `onClick` is called on pointer click
- `title` attribute is set to the element name (screen reader / OS tooltip fallback)
- Category background pastel is always applied; it is never replaced by a
  selection-state color

**Explicitly deferred — disabled state:**
Greying out elements that would return zero results for the current selection
was considered and rejected for this pass. Implementing it requires a backend
aggregation endpoint that returns per-element result counts — that endpoint does
not exist in the current GraphQL schema. Do not add a `disabled` prop or any
count-based visual logic to `ElementTile` until that endpoint is built.

**Error conditions:**
- Unknown `category` string: tile background defaults to `bg-gray-50`

---

## FilterBar

**File:** `frontend/src/components/FilterBar.jsx`

**Purpose:** Owns the element selection state and derives the OPTIMADE filter
string passed down to `StructuresPage`.

**Postconditions:**
- Renders `PeriodicTableSelector` with controlled state
- Derives an OPTIMADE filter string from `selectedElements` and `mode`:

  | mode      | selectedElements | filter string                                           |
  |-----------|-----------------|----------------------------------------------------------|
  | `has_all` | {Fe, O}          | `elements HAS ALL "Fe","O"`                             |
  | `has_any` | {Fe, O}          | `elements HAS ANY "Fe","O"`                             |
  | `exact`   | {Fe, O}          | `elements HAS ALL "Fe","O" AND elements HAS ONLY "Fe","O"` |
  | any       | empty            | `""` (empty string — no filter)                         |

- Element symbols in the filter string are sorted alphabetically.
  Code must include a comment explaining this is intentional: alphabetical
  order ensures identical selections always produce identical filter strings,
  making query deduplication and caching reliable.
- `onFilterChange` is **not** called on every element click or mode change.
  The federation backend makes external OPTIMADE network calls; firing a query
  on every interaction would produce wasted in-flight requests and a confusing
  loading state while the user is still building their selection.
- A **"Search" button** is rendered alongside the mode toggle. Clicking it calls
  `onFilterChange(filterString)` with the current derived filter string.
- The **Clear button** (visible when `selectedElements` is non-empty) resets
  `selectedElements` to empty and calls `onFilterChange("")` immediately, without
  requiring a separate Search click. Clearing is always an unambiguous intent.
- Selection and mode state update immediately on interaction (visual feedback via
  `PeriodicTableSelector` and `ElementTile` is instant); only the query is deferred.
- Prop: `onFilterChange: (filter: string) => void`

**Test note:** Existing `FilterBar` tests assert that `onChange` is called after
each element click. Those tests must be updated: after clicking elements, tests
must also click the Search button before asserting that `onFilterChange` was called.
The Clear button tests remain valid as-is (Clear fires immediately).

---

## GraphQL fragments and queries

### StructureCard_structure (fragment)

```graphql
fragment StructureCard_structure on Structure {
  id
  provider
  chemicalFormulaReduced
  chemicalFormulaHill
  elements
  nelements
  nsites
  lastModified
  providerMetadata {
    ... on NomadMetadata {
      entryId
      archiveUrl
    }
  }
}
```

### StructuresQuery (root query)

```graphql
query StructuresQuery(
  $filter: String
  $first: Int
  $after: String
  $providers: [String!]
) {
  structures(filter: $filter, first: $first, after: $after, providers: $providers) {
    edges {
      node {
        ...StructureCard_structure
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### StructureDetail_structure (fragment)

```graphql
fragment StructureDetail_structure on Structure {
  id
  provider
  chemicalFormulaReduced
  chemicalFormulaHill
  elements
  nelements
  nsites
  nperiodicDimensions
  dimensionTypes
  lastModified
  latticeVectors
  cartesianSitePositions
  spaceGroupSymbol
  spaceGroupItNumber
  species
  speciesAtSites
  providerMetadata {
    ... on NomadMetadata {
      entryId
      archiveUrl
      programName
      programVersion
    }
    ... on GenericProviderMetadata {
      raw
    }
  }
}
```

### StructureDetailQuery (standalone query)

```graphql
query StructureDetailQuery($id: ID!) {
  structure(id: $id) {
    ...StructureDetail_structure
  }
}
```

---

## StructureCard

**File:** `frontend/src/components/StructureCard.jsx`

**Props:**
```ts
structure: FragmentRef<StructureCard_structure>
onClick: () => void
```

**Postconditions:**
- Renders the Identity cluster: provider badge, formula (reduced or Hill),
  `nelements`, `nsites`
- Renders element chips for each entry in `elements`
- Renders `lastModified` as a localised date string when present
- Renders a "View in [provider]" external link:
  - For NOMAD: constructed as
    `https://nomad-lab.eu/prod/v1/gui/search/entries/entry/id/{entryId}`
    using `NomadMetadata.entryId` directly (not parsed from the Relay global
    `id` — the Relay ID encodes `provider/optimade_id` and must not be used
    here). URL pattern confirmed against a live NOMAD record. If `entryId`
    is null, the link is omitted.
  - Known edge case: some NOMAD entry IDs may carry a `---` prefix in certain
    OPTIMADE responses; if the link does not resolve, strip any leading `---`
    before the UUID. Treat as a runtime finding and fix when encountered.
  - For other providers: omitted (no generic URL pattern defined yet)
- Clicking anywhere on the card except the external link calls `onClick`

---

## StructureList

**File:** `frontend/src/components/StructureList.jsx`

**Props:**
```ts
structures: FragmentRef<...>   // connection fragment ref from StructuresQuery
onSelectStructure: (id: string) => void
```

**Postconditions:**
- Renders a list of `StructureCard` components, one per edge in the connection
- Uses Relay `usePaginationFragment` to manage cursor pagination
- Renders a sentinel `<div>` at the bottom of the list; an `IntersectionObserver`
  on that sentinel calls `loadNext(10)` when it enters the viewport
- `loadNext` is not called while a previous fetch is in flight
  (`isLoadingNext` guard)
- When the connection is empty, renders a "No results" message
- When `hasNextPage` is false, sentinel is not rendered

---

## StructureDetailPanel

**File:** `frontend/src/components/StructureDetailPanel.jsx`

**Props:**
```ts
structureId: string | null    // global Relay ID; null means panel is closed
onClose: () => void
```

**Postconditions:**
- Implemented using shadcn/ui `Sheet` (slides in from the right)
- When `structureId` is null, panel is closed
- When `structureId` is non-null, issues `StructureDetailQuery` via Relay
  `useQueryLoader` + `usePreloadedQuery` (not `useLazyLoadQuery`, which is
  deprecated) and renders the full structure record
- Renders all clusters present in `StructureDetail_structure`:
  - Identity: provider, formula, lastModified
  - Composition: elements, nelements, nsites
  - Geometry: lattice vectors table, Cartesian site positions (if present)
  - Symmetry: space group symbol and number (if present)
  - Sites: species and species-at-sites (if present)
  - Provider metadata: NOMAD-specific fields (programName, programVersion,
    archiveUrl) in a collapsible section; raw JSON fallback for
    GenericProviderMetadata
- "View in NOMAD" link rendered prominently when `entryId` is present
- If `StructureDetailQuery` returns null (record not found or provider
  unreachable), renders an error message rather than an empty panel
- GraphQL `extensions.warnings` (provider unreachable, etc.) are rendered
  as an inline notice at the top of the panel

---

## StructuresPage

**File:** `frontend/src/pages/StructuresPage.jsx`

**Postconditions:**
- Renders `FilterBar` and `StructureList` in a single-column layout
- Owns `selectedStructureId: string | null` state; passes it to
  `StructureDetailPanel`
- Passes `onSelectStructure` to `StructureList`; sets `selectedStructureId`
  on selection
- Passes `onClose` to `StructureDetailPanel`; clears `selectedStructureId`
- Re-issues `StructuresQuery` when `FilterBar` calls `onFilterChange`;
  resets pagination to the first page on filter change
- Default query on first load: empty filter (`""`) with `first: 10`

---

## Error and warning surfaces

- **GraphQL errors** (malformed query, schema error): rendered as a full-page
  error banner; not silently swallowed
- **Provider warnings** (`extensions.warnings`): rendered as a dismissible
  inline notice within the panel or list that triggered them; do not block
  the rest of the UI
- **Network failure** (fetch throws): rendered as an error banner with a
  retry button
