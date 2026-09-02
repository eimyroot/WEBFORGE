import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateDeployment } from './deployment.mjs';
import { visualReadinessChecks } from './visual-readiness.mjs';

const tail=s=>String(s||'').slice(-6000);
const hasCommand=cmd=>spawnSync('sh',['-lc',`command -v ${cmd}`],{encoding:'utf8'}).status===0;

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

export function executeDeployment(projectDir,{mode='preview',provider='vercel',productionApproved=false}={}){
  if(!['preview','production'].includes(mode)) throw new Error('mode must be preview or production');
  if(!['vercel','cloudflare'].includes(provider)) throw new Error('provider must be vercel or cloudflare');
  const checks=gateChecks(projectDir);
  const eligibility=evaluateDeployment({checks},{productionApproved});
  const eligible=mode==='preview'?eligibility.previewEligible:eligibility.productionEligible;
  if(!eligible) return {schema:'webforge.deployment-execution.v3',status:'BLOCKED',mode,provider,eligibility,checks};

  const runtimeRoot=path.join(projectDir,'runtime');
  if(provider==='vercel'){
    if(!hasCommand('vercel')) return {schema:'webforge.deployment-execution.v3',status:'UNVERIFIED',mode,provider,detail:'vercel CLI unavailable',eligibility,checks};
    const args=['deploy','--yes']; if(mode==='production')args.push('--prod');
    const r=spawnSync('vercel',args,{cwd:runtimeRoot,encoding:'utf8',timeout:180000});
    const output=tail((r.stdout||'')+(r.stderr||''));
    const url=(output.match(/https:\/\/[^\s]+\.vercel\.app[^\s]*/)||[])[0]||null;
    return {schema:'webforge.deployment-execution.v3',status:r.status===0?'PASS':'FAIL',mode,provider,url,detail:output,eligibility,checks};
  }

  if(!hasCommand('wrangler')) return {schema:'webforge.deployment-execution.v3',status:'UNVERIFIED',mode,provider,detail:'wrangler CLI unavailable',eligibility,checks};
  const buildDir=fs.existsSync(path.join(runtimeRoot,'dist'))?'dist':fs.existsSync(path.join(runtimeRoot,'.vercel','output','static'))?'.vercel/output/static':null;
  if(!buildDir) return {schema:'webforge.deployment-execution.v3',status:'FAIL',mode,provider,detail:'no static build output for Cloudflare Pages',eligibility,checks};
  const args=['pages','deploy',buildDir]; if(mode==='production') args.push('--branch','main');
  const r=spawnSync('wrangler',args,{cwd:runtimeRoot,encoding:'utf8',timeout:180000});
  const output=tail((r.stdout||'')+(r.stderr||''));
  const url=(output.match(/https:\/\/[^\s]+\.pages\.dev[^\s]*/)||[])[0]||null;
  return {schema:'webforge.deployment-execution.v3',status:r.status===0?'PASS':'FAIL',mode,provider,url,detail:output,eligibility,checks};
}
