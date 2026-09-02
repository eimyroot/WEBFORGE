export function planCapabilities(project) {
  const caps=['qa.core','seo.content'];
  if(project.product?.coreCapabilities?.length) caps.push(...project.product.coreCapabilities);
  const f=project.flags||{};
  if(project.archetype==='local-service'||project.archetype==='venue'||project.domain?.genome?.locality==='local-or-place-bound') caps.push('seo.local');
  if(f.booking) caps.push('conversion.booking');
  if(f.tickets) caps.push('conversion.tickets');
  if(f.auth) caps.push('identity.auth','data.application');
  if(f.commerce) caps.push('commerce.checkout','data.application');
  if(f.frequent) caps.push('content.cms'); else caps.push('content.static');
  if(f.gallery) caps.push('media.gallery');
  if(f.cinematic) caps.push('motion.cinematic');
  if(project.domain?.genome?.applicationDepth>=3) caps.push('ui.dashboard','data.application');
  if(project.domain?.genome?.applicationDepth>=3 || ['saas','web-app','marketplace'].includes(project.archetype) && project.flags.auth) caps.push('analytics.product');
  else caps.push('analytics.simple');
  const out=[...new Set(caps.filter(Boolean))];
  if(out.includes('content.cms')) return out.filter(x=>x!=='content.static'&&x!=='analytics.product'||project.domain?.genome?.applicationDepth>=3);
  return out;
}
