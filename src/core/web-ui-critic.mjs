import fs from 'node:fs';
import path from 'node:path';
import { WEB_UI_VIEWPORTS } from './web-ui-contract.mjs';

const values=x=>Array.isArray(x)?x:[];
const rank={P0:0,P1:1,P2:2,P3:3};
const safeId=value=>/^[a-z0-9-]+$/.test(String(value||''))?String(value):null;
const approvedAsset=status=>['APPROVED','VERIFIED','PASS'].includes(String(status||'').toUpperCase());

function qualityGateIssues(quality){
  const issues=[]; const viewports=values(quality?.viewports);
  const present=new Set(viewports.map(x=>x.viewport?.id).filter(Boolean));
  const missing=WEB_UI_VIEWPORTS.map(x=>x.id).filter(id=>!present.has(id));
  if(missing.length) issues.push({
    id:'quality-gate:missing-viewports',category:'quality-gate',severity:'P0',repairable:false,viewport:null,
    summary:'Required browser verification viewports are missing.',evidence:{missing_viewports:missing},
    recommendation:'Run the complete project-native desktop/tablet/mobile QA matrix before refinement.'
  });
  for(const viewport of viewports){
    const required=values(viewport.required); const nonPass=required.filter(x=>x.status!=='PASS');
    const failed=nonPass.filter(x=>x.status==='FAIL'); const overflow=values(viewport.signals?.layout?.overflow_elements);
    if(nonPass.length||viewport.status!=='PASS') issues.push({
      id:`quality-gate:${viewport.viewport?.id||'unknown'}`,category:'quality-gate',severity:failed.length||viewport.status==='FAIL'?'P0':'P1',repairable:false,
      viewport:viewport.viewport?.id||null,
      summary:failed.length||viewport.status==='FAIL'?'Project-native browser quality gate failed.':'Project-native browser quality gate is not fully verified.',
      evidence:{non_pass_checks:nonPass.map(x=>({id:x.id,status:x.status})),overflow_elements:overflow.slice(0,12),viewport_status:viewport.status},
      recommendation:failed.length||viewport.status==='FAIL'?'Fix the underlying renderer/layout defect explicitly; automatic visual refinement is blocked.':'Restore verification capability and rerun the same browser checks; unverified evidence cannot authorize an automatic repair.'
    });
  }
  if(quality?.status!=='PASS'&&!issues.length) issues.push({
    id:'quality-gate:aggregate',category:'quality-gate',severity:'P1',repairable:false,viewport:null,
    summary:'Aggregate browser quality receipt is not verified PASS.',evidence:{quality_status:quality?.status||'UNVERIFIED'},
    recommendation:'Rerun the complete quality matrix until the aggregate receipt is PASS.'
  });
  return issues;
}

function narrowIssues(quality){
  const issues=[]; const repairs=[]; const seen=new Set();
  for(const viewport of values(quality?.viewports)){
    const id=viewport.viewport?.id||'unknown'; const width=Number(viewport.viewport?.width||0);
    for(const signal of values(viewport.signals?.layout?.narrow_text_blocks)){
      const owner=safeId(signal.ownerId); if(!owner) continue;
      let action=null;
      const classes=String(signal.containerClass||'').split(/\s+/);
      if(width>1000&&classes.includes('step-grid')) action='stack-step-grid';
      else if(width>1000&&classes.includes('section-heading')) action='collapse-owner-grid';
      else if(width<=640&&(classes.includes('pro-card-grid')||classes.includes('domain-collection-grid')||classes.includes('feature-list'))) action='stack-mobile-card-grid';
      const issueId=`narrow-text:${id}:${owner}:${signal.containerClass||signal.tag||'text'}`;
      issues.push({id:issueId,category:'layout-density',severity:'P1',repairable:Boolean(action),viewport:id,
        summary:`Measured text block is too narrow (${signal.width}px, ${signal.lineCount} lines).`,evidence:signal,
        recommendation:action?'Apply only the allowlisted section-scoped CSS repair and re-run the same browser check.':'Human review or renderer-level fix required; no safe automatic rule exists.'});
      if(action){
        const repairId=`repair:${id}:${owner}:${action}`;
        if(!seen.has(repairId)){seen.add(repairId);repairs.push({id:repairId,action,target:{owner_id:owner,viewport:id},allowed_files:['styles.css'],reason:issueId});}
      }
    }
  }
  return {issues,repairs};
}

function assetIssues(spec){
  const pending=values(spec?.assets).filter(x=>!approvedAsset(x.status));
  return pending.length?[{id:'asset-truth-boundary',category:'content-media',severity:'P2',repairable:false,
    summary:`${pending.length} media assets remain provisional or unverified.`,
    evidence:pending.slice(0,12).map(x=>({id:x.id,section:x.section,status:x.status})),
    recommendation:'Keep human/content-media review explicit. Never auto-promote or fabricate media.'}]:[];
}

export function critiqueWebUi({spec,quality}){
  if(spec?.schema!=='WebUIDesignSpec/v1') throw new Error('WebUIDesignSpec/v1 required');
  if(quality?.schema!=='webforge.web-ui-quality-receipt.v1') throw new Error('webforge.web-ui-quality-receipt.v1 required');
  const gate=qualityGateIssues(quality); const narrow=narrowIssues(quality); const assets=assetIssues(spec);
  const blocked=gate.length>0;
  const repairPlan=blocked?[]:narrow.repairs.slice(0,8);
  const issues=[...gate,...narrow.issues,...assets].sort((a,b)=>rank[a.severity]-rank[b.severity]||a.id.localeCompare(b.id));
  const unrepairableP1=narrow.issues.some(x=>x.severity==='P1'&&!x.repairable);
  const status=blocked?'BLOCKED':repairPlan.length?'REPAIR_REQUIRED':unrepairableP1||assets.length?'REVIEW_REQUIRED':'PASS';
  const issueCounts=Object.fromEntries(['P0','P1','P2','P3'].map(s=>[s,issues.filter(x=>x.severity===s).length]));
  return {
    schema:'webforge.web-ui-critique.v1',status,issues,issue_counts:issueCounts,repair_plan:repairPlan,
    direction:{name:spec.direction?.name||null,intent:spec.direction?.intent||null},
    decision:{automatic_repair_allowed:status==='REPAIR_REQUIRED',arbitrary_css_generation:false,human_review_required:true,max_automatic_iterations:1},
    policy:{semantic_changes:false,content_fabrication:false,media_approval:false,allowed_files:['styles.css'],release_authority:'NONE'},
    truth_boundary:{deterministic_critic:'measured browser/layout evidence only',perceptual_aesthetic_judgement:'HUMAN_OR_EXTERNAL_CRITIC_REQUIRED',production_authority:'NONE'}
  };
}

export const evaluateWebUiCritique=(spec,quality)=>critiqueWebUi({spec,quality});

export function writeWebUiCritique(projectDir,critique){
  const out=path.resolve(projectDir,'web-ui-critique.json'); const root=path.resolve(projectDir)+path.sep;
  if(!out.startsWith(root)) throw new Error('Critique output escaped project directory');
  fs.writeFileSync(out,JSON.stringify(critique,null,2)+'\n');
  return out;
}
