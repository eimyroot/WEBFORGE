import test from 'node:test';
import assert from 'node:assert/strict';
import {STRUCTURAL_PLAYGROUND_BASELINES} from '../src/core/structural-diversity-baseline.mjs';
import {captureStructuralSample,evaluateStructuralPlaygroundBrief,evaluateStructuralPlaygroundSamples} from '../src/core/structural-diversity.mjs';

const hotel=STRUCTURAL_PLAYGROUND_BASELINES.find(x=>x.id==='boutique-hotel');

test('structural playground exposes rendered structure and nearest baseline evidence',()=>{
  const out=evaluateStructuralPlaygroundBrief('Community science observatory with citizen projects, telescope bookings, live sky data, workshops and member profiles.');
  assert.match(out.status,/^(PASS|WARN|FAIL)$/);
  assert.equal(out.source,'rendered-dom-and-page-graph');
  assert.equal(out.baselineCount,8);
  assert.ok(out.candidate.homepage.sectionSequence.length>=5);
  assert.ok(out.candidate.homepage.geometrySequence.length>=5);
  assert.ok(out.candidate.homepage.templateFamilies.length>=5);
  assert.ok(out.candidate.root.heroArchetype);
  assert.ok(out.candidate.root.navigationModel);
  assert.equal(out.nearest.length,3);
});

test('structural playground warns when a brief lands on an existing same-domain skeleton',()=>{
  const out=evaluateStructuralPlaygroundBrief(hotel.brief);
  assert.equal(out.status,'WARN');
  assert.equal(out.nearest[0].id,'boutique-hotel');
  assert.equal(out.nearest[0].compositeDistance,0);
  assert.equal(out.hardCollisions.length,0);
});

test('structural playground fails closed on a cross-domain identical skeleton',()=>{
  const base=captureStructuralSample(hotel);
  const candidate={...base,id:'fake-law',domain:'local-professional-service'};
  const out=evaluateStructuralPlaygroundSamples(candidate,[base]);
  assert.equal(out.status,'FAIL');
  assert.equal(out.hardCollisions.length,1);
  assert.equal(out.hardCollisions[0].compositeDistance,0);
});


test('structural playground uses WARN for a dimension-level collision outside the hard composite radius',()=>{
  const out=evaluateStructuralPlaygroundBrief('Specialist dermatology clinic with doctor profiles, treatments, appointment booking, patient preparation guides and insurance information.');
  assert.equal(out.status,'WARN');
  assert.equal(out.hardCollisions.length,0);
  assert.ok(out.warningCollisions.length>=1);
  assert.ok(out.nearest[0].compositeDistance>=out.thresholds.hardCompositeCollision);
});

test('structural playground rejects malformed briefs',()=>{
  assert.throws(()=>evaluateStructuralPlaygroundBrief('short'),/at least 8 characters/);
});
