const uniq=xs=>[...new Set(xs)];
const slugify=s=>String(s||'item').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'item';

function makePage(id,path,purpose,sections,dynamic=false){return {id,path,purpose,sections,dynamic};}

export function designExperience(domain,product,brief){
  const caps=new Set(product.capabilityIds); const pages=[];
  const primaryEntity=product.entities[0]?.name||'Item';
  const entitySlug=slugify(primaryEntity).replace(/-?(item|object)$/,'')||'item';
  pages.push(makePage('home','/','orient-and-convert',['hero','value','proof','primary-action']));

  if(caps.has('commerce.catalog')||caps.has('discovery.search')||caps.has('discovery.categories')){
    pages.push(makePage('discover','/discover/','discovery',['search','filters','featured','categories','proof']));
    pages.push(makePage('detail',`/${entitySlug}/[slug]/`,'evaluate-and-act',['detail-hero','facts','media','proof','primary-action'],true));
  }
  if(caps.has('events.calendar')){
    pages.push(makePage('events','/events/','browse-events',['event-featured','event-grid','calendar','faq']));
    pages.push(makePage('event-detail','/events/[slug]/','event-decision',['event-hero','event-meta','lineup','schedule','primary-action'],true));
  }
  if(caps.has('profile.public')){
    pages.push(makePage('profiles','/people/','browse-profiles',['people-grid','filters','proof']));
    pages.push(makePage('profile-detail','/people/[slug]/','profile-context',['profile-hero','bio','related','primary-action'],true));
  }
  if(caps.has('media.gallery')) pages.push(makePage('gallery','/gallery/','visual-proof',['gallery','media-feature','primary-action']));
  if(caps.has('conversion.booking')) pages.push(makePage('booking','/book/','book',['availability','service-choice','booking-form','trust','faq']));
  if(caps.has('commerce.checkout')||caps.has('conversion.tickets')||caps.has('commerce.donation')) pages.push(makePage('transaction','/checkout/','transact',['order-summary','trust','payment-action']));
  if(caps.has('product.configuration')) pages.push(makePage('configure','/configure/','configure',['configurator','constraints','summary','primary-action']));
  if(caps.has('workflow.submission')) pages.push(makePage('submit','/submit/','submit',['guidance','submission-form','what-happens-next','trust']));
  if(caps.has('identity.account')) pages.push(makePage('account','/account/','account',['account-summary','history','saved-items','settings']));
  if(caps.has('dashboard.user')) pages.push(makePage('dashboard','/dashboard/','operate',['task-summary','status','activity','primary-actions']));
  if(caps.has('dashboard.admin')) pages.push(makePage('admin','/admin/','administer',['queues','metrics','records','audit']));
  if(caps.has('content.editorial')||caps.has('content.documentation')){
    pages.push(makePage('resources','/resources/','learn',['featured-content','topic-grid','latest-content','newsletter']));
    pages.push(makePage('resource-detail','/resources/[slug]/','read',['article-hero','article-body','related','primary-action'],true));
  }
  if(caps.has('geo.location')) pages.push(makePage('location','/location/','orient',['map','address','hours','directions','contact']));
  pages.push(makePage('about','/about/','trust',['story','people','proof','values']));
  pages.push(makePage('contact','/contact/','contact',['contact-options','form','location','faq']));

  const unique=[]; const seen=new Set();
  for(const p of pages){if(seen.has(p.path))continue;seen.add(p.path);unique.push(p);}
  const journeys=product.userJobs.map(job=>({id:job.id,goal:job.goal,path:job.id==='purchase'?['home','discover','detail','transaction']:job.id==='book'?['home','booking']:job.id==='submit'?['home','submit','account']:job.id==='configure'?['home','configure','contact']:job.id==='participate'?['home','profiles','account']:['home','discover','detail'].filter(x=>unique.some(p=>p.id===x)),successEvidence:job.needs}));
  return {
    schema:'webforge.experience-intelligence.v1',
    mode:domain.classification==='NOVEL'?'SYNTHESIZED_NOVEL':domain.classification==='HYBRID'?'SYNTHESIZED_HYBRID':'ONTOLOGY_ASSISTED',
    sitemap:unique,
    pageCount:unique.length,
    journeys,
    primaryEntity,
    navigation:unique.filter(p=>!p.dynamic&&!['transaction','admin'].includes(p.id)).slice(0,8).map(p=>({label:p.id.replaceAll('-',' '),path:p.path})),
    synthesisReason:[`domain:${domain.primary.id}`,`classification:${domain.classification}`,`capabilities:${product.capabilityIds.length}`,`jobs:${product.userJobs.length}`]
  };
}
