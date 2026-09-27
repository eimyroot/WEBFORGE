const uniq=xs=>[...new Set(xs.filter(Boolean))];
const words=s=>new Set(String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(Boolean));
const has=(set,...xs)=>xs.some(x=>set.has(x));

const PROFILES={
  'hospitality-stay':{idea:'place-first stay narrative',emotion:['desire','calm','confidence'],avoid:['generic-card-grid','software-dashboard-language','equal-weight-sections'],rhythm:'slow-editorial',symmetry:'asymmetric',mediaDominance:'high',type:'editorial-contrast',required:['availability','gallery','services','proof','booking','location','faq']},
  'hospitality-dining':{idea:'menu-and-room sensory narrative',emotion:['appetite','intimacy','confidence'],avoid:['corporate-service-grid','generic-stock-food-layout','dashboard-density'],rhythm:'editorial-service',symmetry:'asymmetric',mediaDominance:'high',type:'editorial-contrast',required:['services','featured','gallery','booking','experience','location','faq']},
  'florist-commerce':{idea:'seasonal botanical atelier',emotion:['warmth','delight','personal-care'],avoid:['corporate-blue','uniform-product-cards','technology-visual-language'],rhythm:'organic-editorial',symmetry:'asymmetric',mediaDominance:'high',type:'editorial-display',required:['categories','featured','services','gallery','process','latest-content','location','faq']},
  'event-experience':{idea:'time-sensitive atmospheric event journey',emotion:['anticipation','energy','belonging'],avoid:['generic-corporate-grid','quiet-brochure-rhythm','repetitive-centered-sections'],rhythm:'cinematic-pulse',symmetry:'asymmetric',mediaDominance:'high',type:'expressive-display',required:['next-event','latest-content','artists','gallery','experience','schedule','proof','faq']},
  'product-application':{idea:'product proof through real task flow',emotion:['clarity','control','confidence'],avoid:['lifestyle-brochure-layout','decorative-gallery-first','feature-card-wall'],rhythm:'task-proof-system',symmetry:'structured',mediaDominance:'medium',type:'functional-grotesk',required:['product-proof','task-preview','workflow','integrations','proof','security','pricing','faq']},
  'authority-service':{idea:'matter-to-expertise evidence path',emotion:['trust','clarity','assurance'],avoid:['playful-commerce-language','decorative-card-wall','unattributed-proof'],rhythm:'expertise-evidence',symmetry:'structured-asymmetric',mediaDominance:'low',type:'authority-serif',required:['services','team','proof','process','latest-content','location','faq']},
  'technical-evaluation':{idea:'specification before persuasion',emotion:['precision','competence','certainty'],avoid:['lifestyle-hero-copy','soft-generic-benefits','visuals-without-evidence'],rhythm:'technical-evidence',symmetry:'structured',mediaDominance:'medium',type:'technical-grotesk',required:['services','categories','featured','outcomes','case-study','process','faq']},
  'media-showcase':{idea:'work-first authored visual sequence',emotion:['curiosity','taste','confidence'],avoid:['service-card-first','generic-testimonial-wall','equal-image-crops'],rhythm:'gallery-editorial',symmetry:'asymmetric',mediaDominance:'very-high',type:'editorial-display',required:['selected-work','gallery','case-study','statement','about','proof']},
  'editorial-publication':{idea:'story hierarchy before conversion',emotion:['curiosity','focus','return-intent'],avoid:['landing-page-cta-stack','uniform-card-wall','product-dashboard-language'],rhythm:'chaptered-editorial',symmetry:'asymmetric',mediaDominance:'medium',type:'editorial-display',required:['latest-content','categories','featured','newsletter','proof']},
  'care-service':{idea:'care path with reassurance before action',emotion:['reassurance','clarity','safety'],avoid:['aggressive-conversion','visual-noise','unsupported-medical-claims'],rhythm:'calm-evidence',symmetry:'structured',mediaDominance:'low',type:'humanist-grotesk',required:['services','team','process','proof','booking','location','faq']},
  'commerce-store':{idea:'merchandising around a concrete buying decision',emotion:['desire','clarity','confidence'],avoid:['brochure-only-layout','identical-product-tiles-everywhere','hidden-fulfilment-rules'],rhythm:'browse-compare-buy',symmetry:'mixed',mediaDominance:'high',type:'modern-grotesk',required:['categories','featured','comparison','testimonials','gallery','trust-safety','faq']}
};

function fallback(project){
  const s=project.designStrategy,g=project.domain.genome,traits=s.brand_personality?.traits||[];
  return {
    idea:`${s.layout_strategy?.primary||'narrative'} shaped around ${s.business_goal||'the primary decision'}`,
    emotion:uniq([traits[0],traits[1],g.trustBurden==='high'?'trust':null,'clarity']).slice(0,3),
    avoid:['fixed-template-repetition','generic-filler-copy','equal-weight-sections'],
    rhythm:s.layout_strategy?.sectionRhythm||'balanced',
    symmetry:g.mediaIntensity>=65?'asymmetric':'mixed',
    mediaDominance:g.mediaIntensity>=80?'high':g.mediaIntensity>=50?'medium':'low',
    type:s.typography_strategy?.character||'modern-grotesk',
    required:s.composition_profile?.homepageSections||[]
  };
}

function semanticIdea(profile,tokens,project){
  if(profile==='hospitality-stay'&&has(tokens,'alpine','mountain','mountains','chalet'))return 'quiet alpine refuge, not generic luxury hotel';
  if(profile==='hospitality-stay'&&has(tokens,'boutique','luxury','premium'))return 'intimate place-led stay, not generic luxury';
  if(profile==='florist-commerce'&&has(tokens,'wedding','weddings'))return 'seasonal botanical atelier from occasion to arrangement';
  if(profile==='authority-service'&&has(tokens,'law','legal','lawyer','attorney'))return 'legal judgement made attributable through people and evidence';
  if(profile==='product-application'&&has(tokens,'monitoring','alerts','realtime','real-time'))return 'live operational clarity before marketing claims';
  if(profile==='media-showcase'&&has(tokens,'architecture','architect'))return 'spatial work presented as an authored sequence of place and detail';
  if(profile==='hospitality-dining')return 'food, room and service paced as one reservation story';
  if(profile==='technical-evaluation')return 'technical fit proven before the request for quote';
  return null;
}

export function compileCreativeBrief(project){
  const strategy=project.designStrategy||{},profile=strategy.composition_profile?.siteArchetype||'narrative-organization';
  const tokens=words(project.brief),base=PROFILES[profile]||fallback(project),idea=semanticIdea(profile,tokens,project)||base.idea;
  const entities=uniq((project.product?.entities||[]).map(x=>x.name));
  const journeys=uniq(strategy.composition_profile?.conversionFlow||project.product?.userJobs?.map(x=>x.id)||[]);
  const requiredSections=uniq(base.required||strategy.composition_profile?.homepageSections||[]);
  const complexity=strategy.information_complexity?.level||'medium';
  const detailLevel=['high','medium-high'].includes(complexity)||requiredSections.length>=7?'deep':requiredSections.length>=5?'standard':'focused';
  return {
    schema:'webforge.creative-brief.r2',
    thesis:{idea,emotion:base.emotion,avoid:base.avoid,domainSpecificity:'required'},
    narrative:{pattern:profile,stages:journeys,opening:journeys[0]||'understand',resolution:journeys.at(-1)||strategy.business_goal||'act'},
    contentDepth:{detailLevel,entities,requiredSections,requiredJourneys:journeys,minimumDistinctTopics:Math.max(3,Math.min(8,entities.length||requiredSections.length)),informationSufficiency:'decision-complete-not-section-count'},
    compositionIntent:{rhythm:base.rhythm,symmetry:base.symmetry,mediaDominance:base.mediaDominance,typographyPersonality:base.type,conversionIntensity:strategy.conversion_strategy?.intensity||project.domain.genome?.conversionIntensity||0},
    invariants:['brief-derived','domain-specific','no-random-creativity','content-depth-before-decoration','avoid-template-sameness']
  };
}

export function evaluateCompositionDiversity(spatial){
  const sections=(spatial?.sections||[]).filter(x=>!['hero','final-cta'].includes(x.id));
  const zones=(spatial?.zones||[]).filter(x=>!x.members?.includes('hero')&&!x.members?.includes('final-cta'));
  const ratio=(values,cap)=>values.length?Math.min(1,new Set(values).size/Math.max(1,Math.min(values.length,cap))):0;
  const counts=new Map();for(const x of sections)counts.set(x.geometry,(counts.get(x.geometry)||0)+1);
  const maxReuse=sections.length?Math.max(0,...counts.values())/sections.length:0;
  const metrics={
    geometryVariety:Number(ratio(sections.map(x=>x.geometry),6).toFixed(3)),
    widthVariety:Number(ratio(sections.map(x=>x.width),3).toFixed(3)),
    alignmentVariety:Number(ratio(sections.map(x=>x.align),3).toFixed(3)),
    zoneVariety:Number(ratio(zones.map(x=>x.kind),4).toFixed(3)),
    maxGeometryReuse:Number(maxReuse.toFixed(3))
  };
  const score=Number((metrics.geometryVariety*.45+metrics.zoneVariety*.25+metrics.widthVariety*.15+metrics.alignmentVariety*.15).toFixed(3));
  const status=score>=0.55&&metrics.maxGeometryReuse<=0.5?'PASS':'FAIL';
  return {schema:'webforge.composition-diversity.r1',status,score,metrics,thresholds:{score:0.55,maxGeometryReuse:0.5}};
}
