import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('independent runner is exact-SHA and rejects production credentials',()=>{
  const src=fs.readFileSync('scripts/remote-ci-runner.mjs','utf8');
  assert.match(src,/WEBFORGE_CI_EXPECTED_SHA/);
  assert.match(src,/remoteSha!==expectedSha/);
  assert.match(src,/name\.startsWith\('VERCEL_'\)/);
  assert.match(src,/GITHUB_TOKEN/);
  assert.match(src,/productionCredentialsPresent:false/);
});

test('independent runner publishes only through existing App-bound local CI',()=>{
  const src=fs.readFileSync('scripts/remote-ci-runner.mjs','utf8');
  assert.match(src,/WEBFORGE_PUBLISH_STATUS:'1'/);
  assert.match(src,/remoteStatus\?\.publisher!=='github-app'/);
  assert.doesNotMatch(src,/vercel\s+deploy|--prod/);
});

test('runner image pins toolchain and includes browser but no repository secrets',()=>{
  const docker=fs.readFileSync('Dockerfile.ci-runner','utf8');
  assert.match(docker,/node:24\.20\.0-bookworm-slim/);
  assert.match(docker,/npm@11\.19\.0/);
  assert.match(docker,/chromium/);
  assert.doesNotMatch(docker,/private-key|GITHUB_TOKEN|VERCEL_TOKEN/);
});

test('independent runner keeps mutable build workspace off persistent evidence storage',()=>{
  const src=fs.readFileSync('scripts/remote-ci-runner.mjs','utf8');
  assert.match(src,/mkdtempSync\(path\.join\(os\.tmpdir\(\),'webforge-ci-runner-'\)\)/);
  assert.match(src,/durableCiDir/);
  assert.match(src,/name\.endsWith\('\.log'\)/);
  assert.doesNotMatch(src,/checkout=path\.join\(runDir/);
});
