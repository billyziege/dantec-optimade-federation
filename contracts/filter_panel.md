# Contract: FilterPanel

**Supersedes:** the `FilterBar` section of `contracts/frontend_ui.md`.
The `FilterBar` component and its contract section are retired;
`FilterPanel` is the replacement.

---

## Overview

**File:** `frontend/src/components/FilterPanel.jsx`

`FilterPanel` owns all filter state and derives the combined OPTIMADE filter
string submitted to `StructuresPage`. It renders a vertical stack of filter
controls. All active field values are combined with AND before submission.
`PeriodicTableSelector` and `ElementTile` are unchanged and reused.

**Props:**
```ts
onFilterChange: (filter: string) => void   // called on Search click
onReset: () => void                         // called on Reset click
```

---

## State fields

| Field | Type | Default |
|---|---|---|
| `selectedElements` | `Set<string>` | empty |
| `mode` | `'has_all' \| 'has_any' \| 'exact'` | `'has_all'` |
| `tableExpanded` | `boolean` | `false` |
| `nPeriodicDimensions` | `Set<0\|1\|2\|3>` | empty |
| `nElementsMin` | `string` | `''` |
| `nElementsMax` | `string` | `''` |
| `nSitesMin` | `string` | `''` |
| `nSitesMax` | `string` | `''` |
| `formulaAnonymous` | `string` | `''` |
| `formulaReduced` | `string` | `''` |
| `spaceGroupItNumber` | `string` | `''` |
| `lastModifiedSince` | `string` | `''` |

---

## OPTIMADE filter string derivation

Each field independently produces zero or one OPTIMADE clause. All non-empty
clauses are joined with ` AND `. Fields at their default value produce no
clause and do not appear in the filter string.

### Elements (`selectedElements` + `mode`)

Element symbols are sorted alphabetically before insertion into the filter
string. Alphabetical ordering ensures identical selections always produce
identical filter strings, making query deduplication and Relay caching
reliable.

| `mode` | `selectedElements` | Clause produced |
|---|---|---|
| `has_all` | `{Fe, O}` | `elements HAS ALL "Fe","O"` |
| `has_any` | `{Fe, O}` | `elements HAS ANY "Fe","O"` |
| `exact` | `{Fe, O}` | `elements HAS ALL "Fe","O" AND elements HAS ONLY "Fe","O"` |
| any | empty | *(no clause)* |

### `nPeriodicDimensions`

Values sorted ascending. A multi-value OR clause is wrapped in parentheses
so it combines correctly when ANDed with other clauses.

| Selected | Clause produced |
|---|---|
| `{3}` | `nperiodic_dimensions = 3` |
| `{2, 3}` | `(nperiodic_dimensions = 2 OR nperiodic_dimensions = 3)` |
| empty | *(no clause)* |

### `nElementsMin` / `nElementsMax`

Non-integer input is ignored (treated as empty). When min equals max and
both are valid, the clause simplifies to an equality.

| `nElementsMin` | `nElementsMax` | Clause produced |
|---|---|---|
| `'2'` | `'4'` | `nelements >= 2 AND nelements <= 4` |
| `'3'` | `'3'` | `nelements = 3` |
| `'2'` | `''` | `nelements >= 2` |
| `''` | `'4'` | `nelements <= 4` |
| `''` | `''` | *(no clause)* |

### `nSitesMin` / `nSitesMax`

Same derivation rules as `nElements`, field name `nsites`.

### `formulaAnonymous`

Value used as-is; no normalization. Providers expect uppercase letters A, B,
C... for distinct species in order of increasing count (e.g. `AB`, `AB2`,
`ABO3`). The UI supplies a hint tooltip (see Display section).

| Value | Clause produced |
|---|---|
| `'AB2'` | `chemical_formula_anonymous = "AB2"` |
| `''` | *(no clause)* |

### `formulaReduced`

Value used as-is; no normalization. OPTIMADE string comparisons are
case-sensitive on most providers.

| Value | Clause produced |
|---|---|
| `'Fe2O3'` | `chemical_formula_reduced = "Fe2O3"` |
| `''` | *(no clause)* |

### `spaceGroupItNumber`

Value must parse as an integer in [1, 230]. Non-integer input and values
outside this range are ignored (no clause produced).

| Value | Clause produced |
|---|---|
| `'225'` | `space_group_it_number = 225` |
| `''` or invalid | *(no clause)* |

### `lastModifiedSince`

Value is an ISO 8601 date string (`YYYY-MM-DD`) from the date picker.
Formatted to midnight UTC for the filter clause.

| Value | Clause produced |
|---|---|
| `'2024-01-01'` | `last_modified > "2024-01-01T00:00:00Z"` |
| `''` | *(no clause)* |

---

## Filter combination

All non-empty clauses are collected in field order (elements, nperiodic,
nelements, nsites, formulaAnonymous, formulaReduced, spaceGroup,
lastModified) and joined with ` AND `.

The `exact` mode elements clause already contains an internal AND; it is
treated as a single clause unit — no additional parentheses are added,
because AND is associative and the result is unambiguous.

**Example — three active fields:**

- Elements `has_all` `{Fe, O}` → `elements HAS ALL "Fe","O"`
- `nPeriodicDimensions` `{2, 3}` → `(nperiodic_dimensions = 2 OR nperiodic_dimensions = 3)`
- `formulaAnonymous` `'ABO3'` → `chemical_formula_anonymous = "ABO3"`

Combined: `elements HAS ALL "Fe","O" AND (nperiodic_dimensions = 2 OR nperiodic_dimensions = 3) AND chemical_formula_anonymous = "ABO3"`

**All fields empty:** filter string is `""`.

---

## Periodic table collapsible

- **Default state:** collapsed (`tableExpanded = false`).
- **Collapsed header** renders:
  - A toggle button labelled `Select elements ▾` (expanded: `▴`). Clicking
    toggles `tableExpanded`.
  - A flex-wrap row of element chips showing `selectedElements`. Each chip
    displays the element symbol and an `×` remove button.
  - A **Clear** button to the right of the chip row. Visible when
    `selectedElements` is non-empty. Clicking removes all element chips
    (sets `selectedElements` → empty). Does **not** call `onFilterChange`
    or `onReset`; it is a local widget action scoped to the element selector.
  - When `selectedElements` is empty, renders the placeholder text
    `No elements selected` in muted gray in place of chips; the Clear
    button is not rendered.
- **Expanded** renders `PeriodicTableSelector` below the header, including
  the mode toggle (`has_all` / `has_any` / `exact`).
- Chip `×` clicks remove the element from `selectedElements` immediately
  (visual feedback is instant). Like all other field edits, removal does
  **not** call `onFilterChange`; the updated selection takes effect on the
  next Search click.
- `tableExpanded` is purely UI state; collapsing the table does not clear
  or alter `selectedElements`.

---

## Display layout (top to bottom within the panel)

**Sticky top bar** (pinned to the top of the FilterPanel column, always
visible even when the filter body is scrolled):
- **Search button** — primary action. Clicking calls
  `onFilterChange(derivedFilterString)`.
- **Reset button** — secondary action, placed alongside Search. Clicking
  calls `onReset()`.

**Scrollable filter body** (below the sticky bar, scrolls independently):

1. **Elements** — collapsible header with chips; `PeriodicTableSelector`
   when expanded
2. **Dimensionality** — labelled `Dimensionality`, four-button toggle group:
   `0 — Molecule`, `1 — Chain`, `2 — Layer`, `3 — Bulk`. Multi-select.
   Buttons display `0`, `1`, `2`, `3` as primary labels with the word labels
   as secondary text or tooltip.
3. **Number of elements** — labelled `Elements (count)`, paired inputs:
   `Min` and `Max`, side by side. Integer only.
4. **Number of sites** — labelled `Sites (unit cell)`. `Max` input is
   primary (leftmost / larger). `Min` input is secondary (rightmost /
   smaller). Integer only. Layout note: most users want an upper bound;
   the Max field is visually leading.
5. **Formula (anonymous)** — labelled `Anonymous formula`. Text input,
   placeholder `AB, AB2, ABO3…`. A `?` icon adjacent to the label opens
   a tooltip:
   > Element-agnostic formula: use A, B, C… for distinct species in order
   > of increasing count. Example: `AB2` matches TiO₂, MgF₂, FeS₂.
6. **Formula (reduced)** — labelled `Reduced formula`. Text input,
   placeholder `Fe2O3, TiO2…`. Note in tooltip or helper text:
   `Case-sensitive. Use standard element symbols.`
7. **Space group (IT number)** — labelled `Space group (IT no.)`. Integer
   input, placeholder `1–230`. Input is not disabled by default; empirical
   provider support is determined at runtime by the user.
8. **Last modified since** — labelled `Modified after`. Date picker input.

---

## Search, Clear, and Reset postconditions

**Search click:**
- Calls `onFilterChange(derivedFilterString)` with the current derived
  OPTIMADE filter string (which may be `""` if all fields are at their
  defaults).
- Does not modify any field state; the filter fields retain their values
  after submission.

**Clear click** (element selector only):
- Sets `selectedElements` → empty.
- Does **not** call `onFilterChange` or `onReset`; it is a local widget
  action scoped to the element selector.
- All other field state is unaffected.

**Reset click:**
- Resets every field to its default value: `selectedElements` → empty,
  `mode` → `has_all`, `tableExpanded` → `false`, all text / number /
  date inputs → `''`.
- Calls `onReset()` (not `onFilterChange`); `StructuresPage` handles
  the transition to the no-query state (`filterString → null`) and
  closes any open `StructureDetailPanel`.

**General rules:**
- No field interaction (element toggle, range input, button group, text
  entry, or chip removal) calls `onFilterChange` or `onReset` on its own.
- All field state updates are immediate and visual; query submission is
  deferred to Search or Reset.

---

## Error conditions

- Unknown symbol in `selectedElements` (e.g. from stale state): ignored;
  no tile is highlighted; the symbol still appears as a chip and is included
  in the filter string.
- Non-integer input in nelements / nsites / spaceGroupItNumber fields:
  the field's clause is silently omitted from the filter string. The input
  is not flagged as an error in this pass.
- `spaceGroupItNumber` outside [1, 230]: clause omitted silently.
- `formulaAnonymous` / `formulaReduced` values that contain characters
  invalid in OPTIMADE string literals (e.g. unescaped quotes): not validated
  client-side in this pass; the server will return an error response which
  surfaces via the existing provider-warning mechanism.
