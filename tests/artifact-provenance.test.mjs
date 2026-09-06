import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  BUILD_ARTIFACT_SCHEMA,
  buildReceiptResult,
  canonicalVercelBuildInvocation,
  createTreeReceipt,
  generateCanonicalRuntimeSource,
  loadCanonicalArtifactContracts,
  sourceArtifactIdentityDigest,
  treeDigestFromManifest,
  validateCanonicalProductContracts,
  validatePredeployOutputDigest,
  validateProductionBuildInputs
} from '../src/core/artifact-provenance.mjs';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const contracts=loadCanonicalArtifactContracts(repoRoot);
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-artifact-provenance-'));
test.after(()=>fs.rmSync(tempRoot,{recursive:true,force:true}));
const out=name=>path.join(tempRoot,name);
const clone=value=>JSON.parse(JSON.stringify(value));
const sha=value=>crypto.createHash('sha256').update(value,'utf8').digest('hex');

function generate(name,generationRunId,overrides={}){
  return generateCanonicalRuntimeSource({outputRoot:out(name),...contracts,...overrides,generationRunId});
}

test('same canonical input produces the same runtime source tree digest',()=>{
  const a=generate('same-a','run-a');
  const b=generate('same-b','run-a');
  assert.equal(a.status,'PASS');
  assert.equal(b.status,'PASS');
  assert.equal(a.runtimeSourceTreeDigest,b.runtimeSourceTreeDigest);
  assert.deepEqual(a.sourceManifest,b.sourceManifest);
});

test('different generationRunId does not change runtime source tree digest',()=>{
  const a=generate('runid-a','execution-111');
  const b=generate('runid-b','execution-999');
  assert.equal(a.status,'PASS');
  assert.equal(b.status,'PASS');
  assert.notEqual(a.generationRunId,b.generationRunId);
  assert.equal(a.runtimeSourceTreeDigest,b.runtimeSourceTreeDigest);
});

test('changed canonical input changes runtime source tree digest',()=>{
  const changed=clone(contracts.productSpec);
  changed.canonicalInput.value='Premium techno club in Prague with events, artists, tickets, gallery and rooftop terrace.';
  changed.canonicalInput.sha256=sha(changed.canonicalInput.value);
  const baseline=generate('changed-base','base');
  const modified=generate('changed-new','changed',{productSpec:changed});
  assert.equal(baseline.status,'PASS');
  assert.equal(modified.status,'PASS');
  assert.notEqual(baseline.runtimeSourceTreeDigest,modified.runtimeSourceTreeDigest);
});

test('manifest path ordering does not change tree digest',()=>{
  const entries=[
    {path:'z.txt',size:1,sha256:'a'.repeat(64)},
    {path:'a.txt',size:2,sha256:'b'.repeat(64)},
    {path:'m/file.txt',size:3,sha256:'c'.repeat(64)}
  ];
  assert.equal(treeDigestFromManifest(entries),treeDigestFromManifest([...entries].reverse()));
});

test('changing one byte changes runtime tree digest',()=>{
  const generated=generate('byte-change','byte');
  assert.equal(generated.status,'PASS');
  const before=createTreeReceipt(generated.runtimeRoot).treeDigest;
  fs.appendFileSync(path.join(generated.runtimeRoot,'README.md'),'x');
  const after=createTreeReceipt(generated.runtimeRoot).treeDigest;
  assert.notEqual(before,after);
});

test('ephemeral timestamp and UUID metadata are not source artifact identity',()=>{
  const identity={repository:'eimyroot/WEBFORGE',sourceSha:'abc',productKey:'webforge-reference',runtimeSourceTreeDigest:'d'.repeat(64),lockfileDigest:'e'.repeat(64)};
  const a={identity,generationRunId:'run-a',timestamp:'2026-01-01T00:00:00Z',receiptId:crypto.randomUUID()};
  const b={identity,generationRunId:'run-b',timestamp:'2030-01-01T00:00:00Z',receiptId:crypto.randomUUID()};
  assert.equal(sourceArtifactIdentityDigest(a),sourceArtifactIdentityDigest(b));
});

test('missing or wrong canonical product spec digest is BLOCKED',()=>{
  const missing=clone(contracts.productSpec); delete missing.canonicalInput.sha256;
  const wrong=clone(contracts.productSpec); wrong.canonicalInput.sha256='0'.repeat(64);
  const a=validateCanonicalProductContracts({...contracts,productSpec:missing});
  const b=validateCanonicalProductContracts({...contracts,productSpec:wrong});
  assert.equal(a.status,'BLOCKED');
  assert.ok(a.blockers.includes('canonical-input-digest-missing'));
  assert.equal(b.status,'BLOCKED');
  assert.ok(b.blockers.includes('canonical-input-digest-mismatch'));
});

test('missing or wrong product-target binding is BLOCKED',()=>{
  const missing=validateCanonicalProductContracts({...contracts,binding:null});
  const wrong=clone(contracts.binding); wrong.target.projectId='prj_wrong';
  const mismatch=validateCanonicalProductContracts({...contracts,binding:wrong});
  assert.equal(missing.status,'BLOCKED');
  assert.ok(missing.blockers.some(x=>x.startsWith('product-binding')));
  assert.equal(mismatch.status,'BLOCKED');
  assert.ok(mismatch.blockers.includes('hosting-project-mismatch'));
});

test('missing lockfile for production build is BLOCKED',()=>{
  const runtime=out('missing-lock'); fs.mkdirSync(runtime,{recursive:true});
  fs.writeFileSync(path.join(runtime,'package.json'),'{}\n');
  const result=validateProductionBuildInputs(runtime);
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.blockers.includes('lockfile-missing'));
});

test('predeploy output digest mismatch is BLOCKED',()=>{
  const runtime=out('predeploy-mismatch');
  const output=path.join(runtime,'.vercel','output'); fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'index.html'),'hello');
  const result=validatePredeployOutputDigest({runtimeRoot:runtime,buildReceipt:{schema:BUILD_ARTIFACT_SCHEMA,status:'PASS',outputTreeDigest:'f'.repeat(64)}});
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.blockers.includes('predeploy-output-digest-mismatch'));
});

test('build success without output digest is UNVERIFIED',()=>{
  const result=buildReceiptResult({base:{schema:BUILD_ARTIFACT_SCHEMA},commandStatus:0,outputManifest:[]});
  assert.equal(result.status,'UNVERIFIED');
  assert.equal(result.outputTreeDigest,null);
});

test('canonical artifact CI path contains build only and no production deploy action',()=>{
  const invocation=canonicalVercelBuildInvocation({teamId:contracts.binding.target.teamId,projectId:contracts.binding.target.projectId});
  assert.deepEqual(invocation.args,['build','--prod']);
  const script=fs.readFileSync(path.join(repoRoot,'scripts','canonical-artifact.mjs'),'utf8');
  const workflow=fs.readFileSync(path.join(repoRoot,'.github','workflows','ci.yml'),'utf8');
  assert.equal(/vercel\s+deploy|deploy_to_vercel/.test(script),false);
  assert.equal(/vercel\s+deploy|deploy_to_vercel/.test(workflow),false);
});

test('canonical artifact summary exposes blocker names without secret values',()=>{
  const script=fs.readFileSync(path.join(repoRoot,'scripts','canonical-artifact.mjs'),'utf8');
  assert.match(script,/buildBlockers:buildReceipt\.blockers\|\|\[\]/);
  assert.match(script,/buildAuth:buildReceipt\.auth/);
  assert.match(script,/secretValueRecorded:false/);
  assert.equal(/VERCEL_TOKEN\s*[:=]\s*['"][^'"]+['"]/.test(script),false);
});
