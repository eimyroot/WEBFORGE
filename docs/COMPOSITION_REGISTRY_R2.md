# WEBFORGE Composition Registry R2

## Purpose

Composition Registry R2 turns the universal compiler's visual catalog into an executable renderer system. Registry count alone is not accepted as coverage: every registered section template must resolve to a renderer contract that explicitly supports its layout mode.

## Resolution path

```text
BRIEF
  -> DOMAIN / PRODUCT / EXPERIENCE
  -> DESIGN DNA
  -> PAGE + ZONE COMPOSITION
  -> SECTION TEMPLATE RESOLVER
  -> RENDERER CONTRACT
  -> RENDER
  -> RESPONSIVE / A11Y / BROWSER QA
```

## R2 baseline

- 60 layout / interaction primitives
- 320 section templates
- 30 renderer contracts, including the governed project-local adaptive renderer
- 8 layout modes: immersive, editorial, conversion, split, rail, mosaic, bento, minimal
- deterministic renderer coverage calculation
- project-local component synthesis for missing semantic families

## Renderer coverage semantics

`rendererBacked` means that a template points to a known renderer contract and the contract supports that template's layout mode. It does not mean every template has received an independent human design review or an independent browser screenshot review.

R2 additionally runs every registry template through `renderSection()` as a deterministic renderer smoke test. Representative cross-domain browser runs are handled separately by the Visual Diversity Matrix.

## Project-local synthesis

If the section resolver cannot find a sufficient registered family, it does not silently substitute a generic approved component. It emits a project-local record using `adaptive-section`.

Project-local records are:

- `PROJECT_LOCAL_ONLY`
- `generated-provisional`
- `REVIEW_REQUIRED` for production
- recorded in `project-local-components.json`

A novel-domain project therefore remains previewable and testable without converting generated design into production approval.

## Visual diversity

Layout mode is now executable visual information rather than ranking metadata only. Rendered output responds to bento, rail, editorial, conversion, minimal, mosaic, immersive and split modes. A browser matrix verifies materially different fingerprints across venue, marketplace, sensitive local service and novel experiential briefs.

## Production invariant

```text
REGISTRY COVERAGE != BROWSER VERIFICATION
BROWSER VERIFICATION != CONTENT/MEDIA APPROVAL
CONTENT/MEDIA APPROVAL != PRODUCTION APPROVAL
```

All release decisions remain fail-closed.
