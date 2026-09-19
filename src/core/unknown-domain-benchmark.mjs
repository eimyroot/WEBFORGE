import {compose} from './compose.mjs';
const round=(n,d=3)=>Number(n.toFixed(d));
const rate=xs=>xs.length?new Set(xs).size/xs.length:0;
const GENERIC=/Untitled Web Product|Concept\b.*Participant\b.*Experience\b.*State\b|Find the right option and act with confidence|Purpose-built content slot|A organization \/ company experience synthesized/i;
export const UNKNOWN_DOMAIN_THRESHOLDS={subjectUniqueRate:.9,entityUniqueRate:.8,navigationUniqueRate:.7,layoutUniqueRate:.7,headlineUniqueRate:.85,directionUniqueRate:.35,genericLeakCount:0,exactStructureCollisionRate:.12};
function sample(entry,plan){
  const content=JSON.stringify(plan.visual?.content?.model||{}),entityFingerprint=plan.product.entities.map(x=>x.name).join('>'),nav=plan.designStrategy.navigation_model.items.map(x=>x.id).join('>');
  return {id:entry.id,classification:plan.domain.classification,subject:plan.domain.synthesis?.subject||null,direction:plan.domain.synthesis?.direction?.id||null,entities:plan.product.entities.map(x=>x.name),entityFingerprint,navigation:nav,layoutFingerprint:plan.layout.fingerprint,headline:plan.brand.content.headline,genericLeak:GENERIC.test(`${plan.brand.identity.name} ${plan.brand.content.headline} ${entityFingerprint} ${content}`)};
}
export function runUnknownDomainBenchmark(entries,thresholds=UNKNOWN_DOMAIN_THRESHOLDS){
  const samples=entries.map(entry=>sample(entry,compose(entry.brief)));
  const pairCount=samples.length*(samples.length-1)/2||1;let exact=0;
  for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++)if(samples[i].layoutFingerprint===samples[j].layoutFingerprint&&samples[i].navigation===samples[j].navigation)exact++;
  const metrics={sampleCount:samples.length,novelRate:round(samples.filter(x=>x.classification==='NOVEL').length/Math.max(samples.length,1)),subjectUniqueRate:round(rate(samples.map(x=>x.subject))),entityUniqueRate:round(rate(samples.map(x=>x.entityFingerprint))),navigationUniqueRate:round(rate(samples.map(x=>x.navigation))),layoutUniqueRate:round(rate(samples.map(x=>x.layoutFingerprint))),headlineUniqueRate:round(rate(samples.map(x=>x.headline))),directionUniqueRate:round(rate(samples.map(x=>x.direction))),genericLeakCount:samples.filter(x=>x.genericLeak).length,exactStructureCollisionRate:round(exact/pairCount)};
  const gates=[
    ...Object.entries(thresholds).filter(([k])=>!['genericLeakCount','exactStructureCollisionRate'].includes(k)).map(([metric,min])=>({metric,min,actual:metrics[metric],status:metrics[metric]>=min?'PASS':'FAIL'})),
    {metric:'genericLeakCount',max:thresholds.genericLeakCount,actual:metrics.genericLeakCount,status:metrics.genericLeakCount<=thresholds.genericLeakCount?'PASS':'FAIL'},
    {metric:'exactStructureCollisionRate',max:thresholds.exactStructureCollisionRate,actual:metrics.exactStructureCollisionRate,status:metrics.exactStructureCollisionRate<=thresholds.exactStructureCollisionRate?'PASS':'FAIL'},
    {metric:'novelRate',min:.9,actual:metrics.novelRate,status:metrics.novelRate>=.9?'PASS':'FAIL'}
  ];
  return {schema:'webforge.unknown-domain-benchmark.v1',dataset:{count:entries.length,ids:entries.map(x=>x.id)},thresholds,metrics,gates,status:gates.every(x=>x.status==='PASS')?'PASS':'FAIL',samples};
}
