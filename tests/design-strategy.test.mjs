import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { renderCss } from '../src/core/visual-renderer.mjs';

const hotel=compose('Luxury boutique hotel in Prague with elegant rooms, spa, restaurant, gallery and direct booking.');
const club=compose('Underground techno club in Prague with tonight events, artists, tickets and immersive gallery.');
const saas=compose('Accounting SaaS for small businesses with invoicing, expenses, reports, team accounts, security and pricing.');

const labels=plan=>plan.designStrategy.navigation_model.items.map(x=>x.label);
const ids=plan=>plan.designStrategy.page_hierarchy.map(x=>x.id);

test('design strategy compiler emits the complete native contract',()=>{
  for(const plan of [hotel,club,saas]){
    const s=plan.designStrategy;
    for(const key of ['audience','business_goal','primary_jobs','content_model','brand_personality','information_complexity','navigation_model','page_hierarchy','layout_strategy','visual_density','color_strategy','typography_strategy','media_strategy','interaction_strategy','conversion_strategy']) assert.ok(s[key],key);
    assert.equal(s.schema,'webforge.design-strategy.v1');
    assert.ok(s.color_strategy.tokens.accent.startsWith('#'));
    assert.ok(s.color_strategy.accessibility.accentTextContrast>=4.5);
  }
});

test('radically different briefs produce materially different information architecture',()=>{
  assert.deepEqual(labels(hotel).slice(0,5),['Home','Book','Rooms','Experience','Location']);
  assert.deepEqual(labels(club).slice(0,5),['Home','Events','Artists','Tickets','Venue']);
  assert.ok(labels(saas).includes('Product'));
  assert.ok(labels(saas).includes('Solutions'));
  assert.ok(labels(saas).includes('Pricing'));
  assert.ok(labels(saas).includes('Security'));
  assert.notDeepEqual(ids(hotel),ids(club));
  assert.notDeepEqual(ids(club),ids(saas));
});

test('layout strategy and navigation mode adapt to product semantics',()=>{
  assert.equal(hotel.designStrategy.layout_strategy.primary,'media-led');
  assert.equal(club.designStrategy.layout_strategy.primary,'media-led');
  assert.equal(saas.designStrategy.layout_strategy.primary,'product-system');
  assert.equal(hotel.layout.nav,'experience-nav');
  assert.equal(club.layout.nav,'experience-nav');
  assert.equal(saas.layout.nav,'product-nav');
});

test('brand palette becomes concrete strategy-driven design tokens',()=>{
  assert.equal(hotel.designStrategy.color_strategy.mode,'light');
  assert.equal(club.designStrategy.color_strategy.mode,'dark');
  assert.equal(saas.designStrategy.color_strategy.temperature,'financial');
  assert.notEqual(hotel.designStrategy.color_strategy.tokens.accent,club.designStrategy.color_strategy.tokens.accent);
  assert.notEqual(club.designStrategy.color_strategy.tokens.accent,saas.designStrategy.color_strategy.tokens.accent);
  for(const plan of [hotel,club,saas]){
    assert.deepEqual(plan.brand.style.colorTokens,plan.designStrategy.color_strategy.tokens);
    assert.match(renderCss(plan.visual),new RegExp(`--accent:${plan.designStrategy.color_strategy.tokens.accent}`));
  }
});

test('experience and site blueprint consume strategy pages instead of generic slice navigation',()=>{
  assert.ok(hotel.experience.sitemap.some(x=>x.id==='rooms'));
  assert.ok(hotel.experience.sitemap.some(x=>x.id==='experience'));
  assert.ok(saas.experience.sitemap.some(x=>x.id==='product'));
  assert.ok(saas.experience.sitemap.some(x=>x.id==='security'));
  assert.equal(hotel.experience.navigation[0].label,'Home');
  assert.equal(club.experience.navigation[1].label,'Events');
  assert.equal(saas.experience.navigation[1].label,'Product');
});
