import crypto from 'node:crypto';
import {validateDesignDirectionPlan} from './design-direction-contract.mjs';
import {directDesign} from './director.mjs';
import {composeVisualSystem} from './visual-composition.mjs';
import {evaluatePolicy} from './policy.mjs';

export const DESIGN_DIRECTION_SELECTION_SCHEMA='webforge.design-direction-selection.v1';
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ROLE_SECTION_HINTS={
  offer:['services','featured','categories','product-proof','task-preview','feature-grid','problem-solution','outcomes'],
  proof:['proof','security','trust-strip','testimonials','product-proof','outcomes','case-study'],
  process:['process','workflow','how-it-works','schedule'],gallery:['gallery','selected-work','latest-content','experience'],
  faq:['faq'],pricing:['pricing','booking','availability'],integrations:['integrations','supply-demand'],
  contact:['location','contact','final-cta']
};
const SPACE={airy:'spacious',balanced:'balanced',dense:'compact'};
const TYPE={editorial:'editorial',split:'product',grid:'authority',showcase:'editorial'};
const SHAPE={soft:'soft-variable',sharp:'structured-geometric',pill:'soft-pill'};
const PALETTES={
  warm:{mode:'light',temperature:'warm',background:'#f7f3ef',surface:'#fffaf5',surface2:'#eadfd5',text:'#1d1915',muted:'#655e58',accent:'#a14d2f',accent2:'#7c5a45',line:'#d9cec2'},
  cool:{mode:'light',temperature:'cool',background:'#edf4f8',surface:'#f9fcfe',surface2:'#dbe8ef',text:'#10212c',muted:'#536672',accent:'#176d8c',accent2:'#3f5fb3',line:'#bfd0da'},
  neutral:{mode:'light',temperature:'neutral',background:'#f3f3f0',surface:'#ffffff',surface2:'#e4e5e1',text:'#1b1d1a',muted:'#5f665f',accent:'#53635a',accent2:'#777f75',line:'#d0d4ce'},
  contrast:{mode:'light',temperature:'contrast',background:'#f6f5ef',surface:'#ffffff',surface2:'#ffe4db',text:'#10100f',muted:'#5a5a54',accent:'#c73d22',accent2:'#171717',line:'#d8d6cc'}
};function luminance(hex){
  const rgb=String(hex).replace('#','').match(/.{2}/g).map(x=>parseInt(x,16)/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function contrast(a,b){const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05);}
function paletteStrategy(id,current={}){
  const base=PALETTES[id]||PALETTES.neutral,white='#ffffff',black='#111111';
  const whiteRatio=contrast(base.accent,white),blackRatio=contrast(base.accent,black),accentText=whiteRatio>=blackRatio?white:black;
  return {...current,mode:base.mode,temperature:base.temperature,tokens:{background:base.background,surface:base.surface,surface2:base.surface2,text:base.text,muted:base.muted,accent:base.accent,accent2:base.accent2,accentText,line:base.line},accessibility:{accentTextContrast:Number(Math.max(whiteRatio,blackRatio).toFixed(2)),strategy:'best-contrast-text'}};
}
function directionRoles(plan){return ['section_1','section_2','section_3','section_4'].map(key=>plan[key]);}
function resolveDirectionSections(layoutSections,directionPlan){
  const existing=new Set(layoutSections),used=new Set(),resolved=[];
  for(const role of directionRoles(directionPlan)){
    const section=(ROLE_SECTION_HINTS[role]||[]).find(id=>existing.has(id)&&!used.has(id));
    if(!section){const err=new Error(`Selected design direction role is unsupported by this site: ${role}`);err.code='DIRECTION_ROLE_UNSUPPORTED';err.role=role;throw err;}
    used.add(section);resolved.push({role,section});
  }
  return resolved;
}
function reorderLayout(layout,directionPlan){
  const before=[...(layout.sections||[])],resolved=resolveDirectionSections(before,directionPlan);
  const hero=before.includes('hero')?['hero']:[],final=before.includes('final-cta')?['final-cta']:[];
  const selected=resolved.map(x=>x.section).filter(x=>x!=='hero'&&x!=='final-cta');
  const remainder=before.filter(x=>x!=='hero'&&x!=='final-cta'&&!selected.includes(x));
  const sections=[...hero,...selected,...remainder,...final];
  const oldPlan=new Map((layout.sectionPlan||[]).map(x=>[x.id,x]));
  layout.sections=sections;
  layout.sectionPlan=sections.map((id,slot)=>({...oldPlan.get(id),id,slot}));
  if(Array.isArray(layout.roles))layout.roles=[...layout.roles].sort((a,b)=>sections.indexOf(a.id)-sections.indexOf(b.id));
  layout.baseFingerprint=layout.baseFingerprint||layout.fingerprint;
  layout.fingerprint=layout.sectionPlan.map((x,i)=>`${i}:${x.id}:${x.variant||layout.variants?.[x.id]||'default'}`).join('|');
  return resolved;
}function applyDesignTokens(plan,directionPlan){
  const appDepth=plan.domain?.genome?.applicationDepth||0;
  const mode=directionPlan.archetype==='editorial'?'editorial':directionPlan.archetype==='showcase'?'experiential':appDepth>=2?'application':'marketing';
  const grid=directionPlan.archetype==='editorial'?'asymmetric-editorial':directionPlan.archetype==='showcase'?'spatial-story-grid':appDepth>=2?'12-column-application':'12-column-marketing';
  const mediaHero=directionPlan.hero==='media-led'?(mode==='experiential'?'immersive-media':'contextual-media'):directionPlan.hero==='split'?'product-stage':'contextual-media';
  plan.layout.density=directionPlan.density;plan.layout.rhythm=`direction:${directionPlan.rhythm}`;
  plan.layout.design={...(plan.layout.design||{}),space:SPACE[directionPlan.density],type:TYPE[directionPlan.archetype],surface:directionPlan.palette,motion:directionPlan.rhythm==='mosaic'?'expressive':directionPlan.rhythm==='rail'?'functional':'subtle',container:directionPlan.nav==='prominent'?'wide':'medium',sectionGap:directionPlan.density==='airy'?'xl':directionPlan.density==='dense'?'sm':'md'};
  plan.designDNA={...(plan.designDNA||{}),mode,density:directionPlan.density,grid,shapeLanguage:SHAPE[directionPlan.shape],motion:directionPlan.rhythm==='mosaic'?'expressive':directionPlan.rhythm==='rail'?'functional':'subtle',media:{...(plan.designDNA?.media||{}),hero:mediaHero},rationale:[...(plan.designDNA?.rationale||[]),`selected-direction:${directionPlan.archetype}/${directionPlan.hero}/${directionPlan.rhythm}`]};
  plan.designStrategy={...(plan.designStrategy||{}),color_strategy:paletteStrategy(directionPlan.palette,plan.designStrategy?.color_strategy),layout_strategy:{...(plan.designStrategy?.layout_strategy||{}),sectionRhythm:`selected:${directionPlan.rhythm}`,ctaPlacement:directionPlan.cta==='transact'?'conversion':directionPlan.cta==='contact'?'conversation':'exploration'}};
  if(plan.project)plan.project.designStrategy=plan.designStrategy;
  const composition={...(plan.creative?.compositionIntent||{}),rhythm:directionPlan.rhythm,symmetry:['split','grid'].includes(directionPlan.archetype)?'structured':'asymmetric',mediaDominance:directionPlan.hero==='media-led'?'high':directionPlan.hero==='split'?'balanced':'low'};
  if(plan.creative)plan.creative.compositionIntent=composition;
  if(plan.designDNA?.creative)plan.designDNA.creative={...plan.designDNA.creative,compositionIntent:composition};
}

export function applyDesignDirectionToPlan(inputPlan,directionPlan,{directionId='selected',source='human-selection'}={}){
  const checked=validateDesignDirectionPlan(directionPlan);if(checked.status!=='PASS'){const err=new Error(`Invalid selected design direction: ${checked.reason}`);err.code='DIRECTION_INVALID';err.validation=checked;throw err;}
  if(!inputPlan?.layout?.sections||!inputPlan?.project)throw new Error('WEBFORGE plan required');
  const plan=structuredClone(inputPlan),before={layoutFingerprint:plan.layout.fingerprint,visualVersion:plan.visual?.version||null,designMode:plan.designDNA?.mode||null};
  const resolvedSections=reorderLayout(plan.layout,checked.plan);applyDesignTokens(plan,checked.plan);
  plan.layout.directionOverlay={schema:DESIGN_DIRECTION_SELECTION_SCHEMA,id:directionId,source,plan:checked.plan,resolvedSections};
  plan.layout.direction=directDesign(plan.project,plan.layout);
  plan.visual=composeVisualSystem(plan);
  plan.policy=evaluatePolicy(plan);plan.releaseEligible=plan.policy.status==='PASS';
  plan.productionEligible=plan.policy.status==='PASS'&&plan.project.product.unresolved.length===0&&plan.visual.connectors.productionGate==='PASS'&&plan.visual.content.source.status==='PASS'&&plan.visual.media.productionGate==='PASS'&&!plan.visual.templates.productionReviewRequired;
  plan.designDirectionSelection={schema:DESIGN_DIRECTION_SELECTION_SCHEMA,id:directionId,source,plan:checked.plan,plan_sha256:sha(checked.plan),resolvedSections,before,after:{layoutFingerprint:plan.layout.fingerprint,visualVersion:plan.visual.version,designMode:plan.designDNA.mode},authority:{build:'BOUNDED_SELECTED_DIRECTION',release:'NONE',production:'NONE'}};
  plan.evidence=[...(plan.evidence||[]),{check:'selected-design-direction',status:'PASS',detail:{id:directionId,source,planSha256:plan.designDirectionSelection.plan_sha256,resolvedSections}}];
  return plan;
}