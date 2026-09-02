import { registry } from './composition-registry.mjs';
const THEMES=registry('artDirections');
function score(t,plan){
 const a=plan.project.archetype,mood=plan.brand?.style?.mood||'precise',brief=plan.project.brief.toLowerCase(),dna=plan.designDNA||{};let score=t.qualityScore;const reasons=[`quality ${t.qualityScore}`];
 if(t.bestFor.includes(a)){score+=18;reasons.push('archetype +18')}
 if((plan.project.flags.cinematic||dna.mode==='cinematic')&&['dark-cinematic','neo-industrial','high-energy'].includes(t.id)){score+=24;reasons.push('cinematic +24')}
 if(dna.mode==='editorial'&&['premium-editorial','fashion-editorial','cultural-editorial'].includes(t.id)){score+=20;reasons.push('editorial DNA +20')}
 if(dna.mode==='application'&&['product-precision','technical-dark','soft-saas'].includes(t.id)){score+=18;reasons.push('application DNA +18')}
 if(dna.emotionalIntent==='reassuring'&&['corporate-authority','warm-local','calm-premium'].includes(t.id)){score+=14;reasons.push('reassuring +14')}
 if(/dark cinematic|cinematic dark/.test(brief)&&t.id==='dark-cinematic'){score+=32;reasons.push('explicit dark-cinematic +32')}
 if(mood==='premium'&&['premium-editorial','luxury-minimal','calm-premium'].includes(t.id)){score+=18;reasons.push('premium +18')}
 if(mood==='minimal'&&['luxury-minimal','corporate-authority'].includes(t.id)){score+=16;reasons.push('minimal +16')}
 if(/enterprise|corporate|industrial/.test(brief)&&t.id==='corporate-authority'){score+=18;reasons.push('authority +18')}
 if(/developer|api|security/.test(brief)&&t.id==='technical-dark'){score+=16;reasons.push('technical +16')}
 if(/fashion/.test(brief)&&t.id==='fashion-editorial'){score+=18;reasons.push('fashion +18')}
 return {score,reasons};
}
export function resolveArtDirection(plan){
 const ranked=THEMES.map(t=>({...t,...score(t,plan)})).sort((a,b)=>b.score-a.score),t=structuredClone(ranked[0]);
 return {version:'webforge.art-direction.universal.v1',theme:t,designDNA:plan.designDNA,selection:{score:t.score,reasons:t.reasons,alternatives:ranked.slice(1,4).map(x=>({id:x.id,score:x.score}))},typography:{display:t.display,body:t.body,heroScale:plan.designDNA?.mode==='cinematic'?'clamp(4rem,9vw,9.5rem)':'clamp(3.2rem,7vw,7rem)',sectionScale:'clamp(2.1rem,4.4vw,5.2rem)',bodyScale:'clamp(1rem,1.3vw,1.18rem)'},spacing:{section:plan.designDNA?.density==='dense'?'clamp(48px,6vw,96px)':'clamp(72px,8vw,132px)',gutter:'clamp(20px,4vw,64px)',gap:'clamp(14px,2vw,28px)'},composition:{maxWidth:t.max,edgeToEdge:['venue','portfolio'].includes(plan.project.archetype)||plan.designDNA?.mode==='experiential',mediaBias:plan.layout.signals?.media||plan.domain?.genome?.mediaIntensity||50,contentDensity:plan.designDNA?.density||plan.layout.density,grid:plan.designDNA?.grid},rules:['hierarchy-before-decoration','one-primary-accent','media-must-have-role','mobile-composition-not-desktop-shrink','public-ui-hides-internal-ids','design-dna-over-preset-when-conflict']};
}
export function artDirectionCatalog(){return structuredClone(THEMES);}
