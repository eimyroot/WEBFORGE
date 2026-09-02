import {execFileSync} from 'node:child_process';
import {discoverChromium} from '../src/core/browser-qa.mjs';
const checks=[];
function run(id,args){try{execFileSync('npm',args,{stdio:'pipe'});checks.push({id,status:'PASS'});}catch(e){checks.push({id,status:'FAIL',detail:String(e.stdout||e.message).slice(-2000)});}}
run('package-gate',['run','release:gate']);
if(!discoverChromium()) checks.push({id:'browser-required',status:'FAIL',detail:'Install Chrome/Chromium or set CHROME_PATH / CHROMIUM_PATH'}); else {run('browser-integration',['run','test:browser']);run('visual-diversity-matrix',['run','visual:matrix']);}
run('selftest',['run','selftest']);
const status=checks.some(x=>x.status==='FAIL')?'FAIL':'PASS';console.log(JSON.stringify({status,gate:'FULL_ENVIRONMENT',checks},null,2));if(status!=='PASS')process.exit(1);
