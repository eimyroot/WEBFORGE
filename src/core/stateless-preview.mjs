import crypto from 'node:crypto';
import { compose } from './compose.mjs';
import { renderWebsite, renderCss } from './visual-renderer.mjs';
import { buildMediaDataUris } from './media-assets.mjs';
import { compileWebUIDesignSpec } from './web-ui-contract.mjs';
import { deriveNativeDirectionPlan, deriveContrastDirectionPlan, directionDistance } from './design-direction-contract.mjs';
import { applyDesignDirectionToPlan } from './design-direction-bridge.mjs';

export const STATELESS_DIRECTIONS_SCHEMA='webforge.stateless-design-directions.v1';
const slugify=(value='website')=>String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)||'website';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function inlinePreview(html,css){return html.replace(/<link rel="stylesheet" href="[^\"]*styles\.css">/,`<style>${css}</style>`);}
function prepareMedia(plan,brief,id){
  const media=buildMediaDataUris(plan.visual,`${brief}|${id}`);
  for(const slot of plan.visual.media.slots)slot.src=media[slot.id]||null;
  for(const section of plan.visual.sections)for(const slot of section.media||[])slot.src=media[slot.id]||null;
}
function renderStatelessPlan(plan,brief,{directionId='base'}={}){
  if(!plan.releaseEligible||plan.policy.status!=='PASS'){const err=new Error('Generation blocked by policy gate');err.code='POLICY_BLOCK';err.plan=plan;throw err;}
  const directionHash=plan.designDirectionSelection?.plan_sha256||'base';
  const id=`${slugify(plan.project.domainArchetype||plan.project.archetype)}-${hash(`${brief}|${plan.selection.runtime.id}|${plan.layout.fingerprint}|${directionHash}`).slice(0,8)}`;
  prepareMedia(plan,brief,id);
  const css=renderCss(plan.visual),previewHtml=inlinePreview(renderWebsite(plan,plan.visual,id),css);
  const previewChecks=[
    {id:'policy-gate',status:plan.policy.status},{id:'self-contained-css',status:previewHtml.includes('styles.css')?'FAIL':'PASS'},
    {id:'self-contained-media',status:/src="data:image\/svg\+xml;base64,/.test(previewHtml)?'PASS':'FAIL'},
    {id:'semantic-main',status:/<main\b/.test(previewHtml)?'PASS':'FAIL'},{id:'responsive-css',status:/@media\(max-width:640px\)/.test(css)?'PASS':'FAIL'},
    {id:'selected-direction',status:plan.designDirectionSelection?'PASS':'BASE',detail:plan.designDirectionSelection?.id||directionId},
    {id:'truth-boundary',status:'PASS',detail:'Public Control Room produces preview artifacts only; production mutation is unavailable.'}
  ];  const status=previewChecks.some(x=>x.status==='FAIL')?'FAIL':'PASS';
  const receipt={
    schema:'webforge.stateless-preview.receipt.v1',receiptId:crypto.randomUUID(),projectId:id,timestamp:new Date().toISOString(),
    action:'generate-stateless-control-room-preview',status,policy:plan.policy.status,runtime:plan.selection.runtime.id,template:plan.layout.id,
    direction:plan.designDirectionSelection?{id:plan.designDirectionSelection.id,source:plan.designDirectionSelection.source,planSha256:plan.designDirectionSelection.plan_sha256}:null,
    previewSha256:hash(previewHtml),checks:previewChecks,
    truthBoundary:{persistence:'NONE',network:'NONE',productionMutation:'BLOCKED',preview:'BROWSER_BLOB'}
  };
  return {status,mode:'STATELESS_CONTROL_ROOM',stateless:true,projectId:id,previewHtml,plan,receipt,previewChecks,release:{previewEligible:status==='PASS',productionEligible:false,productionStatus:'BLOCKED_GOVERNED_EXECUTION_REQUIRED'},truthBoundary:receipt.truthBoundary};
}

export function generateStatelessPreview(brief,{directionPlan=null,directionId='native',directionSource='control-room-selection'}={}){
  if(typeof brief!=='string'||brief.trim().length<8)throw new Error('Brief must contain at least 8 characters');
  const base=compose(brief);
  const plan=directionPlan?applyDesignDirectionToPlan(base,directionPlan,{directionId,source:directionSource}):base;
  return renderStatelessPlan(plan,brief,{directionId});
}

export function resolveStatelessDirectionPlan(brief,directionId='native'){
  if(typeof brief!=='string'||brief.trim().length<8)throw new Error('Brief must contain at least 8 characters');
  const base=compose(brief),spec=compileWebUIDesignSpec(base),native=deriveNativeDirectionPlan(spec),plans={native,contrast:deriveContrastDirectionPlan(native)};
  if(!plans[directionId]){const err=new Error(`Unknown design direction: ${directionId}`);err.code='DIRECTION_NOT_FOUND';throw err;}
  return {id:directionId,plan:plans[directionId],distanceFromNative:directionId==='native'?0:directionDistance(native,plans[directionId])};
}

export function generateStatelessDirectionOptions(brief){
  if(typeof brief!=='string'||brief.trim().length<8)throw new Error('Brief must contain at least 8 characters');
  const base=compose(brief),spec=compileWebUIDesignSpec(base),native=deriveNativeDirectionPlan(spec),contrast=deriveContrastDirectionPlan(native);
  const definitions=[
    {id:'native',label:'Původní směr',description:'Nejvěrnější současnému Design DNA a doméně.',plan:native},
    {id:'contrast',label:'Kontrastní směr',description:'Materiálně odlišná kompozice při zachování stejného briefu a IA.',plan:contrast}
  ];
  const options=definitions.map(item=>{
    const plan=applyDesignDirectionToPlan(base,item.plan,{directionId:item.id,source:'stateless-direction-options'}),preview=renderStatelessPlan(plan,brief,{directionId:item.id});
    return {id:item.id,label:item.label,description:item.description,directionPlan:item.plan,distanceFromNative:item.id==='native'?0:directionDistance(native,item.plan),previewHtml:preview.previewHtml,previewSha256:preview.receipt.previewSha256,projectId:preview.projectId,checks:preview.previewChecks};
  });
  return {schema:STATELESS_DIRECTIONS_SCHEMA,status:options.every(x=>x.checks.every(c=>c.status!=='FAIL'))?'PASS':'FAIL',defaultDirection:'native',options,truthBoundary:{advisoryDirections:true,buildAuthority:'USER_SELECTION_ONLY',releaseAuthority:'NONE',productionAuthority:'NONE'}};
}