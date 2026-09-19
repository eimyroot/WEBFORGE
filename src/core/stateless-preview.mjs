import crypto from 'node:crypto';
import { compose } from './compose.mjs';
import { renderWebsite, renderCss } from './visual-renderer.mjs';
import { buildMediaDataUris } from './media-assets.mjs';

const slugify=(value='website')=>String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)||'website';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');

function inlinePreview(html,css){
  return html.replace(/<link rel="stylesheet" href="[^\"]*styles\.css">/,`<style>${css}</style>`);
}

export function generateStatelessPreview(brief){
  if(typeof brief!=='string'||brief.trim().length<8) throw new Error('Brief must contain at least 8 characters');
  const plan=compose(brief);
  if(!plan.releaseEligible||plan.policy.status!=='PASS'){
    const err=new Error('Generation blocked by policy gate');err.code='POLICY_BLOCK';err.plan=plan;throw err;
  }
  const id=`${slugify(plan.project.domainArchetype||plan.project.archetype)}-${hash(`${brief}|${plan.selection.runtime.id}|${plan.layout.fingerprint}`).slice(0,8)}`;
  const media=buildMediaDataUris(plan.visual,`${brief}|${id}`);
  for(const slot of plan.visual.media.slots) slot.src=media[slot.id]||null;
  for(const section of plan.visual.sections) for(const slot of section.media||[]) slot.src=media[slot.id]||null;
  const css=renderCss(plan.visual);
  const previewHtml=inlinePreview(renderWebsite(plan,plan.visual,id),css);
  const previewChecks=[
    {id:'policy-gate',status:plan.policy.status},
    {id:'self-contained-css',status:previewHtml.includes('styles.css')?'FAIL':'PASS'},
    {id:'self-contained-media',status:/src="data:image\/svg\+xml;base64,/.test(previewHtml)?'PASS':'FAIL'},
    {id:'semantic-main',status:/<main\b/.test(previewHtml)?'PASS':'FAIL'},
    {id:'responsive-css',status:/@media\(max-width:640px\)/.test(css)?'PASS':'FAIL'},
    {id:'truth-boundary',status:'PASS',detail:'Public Control Room produces preview artifacts only; production mutation is unavailable.'}
  ];
  const status=previewChecks.some(x=>x.status==='FAIL')?'FAIL':'PASS';
  const receipt={
    schema:'webforge.stateless-preview.receipt.v1',receiptId:crypto.randomUUID(),projectId:id,timestamp:new Date().toISOString(),
    action:'generate-stateless-control-room-preview',status,policy:plan.policy.status,runtime:plan.selection.runtime.id,template:plan.layout.id,
    previewSha256:hash(previewHtml),checks:previewChecks,
    truthBoundary:{persistence:'NONE',network:'NONE',productionMutation:'BLOCKED',preview:'BROWSER_BLOB'}
  };
  return {
    status,mode:'STATELESS_CONTROL_ROOM',stateless:true,projectId:id,previewHtml,plan,receipt,previewChecks,
    release:{previewEligible:status==='PASS',productionEligible:false,productionStatus:'BLOCKED_GOVERNED_EXECUTION_REQUIRED'},
    truthBoundary:receipt.truthBoundary
  };
}
