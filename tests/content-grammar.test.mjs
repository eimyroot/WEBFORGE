import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';

const plans={
  magazine:compose('Independent magazine with latest stories, authors, topics and newsletter subscription.'),
  hotel:compose('Boutique hotel with rooms, spa, restaurant, gallery and direct booking.'),
  clinic:compose('Pediatric healthcare clinic with clinicians, services, booking and location.'),
  shop:compose('Skincare ecommerce store with products, categories, reviews and checkout.'),
  nonprofit:compose('Climate nonprofit with impact, research, campaigns, volunteers and donations.'),
  estate:compose('Real estate agency with property listings, neighbourhood guides, agents and viewing requests.')
};
const content=p=>p.visual.content.model;
test('editorial publication uses publication grammar instead of company pitch',()=>{
  const c=content(plans.magazine);
  assert.match(c.hero.headline,/Stories worth returning/i);
  assert.doesNotMatch(c.hero.headline,/value clear before the pitch/i);
  assert.ok(c['latest-content']);
  assert.ok(c.newsletter);
  assert.deepEqual(c.navigation.slice(0,3),['Latest','Topics','Authors']);
});

test('hospitality grammar prioritises stay and booking',()=>{
  const c=content(plans.hotel);
  assert.match(c.hero.headline,/Stay for the place/i);
  assert.equal(c.hero.primary,'Check availability');
  assert.ok(c.booking);
  assert.ok(c.gallery);
});
test('healthcare grammar stays high-trust without fabricated outcomes',()=>{
  const c=content(plans.clinic),blob=JSON.stringify(c);
  assert.match(c.hero.headline,/care step/i);
  assert.equal(c.hero.primary,'Book an appointment');
  assert.match(blob,/No unsupported medical claims|verified provider data/i);
  assert.doesNotMatch(blob,/guaranteed|cure|success rate/i);
});

test('commerce grammar requires live catalog facts',()=>{
  const c=content(plans.shop),blob=JSON.stringify(c);
  assert.match(c.hero.headline,/right product/i);
  assert.ok(c.categories);
  assert.match(blob,/Live price required|approved catalog source/i);
});
test('nonprofit grammar separates impact evidence from donation action',()=>{
  const c=content(plans.nonprofit),blob=JSON.stringify(c);
  assert.match(c.hero.headline,/Show the work/i);
  assert.ok(c.outcomes);
  assert.match(blob,/Verified impact data required|approved organisational data/i);
  assert.doesNotMatch(blob,/\b\d+%\b/);
});

test('real-estate grammar avoids fabricated listings and prices',()=>{
  const c=content(plans.estate),blob=JSON.stringify(c);
  assert.match(c.hero.headline,/property by fit/i);
  assert.ok(c.featured);
  assert.match(blob,/verified listings source|live listing data/i);
  assert.equal(c.final.primary,'Request a viewing');
});
