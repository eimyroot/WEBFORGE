import test from 'node:test';
import assert from 'node:assert/strict';
import {compose} from '../src/core/compose.mjs';
import {generateStatelessPreview} from '../src/core/stateless-preview.mjs';
import {buildMediaDataUris} from '../src/core/media-assets.mjs';
import {buildMediaRequests} from '../src/core/media-requests.mjs';

const en='Website creation inquiry – flower shop website.';
const cs='Webové stránky pro květinářství v Praze. Kytice, svatby, doručení květin a vazba na přání.';

test('flower shop is a first-class florist domain with a non-generic homepage grammar',()=>{
  const plan=compose(en);
  assert.equal(plan.project.domainArchetype,'florist-retail');
  assert.equal(plan.designStrategy.layout_strategy.primary,'florist-system');
  assert.deepEqual(plan.layout.sections,['hero','categories','featured','services','gallery','process','latest-content','location','faq','final-cta']);
  assert.ok(plan.product.entities.some(x=>x.name==='Bouquet'));
  assert.ok(plan.designStrategy.navigation_model.items.some(x=>x.id==='weddings'));
  assert.ok(!plan.layout.sections.includes('comparison'));
  assert.ok(!plan.layout.sections.includes('trust-safety'));
});

test('flower shop preview uses florist-specific public copy and botanical media',()=>{
  const out=generateStatelessPreview(en);
  assert.equal(out.status,'PASS');
  assert.match(out.previewHtml,/Shop bouquets/);
  assert.match(out.previewHtml,/SHOP BY OCCASION/);
  assert.match(out.previewHtml,/Weddings &amp; Events|Weddings & Events/);
  assert.match(out.previewHtml,/Delivery &amp; pickup|Delivery & pickup|Delivery & Pickup/);
  assert.doesNotMatch(out.previewHtml,/verified product data|approved commerce source|requires the approved|Live price required|generic cards/i);
  const media=buildMediaDataUris(out.plan.visual,`${en}|florist-test`);
  const first=Object.values(media)[0];
  const svg=Buffer.from(first.split(',')[1],'base64').toString('utf8');
  assert.match(svg,/data-domain="florist"/);
});

test('Czech florist brief produces Czech locale and Czech customer-facing homepage',()=>{
  const out=generateStatelessPreview(cs);
  assert.equal(out.plan.project.locale.tag,'cs-CZ');
  assert.equal(out.plan.brand.identity.name,'Místní květinářství');
  assert.match(out.previewHtml,/<html lang="cs-CZ"/);
  assert.match(out.previewHtml,/Květiny pro chvíle, na kterých záleží\./);
  assert.match(out.previewHtml,/PODLE PŘÍLEŽITOSTI/);
  assert.match(out.previewHtml,/Svatby a události/);
  assert.match(out.previewHtml,/Doručení a vyzvednutí/);
  assert.doesNotMatch(out.previewHtml,/Find the right product|verified product data|approved commerce source/i);
});

test('florist output remains materially distinct from SaaS output',()=>{
  const florist=compose(en);
  const saas=compose('B2B SaaS analytics workspace with login dashboard integrations pricing and enterprise security.');
  assert.notEqual(florist.project.domainArchetype,saas.project.domainArchetype);
  assert.notEqual(florist.layout.fingerprint,saas.layout.fingerprint);
  assert.notEqual(florist.designStrategy.layout_strategy.primary,saas.designStrategy.layout_strategy.primary);
  assert.notDeepEqual(florist.siteBlueprint.navigation,saas.siteBlueprint.navigation);
});

test('florist procedural fallback varies composition per media slot',()=>{
  const plan=compose(cs),media=buildMediaDataUris(plan.visual,`${cs}|florist-diversity`);
  const variants=plan.visual.media.slots.filter(x=>x.section==='gallery').map(slot=>{
    const svg=Buffer.from(media[slot.id].split(',')[1],'base64').toString('utf8');
    return svg.match(/data-florist-variant="(\d+)"/)?.[1];
  });
  assert.equal(variants.length,6);
  assert.equal(new Set(variants).size,6);
});

test('florist media requests carry distinct subjects and composition hints',()=>{
  const plan=compose(cs),gallery=buildMediaRequests(plan).requests.filter(x=>x.section==='gallery');
  assert.equal(gallery.length,6);
  assert.equal(new Set(gallery.map(x=>x.subject)).size,6);
  assert.equal(new Set(gallery.map(x=>x.variantKey)).size,6);
  assert.ok(gallery.every(x=>/keep sibling slots materially different/i.test(x.prompt)));
});
