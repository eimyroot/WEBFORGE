import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { renderBlueprintPage } from '../src/core/visual-renderer.mjs';

const briefs={
  saas:'Accounting SaaS with product, features, integrations, pricing, security and signup.',
  education:'University website with programmes, admissions, research, campus, student life and resources.',
  commerce:'Skincare ecommerce with shop, categories, featured products, compare, reviews and checkout.',
  magazine:'Independent magazine with latest stories, authors, topics and newsletter.'
};
const plans=Object.fromEntries(Object.entries(briefs).map(([k,b])=>[k,compose(b)]));
const page=(plan,id)=>plan.siteBlueprint.pages.find(x=>x.id===id);

test('site blueprint assigns semantic page families',()=>{
  assert.equal(page(plans.saas,'pricing').family,'pricing');
  assert.equal(page(plans.saas,'security').family,'evidence');
  assert.equal(page(plans.education,'programmes').family,'listing');
  assert.equal(page(plans.education,'admissions').family,'action');
  assert.equal(page(plans.magazine,'latest').family,'editorial');
  assert.equal(page(plans.commerce,'transaction').family,'action');
  assert.equal(page(plans.commerce,'compare').family,'listing');
});
test('page families render materially different subpage compositions',()=>{
  const pricing=renderBlueprintPage(plans.saas,plans.saas.visual,page(plans.saas,'pricing'));
  const editorial=renderBlueprintPage(plans.magazine,plans.magazine.visual,page(plans.magazine,'latest'));
  const action=renderBlueprintPage(plans.education,plans.education.visual,page(plans.education,'admissions'));
  const listing=renderBlueprintPage(plans.commerce,plans.commerce.visual,page(plans.commerce,'shop'));
  assert.match(pricing,/data-family="pricing"/);
  assert.match(pricing,/page-intro-pricing/);
  assert.match(editorial,/data-family="editorial"/);
  assert.match(editorial,/page-intro-editorial/);
  assert.match(action,/data-family="action"/);
  assert.match(action,/page-intro-action/);
  assert.match(listing,/data-family="listing"/);
  assert.match(listing,/page-intro-listing/);
  assert.equal(new Set([pricing,editorial,action,listing]).size,4);
});
