import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(repoRoot,rel),'utf8');

test('ordinary CI keeps tests and contracts but not canonical artifact promotion',()=>{
  const ci=read('.github/workflows/ci.yml');
  assert.match(ci,/push:/);
  assert.match(ci,/pull_request:/);
  assert.match(ci,/npm test/);
  assert.match(ci,/npm run verify/);
  assert.doesNotMatch(ci,/canonical-artifact:/);
  assert.doesNotMatch(ci,/artifact:canonical/);
});

test('artifact promotion is manual, exact-main-SHA bound, build-only, and secret sourced',()=>{
  const workflow=read('.github/workflows/artifact-promotion.yml');
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\n\s+push:/);
  assert.doesNotMatch(workflow,/\n\s+pull_request:/);
  assert.match(workflow,/ref: \$\{\{ inputs\.source_sha \}\}/);
  assert.match(workflow,/test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow,/git fetch --no-tags --depth=1 origin main/);
  assert.match(workflow,/test "\$CANONICAL_MAIN_SHA" = "\$REQUESTED_SOURCE_SHA"/);
  assert.match(workflow,/node-version: 24\.20\.0/);
  assert.match(workflow,/npm@11\.19\.0/);
  assert.match(workflow,/vercel@59\.11\.7/);
  assert.match(workflow,/VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  assert.match(workflow,/AUTH_BOOTSTRAP_REQUIRED/);
  assert.match(workflow,/runtime\/package-lock\.json/);
  assert.match(workflow,/runtime\/\.vercel\/output\/\*\*/);
  assert.match(workflow,/source-artifact\.receipt\.json/);
  assert.match(workflow,/build-artifact\.receipt\.json/);
  assert.equal(/vcp_[A-Za-z0-9_-]+/.test(workflow),false);
  assert.equal(/vercel\s+deploy|deploy_to_vercel/.test(workflow),false);
});

test('promotion job cannot succeed for BLOCKED FAIL or UNVERIFIED build receipts',()=>{
  const script=read('scripts/canonical-artifact.mjs');
  const workflow=read('.github/workflows/artifact-promotion.yml');
  assert.match(script,/if\(buildReceipt\.status!==['"]PASS['"]\|\|buildReceipt\.outputTreeDigest==null\) process\.exitCode=1/);
  assert.match(workflow,/const promotionPass=receipt\.status===['"]PASS['"]&&receipt\.outputTreeDigest!=null/);
  assert.match(workflow,/if\(!promotionPass\) process\.exit\(1\)/);
  assert.match(script,/productionDeploymentExecuted:false/);
  assert.equal(/vercel\s+deploy|deploy_to_vercel/.test(script),false);
});
