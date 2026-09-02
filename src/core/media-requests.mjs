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
export function buildMediaRequests(plan){
  const theme=plan.visual.artDirection.theme.id,brand=plan.brand.identity.name,location=plan.brand.content.location||'';
  const requests=plan.visual.media.slots.map(slot=>({
    id:`media-request:${slot.id}`,slotId:slot.id,role:slot.role,section:slot.section,aspectRatio:slot.aspectRatio,minWidth:slot.minWidth,
    prompt:`${rolePrompt[slot.role]||'premium supporting website image'} for ${brand}${location?` in ${location}`:''}; art direction ${theme}; original, production-quality, no text baked into image`,
    providerPreference:slot.connectorOrder.filter(x=>!['procedural-fallback'].includes(x)),
    status:'UNFULFILLED',authority:'EXPLICIT_TOOL_OR_USER_APPROVAL_REQUIRED',rights:'MUST_BE_VERIFIED_BEFORE_PRODUCTION'
  }));
  return {schema:'webforge.media-requests.r1',requests,productionGate:'all critical requests must be fulfilled with approved/verified media or explicitly waived'};
}
