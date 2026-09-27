import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateWebsite,generatedProjectDir} from '../src/core/generator.mjs';
import {discoverChromium,runBrowserQa} from '../src/core/browser-qa.mjs';
import {pngVisualSignature,evaluateRenderedDiversity} from '../src/core/rendered-diversity.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataset=JSON.parse(fs.readFileSync(path.join(root,'tests/data/design-diversity-briefs.json'),'utf8'));
const selectedIds=['boutique-hotel','florist-studio','accounting-saas','corporate-law','techno-club','architecture-portfolio','fine-dining','industrial-marketplace'];
const entries=selectedIds.map(id=>dataset.find(x=>x.id===id)).filter(Boolean);
const browser=discoverChromium();
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const output=arg('--output'),screenshotsDir=arg('--screenshots-dir');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
if(!browser){console.error('RENDERED_DIVERSITY=UNVERIFIED: Chrome/Chromium required');process.exit(2)}
if(screenshotsDir)fs.mkdirSync(screenshotsDir,{recursive:true});
const samples=[];
for(const entry of entries){
  const generated=generateWebsite(entry.brief),dir=generatedProjectDir(generated.projectId);
  const generatedReceipt=path.join(root,'evidence','generated',`${generated.projectId}.json`);
  try{
    const first=await runBrowserQa(dir,{baseline:true});
    const second=await runBrowserQa(dir,{baseline:true});
    const current=path.join(dir,'qa','current.png');
    const visual=pngVisualSignature(current,12);
    const byId=Object.fromEntries(second.checks.map(x=>[x.id,x]));
    const mobileFirst=await runBrowserQa(dir,{baseline:true,evidenceKey:'mobile-390',viewport:{width:390,height:844,mobile:true}});
    const mobileSecond=await runBrowserQa(dir,{baseline:true,evidenceKey:'mobile-390',viewport:{width:390,height:844,mobile:true}});
    const mobileById=Object.fromEntries(mobileSecond.checks.map(x=>[x.id,x]));
    samples.push({
      id:entry.id,domain:generated.plan.project.domainArchetype,archetype:generated.plan.project.archetype,
      navigation:generated.plan.designStrategy.navigation_model.items.map(x=>x.id),
      palette:generated.plan.designStrategy.color_strategy.temperature,
      artDirection:generated.plan.visual.artDirection.theme.id,
      width:visual.width,height:visual.height,signature:visual.signature,screenshotSha256:visual.sha256,
      browserPass:byId['browser-qa']?.status==='PASS',accessibilityPass:byId.accessibility?.status==='PASS',responsivePass:byId['responsive-overflow']?.status==='PASS',
      performancePass:byId.performance?.status==='PASS',deterministicPass:byId['visual-regression']?.status==='PASS',
      mobileBrowserPass:mobileById['browser-qa']?.status==='PASS',mobileAccessibilityPass:mobileById.accessibility?.status==='PASS',mobileResponsivePass:mobileById['responsive-overflow']?.status==='PASS',
      firstStatus:first.status,secondStatus:second.status,mobileFirstStatus:mobileFirst.status,mobileSecondStatus:mobileSecond.status
    });
    if(screenshotsDir){fs.copyFileSync(current,path.join(screenshotsDir,`${entry.id}-desktop.png`));const mobileCurrent=path.join(dir,'qa','mobile-390','current.png');if(fs.existsSync(mobileCurrent))fs.copyFileSync(mobileCurrent,path.join(screenshotsDir,`${entry.id}-mobile-390.png`));}
  } finally {
    fs.rmSync(dir,{recursive:true,force:true});
    fs.rmSync(generatedReceipt,{force:true});
  }
}
const report=evaluateRenderedDiversity(samples);
const receipt={
  ...report,
  generatedAt:new Date().toISOString(),
  provenance:{
    repositoryRoot:root,
    branch:git(['branch','--show-current']),
    head:git(['rev-parse','HEAD']),
    dirty:git(['status','--porcelain']).length>0,
    browser,
    viewports:['1440x1200 captureBeyondViewport','390x844 mobile captureBeyondViewport'],
    dataset:'tests/data/design-diversity-briefs.json',
    selectedIds
  }
};
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify(receipt,null,2));
process.exitCode=receipt.status==='PASS'?0:1;
