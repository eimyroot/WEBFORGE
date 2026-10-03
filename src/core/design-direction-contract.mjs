export const DESIGN_DIRECTION_FIELDS={
  archetype:['editorial','split','grid','showcase'],
  hero:['text-led','media-led','split'],
  density:['airy','balanced','dense'],
  rhythm:['stacked','alternating','mosaic','rail'],
  section_1:['offer','proof','process','gallery','faq','pricing','integrations','contact'],
  section_2:['offer','proof','process','gallery','faq','pricing','integrations','contact'],
  section_3:['offer','proof','process','gallery','faq','pricing','integrations','contact'],
  section_4:['offer','proof','process','gallery','faq','pricing','integrations','contact'],
  cta:['explore','contact','transact'],palette:['warm','cool','neutral','contrast'],
  shape:['sharp','soft','pill'],nav:['compact','balanced','prominent']
};
export const DESIGN_DIRECTION_SCHEMA={
  type:'object',properties:Object.fromEntries(Object.entries(DESIGN_DIRECTION_FIELDS).map(([key,values])=>[key,{type:'string',enum:values}])),
  required:Object.keys(DESIGN_DIRECTION_FIELDS)
};
export const MIN_DIRECTION_DISTANCE=.30;
const clamp=value=>Math.max(0,Math.min(1,value));

export function validateDesignDirectionPlan(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return {status:'FAIL',reason:'STRUCTURED_PLAN_NOT_OBJECT'};
  const keys=Object.keys(DESIGN_DIRECTION_FIELDS),extra=Object.keys(value).filter(k=>!keys.includes(k));
  if(extra.length)return {status:'BLOCKED',reason:'STRUCTURED_PLAN_EXTRA_KEYS',extra};
  for(const key of keys)if(!DESIGN_DIRECTION_FIELDS[key].includes(value[key]))return {status:'FAIL',reason:'STRUCTURED_PLAN_ENUM_INVALID',field:key,value:value[key]};
  const sections=[value.section_1,value.section_2,value.section_3,value.section_4];
  if(new Set(sections).size!==sections.length)return {status:'FAIL',reason:'STRUCTURED_PLAN_DUPLICATE_SECTIONS',sections};
  return {status:'PASS',plan:Object.fromEntries(keys.map(k=>[k,value[k]]))};
}function componentIds(spec){return new Set((spec.components||[]).map(x=>String(x.id||'').toLowerCase()));}
function hierarchyIds(spec){return new Set((spec.layout?.information_hierarchy||[]).map(x=>String(x.id||'').toLowerCase()));}
function supports(spec,role){
  const ids=new Set([...componentIds(spec),...hierarchyIds(spec)]);
  const hints={
    offer:['services','categories','featured','product-proof','task-preview','product','feature-grid'],
    proof:['proof','security','trust-strip','testimonials','case-study','product-proof','outcomes'],
    process:['process','workflow','how-it-works','schedule'],gallery:['gallery','selected-work','latest-content'],
    faq:['faq'],pricing:['pricing','transaction','booking'],integrations:['integrations'],contact:['contact','location','final-cta']
  }[role]||[];
  return hints.some(id=>ids.has(id));
}
function preferredSections(spec){
  const software=supports(spec,'integrations');
  const preferred=software?['proof','process','integrations','pricing','faq','offer','contact','gallery']:['offer','gallery','process','faq','pricing','contact','proof','integrations'];
  const out=[];
  for(const role of preferred)if(supports(spec,role)&&!out.includes(role))out.push(role);
  for(const role of ['offer','proof','process','gallery','faq','pricing','integrations','contact'])if(!out.includes(role))out.push(role);
  return out.slice(0,4);
}
function keywordSet(spec){return new Set((spec.direction?.keywords||[]).map(x=>String(x).toLowerCase()));}

export function deriveNativeDirectionPlan(designSpec){
  if(designSpec?.schema!=='WebUIDesignSpec/v1')throw new Error('WebUIDesignSpec/v1 required');
  const grid=String(designSpec.layout?.grid||'').toLowerCase(),keywords=keywordSet(designSpec);
  const editorial=grid.includes('editorial')||keywords.has('editorial'),application=grid.includes('application')||keywords.has('application');
  const imageLed=keywords.has('image-led')||keywords.has('botanical');
  const density=['airy','balanced','dense'].includes(designSpec.layout?.density)?designSpec.layout.density:'balanced';
  const sections=preferredSections(designSpec),hasTransaction=(designSpec.layout?.information_hierarchy||[]).some(x=>x.id==='transaction'||x.purpose==='transact');  const plan={
    archetype:editorial?'editorial':application?'split':'grid',hero:imageLed?'media-led':application?'split':'text-led',density,
    rhythm:editorial?'alternating':application?'rail':'stacked',section_1:sections[0],section_2:sections[1],section_3:sections[2],section_4:sections[3],
    cta:hasTransaction?'transact':supports(designSpec,'contact')?'contact':'explore',palette:keywords.has('warm')||keywords.has('warmth')?'warm':application?'neutral':'contrast',
    shape:editorial?'soft':application?'sharp':'soft',nav:application?'compact':'balanced'
  };
  const checked=validateDesignDirectionPlan(plan);if(checked.status!=='PASS')throw new Error(`native direction invalid: ${checked.reason}`);return checked.plan;
}

export function deriveContrastDirectionPlan(nativePlan){
  const alt={
    archetype:{editorial:'showcase',split:'grid',grid:'showcase',showcase:'editorial'},hero:{'media-led':'text-led',split:'media-led','text-led':'split'},
    density:{airy:'balanced',balanced:'airy',dense:'balanced'},rhythm:{alternating:'mosaic',rail:'stacked',stacked:'alternating',mosaic:'rail'},
    palette:{warm:'contrast',neutral:'cool',cool:'contrast',contrast:'warm'},shape:{soft:'sharp',sharp:'pill',pill:'soft'},
    nav:{balanced:'prominent',compact:'balanced',prominent:'compact'}
  };
  const sections=[nativePlan.section_1,nativePlan.section_2,nativePlan.section_3,nativePlan.section_4],rotated=[sections[2],sections[0],sections[3],sections[1]];
  const plan={...nativePlan,archetype:alt.archetype[nativePlan.archetype]||'showcase',hero:alt.hero[nativePlan.hero]||'split',density:alt.density[nativePlan.density]||'balanced',rhythm:alt.rhythm[nativePlan.rhythm]||'mosaic',section_1:rotated[0],section_2:rotated[1],section_3:rotated[2],section_4:rotated[3],palette:alt.palette[nativePlan.palette]||'contrast',shape:alt.shape[nativePlan.shape]||'sharp',nav:alt.nav[nativePlan.nav]||'prominent'};
  const checked=validateDesignDirectionPlan(plan);if(checked.status!=='PASS')throw new Error(`contrast direction invalid: ${checked.reason}`);return checked.plan;
}

const SIMPLE_WEIGHTS={archetype:.16,hero:.12,density:.08,rhythm:.12,cta:.05,palette:.08,shape:.06,nav:.05};
export function directionDistance(a,b){
  let score=0;for(const [key,weight] of Object.entries(SIMPLE_WEIGHTS))if(a?.[key]!==b?.[key])score+=weight;
  const sections=['section_1','section_2','section_3','section_4'];score+=.28*sections.filter(key=>a?.[key]!==b?.[key]).length/sections.length;
  return Number(clamp(score).toFixed(3));
}