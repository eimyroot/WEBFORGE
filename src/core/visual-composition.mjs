import {resolveArtDirection} from './art-direction.mjs';
import {bindContent} from './content-binding.mjs';
import {resolveMedia} from './media-intelligence.mjs';
import {resolveSectionTemplates} from './section-templates.mjs';
import {resolveInteractions} from './interaction-resolver.mjs';
import {resolveConnectors} from './connector-resolver.mjs';
import {resolvePlugins} from './plugin-resolver.mjs';
import {resolveWorkflow} from './workflow-resolver.mjs';
import {resolveCompositionPatterns} from './pattern-resolver.mjs';
import {registry,registrySummary} from './composition-registry.mjs';

function legacyZones(archetype,sections){
 const ids=new Set(sections.map(x=>x.id)),used=new Set(),zones=[];
 const add=(id,kind,members)=>{const picked=members.filter(x=>ids.has(x)&&!used.has(x));if(!picked.length)return;for(const x of picked)used.add(x);zones.push({id,kind,members:picked});};
 if(archetype==='venue'){add('hero','single',['hero']);add('next','single',['next-event']);add('events','single',['latest-content']);add('culture','paired',['artists','gallery']);add('experience','single',['experience']);add('flow','compact',['schedule','proof']);add('utility','single',['faq','location']);add('final','single',['final-cta']);}
 else if(archetype==='local-service'){add('hero','single',['hero']);add('offer','paired',['services','proof']);add('work','paired',['gallery','process']);add('local','paired',['location','faq']);add('final','single',['final-cta']);}
 else if(['saas','web-app','marketplace'].includes(archetype)){add('hero','single',['hero']);add('product','paired',['product-proof','task-preview','feature-grid']);add('workflow','paired',['workflow','integrations']);add('trust','paired',['proof','security']);add('commercial','paired',['pricing','faq']);add('final','single',['final-cta']);}
 else if(archetype==='portfolio'){add('hero','single',['hero']);add('work','paired',['selected-work','gallery']);add('story','paired',['case-study','statement']);add('about','single',['about']);add('final','single',['final-cta']);}
 else {add('hero','single',['hero']);add('value','paired',['services','outcomes']);add('proof','paired',['proof','process']);add('people','paired',['team','faq']);add('final','single',['final-cta']);}
 for(const s of sections)if(!used.has(s.id)){used.add(s.id);zones.splice(Math.max(1,zones.length-1),0,{id:`extra-${s.id}`,kind:'single',members:[s.id]});}
 return zones;
}

function universalZones(plan,sections){
 const roleOf=id=>plan.layout.sectionPlan.find(x=>x.id===id)?.role||sections.find(x=>x.id===id)?.role||'VALUE';
 const zones=[],used=new Set();
 const add=(id,kind,members)=>{const picked=members.filter(x=>sections.some(s=>s.id===x)&&!used.has(x));if(!picked.length)return;for(const x of picked)used.add(x);zones.push({id,kind,members:picked,semanticRoles:picked.map(roleOf)});};
 add('opening','single',['hero']);
 add('discovery','paired',['categories','featured','next-event','artists','team']);
 add('product-value','paired',['problem-solution','services','feature-grid','product-proof','task-preview']);
 add('media-experience','paired',['domain-signature','experience','gallery','selected-work']);
 add('process-system','paired',['workflow','process','how-it-works','schedule','integrations']);
 add('proof-trust','paired',['outcomes','proof','testimonials','trust-strip','trust-safety','security','logo-cloud']);
 add('freshness-people','paired',['latest-content','newsletter','about','team']);
 add('commercial-action','paired',['comparison','booking','pricing','availability','location','faq']);
 for(const s of sections)if(!used.has(s.id)&&s.id!=='final-cta'){used.add(s.id);zones.push({id:`zone-${s.id}`,kind:'single',members:[s.id],semanticRoles:[roleOf(s.id)]});}
 add('final','single',['final-cta']);
 return zones;
}

function choosePrimitives(plan,templates){
 const primitives=registry('primitives');const ids=new Set(['primitive.container','primitive.stack','primitive.cluster','primitive.button-primary','primitive.button-secondary','primitive.eyebrow','primitive.display-hero','primitive.display-section','primitive.body-prose','primitive.media-overlay','primitive.media-vignette']);
 const g=plan.domain?.genome||{};
 if(plan.project.flags.gallery||g.mediaIntensity>=60){ids.add('primitive.asymmetric-grid');ids.add('primitive.media-lightbox-shell');ids.add('primitive.image-zoom');}
 if(plan.project.flags.cinematic||plan.designDNA?.mode==='experiential'){ids.add('primitive.full-bleed');ids.add('primitive.parallax-light');}
 if(g.applicationDepth>=3){ids.add('primitive.surface-glass');ids.add('primitive.grid-4');ids.add('primitive.tabs');ids.add('primitive.container-query');ids.add('primitive.subgrid');}
 if(plan.layout.sections.includes('search-results')) ids.add('primitive.scroll-snap');
 if(templates?.productionReviewRequired) ids.add('primitive.focus-ring');
 if(g.trustBurden==='critical'||g.trustBurden==='high') ids.add('primitive.surface-outline');
 return primitives.filter(x=>ids.has(x.id));
}

export function composeVisualSystem(plan){
 const artDirection=resolveArtDirection(plan),content=bindContent(plan),templates=resolveSectionTemplates(plan),media=resolveMedia(plan,content,artDirection);
 const mediaBySection=Object.groupBy?Object.groupBy(media.slots,x=>x.section):media.slots.reduce((a,x)=>((a[x.section]??=[]).push(x),a),{});
 const sections=templates.sections.map(s=>({...s,role:plan.layout.sectionPlan.find(x=>x.id===s.id)?.role||null,variant:plan.layout.sectionPlan.find(x=>x.id===s.id)?.variant||null,content:s.id==='final-cta'?content.model.final:(content.model[s.id]||null),media:mediaBySection[s.id]||[]}));
 const useUniversal=plan.project.domain?.classification!=='KNOWN'||plan.domain?.genome?.applicationDepth>=2;
 const zones=useUniversal?universalZones(plan,sections):legacyZones(plan.project.archetype,sections);
 const interactions=resolveInteractions(plan),connectors=resolveConnectors(plan),plugins=resolvePlugins(plan),workflow=resolveWorkflow(plan),patterns=resolveCompositionPatterns(plan),primitives=choosePrimitives(plan,templates);
 return {version:'webforge.visual-composition.r2',registry:registrySummary(),siteBlueprint:plan.siteBlueprint,designDNA:plan.designDNA,artDirection,content,media,templates,projectLocalComponents:templates.projectLocalComponents,rendererCoverage:templates.rendererCoverage,sections,zones,patterns,primitives,interactions,connectors,plugins,workflow,responsive:{breakpoints:{compact:640,tablet:900,desktop:1200,wide:1440},rules:['stack-priority-content-first','minimum-touch-target-44','no-horizontal-overflow','media-crop-per-slot','navigation-collapses-under-900','route-navigation-remains-keyboard-accessible','recompose-not-shrink']} };
}
