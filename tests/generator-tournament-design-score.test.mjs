import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { compileWebUIDesignSpec } from '../src/core/web-ui-contract.mjs';
import {
  evaluateDomainFit,
  scorePerceptualCritique,
  evaluateCandidateDesign,
  rescoreGeneratorTournamentRun,
  TOURNAMENT_REVIEW_SCHEMA
} from '../src/core/generator-tournament-design-score.mjs';

const florist='Premium local florist in Prague with seasonal bouquets, weddings, same-day delivery, subscriptions and a botanical editorial feel.';
const saas='API monitoring SaaS for engineering teams with realtime alerts, incident workflows, integrations, security and pricing.';

function fixtureRoot(html){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wf-design-score-'));
  fs.writeFileSync(path.join(root,'index.html'),html);
  return root;
}

function candidateHtml(sections,cta='/contact/'){
  return `<!doctype html><html><body><nav><a href="/pricing/">Pricing</a><a href="/contact/">Contact</a></nav><main>${sections.map(id=>`<section id="${id}"><h2>${id}</h2></section>`).join('')}<a class="cta primary" href="${cta}">Continue</a></main></body></html>`;
}
function quality(root){
  const vps=[['desktop',1280,720],['tablet',768,1024],['mobile',375,812]];
  const viewports=vps.map(([id,width,height])=>{
    const dir=path.join(root,'qa',`web-ui-${id}`);fs.mkdirSync(dir,{recursive:true});
    const shot=path.join(dir,'current.png');fs.writeFileSync(shot,Buffer.from(`shot-${id}`));
    return {viewport:{id,width,height,mobile:id!=='desktop'},status:'PASS',required:['browser-qa','accessibility','responsive-overflow','performance'].map(x=>({id:x,status:'PASS'})),signals:{layout:{narrow_text_blocks:[],overflow_elements:[]},accessibility:{},performance:{}},screenshot:path.relative(root,shot)};
  });
  const q={schema:'webforge.web-ui-quality-receipt.v1',status:'PASS',viewports};
  fs.writeFileSync(path.join(root,'web-ui-quality.receipt.json'),JSON.stringify(q,null,2)+'\n');
  return q;
}

test('domain-fit penalizes florist-only integration semantics that are unsupported by its design contract',()=>{
  const floristSpec=compileWebUIDesignSpec(compose(florist));
  const saasSpec=compileWebUIDesignSpec(compose(saas));
  const root=fixtureRoot(candidateHtml(['hero','integrations','faq','process','pricing']));
  try{
    const flower=evaluateDomainFit({root,designSpec:floristSpec});
    const software=evaluateDomainFit({root,designSpec:saasSpec});
    assert.ok(flower.score<software.score);
    assert.equal(flower.unsupported_specialized_sections,1);
    assert.equal(software.unsupported_specialized_sections,0);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('perceptual score is severity and confidence weighted but remains advisory',()=>{
  const critique={status:'REVIEW_REQUIRED',issues:[
    {severity:'P1',confidence:.9},{severity:'P2',confidence:.8}
  ]};
  const score=scorePerceptualCritique(critique);
  assert.equal(score.status,'REVIEWED');
  assert.equal(score.issue_count,2);
  assert.ok(score.score<.8&&score.score>.7);
  assert.equal(scorePerceptualCritique({status:'UNVERIFIED',issues:[]}).score,null);
});

test('candidate design evaluation binds review to exact screenshot hashes',()=>{
  const designSpec=compileWebUIDesignSpec(compose(florist));
  const root=fixtureRoot(candidateHtml(['hero','gallery','process','pricing'],'/contact/'));
  try{
    fs.writeFileSync(path.join(root,'web-ui-design-spec.json'),JSON.stringify(designSpec,null,2)+'\n');
    const q=quality(root);
    const screenshot_sha256={};
    for(const item of q.viewports){
      const file=path.join(root,item.screenshot);
      screenshot_sha256[item.viewport.id]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
    const review={evaluator:{id:'human-review',version:'1',mode:'human'},screenshot_sha256,observations:[]};
    const result=evaluateCandidateDesign({root,designSpec,review});
    assert.equal(result.status,'REVIEWED');
    assert.equal(result.perceptual.score,1);
    assert.equal(result.domain_fit.status,'PASS');
    const stale={...review,screenshot_sha256:{...review.screenshot_sha256,desktop:'0'.repeat(64)}};
    const blocked=evaluateCandidateDesign({root,designSpec,review:stale});
    assert.equal(blocked.status,'UNVERIFIED');
    assert.equal(blocked.perceptual.status,'BLOCKED');
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

function reviewFor(root){
  const screenshot_sha256={};
  for(const id of ['desktop','tablet','mobile']){
    const file=path.join(root,'qa',`web-ui-${id}`,'current.png');
    screenshot_sha256[id]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
  return {evaluator:{id:'test-reviewer',version:'1',mode:'vlm'},screenshot_sha256,observations:[]};
}

test('tournament design rescore is advisory and never grants promotion authority',()=>{
  const run=fs.mkdtempSync(path.join(os.tmpdir(),'wf-tournament-rescore-'));
  const spec=compileWebUIDesignSpec(compose(florist));
  const caseRoot=path.join(run,'florist');fs.mkdirSync(caseRoot,{recursive:true});
  fs.writeFileSync(path.join(caseRoot,'tournament.input.json'),JSON.stringify({design_spec:spec,behavior_spec:{}},null,2));
  for(const candidate of ['webforge-native','uigen-fx-4b']){
    const root=path.join(caseRoot,candidate);fs.mkdirSync(root,{recursive:true});
    fs.writeFileSync(path.join(root,'index.html'),candidateHtml(['hero','gallery','process','pricing']));quality(root);
  }
  const technical={quality:40,behavior:30,diversity:20,efficiency:10,total:100,raw:{quality:1,behavior:1,diversityRatio:1,efficiency:1}};
  fs.writeFileSync(path.join(run,'generator-tournament.receipt.json'),JSON.stringify({
    cases:[{id:'florist'}],scores:{'webforge-native':technical,'uigen-fx-4b':technical}
  },null,2)+'\n');
  const reviews={schema:TOURNAMENT_REVIEW_SCHEMA,reviews:{florist:{
    'webforge-native':reviewFor(path.join(caseRoot,'webforge-native')),
    'uigen-fx-4b':reviewFor(path.join(caseRoot,'uigen-fx-4b'))
  }}};
  try{
    const result=rescoreGeneratorTournamentRun(run,{reviews});
    assert.equal(result.status,'REVIEWED');
    assert.equal(result.promotion.winner,null);
    assert.equal(result.promotion.status,'REVIEW_REQUIRED');
    assert.equal(result.truth_boundary.release_authority,'NONE');
    assert.equal(result.truth_boundary.default_generator_changed,false);
    assert.ok(Number.isFinite(result.scores['webforge-native'].total));
    assert.ok(fs.existsSync(path.join(run,'generator-tournament.design-score.receipt.json')));
  } finally {fs.rmSync(run,{recursive:true,force:true});}
});
