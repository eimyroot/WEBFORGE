# WEBFORGE 6.1 — Live Fulfillment Architecture

`media.requests.json` is now executable input. `fulfillMedia()` binds real assets, writes SHA-256 provenance and approval evidence, then the demo pipeline re-renders portable + runtime-native output with those assets. `fulfillContent()` writes domain content and a readiness receipt. `connectorExecutionPlan()` separates connector selection from external mutation authority.

New commands:
- `npm run fulfill:demo`
- `npm run live:verify -- <project-id>`

New APIs:
- `POST /api/fulfill/media`
- `POST /api/fulfill/content`
- `POST /api/connectors/plan`

External systems remain fail-closed until target, credentials and approval are explicit.
