import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {compose} from '../src/core/compose.mjs';
import {generateWebsite,generatedProjectDir} from '../src/core/generator.mjs';
import {runDesignDiversityBenchmark} from '../src/core/design-diversity-benchmark.mjs';

const entries=JSON.parse(fs.readFileSync(new URL('./data/design-diversity-briefs.json',import.meta.url),'utf8'));
const criticalIds=['boutique-hotel','florist-studio','accounting-saas','corporate-law','techno-club','architecture-portfolio','fine-dining','industrial-marketplace'];
const critical=criticalIds.map(id=>entries.find(x=>x.id===id));

test('CREATIVE R2 compiles explicit thesis narrative depth and composition intent',()=>{
  for(const entry of critical){
    assert.ok(entry,`missing ${entry?.id}`);
    const plan=compose(entry.brief);
    assert.equal(plan.creative.schema,'webforge.creative-brief.r2');
    assert.ok(plan.creative.thesis.idea.length>12);
    assert.ok(plan.creative.thesis.avoid.length>=3);
    assert.ok(plan.creative.narrative.stages.length>=3);
    assert.ok(plan.creative.contentDepth.requiredSections.length>=5);
    assert.ok(plan.creative.contentDepth.requiredSections.every(id=>plan.layout.sections.includes(id)),`${entry.id} missing required content section`);
    assert.equal(plan.visual.compositionDiversity.status,'PASS',`${entry.id} composition diversity failed`);
  }
});

test('critical eight briefs are materially distinct before visual rendering',()=>{
  const report=runDesignDiversityBenchmark(critical);
  assert.equal(report.status,'PASS',JSON.stringify(report.gates.filter(x=>x.status==='FAIL')));
  assert.equal(report.metrics.creativeSignatureUniqueRate,1);
  assert.equal(report.metrics.contentDepthUniqueRate,1);
  assert.equal(report.metrics.spatialFingerprintUniqueRate,1);
  assert.ok(report.metrics.spatialFingerprintDistance>=0.75);
  assert.equal(report.metrics.compositionDiversityPassRate,1);
});

test('florist studio semantics stay botanical instead of collapsing into corporate studio styling',()=>{
  const plan=compose(critical.find(x=>x.id==='florist-studio').brief);
  assert.equal(plan.designStrategy.color_strategy.temperature,'floral');
  assert.equal(plan.creative.narrative.pattern,'florist-commerce');
  assert.match(plan.creative.thesis.idea,/botanical/i);
});

test('generator emits creative brief and composition-diversity evidence',()=>{
  const out=generateWebsite(critical.find(x=>x.id==='boutique-hotel').brief),dir=generatedProjectDir(out.projectId);
  try{
    assert.ok(fs.existsSync(`${dir}/creative-brief.json`));
    const creative=JSON.parse(fs.readFileSync(`${dir}/creative-brief.json`,'utf8'));
    assert.equal(creative.schema,'webforge.creative-brief.r2');
    assert.ok(out.receipt.checks.some(x=>x.id==='creative-brief-r2'&&x.status==='PASS'));
    assert.ok(out.receipt.checks.some(x=>x.id==='composition-diversity'&&x.status==='PASS'));
  } finally {
    fs.rmSync(dir,{recursive:true,force:true});
    fs.rmSync(new URL(`../evidence/generated/${out.projectId}.json`,import.meta.url),{force:true});
  }
});
