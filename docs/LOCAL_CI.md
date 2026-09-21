# Local / external CI fallback

GitHub Actions is not required for the WEBFORGE verification gate.

For the current `main` commit, the default path remains:

```bash
WEBFORGE_PUBLISH_STATUS=1 npm run ci:local
```

When `main` requires `webforge/local-ci`, verify a candidate on its remote branch first:

```bash
git push origin HEAD:refs/heads/governance/my-candidate
WEBFORGE_CI_REMOTE_BRANCH=governance/my-candidate WEBFORGE_PUBLISH_STATUS=1 npm run ci:local
```

The runner fails closed unless the local branch equals `WEBFORGE_CI_REMOTE_BRANCH` (default `main`), the tracked worktree is clean, and local `HEAD` exactly equals that remote branch SHA. This lets the exact candidate SHA receive `webforge/local-ci=success` before the same SHA is promoted to protected `main`.

It exports the exact committed tree with `git archive`, runs the ordinary CI/release checks in an isolated workspace, and writes receipts under `/Users/eimyna/0_EVIDENCE/WEBFORGE/local-ci/`.

With `WEBFORGE_PUBLISH_STATUS=1`, the result is published as GitHub commit status `webforge/local-ci` for the exact SHA.

This gate does not deploy, promote, change branch protection, modify secrets, or create reusable production authority.
