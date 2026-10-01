import test from 'node:test';
import assert from 'node:assert/strict';
import {STRUCTURAL_PLAYGROUND_BASELINES} from '../src/core/structural-diversity-baseline.mjs';
import {captureStructuralSample,classifyStructuralCollision,evaluateStructuralPlaygroundBrief,evaluateStructuralPlaygroundSamples} from '../src/core/structural-diversity.mjs';

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
  assert.ok(out.hardCollisions[0].collision.coreViolationCount>=out.thresholds.minimumCoreViolationsForHard);
});

test('structural playground does not hard-fail a lone auxiliary dimension even inside the composite radius',()=>{
  const distance={
    compositeDistance:0.4,sectionSequenceDistance:0.7,geometrySequenceDistance:0.7,
    roleSequenceDistance:0.7,templateFamilyDistance:0.7,zoneSequenceDistance:0,
    pageGraphDistance:0.8
  };
  const collision=classifyStructuralCollision(distance);
  assert.equal(collision.severity,'WARN');
  assert.equal(collision.hard,false);
  assert.equal(collision.coreViolationCount,0);
  assert.deepEqual(collision.auxiliaryViolations,['zoneSequenceDistance']);
});

test('structural playground requires multiple core dimension failures for a hard collision',()=>{
  const distance={
    compositeDistance:0.4,sectionSequenceDistance:0,geometrySequenceDistance:0.7,
    roleSequenceDistance:0,templateFamilyDistance:0.7,zoneSequenceDistance:0.7,
    pageGraphDistance:0.8
  };
  const collision=classifyStructuralCollision(distance);
  assert.equal(collision.severity,'FAIL');
  assert.equal(collision.hard,true);
  assert.deepEqual(collision.coreViolations,['sectionSequenceDistance','roleSequenceDistance']);
});

test('structural playground uses WARN for a dimension-level collision outside the hard composite radius',()=>{
  const out=evaluateStructuralPlaygroundBrief('Specialist dermatology clinic with doctor profiles, treatments, appointment booking, patient preparation guides and insurance information.');
  assert.equal(out.status,'WARN');
  assert.equal(out.hardCollisions.length,0);
  assert.ok(out.warningCollisions.length>=1);
  assert.ok(out.nearest[0].compositeDistance>=out.thresholds.hardCompositeCollision);
});

test('civic issue portal resolves to civic structure instead of a SaaS hard collision',()=>{
  const out=evaluateStructuralPlaygroundBrief('Civic issue portal for residents to report local problems, track cases, browse service updates, see district notices and contact municipal teams.');
  assert.equal(out.candidate.domain,'civic-government');
  assert.equal(out.hardCollisions.length,0);
  assert.notEqual(out.status,'FAIL');
  assert.ok(out.nearest.every(x=>x.id!=='accounting-saas'||x.compositeDistance>=out.thresholds.hardCompositeCollision));
});

test('generic portal web-app no longer reuses the SaaS hard skeleton',()=>{
  const out=evaluateStructuralPlaygroundBrief('Public library portal for catalog search, digital resources, room bookings, events, account services and branch information.');
  assert.equal(out.candidate.domain,'web-application');
  assert.equal(out.hardCollisions.length,0);
  assert.ok(out.nearest.every(x=>x.id!=='accounting-saas'||x.compositeDistance>=out.thresholds.hardCompositeCollision));
});


test('structural playground hard-fails same-domain skeleton reuse when product intent changes',()=>{
  const manufacturer=captureStructuralSample({id:'robotics-manufacturer',brief:'Industrial robotics manufacturer with product families, technical specifications, applications, engineering support, case studies and RFQ.'});
  const marketplace=captureStructuralSample({id:'industrial-marketplace',brief:'B2B marketplace for industrial machine parts with technical filters, supplier verification, RFQ workflow and account dashboard.'});
  assert.equal(manufacturer.domain,marketplace.domain);
  assert.notEqual(manufacturer.intent.signature,marketplace.intent.signature);
  const out=evaluateStructuralPlaygroundSamples(manufacturer,[marketplace]);
  assert.equal(out.status,'FAIL');
  assert.equal(out.hardCollisions.length,1);
  assert.equal(out.hardCollisions[0].id,'industrial-marketplace');
});

test('structural playground keeps same-domain same-intent clones as warnings rather than false hard blockers',()=>{
  const base=captureStructuralSample(hotel);
  const clone={...base,id:'same-intent-hotel'};
  const out=evaluateStructuralPlaygroundSamples(clone,[base]);
  assert.equal(out.status,'WARN');
  assert.equal(out.hardCollisions.length,0);
});

test('structural playground rejects malformed briefs',()=>{
  assert.throws(()=>evaluateStructuralPlaygroundBrief('short'),/at least 8 characters/);
});
