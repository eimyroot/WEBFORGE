import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { critiqueWebUi } from '../src/core/web-ui-critic.mjs';
import { applyBoundedWebUiRepairs, runWebUiRefinement } from '../src/core/web-ui-refinement.mjs';

const spec=(assetStatus='APPROVED')=>({schema:'WebUIDesignSpec/v1',assets:[{id:'hero-media',status:assetStatus}]});
const viewport=(id,narrow=[],requiredStatus='PASS')=>({
  viewport:{id,width:id==='desktop'?1280:id==='tablet'?768:375,height:720,mobile:id!=='desktop'},
  status:requiredStatus,
  required:['browser-qa','accessibility','responsive-overflow','performance'].map(check=>({id:check,status:requiredStatus})),
  signals:{layout:{narrow_text_blocks:narrow,overflow_elements:[]},accessibility:{},performance:{}}
});
const quality=(desktop=[],status='PASS')=>({
  schema:'webforge.web-ui-quality-receipt.v1',status,
  viewports:[viewport('desktop',desktop,status),viewport('tablet',[],status),viewport('mobile',[],status)],
  checks:{human_review_required:true}
});
const stepSignal={tag:'h3',containerClass:'step-grid',ownerId:'workflow',ownerGeometry:'staggered-steps',width:42,lineCount:11,textLength:28};
const splitSignal={tag:'h2',containerClass:'section-heading',ownerId:'task-preview',ownerGeometry:'editorial-column',width:88,lineCount:12,textLength:44};

function qaReceipt(narrow=[]){
  return {schema:'webforge.browser-qa.test-double.v1',status:'PASS',checks:[
    {id:'browser-qa',status:'PASS',detail:{title:'x',main:1,h1:1,narrowTextBlocks:narrow,overflowElements:[]}},
    {id:'accessibility',status:'PASS',detail:{lang:'en',h1:1,missingAlt:0,unlabelledFields:0,main:1}},
    {id:'responsive-overflow',status:'PASS',detail:{viewportWidth:1280,scrollWidth:1280,bodyScrollWidth:1280}},
    {id:'performance',status:'PASS',detail:{renderMs:20,htmlBytes:1000,cssBytes:1000,budgets:{loadMs:1500}}}
  ],screenshot:{current:null}};
}
function tempProject(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-refine-'));
  fs.writeFileSync(path.join(dir,'styles.css'),'body{margin:0}\n');
  fs.writeFileSync(path.join(dir,'web-ui-design-spec.json'),JSON.stringify(spec(),null,2)+'\n');
  return dir;
}

test('visual critic turns measured narrow desktop structures into bounded repair operations',()=>{
  const result=critiqueWebUi({spec:spec(),quality:quality([stepSignal,splitSignal])});
  assert.equal(result.status,'REPAIR_REQUIRED');
  assert.equal(result.repair_plan.length,2);
  assert.deepEqual(new Set(result.repair_plan.map(x=>x.action)),new Set(['stack-step-grid','collapse-owner-grid']));
  assert.ok(result.repair_plan.every(x=>x.allowed_files.length===1&&x.allowed_files[0]==='styles.css'));
  assert.equal(result.decision.arbitrary_css_generation,false);
  assert.equal(result.truth_boundary.production_authority,'NONE');
});

test('project-native QA failure blocks refinement instead of being papered over by CSS',()=>{
  const failed=quality([], 'FAIL');
  const result=critiqueWebUi({spec:spec(),quality:failed});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.repair_plan.length,0);
  assert.ok(result.issues.some(x=>x.category==='quality-gate'));
});

test('provisional media stays explicit human review debt and is never auto-promoted',()=>{
  const result=critiqueWebUi({spec:spec('PROVISIONAL'),quality:quality([])});
  assert.equal(result.status,'REVIEW_REQUIRED');
  assert.equal(result.repair_plan.length,0);
  assert.ok(result.issues.some(x=>x.id==='asset-truth-boundary'));
});

test('bounded repair writes one idempotent preview-only marker block for exact section ids',()=>{
  const dir=tempProject();
  try{
    const op={id:'repair:desktop:workflow:stack-step-grid',action:'stack-step-grid',target:{owner_id:'workflow'}};
    applyBoundedWebUiRepairs(dir,[op]);
    applyBoundedWebUiRepairs(dir,[op]);
    const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
    assert.equal((css.match(/WEBFORGE_VISUAL_REFINEMENT_BEGIN/g)||[]).length,1);
    assert.match(css,/#workflow \.step-grid/);
    assert.doesNotMatch(css,/#task-preview/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('refinement accepts a measured improvement and retains human authority boundaries',async()=>{
  const dir=tempProject();
  try{
    const runner=async(projectDir,options)=>{
      const repaired=fs.readFileSync(path.join(projectDir,'styles.css'),'utf8').includes('WEBFORGE_VISUAL_REFINEMENT_BEGIN');
      const narrow=!repaired&&options.viewport.width>=1000?[stepSignal]:[];
      return qaReceipt(narrow);
    };
    const result=await runWebUiRefinement(dir,{qaRunner:runner,maxIterations:1});
    assert.equal(result.receipt.status,'PASS');
    assert.equal(result.receipt.iterations.length,1);
    assert.equal(result.receipt.iterations[0].accepted,true);
    assert.equal(result.receipt.accepted_operations.length,1);
    assert.equal(result.receipt.truth_boundary.production_authority,'NONE');
    assert.equal(result.receipt.truth_boundary.release_gate_changed,false);
    assert.ok(fs.readFileSync(path.join(dir,'styles.css'),'utf8').includes('WEBFORGE_VISUAL_REFINEMENT_BEGIN'));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('non-improving refinement automatically restores the exact prior CSS',async()=>{
  const dir=tempProject();
  const before=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
  try{
    const runner=async()=>qaReceipt([stepSignal]);
    const result=await runWebUiRefinement(dir,{qaRunner:runner,maxIterations:1});
    assert.equal(result.receipt.status,'ROLLED_BACK');
    assert.equal(result.receipt.rollback.automatic_rollback_executed,true);
    assert.equal(fs.readFileSync(path.join(dir,'styles.css'),'utf8'),before);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});


test('mobile narrow card grids produce only the allowlisted mobile stack repair',()=>{
  const mobileSignal={tag:'h3',containerClass:'pro-card-grid',ownerId:'integrations',ownerGeometry:'bento',width:62,lineCount:4,textLength:18};
  const q={schema:'webforge.web-ui-quality-receipt.v1',status:'PASS',viewports:[
    viewport('desktop',[],'PASS'),viewport('tablet',[],'PASS'),viewport('mobile',[mobileSignal],'PASS')
  ],checks:{human_review_required:true}};
  const result=critiqueWebUi({spec:spec(),quality:q});
  assert.equal(result.status,'REPAIR_REQUIRED');
  assert.equal(result.repair_plan.length,1);
  assert.equal(result.repair_plan[0].action,'stack-mobile-card-grid');
  assert.equal(result.repair_plan[0].target.owner_id,'integrations');
});

test('mobile card repair is scoped to max-width 640 and remains idempotent',()=>{
  const dir=tempProject();
  try{
    const op={id:'repair:mobile:integrations:stack-mobile-card-grid',action:'stack-mobile-card-grid',target:{owner_id:'integrations'}};
    applyBoundedWebUiRepairs(dir,[op]); applyBoundedWebUiRepairs(dir,[op]);
    const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
    assert.equal((css.match(/WEBFORGE_VISUAL_REFINEMENT_BEGIN/g)||[]).length,1);
    assert.match(css,/@media\(max-width:640px\)/);
    assert.match(css,/#integrations \.pro-card-grid/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('unverified browser evidence blocks the critic instead of becoming a false PASS',()=>{
  const q=quality([], 'UNVERIFIED');
  const result=critiqueWebUi({spec:spec(),quality:q});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.repair_plan.length,0);
  assert.ok(result.issues.some(x=>x.category==='quality-gate'&&x.evidence.viewport_status==='UNVERIFIED'));
});

test('missing required viewport blocks automatic refinement',()=>{
  const q={schema:'webforge.web-ui-quality-receipt.v1',status:'PASS',viewports:[viewport('desktop',[],'PASS')],checks:{human_review_required:true}};
  const result=critiqueWebUi({spec:spec(),quality:q});
  assert.equal(result.status,'BLOCKED');
  assert.ok(result.issues.some(x=>x.id==='quality-gate:missing-viewports'));
});

test('refinement refuses to accept an unverified post-repair result and restores prior CSS',async()=>{
  const dir=tempProject(); const before=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
  try{
    let calls=0;
    const runner=async(_projectDir,options)=>{
      calls++;
      if(calls<=3){
        const narrow=options.viewport.width>=1000?[stepSignal]:[];
        return qaReceipt(narrow);
      }
      const r=qaReceipt([]); r.status='UNVERIFIED'; r.checks=r.checks.map(x=>({...x,status:'UNVERIFIED'})); return r;
    };
    const result=await runWebUiRefinement(dir,{qaRunner:runner,maxIterations:1});
    assert.equal(result.receipt.status,'ROLLED_BACK');
    assert.equal(result.receipt.rollback.automatic_rollback_executed,true);
    assert.equal(fs.readFileSync(path.join(dir,'styles.css'),'utf8'),before);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('automatic refinement iteration budget is hard-capped at one',async()=>{
  const dir=tempProject();
  try{
    await assert.rejects(()=>runWebUiRefinement(dir,{qaRunner:async()=>qaReceipt([]),maxIterations:2}),/maxIterations must be 0 or 1/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('raw offscreen rail elements do not override project-native responsive-overflow PASS',()=>{
  const q=quality([],'PASS');
  q.viewports[0].signals.layout.overflow_elements=[{tag:'figure',ownerId:'gallery',right:1600,width:320}];
  const result=critiqueWebUi({spec:spec(),quality:q});
  assert.equal(result.status,'PASS');
  assert.equal(result.issues.some(x=>x.category==='quality-gate'),false);
});
