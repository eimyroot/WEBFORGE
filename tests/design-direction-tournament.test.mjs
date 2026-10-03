import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { compileWebUIDesignSpec } from '../src/core/web-ui-contract.mjs';
import {
  DESIGN_DIRECTION_REVIEWS_SCHEMA,
  MIN_DIRECTION_DISTANCE,
  deriveNativeDirectionPlan,
  deriveContrastDirectionPlan,
  directionDistance,
  runDesignDirectionTournament,
  rescoreDesignDirectionTournament
} from '../src/core/design-direction-tournament.mjs';

const florist='Premium local florist in Prague with seasonal bouquets, weddings, same-day delivery, subscriptions and a botanical editorial feel.';
const viewports=[['desktop',1280,720],['tablet',768,1024],['mobile',375,812]];

function fakeQuality(root){
  const receipt={schema:'webforge.web-ui-quality-receipt.v1',status:'PASS',viewports:[]};
  for(const [id,width,height] of viewports){
    const dir=path.join(root,'qa',`web-ui-${id}`);fs.mkdirSync(dir,{recursive:true});
    const shot=path.join(dir,'current.png');fs.writeFileSync(shot,Buffer.from(`fake-${id}-${path.basename(root)}`));
    receipt.viewports.push({viewport:{id,width,height,mobile:id!=='desktop'},status:'PASS',required:['browser-qa','accessibility','responsive-overflow','performance'].map(check=>({id:check,status:'PASS'})),screenshot:path.relative(root,shot)});
  }
  fs.writeFileSync(path.join(root,'web-ui-quality.receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  return receipt;
}function fakeExternal(){
  return Promise.resolve({
    status:'PASS',duration_ms:1200,generation_mode:'structured-plan-deterministic-render',
    structured_plan:{archetype:'showcase',hero:'text-led',density:'balanced',rhythm:'mosaic',section_1:'integrations',section_2:'gallery',section_3:'pricing',section_4:'contact',cta:'transact',palette:'contrast',shape:'sharp',nav:'prominent'},
    model:{id:'fake-uigen'},model_sha256:'fake',prompt_sha256:'fake',
    truth_boundary:{model_output_code:false,release_authority:'NONE',production_authority:'NONE'}
  });
}
function reviewsFromReceipt(receipt){
  const reviews={};
  for(const candidate of receipt.candidates.filter(x=>x.plan&&x.perceptual_request)){
    reviews[candidate.id]={
      screenshot_sha256:candidate.perceptual_request.screenshot_sha256,
      evaluator:{id:'test-reviewer',version:'1',mode:'vlm'},observations:[]
    };
  }
  return {schema:DESIGN_DIRECTION_REVIEWS_SCHEMA,reviews};
}

test('native and deterministic contrast directions are materially distinct and valid',()=>{
  const spec=compileWebUIDesignSpec(compose(florist));
  const native=deriveNativeDirectionPlan(spec),contrast=deriveContrastDirectionPlan(native);
  assert.notDeepEqual(native,contrast);
  assert.ok(directionDistance(native,contrast)>=MIN_DIRECTION_DISTANCE);
  assert.equal(native.section_1,'offer');
  assert.equal(native.section_2,'gallery');
});test('direction tournament creates three reviewable preview directions without build authority',async()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-ddt-'));
  try{
    const receipt=await runDesignDirectionTournament(florist,{outputRoot:out,externalGenerator:fakeExternal,qualityRunner:async root=>fakeQuality(root)});
    assert.equal(receipt.status,'REVIEW_REQUIRED');
    assert.equal(receipt.reviewable_count,3);
    assert.equal(receipt.selection.status,'PENDING_PERCEPTUAL_REVIEW');
    assert.equal(receipt.promotion.winner,null);
    assert.equal(receipt.truth_boundary.default_generator_changed,false);
    assert.ok(receipt.direction_distances.some(x=>x.a==='native'&&x.b==='contrast'&&x.distance>=MIN_DIRECTION_DISTANCE));
    for(const id of ['native','contrast','uigen']){
      assert.ok(fs.existsSync(path.join(receipt.output_root,id,'index.html')));
      assert.ok(fs.existsSync(path.join(receipt.output_root,id,'web-ui-perceptual.request.json')));
    }
  } finally {fs.rmSync(out,{recursive:true,force:true});}
});

test('exact screenshot-bound reviews produce a ranked set of at least two distinct directions',async()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-ddt-score-'));
  try{
    const receipt=await runDesignDirectionTournament(florist,{outputRoot:out,externalGenerator:fakeExternal,qualityRunner:async root=>fakeQuality(root)});
    const scored=rescoreDesignDirectionTournament(receipt.output_root,{reviews:reviewsFromReceipt(receipt),topK:3});
    assert.equal(scored.status,'REVIEWED');
    assert.equal(scored.selection.status,'READY_FOR_HUMAN_CHOICE');
    assert.ok(scored.selection.selected.length>=2);
    assert.equal(scored.selection.selected.some(x=>x.id==='uigen'),false);
    assert.equal(scored.selection.filtered_out[0].reason,'DOMAIN_FIT_BELOW_THRESHOLD');
    assert.equal(scored.promotion.winner,null);
    assert.equal(scored.truth_boundary.selection_is_not_build_authority,true);
  } finally {fs.rmSync(out,{recursive:true,force:true});}
});test('stale perceptual review fails closed instead of selecting a direction',async()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-ddt-stale-'));
  try{
    const receipt=await runDesignDirectionTournament(florist,{outputRoot:out,externalGenerator:fakeExternal,qualityRunner:async root=>fakeQuality(root)});
    const reviews=reviewsFromReceipt(receipt);
    reviews.reviews.uigen.screenshot_sha256.desktop='0'.repeat(64);
    const scored=rescoreDesignDirectionTournament(receipt.output_root,{reviews});
    assert.equal(scored.status,'UNVERIFIED');
    assert.deepEqual(scored.selection.selected,[]);
    assert.equal(scored.scores.uigen.status,'UNVERIFIED');
  } finally {fs.rmSync(out,{recursive:true,force:true});}
});