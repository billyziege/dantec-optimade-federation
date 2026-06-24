# Contributing to DANTEc OPTIMADE Federation

Thank you for your interest in contributing. This is an open-science project
developed in the spirit of FAIR data infrastructure for the materials-science
community.

---

## Authorship and collaboration

This codebase is a collaborative work between a human researcher and an AI
coding assistant. Both are named contributors, because the code reflects
genuine joint authorship — not incidental tool use.

| Contributor | Role |
|-------------|------|
| **Brandon S. Zerbe** (brandon.s.zerbe@gmail.com) | Lead researcher, architect, domain expert; legally responsible party |
| **Claude Sonnet 4.6 via Claude Code** (Anthropic, noreply@anthropic.com) | AI pair programmer; co-author of implementation, tests, and documentation |

Commits from the AI contributor carry the standard git trailer:

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

This attribution is intentional. The design contracts (`contracts/`),
implementation, and test suite were produced through iterative dialogue between
Brandon and Claude. Listing Claude as a co-author is both accurate and a
deliberate statement that open-science infrastructure can be built this way
transparently.

---

## Development philosophy

### Contracts first

All significant changes begin with a design contract in `contracts/`. A
contract specifies the interface, invariants, and test cases for a component
before any code is written. The implementation is then derived from the
contract, not the reverse.

If you are adding a new component or changing an existing one significantly,
write or update the relevant contract first.

### No speculative abstraction

Do not add features, generalisations, or error-handling for scenarios that
cannot happen with the current system. Three concrete lines of code are better
than a premature abstraction. If you find yourself writing a helper that only
has one caller, question whether it needs to exist.

### Tests cover behaviour, not implementation

Tests assert on what a component does — the filter string it produces, the
element it renders, the Relay operation it issues — not on internal state.

---

## Setting up the development environment

See [README.md](README.md) for prerequisites and full setup instructions.

**Quick summary:**

```bash
# Backend
uv sync
source .venv/bin/activate

# Frontend
cd frontend && npm install
```

---

## Running the test suites

```bash
# Backend (from repo root, with venv active)
pytest

# Frontend
cd frontend && npm test
```

All tests must pass before opening a pull request. The backend suite has 88
tests; the frontend suite has 42.

---

## Code style

### Python

- Follows the conventions already in `src/dantec_optimade/`.
- Type annotations on all public functions.
- No comments that restate what well-named code already says; comments are for
  non-obvious invariants or workarounds.

### JavaScript / JSX

- React functional components with hooks.
- Tailwind CSS for styling; do not add inline `style` objects except for
  dynamic values that Tailwind cannot express (e.g. computed percentages for
  absolutely-positioned elements).
- No comments unless the reason behind the code would surprise a future reader.

---

## Adding an OPTIMADE provider

1. Add the provider's base URL to `PROVIDER_URLS` in
   `src/dantec_optimade/graphql_schema.py`.
2. Optionally implement a typed `ProviderMetadata` subclass for
   provider-specific fields.
3. Add tests in `tests/test_graphql_schema.py` covering the new provider's
   metadata resolver.

See the [README](README.md#adding-a-provider) for the full procedure.

---

## Submitting changes

1. Fork the repository and create a feature branch.
2. Write or update the relevant contract if the change is non-trivial.
3. Implement the change and ensure all tests pass.
4. Open a pull request with a description that explains *why* the change is
   needed, not just what it does.

For questions or to discuss a proposed change before implementing it, contact
Brandon Zerbe at brandon.s.zerbe@gmail.com.

---

## Open science commitment

This project is part of the [DANTEc](https://dantec.eu/) consortium's
commitment to open, reproducible materials science. Contributions that improve
interoperability with other OPTIMADE providers, the Materials Commons for Europe
platform, or related open infrastructure are especially welcome.
