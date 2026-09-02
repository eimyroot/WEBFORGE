
import { resolveTemplateSchema, templateCatalog } from './template-schema.mjs';

const ROLE = {
  hero:'OPEN',
  statement:'POSITION',
  'problem-solution':'POSITION',
  services:'VALUE',
  'feature-grid':'VALUE',
  categories:'DISCOVER',
  'selected-work':'DISCOVER',
  featured:'DISCOVER',
  artists:'DISCOVER',
  'next-event':'ACTION',
  availability:'ACTION',
  pricing:'ACTION',
  'product-proof':'PROOF',
  proof:'PROOF',
  outcomes:'PROOF',
  'trust-strip':'PROOF',
  'trust-safety':'TRUST',
  security:'TRUST',
  'case-study':'PROOF',
  gallery:'MEDIA',
  experience:'MEDIA',
  'task-preview':'PRODUCT',
  process:'PROCESS',
  workflow:'PROCESS',
  'how-it-works':'PROCESS',
  schedule:'PROCESS',
  integrations:'ECOSYSTEM',
  team:'PEOPLE',
  about:'PEOPLE',
  location:'ORIENT',
  faq:'OBJECTION',
  'latest-content':'FRESHNESS',
  newsletter:'FRESHNESS',
  'supply-demand':'VALUE',
  'logo-cloud':'PROOF',
  'final-cta':'CONVERT'
};

const COMPAT = {
  OPEN:['POSITION','VALUE','DISCOVER','ACTION','PROOF','PRODUCT','MEDIA'],
  POSITION:['VALUE','PROOF','DISCOVER','PRODUCT','PROCESS'],
  VALUE:['PROOF','PROCESS','DISCOVER','MEDIA','ECOSYSTEM','ACTION'],
  DISCOVER:['MEDIA','PROOF','PROCESS','TRUST','ACTION','FRESHNESS'],
  ACTION:['PROOF','TRUST','OBJECTION','ORIENT','CONVERT'],
  PROOF:['VALUE','PROCESS','TRUST','PEOPLE','ACTION','OBJECTION','CONVERT','FRESHNESS'],
  PRODUCT:['VALUE','PROOF','PROCESS','ECOSYSTEM','TRUST','ACTION'],
  MEDIA:['DISCOVER','PROOF','POSITION','PEOPLE','ACTION'],
  PROCESS:['PROOF','TRUST','ECOSYSTEM','ACTION','OBJECTION'],
  ECOSYSTEM:['TRUST','PROOF','ACTION','OBJECTION'],
  TRUST:['PROOF','PROCESS','OBJECTION','ACTION','CONVERT'],
  PEOPLE:['PROOF','FRESHNESS','ACTION','CONVERT'],
  ORIENT:['OBJECTION','ACTION','CONVERT'],
  OBJECTION:['ACTION','CONVERT'],
  FRESHNESS:['PROOF','PEOPLE','ACTION','CONVERT'],
  CONVERT:[]
};

const archetypeCore = {
  venue:['next-event','artists','experience'],
  'local-service':['services','proof','process'],
  portfolio:['selected-work','case-study','about'],
  company:['services','outcomes','proof'],
  saas:['product-proof','feature-grid','pricing'],
  marketplace:['categories','featured','trust-safety'],
  'web-app':['task-preview','workflow','security'],
  editorial:['latest-content','featured','categories']
};

const fallbackVariants = {
  statement:'quote','problem-solution':'split',services:'cards','feature-grid':'feature-bento',
  categories:'category-grid','selected-work':'project-led',featured:'listing-rail',artists:'rail',
  'next-event':'spotlight',availability:'spotlight',pricing:'pricing-grid','product-proof':'product-stage',
  proof:'case-proof',outcomes:'metrics','trust-strip':'stats','trust-safety':'trust-panel',security:'trust-panel',
  'case-study':'case-editorial',gallery:'masonry',experience:'split','task-preview':'app-stage',
  process:'timeline',workflow:'timeline','how-it-works':'timeline',schedule:'timeline',
  integrations:'integration-grid',team:'people-grid',about:'split',location:'map-split',
  faq:'accordion-list','latest-content':'content-grid',newsletter:'conversion',
  'supply-demand':'dual-column','logo-cloud':'logo-rail','final-cta':'conversion'
};

function uniq(xs){ return [...new Set(xs.filter(Boolean))]; }
function pickParentVariant(parents, id){ for(const p of parents){ if(p.variants?.[id]) return p.variants[id]; } return fallbackVariants[id]||'content-grid'; }
function role(id){ return ROLE[id]||'VALUE'; }

function compatibleSequence(sections){
  let penalties=0, breaks=[];
  for(let i=0;i<sections.length-1;i++){
    const a=role(sections[i]), b=role(sections[i+1]);
    if(a==='CONVERT') { penalties+=25; breaks.push(`${a}->${b}`); continue; }
    if(!(COMPAT[a]||[]).includes(b) && a!==b){ penalties+=7; breaks.push(`${a}->${b}`); }
  }
  return {penalties,breaks};
}

function capabilityAllowed(id, capabilities){
  if(id==='gallery' && !capabilities.includes('media.gallery')) return false;
  if(id==='location' && !capabilities.includes('seo.local')) return false;
  if(id==='latest-content' && !capabilities.includes('content.cms')) return false;
  if(id==='availability' && !capabilities.includes('conversion.booking')) return false;
  return true;
}

function candidateScore(candidate, seed, signals, catalogFingerprints){
  let score=100;
  const sections=candidate.sections;
  const roles=sections.map(role);
  const seq=compatibleSequence(sections);
  score-=seq.penalties;
  if(sections[0]!=='hero') score-=100;
  if(sections.at(-1)!=='final-cta') score-=100;
  if(new Set(sections).size!==sections.length) score-=100;
  const core=archetypeCore[seed.a?.[0]||seed.archetype]||[];
  score += core.filter(x=>sections.includes(x)).length*8;
  if(signals.trust>=70 && !roles.some(x=>['PROOF','TRUST'].includes(x))) score-=22;
  if(signals.media>=70 && !roles.includes('MEDIA')) score-=16;
  if(signals.content>=75 && !roles.includes('FRESHNESS')) score-=12;
  if(signals.interaction>=75 && !roles.some(x=>['PRODUCT','PROCESS','ECOSYSTEM','ACTION'].includes(x))) score-=16;
  if(signals.urgency>=70 && sections.indexOf('final-cta')>7) score-=6;
  if(seed.project?.flags?.tickets){const ni=sections.indexOf('next-event'); if(ni===1)score+=20; else if(ni>1&&ni<=3)score+=8; else score-=12;}
  if(seed.project?.flags?.booking){const ai=sections.indexOf('availability'); if(ai===1)score+=18; else if(ai>1&&ai<=3)score+=7;}
  if(signals.content>=70){const fi=sections.indexOf('latest-content'); if(fi>0&&fi<sections.length-2)score+=5;}
  if(signals.media>=80&&sections.includes('gallery'))score+=6;
  const idealLen = signals.content>80?9:signals.media>80?8:7;
  score -= Math.abs(sections.length-idealLen)*2;
  const fp=sections.map((x,i)=>`${i}:${x}:${candidate.variants[x]||candidate.hero}`).join('|');
  const isNovel=!catalogFingerprints.has(fp);
  if(isNovel) score+=9;
  else score-=3;
  if(candidate.origin==='synthesized') score+=4;
  return {score,sequence:seq,isNovel,fingerprint:fp};
}

function makeCandidate(id, origin, parents, sections, seed, capabilities){
  const filtered=uniq(sections).filter((x,i)=>x==='hero'||x==='final-cta'||capabilityAllowed(x,capabilities));
  const normalized=['hero',...filtered.filter(x=>x!=='hero'&&x!=='final-cta'),'final-cta'];
  const variants={};
  for(const section of normalized) if(section!=='hero') variants[section]=pickParentVariant(parents,section);
  return {
    id,origin,parents:parents.map(x=>x.id),family:seed.family,hero:parents[0]?.hero||seed.hero,
    cta:seed.cta,density:seed.density,rhythm:seed.rhythm,sections:normalized,variants
  };
}

function synthesizeCandidates(seed, parents, capabilities){
  const s=seed.signals, core=archetypeCore[seed.a?.[0]||parents[0]?.a?.[0]]||[];
  const pool=uniq(parents.flatMap(p=>p.sections).filter(x=>!['hero','final-cta'].includes(x)));
  const byRole=(r)=>pool.filter(x=>role(x)===r);
  const first=(r)=>byRole(r)[0];

  const evidence = first('PROOF')||first('TRUST');
  const value = first('VALUE')||core[0];
  const discover = first('DISCOVER')||core[1];
  const product = first('PRODUCT');
  const process = first('PROCESS');
  const media = first('MEDIA');
  const media2 = byRole('MEDIA').find(x=>x!==media);
  const ecosystem = first('ECOSYSTEM');
  const objection = first('OBJECTION');
  const orient = first('ORIENT');
  const fresh = first('FRESHNESS');
  const people = first('PEOPLE');
  const action = first('ACTION');

  return [
    makeCandidate('synth-balanced','synthesized',parents,
      ['hero', s.trust>65?evidence:null, value||discover||product, product||discover, process, s.media>60?media:null, s.media>85?media2:null, s.content>70?fresh:null, objection, 'final-cta'],seed,capabilities),
    makeCandidate('synth-conversion','synthesized',parents,
      ['hero', action||value, s.trust>45?evidence:null, value, process, objection, orient, 'final-cta'],seed,capabilities),
    makeCandidate('synth-narrative','synthesized',parents,
      ['hero', first('POSITION'), s.media>50?media:null, discover||value, evidence, people, fresh, 'final-cta'],seed,capabilities),
    makeCandidate('synth-product','synthesized',parents,
      ['hero', product||value, evidence, value, process, ecosystem, objection, 'final-cta'],seed,capabilities),
    makeCandidate('synth-discovery','synthesized',parents,
      ['hero', discover||value, s.media>55?media:null, value, evidence, process, fresh, orient, 'final-cta'],seed,capabilities)
  ];
}

function decorate(winner, seed, ranked, catalogFingerprints){
  const roles=winner.sections.map(id=>({id,role:role(id)}));
  const constraints=[
    {id:'hero-first',status:winner.sections[0]==='hero'?'PASS':'FAIL'},
    {id:'cta-last',status:winner.sections.at(-1)==='final-cta'?'PASS':'FAIL'},
    {id:'unique-section-ids',status:new Set(winner.sections).size===winner.sections.length?'PASS':'FAIL'},
    {id:'sequence-compatibility',status:winner.sequence.breaks.length===0?'PASS':'ADVISORY',detail:winner.sequence.breaks},
    {id:'novel-architecture',status:winner.isNovel?'PASS':'REFERENCE',detail:winner.isNovel?'fingerprint not present in schema catalog':'matches a reference grammar'}
  ];
  winner.schemaVersion='template-synthesis.v1';
  winner.signals=seed.signals;
  winner.score=Math.round(winner.score);
  winner.fingerprint=winner.fingerprint;
  winner.constraints=constraints;
  winner.roles=roles;
  winner.sectionPlan=winner.sections.map((id,index)=>({id,variant:id==='hero'?winner.hero:winner.variants[id],role:role(id),priority:index===0?'critical':index<3?'high':'normal',slot:index}));
  winner.selectionReason=[
    `synthesis-score ${winner.score}`,
    winner.isNovel?'novel fingerprint +9':'reference fingerprint',
    `parents ${winner.parents.join(' + ')}`,
    `trust ${seed.signals.trust}`,
    `media ${seed.signals.media}`,
    `content ${seed.signals.content}`,
    `interaction ${seed.signals.interaction}`
  ];
  winner.alternatives=ranked.filter(x=>x.id!==winner.id).slice(0,5).map(x=>({id:x.id,score:Math.round(x.score),origin:x.origin,parents:x.parents,fingerprint:x.fingerprint}));
  winner.candidateCount=ranked.length;
  winner.totalSchemaCount=templateCatalog().length;
  winner.catalogMatch=catalogFingerprints.has(winner.fingerprint);
  winner.design={
    ...seed.design,
    space:winner.sections.length>=9?'balanced':seed.design?.space||'balanced',
    motion:seed.signals.novelty>70?'expressive':seed.design?.motion||'minimal'
  };
  winner.nav=seed.nav;
  winner.directionSource='synthesized-page-grammar';
  return winner;
}

export function synthesizeLayout(project, capabilities=[]){
  const seed=resolveTemplateSchema(project,capabilities);
  const catalog=templateCatalog();
  const parents=[
    seed,
    ...seed.alternatives.slice(0,3).map(a=>catalog.find(x=>x.id===a.id)).filter(Boolean)
  ];
  const catForArchetype=catalog.filter(x=>x.a.includes(project.archetype));
  const catalogFingerprints=new Set(catForArchetype.map(p=>{
    const sections=p.sections.filter(x=>capabilityAllowed(x,capabilities));
    return sections.map((x,i)=>`${i}:${x}:${p.variants?.[x]||p.hero}`).join('|');
  }));
  const candidates=[
    {
      id:`reference:${seed.id}`,origin:'reference',parents:[seed.id],family:seed.family,hero:seed.hero,cta:seed.cta,
      density:seed.density,rhythm:seed.rhythm,sections:[...seed.sections],variants:{...seed.variants}
    },
    ...synthesizeCandidates({...seed,a:[project.archetype]},parents,capabilities)
  ].map(c=>{
    const evaluated=candidateScore(c,{...seed,a:[project.archetype],project},seed.signals,catalogFingerprints);
    return {...c,...evaluated};
  }).sort((a,b)=>b.score-a.score);

  const winner=structuredClone(candidates[0]);
  return decorate(winner,seed,candidates,catalogFingerprints);
}
