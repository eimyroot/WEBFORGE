# WEBFORGE Visual Composition System — 5.0

WEBFORGE 6.0 separates page architecture from visual execution.

## Pipeline

`Page Grammar → Zone Composition → Section Template → Content Binding → Media Slot → Art Direction → Responsive Renderer → Runtime Parity → Browser QA`

## Section templates

The section-template catalog resolves concrete visual patterns for hero, event feature, event rail, people/artist grids, gallery mosaics, service grids, proof metrics, product stages, workflow rails, integrations, pricing, FAQ, location and conversion bands.

A template is not just markup. It is selected with a content contract, media roles, responsive behavior and an architectural role.

## Media intelligence

Every visual slot has:
- semantic role
- aspect ratio
- minimum width
- focal point
- load priority
- treatment
- ordered connector candidates
- truth status

Procedural art is a preview fallback. Production requires an approved/verified asset or explicit human approval of the fallback.

## Art direction

Built-in art-direction families:
- dark-cinematic
- premium-editorial
- product-precision
- warm-local
- creative-contrast

Art direction compiles colors, surfaces, type behavior, spacing, max width, media treatment, motion mode and responsive composition rules.

## Content binding

Generated seed content is explicitly `PROVISIONAL`. It exists to produce a realistic preview and exercise the complete renderer. It cannot silently become production truth. Production release requires content approval or a real content connector.

## Runtime parity

Portable preview and runtime-native Astro/Next/Vite source share the same visual model and CSS. Runtime artifacts copy the same media assets and carry `visualParity: true` in the runtime manifest.

## Connector boundary

Connectors are capability-driven, not mandatory. `none` remains a valid outcome where no external service is needed. External adapters remain conditional until credentials, provider execution and evidence exist.
