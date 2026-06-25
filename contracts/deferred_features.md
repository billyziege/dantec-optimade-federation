# Contract: Deferred Features

Features documented here are fully designed but not yet scheduled for
implementation. Each section records all design decisions so that
implementation can begin without reopening the design discussion.

---

## Saved tab — session persistence

The Saved tab is implemented with in-memory React state (`Map<id, snapshot>`
in `StructuresPage`). Saved items are lost on page reload.

**Proposed extension:** persist `savedItems` to `localStorage` so that saved
structures survive page reloads and tab close/reopen within the same browser
profile. The data format for serialization is already defined — the snapshot
object is a plain JSON-serializable structure.

**Why deferred:** the in-memory approach is simpler, avoids storage quota
and stale-data concerns, and is sufficient for the initial use case. The
decision to add persistence should be driven by user feedback on whether
session scope is limiting in practice.

**When ready to implement:**
- On mount, read `localStorage.getItem('dantec-saved-items')` and
  deserialize into the initial `savedItems` Map.
- On every `setSavedItems` call (save and delete), write the updated Map
  back to localStorage as JSON.
- Handle `localStorage` unavailability (private browsing, storage full)
  gracefully — fall back to in-memory without error.
