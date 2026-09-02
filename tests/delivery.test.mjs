import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolvePackages } from '../src/core/package-policy.mjs';
import { generateWebsite, generatedProjectDir } from '../src/core/generator.mjs';
import { verifyRuntimeBuild } from '../src/core/runtime-build.mjs';
import { deploymentPlan, evaluateDeployment } from '../src/core/deployment.mjs';
import { compose } from '../src/core/compose.mjs';
import { runBrowserQa, discoverChromium } from '../src/core/browser-qa.mjs';

test('package policy pins current trusted framework baselines',()=>{
  assert.equal(resolvePackages('astro').packages.astro,'7.2.0');
  assert.equal(resolvePackages('next').packages.next,'16.3.3');
  assert.equal(resolvePackages('vite-react').packages.vite,'8.2.2');
  assert.equal(resolvePackages('vite-react').packages['@vitejs/plugin-react'],'6.1.1');
  for(const runtime of ['astro','next','vite-react']) assert.ok(resolvePackages(runtime).checks.every(x=>x.status==='PASS'));
});

test('runtime build fails closed as UNVERIFIED without dependencies/network authority',()=>{
  const out=generateWebsite('Clean local service website for ACME in Prague with contact and SEO.');
  const dir=generatedProjectDir(out.projectId);
  const r=verifyRuntimeBuild(path.join(dir,'runtime'),{allowNetwork:false});
  assert.equal(r.status,'UNVERIFIED');
  assert.equal(r.checks.find(x=>x.id==='framework-build').status,'UNVERIFIED');
  fs.rmSync(dir,{recursive:true,force:true});
});

test('deployment policy requires all gates and explicit production approval',()=>{
  const plan=compose('SaaS app for teams with authentication, analytics and product dashboard.');
  const dp=deploymentPlan(plan,'saas-test');
  assert.equal(dp.production.authority,'human-explicit');
  const checks=['policy','runtime-build','browser-qa','accessibility','performance','visual-regression'].map(id=>({id,status:'PASS'}));
  const preview=evaluateDeployment({checks},{productionApproved:false});assert.equal(preview.previewEligible,true);assert.equal(preview.productionEligible,false);assert.deepEqual(preview.blockers,[]);assert.ok(preview.productionBlockers.includes('content-ready'));assert.ok(preview.productionBlockers.includes('media-ready'));
  const prodChecks=[...checks,{id:'content-ready',status:'PASS'},{id:'media-ready',status:'PASS'}];assert.equal(evaluateDeployment({checks:prodChecks},{productionApproved:true}).productionEligible,true);
});

