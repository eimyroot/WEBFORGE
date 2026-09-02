import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateDeployment } from './deployment.mjs';
import { visualReadinessChecks } from './visual-readiness.mjs';

const tail=s=>String(s||'').slice(-6000);
const hasCommand=cmd=>spawnSync('sh',['-lc',`command -v ${cmd}`],{encoding:'utf8'}).status===0;
const sourceSha=()=>process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||process.env.CI_COMMIT_SHA||null;

function gateChecks(projectDir){
  const evidence=JSON.parse(fs.readFileSync(path.join(projectDir,'evidence.receipt.json'),'utf8'));
  const build=JSON.parse(fs.readFileSync(path.join(projectDir,'runtime-build.receipt.json'),'utf8'));
  const qaPath=path.join(projectDir,'qa','browser-qa.json');
  const qa=fs.existsSync(qaPath)?JSON.parse(fs.readFileSync(qaPath,'utf8')):{checks:[]};
  return [
    {id:'policy',status:evidence.policy==='PASS'?'PASS':'FAIL'},
    {id:'runtime-build',status:build.status},
    ...qa.checks.filter(x=>['browser-qa','accessibility','performance','visual-regression'].includes(x.id)).map(x=>({id:x.id,status:x.status})),
    ...visualReadinessChecks(projectDir)
  ];
}

function deploymentResult({mode,provider,eligibility,checks,commandStatus,output,url}){
  const sha=sourceSha();
  if(commandStatus!==0){
    return {schema:'webforge.deployment-execution.v4',status:'FAIL',mode,provider,url:null,sourceSha:sha,detail:output,eligibility,checks};
  }
  if(!url){
    return {schema:'webforge.deployment-execution.v4',status:'UNVERIFIED',mode,provider,url:null,sourceSha:sha,detail:`Deployment command exited 0 but no deployment URL was captured.\n${output}`,eligibility,checks};
  }
  return {schema:'webforge.deployment-execution.v4',status:'PASS',mode,provider,url,sourceSha:sha,detail:output,eligibility,checks};
}

export function executeDeployment(projectDir,{mode='preview',provider='vercel',productionApproved=false}={}){
  if(!['preview','production'].includes(mode)) throw new Error('mode must be preview or production');
  if(!['vercel','cloudflare'].includes(provider)) throw new Error('provider must be vercel or cloudflare');
  const checks=gateChecks(projectDir);
  const eligibility=evaluateDeployment({checks},{productionApproved});
  const eligible=mode==='preview'?eligibility.previewEligible:eligibility.productionEligible;
  if(!eligible) return {schema:'webforge.deployment-execution.v4',status:'BLOCKED',mode,provider,sourceSha:sourceSha(),eligibility,checks};

  const runtimeRoot=path.join(projectDir,'runtime');
  if(provider==='vercel'){
    if(!hasCommand('vercel')) return {schema:'webforge.deployment-execution.v4',status:'UNVERIFIED',mode,provider,sourceSha:sourceSha(),detail:'vercel CLI unavailable',eligibility,checks};
    const args=['deploy','--yes']; if(mode==='production')args.push('--prod');
    const r=spawnSync('vercel',args,{cwd:runtimeRoot,encoding:'utf8',timeout:180000});
    const output=tail((r.stdout||'')+(r.stderr||''));
    const url=(output.match(/https:\/\/[^\s]+\.vercel\.app[^\s]*/)||[])[0]||null;
    return deploymentResult({mode,provider,eligibility,checks,commandStatus:r.status,output,url});
  }

  if(!hasCommand('wrangler')) return {schema:'webforge.deployment-execution.v4',status:'UNVERIFIED',mode,provider,sourceSha:sourceSha(),detail:'wrangler CLI unavailable',eligibility,checks};
  const buildDir=fs.existsSync(path.join(runtimeRoot,'dist'))?'dist':fs.existsSync(path.join(runtimeRoot,'.vercel','output','static'))?'.vercel/output/static':null;
  if(!buildDir) return {schema:'webforge.deployment-execution.v4',status:'FAIL',mode,provider,sourceSha:sourceSha(),detail:'no static build output for Cloudflare Pages',eligibility,checks};
  const args=['pages','deploy',buildDir]; if(mode==='production') args.push('--branch','main');
  const r=spawnSync('wrangler',args,{cwd:runtimeRoot,encoding:'utf8',timeout:180000});
  const output=tail((r.stdout||'')+(r.stderr||''));
  const url=(output.match(/https:\/\/[^\s]+\.pages\.dev[^\s]*/)||[])[0]||null;
  return deploymentResult({mode,provider,eligibility,checks,commandStatus:r.status,output,url});
}
