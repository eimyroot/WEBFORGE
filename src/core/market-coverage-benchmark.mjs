import {compose} from './compose.mjs';

const round=(n,d=3)=>Number(n.toFixed(d));
const rate=xs=>xs.length?xs.filter(Boolean).length/xs.length:1;
const fingerprint=xs=>xs.join('>');
const knownEntry=e=>e.expectedClassification!=='NOVEL';

export const MARKET_COVERAGE_THRESHOLDS={
  knownResolutionRate:1,
  domainAccuracy:1,
  semanticFitRate:1,
  metadataResolutionRate:1,
  directionSourceRate:1,
  novelPreservationRate:1,
  expectedDomainCoverage:20,
  profileCoverage:20,
  crossDomainLayoutCollisionRate:.05,
  crossDomainSpatialCollisionRate:.05,
  crossDomainRendererCollisionRate:.08,
  crossDomainConversionCollisionRate:.08
};

function semanticChecks(entry,plan){
  const sections=new Set(plan.layout.sections),flow=new Set(plan.layout.conversionFlow||[]),checks=[];
  checks.push({check:'domain',pass:plan.project.domainArchetype===entry.expectedDomain,expected:entry.expectedDomain,actual:plan.project.domainArchetype});
  if(entry.expectedClassification) checks.push({check:'classification',pass:plan.domain.classification===entry.expectedClassification,expected:entry.expectedClassification,actual:plan.domain.classification});
  else checks.push({check:'known-resolution',pass:plan.domain.classification!=='NOVEL',expected:'KNOWN_OR_HYBRID',actual:plan.domain.classification});
  if(entry.expectedProfile) checks.push({check:'profile',pass:plan.layout.compositionProfile===entry.expectedProfile,expected:entry.expectedProfile,actual:plan.layout.compositionProfile});
  for(const id of entry.requiredSections||[]) checks.push({check:`section:${id}`,pass:sections.has(id),expected:'present',actual:sections.has(id)?'present':'missing'});
  for(const id of entry.forbiddenSections||[]) checks.push({check:`forbidden:${id}`,pass:!sections.has(id),expected:'absent',actual:sections.has(id)?'present':'absent'});
  for(const id of entry.flowIncludes||[]) checks.push({check:`flow:${id}`,pass:flow.has(id),expected:'present',actual:flow.has(id)?'present':'missing'});
  if(entry.minMedia!=null) checks.push({check:'media-intensity',pass:plan.domain.genome.mediaIntensity>=entry.minMedia,expected:`>=${entry.minMedia}`,actual:plan.domain.genome.mediaIntensity});
  return checks;
}

function sample(entry,plan){
  const checks=semanticChecks(entry,plan);
  const metadataResolved=plan.visual.sections.every(s=>s.template&&s.rendererKey&&typeof s.selectionScore==='number'&&s.selectionReason);
  const expectedDirection=knownEntry(entry)?'brief-composition-profile':'novel-brief-synthesis';
  return {
    id:entry.id,market:entry.market,expectedDomain:entry.expectedDomain,
    domain:plan.project.domainArchetype,classification:plan.domain.classification,
    profile:plan.layout.compositionProfile,family:plan.layout.family,
    sections:plan.layout.sections,conversionFlow:plan.layout.conversionFlow||[],mediaIntensity:plan.domain.genome.mediaIntensity,
    directionSource:plan.layout.directionSource,expectedDirection,
    layoutFingerprint:plan.layout.fingerprint,spatialFingerprint:plan.visual.spatial.fingerprint,
    rendererFingerprint:fingerprint(plan.visual.sections.map(s=>s.rendererKey)),
    conversionFingerprint:fingerprint(plan.layout.conversionFlow||[]),metadataResolved:Boolean(metadataResolved),
    semanticPass:checks.every(x=>x.pass),semanticIssues:checks.filter(x=>!x.pass)
  };
}

function collisionRate(samples,key){
  let pairs=0,collisions=0;
  for(let i=0;i<samples.length;i++) for(let j=i+1;j<samples.length;j++){
    if(samples[i].expectedDomain===samples[j].expectedDomain) continue;
    pairs++; if(samples[i][key]===samples[j][key]) collisions++;
  }
  return round(collisions/Math.max(pairs,1));
}
export function runMarketCoverageBenchmark(entries,thresholds=MARKET_COVERAGE_THRESHOLDS){
  const samples=entries.map(entry=>sample(entry,compose(entry.brief)));
  const known=samples.filter((_,i)=>knownEntry(entries[i])),novel=samples.filter((_,i)=>!knownEntry(entries[i]));
  const metrics={
    sampleCount:samples.length,
    knownResolutionRate:round(rate(known.map(x=>x.classification!=='NOVEL'))),
    domainAccuracy:round(rate(samples.map((x,i)=>x.domain===entries[i].expectedDomain))),
    semanticFitRate:round(rate(samples.map(x=>x.semanticPass))),
    metadataResolutionRate:round(rate(samples.map(x=>x.metadataResolved))),
    directionSourceRate:round(rate(samples.map(x=>x.directionSource===x.expectedDirection))),
    novelPreservationRate:round(rate(novel.map(x=>x.classification==='NOVEL'))),
    expectedDomainCoverage:new Set(entries.filter(knownEntry).map(x=>x.expectedDomain)).size,
    profileCoverage:new Set(known.map(x=>x.profile)).size,
    crossDomainLayoutCollisionRate:collisionRate(known,'layoutFingerprint'),
    crossDomainSpatialCollisionRate:collisionRate(known,'spatialFingerprint'),
    crossDomainRendererCollisionRate:collisionRate(known,'rendererFingerprint'),
    crossDomainConversionCollisionRate:collisionRate(known,'conversionFingerprint')
  };
  const minimums=['knownResolutionRate','domainAccuracy','semanticFitRate','metadataResolutionRate','directionSourceRate','novelPreservationRate','expectedDomainCoverage','profileCoverage'];
  const maximums=['crossDomainLayoutCollisionRate','crossDomainSpatialCollisionRate','crossDomainRendererCollisionRate','crossDomainConversionCollisionRate'];
  const gates=[
    ...minimums.map(metric=>({metric,min:thresholds[metric],actual:metrics[metric],status:metrics[metric]>=thresholds[metric]?'PASS':'FAIL'})),
    ...maximums.map(metric=>({metric,max:thresholds[metric],actual:metrics[metric],status:metrics[metric]<=thresholds[metric]?'PASS':'FAIL'}))
  ];
  return {
    schema:'webforge.market-coverage-benchmark.v1',
    dataset:{count:entries.length,ids:entries.map(x=>x.id),markets:[...new Set(entries.map(x=>x.market))].sort()},
    thresholds:{...thresholds},metrics,gates,status:gates.every(x=>x.status==='PASS')?'PASS':'FAIL',
    failures:samples.filter(x=>!x.semanticPass||!x.metadataResolved||x.directionSource!==x.expectedDirection),samples
  };
}
