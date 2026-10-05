import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runBrowserQa } from './browser-qa.mjs';
import { runWebUiQualityMatrix } from './web-ui-quality.mjs';
import { critiqueWebUi, writeWebUiCritique } from './web-ui-critic.mjs';

const BEGIN='/* WEBFORGE_VISUAL_REFINEMENT_BEGIN */';
const END='/* WEBFORGE_VISUAL_REFINEMENT_END */';
const ALLOWED_ACTIONS=new Set(['stack-step-grid','collapse-owner-grid','stack-mobile-card-grid']);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const safeId=value=>/^[a-z0-9-]+$/.test(String(value||''))?String(value):null;

export function stripWebUiRefinement(css=''){
  const start=css.indexOf(BEGIN),end=css.indexOf(END);
  if(start<0&&end<0) return css;
  if(start<0||end<start) throw new Error('Malformed WEBFORGE visual refinement marker block');
  return (css.slice(0,start)+css.slice(end+END.length)).trimEnd()+'\n';
}

function ruleFor(operation){
  if(!ALLOWED_ACTIONS.has(operation.action)) throw new Error(`Unsupported visual repair action: ${operation.action}`);
  const id=safeId(operation.target?.owner_id); if(!id) throw new Error('Visual repair requires a safe section owner id');
  if(operation.action==='stack-step-grid') return {scope:'desktop',css:`#${id} .step-grid{grid-template-columns:1fr!important}#${id} .step-grid article{min-height:0!important;display:grid!important;grid-template-columns:54px minmax(180px,.45fr) minmax(0,1fr)!important;gap:20px!important;align-items:start!important;transform:none!important}#${id} .step-grid h3{margin:0!important}`};
  if(operation.action==='stack-mobile-card-grid') return {scope:'mobile',css:`#${id} .pro-card-grid,#${id} .domain-collection-grid,#${id} .feature-list{grid-template-columns:1fr!important}#${id} .pro-card-grid>*,#${id} .domain-collection-grid>*{grid-column:1!important}`};
  return {scope:'desktop',css:`#${id}.vc-section{grid-template-columns:1fr!important}#${id} .section-heading{grid-template-columns:1fr!important}#${id} .section-heading h2{max-width:18ch!important}`};
}

export function applyBoundedWebUiRepairs(projectDir,operations){
  const cssPath=path.resolve(projectDir,'styles.css'),root=path.resolve(projectDir)+path.sep;
  if(!cssPath.startsWith(root)||!fs.existsSync(cssPath)) throw new Error('Generated preview styles.css unavailable');
  const dedup=[]; const seen=new Set();
  for(const op of operations||[]){
    if(seen.has(op.id)) continue; seen.add(op.id); dedup.push(op);
  }
  const original=fs.readFileSync(cssPath,'utf8'); const base=stripWebUiRefinement(original);
  const rules=dedup.map(ruleFor);
  const desktop=rules.filter(x=>x.scope==='desktop').map(x=>x.css).join('');
  const mobile=rules.filter(x=>x.scope==='mobile').map(x=>x.css).join('');
  const scoped=[desktop?`@media(min-width:1001px){${desktop}}`:'',mobile?`@media(max-width:640px){${mobile}}`:''].filter(Boolean).join('');
  const block=scoped?`\n${BEGIN}\n${scoped}\n${END}\n`:'';
  const next=base.trimEnd()+block+'\n';
  fs.writeFileSync(cssPath,next);
  return {schema:'webforge.web-ui-bounded-repair.v1',status:'PASS',operations:dedup.map(x=>({id:x.id,action:x.action,target:x.target})),css_sha256_before:sha(original),css_sha256_after:sha(next),rollback:'remove WEBFORGE_VISUAL_REFINEMENT marker block'};
}

function qualityVerifiedPass(quality){return quality?.status==='PASS'&&(quality?.viewports||[]).length===3&&(quality?.viewports||[]).every(v=>v.status==='PASS'&&(v.required||[]).length>0&&(v.required||[]).every(x=>x.status==='PASS'));}
function readSpec(projectDir){return JSON.parse(fs.readFileSync(path.join(projectDir,'web-ui-design-spec.json'),'utf8'));}

export async function runWebUiVisualCritic(projectDir,{qaRunner=runBrowserQa,writeReceipt=true}={}){
  const spec=readSpec(projectDir);
  const quality=await runWebUiQualityMatrix(projectDir,{qaRunner,writeReceipt:true,visualRegression:false});
  const critique=critiqueWebUi({spec,quality});
  if(writeReceipt) writeWebUiCritique(projectDir,critique);
  return {spec,quality,critique};
}

export async function runWebUiRefinement(projectDir,{qaRunner=runBrowserQa,maxIterations=1,writeReceipt=true,perceptualCritique=null}={}){
  if(!Number.isInteger(maxIterations)||maxIterations<0||maxIterations>1) throw new Error('maxIterations must be 0 or 1');
  const cssPath=path.join(projectDir,'styles.css');
  if(!fs.existsSync(cssPath)) throw new Error('Generated preview styles.css unavailable');
  const sourceCss=fs.readFileSync(cssPath,'utf8');
  const sourceCssSha=sha(sourceCss);
  const spec=readSpec(projectDir);
  let quality=await runWebUiQualityMatrix(projectDir,{qaRunner,writeReceipt:true,visualRegression:false});
  let critique=critiqueWebUi({spec,quality});
  const critiqueHistory=[critique]; const iterations=[]; const accepted=[];
  let rolledBack=false;
  const perceptualGuard=perceptualCritique?{provided:true,schema:perceptualCritique.schema||null,status:perceptualCritique.status||'UNVERIFIED',advisory_only:true,granted_repair_authority:false}:{provided:false,status:'NOT_PROVIDED',advisory_only:true,granted_repair_authority:false};
  if(perceptualCritique&&perceptualCritique.schema!=='webforge.web-ui-perceptual-critique.v1') throw new Error('webforge.web-ui-perceptual-critique.v1 required');
  const perceptualBlocks=perceptualCritique&&['BLOCKED','UNVERIFIED'].includes(perceptualCritique.status);

  for(let i=0;i<maxIterations&&!perceptualBlocks&&critique.status==='REPAIR_REQUIRED';i++){
    const beforeCss=fs.readFileSync(cssPath,'utf8');
    const beforeRepairable=critique.repair_plan.length; const beforeP1=Number(critique.issue_counts?.P1||0);
    const additions=critique.repair_plan.filter(op=>!accepted.some(x=>x.id===op.id));
    if(!additions.length) break;
    const candidate=[...accepted,...additions];
    const repair=applyBoundedWebUiRepairs(projectDir,candidate);
    const nextQuality=await runWebUiQualityMatrix(projectDir,{qaRunner,writeReceipt:true,visualRegression:false});
    const nextCritique=critiqueWebUi({spec,quality:nextQuality});
    const improved=qualityVerifiedPass(nextQuality)&&nextCritique.repair_plan.length<beforeRepairable&&Number(nextCritique.issue_counts?.P1||0)<beforeP1;
    const record={iteration:i+1,repair,before_repairable:beforeRepairable,after_repairable:nextCritique.repair_plan.length,quality_status:nextQuality.status,accepted:improved};
    iterations.push(record);
    if(!improved){
      fs.writeFileSync(cssPath,beforeCss); rolledBack=true; break;
    }
    accepted.splice(0,accepted.length,...candidate); quality=nextQuality; critique=nextCritique; critiqueHistory.push(critique);
  }

  if(rolledBack){
    quality=await runWebUiQualityMatrix(projectDir,{qaRunner,writeReceipt:true,visualRegression:false});
    critique=critiqueWebUi({spec,quality}); critiqueHistory.push(critique);
  }
  if(writeReceipt) writeWebUiCritique(projectDir,critique);
  const cssAfter=fs.readFileSync(cssPath,'utf8');
  const status=perceptualBlocks?'BLOCKED':rolledBack?'ROLLED_BACK':critique.status==='BLOCKED'?'BLOCKED':critique.status==='REPAIR_REQUIRED'?'PARTIALLY_VERIFIED':critique.status;
  const receipt={
    schema:'webforge.web-ui-refinement-receipt.v1',status,
    source_css_sha256:sourceCssSha,final_css_sha256:sha(cssAfter),
    max_iterations:maxIterations,iterations,accepted_operations:accepted.map(x=>({id:x.id,action:x.action,target:x.target})),
    perceptual_guard:perceptualGuard,
    final_critique:{status:critique.status,issue_counts:critique.issue_counts},
    rollback:{available:true,method:'remove WEBFORGE_VISUAL_REFINEMENT marker block or restore source CSS',automatic_rollback_executed:rolledBack},
    truth_boundary:{preview_only:true,runtime_native_source_sync:'NOT_PERFORMED',release_gate_changed:false,production_authority:'NONE',human_review_required:critique.decision.human_review_required}
  };
  if(writeReceipt) fs.writeFileSync(path.join(projectDir,'web-ui-refinement.receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  return {quality,critique,receipt,critiqueHistory};
}
