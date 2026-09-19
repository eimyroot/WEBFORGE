import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { registry, registrySummary } from '../src/core/composition-registry.mjs';
import { rendererCoverage } from '../src/core/renderer-coverage.mjs';
import { renderWebsite } from '../src/core/visual-renderer.mjs';

const briefs={
  hotel:'Boutique hotel with rooms, spa, restaurant, gallery and direct booking.',
  agency:'Creative agency for startups with services, case studies, team, testimonials and contact.',
  saas:'Accounting SaaS with product, features, integrations, pricing, security and signup.',
  shop:'Skincare ecommerce with product categories, featured products, reviews, ingredients and checkout.',
  magazine:'Independent magazine with latest stories, authors, topics and newsletter.',
  clinic:'Pediatric clinic with doctors, services, reviews, booking and location.'
};
const plans=Object.fromEntries(Object.entries(briefs).map(([id,brief])=>[id,compose(brief)]));
const renderer=(plan,id)=>plan.visual.sections.find(x=>x.id===id)?.rendererKey;
test('R3 expands real renderer families rather than aliases',()=>{
  const summary=registrySummary();
  assert.equal(summary.counts.sectionTemplates,320);
  assert.ok(summary.counts.sectionTemplatesR3>=12);
  assert.equal(summary.counts.rendererContracts,30);
  assert.ok(summary.counts.rendererContractsR3>=10);
  const r3=registry('sectionTemplatesR3');
  assert.ok(r3.length>=12);
  assert.ok(new Set(r3.map(x=>x.rendererKey)).size>=10);
  const coverage=rendererCoverage({includeExtensions:true});
  assert.equal(coverage.missing.length,0,JSON.stringify(coverage.missing));
});

test('normal website semantics select materially different R3 renderers',()=>{
  assert.equal(renderer(plans.saas,'hero'),'hero-product-stage');
  assert.equal(renderer(plans.saas,'pricing'),'pricing-featured');
  assert.equal(renderer(plans.agency,'hero'),'hero-corporate-manifesto');
  assert.equal(plans.agency.designStrategy.layout_strategy.primary,'corporate-system');
  assert.equal(renderer(plans.agency,'testimonials'),'quote-grid');
  assert.equal(renderer(plans.hotel,'gallery'),'gallery-filmstrip');
  assert.equal(renderer(plans.hotel,'services'),'service-stack');
  assert.equal(renderer(plans.clinic,'hero'),'hero-conversion-focus');
  assert.equal(renderer(plans.magazine,'hero'),'hero-publication-cover');
  assert.equal(plans.magazine.designStrategy.layout_strategy.primary,'editorial-system');
  assert.equal(plans.magazine.designStrategy.navigation_model.pattern,'editorial-nav');
  assert.equal(renderer(plans.magazine,'latest-content'),'article-grid');
  assert.equal(renderer(plans.magazine,'newsletter'),'cta-split');
});
test('R3 renderers produce distinct public HTML compositions',()=>{
  const rendered={};
  for(const [id,plan] of Object.entries(plans)) rendered[id]=renderWebsite(plan,plan.visual,`test-${id}`);
  assert.match(rendered.saas,/class="vc-hero hero-product-stage/);
  assert.match(rendered.agency,/class="domain-special-hero hero-corporate-manifesto/);
  assert.match(rendered.clinic,/class="vc-hero hero-conversion-focus/);
  assert.match(rendered.hotel,/class="vc-section gallery-filmstrip/);
  assert.match(rendered.agency,/class="vc-section quote-grid/);
  assert.match(rendered.magazine,/class="vc-section article-grid-section/);
  assert.notEqual(rendered.saas,rendered.agency);
});

test('R3 section selection stays deterministic for the same brief',()=>{
  const first=compose(briefs.saas).visual.sections.map(x=>`${x.id}:${x.template}:${x.rendererKey}`);
  const second=compose(briefs.saas).visual.sections.map(x=>`${x.id}:${x.template}:${x.rendererKey}`);
  assert.deepEqual(first,second);
});
