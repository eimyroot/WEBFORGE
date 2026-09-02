import { analyzeDomain } from './domain-intelligence.mjs';
import { modelProduct } from './product-intelligence.mjs';
import { designExperience } from './experience-intelligence.mjs';


function reconcileGenome(domain,product){
  const g=domain.genome,c=new Set(product.capabilityIds),uniq=xs=>[...new Set(xs)];
  if(c.has('identity.auth')||c.has('identity.account')||c.has('dashboard.user')) g.applicationDepth=Math.max(g.applicationDepth,3);
  if(c.has('product.configuration')||c.has('workflow.submission')||c.has('commerce.checkout')||c.has('conversion.booking')) g.applicationDepth=Math.max(g.applicationDepth,2);
  if(c.has('data.application')) g.dataDepth=Math.max(g.dataDepth,2);
  if(c.has('data.realtime')) g.dataDepth=Math.max(g.dataDepth,3);
  const derived=[];
  if(c.has('workflow.submission')) derived.push('submit');
  if(c.has('product.configuration')) derived.push('configure');
  if(c.has('commerce.checkout')) derived.push('purchase');
  if(c.has('conversion.booking')) derived.push('book');
  if(c.has('discovery.search')) derived.push('search');
  if(c.has('discovery.filter')) derived.push('filter');
  if(c.has('communication.messaging')) derived.push('communicate');
  if(c.has('dashboard.user')||c.has('dashboard.admin')) derived.push('manage');
  g.interaction=uniq([...g.interaction,...derived]);
  if(c.has('content.cms')) g.content=uniq(g.content.filter(x=>x!=='static').concat('structured'));
  return domain;
}

function baseFlags(brief,domain,product){
  const text=String(brief).toLowerCase(), caps=new Set(product.capabilityIds), g=domain.genome;
  return {
    booking:caps.has('conversion.booking'),
    tickets:caps.has('conversion.tickets'),
    auth:caps.has('identity.auth'),
    commerce:caps.has('commerce.checkout')||caps.has('commerce.marketplace')||caps.has('commerce.donation'),
    frequent:caps.has('content.cms'),
    gallery:caps.has('media.gallery'),
    cinematic:g.visualMode==='cinematic'||g.visualMode==='experiential',
    mobile:/mobile|mobil/i.test(text)||true,
    search:caps.has('discovery.search'),
    realtime:caps.has('data.realtime'),
    configuration:caps.has('product.configuration'),
    community:caps.has('community.members')
  };
}

function primaryGoal(domain,product){
  const caps=new Set(product.capabilityIds), p=domain.genome.purpose;
  if(caps.has('conversion.booking')) return 'booking';
  if(caps.has('conversion.tickets')) return 'tickets';
  if(caps.has('commerce.checkout')||p.includes('transact')||p.includes('sell')) return 'transaction';
  if(caps.has('workflow.submission')) return 'submission';
  if(caps.has('identity.auth')||p.includes('activate')) return 'activation';
  if(p.includes('fund')) return 'funding';
  return 'conversion';
}

export function compileUniversalBrief(brief){
  const text=String(brief||'').trim(); if(!text) throw new Error('Brief is required');
  const domain=analyzeDomain(text);
  const product=modelProduct(domain,text);
  reconcileGenome(domain,product);
  const experience=designExperience(domain,product,text);
  const flags=baseFlags(text,domain,product);
  const priorities=[domain.genome.visualMode==='cinematic'&&'visual-impact',domain.genome.mediaIntensity>60&&'media',domain.genome.applicationDepth>=3&&'application-depth',domain.genome.trustBurden!=='normal'&&'trust',domain.classification!=='KNOWN'&&'novel-domain'].filter(Boolean);
  return {
    brief:text,
    archetype:domain.primary.baseArchetype,
    domainArchetype:domain.primary.id,
    primary_goal:primaryGoal(domain,product),
    flags,
    priorities:[...new Set(priorities)],
    domain,product,experience,
    universal:{schema:'webforge.universal-project.v1',classification:domain.classification,genome:domain.genome,productModel:product,experienceModel:experience}
  };
}
