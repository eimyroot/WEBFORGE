const VARIANTS={
  categories:'category-grid',featured:'listing-rail','search-results':'search-results',team:'people-grid',artists:'rail',pricing:'pricing-grid',booking:'booking-panel',comparison:'comparison-grid',testimonials:'testimonial-wall','trust-strip':'trust-strip','domain-signature':'adaptive-section',
  'next-event':'spotlight',schedule:'timeline',gallery:'masonry','task-preview':'app-stage',workflow:'timeline',
  integrations:'integration-grid',security:'trust-panel',proof:'case-proof',process:'timeline',faq:'accordion-list',
  'product-proof':'product-stage',location:'map-split','latest-content':'content-grid',newsletter:'conversion',
  services:'cards',outcomes:'metrics','how-it-works':'timeline','trust-safety':'trust-panel','final-cta':'conversion'
};
const ROLES={categories:'DISCOVER',featured:'DISCOVER','search-results':'DISCOVER',comparison:'VALUE',booking:'ACTION',testimonials:'PROOF','trust-strip':'TRUST','domain-signature':'MEDIA',team:'PEOPLE',artists:'DISCOVER',pricing:'ACTION','next-event':'ACTION',schedule:'PROCESS',gallery:'MEDIA','task-preview':'PRODUCT',workflow:'PROCESS',integrations:'ECOSYSTEM',security:'TRUST',proof:'PROOF',process:'PROCESS',faq:'OBJECTION','product-proof':'PRODUCT',location:'ORIENT','latest-content':'FRESHNESS',newsletter:'FRESHNESS',services:'VALUE',outcomes:'PROOF','how-it-works':'PROCESS','trust-safety':'TRUST'};
const uniq=xs=>[...new Set(xs)];
function wanted(project){
  const c=new Set(project.product?.capabilityIds||[]), g=project.domain?.genome||{}; const out=[];
  if(c.has('discovery.search')||c.has('commerce.catalog')) out.push('categories','featured');
  if(c.has('discovery.search')) out.push('search-results');
  if(c.has('profile.public')) out.push(project.archetype==='venue'?'artists':'team');
  if(c.has('commerce.checkout')||c.has('commerce.subscription')||c.has('commerce.donation')) out.push('pricing');
  if(c.has('conversion.booking')||c.has('booking.availability')) out.push('booking');
  if(c.has('product.configuration')||c.has('discovery.filter')) out.push('comparison');
  if(c.has('events.calendar')) out.push('next-event','schedule');
  if(c.has('media.gallery')||g.mediaIntensity>=65) out.push('gallery');
  if(c.has('dashboard.user')||g.applicationDepth>=3) out.push('task-preview','workflow','integrations','security');
  if(c.has('workflow.submission')) out.push('process','faq');
  if(c.has('product.configuration')) out.push('product-proof','workflow');
  if(c.has('geo.location')) out.push('location');
  if(c.has('content.editorial')||c.has('content.documentation')) out.push('latest-content');
  if(c.has('communication.newsletter')) out.push('newsletter');
  if(c.has('community.members')) out.push('team','latest-content');
  if(c.has('trust.reviews')) out.push('testimonials');
  if(g.trustBurden==='critical'||g.trustBurden==='high') out.push('trust-strip','proof','security');
  if(project.domain?.classification==='NOVEL') out.unshift('domain-signature');
  if(project.domain?.classification!=='KNOWN'&&!out.includes('how-it-works')) out.push('how-it-works');
  return uniq(out);
}
function insertBeforeFinal(sections,items){
  const core=sections.filter(x=>x!=='hero'&&x!=='final-cta');
  const preferred=[];
  const order=['domain-signature','categories','featured','search-results','next-event','artists','team','product-proof','services','gallery','task-preview','workflow','schedule','integrations','outcomes','proof','security','process','how-it-works','latest-content','newsletter','comparison','booking','pricing','testimonials','trust-strip','location','faq'];
  for(const id of order) if(core.includes(id)||items.includes(id)) preferred.push(id);
  for(const id of core) if(!preferred.includes(id)) preferred.push(id);
  return ['hero',...uniq(preferred).slice(0,11),'final-cta'];
}
export function applyUniversalLayout(layout,project){
  const items=wanted(project); if(!items.length)return layout;
  const out=structuredClone(layout); out.sections=insertBeforeFinal(out.sections,items);
  out.variants=out.variants||{}; for(const id of out.sections) if(id!=='hero'&&!out.variants[id]) out.variants[id]=VARIANTS[id]||'content-grid';
  out.sectionPlan=out.sections.map((id,index)=>({id,variant:id==='hero'?out.hero:(out.variants[id]||VARIANTS[id]||'content-grid'),role:ROLES[id]||out.sectionPlan?.find(x=>x.id===id)?.role||'VALUE',priority:index===0?'critical':index<4?'high':'normal',slot:index}));
  out.fingerprint=out.sections.map((x,i)=>`${i}:${x}:${x==='hero'?out.hero:out.variants[x]}`).join('|');
  out.universalEnrichment={schema:'webforge.universal-layout-enrichment.v1',added:items.filter(x=>!layout.sections.includes(x)),capabilityCount:project.product?.capabilityIds?.length||0,domainClassification:project.domain?.classification};
  out.directionSource='universal-capability-synthesis';
  return out;
}
