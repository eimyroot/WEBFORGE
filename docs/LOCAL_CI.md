# Local / external CI fallback

GitHub Actions is not required for the WEBFORGE verification gate.

When Actions is unavailable, run the deterministic fallback only after the exact commit is pushed to `origin/main`:

```bash
WEBFORGE_PUBLISH_STATUS=1 npm run ci:local
```

The runner fails closed unless:
- branch is `main`;
- tracked worktree is clean;
- local `HEAD` exactly equals `origin/main`.

It exports the exact committed tree with `git archive`, runs the ordinary CI/release checks in that isolated workspace, and writes receipts under `/Users/eimyna/0_EVIDENCE/WEBFORGE/local-ci/`.

With `WEBFORGE_PUBLISH_STATUS=1`, the result is also published as GitHub commit status `webforge/local-ci` for the exact SHA.

This gate does not deploy, promote, change branch protection, modify secrets, or create reusable production authority.
