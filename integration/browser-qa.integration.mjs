import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateWebsite,generatedProjectDir} from '../src/core/generator.mjs';
import {runBrowserQa,discoverChromium} from '../src/core/browser-qa.mjs';

test('real browser QA baseline and exact visual comparison',async()=>{
  const browser=discoverChromium();
  if(!browser){
    console.log('BROWSER_QA=UNVERIFIED: no Chrome/Chromium detected');
    return;
  }
  const out=generateWebsite('Premium techno club called VANTA in Prague. Dark cinematic mobile-first website with events, DJs, tickets and gallery.');
  const dir=generatedProjectDir(out.projectId);
  try{
    const first=await runBrowserQa(dir,{baseline:true});
    assert.notEqual(first.status,'FAIL');
    const second=await runBrowserQa(dir,{baseline:true});
    assert.equal(second.checks.find(x=>x.id==='visual-regression')?.status,'PASS');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
