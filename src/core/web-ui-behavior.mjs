import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { discoverChromium, connectCdp } from './browser-qa.mjs';

export const WEB_UI_BEHAVIOR_SPEC_SCHEMA='webforge.web-ui-behavior-spec.v1';
export const WEB_UI_BEHAVIOR_RECEIPT_SCHEMA='webforge.web-ui-behavior-receipt.v1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const values=x=>Array.isArray(x)?x:[];
const normPath=value=>{const s=String(value||'/').split(/[?#]/)[0]||'/';return s==='/'?'/':`/${s.replace(/^\/+|\/+$/g,'')}/`;};
const entryFor=route=>route==='/'?'index.html':`${route.replace(/^\/+|\/+$/g,'')}/index.html`;
const readJson=(root,name)=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));

export function compileWebUiBehaviorSpec(plan){
  if(!plan?.experience?.journeys||!plan?.siteBlueprint?.pages) throw new Error('WEBFORGE experience journeys and site blueprint required');
  const pages=values(plan.siteBlueprint.pages);
  const byId=new Map(pages.map(page=>[page.id,page]));
  const journeys=values(plan.experience.journeys).map(journey=>({
    id:journey.id,
    goal:journey.goal,
    success_evidence:values(journey.successEvidence),
    steps:values(journey.path).map((pageId,index)=>{
      const page=byId.get(pageId);
      return page?{
        index,page_id:page.id,path:normPath(page.path),family:page.family||'overview',dynamic:Boolean(page.dynamic),
        entry:page.dynamic?null:entryFor(normPath(page.path)),transition_required:index>0
      }:{index,page_id:pageId,path:null,family:null,dynamic:false,entry:null,transition_required:index>0,missing:true};
    })
  }));
  const form_pages=pages.filter(page=>!page.dynamic&&['action','contact'].includes(page.family)).map(page=>({page_id:page.id,path:normPath(page.path),entry:entryFor(normPath(page.path)),family:page.family}));
  return {
    schema:WEB_UI_BEHAVIOR_SPEC_SCHEMA,
    status:journeys.some(j=>j.steps.some(s=>s.missing))?'BLOCKED':'READY',
    source:{experience_schema:plan.experience.schema||null,site_blueprint_schema:plan.siteBlueprint.schema||null,design_spec_schema:'WebUIDesignSpec/v1'},
    journeys,form_pages,
    policy:{local_preview_only:true,external_effects:false,dynamic_runtime_steps:'UNVERIFIED_UNTIL_RUNTIME_EVIDENCE',release_authority:'NONE',production_authority:'NONE'},
    acceptance:{static_page_render:'PASS',clickable_static_transition:'PASS',form_error_recovery:'PASS',dynamic_step:'requires runtime evidence'}
  };
}

function mime(file){const ext=path.extname(file).toLowerCase();return {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[ext]||'application/octet-stream';}
async function startPreview(projectDir){
  const root=path.resolve(projectDir);
  const server=http.createServer((req,res)=>{
    const u=new URL(req.url||'/','http://127.0.0.1');
    let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if(!rel) rel='index.html'; else if(rel.endsWith('/')) rel+='index.html';
    let file=path.resolve(root,rel);
    if(!(file===root||file.startsWith(root+path.sep))||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'content-type':mime(file),'cache-control':'no-store'});res.end(fs.readFileSync(file));
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();
  return {server,base:`http://127.0.0.1:${address.port}`};
}

async function waitReady(send,expectedPath,timeoutMs=2200){
  const expected=normPath(expectedPath); const started=Date.now(); let last=null;
  while(Date.now()-started<timeoutMs){
    try{
      const r=await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>({ready:document.readyState,path:location.pathname,page:document.querySelector('main')?.dataset.page||null,family:document.querySelector('main')?.dataset.family||null,title:document.title}))()`});
      last=r.result.value;
      if(last.ready==='complete'&&normPath(last.path)===expected) return last;
    }catch{}
    await sleep(70);
  }
  return last;
}

async function navigate(send,url,expectedPath){
  await send('Page.navigate',{url});
  const state=await waitReady(send,expectedPath);
  return {status:state&&normPath(state.path)===normPath(expectedPath)&&state.title?'PASS':'FAIL',state};
}

async function clickTo(send,targetPath){
  const target=normPath(targetPath);
  const click=await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const target=${JSON.stringify(target)};const anchors=[...document.querySelectorAll('a[href]')];const candidates=anchors.map(a=>{let p=null;try{p=new URL(a.getAttribute('href'),location.href).pathname}catch{}return {p,text:(a.innerText||a.getAttribute('aria-label')||'').trim().slice(0,120),href:a.getAttribute('href')}});const match=anchors.find(a=>{try{const u=new URL(a.getAttribute('href'),location.href);return u.origin===location.origin&&u.pathname===target}catch{return false}});if(!match)return {clicked:false,candidates:candidates.filter(x=>x.p&&x.p!=='/').slice(0,24)};const href=match.getAttribute('href'),text=(match.innerText||match.getAttribute('aria-label')||'').trim().slice(0,120);match.click();return {clicked:true,href,text}})()`});
  const detail=click.result.value;
  if(!detail?.clicked) return {status:'FAIL',reason:'NO_CLICKABLE_PATH',detail};
  const state=await waitReady(send,target);
  const status=state&&normPath(state.path)===target?'PASS':'FAIL';
  return {status,reason:status==='PASS'?null:(state?'PATH_MISMATCH':'NAVIGATION_TIMEOUT'),detail:{...detail,state}};
}

async function verifyForm(send,page){
  const initial=await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const root=document.querySelector('[data-wf-form-root]');return root?{exists:true,state:root.dataset.uiState,form:!!root.querySelector('form')}: {exists:false}})()`});
  if(!initial.result.value?.exists) return {page_id:page.page_id,path:page.path,status:'FAIL',reason:'FORM_ROOT_MISSING'};
  const invalid=await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const root=document.querySelector('[data-wf-form-root]'),form=root?.querySelector('form');if(!form)return null;form.requestSubmit();return {state:root.dataset.uiState,invalid:[...form.querySelectorAll('[aria-invalid]')].length,active:document.activeElement?.name||null,path:location.pathname}})()`});
  await sleep(60);
  const invalidState=await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const root=document.querySelector('[data-wf-form-root]'),form=root?.querySelector('form');return {state:root?.dataset.uiState||null,invalid:form?[...form.querySelectorAll('[aria-invalid]')].length:0,path:location.pathname}})()`});
  const valid=await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const root=document.querySelector('[data-wf-form-root]'),form=root?.querySelector('form');if(!form)return null;const vals={name:'QA User',email:'qa@example.com',details:'QA behavior verification'};for(const [name,value] of Object.entries(vals)){const el=form.querySelector('[name="'+name+'"]');if(el){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))}}form.requestSubmit();return true})()`});
  await sleep(60);
  const validState=await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const root=document.querySelector('[data-wf-form-root]'),form=root?.querySelector('form');return {state:root?.dataset.uiState||null,invalid:form?[...form.querySelectorAll('[aria-invalid]')].length:0,path:location.pathname}})()`});
  const pass=initial.result.value.state==='empty'&&invalidState.result.value.state==='error'&&invalidState.result.value.invalid>0&&valid.result.value===true&&validState.result.value.state==='success'&&normPath(validState.result.value.path)===normPath(page.path);
  return {page_id:page.page_id,path:page.path,status:pass?'PASS':'FAIL',initial:initial.result.value,invalid:invalidState.result.value,valid:validState.result.value,external_submission:false};
}

function aggregate(items){return items.some(x=>x.status==='FAIL')?'FAIL':items.some(x=>x.status==='UNVERIFIED')?'UNVERIFIED':items.length&&items.every(x=>x.status==='PASS')?'PASS':'UNVERIFIED';}

export async function runWebUiBehaviorVerifier(projectDir,{writeReceipt=true,viewport={width:1280,height:720}}={}){
  const root=path.resolve(projectDir);
  const specPath=path.join(root,'web-ui-behavior-spec.json');
  const designPath=path.join(root,'web-ui-design-spec.json');
  if(!fs.existsSync(specPath)||!fs.existsSync(designPath)) throw new Error('Behavior and design specs required');
  const spec=readJson(root,'web-ui-behavior-spec.json'),design=readJson(root,'web-ui-design-spec.json');
  if(spec.schema!==WEB_UI_BEHAVIOR_SPEC_SCHEMA||design.schema!=='WebUIDesignSpec/v1') throw new Error('Unsupported WEBFORGE behavior/design schema');
  const chromiumPath=discoverChromium();
  if(!chromiumPath){const receipt={schema:WEB_UI_BEHAVIOR_RECEIPT_SCHEMA,status:'UNVERIFIED',reason:'CHROMIUM_UNAVAILABLE',policy:{release_authority:'NONE',external_effects:false}};if(writeReceipt)fs.writeFileSync(path.join(root,'web-ui-behavior.receipt.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;}
  const preview=await startPreview(root); const cdpPort=22000+Math.floor(Math.random()*2500); const profile=path.join(root,'qa',`.behavior-chromium-${process.pid}-${Date.now()}`);fs.mkdirSync(path.dirname(profile),{recursive:true});
  const chromium=spawn(chromiumPath,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',`--window-size=${viewport.width},${viewport.height}`,'--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${cdpPort}`,`--user-data-dir=${profile}`,preview.base+'/'],{stdio:'ignore'});
  let cdp;
  try{
    cdp=await connectCdp(cdpPort); const {send}=cdp; await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:false});
    const journeys=[];
    for(const journey of spec.journeys){
      const steps=[]; let current=null;
      for(const step of journey.steps){
        if(step.missing){steps.push({...step,status:'FAIL',reason:'PAGE_CONTRACT_MISSING'});break;}
        if(step.dynamic){steps.push({...step,status:'UNVERIFIED',reason:'DYNAMIC_RUNTIME_REQUIRED'});break;}
        if(!fs.existsSync(path.join(root,step.entry))){steps.push({...step,status:'FAIL',reason:'STATIC_ENTRY_MISSING'});break;}
        if(!current){const result=await navigate(send,preview.base+step.path,step.path);steps.push({...step,status:result.status,mode:'DIRECT_ENTRY',evidence:result});if(result.status!=='PASS')break;current=step;continue;}
        const result=await clickTo(send,step.path);steps.push({...step,status:result.status,mode:'CLICK_TRANSITION',from:current.page_id,evidence:result});if(result.status!=='PASS')break;current=step;
      }
      journeys.push({id:journey.id,goal:journey.goal,status:aggregate(steps),success_evidence:journey.success_evidence.map(x=>({claim:x,status:'DECLARED_NOT_PROVED'})),steps});
    }
    const forms=[];
    for(const page of spec.form_pages){const nav=await navigate(send,preview.base+page.path,page.path);if(nav.status!=='PASS'){forms.push({...page,status:'FAIL',reason:'PAGE_RENDER_FAIL'});continue;}forms.push(await verifyForm(send,page));}
    const checks=[...journeys.map(x=>({kind:'journey',id:x.id,status:x.status})),...forms.map(x=>({kind:'form',id:x.page_id,status:x.status}))];
    const status=aggregate(checks);
    const receipt={schema:WEB_UI_BEHAVIOR_RECEIPT_SCHEMA,status,project_dir:path.basename(root),behavior_spec_sha256:sha(fs.readFileSync(specPath)),design_spec_sha256:sha(fs.readFileSync(designPath)),viewport,journeys,form_checks:forms,checks,truth_boundary:{static_preview_behavior:true,dynamic_runtime_behavior:'UNVERIFIED unless exercised by a runtime-capable verifier',success_evidence_semantics:'DECLARED_NOT_PROVED by this technical verifier',external_submission:false,release_gate_changed:false,release_authority:'NONE',production_authority:'NONE'}};
    if(writeReceipt)fs.writeFileSync(path.join(root,'web-ui-behavior.receipt.json'),JSON.stringify(receipt,null,2)+'\n');
    return receipt;
  } finally {
    try{cdp?.ws?.close()}catch{}
    await new Promise(resolve=>preview.server.close(resolve));
    if(chromium.exitCode===null){const exited=new Promise(resolve=>chromium.once('exit',resolve));try{chromium.kill('SIGTERM')}catch{}await Promise.race([exited,sleep(1000)]);if(chromium.exitCode===null){try{chromium.kill('SIGKILL')}catch{}}}
    try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:2,retryDelay:80})}catch{}
  }
}
