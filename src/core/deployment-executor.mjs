import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { evaluateDeployment } from './deployment.mjs';
import { visualReadinessChecks } from './visual-readiness.mjs';
import { CANONICAL_PRODUCT_KEY, validatePredeployOutputDigest } from './artifact-provenance.mjs';

const REPO_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const RECEIPT_SCHEMA='webforge.deployment-execution.v6';
const tail=s=>String(s||'').slice(-6000);
const hasCommand=cmd=>spawnSync('sh',['-lc',`command -v ${cmd}`],{encoding:'utf8'}).status===0;
const first=(...values)=>values.find(v=>typeof v==='string'&&v.trim())?.trim()||null;
const sourceSha=explicit=>first(explicit,process.env.WEBFORGE_SOURCE_SHA,process.env.VERCEL_GIT_COMMIT_SHA,process.env.GITHUB_SHA,process.env.CI_COMMIT_SHA);

export function loadCanonicalProductionTarget(repoRoot=REPO_ROOT){
  return JSON.parse(fs.readFileSync(path.join(repoRoot,'config','production-target.json'),'utf8'));
}

export function readCheckoutState(repoRoot=REPO_ROOT,{spawn=spawnSync}={}){
  const head=spawn('git',['-C',repoRoot,'rev-parse','HEAD'],{encoding:'utf8'});
  const status=spawn('git',['-C',repoRoot,'status','--porcelain'],{encoding:'utf8'});
  return {
    sha:head.status===0?String(head.stdout||'').trim()||null:null,
    clean:status.status===0?String(status.stdout||'').trim()==='':false,
    verified:head.status===0&&status.status===0
  };
}

export function validateCanonicalVercelProductionBinding({targetRecord,provider,teamId,projectId,sourceSha:expectedSourceSha,checkoutSha,checkoutClean,productionApproved}){
  const blockers=[];
  if(targetRecord?.status!=='CANONICAL') blockers.push('canonical-target-status');
  if(targetRecord?.scope!=='production-hosting-target-identity') blockers.push('canonical-target-scope');
  if(targetRecord?.provider!=='vercel') blockers.push('canonical-provider');
  const canonicalTeamId=first(targetRecord?.target?.teamId);
  const canonicalProjectId=first(targetRecord?.target?.projectId);
  if(!canonicalTeamId) blockers.push('canonical-team-id-missing');
  if(!canonicalProjectId) blockers.push('canonical-project-id-missing');
  if(provider!=='vercel') blockers.push('provider-mismatch');
  if(!teamId) blockers.push('team-id-missing');
  else if(canonicalTeamId&&teamId!==canonicalTeamId) blockers.push('team-id-mismatch');
  if(!projectId) blockers.push('project-id-missing');
  else if(canonicalProjectId&&projectId!==canonicalProjectId) blockers.push('project-id-mismatch');
  if(!expectedSourceSha) blockers.push('source-sha-missing');
  if(!checkoutSha) blockers.push('checkout-sha-missing');
  else if(expectedSourceSha&&checkoutSha!==expectedSourceSha) blockers.push('checkout-sha-mismatch');
  if(checkoutClean!==true) blockers.push('checkout-not-clean');
  if(productionApproved!==true) blockers.push('production-approval-missing');
  return {eligible:blockers.length===0,status:blockers.length===0?'ELIGIBLE':'BLOCKED',blockers,canonicalTeamId,canonicalProjectId};
}

export function buildVercelInvocation({mode,teamId,projectId}){
  if(!teamId||!projectId) throw new Error('explicit Vercel teamId and projectId are required');
  const args=['deploy'];
  if(mode==='production') args.push('--prebuilt');
  args.push('--yes','--project',projectId,'-T',teamId);
  if(mode==='production') args.push('--prod');
  return {command:'vercel',args,env:{VERCEL_ORG_ID:teamId,VERCEL_PROJECT_ID:projectId}};
}

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

function receiptBase({repository,branch,sourceSha:sha,provider,teamId,projectId,mode,eligibility,checks}){
  return {schema:RECEIPT_SCHEMA,repository,branch,sourceSha:sha,provider,teamId,projectId,mode,eligibility,checks};
}

export function deploymentResult({repository=null,branch=null,sourceSha:sha=null,mode,provider,teamId=null,projectId=null,eligibility=null,checks=[],commandStatus,output,url}){
  const base=receiptBase({repository,branch,sourceSha:sha,provider,teamId,projectId,mode,eligibility,checks});
  if(commandStatus!==0) return {...base,status:'FAIL',verificationStatus:'FAIL',deploymentUrl:null,url:null,detail:output};
  if(!url) return {...base,status:'UNVERIFIED',verificationStatus:'UNVERIFIED',deploymentUrl:null,url:null,detail:`Deployment command exited 0 but no deployment URL was captured.\n${output}`};
  return {...base,status:'PASS',verificationStatus:'VERIFIED',deploymentUrl:url,url,detail:output};
}

function validateBuildReceiptBinding(buildReceipt,{sourceSha:sha,teamId,projectId}){
  const blockers=[];
  if(buildReceipt?.productKey!==CANONICAL_PRODUCT_KEY) blockers.push('build-product-key-mismatch');
  if(buildReceipt?.sourceSha!==sha) blockers.push('build-source-sha-mismatch');
  if(buildReceipt?.target?.provider!=='vercel') blockers.push('build-provider-mismatch');
  if(buildReceipt?.target?.teamId!==teamId) blockers.push('build-team-mismatch');
  if(buildReceipt?.target?.projectId!==projectId) blockers.push('build-project-mismatch');
  return {eligible:blockers.length===0,status:blockers.length?'BLOCKED':'ELIGIBLE',blockers};
}

export function executeDeployment(projectDir,{mode='preview',provider='vercel',productionApproved=false,teamId=null,projectId=null,expectedSourceSha=null,repository=null,branch=null,repoRoot=REPO_ROOT}={}){
  if(!['preview','production'].includes(mode)) throw new Error('mode must be preview or production');
  if(!['vercel','cloudflare'].includes(provider)) throw new Error('provider must be vercel or cloudflare');
  const checks=gateChecks(projectDir);
  const eligibility=evaluateDeployment({checks},{productionApproved});
  const eligible=mode==='preview'?eligibility.previewEligible:eligibility.productionEligible;
  const sha=sourceSha(expectedSourceSha);
  const resolvedRepository=first(repository,process.env.WEBFORGE_REPOSITORY,process.env.GITHUB_REPOSITORY);
  const resolvedBranch=first(branch,process.env.WEBFORGE_BRANCH,process.env.GITHUB_REF_NAME);
  const resolvedTeamId=first(teamId,process.env.VERCEL_ORG_ID);
  const resolvedProjectId=first(projectId,process.env.VERCEL_PROJECT_ID);
  const base=receiptBase({repository:resolvedRepository,branch:resolvedBranch,sourceSha:sha,provider,teamId:resolvedTeamId,projectId:resolvedProjectId,mode,eligibility,checks});
  if(!eligible) return {...base,status:'BLOCKED',verificationStatus:'BLOCKED'};

  const runtimeRoot=path.join(projectDir,'runtime');
  let predeploy=null;
  if(provider==='vercel'){
    if(mode==='production'){
      let targetRecord;
      try{targetRecord=loadCanonicalProductionTarget(repoRoot);}catch(error){return {...base,status:'BLOCKED',verificationStatus:'BLOCKED',detail:`canonical target unreadable: ${error.message}`};}
      const checkout=readCheckoutState(repoRoot);
      const binding=validateCanonicalVercelProductionBinding({targetRecord,provider,teamId:resolvedTeamId,projectId:resolvedProjectId,sourceSha:sha,checkoutSha:checkout.sha,checkoutClean:checkout.verified&&checkout.clean,productionApproved});
      if(!binding.eligible) return {...base,status:'BLOCKED',verificationStatus:'BLOCKED',detail:`production provenance blocked: ${binding.blockers.join(', ')}`,provenance:binding};
      const buildReceiptPath=path.join(projectDir,'build-artifact.receipt.json');
      if(!fs.existsSync(buildReceiptPath)) return {...base,status:'BLOCKED',verificationStatus:'BLOCKED',detail:'prebuilt provenance blocked: build-artifact.receipt.json missing',provenance:{binding,predeploy:{status:'BLOCKED',blockers:['build-receipt-missing']}}};
      let buildReceipt;
      try{buildReceipt=JSON.parse(fs.readFileSync(buildReceiptPath,'utf8'));}catch(error){return {...base,status:'BLOCKED',verificationStatus:'BLOCKED',detail:`prebuilt provenance blocked: unreadable build receipt: ${error.message}`,provenance:{binding}};}
      const receiptBinding=validateBuildReceiptBinding(buildReceipt,{sourceSha:sha,teamId:resolvedTeamId,projectId:resolvedProjectId});
      const digestValidation=validatePredeployOutputDigest({runtimeRoot,buildReceipt});
      const blockers=[...receiptBinding.blockers,...digestValidation.blockers];
      predeploy={status:blockers.length?'BLOCKED':'ELIGIBLE',eligible:blockers.length===0,blockers,approvedBuildReceiptOutputTreeDigest:digestValidation.approvedBuildReceiptOutputTreeDigest,actualPredeployOutputTreeDigest:digestValidation.actualPredeployOutputTreeDigest};
      if(blockers.length) return {...base,status:'BLOCKED',verificationStatus:'BLOCKED',detail:`prebuilt provenance blocked: ${blockers.join(', ')}`,provenance:{binding,predeploy}};
    }
    if(!hasCommand('vercel')) return {...base,status:'UNVERIFIED',verificationStatus:'UNVERIFIED',detail:'vercel CLI unavailable'};
    let invocation={command:'vercel',args:['deploy','--yes'],env:{}};
    if(mode==='production'){
      try{invocation=buildVercelInvocation({mode,teamId:resolvedTeamId,projectId:resolvedProjectId});}catch(error){return {...base,status:'BLOCKED',verificationStatus:'BLOCKED',detail:error.message};}
    }
    const r=spawnSync(invocation.command,invocation.args,{cwd:runtimeRoot,encoding:'utf8',timeout:180000,env:{...process.env,...invocation.env}});
    const output=tail((r.stdout||'')+(r.stderr||''));
    const url=(output.match(/https:\/\/[^\s]+\.vercel\.app[^\s]*/)||[])[0]||null;
    const result=deploymentResult({...base,commandStatus:r.status,output,url});
    return predeploy?{...result,predeploy}:result;
  }

  if(!hasCommand('wrangler')) return {...base,status:'UNVERIFIED',verificationStatus:'UNVERIFIED',detail:'wrangler CLI unavailable'};
  const buildDir=fs.existsSync(path.join(runtimeRoot,'dist'))?'dist':fs.existsSync(path.join(runtimeRoot,'.vercel','output','static'))?'.vercel/output/static':null;
  if(!buildDir) return {...base,status:'FAIL',verificationStatus:'FAIL',detail:'no static build output for Cloudflare Pages'};
  const args=['pages','deploy',buildDir]; if(mode==='production') args.push('--branch','main');
  const r=spawnSync('wrangler',args,{cwd:runtimeRoot,encoding:'utf8',timeout:180000});
  const output=tail((r.stdout||'')+(r.stderr||''));
  const url=(output.match(/https:\/\/[^\s]+\.pages\.dev[^\s]*/)||[])[0]||null;
  return deploymentResult({...base,commandStatus:r.status,output,url});
}
