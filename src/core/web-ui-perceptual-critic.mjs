import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WEB_UI_VIEWPORTS } from './web-ui-contract.mjs';
import { runWebUiQualityMatrix } from './web-ui-quality.mjs';

export const PERCEPTUAL_REQUEST_SCHEMA='webforge.web-ui-perceptual-request.v1';
export const PERCEPTUAL_EVALUATOR_SCHEMA='webforge.web-ui-perceptual-evaluator-output.v1';
export const PERCEPTUAL_CRITIQUE_SCHEMA='webforge.web-ui-perceptual-critique.v1';

const CATEGORIES=new Set(['visual-hierarchy','typography','spacing-rhythm','composition','design-direction-fidelity','genericity','imagery','mobile-readability']);
const ACTIONS=new Set(['none','increase-heading-dominance','reduce-competing-metadata','increase-section-whitespace','simplify-composition','improve-image-prominence','improve-mobile-reading-order','reduce-generic-ui-patterns','review-typography-scale']);
const VIEWPORT_IDS=new Set(WEB_UI_VIEWPORTS.map(x=>x.id));
const SAFE_ID=/^[a-z0-9-]+$/;
const FORBIDDEN_KEYS=new Set(['css','code','patch','html','javascript','commands','files','shell','selector']);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const digestJson=value=>sha(JSON.stringify(value));

function inside(root,file){
  const base=path.resolve(root)+path.sep;
  const resolved=path.resolve(path.isAbsolute(String(file||''))?String(file):path.join(root,String(file||'')));
  return resolved.startsWith(base)?resolved:null;
}

function forbiddenKeys(value,found=new Set()){
  if(Array.isArray(value)){ for(const item of value) forbiddenKeys(item,found); return found; }
  if(!value||typeof value!=='object') return found;
  for(const [key,item] of Object.entries(value)){
    if(FORBIDDEN_KEYS.has(String(key).toLowerCase())) found.add(String(key));
    forbiddenKeys(item,found);
  }
  return found;
}

function loadProjectJson(projectDir,name){
  const file=path.join(projectDir,name);
  if(!fs.existsSync(file)) throw new Error(`${name} unavailable`);
  return JSON.parse(fs.readFileSync(file,'utf8'));
}

export function buildPerceptualReviewRequest(projectDir,{spec,quality}={}){
  spec=spec||loadProjectJson(projectDir,'web-ui-design-spec.json');
  quality=quality||loadProjectJson(projectDir,'web-ui-quality.receipt.json');
  if(spec?.schema!=='WebUIDesignSpec/v1') throw new Error('WebUIDesignSpec/v1 required');
  if(quality?.schema!=='webforge.web-ui-quality-receipt.v1') throw new Error('webforge.web-ui-quality-receipt.v1 required');
  const blockers=[]; const screenshots=[];
  if(quality.status!=='PASS') blockers.push(`quality:${quality.status||'UNVERIFIED'}`);
  const byId=new Map((quality.viewports||[]).map(x=>[x.viewport?.id,x]));
  for(const vp of WEB_UI_VIEWPORTS){
    const item=byId.get(vp.id);
    if(!item||item.status!=='PASS'){blockers.push(`viewport:${vp.id}:${item?.status||'MISSING'}`);continue;}
    const file=item.screenshot&&inside(projectDir,item.screenshot);
    if(!file||!fs.existsSync(file)){blockers.push(`screenshot:${vp.id}:MISSING_OR_OUTSIDE_PROJECT`);continue;}
    screenshots.push({viewport:vp.id,width:vp.width,height:vp.height,path:path.relative(projectDir,file),sha256:sha(fs.readFileSync(file))});
  }
  const core={
    schema:PERCEPTUAL_REQUEST_SCHEMA,
    status:blockers.length?'BLOCKED':'READY',
    blockers,
    design_direction:{name:spec.direction?.name||null,intent:spec.direction?.intent||null,keywords:spec.direction?.keywords||[]},
    visual_acceptance:spec.acceptance?.visual||[],
    components:(spec.components||[]).map(x=>({id:x.id,role:x.role,template:x.template})),
    screenshots,
    rubric:[...CATEGORIES],
    output_contract:{schema:PERCEPTUAL_EVALUATOR_SCHEMA,max_observations:24,confidence_range:[0,1],severity:['P1','P2','P3'],allowed_actions:[...ACTIONS]},
    policy:{advisory_only:true,no_code_or_css:true,no_release_authority:true,deterministic_corroboration_required_for_repairs:true,human_review_required:true}
  };
  return {...core,request_digest:digestJson(core)};
}

function validateObservation(obs,index){
  const errors=[];
  if(!obs||typeof obs!=='object') return {errors:[`observations[${index}] must be object`]};
  if(!CATEGORIES.has(obs.category)) errors.push(`observations[${index}].category invalid`);
  if(!['P1','P2','P3'].includes(obs.severity)) errors.push(`observations[${index}].severity invalid`);
  if(!Number.isFinite(obs.confidence)||obs.confidence<0||obs.confidence>1) errors.push(`observations[${index}].confidence invalid`);
  if(obs.viewport&&!VIEWPORT_IDS.has(obs.viewport)) errors.push(`observations[${index}].viewport invalid`);
  if(obs.section_id&& !SAFE_ID.test(String(obs.section_id))) errors.push(`observations[${index}].section_id invalid`);
  if(typeof obs.summary!=='string'||obs.summary.trim().length<12||obs.summary.length>320) errors.push(`observations[${index}].summary invalid`);
  if(!ACTIONS.has(obs.suggested_action||'none')) errors.push(`observations[${index}].suggested_action invalid`);
  if(!Array.isArray(obs.evidence_viewports)||!obs.evidence_viewports.length||obs.evidence_viewports.some(x=>!VIEWPORT_IDS.has(x))) errors.push(`observations[${index}].evidence_viewports invalid`);
  return {errors};
}

export function evaluatePerceptualVisualCritic({request,evaluatorOutput}){
  if(request?.schema!==PERCEPTUAL_REQUEST_SCHEMA) throw new Error(`${PERCEPTUAL_REQUEST_SCHEMA} required`);
  if(request.status!=='READY') return {
    schema:PERCEPTUAL_CRITIQUE_SCHEMA,status:'BLOCKED',issues:[],invalid:[],
    reason:'perceptual request is not READY',request_digest:request.request_digest||null,
    decision:{automatic_repair_allowed:false,human_review_required:true},
    policy:{advisory_only:true,deterministic_corroboration_required:true,release_authority:'NONE'}
  };
  if(!evaluatorOutput) return {
    schema:PERCEPTUAL_CRITIQUE_SCHEMA,status:'UNVERIFIED',issues:[],invalid:[],
    reason:'no reviewed human/VLM evaluator output supplied',request_digest:request.request_digest,
    decision:{automatic_repair_allowed:false,human_review_required:true},
    policy:{advisory_only:true,deterministic_corroboration_required:true,release_authority:'NONE'}
  };
  const errors=[];
  if(evaluatorOutput.schema!==PERCEPTUAL_EVALUATOR_SCHEMA) errors.push('evaluator schema invalid');
  if(evaluatorOutput.request_digest!==request.request_digest) errors.push('request digest mismatch');
  const evaluator=evaluatorOutput.evaluator||{};
  if(!['human','vlm'].includes(evaluator.mode)||!evaluator.id||!evaluator.version) errors.push('evaluator identity invalid');
  const observations=Array.isArray(evaluatorOutput.observations)?evaluatorOutput.observations:[];
  if(observations.length>24) errors.push('too many observations');
  const forbidden=[...forbiddenKeys(evaluatorOutput)];
  if(forbidden.length) errors.push(`forbidden executable/content keys: ${forbidden.sort().join(',')}`);
  observations.forEach((obs,index)=>errors.push(...validateObservation(obs,index).errors));
  if(errors.length) return {
    schema:PERCEPTUAL_CRITIQUE_SCHEMA,status:'BLOCKED',issues:[],invalid:errors,
    reason:'untrusted perceptual output violated contract',request_digest:request.request_digest,
    evaluator:{id:evaluator.id||null,version:evaluator.version||null,mode:evaluator.mode||null},
    decision:{automatic_repair_allowed:false,human_review_required:true},
    policy:{advisory_only:true,deterministic_corroboration_required:true,release_authority:'NONE'}
  };
  const lowConfidence=observations.filter(x=>x.confidence<0.65);
  const issues=observations.filter(x=>x.confidence>=0.65).map((x,index)=>({
    id:x.id||`perceptual:${index+1}`,category:x.category,severity:x.severity,confidence:x.confidence,
    viewport:x.viewport||null,section_id:x.section_id||null,summary:x.summary.trim(),
    evidence_viewports:x.evidence_viewports,suggested_action:x.suggested_action||'none',
    repair_authority:'NONE',deterministic_corroboration_required:true
  }));
  return {
    schema:PERCEPTUAL_CRITIQUE_SCHEMA,
    status:issues.length?'REVIEW_REQUIRED':'ADVISORY_PASS',
    issues,low_confidence:lowConfidence.map(x=>({id:x.id||null,category:x.category,confidence:x.confidence,summary:x.summary})),invalid:[],
    request_digest:request.request_digest,
    evaluator:{id:evaluator.id,version:evaluator.version,mode:evaluator.mode},
    decision:{automatic_repair_allowed:false,human_review_required:true,max_automatic_iterations:1},
    policy:{advisory_only:true,no_code_or_css:true,semantic_changes:false,media_approval:false,deterministic_corroboration_required:true,release_authority:'NONE'},
    truth_boundary:{aesthetic_judgement:'ADVISORY_NOT_VERIFICATION',browser_quality_authority:'webforge.web-ui-quality-receipt.v1',production_authority:'NONE'}
  };
}

export async function runPerceptualReviewRequest(projectDir,{qaRunner,writeReceipt=true}={}){
  const quality=await runWebUiQualityMatrix(projectDir,{qaRunner,writeReceipt:true,visualRegression:false});
  const spec=loadProjectJson(projectDir,'web-ui-design-spec.json');
  const request=buildPerceptualReviewRequest(projectDir,{spec,quality});
  if(writeReceipt) fs.writeFileSync(path.join(projectDir,'web-ui-perceptual.request.json'),JSON.stringify(request,null,2)+'\n');
  return request;
}

export function runPerceptualVisualCritic(projectDir,{evaluatorOutput,writeReceipt=true}={}){
  const request=loadProjectJson(projectDir,'web-ui-perceptual.request.json');
  const critique=evaluatePerceptualVisualCritic({request,evaluatorOutput});
  if(writeReceipt) fs.writeFileSync(path.join(projectDir,'web-ui-perceptual-critique.json'),JSON.stringify(critique,null,2)+'\n');
  return critique;
}
