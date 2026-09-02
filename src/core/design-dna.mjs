const has=(s,r)=>r.test(s);
export function synthesizeDesignDNA(project,brand){
  const text=project.brief.toLowerCase(); const g=project.domain.genome;
  let mode=g.visualMode;
  if(g.applicationDepth>=3&&mode==='marketing') mode='application';
  const emotionalIntent=has(text,/calm|trust|sensitive|funeral|health|legal/i)?'reassuring':has(text,/bold|energy|festival|club|techno|sport/i)?'high-energy':has(text,/luxury|premium|fashion/i)?'refined':has(text,/playful|kids|children|game/i)?'playful':'confident';
  const density=g.applicationDepth>=3?'dense':g.content.includes('editorial')?'balanced':mode==='cinematic'?'spacious':'balanced';
  const shapeLanguage=mode==='cinematic'?'sharp-layered':mode==='editorial'?'editorial-rectilinear':mode==='minimal'?'quiet-geometric':emotionalIntent==='playful'?'soft-variable':'structured-geometric';
  const motion=mode==='experiential'?'expressive':mode==='cinematic'?'cinematic':g.applicationDepth>=2?'functional':'subtle';
  const grid=mode==='editorial'?'asymmetric-editorial':mode==='cinematic'?'wide-overlap':mode==='experiential'?'spatial-story-grid':g.applicationDepth>=3?'12-column-application':'12-column-marketing';
  return {
    schema:'webforge.design-dna.v1',
    mode,emotionalIntent,density,grid,shapeLanguage,motion,
    typography:{character:brand.style.typography,scale:mode==='cinematic'?'display-dominant':mode==='editorial'?'editorial-contrast':g.applicationDepth>=3?'utility-product':'marketing-balanced'},
    surfaces:{language:mode==='cinematic'?'deep-layered':mode==='minimal'?'quiet-flat':g.applicationDepth>=3?'functional-elevated':'brand-surfaces',border:g.trustBurden==='critical'?'explicit':'contextual'},
    media:{intensity:g.mediaIntensity,treatment:brand.style.imageStrategy,hero:mode==='cinematic'?'immersive-media':mode==='application'?'product-stage':'contextual-media'},
    interaction:{intensity:g.applicationDepth*20+g.conversionIntensity/5,principle:g.trustBurden==='critical'?'predictable-and-explicit':'progressive-disclosure'},
    responsive:{strategy:'recompose-not-shrink',mobilePriority:g.conversionIntensity>=65?'action-first':'content-first',reducedMotion:'required'},
    accessibility:{target:'WCAG-2.2-AA-oriented',colorAlone:false,focusVisible:true,minTouchTarget:44},
    rationale:[`visualMode:${mode}`,`trust:${g.trustBurden}`,`applicationDepth:${g.applicationDepth}`,`media:${g.mediaIntensity}`,`conversion:${g.conversionIntensity}`]
  };
}
