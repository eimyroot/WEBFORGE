import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runDesignDiversityBenchmark, DESIGN_DIVERSITY_THRESHOLDS } from '../src/core/design-diversity-benchmark.mjs';

const entries=JSON.parse(fs.readFileSync(new URL('./data/design-diversity-briefs.json',import.meta.url),'utf8'));
const report=runDesignDiversityBenchmark(entries);

test('design diversity benchmark uses a broad fixed dataset',()=>{
  assert.equal(entries.length,30);
  assert.equal(report.dataset.count,30);
  assert.equal(new Set(entries.map(x=>x.id)).size,30);
});

test('design diversity clears all behavioral gates',()=>{
  assert.equal(report.status,'PASS',JSON.stringify(report.gates.filter(x=>x.status==='FAIL')));
  for(const [metric,min] of Object.entries(DESIGN_DIVERSITY_THRESHOLDS)) assert.ok(report.metrics[metric]>=min,`${metric} ${report.metrics[metric]} < ${min}`);
});

test('benchmark preserves strategy-to-render coherence',()=>{
  assert.ok(report.metrics.brandCoherence>=0.95);
  assert.ok(report.samples.every(x=>x.coherence>=0.85));
});

test('benchmark metrics are order independent',()=>{
  const reversed=runDesignDiversityBenchmark([...entries].reverse());
  assert.deepEqual(reversed.metrics,report.metrics);
  assert.equal(reversed.status,report.status);
});


test('semantic enrichment breaks the previously observed navigation collisions',()=>{
  const byId=Object.fromEntries(report.samples.map(x=>[x.id,x]));
  for(const [a,b] of [['industrial-marketplace','job-board'],['funeral-home','emergency-plumber'],['architecture-portfolio','fashion-portfolio']]) assert.notDeepEqual(byId[a].navigation,byId[b].navigation,`${a} and ${b} still collide`);
  const trio=['recipe-publication','climate-nonprofit','real-estate'].map(id=>byId[id].navigation.join('>'));
  assert.equal(new Set(trio).size,3);
});

test('semantic color profiles stay distinct and accessible',()=>{
  const byId=Object.fromEntries(report.samples.map(x=>[x.id,x]));
  for(const [a,b] of [['accounting-saas','api-monitoring'],['news-magazine','civic-portal'],['boutique-hotel','real-estate']]) assert.notEqual(byId[a].color.accent,byId[b].color.accent,`${a} and ${b} share accent`);
  assert.equal(report.metrics.accentContrastCompliance,1);
  assert.ok(report.samples.every(x=>x.color.accentTextContrast>=4.5));
});
