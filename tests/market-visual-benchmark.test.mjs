import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_VISUAL_CASE_IDS,
  MARKET_VISUAL_THRESHOLDS,
  evaluateMarketVisualBenchmark
} from '../src/core/market-visual-benchmark.mjs';

const dataset=JSON.parse(fs.readFileSync(new URL('./data/market-coverage-briefs.json',import.meta.url),'utf8'));
const ids=new Set(dataset.map(x=>x.id));

test('visual market matrix selects twenty traceable market cases',()=>{
  assert.equal(MARKET_VISUAL_CASE_IDS.length,20);
  assert.equal(new Set(MARKET_VISUAL_CASE_IDS).size,20);
  assert.ok(MARKET_VISUAL_CASE_IDS.every(id=>ids.has(id)));
  assert.equal(MARKET_VISUAL_THRESHOLDS.domainCoverage,20);
  assert.equal(MARKET_VISUAL_THRESHOLDS.wideScreenshotUniqueRate,1);
  assert.equal(MARKET_VISUAL_THRESHOLDS.mobileScreenshotUniqueRate,1);
});

function view(seed,width){
  const signature=Array.from({length:12*12*3},(_,i)=>((i+seed)%37)/37);
  return {viewport:{width},signature,screenshotSha256:`shot-${width}-${seed}`,browserPass:true,
    accessibilityPass:true,responsivePass:true,performancePass:true,deterministicPass:true};
}
test('visual evaluator fails closed on structural or screenshot collapse',()=>{
  const samples=MARKET_VISUAL_CASE_IDS.map((id,i)=>({
    id,domain:`domain-${i}`,profile:`profile-${i}`,
    layoutFingerprint:'same',spatialFingerprint:'same',rendererFingerprint:'same',flowFingerprint:'same',
    viewports:{wide:view(0,1440),mobile:view(0,390)}
  }));
  const report=evaluateMarketVisualBenchmark(samples);
  assert.equal(report.status,'FAIL');
  assert.equal(report.metrics.wideScreenshotUniqueRate,.05);
  assert.equal(report.metrics.mobileScreenshotUniqueRate,.05);
  assert.equal(report.metrics.structureCollisionRate,1);
  assert.ok(report.gates.some(x=>x.metric==='structureCollisionRate'&&x.status==='FAIL'));
});

test('visual evaluator keeps viewport and responsive checks explicit',()=>{
  const samples=MARKET_VISUAL_CASE_IDS.map((id,i)=>({
    id,domain:`domain-${i}`,profile:`profile-${i}`,
    layoutFingerprint:`layout-${i}`,spatialFingerprint:`space-${i}`,rendererFingerprint:`renderer-${i}`,flowFingerprint:`flow-${i}`,
    viewports:{wide:view(i+1,1440),mobile:view(i+101,390)}
  }));
  const report=evaluateMarketVisualBenchmark(samples,{...MARKET_VISUAL_THRESHOLDS,widePerceptualDistance:0,mobilePerceptualDistance:0,wideMinimumPairDistance:0,mobileMinimumPairDistance:0});
  assert.equal(report.metrics.wideViewportPassRate,1);
  assert.equal(report.metrics.mobileViewportPassRate,1);
  assert.equal(report.metrics.wideResponsivePassRate,1);
  assert.equal(report.metrics.mobileResponsivePassRate,1);
  assert.equal(report.metrics.structureCollisionRate,0);
});
