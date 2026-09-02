# WEBFORGE Composition Registry R1

## Purpose

The registry is the production knowledge layer between page-grammar synthesis and final rendering. It prevents WEBFORGE from collapsing every project into a small number of hard-coded visual presets.

## Registry layers

1. Primitive Registry — layout, surface, media, typography, controls and motion primitives.
2. Section Template Registry — scored, trusted section variants with renderer compatibility and responsive contracts.
3. Page Blueprint Registry — multi-page site maps for venue, local service, portfolio, company, SaaS, marketplace, web app and editorial domains.
4. Art Direction Registry — coherent visual systems, not color presets.
5. Media Role Registry — aspect ratio, minimum resolution, crop/focal-point, loading and approval requirements.
6. Interaction Registry — accessible interaction patterns and implementation class.
7. Connector Contract Registry — capability, authority, credentials, trust and fail-closed behavior.
8. Plugin Registry — runtime compatibility, capability, trust, maturity and install policy.
9. Plugin Set Registry — governed capability packs selected by project type.
10. Workflow Registry — delivery and support workflows with evidence and approval gates.
11. Composition Pattern Registry — reusable information architecture and conversion patterns.

## Resolution order

```text
BRIEF
  ↓
INTENT + CAPABILITIES
  ↓
SITE BLUEPRINT
  ↓
PAGE GRAMMAR SYNTHESIS
  ↓
COMPOSITION PATTERNS
  ↓
SECTION TEMPLATE RESOLVER
  ↓
ART DIRECTION
  ↓
MEDIA ROLES + REQUESTS
  ↓
INTERACTION RESOLVER
  ↓
CONNECTOR CONTRACTS
  ↓
PLUGIN SET
  ↓
DELIVERY WORKFLOW
  ↓
RUNTIME FORGE
  ↓
QA / PREVIEW / APPROVAL / PRODUCTION
```

## Quality scoring

`qualityScore` is an internal deterministic ranking signal. It helps choose among compatible records. It must never be interpreted as user research, conversion evidence, security attestation, or production verification.

## Plugin authority

Plugin selection does not authorize installation. `installAuthority` remains explicit. External connectors remain `CONDITIONAL` until credentials, policy and runtime execution verify them.

## Media requests

When approved real media is unavailable, WEBFORGE emits `media.requests.json` with role-specific prompts, aspect ratio, minimum width, provider preferences, rights requirements and explicit approval requirements. Procedural artwork remains preview fallback only unless approved.

## Multi-page delivery

A blueprint can emit a complete static route tree for non-dynamic pages. Dynamic routes remain blueprint contracts until bound to real content/data. Astro and Next runtime-native projects receive compatible route source where supported; Vite receives the blueprint manifest plus the complete portable static preview.
