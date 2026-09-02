import { registry } from './composition-registry.mjs';
const connectors=registry('connectors');
const coreAliases={
 'content.cms':['content.cms'],'media.gallery':['media.delivery','media.library'],'data.application':['data.application'],'identity.auth':['identity.auth'],
 'commerce.checkout':['commerce.checkout'],'conversion.tickets':['conversion.tickets'],'conversion.booking':['conversion.booking'],'analytics.product':['analytics.product'],
 'analytics.simple':['analytics.site'],'seo.local':['maps']
};
const needAliases={
 'content.cms':['content.cms'],'media.library':['media.library','media.delivery'],'media.generate':['media.generate'],'identity.auth':['identity.auth'],
 database:['data.application'],'database.realtime':['data.application'],'commerce.payment':['commerce.checkout'],'tickets.purchase':['conversion.tickets'],
 booking:['conversion.booking'],maps:['maps'],'analytics.simple':['analytics.site'],'analytics.product':['analytics.product'],'external.api':['content.api'],
 newsletter:['newsletter'],'messaging':['messaging']
};
export function resolveConnectors(plan){
  const required=new Set();
  for(const cap of plan.capabilities)for(const c of coreAliases[cap]||[])required.add(c);
  for(const need of plan.product?.connectorNeeds||[])for(const c of needAliases[need]||[need])required.add(c);
  const grouped={};for(const c of connectors)if(required.has(c.capability))(grouped[c.capability]??=[]).push(c);
  const selected=[],alternatives=[],missing=[];
  for(const cap of required){
    const items=(grouped[cap]||[]).sort((a,b)=>(b.status==='approved')-(a.status==='approved')||b.trustScore-a.trustScore);
    if(!items.length){missing.push({capability:cap,status:'UNRESOLVED',reason:'no connector contract in registry'});continue;}
    selected.push({...items[0],resolutionStatus:items[0].status==='approved'?'PASS':'CONDITIONAL'});alternatives.push(...items.slice(1).map(x=>({capability:cap,id:x.id,trustScore:x.trustScore})));
  }
  const productionGate=missing.length?'BLOCKED_UNRESOLVED_CONNECTOR':selected.some(x=>x.resolutionStatus==='CONDITIONAL')?'APPROVAL_REQUIRED':'PASS';
  return {schema:'webforge.connector-resolution.universal.v1',requiredCapabilities:[...required],selected,alternatives,missing,productionGate,invariant:'missing connector never equals PASS'};
}
