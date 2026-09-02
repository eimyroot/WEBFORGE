import { federatedSources, rankFederatedSources, federatedResolutionPlan, evaluateFederatedItem } from '../src/core/federated-components.mjs';
const sources=federatedSources();
const ranked=rankFederatedSources('premium ecommerce pricing checkout',{runtime:'next'}).slice(0,5);
const plan=federatedResolutionPlan({archetype:'marketplace',domain:{genome:{visualMode:'application'}}},['commerce.checkout','media.gallery'],'next');
const policy=evaluateFederatedItem({name:'demo-card',type:'registry:component',files:[{path:'components/demo-card.tsx'}],dependencies:['react']},{licenseEvidence:{status:'PASS',detail:'test fixture'}});
const ok=sources.length>=14&&ranked.length===5&&plan.queries.length>=2&&policy.status==='PASS';
console.log(JSON.stringify({status:ok?'PASS':'FAIL',sources:sources.length,ranked:ranked.map(x=>x.id),plan,policy},null,2));
if(!ok) process.exit(1);
