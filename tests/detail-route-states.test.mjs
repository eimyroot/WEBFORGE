import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { renderBlueprintPage } from '../src/core/visual-renderer.mjs';

const cases={
  product:'Premium outdoor ecommerce store with products, categories, search, comparison, reviews and checkout.',
  property:'Real estate website with property listings, search, neighbourhoods, agents and viewing booking.',
  job:'Recruitment platform with jobs, company profiles, search, filters and employer hiring services.',
  course:'University website with programmes, course catalog, admissions, campus, research and student resources.',
  article:'Independent magazine with articles, topics, authors, search and newsletter.',
  event:'Techno club with events calendar, artists, tickets, gallery and location.',
  profile:'Professional membership community with member directory, public profiles, events and resources.'
};
const plans=Object.fromEntries(Object.entries(cases).map(([id,brief])=>[id,compose(brief)]));
const detail=(plan,kind)=>plan.siteBlueprint.pages.find(x=>x.dynamic&&x.detailKind===kind);

test('seven domain detail grammars resolve to dynamic blueprint routes',()=>{
  for(const kind of Object.keys(cases)){
    const page=detail(plans[kind],kind);
    assert.ok(page,`${kind} detail route missing`);
    assert.equal(page.family,'detail');
    assert.match(page.path,/\[slug\]/);
  }
});

test('detail grammars render distinct truth-bounded compositions',()=>{
  const html=[];
  for(const kind of Object.keys(cases)){
    const plan=plans[kind], page=detail(plan,kind);
    const rendered=renderBlueprintPage(plan,plan.visual,page);
    assert.match(rendered,new RegExp(`data-detail-kind="${kind}"`));
    assert.match(rendered,/TRUTH BOUNDARY/);
    assert.match(rendered,/require/i);
    html.push(rendered);
  }
  assert.equal(new Set(html).size,7);
});

test('action and contact routes expose empty error and success form states',()=>{
  const plan=plans.course;
  const page=plan.siteBlueprint.pages.find(x=>x.family==='action')||plan.siteBlueprint.pages.find(x=>x.family==='contact');
  assert.ok(page);
  const html=renderBlueprintPage(plan,plan.visual,page);
  assert.match(html,/data-wf-form-root/);
  for(const state of ['empty','error','success']) assert.match(html,new RegExp(`data-state="${state}"`));
  assert.match(html,/<label[^>]+for=/);
  assert.match(html,/type="email"/);
  assert.match(html,/Nothing has been submitted/);
});

test('listing routes expose ready empty and error recovery states',()=>{
  const plan=plans.product;
  const page=plan.siteBlueprint.pages.find(x=>x.family==='listing');
  assert.ok(page);
  const html=renderBlueprintPage(plan,plan.visual,page);
  assert.match(html,/wf-collection-state/);
  for(const state of ['ready','empty','error']) assert.match(html,new RegExp(`data-state="${state}"`));
});
