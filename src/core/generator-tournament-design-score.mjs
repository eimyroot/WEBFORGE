import fs from 'node:fs';
import path from 'node:path';
import {
  PERCEPTUAL_EVALUATOR_SCHEMA,
  buildPerceptualReviewRequest,
  evaluatePerceptualVisualCritic
} from './web-ui-perceptual-critic.mjs';

export const TOURNAMENT_DESIGN_SCORE_SCHEMA='webforge.generator-tournament-design-score.v1';
export const TOURNAMENT_REVIEW_SCHEMA='webforge.generator-tournament-perceptual-reviews.v1';

const ROLE_HINTS={
  offer:['offer','featured','services','categories','product','solution','value'],
  proof:['proof','security','trust','testimonial','case','evidence'],
  process:['process','workflow','journey','task','steps'],
  gallery:['gallery','media','showcase','portfolio','visual'],
  faq:['faq','objection','questions'],
  pricing:['pricing','price','transaction','purchase','checkout','action'],
  integrations:['integrations','integration','ecosystem','connector','api','tools'],
  contact:['contact','location','orient','convert','cta']
};
const GENERIC_ROLES=new Set(['offer','proof','process','faq','contact']);
const SPECIALIZED_ROLES=new Set(['gallery','pricing','integrations']);
const clamp=value=>Math.max(0,Math.min(1,value));
const average=items=>items.length?items.reduce((a,b)=>a+b,0)/items.length:0;
const norm=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function tokens(value){
  return new Set(String(value||'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2));
}
function unionTokens(values){
  const out=new Set();
  for(const value of values) for(const token of tokens(value)) out.add(token);
  return out;
}
function sectionTags(root){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  return [...html.matchAll(/<section\b([^>]*)>/gi)].map((match,index)=>{
    const attrs=match[1]||'';
    const id=attrs.match(/\bid=["']([^"']+)["']/i)?.[1]||null;
    const classes=(attrs.match(/\bclass=["']([^"']+)["']/i)?.[1]||'').split(/\s+/).filter(Boolean);
    return {id:id||`section-${index+1}`,classes};
  });
}
function classifyRole(section){
  const hay=[section.id,...section.classes].map(norm).join('-');
  for(const [role,hints] of Object.entries(ROLE_HINTS)) if(hints.some(h=>hay.includes(h))) return role;
  return null;
}
function designVocabulary(designSpec){
  const components=(designSpec.components||[]).flatMap(x=>[x.id,x.role,x.template]);
  const hierarchy=(designSpec.layout?.information_hierarchy||[]).flatMap(x=>[x.id,x.purpose,x.path]);
  const direction=[designSpec.direction?.name,designSpec.direction?.intent,...(designSpec.direction?.keywords||[])];
  return unionTokens([...components,...hierarchy,...direction,...(designSpec.critical_journeys||[])]);
}

function directDesignIds(designSpec){
  return new Set([
    ...(designSpec.components||[]).map(x=>norm(x.id)),
    ...(designSpec.layout?.information_hierarchy||[]).map(x=>norm(x.id))
  ].filter(Boolean));
}
function sectionSupport(section,{directIds,vocabulary}){
  const id=norm(section.id);
  const heroAlias=id==='top'&&section.classes.some(x=>norm(x).includes('hero'));
  if(id==='hero'||heroAlias) return {score:1,reason:'hero-contract'};
  if(directIds.has(id)) return {score:1,reason:'exact-design-id'};
  const role=classifyRole(section);
  if(role&&ROLE_HINTS[role].some(h=>vocabulary.has(h))) return {score:1,role,reason:'role-supported-by-design-context'};
  if(role&&GENERIC_ROLES.has(role)) return {score:.65,role,reason:'generic-role-not-explicitly-supported'};
  if(role&&SPECIALIZED_ROLES.has(role)) return {score:.15,role,reason:'specialized-role-not-supported'};
  return {score:.45,role:null,reason:'unclassified-section'};
}
function normalizeHref(value){
  const raw=String(value||'').split(/[?#]/)[0].trim();
  if(!raw||/^[a-z]+:/i.test(raw)||raw.startsWith('//')) return null;
  if(raw==='.'||raw==='./') return '/';
  if(raw.startsWith('./')) return `/${raw.slice(2).replace(/^\/+|\/+$/g,'')}/`;
  if(raw.startsWith('/')) return raw==='/'?'/':`/${raw.replace(/^\/+|\/+$/g,'')}/`;
  return `/${raw.replace(/^\/+|\/+$/g,'')}/`;
}
function hrefs(root,selector='all'){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const anchors=[...html.matchAll(/<a\b([^>]*)href=["']([^"']+)["'][^>]*>/gi)];
  return anchors.filter(match=>selector==='all'||/(?:cta|primary|button)/i.test(match[1]||'')).map(match=>normalizeHref(match[2])).filter(Boolean);
}
function knownRoutes(designSpec){
  return new Set((designSpec.layout?.information_hierarchy||[]).map(x=>x.path).filter(Boolean));
}
function routeCoverage(items,known){
  const internal=items.filter(x=>x.startsWith('/'));
  if(!internal.length) return .5;
  return internal.filter(x=>known.has(x)).length/internal.length;
}

export function evaluateDomainFit({root,designSpec}){
  if(designSpec?.schema!=='WebUIDesignSpec/v1') throw new Error('WebUIDesignSpec/v1 required');
  const sections=sectionTags(root);
  const directIds=directDesignIds(designSpec),vocabulary=designVocabulary(designSpec);
  const section_evidence=sections.map(section=>({section_id:section.id,...sectionSupport(section,{directIds,vocabulary})}));
  const semantic=average(section_evidence.map(x=>x.score));
  const known=knownRoutes(designSpec);
  const cta=routeCoverage(hrefs(root,'cta'),known),navigation=routeCoverage(hrefs(root,'all'),known);
  const unsupported=section_evidence.filter(x=>x.score<.5&&SPECIALIZED_ROLES.has(x.role)).length;
  const base=.82*semantic+.10*cta+.08*navigation;
  const score=clamp(base-Math.min(.2,unsupported*.10));
  return {
    schema:'webforge.generator-domain-fit.v1',status:'PASS',score:Number(score.toFixed(3)),
    dimensions:{semantic_sections:Number(semantic.toFixed(3)),cta_routes:Number(cta.toFixed(3)),navigation_routes:Number(navigation.toFixed(3))},
    unsupported_specialized_sections:unsupported,section_evidence,
    policy:{deterministic:true,advisory_only:true,release_authority:'NONE',production_authority:'NONE'}
  };
}

export function scorePerceptualCritique(critique){
  if(!critique||['BLOCKED','UNVERIFIED'].includes(critique.status)) return {status:critique?.status||'UNVERIFIED',score:null,reason:critique?.reason||'review unavailable'};
  const weights={P1:.20,P2:.09,P3:.04};
  const penalty=(critique.issues||[]).reduce((sum,issue)=>sum+(weights[issue.severity]||0)*clamp(Number(issue.confidence)||0),0);
  return {status:'REVIEWED',score:Number(clamp(1-Math.min(.8,penalty)).toFixed(3)),issue_count:(critique.issues||[]).length,penalty:Number(Math.min(.8,penalty).toFixed(3))};
}

function reviewMatchesRequest(review,request){
  const expected=review?.screenshot_sha256||{};
  const actual=Object.fromEntries((request.screenshots||[]).map(x=>[x.viewport,x.sha256]));
  const ids=Object.keys(actual);
  return ids.length===3&&ids.every(id=>expected[id]===actual[id]);
}
export function evaluateCandidateDesign({root,designSpec,review}){
  const quality=JSON.parse(fs.readFileSync(path.join(root,'web-ui-quality.receipt.json'),'utf8'));
  const request=buildPerceptualReviewRequest(root,{spec:designSpec,quality});
  fs.writeFileSync(path.join(root,'web-ui-perceptual.request.json'),JSON.stringify(request,null,2)+'\n');
  const domain_fit=evaluateDomainFit({root,designSpec});
  let critique;
  if(!review) critique=evaluatePerceptualVisualCritic({request,evaluatorOutput:null});
  else if(!reviewMatchesRequest(review,request)) critique={schema:'webforge.web-ui-perceptual-critique.v1',status:'BLOCKED',issues:[],invalid:['review screenshot digest mismatch'],reason:'review does not match exact tournament screenshots',request_digest:request.request_digest,decision:{automatic_repair_allowed:false,human_review_required:true},policy:{advisory_only:true,release_authority:'NONE'}};
  else {
    const evaluatorOutput={schema:PERCEPTUAL_EVALUATOR_SCHEMA,request_digest:request.request_digest,evaluator:review.evaluator,observations:review.observations||[]};
    critique=evaluatePerceptualVisualCritic({request,evaluatorOutput});
  }
  fs.writeFileSync(path.join(root,'web-ui-perceptual-critique.json'),JSON.stringify(critique,null,2)+'\n');
  const perceptual=scorePerceptualCritique(critique);
  const result={
    schema:'webforge.generator-candidate-design-evaluation.v1',status:perceptual.score===null?'UNVERIFIED':'REVIEWED',
    domain_fit,perceptual,
    truth_boundary:{aesthetic_judgement:'reviewed advisory evidence',domain_fit:'deterministic heuristic',release_authority:'NONE',production_authority:'NONE'}
  };
  fs.writeFileSync(path.join(root,'candidate.design-evaluation.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}

function reviewedAverage(items,key){
  const values=items.map(x=>x?.[key]).filter(Number.isFinite);
  return values.length===items.length&&items.length?average(values):null;
}
function designAwareScore({technical,domainFit,perceptual}){
  if(!technical||domainFit===null||perceptual===null) return {status:'UNVERIFIED',total:null};
  const quality=Number(technical.raw?.quality||0),behavior=Number(technical.raw?.behavior||0);
  const diversity=Number(technical.raw?.diversityRatio||0),efficiency=Number(technical.raw?.efficiency||0);
  const parts={
    quality:quality*20,behavior:behavior*15,domain_fit:domainFit*25,
    perceptual:perceptual*25,diversity:diversity*10,efficiency:efficiency*5
  };
  return {
    status:'REVIEWED',
    ...Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,Number(v.toFixed(2))])),
    total:Number(Object.values(parts).reduce((a,b)=>a+b,0).toFixed(2)),
    raw:{quality,behavior,domainFit,perceptual,diversity,efficiency}
  };
}
function validateReviews(reviews){
  if(reviews?.schema!==TOURNAMENT_REVIEW_SCHEMA) throw new Error(`${TOURNAMENT_REVIEW_SCHEMA} required`);
  if(!reviews.reviews||typeof reviews.reviews!=='object') throw new Error('reviews map required');
  return reviews;
}

export function rescoreGeneratorTournamentRun(runRoot,{reviews}={}){
  reviews=validateReviews(reviews);
  const receipt=JSON.parse(fs.readFileSync(path.join(runRoot,'generator-tournament.receipt.json'),'utf8'));
  const candidates=['webforge-native','uigen-fx-4b'];
  const evaluations={};
  for(const caseItem of receipt.cases||[]){
    const caseRoot=path.join(runRoot,caseItem.id);
    const input=JSON.parse(fs.readFileSync(path.join(caseRoot,'tournament.input.json'),'utf8'));
    evaluations[caseItem.id]={};
    for(const candidate of candidates){
      const root=path.join(caseRoot,candidate);
      evaluations[caseItem.id][candidate]=evaluateCandidateDesign({
        root,designSpec:input.design_spec,review:reviews.reviews?.[caseItem.id]?.[candidate]||null
      });
    }
  }
  const scores={};
  for(const candidate of candidates){
    const items=(receipt.cases||[]).map(x=>evaluations[x.id][candidate]);
    const domainFit=reviewedAverage(items.map(x=>({value:x.domain_fit.score})),'value');
    const perceptual=reviewedAverage(items.map(x=>({value:x.perceptual.score})),'value');
    scores[candidate]=designAwareScore({technical:receipt.scores?.[candidate],domainFit,perceptual});
  }
  const reviewed=Object.values(scores).every(x=>x.status==='REVIEWED'&&Number.isFinite(x.total));
  const leader=reviewed?Object.entries(scores).sort((a,b)=>b[1].total-a[1].total)[0]?.[0]||null:null;
  const result={
    schema:TOURNAMENT_DESIGN_SCORE_SCHEMA,status:reviewed?'REVIEWED':'UNVERIFIED',
    source_run:path.basename(runRoot),score_profile:'design-aware-pilot-v1',
    weights:{quality:20,behavior:15,domain_fit:25,perceptual:25,diversity:10,efficiency:5},
    scores,design_aware_leader:leader,
    evaluations,
    promotion:{winner:null,status:'REVIEW_REQUIRED'},
    truth_boundary:{advisory_only:true,existing_tournament_receipt_unchanged:true,default_generator_changed:false,release_authority:'NONE',production_authority:'NONE'}
  };
  fs.writeFileSync(path.join(runRoot,'generator-tournament.design-score.receipt.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
