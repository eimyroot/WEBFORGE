import {visualSignatureDistance} from './rendered-diversity.mjs';

const round=(n,d=4)=>Number(n.toFixed(d));
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const pairs=xs=>{const out=[];for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++)out.push([xs[i],xs[j]]);return out;};
const rate=(xs,predicate)=>xs.length?xs.filter(predicate).length/xs.length:0;

export const MARKET_VISUAL_CASE_IDS=[
  'luxury-hotel','florist','electronics-store','vintage-marketplace','api-monitoring',
  'logistics-dashboard','civic-portal','university','dentist','fintech-app',
  'law-firm','robotics-manufacturer','real-estate-agency','remote-job-board','climate-nonprofit',
  'makerspace','news-magazine','digital-exhibition','techno-club','future-promises'
];

export const MARKET_VISUAL_THRESHOLDS={
  sampleCount:20,domainCoverage:20,profileCoverage:18,
  wideBrowserPassRate:1,mobileBrowserPassRate:1,
  wideAccessibilityPassRate:1,mobileAccessibilityPassRate:1,
  wideResponsivePassRate:1,mobileResponsivePassRate:1,
  widePerformancePassRate:1,mobilePerformancePassRate:1,
  wideDeterministicPassRate:1,mobileDeterministicPassRate:1,
  wideViewportPassRate:1,mobileViewportPassRate:1,
  wideScreenshotUniqueRate:1,mobileScreenshotUniqueRate:1,
  widePerceptualDistance:.06,mobilePerceptualDistance:.05,
  wideMinimumPairDistance:.015,mobileMinimumPairDistance:.015,
  crossViewportAdaptationRate:1,structureCollisionRate:.02
};
function viewMetrics(samples,key,width){
  const views=samples.map(x=>x.viewports[key]);
  const distances=pairs(views).map(([a,b])=>visualSignatureDistance(a.signature,b.signature));
  return {
    [`${key}BrowserPassRate`]:round(rate(views,x=>x.browserPass)),
    [`${key}AccessibilityPassRate`]:round(rate(views,x=>x.accessibilityPass)),
    [`${key}ResponsivePassRate`]:round(rate(views,x=>x.responsivePass)),
    [`${key}PerformancePassRate`]:round(rate(views,x=>x.performancePass)),
    [`${key}DeterministicPassRate`]:round(rate(views,x=>x.deterministicPass)),
    [`${key}ViewportPassRate`]:round(rate(views,x=>x.viewport?.width===width)),
    [`${key}ScreenshotUniqueRate`]:round(new Set(views.map(x=>x.screenshotSha256)).size/Math.max(views.length,1)),
    [`${key}PerceptualDistance`]:round(avg(distances)),
    [`${key}MinimumPairDistance`]:round(distances.length?Math.min(...distances):0)
  };
}

function structureCollisionRate(samples){
  const ps=pairs(samples);let collisions=0,eligible=0;
  for(const [a,b] of ps){
    if(a.domain===b.domain&&a.profile===b.profile)continue;
    eligible++;
    const af=[a.layoutFingerprint,a.spatialFingerprint,a.rendererFingerprint,a.flowFingerprint].join('||');
    const bf=[b.layoutFingerprint,b.spatialFingerprint,b.rendererFingerprint,b.flowFingerprint].join('||');
    if(af===bf)collisions++;
  }
  return eligible?collisions/eligible:0;
}
export function evaluateMarketVisualBenchmark(samples,thresholds=MARKET_VISUAL_THRESHOLDS){
  const metrics={
    sampleCount:samples.length,
    domainCoverage:new Set(samples.map(x=>x.domain)).size,
    profileCoverage:new Set(samples.map(x=>x.profile)).size,
    ...viewMetrics(samples,'wide',1440),
    ...viewMetrics(samples,'mobile',390),
    crossViewportAdaptationRate:round(rate(samples,x=>visualSignatureDistance(x.viewports.wide.signature,x.viewports.mobile.signature)>=.02)),
    structureCollisionRate:round(structureCollisionRate(samples))
  };
  const maxMetrics=new Set(['structureCollisionRate']);
  const gates=Object.entries(thresholds).map(([metric,limit])=>({
    metric,[maxMetrics.has(metric)?'max':'min']:limit,actual:metrics[metric],
    status:maxMetrics.has(metric)?(metrics[metric]<=limit?'PASS':'FAIL'):(metrics[metric]>=limit?'PASS':'FAIL')
  }));
  const closest={};
  for(const key of ['wide','mobile']){
    closest[key]=pairs(samples).map(([a,b])=>({a:a.id,b:b.id,d:round(visualSignatureDistance(a.viewports[key].signature,b.viewports[key].signature))})).sort((a,b)=>a.d-b.d).slice(0,8);
  }
  return {
    schema:'webforge.market-visual-benchmark.v1',status:gates.every(x=>x.status==='PASS')?'PASS':'FAIL',
    thresholds:{...thresholds},metrics,gates,closestPairs:closest,
    samples:samples.map(x=>({...x,viewports:Object.fromEntries(Object.entries(x.viewports).map(([k,v])=>[k,{...v,signature:undefined}]))}))
  };
}
