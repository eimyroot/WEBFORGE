import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { compileWebUIDesignSpec } from '../src/core/web-ui-contract.mjs';
import {
  GENERATOR_TOURNAMENT_SCHEMA,
  buildUigenFxPrompt,
  buildUigenFxCssPrompt,
  buildUigenFxStructuredPrompt,
  extractUigenFxCandidate,
  extractUigenFxBodyStage,
  extractUigenFxStyleStage,
  extractUigenFxStructuredPlan,
  validateExternalCandidateSource,
  validateUigenFxStructuredPlan,
  runGeneratorTournament
} from '../src/core/generator-tournament.mjs';

const florist='Premium local florist in Prague with seasonal bouquets, weddings, same-day delivery, subscriptions and a botanical editorial feel.';
const saas='API monitoring SaaS for engineering teams with realtime alerts, incident workflows, integrations, security and pricing.';

function candidateHtml(kind='florist'){
  const floristMode=kind.includes('florist');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${floristMode?'Atelier':'Signal'}</title><style>body{margin:0;font-family:system-ui}main{max-width:1200px;margin:auto}.grid{display:grid;grid-template-columns:${floristMode?'1.4fr .6fr':'repeat(3,1fr)'}}</style></head><body><nav><a href="/">Home</a><a href="${floristMode?'/bouquets/':'/product/'}">Explore</a></nav><main><section id="hero"><h1>${floristMode?'Seasonal flowers':'Know the API before users do'}</h1></section><section class="${floristMode?'gallery':'grid'}"><h2>${floristMode?'Bouquets':'Signals'}</h2></section>${floristMode?'<section class="story"><h2>Studio</h2></section>':''}</main></body></html>`;
}
test('UIGEN prompt binds the exact brief and WebUIDesignSpec while forbidding network dependencies',()=>{
  const spec=compileWebUIDesignSpec(compose(florist));
  const prompt=buildUigenFxPrompt({brief:florist,designSpec:spec});
  assert.match(prompt,/Premium local florist/);
  assert.match(prompt,/WebUIDesignSpec\/v1/);
  assert.match(prompt,/Return ONLY one complete <body>/);
  assert.match(prompt,/exactly one <main>/i);
  assert.match(prompt,/automatic FAIL/);
  assert.match(prompt,/exactly 4 meaningful <section>/);
  assert.doesNotMatch(prompt,/Tailwind CDN/);
});

test('structured UIGEN prompt binds the brief to enum-only design choices and parser ignores echoed design context',()=>{
  const spec=compileWebUIDesignSpec(compose(florist));
  const prompt=buildUigenFxStructuredPrompt({brief:florist,designSpec:spec});
  assert.match(prompt,/Premium local florist/);
  assert.match(prompt,/JSON object/);
  assert.match(prompt,/DISTINCT section roles/);
  const plan={archetype:'editorial',hero:'split',density:'airy',rhythm:'alternating',section_1:'offer',section_2:'gallery',section_3:'process',section_4:'contact',cta:'contact',palette:'warm',shape:'soft',nav:'balanced'};
  const parsed=extractUigenFxStructuredPlan(prompt+'\n'+JSON.stringify(plan)+'\n[Generation: 4.2 t/s]');
  assert.equal(parsed.status,'PASS');
  assert.deepEqual(parsed.plan,plan);
});

test('structured UIGEN plan rejects duplicate section roles and unexpected keys',()=>{
  const duplicate={archetype:'grid',hero:'split',density:'dense',rhythm:'mosaic',section_1:'proof',section_2:'proof',section_3:'pricing',section_4:'faq',cta:'transact',palette:'cool',shape:'sharp',nav:'compact'};
  assert.equal(validateUigenFxStructuredPlan(duplicate).reason,'STRUCTURED_PLAN_DUPLICATE_SECTIONS');
  assert.equal(validateUigenFxStructuredPlan({...duplicate,section_2:'process',extra:'nope'}).reason,'STRUCTURED_PLAN_EXTRA_KEYS');
});

test('UIGEN CSS stage is separately bounded and receives the exact generated body',()=>{
  const spec=compileWebUIDesignSpec(compose(saas));
  const body='<body><header><nav><a href="./product/">Product</a></nav></header><main><section id="hero"><h1>Signal</h1></section><section id="proof"><h2>Proof</h2></section><section id="flow"><h2>Flow</h2></section><section id="cta"><h2>Start</h2></section></main><footer>Signal</footer></body>';
  const prompt=buildUigenFxCssPrompt({brief:saas,designSpec:spec,body});
  assert.match(prompt,/Return ONLY one complete <style>/);
  assert.match(prompt,/at most 12 CSS rules and 30 declarations/);
  assert.match(prompt,/BODY_TO_STYLE: <body>/);
  assert.match(prompt,/WebUIDesignSpec\/v1/);
});

test('two-stage parser fails closed on echoed prompt plus an unclosed generated element',()=>{
  assert.equal(extractUigenFxBodyStage('instruction <body>...</body>\n<body><main>').status,'FAIL');
  assert.equal(extractUigenFxStyleStage('instruction <style>...</style>\n<style>body{margin:0').status,'FAIL');
});

test('body stage strips a closed style block but still blocks active content',()=>{
  const cleaned=extractUigenFxBodyStage('<body><style>body{margin:0}</style><main><section><h1>A</h1></section></main></body>');
  assert.equal(cleaned.status,'PASS');
  assert.equal(cleaned.sanitized_style_blocks,1);
  assert.doesNotMatch(cleaned.body,/<style/i);
  assert.equal(extractUigenFxBodyStage('<body><main><script>alert(1)</script></main></body>').status,'BLOCKED');
});

test('external candidate parser extracts inline CSS into project-native styles.css contract',()=>{
  const parsed=extractUigenFxCandidate(candidateHtml('florist'));
  assert.equal(parsed.status,'PASS');
  assert.match(parsed.html,/href="\.\/styles\.css"/);
  assert.doesNotMatch(parsed.html,/<style/i);
  assert.match(parsed.css,/grid-template-columns/);
});

test('external model output with network effects is blocked before browser execution',()=>{
  const unsafe=candidateHtml('saas').replace('</main>','<script>fetch("https://example.com")</script></main>');
  const safety=validateExternalCandidateSource(unsafe);
  assert.equal(safety.status,'BLOCKED');
  assert.ok(safety.violations.includes('NETWORK_FETCH'));
  assert.equal(extractUigenFxCandidate(unsafe).status,'BLOCKED');
});

test('external model active content is blocked even without a network URL',()=>{
  const unsafe=candidateHtml('saas').replace('<h1>','<button onclick="document.body.innerHTML=\'owned\'">Run</button><h1>');
  const safety=validateExternalCandidateSource(unsafe);
  assert.equal(safety.status,'BLOCKED');
  assert.ok(safety.violations.includes('INLINE_EVENT_HANDLER'));
});
test('tournament keeps external generator advisory and never turns objective score into promotion authority',async()=>{
  const outputRoot=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-tournament-'));
  const externalGenerator=async({brief})=>({status:'PASS',stdout:candidateHtml(brief.includes('florist')?'florist':'saas'),duration_ms:2000,model:{id:'fake-uigen'},model_sha256:'fake',prompt_sha256:'fake'});
  const candidateEvaluator=async root=>{
    const external=root.includes('uigen-fx-4b');
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const sections=[...html.matchAll(/<section\b[^>]*(?:id="([^"]+)")?[^>]*>/g)].map((m,i)=>m[1]||`section-${i}`);
    return {
      status:external?'UNVERIFIED':'PASS',quality_coverage:1,behavior_coverage:external?.35:1,
      structure:{sections,headings:['h1','h2'],navTargets:external?['/','/candidate/']:['/','/native/'],ctas:[],grids:external?['repeat(3,1fr)']:['1fr 1fr']}
    };
  };
  try{
    const report=await runGeneratorTournament([{id:'florist',brief:florist},{id:'saas',brief:saas}],{outputRoot,modelPath:'/unused/fake.gguf',externalGenerator,candidateEvaluator});
    assert.equal(report.schema,GENERATOR_TOURNAMENT_SCHEMA);
    assert.equal(report.dataset.count,2);
    assert.equal(report.fairness.same_web_ui_design_spec,true);
    assert.equal(report.truth_boundary.default_generator_changed,false);
    assert.equal(report.truth_boundary.release_authority,'NONE');
    assert.equal(report.promotion.status,'REVIEW_REQUIRED');
    assert.equal(report.promotion.winner,null);
    assert.ok(['webforge-native','uigen-fx-4b'].includes(report.objective_leader));
    assert.ok(fs.existsSync(path.join(report.output_root,'generator-tournament.receipt.json')));
  } finally {fs.rmSync(outputRoot,{recursive:true,force:true});}
});

test('structured challenger materializes safe route scaffolds while keeping model output code-free and non-authoritative',async()=>{
  const outputRoot=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-tournament-structured-'));
  const structured={archetype:'editorial',hero:'split',density:'airy',rhythm:'alternating',section_1:'offer',section_2:'gallery',section_3:'process',section_4:'contact',cta:'transact',palette:'warm',shape:'soft',nav:'balanced'};
  const externalGenerator=async()=>({status:'PASS',structured_plan:structured,raw_output:JSON.stringify(structured),duration_ms:12000,generation_mode:'structured-plan-deterministic-render',model:{id:'fake-uigen'},model_sha256:'fake',prompt_sha256:'fake',truth_boundary:{model_output_code:false,release_authority:'NONE'}});
  const candidateEvaluator=async root=>({status:'UNVERIFIED',quality_coverage:1,behavior_coverage:1,structure:{sections:[path.basename(path.dirname(root)),'hero'],headings:['h1','h2'],navTargets:['/','/pricing/','/checkout/'],ctas:['/checkout/'],grids:['1fr 1fr']}});
  try{
    const report=await runGeneratorTournament([{id:'florist',brief:florist},{id:'saas',brief:saas}],{outputRoot,externalGenerator,candidateEvaluator});
    const root=path.join(report.output_root,'florist','uigen-fx-4b');
    assert.ok(fs.existsSync(path.join(root,'index.html')));
    assert.ok(fs.existsSync(path.join(root,'pricing','index.html')));
    assert.ok(fs.existsSync(path.join(root,'checkout','index.html')));
    assert.match(fs.readFileSync(path.join(root,'checkout','index.html'),'utf8'),/data-wf-form-root/);
    assert.match(fs.readFileSync(path.join(root,'pricing','index.html'),'utf8'),/href="\/checkout\/"/);
    assert.match(fs.readFileSync(path.join(root,'delivery','index.html'),'utf8'),/href="\/contact\/"/);
    const meta=JSON.parse(fs.readFileSync(path.join(root,'candidate.meta.json'),'utf8'));
    assert.equal(meta.generation_mode,'structured-plan-deterministic-render');
    assert.equal(meta.truth_boundary.release_authority,'NONE');
    assert.match(report.fairness.external_candidate_scope,/bounded enum-only design plan/);
    assert.equal(report.execution_status,'PASS');
    assert.equal(report.status,'UNVERIFIED');
    assert.equal(report.comparison_status,'REVIEW_REQUIRED');
  } finally {fs.rmSync(outputRoot,{recursive:true,force:true});}
});

test('missing external case is scored as zero coverage instead of disappearing from denominator',async()=>{
  const outputRoot=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-tournament-partial-'));
  let calls=0;
  const externalGenerator=async({brief})=>++calls===1
    ?{status:'PASS',stdout:candidateHtml(brief.includes('florist')?'florist':'saas'),duration_ms:1000,model:{id:'fake-uigen'}}
    :{status:'FAIL',reason:'SIMULATED_GENERATION_FAILURE',duration_ms:1000};
  const candidateEvaluator=async root=>({status:'PASS',quality_coverage:1,behavior_coverage:1,structure:{sections:[path.basename(path.dirname(root))],headings:['h1'],navTargets:[],ctas:[],grids:['1fr']}});
  try{
    const report=await runGeneratorTournament([{id:'florist',brief:florist},{id:'saas',brief:saas}],{outputRoot,externalGenerator,candidateEvaluator});
    assert.equal(report.status,'UNVERIFIED');
    assert.equal(report.scores['uigen-fx-4b'].raw.completion,0.5);
    assert.equal(report.scores['uigen-fx-4b'].raw.quality,0.5);
    assert.equal(report.scores['uigen-fx-4b'].raw.behavior,0.5);
    assert.ok(report.scores['uigen-fx-4b'].total<report.scores['webforge-native'].total);
  } finally {fs.rmSync(outputRoot,{recursive:true,force:true});}
});

test('parser ignores launcher or echoed prompt text before the last complete HTML document',()=>{
  const raw='launcher banner\nReturn a doctype declaration, then exit.\n<!doctype html> not-a-document\n'+candidateHtml('saas')+'\n[Prompt: 18 t/s]';
  const parsed=extractUigenFxCandidate(raw);
  assert.equal(parsed.status,'PASS');
  assert.match(parsed.html,/Know the API before users do/);
  assert.doesNotMatch(parsed.html,/not-a-document/);
});
