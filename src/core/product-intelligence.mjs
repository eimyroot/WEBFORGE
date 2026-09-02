import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const ontology=JSON.parse(fs.readFileSync(path.join(here,'../registries/capability-ontology.json'),'utf8'));
const byId=new Map(ontology.map(x=>[x.id,x]));
const uniq=xs=>[...new Set(xs.filter(Boolean))];

const RULES=[
  [/blog|news|journal|magazine|articles|editorial|publication|updates|člán/i,['content.cms','content.editorial']],
  [/docs|documentation|knowledge base|manual|help center|dokument/i,['content.cms','content.documentation']],
  [/multi-?lingual|multiple languages|vícejazy|multilingual/i,['content.multilingual']],
  [/gallery|photos|photography|portfolio|visual archive|galer|fotk/i,['media.gallery']],
  [/video|reel|film|stream/i,['media.video']],
  [/generate images|ai images|generated visuals|generované vizuály/i,['media.generated']],
  [/upload|user media|submit photo|nahrát/i,['media.upload']],
  [/search|find|lookup|vyhled|najít/i,['discovery.search']],
  [/filter|facets|categories|filtrovat/i,['discovery.filter','discovery.categories']],
  [/recommend|matching|best match|doporuč/i,['discovery.recommendation']],
  [/swipe|tinder for|tinder-like/i,['discovery.swipe']],
  [/profiles?|artists?|providers?|members?|speakers?|team pages|profily/i,['profile.public']],
  [/auth|login|sign in|account|user portal|přihlá/i,['identity.auth','identity.account']],
  [/roles|permissions|admin and user|buyer and seller|multi-role/i,['identity.roles']],
  [/catalog|products|inventory|listings|nabídky|katalog/i,['commerce.catalog']],
  [/checkout|payment|pay|purchase|buy|platba|koupit/i,['commerce.checkout']],
  [/subscription|recurring payment|předplat/i,['commerce.subscription']],
  [/donation|donate|contribution|\bdar\b|přispět/i,['commerce.donation']],
  [/marketplace|buyer|seller|vendor|payout|two-sided/i,['commerce.marketplace']],
  [/book|booking|reservation|appointment|rezerv/i,['conversion.booking','booking.availability']],
  [/ticket|vstupenk/i,['conversion.tickets','events.ticketing']],
  [/membership|member plan|členství/i,['conversion.membership']],
  [/lead|contact form|quote request|inquiry|poptáv/i,['conversion.lead','communication.form']],
  [/events?|calendar|program|schedule|workshop|akce|kalendář/i,['events.calendar']],
  [/register for event|event registration|enroll|přihlásit na/i,['events.registration']],
  [/capacity|limited seats|availability inventory/i,['booking.capacity']],
  [/map|location|nearby|directions|address|mapa|lokace|adresa/i,['geo.location','geo.map']],
  [/near me|nearby|distance|closest|okolí/i,['geo.nearby']],
  [/newsletter|mailing list|email updates/i,['communication.newsletter']],
  [/message|chat|direct message|zprávy/i,['communication.messaging']],
  [/community|members|forum|groups|komunit/i,['community.members']],
  [/comments|discussion|replies/i,['community.comments']],
  [/reviews|ratings|testimonials|recenz|hodnoc/i,['trust.reviews']],
  [/certif|accredit|license|compliance|certifik/i,['trust.certifications']],
  [/audit trail|evidence ledger|receipts|audit log/i,['trust.audit-trail']],
  [/submit|application|report issue|\breport\b|request workflow|podat|hlásit/i,['workflow.submission']],
  [/approval|moderation|review queue|schvál/i,['workflow.approval']],
  [/status tracking|track status|workflow state|stav žádosti/i,['workflow.status']],
  [/dashboard|user portal|my account|workspace/i,['dashboard.user']],
  [/admin|backoffice|operator console|control room/i,['dashboard.admin']],
  [/database|persistent data|records|inventory/i,['data.application']],
  [/realtime|real-time|live updates|live status/i,['data.realtime']],
  [/external api|rest api|graphql|erp|crm integration/i,['data.external-api']],
  [/analytics|traffic|website metrics/i,['analytics.site']],
  [/product analytics|funnels|activation|retention/i,['analytics.product']],
  [/local seo|google business|local discoverability/i,['seo.local']],
  [/seo|search engine|structured content/i,['seo.content','seo.structured-data']],
  [/chart|data visualization|graph|metrics dashboard|graf/i,['visual.data']],
  [/timeline|history|story timeline|timed unlock|evolving over time|časová osa/i,['visual.timeline']],
  [/network graph|relationship graph|knowledge graph|constellation/i,['visual.network']],
  [/promise|future self|personal ritual/i,['workflow.submission','workflow.status','identity.auth','identity.account','data.application']],
  [/configurator|configure product|product builder|konfigurátor/i,['product.configuration']],
  [/3d (?:product )?configurator|three-dimensional configurator|webgl product configurator|3d model/i,['product.configuration.3d']],
  [/real-time collaboration|realtime collaboration|co-edit simultaneously/i,['collaboration.realtime']],
  [/multiplayer|real-time game|realtime game/i,['game.realtime-multiplayer']],
  [/hardware control|device control|iot control/i,['device.hardware-control']]
];

function baseCapabilities(domain,brief){
  const caps=['presentation.marketing','seo.content','analytics.site','qa.core'];
  const g=domain.genome;
  if(g.visualMode==='cinematic'||g.visualMode==='experiential') caps.push('presentation.immersive','media.gallery');
  if(g.content.includes('editorial')) caps.push('content.cms','content.editorial');
  else if(g.content.includes('catalog')||g.content.includes('events')||g.content.includes('profiles')) caps.push('content.cms');
  else caps.push('content.static');
  if(g.locality==='local-or-place-bound') caps.push('seo.local','geo.location');
  if(g.applicationDepth>=3) caps.push('identity.auth','data.application','dashboard.user');
  if(g.dataDepth>=2) caps.push('data.application');
  if(g.dataDepth>=3) caps.push('data.realtime');
  if(g.purpose.includes('sell')) caps.push('commerce.catalog','commerce.checkout');
  if(g.purpose.includes('book')) caps.push('conversion.booking','booking.availability');
  if(g.purpose.includes('register')) caps.push('workflow.submission');
  if(g.purpose.includes('fund')) caps.push('commerce.donation');
  if(g.purpose.includes('connect')) caps.push('community.members');
  if(g.purpose.includes('configure')) caps.push('product.configuration');
  if(/ticket|vstupenk/i.test(brief)) caps.push('conversion.tickets','events.ticketing');
  return caps;
}

function inferUserJobs(domain,caps){
  const jobs=[];
  const add=(id,goal,needs)=>jobs.push({id,goal,needs});
  if(caps.includes('discovery.search')||caps.includes('commerce.catalog')) add('discover','Find the right option quickly',['searchable information','filters','clear detail']);
  if(caps.includes('conversion.booking')) add('book','Choose a suitable time and reserve it',['availability','confirmation','low-friction form']);
  if(caps.includes('commerce.checkout')||caps.includes('conversion.tickets')) add('purchase','Complete a transaction safely',['price','trust','checkout action','receipt']);
  if(caps.includes('workflow.submission')) add('submit','Send a structured request and understand what happens next',['form','validation','status']);
  if(caps.includes('identity.account')) add('return','Return to saved information or ongoing work',['identity','account state','history']);
  if(caps.includes('community.members')) add('participate','Connect with other participants',['profiles','membership','communication']);
  if(caps.includes('product.configuration')) add('configure','Turn requirements into a valid product configuration',['constraints','options','feedback']);
  if(caps.includes('content.editorial')) add('learn','Discover useful current content',['topics','articles','navigation']);
  if(!jobs.length) add('understand','Understand the offer and take the right next step',['clear proposition','proof','CTA']);
  return jobs;
}

function connectorNeeds(capabilities){
  const needs=[];
  const map=[
    ['content.cms','content.cms'],['media.upload','media.library'],['media.generated','media.generate'],
    ['identity.auth','identity.auth'],['data.application','database'],['data.realtime','database.realtime'],
    ['commerce.checkout','commerce.payment'],['commerce.donation','commerce.payment'],['conversion.tickets','tickets.purchase'],
    ['conversion.booking','booking'],['communication.newsletter','newsletter'],['communication.messaging','messaging'],
    ['geo.map','maps'],['analytics.site','analytics.simple'],['analytics.product','analytics.product'],['data.external-api','external.api']
  ];
  for(const [cap,need] of map) if(capabilities.includes(cap)) needs.push(need);
  return uniq(needs);
}

export function modelProduct(domain,brief){
  const text=String(brief||'');
  const inferred=[...baseCapabilities(domain,text)];
  for(const [rx,caps] of RULES) if(rx.test(text)) inferred.push(...caps);
  const capabilities=uniq(inferred);
  const records=capabilities.map(id=>{
    const def=byId.get(id)||{id,category:'unknown',support:'unresolved',core:null};
    return {...def,status:def.support==='unresolved'?'UNRESOLVED':def.support==='adapter'?'CONDITIONAL':'SUPPORTED'};
  });
  const unresolved=records.filter(x=>x.status==='UNRESOLVED');
  const conditional=records.filter(x=>x.status==='CONDITIONAL');
  const coreCapabilities=uniq(records.map(x=>x.core).filter(Boolean));
  return {
    schema:'webforge.product-intelligence.v1',
    entities:domain.entities.map((name,index)=>({name,role:index===0?'primary':'supporting'})),
    capabilities:records,
    capabilityIds:capabilities,
    coreCapabilities,
    connectorNeeds:connectorNeeds(capabilities),
    userJobs:inferUserJobs(domain,capabilities),
    unresolved:unresolved.map(x=>x.id),
    conditional:conditional.map(x=>x.id),
    productionReadiness:unresolved.length?'BLOCKED_UNRESOLVED_CAPABILITY':conditional.length?'CONDITIONAL_CONNECTORS':'READY_FOR_TECHNICAL_GATES',
    invariants:['unknown-capability-never-pass','provider-selection-does-not-authorize-installation','transactional-capability-requires-real-connector-evidence']
  };
}

export function capabilityOntology(){return structuredClone(ontology);}
