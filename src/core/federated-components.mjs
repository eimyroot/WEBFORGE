import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const seedPath=path.join(here,'../registries/federated-sources.json');
const seeds=Object.freeze(JSON.parse(fs.readFileSync(seedPath,'utf8')));
const DIRECTORY_URL='https://ui.shadcn.com/r/registries.json';
const TOKEN=/[a-z0-9][a-z0-9-]{1,}/g;

const tokens=value=>new Set(String(value||'').toLowerCase().match(TOKEN)||[]);
const overlap=(a,b)=>{let n=0; for(const x of a) if(b.has(x)) n++; return n;};
const safeHttps=value=>{try{return new URL(value).protocol==='https:';}catch{return false;}};
const clone=x=>JSON.parse(JSON.stringify(x));

export function federatedSources(){ return clone(seeds); }

function mergeDirectory(directory=[]){
  const byId=new Map(seeds.filter(x=>x.id!=='shadcn-directory').map(x=>[x.id,{...x}]));
  for(const raw of directory){
    if(!raw?.name||!raw?.url||!safeHttps(raw.url.replace('{name}','probe'))) continue;
    const seed=byId.get(raw.name)||{};
    byId.set(raw.name,{
      id:raw.name,
      kind:'shadcn-registry',
      homepage:raw.homepage||seed.homepage||null,
      url:raw.url,
      description:raw.description||seed.description||'',
      trust:seed.trust||'directory-listed',
      licensePolicy:seed.licensePolicy||'VERIFY_EXACT_ITEM',
      frameworks:seed.frameworks||['react','next','vite-react'],
      priority:seed.priority||70,
      tags:seed.tags||[]
    });
  }
  return [...byId.values()];
}

export function registryScore(source,query,{runtime='next'}={}){
  const q=tokens(query); const text=tokens([source.id,source.description,...(source.tags||[])].join(' '));
  let score=Number(source.priority||0)+overlap(q,text)*14;
  if(source.frameworks?.includes(runtime)||source.frameworks?.includes('any')) score+=12;
  if(source.trust==='directory-listed'||source.trust==='curated-open-source-index') score+=5;
  return score;
}

export function rankFederatedSources(query,{runtime='next',directory=[]}={}){
  return mergeDirectory(directory)
    .map(source=>({...source,score:registryScore(source,query,{runtime})}))
    .sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}

export function deriveCatalogUrl(source){
  if(!source?.url) return null;
  if(source.catalogUrl) return source.catalogUrl;
  const u=source.url;
  if(u.includes('{name}.json')) return u.replace('{name}.json','registry.json');
  if(u.includes('{name}/json')) return u.replace('{name}/json','registry.json');
  if(u.includes('{name}')) return u.replace('{name}','registry');
  return null;
}

export function exactItemUrl(source,itemName){
  if(!source?.url||!itemName||!source.url.includes('{name}')) return null;
  return source.url.replace('{name}',encodeURIComponent(itemName));
}

async function fetchJson(url,{fetchImpl=globalThis.fetch,timeoutMs=3500}={}){
  if(typeof fetchImpl!=='function') throw new Error('fetch unavailable');
  if(!safeHttps(url)) throw new Error('non-HTTPS registry URL blocked');
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetchImpl(url,{headers:{accept:'application/json'},signal:controller.signal,redirect:'follow'});
    if(!res?.ok) throw new Error(`HTTP ${res?.status??'ERR'}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

export async function loadOfficialRegistryDirectory(options={}){
  try{
    const data=await fetchJson(DIRECTORY_URL,options);
    if(!Array.isArray(data)) throw new Error('registry directory must be an array');
    return {status:'PASS',source:DIRECTORY_URL,items:data};
  }catch(error){
    return {status:'UNVERIFIED',source:DIRECTORY_URL,items:[],error:String(error?.message||error)};
  }
}

function itemScore(item,query,source){
  const q=tokens(query); const text=tokens([item.name,item.title,item.description,item.type].join(' '));
  let score=overlap(q,text)*22+(source.score||source.priority||0);
  if(['registry:block','registry:component','registry:ui','registry:item'].includes(item.type)) score+=6;
  return score;
}

export async function searchFederatedComponents(query,{runtime='next',fetchImpl=globalThis.fetch,limitRegistries=6,limitItems=12,timeoutMs=3500,directory=null}={}){
  const official=directory?{status:'PASS',items:directory}:await loadOfficialRegistryDirectory({fetchImpl,timeoutMs});
  const ranked=rankFederatedSources(query,{runtime,directory:official.items}).slice(0,limitRegistries);
  const candidates=[],attempts=[];
  for(const source of ranked){
    const catalog=deriveCatalogUrl(source); if(!catalog){attempts.push({source:source.id,status:'BLOCKED',reason:'catalog-url-unresolved'});continue;}
    const url=new URL(catalog); url.searchParams.set('q',query); url.searchParams.set('limit',String(limitItems)); url.searchParams.set('offset','0');
    try{
      const payload=await fetchJson(url.toString(),{fetchImpl,timeoutMs}); const items=Array.isArray(payload?.items)?payload.items:[];
      attempts.push({source:source.id,status:'PASS',catalog:url.toString(),items:items.length});
      for(const item of items) candidates.push({source:source.id,sourceUrl:source.url,homepage:source.homepage,item:{name:item.name,title:item.title||item.name,description:item.description||'',type:item.type||'registry:item'},score:itemScore(item,query,source),exactUrl:exactItemUrl(source,item.name),licensePolicy:source.licensePolicy,trust:source.trust});
    }catch(error){ attempts.push({source:source.id,status:'UNVERIFIED',catalog:url.toString(),reason:String(error?.message||error)}); }
  }
  candidates.sort((a,b)=>b.score-a.score||`${a.source}/${a.item.name}`.localeCompare(`${b.source}/${b.item.name}`));
  return {schema:'webforge.federated-search.v1',query,runtime,status:candidates.length?'PASS':'UNVERIFIED',directoryStatus:official.status,candidates:candidates.slice(0,limitItems),attempts};
}

const unsafeTarget=p=>typeof p==='string'&&(path.isAbsolute(p)||p.split(/[\\/]+/).includes('..')||p.startsWith('.github/workflows/'));
export function evaluateFederatedItem(payload,{source=null,licenseEvidence=null}={}){
  const checks=[]; const files=Array.isArray(payload?.files)?payload.files:[]; const deps=Array.isArray(payload?.dependencies)?payload.dependencies:[];
  checks.push({id:'schema-shape',status:payload?.name&&payload?.type&&files.length?'PASS':'FAIL'});
  checks.push({id:'file-target-boundary',status:files.every(f=>!unsafeTarget(f.target||f.path))?'PASS':'FAIL'});
  checks.push({id:'install-scripts',status:(payload?.scripts||payload?.postInstall||payload?.preInstall)?'BLOCKED':'PASS'});
  checks.push({id:'environment-variables',status:Array.isArray(payload?.envVars)&&payload.envVars.length?'REVIEW_REQUIRED':'PASS'});
  checks.push({id:'dependency-count',status:deps.length<=30?'PASS':'REVIEW_REQUIRED',detail:deps.length});
  checks.push({id:'license',status:licenseEvidence?.status==='PASS'?'PASS':'REVIEW_REQUIRED',detail:licenseEvidence?.detail||source?.licensePolicy||'VERIFY_EXACT_ITEM'});
  const hardFail=checks.some(x=>['FAIL','BLOCKED'].includes(x.status)); const review=checks.some(x=>x.status==='REVIEW_REQUIRED');
  return {schema:'webforge.federated-item-policy.v1',status:hardFail?'BLOCKED':review?'REVIEW_REQUIRED':'PASS',checks};
}

export async function inspectFederatedCandidate(candidate,{fetchImpl=globalThis.fetch,timeoutMs=3500,licenseEvidence=null}={}){
  if(!candidate?.exactUrl) return {status:'BLOCKED',reason:'exact-item-url-missing'};
  try{
    const payload=await fetchJson(candidate.exactUrl,{fetchImpl,timeoutMs});
    const source=federatedSources().find(x=>x.id===candidate.source)||candidate;
    const policy=evaluateFederatedItem(payload,{source,licenseEvidence});
    return {schema:'webforge.federated-inspection.v1',status:policy.status,candidate,payload,policy,installAuthorized:policy.status==='PASS'};
  }catch(error){ return {schema:'webforge.federated-inspection.v1',status:'UNVERIFIED',candidate,error:String(error?.message||error),installAuthorized:false}; }
}

export function federatedResolutionPlan(project,caps=[],runtime='next'){
  const queries=[]; const archetype=project?.archetype||'website'; const visual=project?.domain?.genome?.visualMode||'marketing';
  queries.push(`${archetype} ${visual} hero navigation footer responsive`);
  if(caps.includes('commerce.payment')||caps.includes('commerce.checkout')) queries.push('ecommerce product cart checkout pricing');
  if(caps.includes('auth.account')||caps.includes('auth.identity')) queries.push('authentication account profile settings');
  if(caps.includes('media.gallery')) queries.push('gallery lightbox carousel media');
  if(caps.some(x=>x.includes('event'))) queries.push('events schedule calendar tickets lineup');
  if(caps.some(x=>x.includes('search'))) queries.push('search filters command palette autocomplete');
  return {schema:'webforge.federated-resolution-plan.v1',status:'READY',runtime,queries:[...new Set(queries)],policy:{install:'EXACT_ITEM_ONLY_AFTER_POLICY_PASS',license:'VERIFY_EXACT_ITEM',network:'EXPLICIT',fallback:'INTERNAL_REGISTRY_OR_PROJECT_LOCAL_SYNTHESIS'}};
}
