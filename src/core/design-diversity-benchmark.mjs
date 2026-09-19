import { compose } from './compose.mjs';

const round=(n,d=3)=>Number(n.toFixed(d));
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const uniqueRate=xs=>xs.length?new Set(xs).size/xs.length:0;
const pairs=xs=>{const out=[];for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++)out.push([xs[i],xs[j]]);return out;};

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

export function sequenceDistance(a,b){
  const denom=Math.max(a.length,b.length,1);
  return 1-lcsLength(a,b)/denom;
}

function pairwiseDistance(items,selector){
  return avg(pairs(items).map(([a,b])=>sequenceDistance(selector(a),selector(b))));
}
function hexToRgb(hex){
  const s=String(hex||'').replace('#','');
  if(!/^[0-9a-f]{6}$/i.test(s))return [0,0,0];
  return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16));
}

function rgbDistance(a,b){
  const x=hexToRgb(a),y=hexToRgb(b);
  return Math.sqrt(x.reduce((sum,v,i)=>sum+(v-y[i])**2,0))/Math.sqrt(3*255**2);
}

function paletteDistance(a,b){
  const ta=a.designStrategy.color_strategy.tokens,tb=b.designStrategy.color_strategy.tokens;
  return avg(['background','accent','accent2'].map(k=>rgbDistance(ta[k],tb[k])));
}

function palettePairwiseDistance(plans){
  return avg(pairs(plans).map(([a,b])=>paletteDistance(a,b)));
}
function relativeLuminance(hex){
  const rgb=hexToRgb(hex).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function contrastRatio(a,b){const x=relativeLuminance(a),y=relativeLuminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function accentContrastPass(plan){
  const t=plan.designStrategy.color_strategy.tokens;
  return contrastRatio(t.accent,t.accentText)>=4.5;
}

function exactObjectEqual(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function artTokenSubset(plan){
  const expected=plan.designStrategy.color_strategy.tokens,theme=plan.visual.artDirection.theme;
  return Object.entries(expected).every(([k,v])=>theme[k]===v);
}

function coherenceScore(plan){
  const s=plan.designStrategy,checks=[
    plan.layout.nav===s.navigation_model.pattern,
    exactObjectEqual(plan.brand.style.colorTokens,s.color_strategy.tokens),
    artTokenSubset(plan),
    plan.brand.style.typography===s.typography_strategy.character,
    plan.designDNA.typography.character===s.typography_strategy.character,
    plan.designDNA.density===s.visual_density,
    plan.designDNA.media.treatment===s.media_strategy.treatment
  ];
  return checks.filter(Boolean).length/checks.length;
}
export const DESIGN_DIVERSITY_THRESHOLDS={
  navigationUniqueRate:0.75,
  navigationDistance:0.5,
  pageArchitectureUniqueRate:0.75,
  pageArchitectureDistance:0.5,
  layoutUniqueRate:0.75,
  layoutFingerprintDistance:0.5,
  sectionOrderDistance:0.4,
  paletteUniqueRate:0.65,
  paletteTokenDistance:0.18,
  brandCoherence:0.98,
  accentContrastCompliance:1
};

function sampleOf(entry,plan){
  const s=plan.designStrategy;
  return {
    id:entry.id,brief:entry.brief,domain:plan.project.domainArchetype,archetype:plan.project.archetype,
    navigation:s.navigation_model.items.map(x=>x.id),
    pageHierarchy:s.page_hierarchy.map(x=>x.id),
    siteBlueprint:plan.siteBlueprint.pages.filter(x=>!x.dynamic).map(x=>x.id),
    layoutSections:plan.layout.sections,
    layoutTokens:plan.layout.sectionPlan.map(x=>`${x.id}:${x.variant}`),
    layoutStrategy:s.layout_strategy,
    color:{mode:s.color_strategy.mode,temperature:s.color_strategy.temperature,...s.color_strategy.tokens,accentTextContrast:s.color_strategy.accessibility?.accentTextContrast},
    typography:s.typography_strategy.character,
    coherence:round(coherenceScore(plan))
  };
}
export function runDesignDiversityBenchmark(entries,thresholds=DESIGN_DIVERSITY_THRESHOLDS){
  const plans=entries.map(entry=>compose(entry.brief));
  const samples=entries.map((entry,i)=>sampleOf(entry,plans[i]));
  const navFingerprints=samples.map(x=>x.navigation.join('>'));
  const pageFingerprints=samples.map(x=>x.pageHierarchy.join('>'));
  const layoutFingerprints=plans.map(x=>x.layout.fingerprint);
  const paletteFingerprints=samples.map(x=>[x.color.mode,x.color.temperature,x.color.background,x.color.accent,x.color.accent2].join('|'));
  const metrics={
    sampleCount:samples.length,
    navigationUniqueRate:round(uniqueRate(navFingerprints)),
    navigationDistance:round(pairwiseDistance(samples,x=>x.navigation)),
    pageArchitectureUniqueRate:round(uniqueRate(pageFingerprints)),
    pageArchitectureDistance:round(pairwiseDistance(samples,x=>x.pageHierarchy)),
    layoutUniqueRate:round(uniqueRate(layoutFingerprints)),
    layoutFingerprintDistance:round(pairwiseDistance(samples,x=>x.layoutTokens)),
    sectionOrderDistance:round(pairwiseDistance(samples,x=>x.layoutSections)),
    paletteUniqueRate:round(uniqueRate(paletteFingerprints)),
    paletteTokenDistance:round(palettePairwiseDistance(plans)),
    brandCoherence:round(avg(plans.map(coherenceScore))),
    accentContrastCompliance:round(plans.filter(accentContrastPass).length/Math.max(plans.length,1))
  };
  const gates=Object.entries(thresholds).map(([metric,min])=>({metric,min,actual:metrics[metric],status:metrics[metric]>=min?'PASS':'FAIL'}));
  return {
    schema:'webforge.design-diversity-benchmark.v1',
    dataset:{count:entries.length,ids:entries.map(x=>x.id)},
    thresholds:{...thresholds},metrics,gates,
    status:gates.every(x=>x.status==='PASS')?'PASS':'FAIL',
    dimensions:{
      navigationPatterns:[...new Set(plans.map(x=>x.designStrategy.navigation_model.pattern))].sort(),
      layoutStrategies:[...new Set(plans.map(x=>x.designStrategy.layout_strategy.primary))].sort(),
      colorTemperatures:[...new Set(plans.map(x=>x.designStrategy.color_strategy.temperature))].sort(),
      typographyStrategies:[...new Set(plans.map(x=>x.designStrategy.typography_strategy.character))].sort()
    },
    samples
  };
}
