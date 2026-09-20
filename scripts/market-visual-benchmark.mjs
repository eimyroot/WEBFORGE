import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compose} from '../src/core/compose.mjs';
import {renderWebsite,renderCss} from '../src/core/visual-renderer.mjs';
import {writeMediaAssets} from '../src/core/media-assets.mjs';
import {discoverChromium,runBrowserQa} from '../src/core/browser-qa.mjs';
import {pngVisualSignature} from '../src/core/rendered-diversity.mjs';
import {MARKET_VISUAL_CASE_IDS,evaluateMarketVisualBenchmark} from '../src/core/market-visual-benchmark.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const workspace=path.resolve(arg('--workspace')||'');
const output=path.resolve(arg('--output')||'');
if(!arg('--workspace')||!arg('--output'))throw new Error('--workspace and --output are required');
if(workspace===root||workspace.startsWith(root+path.sep))throw new Error('--workspace must be outside the repository root');
if(fs.existsSync(workspace))throw new Error(`Refusing to overwrite existing workspace: ${workspace}`);
if(fs.existsSync(output))throw new Error(`Refusing to overwrite existing report: ${output}`);
const browser=discoverChromium();
if(!browser){console.error('MARKET_VISUAL=UNVERIFIED: Chrome/Chromium required');process.exit(2)}
const dataset=JSON.parse(fs.readFileSync(path.join(root,'tests/data/market-coverage-briefs.json'),'utf8'));
const byId=new Map(dataset.map(x=>[x.id,x]));
const cases=MARKET_VISUAL_CASE_IDS.map(id=>byId.get(id));
if(cases.some(x=>!x))throw new Error(`Missing market visual cases: ${MARKET_VISUAL_CASE_IDS.filter(id=>!byId.has(id)).join(', ')}`);
fs.mkdirSync(workspace,{recursive:true});
const viewportDefs={wide:{width:1440,height:1200,mobile:false},mobile:{width:390,height:844,mobile:true}};
const samples=[];
for(const entry of cases){
  const plan=compose(entry.brief),caseDir=path.join(workspace,entry.id);
  fs.mkdirSync(caseDir,{recursive:false});
  const mediaAssets=writeMediaAssets(caseDir,plan.visual,`market-visual|${entry.id}|${entry.brief}`);
  for(const slot of plan.visual.media.slots)slot.src=mediaAssets[slot.id]||null;
  for(const section of plan.visual.sections)for(const slot of section.media||[])slot.src=mediaAssets[slot.id]||null;
  fs.writeFileSync(path.join(caseDir,'index.html'),renderWebsite(plan,plan.visual,`market-visual-${entry.id}`));
  fs.writeFileSync(path.join(caseDir,'styles.css'),renderCss(plan.visual));
  const sample={
    id:entry.id,brief:entry.brief,domain:plan.project.domainArchetype,classification:plan.domain.classification,
    profile:plan.designStrategy.composition_profile?.siteArchetype||null,family:plan.layout.family,
    layoutFingerprint:plan.layout.fingerprint,spatialFingerprint:plan.visual.spatial.fingerprint,
    rendererFingerprint:plan.visual.sections.map(x=>`${x.id}:${x.rendererKey}`).join('|'),
    flowFingerprint:(plan.layout.conversionFlow||[]).join('>'),canvas:plan.visual.spatial.canvas,
    heroRenderer:plan.visual.sections.find(x=>x.id==='hero')?.rendererKey||null,viewports:{}
  };
  fs.writeFileSync(path.join(caseDir,'plan-summary.json'),JSON.stringify({...sample,viewports:undefined},null,2)+'\n');
  for(const [key,viewport] of Object.entries(viewportDefs)){
    const evidenceKey=`${key}-${viewport.width}x${viewport.height}`;
    const first=await runBrowserQa(caseDir,{baseline:true,evidenceKey,viewport,cleanupProfile:false});
    const second=await runBrowserQa(caseDir,{baseline:true,evidenceKey,viewport,cleanupProfile:false});
    const checks=Object.fromEntries(second.checks.map(x=>[x.id,x]));
    const current=path.join(caseDir,'qa',evidenceKey,'current.png');
    const visual=pngVisualSignature(current,12);
    sample.viewports[key]={
      viewport:second.viewport,width:visual.width,height:visual.height,signature:visual.signature,
      screenshotSha256:visual.sha256,screenshot:path.relative(workspace,current).split(path.sep).join('/'),
      firstStatus:first.status,secondStatus:second.status,
      browserPass:checks['browser-qa']?.status==='PASS',accessibilityPass:checks.accessibility?.status==='PASS',
      responsivePass:checks['responsive-overflow']?.status==='PASS',performancePass:checks.performance?.status==='PASS',
      deterministicPass:checks['visual-regression']?.status==='PASS'
    };
  }
  samples.push(sample);
}
const report=evaluateMarketVisualBenchmark(samples);
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const receipt={
  ...report,generatedAt:new Date().toISOString(),
  provenance:{repositoryRoot:root,branch:git(['branch','--show-current']),head:git(['rev-parse','HEAD']),
    dirty:git(['status','--porcelain']).length>0,browser,dataset:'tests/data/market-coverage-briefs.json',
    selection:[...MARKET_VISUAL_CASE_IDS],workspace,viewports:viewportDefs,destructiveCleanup:false}
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,metrics:receipt.metrics,gates:receipt.gates.filter(x=>x.status!=='PASS'),closestPairs:receipt.closestPairs},null,2));
process.exitCode=receipt.status==='PASS'?0:1;
