import test from 'node:test';
import assert from 'node:assert/strict';
import {runStructuralDiversityBenchmark} from '../src/core/structural-diversity.mjs';
import {STRUCTURAL_PLAYGROUND_BASELINES} from '../src/core/structural-diversity-baseline.mjs';

const critical=STRUCTURAL_PLAYGROUND_BASELINES;

test('STRUCTURAL DIVERSITY gate passes eight materially different rendered site skeletons',()=>{
  const report=runStructuralDiversityBenchmark(critical);
  assert.equal(report.source,'rendered-dom-and-page-graph');
  assert.equal(report.status,'PASS',JSON.stringify(report.gates.filter(x=>x.status==='FAIL')));
  assert.equal(report.metrics.structuralSignatureUniqueRate,1);
  assert.ok(report.metrics.minimumCompositeDistance>=0.48);
  assert.ok(report.metrics.minimumGeometrySequenceDistance>=0.4);
  assert.ok(report.metrics.minimumPageGraphDistance>=0.65);
  assert.equal(report.violations.length,0);
});

test('STRUCTURAL DIVERSITY gate fails closed when two industries reuse the same skeleton',()=>{
  const hotel=critical.find(x=>x.id==='boutique-hotel');
  const cloned=[hotel,{id:'fake-other-industry',brief:hotel.brief}];
  const report=runStructuralDiversityBenchmark(cloned);
  assert.equal(report.status,'FAIL');
  assert.equal(report.metrics.structuralSignatureUniqueRate,0.5);
  assert.ok(report.violations.some(x=>x.compositeDistance===0));
});

test('STRUCTURAL DIVERSITY report exposes the actual layout dimensions used by the gate',()=>{
  const report=runStructuralDiversityBenchmark(critical);
  for(const sample of report.samples){
    assert.ok(sample.homepage.sectionSequence.length>=5,`${sample.id}: sections`);
    assert.equal(sample.homepage.sectionSequence.length,sample.homepage.geometrySequence.length,`${sample.id}: spatial geometry coverage`);
    assert.ok(sample.homepage.templateFamilies.length>=5,`${sample.id}: template families`);
    assert.ok(sample.homepage.ctaPattern.length>=2,`${sample.id}: CTA pattern`);
    assert.ok(sample.pageGraph.length>=2,`${sample.id}: page graph`);
    assert.ok(sample.root.heroArchetype,`${sample.id}: hero archetype`);
    assert.ok(sample.root.navigationModel,`${sample.id}: nav model`);
  }
});
