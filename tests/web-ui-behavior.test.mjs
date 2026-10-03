import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { generateWebsite, generatedProjectDir } from '../src/core/generator.mjs';
import {
  WEB_UI_BEHAVIOR_SPEC_SCHEMA,
  WEB_UI_BEHAVIOR_RECEIPT_SCHEMA,
  compileWebUiBehaviorSpec,
  runWebUiBehaviorVerifier
} from '../src/core/web-ui-behavior.mjs';

const florist='Premium local florist in Prague with seasonal bouquets, weddings, same-day delivery, subscriptions and a botanical editorial feel.';

function tempBehaviorProject(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-behavior-'));
  fs.mkdirSync(path.join(dir,'contact'),{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),'<!doctype html><html><head><title>Home</title></head><body><main data-page="home"><a href="./contact/">Contact</a></main></body></html>');
  fs.writeFileSync(path.join(dir,'contact','index.html'),`<!doctype html><html><head><title>Contact</title></head><body><main data-page="contact" data-family="contact"><section data-wf-form-root data-ui-state="empty"><form novalidate><input name="name" required><input name="email" type="email" required><textarea name="details" required></textarea><button type="submit">Send</button></form></section></main><script>(()=>{for(const root of document.querySelectorAll('[data-wf-form-root]')){const form=root.querySelector('form');form.addEventListener('submit',e=>{e.preventDefault();const ok=form.checkValidity();root.dataset.uiState=ok?'success':'error';for(const field of form.querySelectorAll('input,textarea'))field.toggleAttribute('aria-invalid',!field.checkValidity())});form.addEventListener('input',()=>{root.dataset.uiState='empty';for(const field of form.querySelectorAll('[aria-invalid]'))field.removeAttribute('aria-invalid')})}})()</script></body></html>`);
  fs.writeFileSync(path.join(dir,'web-ui-design-spec.json'),JSON.stringify({schema:'WebUIDesignSpec/v1'},null,2)+'\n');
  fs.writeFileSync(path.join(dir,'web-ui-behavior-spec.json'),JSON.stringify({
    schema:WEB_UI_BEHAVIOR_SPEC_SCHEMA,status:'READY',source:{design_spec_schema:'WebUIDesignSpec/v1'},
    journeys:[{id:'contact',goal:'Reach contact form',success_evidence:[],steps:[
      {index:0,page_id:'home',path:'/',family:'home',dynamic:false,entry:'index.html',transition_required:false},
      {index:1,page_id:'contact',path:'/contact/',family:'contact',dynamic:false,entry:'contact/index.html',transition_required:true}
    ]}],
    form_pages:[{page_id:'contact',path:'/contact/',entry:'contact/index.html',family:'contact'}],
    policy:{local_preview_only:true,external_effects:false,release_authority:'NONE',production_authority:'NONE'}
  },null,2)+'\n');
  return dir;
}

test('behavior spec is derived from experience journeys and keeps dynamic steps explicit',()=>{
  const plan=compose(florist);
  const spec=compileWebUiBehaviorSpec(plan);
  assert.equal(spec.schema,WEB_UI_BEHAVIOR_SPEC_SCHEMA);
  assert.equal(spec.status,'READY');
  assert.ok(spec.journeys.length>0);
  assert.ok(spec.form_pages.some(x=>x.page_id==='contact'));
  assert.ok(spec.journeys.some(j=>j.steps.some(s=>s.dynamic&&s.entry===null)));
  assert.equal(spec.policy.release_authority,'NONE');
  assert.equal(spec.policy.production_authority,'NONE');
});

test('generator emits behavior spec as additive evidence contract',()=>{
  const out=generateWebsite(florist),dir=generatedProjectDir(out.projectId);
  try{
    const file=path.join(dir,'web-ui-behavior-spec.json');
    assert.ok(fs.existsSync(file));
    const spec=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(spec.schema,WEB_UI_BEHAVIOR_SPEC_SCHEMA);
    assert.equal(out.manifest.webUiBehaviorSpec.file,'web-ui-behavior-spec.json');
    assert.ok(out.receipt.artifacts.includes('web-ui-behavior-spec.json'));
    assert.ok(out.receipt.checks.some(x=>x.id==='web-ui-behavior-spec'&&x.status==='PASS'));
  } finally {
    fs.rmSync(dir,{recursive:true,force:true});
    fs.rmSync(new URL(`../evidence/generated/${out.projectId}.json`,import.meta.url),{force:true});
  }
});
test('real Chromium verifies static click transition and local form recovery without external submission',async()=>{
  const dir=tempBehaviorProject();
  try{
    const receipt=await runWebUiBehaviorVerifier(dir,{writeReceipt:true,viewport:{width:1280,height:720}});
    assert.equal(receipt.schema,WEB_UI_BEHAVIOR_RECEIPT_SCHEMA);
    assert.equal(receipt.status,'PASS');
    assert.equal(receipt.journeys[0].status,'PASS');
    assert.equal(receipt.journeys[0].steps[1].mode,'CLICK_TRANSITION');
    assert.equal(receipt.form_checks[0].status,'PASS');
    assert.equal(receipt.form_checks[0].initial.state,'empty');
    assert.equal(receipt.form_checks[0].invalid.state,'error');
    assert.equal(receipt.form_checks[0].valid.state,'success');
    assert.equal(receipt.truth_boundary.external_submission,false);
    assert.equal(receipt.truth_boundary.release_authority,'NONE');
    assert.ok(fs.existsSync(path.join(dir,'web-ui-behavior.receipt.json')));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('dynamic journey step cannot become PASS from static preview evidence',async()=>{
  const dir=tempBehaviorProject();
  try{
    const spec=JSON.parse(fs.readFileSync(path.join(dir,'web-ui-behavior-spec.json'),'utf8'));
    spec.journeys[0].steps.push({index:2,page_id:'detail',path:'/item/[slug]/',family:'detail',dynamic:true,entry:null,transition_required:true});
    fs.writeFileSync(path.join(dir,'web-ui-behavior-spec.json'),JSON.stringify(spec,null,2)+'\n');
    const receipt=await runWebUiBehaviorVerifier(dir,{writeReceipt:false,viewport:{width:1280,height:720}});
    assert.equal(receipt.status,'UNVERIFIED');
    assert.equal(receipt.journeys[0].status,'UNVERIFIED');
    assert.equal(receipt.journeys[0].steps.at(-1).reason,'DYNAMIC_RUNTIME_REQUIRED');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('journey synthesis rebinds florist jobs to semantic blueprint pages instead of generic discover fallback',()=>{
  const plan=compose(florist);
  const byId=Object.fromEntries(plan.experience.journeys.map(j=>[j.id,j]));
  assert.deepEqual(byId['choose-bouquet'].path,['home','occasions','bouquets','detail']);
  assert.deepEqual(byId.delivery.path,['home','delivery','contact']);
  assert.deepEqual(byId.purchase.path,['home','pricing','transaction']);
  assert.equal(plan.siteBlueprint.journeys,plan.experience.journeys);
  assert.ok(plan.experience.journeys.every(j=>j.synthesis?.mode==='SEMANTIC_BLUEPRINT_REBIND'));
});

test('journey synthesis binds SaaS discovery to product IA and purchase to pricing before transaction',()=>{
  const plan=compose('API monitoring SaaS for engineering teams with realtime alerts, incident workflows, integrations, security and pricing.');
  const byId=Object.fromEntries(plan.experience.journeys.map(j=>[j.id,j]));
  assert.deepEqual(byId.discover.path,['home','product','detail']);
  assert.deepEqual(byId.purchase.path,['home','pricing','transaction']);
  assert.notEqual(byId.discover.path[1],'discover');
});

test('pricing conversion CTAs wire to the existing checkout route for florist and SaaS',()=>{
  const cases=[
    florist,
    'API monitoring SaaS for engineering teams with realtime alerts, incident workflows, integrations, security and pricing.'
  ];
  for(const brief of cases){
    const out=generateWebsite(brief),dir=generatedProjectDir(out.projectId);
    try{
      const pricing=fs.readFileSync(path.join(dir,'pricing','index.html'),'utf8');
      const checkout=path.join(dir,'checkout','index.html');
      assert.ok(fs.existsSync(checkout));
      assert.match(pricing,/href="\.\.\/checkout\/"/);
      assert.doesNotMatch(pricing,/href="#contact">Choose plan/);
    } finally {
      fs.rmSync(dir,{recursive:true,force:true});
      fs.rmSync(new URL(`../evidence/generated/${out.projectId}.json`,import.meta.url),{force:true});
    }
  }
});
