import {compose} from './compose.mjs';
import {renderWebsite,renderBlueprintPage} from './visual-renderer.mjs';
import {STRUCTURAL_PLAYGROUND_BASELINES} from './structural-diversity-baseline.mjs';

const round=(n,d=3)=>Number(n.toFixed(d));
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const pairs=xs=>{const out=[];for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++)out.push([xs[i],xs[j]]);return out;};
const uniqueRate=xs=>xs.length?new Set(xs).size/xs.length:0;
const maxShare=xs=>{if(!xs.length)return 0;const counts=new Map();for(const x of xs)counts.set(x,(counts.get(x)||0)+1);return Math.max(...counts.values())/xs.length;};

function lcsLength(a,b){
  const dp=Array(b.length+1).fill(0);
  for(const x of a){
    let prev=0;
    for(let j=1;j<=b.length;j++){
      const old=dp[j];
      dp[j]=x===b[j-1]?prev+1:Math.max(dp[j],dp[j-1]);
      prev=old;
    }
  }
  return dp[b.length];
}
export function structuralSequenceDistance(a,b){return 1-lcsLength(a,b)/Math.max(a.length,b.length,1);}

function attr(tag,name){
  const safe=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return String(tag||'').match(new RegExp(`\\b${safe}="([^"]*)"`))?.[1]||'';
}
function startTags(html,name){return [...String(html).matchAll(new RegExp(`<${name}\\b[^>]*>`,'g'))].map(m=>m[0]);}
function rootTag(html){return String(html).match(/<html\b[^>]*>/)?.[0]||'';}
function mainTag(html){return String(html).match(/<main\b[^>]*>/)?.[0]||'';}
function classTokens(tag){return attr(tag,'class').split(/\s+/).filter(Boolean);}
function templateToken(tag){return classTokens(tag).find(x=>x.startsWith('template-'))?.slice('template-'.length)||'';}
function templateFamily(tag){return templateToken(tag).split('.')[0]||'';}
function normalizeHref(href=''){
  const value=String(href).trim();
  if(!value)return '';
  if(value.startsWith('#'))return value;
  const clean=value.replace(/^\.\//,'/').replace(/^\.\.\//g,'/').replace(/\/+$/,'');
  return clean||'/';
}
function navTargets(html){
  const nav=String(html).match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
  return [...nav.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map(m=>normalizeHref(m[1]));
}
function ctaPattern(html){
  const out=[];
  for(const m of String(html).matchAll(/<a\b([^>]*)href="([^"]+)"([^>]*)>/g)){
    const tag=`<a ${m[1]} href="${m[2]}" ${m[3]}>`,classes=classTokens(tag);
    const header=classes.includes('header-cta'),primary=classes.includes('primary')&&classes.includes('button');
    if(header||primary)out.push(`${header?'header':'primary'}:${normalizeHref(m[2])}`);
  }
  return out;
}
function sectionShape(html){
  return startTags(html,'section').map(tag=>({
    id:attr(tag,'id'),
    role:attr(tag,'data-role'),
    layout:attr(tag,'data-layout'),
    geometry:attr(tag,'data-spatial-geometry'),
    template:templateToken(tag),
    templateFamily:templateFamily(tag)
  }));
}
function zoneKinds(html){return startTags(html,'div').filter(tag=>classTokens(tag).includes('composition-zone')).map(tag=>attr(tag,'data-zone-kind')).filter(Boolean);}

function renderedPageGraph(plan,visual){
  return (plan.siteBlueprint?.pages||[]).filter(page=>!page.dynamic).map(page=>{
    const html=renderBlueprintPage(plan,visual,page),main=mainTag(html),sections=sectionShape(html);
    return [attr(main,'data-family')||page.family||'overview',attr(main,'data-detail-kind')||page.detailKind||'',...sections.map(x=>`${x.id}:${x.geometry||x.layout||x.templateFamily}`)].join('|');
  });
}
export function captureStructuralSample(entry){
  const plan=compose(entry.brief),html=renderWebsite(plan,plan.visual,`structural-${entry.id}`),root=rootTag(html),sections=sectionShape(html);
  const sample={
    id:entry.id,brief:entry.brief,domain:plan.project.domainArchetype,
    root:{
      layoutTemplate:attr(root,'data-template'),canvas:attr(root,'data-canvas'),layoutStrategy:attr(root,'data-strategy'),
      heroArchetype:attr(root,'data-hero-strategy'),navigationModel:attr(root,'data-nav-model')
    },
    homepage:{
      sectionSequence:sections.map(x=>x.id).filter(Boolean),roleSequence:sections.map(x=>x.role).filter(Boolean),
      geometrySequence:sections.map(x=>x.geometry).filter(Boolean),layoutSequence:sections.map(x=>x.layout).filter(Boolean),
      templateFamilies:sections.map(x=>x.templateFamily).filter(Boolean),templateTokens:sections.map(x=>x.template).filter(Boolean),
      zoneKinds:zoneKinds(html),ctaPattern:ctaPattern(html),navigationTargets:navTargets(html)
    },
    pageGraph:renderedPageGraph(plan,plan.visual)
  };
  sample.structuralFingerprint=JSON.stringify({root:sample.root,homepage:sample.homepage,pageGraph:sample.pageGraph});
  return sample;
}

export const STRUCTURAL_DIVERSITY_THRESHOLDS={
  structuralSignatureUniqueRate:1,
  minimumCompositeDistance:0.48,
  minimumSectionSequenceDistance:0.28,
  minimumGeometrySequenceDistance:0.4,
  minimumRoleSequenceDistance:0.3,
  minimumTemplateFamilyDistance:0.28,
  minimumZoneSequenceDistance:0.2,
  minimumPageGraphDistance:0.65,
  ctaPatternUniqueRate:0.25,
  maximumLayoutTemplateShare:0.5,
  maximumHeroArchetypeShare:0.5,
  maximumNavigationModelShare:0.5,
  maximumLayoutStrategyShare:0.5
};

export function compareStructuralSamples(a,b){
  const d={
    sectionSequenceDistance:structuralSequenceDistance(a.homepage.sectionSequence,b.homepage.sectionSequence),
    geometrySequenceDistance:structuralSequenceDistance(a.homepage.geometrySequence,b.homepage.geometrySequence),
    roleSequenceDistance:structuralSequenceDistance(a.homepage.roleSequence,b.homepage.roleSequence),
    templateFamilyDistance:structuralSequenceDistance(a.homepage.templateFamilies,b.homepage.templateFamilies),
    zoneSequenceDistance:structuralSequenceDistance(a.homepage.zoneKinds,b.homepage.zoneKinds),
    ctaPatternDistance:structuralSequenceDistance(a.homepage.ctaPattern,b.homepage.ctaPattern),
    pageGraphDistance:structuralSequenceDistance(a.pageGraph,b.pageGraph),
    heroDifference:a.root.heroArchetype===b.root.heroArchetype?0:1,
    navigationDifference:a.root.navigationModel===b.root.navigationModel?0:1,
    layoutStrategyDifference:a.root.layoutStrategy===b.root.layoutStrategy?0:1,
    canvasDifference:a.root.canvas===b.root.canvas?0:1
  };
  d.compositeDistance=
    .22*d.sectionSequenceDistance+.22*d.geometrySequenceDistance+.10*d.roleSequenceDistance+
    .10*d.templateFamilyDistance+.08*d.zoneSequenceDistance+.05*d.ctaPatternDistance+
    .13*d.pageGraphDistance+.04*d.heroDifference+.02*d.navigationDifference+
    .02*d.layoutStrategyDifference+.02*d.canvasDifference;
  return Object.fromEntries(Object.entries(d).map(([k,v])=>[k,round(v)]));
}
function minimum(rows,key){return rows.length?Math.min(...rows.map(x=>x[key])):0;}
function metricGate(metric,actual,threshold,kind='min'){
  const status=kind==='max'?actual<=threshold:actual>=threshold;
  return {metric,[kind]:threshold,actual,status:status?'PASS':'FAIL'};
}



export const STRUCTURAL_PLAYGROUND_THRESHOLDS={
  hardCollision:STRUCTURAL_DIVERSITY_THRESHOLDS.minimumCompositeDistance,
  warningCollision:0.58,
  minimumCoreViolationsForHard:2
};
export const STRUCTURAL_COLLISION_DIMENSIONS={
  core:[
    ['sectionSequenceDistance','minimumSectionSequenceDistance'],
    ['geometrySequenceDistance','minimumGeometrySequenceDistance'],
    ['roleSequenceDistance','minimumRoleSequenceDistance'],
    ['templateFamilyDistance','minimumTemplateFamilyDistance'],
    ['pageGraphDistance','minimumPageGraphDistance']
  ],
  auxiliary:[['zoneSequenceDistance','minimumZoneSequenceDistance']]
};

function violatedDimensions(distance,pairs,thresholds){
  return pairs.filter(([metric,threshold])=>distance[metric]<thresholds[threshold]).map(([metric])=>metric);
}
export function classifyStructuralCollision(distance,thresholds=STRUCTURAL_DIVERSITY_THRESHOLDS,{minimumCoreViolationsForHard=STRUCTURAL_PLAYGROUND_THRESHOLDS.minimumCoreViolationsForHard}={}){
  const coreViolations=violatedDimensions(distance,STRUCTURAL_COLLISION_DIMENSIONS.core,thresholds);
  const auxiliaryViolations=violatedDimensions(distance,STRUCTURAL_COLLISION_DIMENSIONS.auxiliary,thresholds);
  const compositeBelowHard=distance.compositeDistance<thresholds.minimumCompositeDistance;
  const hard=compositeBelowHard&&coreViolations.length>=minimumCoreViolationsForHard;
  const warning=!hard&&(compositeBelowHard||coreViolations.length>0||auxiliaryViolations.length>0);
  return {
    severity:hard?'FAIL':warning?'WARN':'PASS',hard,warning,compositeBelowHard,
    minimumCoreViolationsForHard,coreViolationCount:coreViolations.length,
    coreViolations,auxiliaryViolations
  };
}

export function structuralPairViolates(distance,thresholds=STRUCTURAL_DIVERSITY_THRESHOLDS){
  return distance.compositeDistance<thresholds.minimumCompositeDistance||distance.sectionSequenceDistance<thresholds.minimumSectionSequenceDistance||
    distance.geometrySequenceDistance<thresholds.minimumGeometrySequenceDistance||distance.roleSequenceDistance<thresholds.minimumRoleSequenceDistance||
    distance.templateFamilyDistance<thresholds.minimumTemplateFamilyDistance||distance.zoneSequenceDistance<thresholds.minimumZoneSequenceDistance||
    distance.pageGraphDistance<thresholds.minimumPageGraphDistance;
}

export function evaluateStructuralPlaygroundSamples(candidate,baselineSamples,{warningCollision=STRUCTURAL_PLAYGROUND_THRESHOLDS.warningCollision}={}){
  if(!candidate||!Array.isArray(baselineSamples)||baselineSamples.length===0) throw new Error('Structural playground requires candidate and baseline samples');
  const comparisons=baselineSamples.map(base=>{
    const distance=compareStructuralSamples(candidate,base);
    return {id:base.id,domain:base.domain,...distance,collision:classifyStructuralCollision(distance)};
  }).sort((a,b)=>a.compositeDistance-b.compositeDistance);
  const crossDomain=comparisons.filter(x=>x.domain!==candidate.domain);
  const hardCollisions=crossDomain.filter(x=>x.collision.hard);
  const warningCollisions=crossDomain.filter(x=>x.collision.warning);
  const nearest=comparisons[0];
  const status=hardCollisions.length?'FAIL':warningCollisions.length||nearest.compositeDistance<warningCollision?'WARN':'PASS';
  return {
    schema:'webforge.structural-playground-evaluation.r1',status,source:'rendered-dom-and-page-graph',
    candidate:{id:candidate.id,domain:candidate.domain,root:candidate.root,homepage:candidate.homepage,pageGraph:candidate.pageGraph},
    thresholds:{
      hardCompositeCollision:STRUCTURAL_PLAYGROUND_THRESHOLDS.hardCollision,
      minimumCoreViolationsForHard:STRUCTURAL_PLAYGROUND_THRESHOLDS.minimumCoreViolationsForHard,
      coreCollisionDimensions:STRUCTURAL_COLLISION_DIMENSIONS.core.map(([metric])=>metric),
      auxiliaryCollisionDimensions:STRUCTURAL_COLLISION_DIMENSIONS.auxiliary.map(([metric])=>metric),
      releaseDimensions:{...STRUCTURAL_DIVERSITY_THRESHOLDS},warningCollision
    },
    nearest:comparisons.slice(0,3),hardCollisions:hardCollisions.slice(0,3),warningCollisions:warningCollisions.slice(0,3),baselineCount:baselineSamples.length
  };
}
export function evaluateStructuralPlaygroundBrief(brief,baselines=STRUCTURAL_PLAYGROUND_BASELINES){
  if(typeof brief!=='string'||brief.trim().length<8) throw new Error('Brief must contain at least 8 characters');
  const candidate=captureStructuralSample({id:'playground-candidate',brief});
  const baselineSamples=baselines.map(captureStructuralSample);
  return evaluateStructuralPlaygroundSamples(candidate,baselineSamples);
}

export function runStructuralDiversityBenchmark(entries,thresholds=STRUCTURAL_DIVERSITY_THRESHOLDS){
  const samples=entries.map(captureStructuralSample);
  const pairwise=pairs(samples).map(([a,b])=>({pair:[a.id,b.id],...compareStructuralSamples(a,b)}));
  const metrics={
    sampleCount:samples.length,
    structuralSignatureUniqueRate:round(uniqueRate(samples.map(x=>x.structuralFingerprint))),
    minimumCompositeDistance:round(minimum(pairwise,'compositeDistance')),
    averageCompositeDistance:round(avg(pairwise.map(x=>x.compositeDistance))),
    minimumSectionSequenceDistance:round(minimum(pairwise,'sectionSequenceDistance')),
    minimumGeometrySequenceDistance:round(minimum(pairwise,'geometrySequenceDistance')),
    minimumRoleSequenceDistance:round(minimum(pairwise,'roleSequenceDistance')),
    minimumTemplateFamilyDistance:round(minimum(pairwise,'templateFamilyDistance')),
    minimumZoneSequenceDistance:round(minimum(pairwise,'zoneSequenceDistance')),
    minimumPageGraphDistance:round(minimum(pairwise,'pageGraphDistance')),
    ctaPatternUniqueRate:round(uniqueRate(samples.map(x=>x.homepage.ctaPattern.join('>')))),
    maximumLayoutTemplateShare:round(maxShare(samples.map(x=>x.root.layoutTemplate))),
    maximumHeroArchetypeShare:round(maxShare(samples.map(x=>x.root.heroArchetype))),
    maximumNavigationModelShare:round(maxShare(samples.map(x=>x.root.navigationModel))),
    maximumLayoutStrategyShare:round(maxShare(samples.map(x=>x.root.layoutStrategy)))
  };
  const minKeys=['structuralSignatureUniqueRate','minimumCompositeDistance','minimumSectionSequenceDistance','minimumGeometrySequenceDistance','minimumRoleSequenceDistance','minimumTemplateFamilyDistance','minimumZoneSequenceDistance','minimumPageGraphDistance','ctaPatternUniqueRate'];
  const maxKeys=['maximumLayoutTemplateShare','maximumHeroArchetypeShare','maximumNavigationModelShare','maximumLayoutStrategyShare'];
  const gates=[...minKeys.map(k=>metricGate(k,metrics[k],thresholds[k],'min')),...maxKeys.map(k=>metricGate(k,metrics[k],thresholds[k],'max'))];
  const violations=pairwise.filter(x=>structuralPairViolates(x,thresholds));
  return {
    schema:'webforge.structural-diversity-gate.r1',source:'rendered-dom-and-page-graph',dataset:{count:entries.length,ids:entries.map(x=>x.id)},
    thresholds:{...thresholds},metrics,gates,violations,
    status:gates.every(x=>x.status==='PASS')&&violations.length===0?'PASS':'FAIL',
    samples:samples.map(({structuralFingerprint,...sample})=>sample),pairwise
  };
}
