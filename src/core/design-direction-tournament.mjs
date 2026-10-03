import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { compose } from './compose.mjs';
import { compileWebUIDesignSpec } from './web-ui-contract.mjs';
import { compileWebUiBehaviorSpec } from './web-ui-behavior.mjs';
import { runWebUiQualityMatrix } from './web-ui-quality.mjs';
import { buildPerceptualReviewRequest } from './web-ui-perceptual-critic.mjs';
import { evaluateCandidateDesign, evaluateDomainFit } from './generator-tournament-design-score.mjs';
import {
  materializeStructuredCandidate,
  runUigenFxStructuredGeneration
} from './generator-tournament.mjs';
import {
  MIN_DIRECTION_DISTANCE,
  deriveNativeDirectionPlan,deriveContrastDirectionPlan,directionDistance,validateDesignDirectionPlan
} from './design-direction-contract.mjs';
export {MIN_DIRECTION_DISTANCE,deriveNativeDirectionPlan,deriveContrastDirectionPlan,directionDistance};

export const DESIGN_DIRECTION_TOURNAMENT_SCHEMA='webforge.design-direction-tournament.v1';
export const DESIGN_DIRECTION_SCORE_SCHEMA='webforge.design-direction-tournament-score.v1';
export const DESIGN_DIRECTION_REVIEWS_SCHEMA='webforge.design-direction-perceptual-reviews.v1';
export const MIN_DOMAIN_FIT=.80;

const now=()=>new Date().toISOString();
const clamp=value=>Math.max(0,Math.min(1,value));
const average=items=>items.length?items.reduce((a,b)=>a+b,0)/items.length:0;
const writeJson=(root,name,value)=>{
  fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
};function qualityCoverage(receipt){
  const required=(receipt?.viewports||[]).flatMap(v=>v.required||[]);
  return required.length?required.filter(x=>x.status==='PASS').length/required.length:0;
}
function directionHash(plan){return crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex');}
function pairwiseDistances(candidates){
  const pairs=[];
  for(let i=0;i<candidates.length;i++) for(let j=i+1;j<candidates.length;j++){
    pairs.push({a:candidates[i].id,b:candidates[j].id,distance:directionDistance(candidates[i].plan,candidates[j].plan)});
  }
  return pairs;
}
function candidateLabel(id){
  return id==='native'?'WEBFORGE native design direction':id==='contrast'?'WEBFORGE deterministic contrast direction':'UIGEN-FX structured design direction';
}
async function materializeAndEvaluate({id,brief,designSpec,behaviorSpec,plan,root,qualityRunner}){
  const generation={status:'PASS',structured_plan:plan,generation_mode:'design-direction-preview',duration_ms:0,truth_boundary:{release_authority:'NONE',production_authority:'NONE'}};
  materializeStructuredCandidate({brief,designSpec,behaviorSpec,root,generation,generatorId:`design-direction-${id}`,candidateLabel:candidateLabel(id)});
  const quality=await qualityRunner(root,{writeReceipt:true,visualRegression:false});
  const domainFit=evaluateDomainFit({root,designSpec});
  const request=buildPerceptualReviewRequest(root,{spec:designSpec,quality});
  writeJson(root,'web-ui-perceptual.request.json',request);
  const result={id,status:quality.status==='FAIL'?'FAIL':'REVIEW_REQUIRED',plan,plan_sha256:directionHash(plan),quality_coverage:Number(qualityCoverage(quality).toFixed(3)),domain_fit:domainFit,perceptual_request:{status:request.status,request_digest:request.request_digest,screenshot_sha256:Object.fromEntries((request.screenshots||[]).map(x=>[x.viewport,x.sha256]))},truth_boundary:{advisory_only:true,release_authority:'NONE',production_authority:'NONE'}};
  writeJson(root,'direction-candidate.receipt.json',result);
  return result;
}export async function runDesignDirectionTournament(brief,{outputRoot,modelPath,externalGenerator=runUigenFxStructuredGeneration,qualityRunner=runWebUiQualityMatrix,maxTokens=128,threads=8}={}){
  if(!brief?.trim()) throw new Error('Design Direction Tournament requires a brief');
  if(!outputRoot) throw new Error('Design Direction Tournament requires explicit evidence outputRoot');
  const plan=compose(brief),designSpec=compileWebUIDesignSpec(plan),behaviorSpec=compileWebUiBehaviorSpec(plan);
  const runId=`run-${new Date().toISOString().replace(/[:.]/g,'-')}`;
  const root=path.join(path.resolve(outputRoot),runId);fs.mkdirSync(root,{recursive:true});
  writeJson(root,'direction-tournament.input.json',{schema:'webforge.design-direction-tournament-input.v1',brief,design_spec:designSpec,behavior_spec:behaviorSpec});
  const nativePlan=deriveNativeDirectionPlan(designSpec),contrastPlan=deriveContrastDirectionPlan(nativePlan);
  const candidates=[];
  for(const [id,directionPlan] of [['native',nativePlan],['contrast',contrastPlan]]){
    const candidateRoot=path.join(root,id);
    const result=await materializeAndEvaluate({id,brief,designSpec,behaviorSpec,plan:directionPlan,root:candidateRoot,qualityRunner});
    candidates.push({...result,relative_root:id,source:{kind:'deterministic',duration_ms:0}});
  }
  const external=await externalGenerator({brief,designSpec,modelPath,maxTokens,threads});
  if(external.status==='PASS'&&validateDesignDirectionPlan(external.structured_plan).status==='PASS'){
    const candidateRoot=path.join(root,'uigen');
    const result=await materializeAndEvaluate({id:'uigen',brief,designSpec,behaviorSpec,plan:external.structured_plan,root:candidateRoot,qualityRunner});
    candidates.push({...result,relative_root:'uigen',source:{kind:'model',model:external.model||null,duration_ms:external.duration_ms||0,generation_mode:external.generation_mode||null}});
  } else {
    candidates.push({id:'uigen',status:external.status||'UNVERIFIED',plan:null,relative_root:null,source:{kind:'model',duration_ms:external.duration_ms||0},reason:external.reason||'MODEL_DIRECTION_UNAVAILABLE'});
  }
  const reviewable=candidates.filter(x=>x.plan&&x.perceptual_request?.status==='READY');
  const distances=pairwiseDistances(reviewable);
  const collisions=distances.filter(x=>x.distance<MIN_DIRECTION_DISTANCE);
  const status=reviewable.length>=2?'REVIEW_REQUIRED':'UNVERIFIED';
  const receipt={schema:DESIGN_DIRECTION_TOURNAMENT_SCHEMA,created_at:now(),status,run_id:runId,brief,design_spec_sha256:crypto.createHash('sha256').update(JSON.stringify(designSpec)).digest('hex'),candidate_count:candidates.length,reviewable_count:reviewable.length,candidates,direction_distances:distances,direction_collisions:collisions,minimum_direction_distance:MIN_DIRECTION_DISTANCE,selection:{status:'PENDING_PERCEPTUAL_REVIEW',selected:[]},promotion:{winner:null,status:'NOT_APPLICABLE'},truth_boundary:{pre_build_advisory_lane:true,default_generator_changed:false,release_authority:'NONE',production_authority:'NONE'}};
  writeJson(root,'design-direction-tournament.receipt.json',receipt);
  return {...receipt,output_root:root};
}function validateReviews(reviews){
  if(reviews?.schema!==DESIGN_DIRECTION_REVIEWS_SCHEMA) throw new Error(`${DESIGN_DIRECTION_REVIEWS_SCHEMA} required`);
  if(!reviews.reviews||typeof reviews.reviews!=='object') throw new Error('reviews map required');
  return reviews;
}
function candidateOriginality(id,reviewable,distances){
  const values=distances.filter(x=>x.a===id||x.b===id).map(x=>x.distance);
  return values.length?average(values):reviewable.length<=1?0:1;
}
function directionScore({quality,domainFit,perceptual,originality}){
  if(![quality,domainFit,perceptual,originality].every(Number.isFinite)) return {status:'UNVERIFIED',total:null};
  const parts={quality:15*quality,domain_fit:30*domainFit,perceptual:40*perceptual,originality:15*originality};
  return {status:'REVIEWED',...Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,Number(v.toFixed(2))])),total:Number(Object.values(parts).reduce((a,b)=>a+b,0).toFixed(2)),raw:{quality,domainFit,perceptual,originality}};
}
function greedySelect(ranked,plans,{topK,minDistance,eligible}){
  const selected=[];
  for(const item of ranked){
    if(selected.length>=topK) break;
    if(!Number.isFinite(item.score?.total)||!plans[item.id]||eligible?.[item.id]===false) continue;
    const distinct=selected.every(prev=>directionDistance(plans[item.id],plans[prev.id])>=minDistance);
    if(distinct) selected.push({id:item.id,score:item.score.total});
  }
  return selected;
}

export function rescoreDesignDirectionTournament(runRoot,{reviews,topK=3,minDistance=MIN_DIRECTION_DISTANCE}={}){
  reviews=validateReviews(reviews);
  topK=Math.max(2,Math.min(3,Number(topK)||3));
  minDistance=clamp(Number(minDistance)||MIN_DIRECTION_DISTANCE);
  const receipt=JSON.parse(fs.readFileSync(path.join(runRoot,'design-direction-tournament.receipt.json'),'utf8'));
  const input=JSON.parse(fs.readFileSync(path.join(runRoot,'direction-tournament.input.json'),'utf8'));
  const reviewable=(receipt.candidates||[]).filter(x=>x.plan&&x.relative_root);
  const distances=receipt.direction_distances||pairwiseDistances(reviewable);
  const evaluations={},plans={},scores={};
  for(const candidate of reviewable){
    const root=path.join(runRoot,candidate.relative_root);plans[candidate.id]=candidate.plan;
    const design=evaluateCandidateDesign({root,designSpec:input.design_spec,review:reviews.reviews[candidate.id]||null});
    evaluations[candidate.id]=design;
    scores[candidate.id]=directionScore({quality:candidate.quality_coverage,domainFit:design.domain_fit.score,perceptual:design.perceptual.score,originality:candidateOriginality(candidate.id,reviewable,distances)});
  }
  const allReviewed=reviewable.length>=2&&reviewable.every(x=>scores[x.id]?.status==='REVIEWED');
  const eligible=Object.fromEntries(reviewable.map(x=>[x.id,(evaluations[x.id]?.domain_fit?.score??0)>=MIN_DOMAIN_FIT]));
  const ranked=Object.entries(scores).map(([id,score])=>({id,score,eligible:eligible[id]!==false})).sort((a,b)=>(b.score.total??-1)-(a.score.total??-1));
  const selected=allReviewed?greedySelect(ranked,plans,{topK,minDistance,eligible}):[];
  const filtered_out=ranked.filter(x=>eligible[x.id]===false).map(x=>({id:x.id,reason:'DOMAIN_FIT_BELOW_THRESHOLD',domain_fit:evaluations[x.id]?.domain_fit?.score??null}));
  const status=allReviewed&&selected.length>=2?'REVIEWED':'UNVERIFIED';
  const result={schema:DESIGN_DIRECTION_SCORE_SCHEMA,created_at:now(),status,source_run:receipt.run_id,score_profile:'design-direction-pilot-v1',weights:{quality:15,domain_fit:30,perceptual:40,originality:15},minimum_direction_distance:minDistance,minimum_domain_fit:MIN_DOMAIN_FIT,scores,evaluations,ranking:ranked.map((x,index)=>({rank:index+1,id:x.id,total:x.score.total,status:x.score.status,eligible:x.eligible})),selection:{status:status==='REVIEWED'?'READY_FOR_HUMAN_CHOICE':'UNVERIFIED',selected,filtered_out},promotion:{winner:null,status:'NOT_APPLICABLE'},truth_boundary:{advisory_only:true,selection_is_not_build_authority:true,default_generator_changed:false,release_authority:'NONE',production_authority:'NONE'}};
  writeJson(runRoot,'design-direction-tournament.score.receipt.json',result);
  return result;
}