import fs from 'node:fs';
import path from 'node:path';
import { generateWebsite,generatedProjectDir } from '../src/core/generator.mjs';
import { runBrowserQa,discoverChromium } from '../src/core/browser-qa.mjs';

const browser=discoverChromium();
if(!browser){console.error('VISUAL_MATRIX=UNVERIFIED: Chrome/Chromium required');process.exit(2)}
const cases=[
  ['vanta','Premium techno club called VANTA in Prague. Dark cinematic website with events, artists, tickets, gallery, immersive sound, membership and strong conversion.'],
  ['excavators','Tinder for renting excavators with search, filters, swipe discovery, equipment profiles, map, availability, reviews, accounts and payments.'],
  ['funeral','Sensitive premium funeral service in Prague with immediate contact, transparent guidance, services, booking, certifications, reviews, location and very high trust.'],
  ['future','A web ritual for exchanging promises with your future self, represented as evolving constellations, memory fragments, visual networks and timed unlocks.']
];
fs.mkdirSync('evidence/visual-matrix',{recursive:true});
const results=[];
for(const [id,brief] of cases){
  const out=generateWebsite(brief);const dir=generatedProjectDir(out.projectId);
  try{
    const first=await runBrowserQa(dir,{baseline:true});
    const second=await runBrowserQa(dir,{baseline:true});
    const current=path.join(dir,'qa','current.png');
    if(fs.existsSync(current))fs.copyFileSync(current,path.join('evidence','visual-matrix',`${id}.png`));
    results.push({id,classification:out.plan.domain.classification,domain:out.plan.project.domainArchetype,designMode:out.plan.designDNA.mode,artDirection:out.plan.visual.artDirection.theme.id,runtime:out.plan.selection.runtime.id,sectionFingerprint:out.plan.visual.sections.map(x=>`${x.id}:${x.layoutMode}:${x.rendererKey}`).join('|'),projectLocal:out.plan.visual.projectLocalComponents.map(x=>x.id),productionReviewRequired:out.plan.visual.templates.productionReviewRequired,browser:first.status,secondBrowser:second.status,checks:second.checks});
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const distinct={designModes:new Set(results.map(x=>x.designMode)).size,artDirections:new Set(results.map(x=>x.artDirection)).size,fingerprints:new Set(results.map(x=>x.sectionFingerprint)).size,domains:new Set(results.map(x=>x.domain)).size};
const status=results.every(x=>x.secondBrowser==='PASS')&&distinct.fingerprints===results.length?'PASS':'FAIL';
const report={schema:'webforge.visual-diversity-matrix.r2',version:'8.0.0',generatedAt:new Date().toISOString(),status,browser,distinct,results};
fs.writeFileSync('evidence/VISUAL_MATRIX_8.0.0.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(status!=='PASS')process.exit(1);
