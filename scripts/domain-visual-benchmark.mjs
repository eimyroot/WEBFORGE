import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generateWebsite,generatedProjectDir} from '../src/core/generator.mjs';
import {discoverChromium,runBrowserQa} from '../src/core/browser-qa.mjs';
import {pngVisualSignature,visualSignatureDistance} from '../src/core/rendered-diversity.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cases=[
 ['corporate','Corporate consultancy with capabilities, client work, approach, team, insights and contact.'],
 ['saas','Accounting SaaS for invoicing, expenses, reporting, integrations, security, pricing and login.'],
 ['education','Private university with programmes, admissions, campus, research, scholarships and student resources.'],
 ['jobs','Recruitment platform with engineering jobs, company profiles, career advice and employer hiring services.'],
 ['industrial','Industrial automation manufacturer with products, capabilities, industries, case studies, RFQ and support.'],
 ['finance','Independent wealth management firm with investment services, retirement planning, security, documents and consultation booking.'],
 ['community','Professional membership association with directory, events, resources, committees, benefits and join flow.'],
 ['restaurant','Contemporary restaurant with menu, reservations, chef story, private dining, gallery and location.'],
 ['professional','Corporate law firm with practice areas, lawyers, industries, insights, credentials, offices and contact.'],
 ['ecommerce','Premium outdoor ecommerce store with collections, categories, featured products, comparison, reviews, shipping and checkout.']
];
const browser=discoverChromium();
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const output=arg('--output'),screenshotsDir=arg('--screenshots-dir');
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
if(!browser){console.error('DOMAIN_VISUAL=UNVERIFIED: Chrome/Chromium required');process.exit(2)}
if(screenshotsDir)fs.mkdirSync(screenshotsDir,{recursive:true});
const samples=[];
for(const [id,brief] of cases){
  const generated=generateWebsite(brief),dir=generatedProjectDir(generated.projectId);
  const generatedReceipt=path.join(root,'evidence','generated',`${generated.projectId}.json`);
  try{
    const first=await runBrowserQa(dir,{baseline:true});
    const second=await runBrowserQa(dir,{baseline:true});
    const current=path.join(dir,'qa','current.png');
    const visual=pngVisualSignature(current,12),byId=Object.fromEntries(second.checks.map(x=>[x.id,x]));
    samples.push({id,domain:generated.plan.project.domainArchetype,strategy:generated.plan.designStrategy.layout_strategy.primary,
      hero:generated.plan.visual.sections.find(x=>x.id==='hero')?.rendererKey,width:visual.width,height:visual.height,
      signature:visual.signature,screenshotSha256:visual.sha256,browserPass:byId['browser-qa']?.status==='PASS',
      accessibilityPass:byId.accessibility?.status==='PASS',performancePass:byId.performance?.status==='PASS',
      deterministicPass:byId['visual-regression']?.status==='PASS',firstStatus:first.status,secondStatus:second.status});
    if(screenshotsDir)fs.copyFileSync(current,path.join(screenshotsDir,`${id}.png`));
  }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(generatedReceipt,{force:true});}
}
const pairs=[];
for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++)pairs.push({a:samples[i].id,b:samples[j].id,d:visualSignatureDistance(samples[i].signature,samples[j].signature)});
const mean=pairs.reduce((a,b)=>a+b.d,0)/Math.max(pairs.length,1),minimum=Math.min(...pairs.map(x=>x.d));
const corpSaas=pairs.find(x=>[x.a,x.b].sort().join('|')==='corporate|saas')?.d||0;
const rate=key=>samples.filter(x=>x[key]).length/Math.max(samples.length,1);
const metrics={sampleCount:samples.length,browserPassRate:rate('browserPass'),accessibilityPassRate:rate('accessibilityPass'),
  performancePassRate:rate('performancePass'),deterministicPassRate:rate('deterministicPass'),
  screenshotUniqueRate:new Set(samples.map(x=>x.screenshotSha256)).size/samples.length,
  strategyUniqueRate:new Set(samples.map(x=>x.strategy)).size/samples.length,heroUniqueRate:new Set(samples.map(x=>x.hero)).size/samples.length,
  perceptualDistance:Number(mean.toFixed(4)),minimumPairDistance:Number(minimum.toFixed(4)),corporateSaasDistance:Number(corpSaas.toFixed(4))};
const thresholds={browserPassRate:1,accessibilityPassRate:1,performancePassRate:1,deterministicPassRate:1,screenshotUniqueRate:1,strategyUniqueRate:1,heroUniqueRate:1,perceptualDistance:.08,minimumPairDistance:.04,corporateSaasDistance:.06};
const gates=Object.entries(thresholds).map(([metric,min])=>({metric,min,actual:metrics[metric],status:metrics[metric]>=min?'PASS':'FAIL'}));
const receipt={schema:'webforge.domain-visual-benchmark.v1',status:gates.every(x=>x.status==='PASS')?'PASS':'FAIL',metrics,thresholds,gates,
  pairs:pairs.sort((a,b)=>a.d-b.d).map(x=>({...x,d:Number(x.d.toFixed(4))})),
  samples:samples.map(({signature,...x})=>x),generatedAt:new Date().toISOString(),provenance:{repositoryRoot:root,branch:git(['branch','--show-current']),head:git(['rev-parse','HEAD']),dirty:git(['status','--porcelain']).length>0,browser,viewport:'1440x1200 captureBeyondViewport'}};
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify(receipt,null,2));
process.exitCode=receipt.status==='PASS'?0:1;
