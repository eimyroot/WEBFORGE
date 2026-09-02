import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateWebsite, generatedProjectDir } from './generator.mjs';
import { fulfillMedia } from './media-fulfillment.mjs';
import { fulfillContent } from './content-fulfillment.mjs';
import { connectorExecutionPlan } from './live-connectors.mjs';
import { runBrowserQa } from './browser-qa.mjs';
import { verifyRuntimeBuild } from './runtime-build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');

function bindFulfilledMedia(projectDir){
  const mediaPath=path.join(projectDir,'media.fulfillment.json');
  if(!fs.existsSync(mediaPath)) return {status:'UNVERIFIED',bound:0};
  const media=readJson(mediaPath); const assets=media.items.filter(x=>x.asset).map(x=>'./'+x.asset);
  if(!assets.length) return {status:'UNVERIFIED',bound:0};
  const htmlPath=path.join(projectDir,'index.html'); if(!fs.existsSync(htmlPath)) return {status:'FAIL',bound:0};
  let html=fs.readFileSync(htmlPath,'utf8'), i=0;
  html=html.replace(/src="\.\/assets\/media\/[^"]+"/g,()=>`src="${assets[(i++)%assets.length]}"`);
  fs.writeFileSync(htmlPath,html);
  const runtimePublic=path.join(projectDir,'runtime','public','assets','fulfilled');
  fs.mkdirSync(runtimePublic,{recursive:true});
  for(const item of media.items.filter(x=>x.asset)){
    const src=path.join(projectDir,item.asset); if(fs.existsSync(src)) fs.copyFileSync(src,path.join(runtimePublic,path.basename(src)));
  }
  const receipt={schema:'webforge.media-binding.v1',status:i>0?'PASS':'UNVERIFIED',bound:i,available:assets.length}; write(path.join(projectDir,'media.binding.receipt.json'),receipt); return receipt;
}

function critique(projectDir,qa){
  const html=fs.readFileSync(path.join(projectDir,'index.html'),'utf8');
  const issues=[];
  if(!/<title>[^<]{3,}<\/title>/i.test(html)) issues.push({id:'document-title',severity:'high'});
  if(!/<nav[\s>]/i.test(html)) issues.push({id:'navigation',severity:'medium'});
  if(/data-(?:template|renderer|role|variant)=/i.test(html)) issues.push({id:'internal-implementation-leak',severity:'medium'});
  for(const c of qa.checks||[]) if(c.status==='FAIL') issues.push({id:`qa:${c.id}`,severity:'high'});
  const penalty=issues.reduce((n,x)=>n+(x.severity==='high'?12:6),0);
  return {schema:'webforge.factory-critique.v1',status:issues.length?'REPAIR_REQUIRED':'PASS',score:Math.max(0,100-penalty),issues};
}

function autoRepair(projectDir,critique){
  const htmlPath=path.join(projectDir,'index.html'); let html=fs.readFileSync(htmlPath,'utf8'); const applied=[];
  for(const issue of critique.issues){
    if(issue.id==='document-title' && !/<title>/i.test(html)){html=html.replace(/<head>/i,'<head><title>WEBFORGE Project</title>'); applied.push(issue.id);}
    if(issue.id==='navigation' && !/<nav[\s>]/i.test(html)){html=html.replace(/<main/i,'<nav aria-label="Primary"><a href="#main">Skip to content</a></nav><main id="main"'); applied.push(issue.id);}
    if(issue.id==='internal-implementation-leak'){html=html.replace(/\sdata-(?:template|renderer|role|variant)="[^"]*"/gi,''); applied.push(issue.id);}
  }
  fs.writeFileSync(htmlPath,html); const receipt={schema:'webforge.factory-repair.v1',status:'PASS',applied}; write(path.join(projectDir,'auto-repair.receipt.json'),receipt); return receipt;
}

function productionGate({content,media,connectors,runtimeBuild,qa,critique,productionApproved}){
  const connectorPass=(connectors.connectors||[]).filter(x=>['cms','ticketing'].includes(x.id)).every(x=>x.status==='PASS');
  const checks=[
    {id:'content-approved',status:content.status==='PASS'?'PASS':'BLOCKED'},
    {id:'media-approved',status:media.status==='PASS'?'PASS':'BLOCKED'},
    {id:'live-connectors-executed',status:connectorPass?'PASS':'BLOCKED'},
    {id:'native-runtime-build',status:runtimeBuild.status==='PASS'?'PASS':runtimeBuild.status||'UNVERIFIED'},
    {id:'browser-qa',status:qa.status==='PASS'?'PASS':qa.status},
    {id:'final-critique',status:critique.status==='PASS'?'PASS':'BLOCKED'},
    {id:'explicit-production-approval',status:productionApproved?'PASS':'BLOCKED'}
  ];
  return {status:checks.every(x=>x.status==='PASS')?'PASS':'BLOCKED',checks};
}

export async function runAutonomousFactory(brief,options={}){
  const {
    approveContent=false,
    approveMedia=false,
    allowNetwork=false,
    productionApproved=false,
    maxRepairs=2,
    qaRunner=null
  }=options;
  const executeQa=typeof qaRunner==='function'?qaRunner:runBrowserQa;
  const qaMode=typeof qaRunner==='function'?'INJECTED_TEST_RUNNER':'REAL_BROWSER';
  const stages=[]; const mark=(id,status,detail={})=>stages.push({id,status,...detail});
  mark('research','PASS',{mode:'deterministic-brief-analysis'});
  const generated=generateWebsite(brief); const dir=generatedProjectDir(generated.projectId); if(!dir) throw new Error('Generated project unavailable');
  mark('product-model','PASS',{domain:generated.universal?.classification||generated.plan?.domain?.classification});
  mark('design-dna','PASS',{mode:generated.universal?.designMode||generated.plan?.designDNA?.mode});
  mark('component-synthesis','PASS',{projectId:generated.projectId});
  const content=fulfillContent(dir,{source:'factory-seed',approve:approveContent}); mark('content',content.status);
  const media=fulfillMedia(dir,{assetDir:path.join(root,'demo-media'),approve:approveMedia}); mark('media',media.status,{fulfilled:media.fulfilled});
  const mediaBinding=bindFulfilledMedia(dir); mark('media-binding',mediaBinding.status,{bound:mediaBinding.bound});
  const connectors=connectorExecutionPlan(dir); mark('connectors','READY',{items:connectors.connectors.map(x=>({id:x.id,status:x.status}))});
  const runtimeBuild=verifyRuntimeBuild(path.join(dir,'runtime'),{allowNetwork}); write(path.join(dir,'runtime-build.receipt.json'),runtimeBuild); mark('runtime-build',runtimeBuild.status);
  let qa=await executeQa(dir,{baseline:true}); if((qa.checks||[]).some(x=>x.status==='BASELINE_CREATED')) qa=await executeQa(dir,{baseline:true}); mark('browser-qa',qa.status,{mode:qaMode});
  let review=critique(dir,qa); let repairs=0; const history=[review];
  while(review.status!=='PASS' && repairs<maxRepairs){ autoRepair(dir,review); repairs++; qa=await executeQa(dir,{baseline:false}); review=critique(dir,qa); history.push(review); }
  mark('browser-critique',review.status,{score:review.score,repairs});
  const preview={status:qa.status==='PASS'&&review.status==='PASS'?'PREVIEW_READY':'BLOCKED',url:`/preview/${generated.projectId}/`}; mark('preview',preview.status,{url:preview.url});
  const production=productionGate({content,media,connectors,runtimeBuild,qa,critique:review,productionApproved}); mark('production',production.status);
  const result={schema:'webforge.autonomous-factory.v1',version:'9.1.0',status:preview.status==='PREVIEW_READY'?'PASS':'FAIL',projectId:generated.projectId,projectDir:dir,stages,critiqueHistory:history,preview,production,truthBoundary:{portablePreview:preview.status,browserQaMode:qaMode,nativeRuntimeBuild:runtimeBuild.status,externalConnectors:'NOT_EXECUTED_BY_FACTORY_CORE',production:production.status}};
  write(path.join(dir,'factory.receipt.json'),result); return result;
}
