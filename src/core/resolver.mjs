import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { federatedResolutionPlan } from './federated-components.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(path.join(here,'../registries',name),'utf8'));
const runtimes=read('runtimes.json'),components=read('components.json'),tools=read('tools.json'),patterns=read('patterns.json');
function runtimeScore(runtime,project){
  const g=project.domain?.genome||{}; let score=runtime.best_for.includes(project.archetype)?65:30;
  if(g.applicationDepth>=3) score+=runtime.id==='next'?32:runtime.id==='vite-react'?20:-25;
  else if(g.applicationDepth===2) score+=runtime.id==='next'?20:runtime.id==='astro'?8:12;
  else if(['local-service','company','portfolio','editorial','venue'].includes(project.archetype)) score+=runtime.id==='astro'?28:0;
  if(project.flags.auth||project.flags.commerce) score+=runtime.id==='next'?18:runtime.id==='vite-react'?10:-15;
  if(g.visualMode==='experiential'&&runtime.id==='astro') score+=8;
  if(g.content?.includes?.('editorial')&&runtime.id==='astro') score+=10;
  if(project.flags.mobile) score+=2;
  return Math.max(0,Math.min(100,score));
}
function chooseTools(project,caps,runtime){
  const selected=[],rejected=[];const add=(id,reason)=>selected.push({id,reason});const reject=(id,reason)=>rejected.push({id,reason});
  add('shadcn-registry','canonical component/resource bus');add('mcp','capability discovery transport; policy remains authoritative');
  if(project.domain?.genome?.applicationDepth>=3) add('onlook','code-native editing for application surface');
  else add('puck','human visual composition over approved component palette');
  if(caps.includes('content.cms')) add('sanity','structured frequently changing content'); else reject('sanity','content is static enough to avoid CMS complexity');
  if(caps.includes('data.application')) add('supabase','auth/data/storage capability required'); else reject('supabase','no persistent application data model required');
  if(caps.includes('media.gallery')&&(project.domain?.genome?.mediaIntensity||0)>=55) add('cloudinary','media-heavy project benefits from responsive transformations'); else reject('cloudinary','native media path is sufficient');
  if(caps.includes('analytics.product')){add('posthog','product analytics required');reject('plausible','insufficient for product behavior analysis');}
  else {add('plausible','simple privacy-oriented site analytics');reject('posthog','product analytics unnecessary');}
  if(runtime.id==='astro') add('cloudflare','static/edge-oriented deployment fit'); else add('vercel','React/Next deployment fit');
  return {selected,rejected};
}
export function resolve(project,caps){
  const ranked=runtimes.map(r=>({...r,score:runtimeScore(r,project)})).sort((a,b)=>b.score-a.score),runtime=ranked[0];
  let selectedPatterns=patterns.filter(p=>p.best_for.includes(project.archetype));
  if(project.domain?.classification!=='KNOWN') selectedPatterns=patterns.filter(p=>p.best_for.includes(project.archetype)||p.best_for.includes('company')).slice(0,12);
  let palette=components.filter(c=>c.trust==='approved'&&c.runtime.includes(runtime.id)&&c.suitable_for.includes(project.archetype)).slice(0,18);
  if(palette.length<8) palette=components.filter(c=>c.trust==='approved'&&c.runtime.includes(runtime.id)).slice(0,18);
  const toolResolution=chooseTools(project,caps,runtime);
  const rejectedRuntime=ranked.slice(1).map(r=>({id:r.id,reason:`lower deterministic fit score (${r.score}) than ${runtime.id} (${runtime.score})`}));
  return {runtime:{id:runtime.id,score:runtime.score,reason:`universal fit; applicationDepth=${project.domain?.genome?.applicationDepth??0}`},runtimeCandidates:ranked.map(({id,score,reason})=>({id,score,reason})),patterns:selectedPatterns,components:palette,federatedComponents:federatedResolutionPlan(project,caps,runtime.id),tools:toolResolution.selected,rejected:[...rejectedRuntime,...toolResolution.rejected]};
}
