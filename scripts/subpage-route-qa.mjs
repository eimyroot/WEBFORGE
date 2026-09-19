import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateWebsite,generatedProjectDir} from '../src/core/generator.mjs';
import {renderBlueprintPage} from '../src/core/visual-renderer.mjs';
import {discoverChromium,runBrowserQa} from '../src/core/browser-qa.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cases=[
 ['product','Premium outdoor ecommerce store with products, categories, search, comparison, reviews and checkout.'],
 ['property','Real estate website with property listings, search, neighbourhoods, agents and viewing booking.'],
 ['job','Recruitment platform with jobs, company profiles, search, filters and employer hiring services.'],
 ['course','University website with programmes, course catalog, admissions, campus, research and student resources.'],
 ['article','Independent magazine with articles, topics, authors, search and newsletter.'],
 ['event','Techno club with events calendar, artists, tickets, gallery and location.'],
 ['profile','Professional membership community with member directory, public profiles, events and resources.']
];
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const output=arg('--output'),screenshotsDir=arg('--screenshots-dir');
const browser=discoverChromium(),git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
if(!browser){console.error('SUBPAGE_ROUTE_QA=UNVERIFIED: Chrome/Chromium required');process.exit(2)}
if(screenshotsDir)fs.mkdirSync(screenshotsDir,{recursive:true});
const details=[],states=[];
const byId=qa=>Object.fromEntries(qa.checks.map(x=>[x.id,x]));
const copyShot=(dir,key,target)=>{const p=path.join(dir,'qa',key,'current.png');if(screenshotsDir&&fs.existsSync(p))fs.copyFileSync(p,path.join(screenshotsDir,target));return fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;};
const entryFor=p=>p.replace(/^\/|\/$/g,'')+'/index.html';
for(const [kind,brief] of cases){
  const generated=generateWebsite(brief),dir=generatedProjectDir(generated.projectId),receipt=path.join(root,'evidence','generated',`${generated.projectId}.json`);
  try{
    const page=generated.plan.siteBlueprint.pages.find(x=>x.dynamic&&x.detailKind===kind);
    if(!page)throw new Error(`Missing ${kind} detail route`);
    const concrete={...page,path:page.path.replace('[slug]','qa-example')},entry=entryFor(concrete.path),file=path.join(dir,entry);
    fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,renderBlueprintPage(generated.plan,generated.plan.visual,concrete));
    const key=`detail-${kind}`,qa=await runBrowserQa(dir,{entry,evidenceKey:key,visualRegression:false}),checks=byId(qa);
    details.push({kind,entry,status:qa.status,browser:checks['browser-qa']?.status,accessibility:checks.accessibility?.status,performance:checks.performance?.status,screenshotSha256:copyShot(dir,key,`${kind}.png`)});
    if(kind==='course'){
      const action=generated.plan.siteBlueprint.pages.find(x=>!x.dynamic&&x.family==='action');
      if(!action)throw new Error('Missing action route');
      for(const state of ['empty','error','success']){
        const formInteraction=state==='error'?'submit-invalid':state==='success'?'submit-valid':null;
        const stateKey=`form-${state}`,stateQa=await runBrowserQa(dir,{entry:entryFor(action.path),evidenceKey:stateKey,formInteraction,visualRegression:false}),c=byId(stateQa),dom=c['browser-qa']?.detail||{};
        states.push({surface:'form',state,interaction:formInteraction||'initial',status:stateQa.status,uiState:dom.uiState,visible:dom.visibleStateViews||[],screenshotSha256:copyShot(dir,stateKey,`form-${state}.png`)});
      }
    }
    if(kind==='product'){
      const listing=generated.plan.siteBlueprint.pages.find(x=>!x.dynamic&&x.family==='listing');
      if(!listing)throw new Error('Missing listing route');
      for(const state of ['ready','empty','error']){
        const stateKey=`listing-${state}`,stateQa=await runBrowserQa(dir,{entry:entryFor(listing.path),evidenceKey:stateKey,uiState:state,visualRegression:false}),c=byId(stateQa),dom=c['browser-qa']?.detail||{};
        states.push({surface:'listing',state,status:stateQa.status,uiState:dom.uiState,visible:dom.visibleStateViews||[],screenshotSha256:copyShot(dir,stateKey,`listing-${state}.png`)});
      }
    }
  } finally {fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(receipt,{force:true});}
}
const rate=(xs,p)=>xs.filter(p).length/Math.max(xs.length,1);
const metrics={detailCount:details.length,detailPassRate:rate(details,x=>x.status==='PASS'),detailAccessibilityPassRate:rate(details,x=>x.accessibility==='PASS'),detailPerformancePassRate:rate(details,x=>x.performance==='PASS'),detailScreenshotUniqueRate:new Set(details.map(x=>x.screenshotSha256)).size/Math.max(details.length,1),stateCount:states.length,statePassRate:rate(states,x=>x.status==='PASS'),stateContractPassRate:rate(states,x=>x.uiState===x.state&&x.visible.length===1&&x.visible[0]===x.state),stateScreenshotUniqueRate:new Set(states.map(x=>x.screenshotSha256)).size/Math.max(states.length,1)};
const thresholds={detailPassRate:1,detailAccessibilityPassRate:1,detailPerformancePassRate:1,detailScreenshotUniqueRate:1,statePassRate:1,stateContractPassRate:1,stateScreenshotUniqueRate:1};
const gates=Object.entries(thresholds).map(([metric,min])=>({metric,min,actual:metrics[metric],status:metrics[metric]>=min?'PASS':'FAIL'}));
const result={schema:'webforge.subpage-route-qa.v1',status:gates.every(x=>x.status==='PASS')?'PASS':'FAIL',metrics,thresholds,gates,details,states,generatedAt:new Date().toISOString(),provenance:{repositoryRoot:root,branch:git(['branch','--show-current']),head:git(['rev-parse','HEAD']),dirty:git(['status','--porcelain']).length>0,browser,viewport:'1440x1200 captureBeyondViewport'}};
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:1;
