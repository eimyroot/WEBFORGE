import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { buildMediaDataUris } from '../src/core/media-assets.mjs';
import { buildMediaRequests } from '../src/core/media-requests.mjs';

const genericCopy=/find the right option|focused section bound|purpose-built content slot|purposeful section resolved by webforge/i;
const svgOf=(plan,brief,slot='hero:1')=>Buffer.from(buildMediaDataUris(plan.visual,brief)[slot].split(',')[1],'base64').toString('utf8');

test('product applications derive content and procedural media from product behavior',()=>{
  const monitoringBrief='Developer-first API monitoring SaaS with dashboards, alerts, integrations, technical documentation, security and pricing.';
  const logisticsBrief='B2B logistics operations web app with shipment dashboard, live status, exceptions, analytics, team accounts and security.';
  const monitoring=compose(monitoringBrief), logistics=compose(logisticsBrief);
  assert.equal(monitoring.designStrategy.composition_profile.siteArchetype,'product-application');
  assert.equal(logistics.designStrategy.composition_profile.siteArchetype,'product-application');
  assert.match(monitoring.visual.content.model.hero.headline,/API health/i);
  assert.match(logistics.visual.content.model.hero.headline,/shipments|exceptions/i);
  assert.notEqual(monitoring.visual.content.model.hero.headline,logistics.visual.content.model.hero.headline);
  assert.doesNotMatch(JSON.stringify(monitoring.visual.content.model),genericCopy);
  assert.doesNotMatch(JSON.stringify(logistics.visual.content.model),genericCopy);
  assert.match(svgOf(monitoring,monitoringBrief),/data-media-mode="observability"/);
  assert.match(svgOf(logistics,logisticsBrief),/data-media-mode="operations"/);
  assert.notEqual(svgOf(monitoring,monitoringBrief),svgOf(logistics,logisticsBrief));
  const heroRequest=buildMediaRequests(monitoring).requests.find(x=>x.section==='hero');
  assert.match(heroRequest.subject,/API health/i);
  assert.match(heroRequest.prompt,/API health/i);
});

test('financial application uses task-first product content without advisory leakage',()=>{
  const plan=compose('Fintech banking app with accounts, transactions, payments, identity, security and live dashboard.');
  assert.equal(plan.designStrategy.composition_profile.siteArchetype,'financial-application');
  assert.match(plan.visual.content.model.hero.headline,/account state/i);
  assert.match(plan.visual.content.model['task-preview'].title,/action|transact/i);
  assert.doesNotMatch(JSON.stringify(plan.visual.content.model),/book a consultation|financial decision understandable/i);
  assert.match(svgOf(plan,plan.project.brief),/data-media-mode="financial"/);
});

test('digital experience has exhibition-specific content and immersive procedural art',()=>{
  const brief='Immersive digital exhibition with interactive story, installations, artists and evolving visual experience.';
  const plan=compose(brief), model=plan.visual.content.model;
  assert.equal(plan.designStrategy.composition_profile.siteArchetype,'immersive-experience');
  assert.match(model.hero.headline,/exhibition|living sequence/i);
  assert.match(model.experience.title,/story|space|artifact/i);
  assert.match(model.gallery.title,/visual sequence/i);
  assert.ok(model.gallery.items.length>=6);
  assert.doesNotMatch(JSON.stringify(model),genericCopy);
  assert.match(svgOf(plan,brief),/data-media-mode="immersive"/);
  const galleryRequest=buildMediaRequests(plan).requests.find(x=>x.section==='gallery');
  assert.match(galleryRequest.subject,/Exhibition|Opening scene/i);
});

test('known-domain static secondary IA contains only strategy or experience pages',()=>{
  const cases=[
    ['florist','Květinářství v Praze s kyticemi, svatbami, rozvozem květin a objednávkou na přání.'],
    ['hotel','Luxury boutique hotel in Prague with elegant rooms, spa, restaurant, gallery and direct booking.'],
    ['law','Law firm with legal services, attorneys, case expertise, articles and consultation request.'],
    ['industrial','Industrial robotics manufacturer with product lines, technical specifications, case studies and RFQ.']
  ];
  for(const [id,brief] of cases){
    const plan=compose(brief);
    const allowed=new Set([...plan.designStrategy.page_hierarchy.map(x=>x.path),...plan.experience.sitemap.map(x=>x.path)]);
    for(const page of plan.siteBlueprint.pages) if(!page.dynamic) assert.ok(allowed.has(page.path),`${id}: leaked static baseline page ${page.id}:${page.path}`);
  }
  const florist=compose(cases[0][1]);
  assert.ok(!florist.siteBlueprint.pages.some(x=>['browse','sell','trust'].includes(x.id)));
  const hotel=compose(cases[1][1]);
  assert.ok(!hotel.siteBlueprint.pages.some(x=>['services','results'].includes(x.id)));
});
