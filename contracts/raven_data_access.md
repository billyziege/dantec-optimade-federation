# Contract: raven_data_access

**Status: DORMANT in this repo.**
`RavenDBClient` is implemented (`src/dantec_optimade/raven_data_access.py`) and this
contract accurately describes it, but the module is not wired into the federation layer.
The original role (cache-aside above OPTIMADE) was removed when the team lead clarified
that the federation layer should call OPTIMADE directly with no local cache.

The intended future home for `RavenDBClient` is a separate DANTEc OPTIMADE *provider*
endpoint (DANTEc serving its own ResearchActivity records via OPTIMADE), which is a
different repo and a different problem. Until that work begins, this module is preserved
here for reference only.

---

## RavenDBClient.__init__

**Preconditions:**
- `base_url` is the URL of a running RavenDB instance (e.g. `"http://127.0.0.1:8080"`)
- `database` is the name of an existing database in that instance

---

## RavenDBClient.insert_single_document

**Signature:** `insert_single_document(data: dict) -> None`

**Preconditions:**
- `data["id"]` exists and is a non-empty string; used as the RavenDB document ID
- `data` contains all OPTIMADE flat fields:
  `provider`, `chemical_formula_reduced`, `chemical_formula_hill`, `elements`,
  `nelements`, `nsites`, `dimension_types`, `nperiodic_dimensions`, `last_modified`

**Postconditions:**
- A document with key `data["id"]` exists in the database after the call
- The stored document contains exactly the OPTIMADE fields listed above
- If a document with that ID already existed, it is overwritten (upsert)
- Legacy fields (`title`, `date`, `formula`, `authors`) are NOT stored

**Error conditions:**
- RavenDB unreachable or non-200/201 response: prints error, returns None (does not raise)

**Examples:**
1. `insert_single_document(record)` where `record` is returned by `fetch_structures` →
   `get_document(record["id"])` returns a document with the OPTIMADE fields
2. Calling `insert_single_document` twice with the same `id` →
   `get_document` returns one document (second call overwrites)

---

## RavenDBClient.insert_document

Same contract as `insert_single_document` but accepts a `list[dict]`. Equivalent to
calling `insert_single_document` for each item in order.

---

## RavenDBClient.get_document

**Signature:** `get_document(doc_id: str) -> dict | None`

**Postconditions:**
- Returns the document dict if found
- Returns `None` if not found (404) or on error

---

## RavenDBClient.query

**Signature:** `query(query_string: str) -> dict | None`

**Preconditions:**
- `query_string` is a valid RavenDB RQL query string

**Postconditions:**
- Returns the RavenDB response dict on success, `None` on error

---

## RavenDBClient.delete_document

**Signature:** `delete_document(doc_id: str) -> bool`

**Postconditions:**
- Returns `True` if document was deleted
- Returns `False` if not found (404) or on error
