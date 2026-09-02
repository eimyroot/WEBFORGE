import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compose } from '../core/compose.mjs';
import { templateCatalog } from '../core/template-schema.mjs';
import { generateWebsite, generatedFile, generatedProjectDir } from '../core/generator.mjs';
import { runBrowserQa } from '../core/browser-qa.mjs';
import { verifyRuntimeBuild } from '../core/runtime-build.mjs';
import { evaluateDeployment } from '../core/deployment.mjs';
import { executeDeployment } from '../core/deployment-executor.mjs';
import { environmentSnapshot } from '../core/environment.mjs';
import { visualReadinessChecks, approveVisual } from '../core/visual-readiness.mjs';
import { sectionTemplateCatalog } from '../core/section-templates.mjs';
import { artDirectionCatalog } from '../core/art-direction.mjs';
import { registrySummary, registry } from '../core/composition-registry.mjs';
import { fulfillMedia } from '../core/media-fulfillment.mjs';
import { fulfillContent } from '../core/content-fulfillment.mjs';
import { connectorExecutionPlan } from '../core/live-connectors.mjs';
import { analyzeDomain } from '../core/domain-intelligence.mjs';
import { capabilityOntology } from '../core/product-intelligence.mjs';
import { compileUniversalBrief } from '../core/universal-compiler.mjs';
import { runAutonomousFactory } from '../core/factory.mjs';
import { federatedSources, searchFederatedComponents } from '../core/federated-components.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const web=path.join(root,'web');
const version='9.1.0';
const send=(res,status,body,type='application/json; charset=utf-8')=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(body)};
async function jsonBody(req){let raw=''; for await(const chunk of req){raw+=chunk;if(raw.length>1_000_000)throw new Error('Request too large')} return JSON.parse(raw||'{}')}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='POST' && url.pathname==='/api/factory/run'){
    try{const body=await jsonBody(req);if(typeof body.brief!=='string'||body.brief.trim().length<8)throw new Error('Brief must contain at least 8 characters');const out=await runAutonomousFactory(body.brief,{approveContent:body.approveContent===true,approveMedia:body.approveMedia===true,allowNetwork:body.allowNetwork===true,productionApproved:body.productionApproved===true});send(res,200,JSON.stringify(out,null,2));}catch(e){send(res,400,JSON.stringify({error:e.message}));}return;
  }
  if(req.method==='POST' && url.pathname==='/api/universal/analyze'){
    try{const body=await jsonBody(req);if(typeof body.brief!=='string'||body.brief.trim().length<3)throw new Error('Brief is required');send(res,200,JSON.stringify(compileUniversalBrief(body.brief),null,2));}catch(e){send(res,400,JSON.stringify({error:e.message}));}return;
  }
  if(req.method==='POST' && url.pathname==='/api/universal/domain'){
    try{const body=await jsonBody(req);send(res,200,JSON.stringify(analyzeDomain(body.brief),null,2));}catch(e){send(res,400,JSON.stringify({error:e.message}));}return;
  }
  if(req.method==='GET' && url.pathname==='/api/universal/capabilities'){send(res,200,JSON.stringify({status:'PASS',items:capabilityOntology()},null,2));return;}
  if(req.method==='POST' && url.pathname==='/api/plan'){
    try{const body=await jsonBody(req); if(typeof body.brief!=='string'||body.brief.trim().length<8)throw new Error('Brief must contain at least 8 characters'); send(res,200,JSON.stringify(compose(body.brief),null,2));}catch(e){send(res,400,JSON.stringify({error:e.message}));} return;
  }
  if(req.method==='POST' && url.pathname==='/api/generate'){
    try{const body=await jsonBody(req); if(typeof body.brief!=='string'||body.brief.trim().length<8)throw new Error('Brief must contain at least 8 characters'); const result=generateWebsite(body.brief); send(res,201,JSON.stringify(result,null,2));}
    catch(e){const status=e.code==='POLICY_BLOCK'?409:400; send(res,status,JSON.stringify({error:e.message,policy:e.plan?.policy||null}));} return;
  }
  if(req.method==='POST' && url.pathname==='/api/fulfill/media'){try{const body=await jsonBody(req);const dir=generatedProjectDir(body.projectId);if(!dir)throw new Error('Unknown projectId');send(res,200,JSON.stringify(fulfillMedia(dir,{assetDir:body.assetDir||path.join(root,'demo-media'),approve:body.approve===true}),null,2));}catch(e){send(res,400,JSON.stringify({error:e.message}));}return;}
  if(req.method==='POST' && url.pathname==='/api/fulfill/content'){try{const body=await jsonBody(req);const dir=generatedProjectDir(body.projectId);if(!dir)throw new Error('Unknown projectId');send(res,200,JSON.stringify(fulfillContent(dir,{source:body.source||'seed-demo',approve:body.approve===true}),null,2));}catch(e){send(res,400,JSON.stringify({error:e.message}));}return;}
  if(req.method==='POST' && url.pathname==='/api/connectors/plan'){try{const body=await jsonBody(req);const dir=generatedProjectDir(body.projectId);if(!dir)throw new Error('Unknown projectId');send(res,200,JSON.stringify(connectorExecutionPlan(dir),null,2));}catch(e){send(res,400,JSON.stringify({error:e.message}));}return;}
  if(req.method==='POST' && url.pathname==='/api/qa'){
    try{const body=await jsonBody(req); const dir=generatedProjectDir(body.projectId); if(!dir)throw new Error('Unknown projectId'); const qa=await runBrowserQa(dir,{baseline:body.baseline!==false}); send(res,200,JSON.stringify(qa,null,2));}
    catch(e){send(res,400,JSON.stringify({error:e.message}));} return;
  }
  if(req.method==='POST' && url.pathname==='/api/runtime-build'){
    try{const body=await jsonBody(req); const dir=generatedProjectDir(body.projectId); if(!dir)throw new Error('Unknown projectId'); const receipt=verifyRuntimeBuild(path.join(dir,'runtime'),{allowNetwork:body.allowNetwork===true}); fs.writeFileSync(path.join(dir,'runtime-build.receipt.json'),JSON.stringify(receipt,null,2)+'\n'); send(res,200,JSON.stringify(receipt,null,2));}
    catch(e){send(res,400,JSON.stringify({error:e.message}));} return;
  }
  if(req.method==='POST' && url.pathname==='/api/release/evaluate'){
    try{const body=await jsonBody(req); const dir=generatedProjectDir(body.projectId); if(!dir)throw new Error('Unknown projectId'); const evidence=JSON.parse(fs.readFileSync(path.join(dir,'evidence.receipt.json'),'utf8')); const qaPath=path.join(dir,'qa','browser-qa.json'); const buildPath=path.join(dir,'runtime-build.receipt.json'); const qa=fs.existsSync(qaPath)?JSON.parse(fs.readFileSync(qaPath,'utf8')):{checks:[]}; const build=fs.existsSync(buildPath)?JSON.parse(fs.readFileSync(buildPath,'utf8')):{status:'UNVERIFIED'}; const checks=[{id:'policy',status:evidence.policy==='PASS'?'PASS':'FAIL'},{id:'runtime-build',status:build.status},...qa.checks.filter(x=>['browser-qa','accessibility','performance','visual-regression'].includes(x.id)).map(x=>({id:x.id,status:x.status})),...visualReadinessChecks(dir)]; const out=evaluateDeployment({checks},{productionApproved:body.productionApproved===true}); send(res,200,JSON.stringify({checks,...out},null,2));}
    catch(e){send(res,400,JSON.stringify({error:e.message}));} return;
  }
  if(req.method==='POST' && url.pathname==='/api/deploy'){
    try{const body=await jsonBody(req); const dir=generatedProjectDir(body.projectId); if(!dir)throw new Error('Unknown projectId'); const out=executeDeployment(dir,{mode:body.mode||'preview',provider:body.provider||'vercel',productionApproved:body.productionApproved===true}); send(res,out.status==='BLOCKED'?409:200,JSON.stringify(out,null,2));}
    catch(e){send(res,400,JSON.stringify({error:e.message}));} return;
  }

  if(req.method==='POST' && url.pathname==='/api/visual/approve'){
    try{const body=await jsonBody(req); const dir=generatedProjectDir(body.projectId); if(!dir)throw new Error('Unknown projectId'); const out=approveVisual(dir,{contentApproved:body.contentApproved===true,mediaApproved:body.mediaApproved===true}); send(res,200,JSON.stringify({...out,checks:visualReadinessChecks(dir)},null,2));}
    catch(e){send(res,400,JSON.stringify({error:e.message}));} return;
  }
  if(req.method==='GET' && url.pathname==='/api/visual/registry'){
    const connectors=JSON.parse(fs.readFileSync(path.join(root,'src','registries','visual-connectors.json'),'utf8')); send(res,200,JSON.stringify({status:'PASS',sectionTemplates:sectionTemplateCatalog(),artDirections:artDirectionCatalog(),connectors},null,2)); return;
  }

  if(req.method==='GET' && url.pathname==='/api/components/sources'){send(res,200,JSON.stringify({status:'PASS',items:federatedSources()},null,2));return;}
  if(req.method==='GET' && url.pathname==='/api/components/search'){const q=url.searchParams.get('q')||'';send(res,200,JSON.stringify(await searchFederatedComponents(q),null,2));return;}

  if(req.method==='GET' && url.pathname==='/api/registry'){send(res,200,JSON.stringify({status:'PASS',...registrySummary()},null,2));return;}
  if(req.method==='GET' && url.pathname.startsWith('/api/registry/')){try{const name=url.pathname.split('/').filter(Boolean)[2];send(res,200,JSON.stringify({status:'PASS',name,items:registry(name)},null,2));}catch(e){send(res,404,JSON.stringify({error:e.message}));}return;}

  if(req.method==='GET' && url.pathname==='/api/health'){send(res,200,JSON.stringify({status:'PASS',service:'webforge',version}));return;}
  if(req.method==='GET' && url.pathname==='/api/environment'){send(res,200,JSON.stringify(environmentSnapshot(),null,2));return;}
  if((req.method==='GET' || req.method==='HEAD') && url.pathname.startsWith('/preview/')){
    const parts=url.pathname.split('/').filter(Boolean); const projectId=parts[1]; let requested=parts.slice(2).join('/')||'index.html'; if(url.pathname.endsWith('/')&&requested!=='index.html') requested+='/index.html';
    const p=generatedFile(projectId,requested); if(!p){send(res,404,'Not found','text/plain; charset=utf-8');return;} if(req.method==='HEAD'){res.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});res.end();return;} send(res,200,fs.readFileSync(p),types[path.extname(p)]||'application/octet-stream'); return;
  }
  const file=url.pathname==='/'?'index.html':url.pathname.slice(1); const safe=path.normalize(file).replace(/^\.\.(\/|\\|$)/,''); const p=path.join(web,safe);
  if(!p.startsWith(web) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){send(res,404,'Not found','text/plain; charset=utf-8');return;}
  send(res,200,fs.readFileSync(p),types[path.extname(p)]||'application/octet-stream');
});
const port=Number(process.env.PORT||8787);
server.on('error',err=>{
  if(err?.code==='EADDRINUSE'){
    console.error(`WEBFORGE cannot start: port ${port} is already in use. Stop the previous process or run: PORT=8788 npm start`);
    process.exitCode=1; return;
  }
  throw err;
});
server.listen(port,'127.0.0.1',()=>console.log(`WEBFORGE Control Room http://127.0.0.1:${port}`));
