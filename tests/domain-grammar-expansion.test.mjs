import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { renderWebsite } from '../src/core/visual-renderer.mjs';

const cases={
 education:{brief:'Private university with undergraduate programmes, admissions, campus visits, faculty, research, scholarships and student resources.',domain:'education-learning',strategy:'academic-system',hero:'hero-academic-campus',section:'programme-grid'},
 jobs:{brief:'Recruitment platform for engineering jobs with company profiles, salary guidance, candidate resources and employer hiring services.',domain:'jobs-careers',strategy:'careers-system',hero:'hero-careers-search',section:'vacancy-grid'},
 industrial:{brief:'Industrial automation manufacturer for factories with products, engineering capabilities, industries, case studies, RFQ and technical support.',domain:'industrial-b2b',strategy:'industrial-system',hero:'hero-industrial-spec',section:'capability-matrix'},
 finance:{brief:'Independent wealth management firm with investment services, retirement planning, security, regulatory documents and consultation booking.',domain:'finance',strategy:'finance-system',hero:'hero-finance-trust',section:'finance-trust-ledger'},
 community:{brief:'Professional membership association with member directory, events, resources, committees, membership benefits and join flow.',domain:'community-membership',strategy:'community-system',hero:'hero-community-membership',section:'membership-grid'},
 restaurant:{brief:'Contemporary restaurant with menu, reservations, chef story, private dining, gallery, location and opening hours.',domain:'hospitality',strategy:'culinary-system',hero:'hero-restaurant-menu',section:'menu-grid'},
 professional:{brief:'Corporate law firm with practice areas, lawyers, industries, insights, case credentials, offices and contact.',domain:'local-professional-service',strategy:'professional-system',hero:'hero-professional-authority',section:'practice-index'},
 ecommerce:{brief:'Premium outdoor ecommerce store with product collections, category discovery, filters, featured products, comparison, reviews, shipping and checkout.',domain:'commerce-store',strategy:'commerce-system',hero:'hero-commerce-catalog',section:'product-catalog-grid'}
};
test('eight normal-web domains resolve distinct page and renderer grammars',()=>{
  const seen=new Set();
  for(const [id,x] of Object.entries(cases)){
    const p=compose(x.brief);
    assert.equal(p.project.domainArchetype,x.domain,id);
    assert.equal(p.designStrategy.layout_strategy.primary,x.strategy,id);
    assert.equal(p.visual.sections.find(s=>s.id==='hero')?.rendererKey,x.hero,id);
    assert.ok(p.visual.sections.some(s=>s.rendererKey===x.section),`${id}:${x.section}`);
    const key=`${x.strategy}|${x.hero}|${x.section}`;
    assert.ok(!seen.has(key),`duplicate grammar ${key}`);seen.add(key);
  }
});

test('web-app domains do not collapse into product-system',()=>{
  const xs=['education','finance','community'].map(id=>compose(cases[id].brief));
  assert.deepEqual(xs.map(x=>x.project.archetype),['web-app','web-app','web-app']);
  assert.deepEqual(xs.map(x=>x.designStrategy.layout_strategy.primary),['academic-system','finance-system','community-system']);
  assert.equal(new Set(xs.map(x=>x.visual.sections.find(s=>s.id==='hero')?.rendererKey)).size,3);
});
test('domain content grammar avoids obvious cross-domain copy leakage',()=>{
  const education=compose(cases.education.brief).visual.content.model.hero.headline;
  const finance=compose(cases.finance.brief).visual.content.model.hero.headline;
  const restaurant=compose(cases.restaurant.brief).visual.content.model.hero.headline;
  assert.match(education,/programme/i);assert.doesNotMatch(education,/product/i);
  assert.match(finance,/financial decision/i);assert.doesNotMatch(finance,/product/i);
  assert.match(restaurant,/food|reserve/i);assert.doesNotMatch(restaurant,/stay/i);
});

test('specialized renderers emit different public composition classes',()=>{
  const classes=[];
  for(const [id,x] of Object.entries(cases)){
    const p=compose(x.brief),html=renderWebsite(p,p.visual,id);
    assert.match(html,new RegExp(x.hero.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),id);
    assert.match(html,new RegExp(x.section.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),id);
    classes.push(x.hero);
  }
  assert.equal(new Set(classes).size,Object.keys(cases).length);
});

test('high-risk grammars keep live facts explicit',()=>{
  const finance=JSON.stringify(compose(cases.finance.brief).visual.content.model);
  const jobs=JSON.stringify(compose(cases.jobs.brief).visual.content.model);
  const ecommerce=JSON.stringify(compose(cases.ecommerce.brief).visual.content.model);
  assert.match(finance,/No performance forecast|no performance promises|return claims/i);
  assert.match(jobs,/verified vacancy|live vacancy|salary/i);
  assert.match(ecommerce,/Live price|required|never inferred/i);
});
test('corporate system stays materially distinct from SaaS product system',()=>{
  const corporate=compose('Corporate consultancy with capabilities, client work, approach, team, insights and contact.');
  const saas=compose('Accounting SaaS for invoicing, expenses, reporting, integrations, security, pricing and login.');
  assert.equal(corporate.designStrategy.layout_strategy.primary,'corporate-system');
  assert.equal(corporate.visual.sections.find(s=>s.id==='hero')?.rendererKey,'hero-corporate-manifesto');
  assert.equal(saas.designStrategy.layout_strategy.primary,'product-system');
  assert.equal(saas.visual.sections.find(s=>s.id==='hero')?.rendererKey,'hero-product-stage');
  assert.notEqual(corporate.visual.content.model.hero.headline,saas.visual.content.model.hero.headline);
  assert.equal(corporate.visual.templates.productionReviewRequired,true);
});
