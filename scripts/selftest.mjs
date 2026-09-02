import fs from 'node:fs';
import {generateWebsite,generatedProjectDir} from '../src/core/generator.mjs';
import {discoverChromium,runBrowserQa} from '../src/core/browser-qa.mjs';
const out=generateWebsite('Premium architecture studio called NORTH. Minimal editorial portfolio with projects, case studies and contact.');
const dir=generatedProjectDir(out.projectId);
const checks=[{id:'generate',status:'PASS',detail:out.projectId},{id:'runtime-forge',status:out.manifest?.runtimeForge?.generated===true?'PASS':'FAIL',detail:out.manifest?.runtimeForge?.runtime}];
if(discoverChromium()){const first=await runBrowserQa(dir,{baseline:true});const qa=await runBrowserQa(dir,{baseline:true});checks.push({id:'browser-qa',status:qa.status==='FAIL'?'FAIL':'PASS',detail:{first:first.status,second:qa.status}});}else checks.push({id:'browser-qa',status:'UNVERIFIED'});
fs.rmSync(dir,{recursive:true,force:true});
const status=checks.some(x=>x.status==='FAIL')?'FAIL':'PASS';console.log(JSON.stringify({status,checks},null,2));if(status==='FAIL')process.exit(1);
