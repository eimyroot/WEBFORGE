import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compose } from '../src/core/compose.mjs';
import { analyzeDomain, domainOntology } from '../src/core/domain-intelligence.mjs';
import { capabilityOntology } from '../src/core/product-intelligence.mjs';
import { compileUniversalBrief } from '../src/core/universal-compiler.mjs';
import { generateWebsite, generatedProjectDir } from '../src/core/generator.mjs';

const briefs={
  venue:'Premium techno club in Prague with tickets, DJs, events, gallery and cinematic design.',
  marketplace:'Tinder for renting excavators with search, filters, swipe discovery, profiles, availability, maps, payments and reviews.',
  impact:'A platform where people adopt virtual trees, see each tree on a map, follow updates and fund care for real trees.',
  funeral:'Sensitive funeral service in Prague with services, transparent guidance, immediate contact, local information and booking.',
  exhibition:'Experimental digital exhibition told as an interactive visual timeline with artifacts, video, chapters and immersive motion.',
  industrial:'B2B industrial laser manufacturer with product catalog, 3D configurator, specifications, case studies and quote requests.',
  camp:'Children camp website with sessions, registration, payments, parent accounts, gallery, FAQs and frequent updates.',
  civic:'City portal where citizens report broken streetlights with map location, photo upload, status tracking and an admin dashboard.',
  novel:'A web ritual where strangers exchange sealed future promises that unlock after a chosen date, with anonymous profiles and trust receipts.'
};

test('Universal ontologies provide broad domain and capability vocabulary',()=>{
  assert.ok(domainOntology().length>=20);
  assert.ok(capabilityOntology().length>=65);
  assert.ok(capabilityOntology().some(x=>x.support==='unresolved'));
});

test('Website Genome is synthesized for radically different domains',()=>{
  const a=analyzeDomain(briefs.venue).genome;
  const b=analyzeDomain(briefs.civic).genome;
  const c=analyzeDomain(briefs.exhibition).genome;
  assert.equal(a.visualMode,'cinematic');
  assert.ok(b.applicationDepth>=2);
  assert.ok(['experiential','editorial'].includes(c.visualMode));
  assert.notDeepEqual(a.purpose,b.purpose);
});

test('Tinder for excavators decomposes into marketplace capabilities instead of requiring a fixed template',()=>{
  const p=compose(briefs.marketplace);
  assert.equal(p.project.archetype,'marketplace');
  for(const id of ['discovery.search','discovery.filter','discovery.swipe','profile.public','commerce.checkout','trust.reviews']) assert.ok(p.product.capabilityIds.includes(id),id);
  assert.ok(p.siteBlueprint.pages.some(x=>x.path==='/discover/'));
  assert.ok(p.siteBlueprint.pages.some(x=>x.path.includes('[slug]')));
  assert.equal(p.selection.runtime.id,'next');
});

test('novel domain is explicitly classified NOVEL and still receives a product and experience model',()=>{
  const u=compileUniversalBrief(briefs.novel);
  assert.equal(u.domain.classification,'NOVEL');
  assert.ok(u.product.capabilityIds.length>=5);
  assert.ok(u.experience.pageCount>=3);
  assert.equal(u.domain.evidence.unknownDoesNotEqualPass,true);
});

test('industrial 3D configurator remains unresolved rather than being promoted to PASS',()=>{
  const p=compose(briefs.industrial);
  assert.ok(p.product.capabilityIds.includes('product.configuration.3d'));
  assert.ok(p.product.unresolved.includes('product.configuration.3d'));
  assert.equal(p.product.productionReadiness,'BLOCKED_UNRESOLVED_CAPABILITY');
  assert.equal(p.productionEligible,false);
  assert.equal(p.evidence.find(x=>x.check==='product-capability-readiness').status,'UNRESOLVED');
});

test('civic issue portal synthesizes submission, data and dashboard architecture',()=>{
  const p=compose(briefs.civic);
  for(const id of ['workflow.submission','workflow.status','media.upload','geo.location','dashboard.admin']) assert.ok(p.product.capabilityIds.includes(id),id);
  assert.ok(p.siteBlueprint.pages.some(x=>x.path==='/submit/'));
  assert.ok(p.siteBlueprint.pages.some(x=>x.path==='/admin/'));
  assert.ok(p.domain.genome.trustBurden!=='normal');
});

test('sensitive local service and immersive exhibition get different Design DNA',()=>{
  const funeral=compose(briefs.funeral), exhibition=compose(briefs.exhibition);
  assert.equal(funeral.designDNA.emotionalIntent,'reassuring');
  assert.ok(['experiential','editorial'].includes(exhibition.designDNA.mode));
  assert.notEqual(funeral.designDNA.grid,exhibition.designDNA.grid);
  assert.notEqual(funeral.layout.fingerprint,exhibition.layout.fingerprint);
});

test('children camp becomes transactional learning product with parent account capability',()=>{
  const p=compose(briefs.camp);
  assert.equal(p.project.domainArchetype,'education-learning');
  assert.ok(p.product.capabilityIds.includes('identity.account'));
  assert.ok(p.product.capabilityIds.includes('commerce.checkout'));
  assert.ok(p.siteBlueprint.pages.some(x=>x.path==='/account/'));
});

test('universal generator emits domain, genome, product, experience and design evidence artifacts',()=>{
  const out=generateWebsite(briefs.marketplace); const dir=generatedProjectDir(out.projectId);
  for(const file of ['universal.plan.json','domain.model.json','website-genome.json','product.model.json','experience.model.json','design-dna.json','site-blueprint.json','evidence.receipt.json']) assert.ok(fs.existsSync(path.join(dir,file)),file);
  const receipt=JSON.parse(fs.readFileSync(path.join(dir,'evidence.receipt.json'),'utf8'));
  assert.equal(receipt.checks.find(x=>x.id==='universal-domain-model').status,'PASS');
  assert.ok(['PASS','CONDITIONAL','UNRESOLVED'].includes(receipt.checks.find(x=>x.id==='product-capabilities').status));
  fs.rmSync(dir,{recursive:true,force:true});
});

test('cross-domain matrix composes without collapsing every project into one website grammar',()=>{
  const plans=Object.values(briefs).map(compose);
  const domains=new Set(plans.map(x=>x.project.domainArchetype));
  const fingerprints=new Set(plans.map(x=>x.layout.fingerprint));
  const modes=new Set(plans.map(x=>x.designDNA.mode));
  assert.ok(domains.size>=7);
  assert.ok(fingerprints.size>=7);
  assert.ok(modes.size>=4);
  for(const p of plans){assert.equal(p.policy.status,'PASS');assert.ok(p.capabilities.includes('qa.core'));}
});
