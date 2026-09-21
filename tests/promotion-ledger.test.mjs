import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ledgerDir, validatePromotionRecord, verifyLedger } from '../scripts/verify-promotion-ledger.mjs';

test('promotion ledger records are schema-valid and uniquely identified',()=>{
  const out=verifyLedger({baseSha:''});
  assert.equal(out.status,'PASS',out.errors.join('\n'));
  assert.ok(out.recordCount>=1);
  assert.equal(new Set(out.records.map(x=>x.record.recordId)).size,out.recordCount);
});

test('CI bypass exception is exact-SHA scoped and cannot become reusable authority',()=>{
  const files=fs.readdirSync(ledgerDir).filter(x=>x.endsWith('.json'));
  const records=files.map(name=>JSON.parse(fs.readFileSync(path.join(ledgerDir,name),'utf8')));
  const bypassed=records.filter(x=>x.gates?.ci?.status==='BYPASSED_EXCEPTION');
  assert.ok(bypassed.length>=1);
  for(const record of bypassed){
    assert.equal(record.gates.ci.scopeSourceSha,record.sourceSha);
    assert.match(record.gates.ci.reason,/one-off exception|SHA only/i);
    assert.deepEqual(validatePromotionRecord(record),[]);
  }
});

test('promotion target identity remains separate from mutable deployment evidence',()=>{
  const target=JSON.parse(fs.readFileSync('config/production-target.json','utf8'));
  assert.equal(target.scope,'production-hosting-target-identity');
  assert.equal(target.status,'CANONICAL');
  const out=verifyLedger({baseSha:''});
  const latest=out.records.at(-1).record;
  assert.equal(latest.target.projectId,target.target.projectId);
  assert.equal(latest.target.teamId,target.target.teamId);
});

test('CI has an independent per-SHA queue key and explicit recovery trigger',()=>{
  const ci=fs.readFileSync('.github/workflows/ci.yml','utf8');
  assert.match(ci,/workflow_dispatch:/);
  assert.match(ci,/group: webforge-ci-v2-\$\{\{ github\.event_name \}\}-\$\{\{ github\.ref \}\}-\$\{\{ github\.sha \}\}/);
  assert.match(ci,/npm run provenance:verify/);
  assert.match(ci,/WEBFORGE_LEDGER_BASE_SHA:/);
});

test('local CI can verify an exact SHA on a candidate remote branch before protected-main promotion',()=>{
  const localCi=fs.readFileSync('scripts/local-ci.mjs','utf8');
  assert.match(localCi,/WEBFORGE_CI_REMOTE_BRANCH/);
  assert.match(localCi,/refs\/heads\/\$\{expectedRemoteBranch\}/);
  assert.match(localCi,/remoteBranchSha:remoteSha/);
  assert.match(localCi,/branch!==expectedRemoteBranch/);
});
