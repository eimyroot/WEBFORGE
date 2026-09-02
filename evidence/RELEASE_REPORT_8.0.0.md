# WEBFORGE 8.0.0 — Composition Registry R2 / Universal Visual Factory

## Product change

WEBFORGE 8.0 closes the gap between a large composition catalog and an actually executable visual library. The section registry is now renderer-contract-backed, layout modes alter rendered composition, and an unknown section family can be synthesized as a governed project-local component instead of collapsing into a generic approved card.

## Registry baseline

- primitives: **60**
- section templates: **320**
- renderer contracts: **30**
- page blueprints: **30**
- art directions: **15**
- media roles: **36**
- interactions: **48**
- connector contracts: **24**
- domain ontology records: **20**
- capability ontology records: **68**

## Renderer coverage

`evidence/RENDERER_COVERAGE_8.0.0.json` reports:

- registered templates: **320**
- renderer-backed: **320**
- responsive-contract covered: **320**
- accessibility-contract covered: **320**
- missing renderer bindings: **0**

All 320 registry templates are also executed through the deterministic `renderSection()` smoke test.

This does **not** claim 320 independent human visual reviews or 320 independent browser screenshot audits.

## Project-local component synthesis

A missing semantic section family now produces a project-local `adaptive-section` component. The novel Future Self proof generated:

`project-local.domain-signature.generic-organization.r1`

The component can render in preview and pass browser QA, but its production gate is `REVIEW_REQUIRED`. It is therefore never silently promoted to an approved registry component.

## Cross-domain real browser proof

`evidence/VISUAL_MATRIX_8.0.0.json` covers four materially different website products:

1. VANTA techno venue — cinematic / dark-cinematic / Astro
2. Excavator marketplace — application / product-precision / Next
3. Sensitive funeral service — marketing / calm-premium / Astro
4. Future Self novel-domain ritual — experiential / neo-industrial / Next

The matrix produced:

- **4 distinct Design DNA modes**
- **4 distinct art directions**
- **4 distinct composition fingerprints**
- **4 distinct domain resolutions**

For each case the second real Chromium run reports:

- browser QA: PASS
- structural accessibility gate: PASS
- performance budget gate: PASS
- exact decompressed-pixel visual regression: PASS

The first browser run establishes a baseline, so it is intentionally not treated as a visual-regression PASS.

## Hybrid-domain content correction

Manual visual review found that HYBRID projects were adopting generic universal copy too early. R2 now preserves the primary domain content model for lower-depth hybrid sites (for example VANTA or a sensitive local service) while still enriching layout/capabilities universally. High-depth hybrid applications and NOVEL domains continue through universal content synthesis.

## Automated verification

- deterministic Node tests: **65 / 65 PASS**
- renderer coverage: **PASS**
- universal nine-domain matrix: **PASS**
- schema / fixture verification: **PASS**
- build: **PASS**
- audit: **PASS**
- package release gate: **PASS**
- real Chromium integration: **PASS**
- four-case visual diversity matrix: **PASS**
- full environment gate: **PASS**

## Truth boundary

The R2 PASS attests to this package, deterministic composition behavior, renderer-contract coverage, renderer smoke execution and the representative real-browser matrix in the release environment.

It does **not** attest that:

- all 320 templates have separate human visual approval;
- external CMS, payment, ticketing or analytics credentials were executed for every generated site;
- provisional/generated media are production-approved photography;
- Lighthouse was run (the performance gate is WEBFORGE's Chromium CDP render budget, not Lighthouse);
- any project-local generated component is production-approved without review;
- a production deployment was performed.

## Verdict

**PASS — WEBFORGE 8.0.0 Composition Registry R2 is a verified executable visual-registry baseline with fail-closed project-local synthesis.**
