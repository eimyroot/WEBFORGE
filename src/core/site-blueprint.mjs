import { registry } from './composition-registry.mjs';
const blueprints=registry('pageBlueprints');
function score(bp,project){
  const text=project.brief.toLowerCase();let score=bp.archetype===project.archetype?70:-100;const reasons=[];
  if(score>0)reasons.push('archetype +70');
  for(const tag of bp.tags){if(text.includes(tag.toLowerCase())){score+=12;reasons.push(`tag:${tag} +12`)}}
  if(project.flags.tickets&&bp.id.includes('nightclub')){score+=16;reasons.push('ticket journey +16')}
  if(project.flags.booking&&bp.archetype==='local-service'){score+=8;reasons.push('booking journey +8')}
  if(project.flags.auth&&['saas','web-app','marketplace'].includes(bp.archetype)){score+=8;reasons.push('authenticated product +8')}
  score+=Math.round((bp.qualityScore-90)/2);return {score,reasons};
}
function pageTitle(id){return id.split('-').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ')}
function sectionHints(sections=[]){const map={search:'categories',filters:'categories',featured:'featured',categories:'categories','detail-hero':'product-proof',facts:'services',media:'gallery','primary-action':'final-cta','event-featured':'next-event','event-grid':'latest-content',calendar:'schedule','event-hero':'next-event','event-meta':'services',lineup:'artists','people-grid':'team',bio:'about',related:'featured',availability:'availability','service-choice':'services','booking-form':'process',trust:'proof','order-summary':'pricing','payment-action':'final-cta',configurator:'product-proof',constraints:'workflow',summary:'outcomes',guidance:'problem-solution','submission-form':'process','what-happens-next':'how-it-works','account-summary':'task-preview',history:'latest-content','saved-items':'featured',settings:'services','task-summary':'task-preview',status:'workflow',activity:'latest-content','primary-actions':'final-cta',queues:'workflow',metrics:'outcomes',records:'featured',audit:'security','featured-content':'featured','topic-grid':'categories','article-hero':'statement','article-body':'latest-content',map:'location',address:'location',hours:'location',directions:'location',contact:'services',story:'about',people:'team',values:'statement','contact-options':'services',form:'process'};return [...new Set(sections.map(x=>map[x]||x).filter(x=>['hero','categories','featured','services','proof','process','faq','gallery','location','latest-content','team','artists','pricing','availability','product-proof','task-preview','workflow','security','outcomes','problem-solution','how-it-works','statement','about','next-event','schedule','final-cta'].includes(x)))]}
function pageFamily(page={}){
  const id=String(page.id||'').toLowerCase(), path=String(page.path||'').toLowerCase();
  const named=(...xs)=>xs.some(x=>id.includes(x)||path.includes('/'+x));
  if(path==='/') return 'home';
  if(page.dynamic||path.includes('[slug]')) return 'detail';
  if(named('pricing','plans','fees')) return 'pricing';
  if(named('contact','offices','directions')) return 'contact';
  if(named('about','story','studio','team','people','authors','values')) return 'about';
  if(named('booking','reservation','viewing','apply','admission','donate','join','rfq','consultation','submission','submit','checkout','purchase')) return 'action';
  if(named('latest','article','insight','news','resource','guide','research','press','newsletter')) return 'editorial';
  if(named('jobs','companies','properties','programmes','products','shop','categories','collections','projects','directory','campaigns','services','capabilities','industries','compare','browse')) return 'listing';
  if(named('security','trust','impact','proof','case-studies','cases','reviews')) return 'evidence';
  if(named('account','dashboard','status','settings','history','saved')) return 'application';
  return 'overview';
}
function detailKind(page={},project={}){
  if(!(page.dynamic||String(page.path||'').includes('[slug]'))) return null;
  const id=String(page.id||'').toLowerCase(), domain=String(project.domainArchetype||project.domain?.primary?.id||'').toLowerCase();
  if(id.includes('event')) return 'event';
  if(id.includes('profile')||String(page.path||'').includes('/people/')) return 'profile';
  if(id.includes('resource')||id.includes('article')||id.includes('story')) return 'article';
  if(domain==='real-estate') return 'property';
  if(domain==='jobs-careers') return 'job';
  if(domain==='education-learning') return 'course';
  if(['commerce-store','marketplace-platform','industrial-b2b','software-product'].includes(domain)) return 'product';
  return 'product';
}
function universalBlueprint(project){
  const exp=project.experience;
  const pages=exp.sitemap.map((p,i)=>({
    id:p.id,path:p.path,title:pageTitle(p.id),purpose:p.purpose,sections:p.sections,sectionHints:sectionHints(p.sections),family:pageFamily(p),detailKind:detailKind(p,project),
    priority:i===0?'critical':i<4?'high':'normal',dynamic:!!p.dynamic
  }));
  return {
    schema:'webforge.site-blueprint.universal.v1',
    id:`universal-${project.domainArchetype}`,
    archetype:project.archetype,
    domainArchetype:project.domainArchetype,
    synthesisMode:exp.mode,
    score:100,
    reasons:exp.synthesisReason,
    pages,pageCount:pages.length,alternatives:[],qualityScore:95,maturity:'synthesized',
    journeys:exp.journeys,navigation:exp.navigation
  };
}
export function resolveSiteBlueprint(project){
  const useUniversal=project.domain?.classification!=='KNOWN' || project.product?.capabilityIds?.some(x=>['product.configuration','workflow.submission','community.members','commerce.donation','discovery.swipe'].includes(x));
  if(useUniversal) return universalBlueprint(project);
  const ranked=blueprints.map(bp=>({...bp,...score(bp,project)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  const best=ranked[0]||blueprints.find(x=>x.archetype===project.archetype)||blueprints[0];
  let pages=best.pages.map((p,i)=>({...p,priority:i===0?'critical':i<3?'high':'normal',dynamic:p.path.includes('[slug]')}));
  if(project.designStrategy?.page_hierarchy?.length){
    const strategyById=new Map(project.designStrategy.page_hierarchy.map(x=>[x.id,x]));
    const strategyIds=new Set(strategyById.keys());
    pages=pages.map(page=>{
      const target=strategyById.get(page.id);
      return target&&!page.dynamic?{...page,path:target.path,title:target.label||page.title,purpose:target.purpose||page.purpose}:page;
    });
    const byPath=new Map();
    const put=page=>{const current=byPath.get(page.path);if(!current||strategyIds.has(page.id)&&!strategyIds.has(current.id))byPath.set(page.path,page);};
    for(const page of pages) put(page);
    for(const ep of project.experience.sitemap){
      put({id:ep.id,path:ep.path,title:pageTitle(ep.id),purpose:ep.purpose,sections:ep.sections,sectionHints:sectionHints(ep.sections),family:pageFamily(ep),detailKind:detailKind(ep,project),priority:'normal',dynamic:!!ep.dynamic,strategyAdded:true});
    }
    pages=[...byPath.values()];
    const rank=new Map(project.designStrategy.page_hierarchy.map((x,i)=>[x.path,i]));
    pages.sort((a,b)=>(rank.get(a.path)??999)-(rank.get(b.path)??999));
    pages=pages.map((p,i)=>({...p,priority:i===0?'critical':i<4?'high':p.priority||'normal'}));
  }
  pages=pages.map(p=>({...p,family:p.family||pageFamily(p),detailKind:p.detailKind||detailKind(p,project)}));
  return {schema:'webforge.site-blueprint.r1',id:best.id,archetype:best.archetype,domainArchetype:project.domainArchetype,score:best.score||0,reasons:best.reasons||[],pages,pageCount:pages.length,navigation:project.experience.navigation,alternatives:ranked.slice(1,4).map(x=>({id:x.id,score:x.score})),qualityScore:best.qualityScore,maturity:best.maturity};
}
