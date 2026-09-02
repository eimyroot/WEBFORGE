import { registry } from './composition-registry.mjs';
import { synthesizeProjectLocalTemplate } from './component-synthesizer.mjs';
import { rendererCoverage } from './renderer-coverage.mjs';

const templates=registry('sectionTemplates');
const contracts=registry('rendererContracts');
const contractById=new Map(contracts.map(x=>[x.id,x]));

function desired(plan,sectionId){
  const s=plan.layout.signals||{};
  if(sectionId==='hero'&&plan.project.flags.cinematic)return 'immersive';
  if(['next-event','final-cta','pricing','booking'].includes(sectionId)&&(s.urgency>55||plan.project.flags.tickets||plan.project.flags.booking))return 'conversion';
  if(['gallery','artists','selected-work','testimonials'].includes(sectionId)&&s.media>60)return 'mosaic';
  if(['latest-content','statement','case-study','about'].includes(sectionId)&&s.content>65)return 'editorial';
  if(['feature-grid','services','integrations','comparison','categories'].includes(sectionId)&&s.interaction>65)return 'bento';
  if(['proof','outcomes','security','trust-strip'].includes(sectionId))return 'split';
  if(['process','schedule','workflow','search-results'].includes(sectionId))return 'rail';
  return plan.designDNA?.mode==='experiential'?'immersive':'split';
}

function backed(t){const c=contractById.get(t.rendererKey);return Boolean(c&&c.supportedModes?.includes(t.layoutMode));}
function score(t,plan,sectionId){
  let score=t.qualityScore;const reasons=[`quality ${t.qualityScore}`];
  if(t.bestFor.includes(plan.project.archetype)){score+=18;reasons.push('archetype +18')}
  if(t.layoutMode===desired(plan,sectionId)){score+=14;reasons.push(`mode:${desired(plan,sectionId)} +14`)}
  if(t.maturity==='verified'){score+=4;reasons.push('verified +4')}
  if(t.trust==='approved'){score+=4;reasons.push('approved +4')}
  if(backed(t)){score+=8;reasons.push('renderer-contract +8')}else{score-=100;reasons.push('renderer-missing -100')}
  return {score,reasons};
}

export function resolveSectionTemplates(plan){
  const projectLocalComponents=[];
  const sections=plan.layout.sections.map((id,index)=>{
    const ranked=templates.filter(t=>t.sectionId===id&&t.bestFor.includes(plan.project.archetype)).map(t=>({...t,...score(t,plan,id)})).filter(backed).sort((a,b)=>b.score-a.score);
    const fallback=templates.filter(t=>t.sectionId===id).map(t=>({...t,...score(t,plan,id)})).filter(backed).sort((a,b)=>b.score-a.score);
    let best=ranked[0]||fallback[0];
    if(!best){best=synthesizeProjectLocalTemplate(plan,id,index);projectLocalComponents.push(best)}
    return {id,index,template:best.id,rendererKey:best.rendererKey,layoutMode:best.layoutMode,density:best.density,motion:best.motion,qualityScore:best.qualityScore,maturity:best.maturity,trust:best.trust,selectionScore:best.score??best.qualityScore,selectionReason:best.reasons??best.rationale,availableCount:(ranked.length||fallback.length),responsive:index<2?'priority':'normal',source:best.source||'registry',productionGate:best.productionGate||'REGISTRY_APPROVED'};
  });
  return {version:'webforge.section-templates.r2',sections,catalogCount:templates.length,qualityFloor:Math.min(...sections.map(x=>x.qualityScore)),rendererCoverage:rendererCoverage(),projectLocalComponents,productionReviewRequired:projectLocalComponents.length>0};
}

export function sectionTemplateCatalog(){return structuredClone(templates);}
