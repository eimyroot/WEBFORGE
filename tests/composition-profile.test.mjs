import test from 'node:test';
import assert from 'node:assert/strict';
import {compose} from '../src/core/compose.mjs';
import {renderWebsite} from '../src/core/visual-renderer.mjs';

const briefs={
  florist:'Webové stránky pro květinářství v Praze. Kytice, svatby, doručení květin a vazba na přání.',
  hotel:'Boutique hotel in Prague with rooms, spa, restaurant, local guide and direct booking.',
  autoservice:'Autoservis v Praze. Servis aut, pneuservis, diagnostika, STK příprava, ceník a online rezervace termínu.'
};
const plans=Object.fromEntries(Object.entries(briefs).map(([id,brief])=>[id,compose(brief)]));
const ids=p=>p.siteBlueprint.navigation.map(x=>x.id).join('|');
const renderers=p=>p.visual.sections.map(x=>x.rendererKey).join('|');

test('brief semantics compile into distinct composition profiles',()=>{
  assert.equal(plans.florist.designStrategy.composition_profile.siteArchetype,'florist-commerce');
  assert.equal(plans.hotel.designStrategy.composition_profile.siteArchetype,'hospitality-stay');
  assert.equal(plans.autoservice.designStrategy.composition_profile.siteArchetype,'appointment-service');
  assert.equal(new Set(Object.values(plans).map(p=>p.layout.compositionProfile)).size,3);
  assert.equal(new Set(Object.values(plans).map(p=>p.layout.conversionFlow.join('|'))).size,3);
});

test('florist hotel and autoservice differ in architecture and composition',()=>{
  const xs=Object.values(plans);
  assert.deepEqual(plans.florist.layout.sections,['hero','categories','featured','services','gallery','process','latest-content','location','faq','final-cta']);
  assert.deepEqual(plans.hotel.layout.sections,['hero','availability','gallery','services','proof','booking','location','faq','final-cta']);
  assert.deepEqual(plans.autoservice.layout.sections,['hero','services','proof','booking','process','location','faq','final-cta']);
  assert.equal(new Set(xs.map(p=>p.layout.fingerprint)).size,3);
  assert.equal(new Set(xs.map(p=>p.visual.spatial.fingerprint)).size,3);
  assert.equal(new Set(xs.map(p=>p.visual.spatial.sections.find(x=>x.id==='hero')?.geometry)).size,3);
  assert.equal(new Set(xs.map(p=>p.visual.spatial.canvas)).size,3);
  assert.equal(new Set(xs.map(ids)).size,3);
  assert.equal(new Set(xs.map(renderers)).size,3);
});

test('intrinsically visual hospitality does not require gallery keywords to become media-led',()=>{
  assert.ok(plans.hotel.domain.genome.mediaIntensity>=80);
  assert.equal(plans.hotel.designStrategy.layout_strategy.primary,'media-led');
  assert.equal(plans.hotel.designStrategy.media_strategy.role,'primary-storytelling');
  assert.ok(plans.hotel.layout.sections.indexOf('gallery')<plans.hotel.layout.sections.indexOf('services'));
});

test('Czech automotive service resolves as a known appointment service',()=>{
  assert.equal(plans.autoservice.project.domainArchetype,'local-professional-service');
  assert.equal(plans.autoservice.domain.classification,'KNOWN');
  assert.equal(plans.autoservice.designStrategy.composition_profile.siteArchetype,'appointment-service');
  assert.ok(plans.autoservice.layout.sections.indexOf('booking')<plans.autoservice.layout.sections.indexOf('process'));
});

test('section selection remains metadata-driven and deterministic',()=>{
  for(const plan of Object.values(plans)) for(const section of plan.visual.sections){
    assert.ok(section.template,section.id);
    assert.ok(section.rendererKey,section.id);
    assert.equal(typeof section.selectionScore,'number',section.id);
    assert.ok(section.selectionReason,section.id);
  }
  const again=compose(briefs.hotel);
  assert.equal(again.layout.fingerprint,plans.hotel.layout.fingerprint);
  assert.equal(again.visual.spatial.fingerprint,plans.hotel.visual.spatial.fingerprint);
  assert.equal(renderers(again),renderers(plans.hotel));
});

test('public HTML reflects the profile instead of only changing metadata',()=>{
  const html=Object.fromEntries(Object.entries(plans).map(([id,plan])=>[id,renderWebsite(plan,plan.visual,`profile-${id}`)]));
  assert.match(html.florist,/data-canvas="atelier"/);
  assert.match(html.florist,/hero-editorial-center/);
  assert.match(html.hotel,/data-canvas="edge-to-edge"/);
  assert.match(html.hotel,/id="availability"/);
  assert.match(html.hotel,/id="gallery"/);
  assert.match(html.autoservice,/data-canvas="framed"/);
  assert.match(html.autoservice,/hero-conversion-focus/);
  assert.match(html.autoservice,/id="booking"/);
  assert.doesNotMatch(html.florist,/id="booking"/);
});
