import test from 'node:test';
import assert from 'node:assert/strict';
import { federatedSources, rankFederatedSources, searchFederatedComponents, inspectFederatedCandidate, evaluateFederatedItem, federatedResolutionPlan } from '../src/core/federated-components.mjs';

test('federated pack exposes curated seeds and ranks capability-fit sources',()=>{
  const sources=federatedSources(); assert.ok(sources.length>=14);
  const ranked=rankFederatedSources('ecommerce cart checkout pricing',{runtime:'next'});
  assert.equal(ranked[0].kind,'shadcn-registry');
  assert.ok(ranked.slice(0,5).some(x=>x.id==='@commercn'||x.tags?.includes('ecommerce')));
});

test('federated search fetches only catalogs then returns exact item URLs',async()=>{
  const directory=[{name:'@demo',homepage:'https://demo.example',url:'https://demo.example/r/{name}.json',description:'ecommerce checkout pricing blocks'}];
  const fetchImpl=async url=>({ok:true,status:200,json:async()=> url.includes('registry.json')?{items:[{name:'pricing-pro',type:'registry:block',title:'Pricing Pro',description:'pricing checkout conversion'}]}:[]});
  const result=await searchFederatedComponents('pricing checkout',{runtime:'next',directory,fetchImpl,limitRegistries:1});
  assert.equal(result.status,'PASS');
  assert.equal(result.candidates[0].item.name,'pricing-pro');
  assert.match(result.candidates[0].exactUrl,/\/pricing-pro\.json$/);
  assert.ok(result.candidates[0].source.startsWith('@'));
});

test('exact external item remains fail-closed until license and policy pass',async()=>{
  const candidate={source:'@demo',exactUrl:'https://demo.example/r/card.json'};
  const payload={name:'card',type:'registry:component',files:[{path:'components/card.tsx'}],dependencies:['react']};
  const fetchImpl=async()=>({ok:true,status:200,json:async()=>payload});
  const pending=await inspectFederatedCandidate(candidate,{fetchImpl}); assert.equal(pending.status,'REVIEW_REQUIRED'); assert.equal(pending.installAuthorized,false);
  const approved=await inspectFederatedCandidate(candidate,{fetchImpl,licenseEvidence:{status:'PASS',detail:'verified license'}}); assert.equal(approved.status,'PASS'); assert.equal(approved.installAuthorized,true);
  const blocked=evaluateFederatedItem({...payload,files:[{path:'../outside.tsx'}]},{licenseEvidence:{status:'PASS'}}); assert.equal(blocked.status,'BLOCKED');
});

test('resolution plan is capability-first and exact-item-only',()=>{
  const plan=federatedResolutionPlan({archetype:'venue',domain:{genome:{visualMode:'cinematic'}}},['events.list','media.gallery','commerce.checkout'],'next');
  assert.equal(plan.status,'READY'); assert.match(plan.policy.install,/EXACT_ITEM_ONLY/); assert.ok(plan.queries.some(q=>q.includes('gallery'))); assert.ok(plan.queries.some(q=>q.includes('checkout')));
});
