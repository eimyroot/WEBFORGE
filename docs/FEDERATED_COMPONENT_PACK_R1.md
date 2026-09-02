# WEBFORGE Federated Component Pack R1

WEBFORGE does not vendor the world's UI libraries. It federates approved public registries and retrieves only the exact candidate selected for a project.

## Resolution contract

`brief -> capability need -> internal registry -> federated search -> ranked exact item -> inspect -> license/security/framework policy -> authorized fetch/install OR internal/project-local fallback`

The public shadcn registry directory is the primary discovery bus. Seed sources are preference hints, not a frozen catalog. Directory-listed third-party registries remain untrusted code until the exact item is inspected.

## Fail-closed invariants

- Directory listing is not installation authority.
- `READY` is not `PASS`.
- Unknown license is `REVIEW_REQUIRED`.
- External targets, install scripts, or unsafe paths are blocked.
- Network access is explicit.
- Only the selected exact item may proceed to installation.
- If external resolution cannot be verified, WEBFORGE falls back to its internal registry or project-local synthesis.
