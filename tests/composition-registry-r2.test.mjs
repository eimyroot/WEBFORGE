import test from 'node:test';
import assert from 'node:assert/strict';
import { registry,registrySummary } from '../src/core/composition-registry.mjs';
import { rendererCoverage } from '../src/core/renderer-coverage.mjs';
import { renderSection } from '../src/core/visual-renderer.mjs';
import { compose } from '../src/core/compose.mjs';

function contentFor(id){
  const items=Array.from({length:4},(_,i)=>({title:`Item ${i+1}`,name:`Person ${i+1}`,body:'Useful production content.',meta:'Metadata',price:'From scope',date:`${14+i} JUN`,time:'20:00 — 23:00'}));
  if(id==='faq')return {kicker:'FAQ',title:'Questions',items:[['Question one?','Answer one.'],['Question two?','Answer two.']]};
  if(id==='next-event')return {kicker:'NEXT',title:'Dark Matter',date:'31 MAY',time:'23:00 — 06:00',location:'Prague',lineup:['A','B'],cta:'Tickets'};
  if(['process','workflow','how-it-works','schedule'].includes(id))return {kicker:'FLOW',title:'How it works',steps:['Understand','Resolve','Deliver']};
  if(['proof','outcomes','security','trust-strip'].includes(id))return {kicker:'PROOF',title:'Evidence',metrics:[['01','Signal'],['02','Evidence'],['03','Trust']]};
  if(['artists','team'].includes(id))return {kicker:'PEOPLE',title:'People',items};
  if(id==='gallery')return {kicker:'GALLERY',title:'Gallery',items};
  return {kicker:'SECTION',title:'Production section',body:'Purposeful content.',items,features:[['Feature','Description']],metrics:[['01','Signal']],steps:['One','Two','Three']};
}

const visual={content:{brand:'WEBFORGE',model:{hero:{eyebrow:'TEST',headline:'Universal visual factory.',subheadline:'Renderer smoke.',primary:'Start',secondary:'More'},'next-event':{kicker:'NEXT',title:'Event',date:'31 MAY',time:'23:00',location:'Prague',lineup:['A','B'],cta:'Tickets'},final:{eyebrow:'NEXT',headline:'Continue.',primary:'Go',secondary:'Back'}}}};
const plan={product:{entities:[{name:'Entity'}]}};

test('Composition Registry R2 hits renderer-backed baseline',()=>{
  const s=registrySummary();
  assert.equal(s.version,'8.0.0');
  assert.equal(s.counts.sectionTemplates,320);
  assert.equal(s.counts.primitives,60);
  assert.ok(s.counts.rendererContracts>=30);
  const c=rendererCoverage();
  assert.equal(c.registered,320);
  assert.equal(c.rendererBacked,320);
  assert.equal(c.responsiveContract,320);
  assert.equal(c.a11yContract,320);
  assert.equal(c.missing.length,0);
});

test('all 320 registry templates execute through a renderer smoke',()=>{
  const templates=registry('sectionTemplates');
  for(const t of templates){
    const s={...t,id:t.sectionId,role:t.semanticRole?.toUpperCase()||'VALUE',variant:t.layoutMode,content:contentFor(t.sectionId),media:[]};
    const html=renderSection(visual,s,plan);
    assert.ok(html.startsWith('<section'),t.id);
    assert.ok(html.includes(`data-layout="${t.layoutMode}"`)||t.sectionId==='final-cta',t.id);
    assert.ok(!html.includes('undefined'),t.id);
  }
});

test('novel domain synthesizes a project-local component and fail-closes production review',()=>{
  const p=compose('A web ritual for exchanging promises with your future self, represented as evolving constellations, memory fragments and timed unlocks.');
  assert.equal(p.domain.classification,'NOVEL');
  assert.ok(p.layout.sections.includes('domain-signature'));
  assert.ok(p.visual.projectLocalComponents.length>=1);
  assert.equal(p.visual.projectLocalComponents[0].rendererKey,'adaptive-section');
  assert.equal(p.visual.templates.productionReviewRequired,true);
  assert.equal(p.productionEligible,false);
  assert.ok(p.evidence.some(x=>x.check==='project-local-design-review'&&x.status==='REVIEW_REQUIRED'));
});
