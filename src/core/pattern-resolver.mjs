import { registry } from './composition-registry.mjs';
const patterns=registry('patterns');
export function resolveCompositionPatterns(plan){
  const wanted=new Set(['navigation','hero','layout']);
  if(plan.project.flags.gallery)wanted.add('media');
  if(plan.project.flags.booking||plan.project.flags.tickets||plan.project.flags.commerce)wanted.add('conversion');
  if(plan.layout.signals?.trust>60)wanted.add('trust');
  if(plan.layout.signals?.content>60)wanted.add('content');
  wanted.add('proof');
  const selected=[];for(const cat of wanted){const pool=patterns.filter(x=>x.category===cat).sort((a,b)=>b.qualityScore-a.qualityScore);if(pool[0])selected.push(pool[0]);if((cat==='media'||cat==='layout')&&pool[1])selected.push(pool[1]);}
  return {schema:'webforge.composition-patterns.r1',selected,qualityFloor:Math.min(...selected.map(x=>x.qualityScore)),categories:[...wanted]};
}
