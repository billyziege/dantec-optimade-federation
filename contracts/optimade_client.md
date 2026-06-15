# Contract: optimade_client

## fetch_structures

**Signature:**
```python
def fetch_structures(
    filter_str: str,
    max_results: int = 10,
    base_urls: list[str] | None = None,
) -> list[dict]
```

**Preconditions:**
- `filter_str` is a syntactically valid OPTIMADE filter string; validation is delegated to `OptimadeClient`
- `max_results` >= 1
- Each URL in `base_urls` (if provided) is an OPTIMADE provider base URL (no trailing slash required)

**Postconditions:**
- Returns a list (possibly empty) of flat record dicts
- Every record contains all of: `id`, `provider`, `chemical_formula_reduced`,
  `chemical_formula_hill`, `elements`, `nelements`, `nsites`, `dimension_types`,
  `nperiodic_dimensions`, `last_modified`
- `id` is never null or empty
- `provider` is a non-empty string derived from the source base URL
- `elements` is a list of chemical element symbol strings (e.g. `["Fe", "O"]`)
- `nelements` equals `len(elements)` when both are populated
- When `base_urls` is None, only NOMAD is queried (default behaviour)
- When `base_urls` contains multiple URLs, results from all providers are combined
  in the returned list; `provider` distinguishes the source of each record

**Error conditions:**
- Invalid filter string: `OptimadeClient` raises — not caught here, propagates to caller
- Network failure or unreachable provider: returns empty list or partial results
  (behaviour delegated to `OptimadeClient`)
- Provider returns no matching structures: returns `[]` — not an error

**Examples:**
1. `fetch_structures('elements HAS "Fe"', max_results=3)` →
   list of ≤ 3 records; each has `"Fe"` in `elements`
2. `fetch_structures('nelements = 1', max_results=2)` →
   ≤ 2 records with `nelements == 1`
3. `fetch_structures('elements HAS "Fe" AND nelements < 3', max_results=5)` →
   records containing Fe with fewer than 3 distinct elements
4. `fetch_structures('chemical_formula_reduced = "NaCl"', max_results=5)` →
   records matching NaCl stoichiometry
5. `fetch_structures('elements HAS "Xy"', max_results=5)` →
   `[]` (no such element symbol in NOMAD)
