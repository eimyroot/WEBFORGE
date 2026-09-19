import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { federatedResolutionPlan } from './federated-components.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=name=>JSON.parse(fs.readFileSync(path.join(here,'../registries',name),'utf8'));
const runtimes=read('runtimes.json'),components=read('components.json'),tools=read('tools.json'),patterns=read('patterns.json');
function runtimeSignals(project,caps=[]){
  const g=project.domain?.genome||{}, brief=String(project.brief||'').toLowerCase(), set=new Set(caps);
  const clean=brief.replace(/\b(?:no|without)\s+(?:an?\s+)?(?:login|auth(?:entication)?|accounts?|backend|server|database|payments?|checkout|cart)\b/g,'');
  const explicitLocal=/\b(browser[- ]only|local[- ]only|local client state)\b/.test(brief);
  const explicitNoServer=/\b(?:no|without)\s+(?:an?\s+)?(?:backend|server|database)\b/.test(brief);
  const clientOnly=explicitLocal||(/\b(single[- ]page|spa|client[- ]side)\b/.test(brief)&&explicitNoServer);
  const explicitDynamic=/\b(login|auth(?:entication)?|account|dashboard|checkout|cart|payment|subscription|member portal|customer portal|admin|real[- ]time|live availability)\b/.test(clean);
  const transaction=[...set].some(x=>['commerce.checkout','data.realtime','booking.availability','workflow.submission','dashboard.admin'].includes(x));
  const appLike=['saas','marketplace','web-app','internal-tool','spa'].includes(project.archetype);
  const authData=appLike&&set.has('identity.auth')&&set.has('data.application');
  const hardDynamic=!clientOnly&&(explicitDynamic||transaction||authData);
  const contentFirst=['local-service','company','portfolio','editorial','venue'].includes(project.archetype)||['editorial-publication','creative-practice'].includes(project.domainArchetype);
  return {applicationDepth:g.applicationDepth||0,clientOnly,hardDynamic,contentFirst,appLike,editorial:g.content?.includes?.('editorial')===true,experiential:g.visualMode==='experiential'};
}
function runtimeScore(runtime,project,caps=[]){
  const s=runtimeSignals(project,caps); let score=runtime.best_for.includes(project.archetype)?55:30;
  if(s.clientOnly) score+=runtime.id==='vite-react'?45:runtime.id==='next'?0:-20;
  else if(s.hardDynamic) score+=runtime.id==='next'?40:runtime.id==='vite-react'?12:-25;
  else if(s.contentFirst) score+=runtime.id==='astro'?40:runtime.id==='next'?4:0;
  else if(s.appLike||s.applicationDepth>=3) score+=runtime.id==='next'?28:runtime.id==='vite-react'?24:-20;
  else if(s.applicationDepth===2) score+=runtime.id==='next'?14:runtime.id==='astro'?10:12;
  else score+=runtime.id==='astro'?16:0;
  if(s.editorial&&!s.hardDynamic&&runtime.id==='astro') score+=10;
  if(s.experiential&&!s.hardDynamic&&runtime.id==='astro') score+=8;
  if(project.flags.mobile) score+=2;
  return Math.max(0,Math.min(100,score));
}
function runtimeReason(project,caps,runtime){
  const s=runtimeSignals(project,caps);
  if(s.clientOnly) return 'client-only task surface; no server dependency required';
  if(s.hardDynamic) return 'live/auth/transaction capability requires server-capable dynamic runtime';
  if(s.contentFirst) return 'content-first surface without hard dynamic requirement';
  return `deterministic fit; applicationDepth=${s.applicationDepth}`;
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
  const ranked=runtimes.map(r=>({...r,score:runtimeScore(r,project,caps)})).sort((a,b)=>b.score-a.score),runtime=ranked[0];
  let selectedPatterns=patterns.filter(p=>p.best_for.includes(project.archetype));
  if(project.domain?.classification!=='KNOWN') selectedPatterns=patterns.filter(p=>p.best_for.includes(project.archetype)||p.best_for.includes('company')).slice(0,12);
  let palette=components.filter(c=>c.trust==='approved'&&c.runtime.includes(runtime.id)&&c.suitable_for.includes(project.archetype)).slice(0,18);
  if(palette.length<8) palette=components.filter(c=>c.trust==='approved'&&c.runtime.includes(runtime.id)).slice(0,18);
  const toolResolution=chooseTools(project,caps,runtime);
  const rejectedRuntime=ranked.slice(1).map(r=>({id:r.id,reason:`lower deterministic fit score (${r.score}) than ${runtime.id} (${runtime.score})`}));
  const decision={schema:'webforge.runtime-selection.v1',selected:runtime.id,reason:runtimeReason(project,caps,runtime),signals:runtimeSignals(project,caps)};
  return {runtime:{id:runtime.id,score:runtime.score,reason:decision.reason},runtimeDecision:decision,runtimeCandidates:ranked.map(({id,score,reason})=>({id,score,reason})),patterns:selectedPatterns,components:palette,federatedComponents:federatedResolutionPlan(project,caps,runtime.id),tools:toolResolution.selected,rejected:[...rejectedRuntime,...toolResolution.rejected]};
}
