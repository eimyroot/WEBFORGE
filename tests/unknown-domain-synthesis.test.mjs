import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {compose} from '../src/core/compose.mjs';
import {runUnknownDomainBenchmark,UNKNOWN_DOMAIN_THRESHOLDS} from '../src/core/unknown-domain-benchmark.mjs';
const entries=JSON.parse(fs.readFileSync(new URL('./data/unknown-domain-briefs.json',import.meta.url),'utf8'));
const report=runUnknownDomainBenchmark(entries);
test('unknown briefs synthesize brief-derived subjects entities and creative directions',()=>{
  for(const entry of entries){const p=compose(entry.brief);assert.equal(p.domain.classification,'NOVEL',entry.id);assert.ok(p.domain.synthesis?.subject,entry.id);assert.ok(p.domain.synthesis?.direction?.candidates?.length>=3,entry.id);assert.ok(p.product.entities.length>=2,entry.id);assert.doesNotMatch(`${p.brand.identity.name} ${p.brand.content.headline} ${p.product.entities.map(x=>x.name).join(' ')}`,/Untitled Web Product|Concept Participant Experience State|Find the right option and act with confidence/i,entry.id);}
});
test('unknown-domain benchmark fails closed on template collisions and generic fallback leakage',()=>{
  assert.equal(report.status,'PASS',JSON.stringify(report.gates.filter(x=>x.status==='FAIL')));
  for(const [metric,min] of Object.entries(UNKNOWN_DOMAIN_THRESHOLDS)) if(!['genericLeakCount','exactStructureCollisionRate'].includes(metric))assert.ok(report.metrics[metric]>=min,`${metric} ${report.metrics[metric]} < ${min}`);
  assert.equal(report.metrics.genericLeakCount,0);assert.ok(report.metrics.exactStructureCollisionRate<=UNKNOWN_DOMAIN_THRESHOLDS.exactStructureCollisionRate);
});
test('very different unknown briefs do not collapse to the same public structure',()=>{
  const byId=Object.fromEntries(report.samples.map(x=>[x.id,x]));
  for(const [a,b] of [['future-promises','idea-garden'],['sound-constellation','unsent-letters'],['wardrobe-memory','question-tree']]){assert.notEqual(byId[a].layoutFingerprint,byId[b].layoutFingerprint,`${a}/${b} layout collision`);assert.notEqual(byId[a].headline,byId[b].headline,`${a}/${b} headline collision`);}
});
