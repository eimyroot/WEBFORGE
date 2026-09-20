import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {runMarketCoverageBenchmark,MARKET_COVERAGE_THRESHOLDS} from '../src/core/market-coverage-benchmark.mjs';

const entries=JSON.parse(fs.readFileSync(new URL('./data/market-coverage-briefs.json',import.meta.url),'utf8'));
const report=runMarketCoverageBenchmark(entries);
const byId=Object.fromEntries(report.samples.map(x=>[x.id,x]));

test('market coverage set spans representative market families and novel controls',()=>{
  assert.equal(entries.length,46);
  assert.equal(new Set(entries.map(x=>x.id)).size,46);
  assert.ok(new Set(entries.filter(x=>x.expectedClassification!=='NOVEL').map(x=>x.expectedDomain)).size>=20);
  assert.ok(new Set(entries.map(x=>x.market)).size>=20);
  assert.equal(entries.filter(x=>x.expectedClassification==='NOVEL').length,2);
});

test('market coverage clears semantic fit and anti-template gates',()=>{
  assert.equal(report.status,'PASS',JSON.stringify(report.gates.filter(x=>x.status==='FAIL')));
  for(const [metric,limit] of Object.entries(MARKET_COVERAGE_THRESHOLDS)){
    if(metric.startsWith('crossDomain')) assert.ok(report.metrics[metric]<=limit,`${metric} ${report.metrics[metric]} > ${limit}`);
    else assert.ok(report.metrics[metric]>=limit,`${metric} ${report.metrics[metric]} < ${limit}`);
  }
  assert.deepEqual(report.failures,[]);
});

test('same broad industries still split by product behavior',()=>{
  assert.notEqual(byId['luxury-hotel'].profile,byId['fine-dining'].profile);
  assert.notEqual(byId['investment-advisory'].profile,byId['fintech-app'].profile);
  assert.notEqual(byId['law-firm'].profile,byId['autoservice'].profile);
  assert.notEqual(byId['digital-exhibition'].profile,byId['photographer'].profile);
});

test('ordinary accounting and plumbing briefs do not fall into NOVEL synthesis',()=>{
  for(const id of ['accountant','plumber']){
    assert.equal(byId[id].domain,'local-professional-service');
    assert.notEqual(byId[id].classification,'NOVEL');
    assert.equal(byId[id].directionSource,'brief-composition-profile');
  }
});

test('specialized public, impact and immersive journeys survive component resolution',()=>{
  assert.equal(byId['civic-portal'].profile,'civic-service-workflow');
  assert.ok(byId['civic-portal'].sections.includes('task-preview'));
  assert.equal(byId['climate-nonprofit'].profile,'impact-fundraising');
  assert.ok(byId['climate-nonprofit'].conversionFlow.includes('support'));
  assert.equal(byId['interactive-museum-story'].profile,'immersive-experience');
  assert.ok(byId['interactive-museum-story'].mediaIntensity>=85);
  assert.equal(report.metrics.metadataResolutionRate,1);
});

test('NOVEL controls stay on project-local synthesis instead of being swallowed by market ontology',()=>{
  for(const id of ['future-promises','object-memories']){
    assert.equal(byId[id].classification,'NOVEL');
    assert.equal(byId[id].directionSource,'novel-brief-synthesis');
  }
  assert.equal(report.metrics.novelPreservationRate,1);
});
