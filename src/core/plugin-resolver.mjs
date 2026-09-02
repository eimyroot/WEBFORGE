import { registry } from './composition-registry.mjs';
const plugins=registry('plugins'),sets=registry('pluginSets');
function chooseSets(plan){
  const a=plan.project.archetype,g=plan.domain?.genome||{},caps=new Set(plan.product?.capabilityIds||[]),ids=[];
  if(g.visualMode==='cinematic'||g.visualMode==='experiential')ids.push('cinematic');
  if(a==='venue')ids.push('venue-premium');
  else if(a==='portfolio')ids.push('portfolio-premium');
  else if(a==='local-service')ids.push('local-service');
  else if(a==='marketplace')ids.push('marketplace');
  else if(a==='saas'||a==='web-app')ids.push(plan.capabilities.includes('data.application')?'saas-data':'saas-product');
  else if(a==='editorial')ids.push('editorial');
  else ids.push('marketing-static');
  if(caps.has('commerce.checkout')&&!ids.includes('marketplace'))ids.push('commerce-light');
  if(g.trustBurden==='critical'||g.trustBurden==='high')ids.push('accessibility-first');
  ids.push('production-observability');
  return [...new Set(ids)];
}
export function resolvePlugins(plan){
  const setIds=chooseSets(plan),runtime=plan.selection.runtime.id,records=setIds.map(id=>sets.find(x=>x.id===id)).filter(Boolean);
  const pluginIds=[...new Set(records.flatMap(x=>x.plugins))],selected=[],rejected=[];
  for(const id of pluginIds){const p=plugins.find(x=>x.id===id);if(!p)continue;if(p.runtimes.includes(runtime))selected.push({...p,status:p.maturity==='conditional'?'CONDITIONAL':'PASS'});else rejected.push({id:p.id,reason:`runtime ${runtime} not supported`});}
  return {schema:'webforge.plugin-resolution.universal.v1',sets:records.map(x=>({id:x.id,qualityScore:x.qualityScore,maturity:x.maturity})),set:records[0]?{id:records[0].id,qualityScore:records[0].qualityScore,maturity:records[0].maturity}:{id:'none'},selected,rejected,installAuthority:'EXPLICIT_APPROVAL_REQUIRED',trustFloor:85};
}
