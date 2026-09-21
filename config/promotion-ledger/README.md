# Promotion ledger

This directory is the append-only canonical record of completed WEBFORGE production promotions.

`config/production-target.json` defines target identity. It is not mutable runtime deployment state.

Each production promotion adds one new `*.json` record. Existing JSON records must never be edited, renamed, or deleted. Corrections are additive records that reference the superseded record.

CI runs `npm run provenance:verify`. For push and pull-request events it rejects modifications or deletion of existing promotion JSON records relative to the event base revision.

A promotion record is evidence, not authority. A record may describe a scoped exception such as `BYPASSED_EXCEPTION`; it does not create a reusable exception or authorize another deployment.
