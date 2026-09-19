const uniq=xs=>[...new Set(xs.filter(Boolean))];
function hash(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
const pick=(xs,seed)=>xs[hash(seed)%xs.length];
const roleOf=s=>s.role||'VALUE';

const SECTION_GEOMETRIES={
  gallery:['full-bleed-media','mosaic-offset','gallery-rail'],
  categories:['offset-grid','editorial-list','staggered-grid'],
  featured:['offset-grid','staggered-grid','rail-cards'],
  services:['editorial-list','offset-grid','text-dominant'],
  process:['timeline-vertical','timeline-horizontal','staggered-steps'],
  workflow:['timeline-vertical','timeline-horizontal','staggered-steps'],
  'how-it-works':['timeline-vertical','timeline-horizontal','staggered-steps'],
  proof:['metric-band','evidence-split','narrow-stack'],
  outcomes:['metric-band','evidence-split','wide-metrics'],
  'latest-content':['magazine-grid','editorial-list','content-rail'],
  team:['people-mosaic','people-rail','narrow-stack'],
  artists:['people-mosaic','people-rail','narrow-stack'],
  statement:['editorial-column','text-dominant','full-bleed-statement'],
  about:['editorial-column','media-dominant','narrow-stack'],
  experience:['media-dominant','reverse-split','full-bleed-media'],
  location:['map-wide','reverse-split','narrow-stack'],
  faq:['narrow-stack','faq-sidebar'],
  pricing:['pricing-stage','offset-grid'],
  comparison:['offset-grid','editorial-list'],
  'domain-signature':['full-bleed-statement','editorial-column','media-dominant']
};
function heroGeometry(plan){
  const id=plan.project?.domainArchetype||plan.domain?.primary?.id||'';
  const direction=plan.domain?.synthesis?.direction?.id;
  const strategy=plan.designStrategy?.layout_strategy?.primary||'';
  if(id==='florist-retail')return 'hero-editorial-stack';
  if(id==='hospitality')return 'hero-full-bleed';
  if(id==='industrial-b2b')return 'hero-technical-split';
  if(['software-product','web-application'].includes(id))return 'hero-product-split';
  if(direction==='immersive-story')return 'hero-poster';
  if(direction==='editorial-narrative')return 'hero-editorial-stack';
  if(direction==='interactive-system')return 'hero-product-split';
  if(direction==='discovery-explorer')return 'hero-search-wide';
  if(direction==='community-flow')return 'hero-community';
  if(direction==='evidence-led')return 'hero-evidence-split';
  if(direction==='action-led')return 'hero-conversion-split';
  if(strategy==='media-led')return 'hero-full-bleed';
  if(strategy==='conversion-led')return 'hero-conversion-split';
  return 'hero-asymmetric';
}
function candidates(section,plan){
  const direct=SECTION_GEOMETRIES[section.id];if(direct)return direct;
  const role=roleOf(section);
  if(role==='MEDIA')return ['full-bleed-media','media-dominant','mosaic-offset'];
  if(role==='PROCESS')return ['timeline-vertical','timeline-horizontal','staggered-steps'];
  if(['PROOF','TRUST'].includes(role))return ['evidence-split','metric-band','narrow-stack'];
  if(['DISCOVER','VALUE'].includes(role))return ['offset-grid','editorial-list','staggered-grid'];
  if(role==='PEOPLE')return ['people-mosaic','people-rail','narrow-stack'];
  return ['text-dominant','media-dominant','editorial-column'];
}
function sectionWidth(geometry){
  if(/full-bleed|map-wide|metric-band|gallery-rail|content-rail/.test(geometry))return 'full';
  if(/narrow|editorial-column|faq-sidebar/.test(geometry))return 'narrow';
  if(/offset|mosaic|pricing-stage|people-mosaic/.test(geometry))return 'wide';
  return 'standard';
}
function mediaRatio(geometry){
  if(/media-dominant|full-bleed-media|mosaic|gallery|people/.test(geometry))return 'high';
  if(/text-dominant|editorial-list|narrow|timeline/.test(geometry))return 'low';
  return 'balanced';
}
function alignFor(geometry,seed){
  if(/full-bleed|metric-band|rail/.test(geometry))return 'center';
  if(/reverse/.test(geometry))return 'right';
  return hash(seed)%2?'left':'right';
}
function specFor(section,index,plan,seed,used){
  if(section.id==='hero')return {id:section.id,geometry:heroGeometry(plan),width:'full',align:'center',mediaRatio:'high',overlap:false,rhythm:'viewport'};
  if(section.id==='final-cta')return {id:section.id,geometry:'full-bleed-cta',width:'full',align:'center',mediaRatio:'low',overlap:false,rhythm:'compact'};
  let options=candidates(section,plan),geometry=pick(options,`${seed}|${section.id}|${index}`);
  if((used.get(geometry)||0)>=2){const alt=options.find(x=>(used.get(x)||0)===0);if(alt)geometry=alt;}
  used.set(geometry,(used.get(geometry)||0)+1);
  const overlap=/mosaic|staggered|poster/.test(geometry)&&hash(`${seed}|overlap|${section.id}`)%3===0;
  return {id:section.id,geometry,width:sectionWidth(geometry),align:alignFor(geometry,`${seed}|align|${section.id}`),mediaRatio:mediaRatio(geometry),overlap,rhythm:/timeline|editorial|statement/.test(geometry)?'long':'standard'};
}
function canPair(a,b){
  if(!a||!b)return false;
  if(a.width==='full'||b.width==='full')return false;
  if(/timeline|rail|pricing-stage/.test(a.geometry+b.geometry))return false;
  return true;
}
function buildZones(specs,seed){
  const zones=[];let i=0;
  while(i<specs.length){const a=specs[i];
    if(a.id==='hero'||a.id==='final-cta'||a.width==='full'){zones.push({id:`z-${a.id}`,kind:'single',members:[a.id]});i++;continue;}
    const b=specs[i+1];
    if(canPair(a,b)&&!['final-cta'].includes(b.id)&&hash(`${seed}|zone|${a.id}|${b.id}`)%4!==0){
      const kinds=['split-60-40','split-40-60','staggered-pair'];
      const kind=pick(kinds,`${seed}|pair|${a.id}|${b.id}`);
      zones.push({id:`z-${a.id}-${b.id}`,kind,members:[a.id,b.id]});i+=2;continue;
    }
    zones.push({id:`z-${a.id}`,kind:a.width==='narrow'?'offset-single':'single',members:[a.id]});i++;
  }
  return zones;
}
function canvasModel(plan,seed){
  const strategy=plan.designStrategy?.layout_strategy?.primary||'';
  const direction=plan.domain?.synthesis?.direction?.id||'';
  if(strategy==='product-system'||direction==='interactive-system')return 'app-framed';
  if(strategy==='editorial-system'||direction==='editorial-narrative')return 'editorial-flow';
  if(strategy==='media-led'||direction==='immersive-story')return 'edge-to-edge';
  if(strategy==='industrial-system')return 'technical-grid';
  if(plan.project?.domainArchetype==='florist-retail')return 'atelier';
  return pick(['mixed-width','framed','edge-to-edge'],`${seed}|canvas`);
}
export function compileSpatialComposition(plan,sections){
  const seed=uniq([plan.domain?.synthesis?.signature,plan.layout?.fingerprint,plan.brand?.identity?.name,plan.project?.domainArchetype,plan.designStrategy?.layout_strategy?.primary]).join('|');
  const used=new Map(),specs=sections.map((s,i)=>specFor(s,i,plan,seed,used));
  const zones=buildZones(specs,seed),canvas=canvasModel(plan,seed);
  const fingerprint=[canvas,...specs.map(x=>`${x.id}:${x.geometry}:${x.width}:${x.align}`),...zones.map(x=>`${x.kind}(${x.members.join('+')})`)].join('|');
  return {version:'webforge.spatial-composition.v1',canvas,sections:specs,zones,fingerprint,geometryCount:new Set(specs.map(x=>x.geometry)).size,principles:['brief-derived','section-context','mixed-width','responsive-recompose','no-template-lock-in']};
}
