import { registry } from './composition-registry.mjs';
const interactions=registry('interactions');
export function resolveInteractions(plan){
  const a=plan.project.archetype,caps=plan.capabilities,ids=new Set(['sticky-nav','mobile-drawer','nav-active-state','card-hover-lift','button-arrow-slide','accordion','reduced-motion-fallback']);
  if(plan.project.flags.gallery){ids.add('image-lightbox');ids.add('gallery-filter');ids.add('card-hover-image-zoom')}
  if(plan.project.flags.tickets){ids.add('sticky-cta');ids.add('checkout-redirect');ids.add('event-filter')}
  if(plan.project.flags.booking){ids.add('booking-submit');ids.add('form-validation');ids.add('sticky-cta')}
  if(['saas','web-app','marketplace'].includes(a)){ids.add('tabs');ids.add('tooltip');ids.add('pricing-toggle')}
  if(plan.layout.signals?.novelty>65){ids.add('scroll-reveal');ids.add('section-reveal')}
  if(caps.includes('motion.cinematic'))ids.add('parallax-light');
  const selected=interactions.filter(x=>ids.has(x.id)).sort((a,b)=>b.qualityScore-a.qualityScore);
  return {schema:'webforge.interactions.r1',selected,clientJs:selected.filter(x=>x.requiresClientJs).map(x=>x.id),a11yGate:selected.every(x=>x.a11yGate!==false)?'PASS':'FAIL'};
}
