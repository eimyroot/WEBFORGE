const rolePrompt={
  'hero-image':'cinematic wide hero photograph with strong subject separation and negative space for headline',
  'event-card':'high-energy event atmosphere photograph suitable for an event card',
  'artist-portrait':'editorial artist portrait, clean background, face-safe crop',
  'gallery-landscape':'documentary atmosphere photograph with strong light and spatial depth',
  'experience-image':'premium environment photograph showing material, light and atmosphere',
  'case-hero':'editorial project hero image with clear focal point',
  'product-stage':'high-fidelity product interface presentation on a clean stage',
  'team-portrait':'professional editorial portrait with consistent lighting',
  'location-image':'location/environment photograph useful for wayfinding and trust',
  'article-card':'editorial feature image with restrained composition',
  'service-image':'service/outcome image with credible real-world context'
};
const variationHints=['wide establishing composition','tight material detail','human-scale context','asymmetric editorial crop','seasonal or contextual variation','process or craft detail'];
function sectionSubject(plan,slot){
  const section=plan.visual?.content?.model?.[slot.section]||{};
  const items=section.items||section.steps||[];
  if(Array.isArray(items)&&items.length){
    const item=items[slot.index%items.length];
    if(typeof item==='string')return item;
    const subject=item?.mediaLabel||item?.title||item?.name||item?.label;
    if(subject)return subject;
  }
  return section.headline||section.title||section.quote||section.body||null;
}
function variationFor(slot){
  const offset=[...slot.section].reduce((n,c)=>n+c.charCodeAt(0),0);
  return variationHints[(offset+slot.index)%variationHints.length];
}
export function buildMediaRequests(plan){
  const theme=plan.visual.artDirection.theme.id,brand=plan.brand.identity.name,location=plan.brand.content.location||'';
  const requests=plan.visual.media.slots.map(slot=>{
    const subject=sectionSubject(plan,slot),variation=variationFor(slot);
    return {
      id:`media-request:${slot.id}`,slotId:slot.id,role:slot.role,section:slot.section,aspectRatio:slot.aspectRatio,minWidth:slot.minWidth,
      variantKey:`${slot.section}:${slot.index+1}:${variationHints.indexOf(variation)+1}`,
      subject,
      prompt:`${rolePrompt[slot.role]||'premium supporting website image'} for ${brand}${location?` in ${location}`:''}; ${subject?`subject focus: ${subject}; `:''}composition variation: ${variation}; keep sibling slots materially different in subject scale, framing or context; art direction ${theme}; original, production-quality, no text baked into image`,
      providerPreference:slot.connectorOrder.filter(x=>!['procedural-fallback'].includes(x)),
      status:'UNFULFILLED',authority:'EXPLICIT_TOOL_OR_USER_APPROVAL_REQUIRED',rights:'MUST_BE_VERIFIED_BEFORE_PRODUCTION'
    };
  });
  return {schema:'webforge.media-requests.r1',requests,productionGate:'all critical requests must be fulfilled with approved/verified media or explicitly waived'};
}
