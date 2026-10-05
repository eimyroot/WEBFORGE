import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERCEPTUAL_EVALUATOR_SCHEMA,
  buildPerceptualReviewRequest,
  evaluatePerceptualVisualCritic,
  runPerceptualReviewRequest
} from '../src/core/web-ui-perceptual-critic.mjs';
import { runWebUiRefinement } from '../src/core/web-ui-refinement.mjs';

const spec=()=>({
  schema:'WebUIDesignSpec/v1',
  direction:{name:'editorial-grid',intent:'calm premium product story',keywords:['calm','editorial']},
  components:[{id:'hero',role:'introduction',template:'hero.editorial'}],
  assets:[],acceptance:{visual:['Creative direction remains visible','human review required']}
});

function browserReceipt(projectDir,viewport,{narrow=false,status='PASS'}={}){
  const file=path.join(projectDir,`shot-${viewport.width}.png`);
  fs.writeFileSync(file,Buffer.from(`png-${viewport.width}`));
  const signal=narrow?[{tag:'h3',containerClass:'step-grid',ownerId:'workflow',ownerGeometry:'staggered-steps',width:42,lineCount:8,textLength:30}]:[];
  return {
    schema:'webforge.browser-qa.test-double.v1',status,
    checks:[
      {id:'browser-qa',status,detail:{title:'x',main:1,h1:1,narrowTextBlocks:signal,overflowElements:[]}},
      {id:'accessibility',status,detail:{lang:'en',h1:1,missingAlt:0,unlabelledFields:0,main:1}},
      {id:'responsive-overflow',status,detail:{viewportWidth:viewport.width,scrollWidth:viewport.width,bodyScrollWidth:viewport.width}},
      {id:'performance',status,detail:{renderMs:20,htmlBytes:1000,cssBytes:1000,budgets:{loadMs:1500}}}
    ],
    screenshot:{current:file}
  };
}

function quality(projectDir){
  const ids=[['desktop',1280,720],['tablet',768,1024],['mobile',375,812]];
  return {schema:'webforge.web-ui-quality-receipt.v1',status:'PASS',viewports:ids.map(([id,width,height])=>{
    const file=path.join(projectDir,`shot-${width}.png`); fs.writeFileSync(file,Buffer.from(`png-${width}`));
    return {viewport:{id,width,height,mobile:id!=='desktop'},status:'PASS',required:['browser-qa','accessibility','responsive-overflow','performance'].map(x=>({id:x,status:'PASS'})),signals:{layout:{narrow_text_blocks:[],overflow_elements:[]},accessibility:{},performance:{}},screenshot:file};
  })};
}

function evaluator(request,observations=[]){
  return {schema:PERCEPTUAL_EVALUATOR_SCHEMA,request_digest:request.request_digest,evaluator:{id:'reviewer',version:'1',mode:'vlm'},observations};
}

function tempProject(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-perceptual-'));
  fs.writeFileSync(path.join(dir,'styles.css'),'body{margin:0}\n');
  fs.writeFileSync(path.join(dir,'web-ui-design-spec.json'),JSON.stringify(spec(),null,2)+'\n');
  return dir;
}

test('perceptual request binds exact three PASS screenshots and design direction',()=>{
  const dir=tempProject();
  try{
    const request=buildPerceptualReviewRequest(dir,{spec:spec(),quality:quality(dir)});
    assert.equal(request.status,'READY');
    assert.deepEqual(request.screenshots.map(x=>x.viewport),['desktop','tablet','mobile']);
    assert.ok(request.screenshots.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
    assert.equal(request.policy.advisory_only,true);
    assert.equal(request.policy.no_release_authority,true);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('project-native relative screenshot paths resolve inside the generated project',()=>{
  const dir=tempProject();
  try{
    const q=quality(dir);
    for(const item of q.viewports){
      const absolute=item.screenshot;
      const relative=path.join('qa',item.viewport.id,'current.png');
      fs.mkdirSync(path.join(dir,'qa',item.viewport.id),{recursive:true});
      fs.copyFileSync(absolute,path.join(dir,relative));
      item.screenshot=relative;
    }
    const request=buildPerceptualReviewRequest(dir,{spec:spec(),quality:q});
    assert.equal(request.status,'READY');
    assert.ok(request.screenshots.every(x=>x.path.startsWith('qa/')));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('missing or outside-project screenshots block perceptual request',()=>{
  const dir=tempProject();
  try{
    const q=quality(dir); q.viewports[1].screenshot='/tmp/not-owned-by-webforge.png';
    const request=buildPerceptualReviewRequest(dir,{spec:spec(),quality:q});
    assert.equal(request.status,'BLOCKED');
    assert.ok(request.blockers.some(x=>x.startsWith('screenshot:tablet:')));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('valid perceptual finding is advisory review debt and never repair authority',()=>{
  const dir=tempProject();
  try{
    const request=buildPerceptualReviewRequest(dir,{spec:spec(),quality:quality(dir)});
    const output=evaluator(request,[{id:'hero-hierarchy',category:'visual-hierarchy',severity:'P1',confidence:.88,viewport:'desktop',section_id:'hero',summary:'Hero heading does not dominate the competing metadata strongly enough.',evidence_viewports:['desktop'],suggested_action:'increase-heading-dominance'}]);
    const result=evaluatePerceptualVisualCritic({request,evaluatorOutput:output});
    assert.equal(result.status,'REVIEW_REQUIRED');
    assert.equal(result.issues.length,1);
    assert.equal(result.issues[0].repair_authority,'NONE');
    assert.equal(result.decision.automatic_repair_allowed,false);
    assert.equal(result.policy.deterministic_corroboration_required,true);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('no evaluator output remains UNVERIFIED instead of becoming aesthetic PASS',()=>{
  const dir=tempProject();
  try{
    const request=buildPerceptualReviewRequest(dir,{spec:spec(),quality:quality(dir)});
    const result=evaluatePerceptualVisualCritic({request,evaluatorOutput:null});
    assert.equal(result.status,'UNVERIFIED');
    assert.equal(result.decision.automatic_repair_allowed,false);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('model output containing CSS code or patch instructions is rejected fail-closed',()=>{
  const dir=tempProject();
  try{
    const request=buildPerceptualReviewRequest(dir,{spec:spec(),quality:quality(dir)});
    const output=evaluator(request,[]); output.patch={css:'#hero{font-size:99px}'};
    const result=evaluatePerceptualVisualCritic({request,evaluatorOutput:output});
    assert.equal(result.status,'BLOCKED');
    assert.ok(result.invalid.some(x=>x.includes('forbidden')));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('stale evaluator output cannot be replayed against a different request digest',()=>{
  const dir=tempProject();
  try{
    const request=buildPerceptualReviewRequest(dir,{spec:spec(),quality:quality(dir)});
    const output=evaluator(request,[]); output.request_digest='0'.repeat(64);
    const result=evaluatePerceptualVisualCritic({request,evaluatorOutput:output});
    assert.equal(result.status,'BLOCKED');
    assert.ok(result.invalid.includes('request digest mismatch'));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('low-confidence aesthetic observation remains visible but cannot drive status or repair',()=>{
  const dir=tempProject();
  try{
    const request=buildPerceptualReviewRequest(dir,{spec:spec(),quality:quality(dir)});
    const output=evaluator(request,[{id:'maybe-spacing',category:'spacing-rhythm',severity:'P2',confidence:.42,viewport:'mobile',section_id:'hero',summary:'Spacing may feel slightly compressed on the mobile hero surface.',evidence_viewports:['mobile'],suggested_action:'increase-section-whitespace'}]);
    const result=evaluatePerceptualVisualCritic({request,evaluatorOutput:output});
    assert.equal(result.status,'ADVISORY_PASS');
    assert.equal(result.issues.length,0);
    assert.equal(result.low_confidence.length,1);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('perceptual request runner refreshes project-native screenshot evidence',async()=>{
  const dir=tempProject();
  try{
    const runner=async(projectDir,options)=>browserReceipt(projectDir,options.viewport);
    const request=await runPerceptualReviewRequest(dir,{qaRunner:runner});
    assert.equal(request.status,'READY');
    assert.equal(fs.existsSync(path.join(dir,'web-ui-perceptual.request.json')),true);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('BLOCKED perceptual critique gates deterministic auto-repair without changing CSS',async()=>{
  const dir=tempProject();
  const before=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
  try{
    const runner=async(projectDir,options)=>browserReceipt(projectDir,options.viewport,{narrow:options.viewport.width===1280});
    const perceptual={schema:'webforge.web-ui-perceptual-critique.v1',status:'BLOCKED',issues:[],decision:{automatic_repair_allowed:false}};
    const result=await runWebUiRefinement(dir,{qaRunner:runner,maxIterations:1,perceptualCritique:perceptual});
    assert.equal(result.receipt.status,'BLOCKED');
    assert.equal(result.receipt.iterations.length,0);
    assert.equal(result.receipt.perceptual_guard.granted_repair_authority,false);
    assert.equal(fs.readFileSync(path.join(dir,'styles.css'),'utf8'),before);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
