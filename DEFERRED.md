# Deferred Work

Ideas that are sound but out of scope for the current deliverable. Each entry
should have enough context to pick back up without re-deriving the reasoning.

---

## WebAssembly tool embedding

**What:** Package linked files (OPTIMADE structure + DANTEc record) and open
them in a browser-embedded analysis tool compiled to WebAssembly (e.g.
Pyodide-based, or a WASM-compiled materials viewer), rather than just
downloading files for a desktop tool.

**Why deferred:** Stretch goal, not part of the initial implementation. No
concrete WASM tool has been chosen yet.

**Design accommodation already made:** The GraphQL schema separates
`Structure.geometry` and `Structure.sites` from `Structure.composition` so
that a future tool-embedding component can fragment on exactly the heavy
data (lattice vectors, cartesian site positions) it needs, without other
components paying for it. No further accommodation needed until a specific
tool is chosen.

**Revisit when:** A specific WASM-compatible analysis tool is identified as
a candidate, or a consortium use case explicitly requires in-browser
analysis.

---

## Generalized GraphQL layer as an OPTIMADE community contribution

**What:** If the GraphQL schema and resolver patterns developed here prove
clean and general, propose them as a community extension to the OPTIMADE
spec/ecosystem (Materials-Consortia) — an official or quasi-official GraphQL
companion to the REST spec, similar in spirit to `tilde-lab/optimade-client`.

**Why deferred:** Different audience (Materials-Consortia, not UWB/DANTEc),
different process (consortium review, not just code quality), different
timeline. Building it well for our own use case first is also a prerequisite
for a credible proposal — a schema designed against one real application is
more trustworthy than one designed speculatively for a hypothetical adopter.

**Revisit when:** The internal schema has been used long enough to validate
its generality, or there's a separate desire to engage with the OPTIMADE
maintainers directly.

---

## Formal provider registration requiring typed GraphQL extensions

**What:** If the above (generalized GraphQL layer) moves forward, a
provider wanting first-class GraphQL support could be required to register
a typed metadata extension (analogous to OPTIMADE's `_prefix` field
extension mechanism) rather than relying on a generic JSON fallback.

**Why deferred:** Same reasons as above — this is a governance/process
proposal for OPTIMADE/Materials-Consortia, not something to build now.

**Design accommodation already made:** `ProviderMetadata` is a GraphQL
interface with a `raw: JSON!` escape hatch plus typed implementations
(`NomadMetadata` now, `DantecMetadata` once DANTEc is OPTIMADE-compliant,
`GenericProviderMetadata` for everything else). This already mirrors what a
formal registration process would require — adding a new provider's typed
fields later is additive, not a redesign.

**Revisit when:** The generalized GraphQL layer (above) is actually being
proposed externally.

---

## MaterialsCommons for Europe (mc4eu) — architecture verification

**What:** MaterialsCommons reportedly officially launched 2026-06-01. Its
catalogue/knowledge-graph layer runs on OpenSemanticLab + Semantic
MediaWiki (RDF/graph-triple paradigm) per
`mc4eu.open-semantic-lab.org`. No OPTIMADE mention found yet. Need to
verify whether this is complementary to or in tension with the OPTIMADE
federation approach taken here.

**Why deferred:** Semantic wiki/RDF infrastructure is closer to the
DANTEc ontology/CCMM thread than to this query-layer federation work.
Investigating now would be scope drift on the current deliverable.

**Revisit when:** Either (a) MaterialsCommons publishes an API spec, or
(b) the DANTEc ontology/ CCMM design work needs to account for it directly.
