import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const ontology=JSON.parse(fs.readFileSync(path.join(here,'../registries/domain-ontology.json'),'utf8'));

const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,n));
const has=(text,rx)=>rx.test(text);
const uniq=xs=>[...new Set(xs.filter(Boolean))];

const PURPOSE_RULES=[
  ['sell',/sell|shop|store|e-?commerce|product catalog|buy|purchase|prodat|obchod|e-shop/i],
  ['transact',/checkout|payment|ticket|vstupenk|transaction|order|objedn/i],
  ['book',/book|booking|reservation|appointment|rezerv|term[ií]n/i],
  ['discover',/search|filter|find|discover|browse|directory|marketplace|naj[ií]t|vyhled/i],
  ['inform',/inform|guide|explain|company|service|about|informovat|služb/i],
  ['publish',/news|blog|magazine|journal|editorial|publication|člán/i],
  ['showcase',/portfolio|gallery|showcase|work|projects|galer|ukáz/i],
  ['experience',/immersive|cinematic|interactive story|exhibition|festival|club|experience|ritual|constellation|spatial story|zážitek|výstav/i],
  ['activate',/signup|sign up|trial|onboarding|start using|registrace účtu/i],
  ['operate',/dashboard|internal tool|workspace|admin|manage|spravovat/i],
  ['collaborate',/collaborat|team workspace|shared|co-edit|spolupr/i],
  ['register',/register|enroll|application form|signup|přihláš|registr/i],
  ['fund',/donat|fund|support|adopt|přispět|darovat/i],
  ['submit',/report issue|submit|application|form workflow|hlásit|podat/i],
  ['learn',/course|learning|education|academy|school|workshop|učit|kurz/i],
  ['connect',/community|network|members|forum|connect people|komunit/i],
  ['configure',/configurator|configure|customize product|konfigurátor|nakonfigurovat/i]
];

const AUDIENCE_RULES=[
  ['consumer',/consumer|customer|guest|visitor|fan|shopper|patient|parent|B2C|zákazn|návštěv/i],
  ['professional',/professional|contractor|designer|doctor|lawyer|artist|specialist|odborn|živnost/i],
  ['enterprise',/enterprise|b2b|procurement|company buyer|industrial|corporate|firma|podnik/i],
  ['community',/community|members|fans|residents|citizens|students|komunit|občan|student/i],
  ['public',/government|municipality|city|public service|úřad|město/i],
  ['internal',/internal tool|staff|employees|operator|admin team|interní/i]
];

const CONTENT_RULES=[
  ['static',/landing|brochure|simple website|one-page|jednostrán/i],
  ['editorial',/blog|news|journal|magazine|article|publication|člán/i],
  ['catalog',/catalog|products|listings|directory|inventory|nabídky|katalog/i],
  ['media',/gallery|photo|video|portfolio|cinematic|galer|foto/i],
  ['events',/events|schedule|calendar|program|festival|workshop|akce|kalendář/i],
  ['profiles',/profiles|artists|team|providers|members|speakers|profily|umělci/i],
  ['documents',/documents|docs|knowledge base|manual|policy|dokument/i],
  ['realtime',/realtime|real-time|live status|live data|chat|stream|živě/i]
];

const INTERACTION_RULES=[
  ['browse',/browse|gallery|catalog|portfolio|explore|procházet/i],
  ['search',/search|find|lookup|vyhled|najít/i],
  ['filter',/filter|facets|categories|filtrovat/i],
  ['compare',/compare|comparison|porovnat/i],
  ['configure',/configur|customize|builder|konfigur/i],
  ['submit',/submit|form|application|report issue|podat|odeslat|hlásit/i],
  ['book',/book|reservation|appointment|rezerv/i],
  ['purchase',/purchase|checkout|payment|ticket|buy|koupit|plat/i],
  ['communicate',/message|chat|contact|community|komunik|zpráv/i],
  ['collaborate',/collabor|co-edit|shared workspace|spoluprac/i],
  ['manage',/dashboard|admin|manage|workspace|spravovat/i]
];

function scoreDomain(def,text){
  let score=0; const hits=[];
  for(const signal of def.signals){
    const s=signal.toLowerCase();
    if(text.includes(s)){score+=s.includes(' ')?22:14;hits.push(signal);}
  }
  if(def.trustBurden==='critical'&&/medical|health|finance|bank|insurance|legal|hospital|clinic/i.test(text)) score+=8;
  return {score,hits};
}

function extractNamedConcepts(brief){
  const quoted=[...String(brief).matchAll(/["“]([^"”]{2,64})["”]/g)].map(m=>m[1].trim());
  const named=[...String(brief).matchAll(/\b(?:called|named|for|brand|project|platform|web for|website for)\s+([A-ZÁ-Ž][\p{L}\p{N}&'’.-]*(?:\s+[A-ZÁ-Ž][\p{L}\p{N}&'’.-]*){0,3})/gu)].map(m=>m[1].trim());
  return uniq([...quoted,...named]).slice(0,5);
}

function inferTrust(text,domain,secondary=null){
  if(domain?.trustBurden==='critical'||secondary?.trustBurden==='critical') return 'critical';
  if(domain?.trustBurden==='high'||secondary?.trustBurden==='high') return 'high';
  if(/legal|money|payment|children|kids|medical|health|identity|government|city portal|citizens|public service|municipality|insurance|investment|security/i.test(text)) return 'high';
  if(/booking|reviews|marketplace|membership|donation|b2b|industrial|professional/i.test(text)) return 'medium';
  return 'normal';
}

function inferApplicationDepth(text,interactions){
  let depth=0;
  if(interactions.length>=2||/interactive|filter|search/i.test(text)) depth=1;
  if(/payment|checkout|booking|reservation|submit|ticket|transaction|configur/i.test(text)) depth=Math.max(depth,2);
  if(/auth|login|account|dashboard|portal|workspace|marketplace|messaging/i.test(text)) depth=Math.max(depth,3);
  if(/realtime|real-time|collaboration|multi-tenant|complex platform|operations platform/i.test(text)) depth=4;
  return depth;
}

function inferDataDepth(text,content){
  let depth=0;
  if(content.some(x=>x!=='static')||/cms|frequent updates|content management/i.test(text)) depth=1;
  if(/database|account|booking|orders|marketplace|application|profiles|inventory/i.test(text)) depth=2;
  if(/realtime|real-time|live status|chat|collaboration/i.test(text)) depth=3;
  if(/multiple systems|integrations|erp|crm|multi-source|external api/i.test(text)) depth=4;
  return depth;
}

function inferVisualMode(text){
  if(/experimental|interactive story|digital exhibition|immersive exhibition|virtual exhibition|web experience|web ritual|constellation|spatial story|evolving experience|timed unlock/i.test(text)) return 'experiential';
  if(/cinematic|immersive|night|club|festival|fashion|dramatic/i.test(text)) return 'cinematic';
  if(/editorial|magazine|journal|culture|architecture|art/i.test(text)) return 'editorial';
  if(/dashboard|admin|internal|data dense|operations/i.test(text)) return 'data-dense';
  if(/marketplace|shop|store|catalog|commerce/i.test(text)) return 'commerce';
  if(/saas|product|app|software/i.test(text)) return 'application';
  if(/minimal|clean|luxury/i.test(text)) return 'minimal';
  return 'marketing';
}

export function analyzeDomain(brief){
  const original=String(brief||'').trim();
  if(!original) throw new Error('Brief is required');
  const text=original.toLowerCase();
  const ranked=ontology.map(def=>({...def,...scoreDomain(def,text)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  const first=ranked[0]||null, second=ranked[1]||null;
  const isHybrid=!!(first&&second&&second.score>=Math.max(14,first.score*0.55));
  const isNovel=!first || first.score<14;
  const primary=first||ontology.find(x=>x.id==='generic-organization');
  const purposes=uniq([...PURPOSE_RULES.filter(([,rx])=>has(text,rx)).map(([id])=>id),...(primary?.purposes||[]),...(isHybrid&&second?.purposes?second.purposes:[])]);
  const audiences=uniq(AUDIENCE_RULES.filter(([,rx])=>has(text,rx)).map(([id])=>id));
  const content=uniq(CONTENT_RULES.filter(([,rx])=>has(text,rx)).map(([id])=>id));
  const interactions=uniq(INTERACTION_RULES.filter(([,rx])=>has(text,rx)).map(([id])=>id));
  if(!content.length) content.push(/update|frequent|manage content/i.test(text)?'editorial':'static');
  if(!interactions.length) interactions.push('browse');
  if(!audiences.length) audiences.push(isNovel?'consumer':primary?.baseArchetype==='company'?'enterprise':'consumer');
  const trustBurden=inferTrust(text,primary,isHybrid?second:null);
  const genome={
    schema:'webforge.website-genome.v1',
    purpose:purposes.length?purposes:['inform','convert'],
    audience:audiences,
    content,
    interaction:interactions,
    visualMode:inferVisualMode(text),
    applicationDepth:inferApplicationDepth(text,interactions),
    dataDepth:inferDataDepth(text,content),
    trustBurden,
    mediaIntensity:clamp(20+(content.includes('media')?45:0)+(/cinematic|gallery|video|photo|portfolio|visual/i.test(text)?30:0)+(inferVisualMode(text)==='experiential'?30:0)),
    conversionIntensity:clamp(20+(['sell','transact','book','register','fund','activate'].some(x=>purposes.includes(x))?55:0)+(/strong conversion|cta|lead/i.test(text)?20:0)),
    novelty:clamp(30+(isNovel?45:0)+(isHybrid?15:0)+(/experimental|unusual|unique|novel|something new|něco úplně|divn/i.test(text)?25:0)),
    locality:/\b(in|near|v|praha|prague|brno|local|lokal|city|municipality|město)\b/i.test(text)?'local-or-place-bound':'not-required'
  };
  const baseEntities=isNovel&&primary?.id==='generic-organization'?['Concept','Participant','Experience','State']:(primary?.entities||[]);
  const lexicalEntities=[];
  if(/future self/i.test(text)) lexicalEntities.push('FutureSelf');
  if(/promise/i.test(text)) lexicalEntities.push('Promise');
  if(/constellation/i.test(text)) lexicalEntities.push('Constellation');
  if(/tree|strom/i.test(text)) lexicalEntities.push('Tree');
  if(/digital twin/i.test(text)) lexicalEntities.push('DigitalTwin');
  const entities=uniq([
    ...baseEntities,
    ...lexicalEntities,
    ...(isHybrid&&second?.entities?second.entities:[]),
    ...(purposes.includes('transact')?['Transaction']:[]),
    ...(purposes.includes('book')?['Booking']:[]),
    ...(interactions.includes('search')?['SearchQuery']:[])
  ]).slice(0,14);
  const confidence=isNovel?0.28:clamp((primary.score+(second?.score||0)*0.15)/70,0.35,0.98);
  return {
    schema:'webforge.domain-intelligence.v1',
    primary:{id:primary.id,label:primary.label,baseArchetype:primary.baseArchetype,score:primary.score||0,hits:primary.hits||[]},
    secondary:isHybrid&&second?{id:second.id,label:second.label,baseArchetype:second.baseArchetype,score:second.score,hits:second.hits}:null,
    classification:isNovel?'NOVEL':isHybrid?'HYBRID':'KNOWN',
    confidence:Number(confidence.toFixed(2)),
    namedConcepts:extractNamedConcepts(original),
    entities,
    genome,
    alternatives:ranked.slice(1,5).map(x=>({id:x.id,label:x.label,score:x.score,hits:x.hits})),
    evidence:{method:'deterministic ontology + capability decomposition',unknownDoesNotEqualPass:true}
  };
}

export function domainOntology(){ return structuredClone(ontology); }
