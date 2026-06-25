# Contract: Page Layout

## Overview

**Primary file:** `frontend/src/pages/StructuresPage.jsx`

Supersedes the `StructuresPage` postcondition in `contracts/frontend_ui.md`
(single-column layout). All other sections of `frontend_ui.md` remain in
effect.

The application has one page: `StructuresPage`. It renders a two-column
sidebar layout: `FilterPanel` occupies the left column; the results pane
occupies the right. `StructureDetailPanel` (Sheet) overlays from the right
edge and is unchanged in behaviour.

---

## Two-column structure

```
┌──────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │              │  │                                  │  │
│  │ FilterPanel  │  │        Results pane              │  │
│  │  (≈ 1/3)    │  │  (StructureList / empty state)   │  │
│  │              │  │        (≈ 2/3)                   │  │
│  │ [scrollable] │  │  [scrollable, independent]       │  │
│  │              │  │                                  │  │
│  └──────────────┘  └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

                                          ┌─────────────────┐
                                          │ StructureDetail │  ← Sheet slides
                                          │     Panel       │    in from right
                                          └─────────────────┘
```

**Column sizing:** approximately one-third / two-thirds of the viewport
width. Exact widths are an implementation detail; a Tailwind `w-80` (fixed)
or `w-1/3` (fractional) for the filter column and `flex-1` for the results
column are both acceptable. The filter column must be wide enough to
accommodate the periodic table at a legible size.

**No responsive breakpoints** are defined in this pass. The layout is
designed for desktop / wide viewport use; behaviour on narrow screens is
unspecified.

---

## FilterPanel column

- Renders `FilterPanel` at full height of the viewport, aligned to the top.
- Overflows vertically with its own scroll (`overflow-y: auto`) so that a
  long filter list does not push the results pane or cause page-level scroll.
- Has a visible right border or subtle background distinction from the
  results pane to demarcate the two regions.
- Width is fixed; it does not resize when `StructureDetailPanel` opens.

---

## Results pane

- Renders `StructureList` when a query has been submitted and results are
  available.
- Has its own independent vertical scroll.
- **Initial state (no query submitted):** renders a prompt in place of
  `StructureList`:
  > *Enter filters and click Search to find structures.*
  - This is the state on first render and after Reset click.
  - "No structures found" is a separate state produced by `StructureList`
    when a query returns zero edges; it is not the same as the no-query
    state.
- When a query is in flight, `StructureList` renders its own loading state
  (Relay Suspense fallback); the results pane does not add an additional
  loading overlay.

---

## StructuresPage state and wiring

**State owned by StructuresPage:**

| Field | Type | Default | Purpose |
|---|---|---|---|
| `filterString` | `string \| null` | `null` | Current active OPTIMADE filter; `null` = no query submitted |
| `selectedStructureId` | `string \| null` | `null` | Relay global ID of the open detail panel; `null` = closed |

**Postconditions:**

- `FilterPanel` receives `onFilterChange` and `onReset`.
  - `onFilterChange(filter)` sets `filterString` to the new value, resets
    pagination to the first page (`after: null`), triggers a fresh
    `StructuresQuery`, and closes any open `StructureDetailPanel` (sets
    `selectedStructureId → null`).
  - `onReset()` sets `filterString → null` (returns to the no-query prompt)
    and closes any open `StructureDetailPanel` (sets
    `selectedStructureId → null`). Does NOT trigger a new query.
- When `filterString` is `null`, `StructureList` is not rendered; the
  no-query prompt is shown instead.
- When `filterString` is `""` (empty string, produced only by Search click
  with all fields empty), a query IS issued with no filter constraint (all
  results). This is distinct from `null`.
- `StructureList` receives `onSelectStructure`; calling it sets
  `selectedStructureId`.
- `StructureDetailPanel` receives `structureId={selectedStructureId}` and
  `onClose`; `onClose` sets `selectedStructureId` to `null`.
- Pagination events (IntersectionObserver-triggered `loadNext`) do **not**
  close an open `StructureDetailPanel`; scrolling through results does not
  disturb the panel.

---

## StructureDetailPanel overlay

- The Sheet slides in from the right edge of the viewport, overlaying the
  results pane. It does not shift or resize the two-column layout.
- Behaviour is unchanged from the existing `StructureDetailPanel` contract
  in `frontend_ui.md`.

---

## No-query vs. empty-results distinction

| Condition | `filterString` | Display |
|---|---|---|
| Initial render / after Reset click | `null` | *"Enter filters and click Search…"* prompt in results pane |
| Search clicked, all fields empty | `""` | `StructureList` renders with no filter; may show results or "No structures found" |
| Search clicked, filters set, zero edges returned | non-empty string | `StructureList` renders "No structures found" |

---

## Deferred features

The **Saved tab** (a persistent list of user-selected structures, independent
of search state) is a planned extension to `StructuresPage`. See
`contracts/deferred_features.md` for its full design. It is not part of this
contract's implementation scope.

---

## frontend_ui.md amendment

The `StructuresPage` postcondition in `frontend_ui.md` that reads:

> *"Renders FilterBar and StructureList in a single-column layout"*
> *"Default query on first load: empty filter ("") with first: 10"*

is replaced by this contract. All other postconditions in that section
(selectedStructureId state, onSelectStructure, onClose, re-issue on
filterChange) remain in effect as written, subject to the clarifications
above.
