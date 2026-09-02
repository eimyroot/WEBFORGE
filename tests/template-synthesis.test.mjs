
import test from 'node:test';import assert from 'node:assert/strict';
import {compose} from '../src/core/compose.mjs';

test('final template engine synthesizes candidate architectures',()=>{
  const p=compose('Premium techno club VANTA dark cinematic immersive gallery DJs tickets news program mobile first.');
  assert.equal(p.layout.schemaVersion,'template-synthesis.v1');
  assert.ok(p.layout.candidateCount>=5);
  assert.ok(Array.isArray(p.layout.parents));
  assert.ok(p.layout.parents.length>=1);
});

test('synthesized page grammar has semantic roles and hard boundaries',()=>{
  const p=compose('B2B SaaS enterprise security integrations case studies product analytics pricing dashboard login.');
  assert.equal(p.layout.sections[0],'hero');
  assert.equal(p.layout.sections.at(-1),'final-cta');
  assert.equal(new Set(p.layout.sections).size,p.layout.sections.length);
  assert.equal(p.layout.sectionPlan.length,p.layout.sections.length);
  assert.ok(p.layout.sectionPlan.every(x=>x.role));
});

test('engine can produce architecture absent from fixed reference catalog',()=>{
  const briefs=[
    'Premium techno club VANTA dark cinematic immersive gallery DJs tickets news program mobile first.',
    'Local dental clinic with booking strong reviews gallery articles local SEO and FAQ.',
    'B2B SaaS enterprise security integrations case studies product analytics pricing dashboard login.',
    'Creative portfolio magazine hybrid with projects gallery case studies journal and contact.'
  ];
  const plans=briefs.map(compose);
  assert.ok(plans.some(p=>p.layout.catalogMatch===false),'expected at least one novel synthesized fingerprint');
});

test('same archetype synthesis remains brief-sensitive',()=>{
  const a=compose('Techno venue dark cinematic immersive gallery visual art tickets.');
  const b=compose('Techno venue weekly schedule program lineup practical information tickets location FAQ.');
  assert.equal(a.project.archetype,'venue');assert.equal(b.project.archetype,'venue');
  assert.notEqual(a.layout.fingerprint,b.layout.fingerprint);
});

test('candidate alternatives preserve provenance and score',()=>{
  const p=compose('Marketplace for verified suppliers with categories trust safety proof and transactions.');
  assert.ok(p.layout.alternatives.length>=3);
  for(const a of p.layout.alternatives){assert.ok(Number.isFinite(a.score));assert.ok(a.origin);assert.ok(Array.isArray(a.parents));}
});
