import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { compose } from './compose.mjs';
import { renderWebsite, renderCss, renderBlueprintPage } from './visual-renderer.mjs';
import { writeMediaAssets } from './media-assets.mjs';
import { compileWebUIDesignSpec, WEB_UI_VIEWPORTS } from './web-ui-contract.mjs';
import { compileWebUiBehaviorSpec, runWebUiBehaviorVerifier } from './web-ui-behavior.mjs';
import { runWebUiQualityMatrix } from './web-ui-quality.mjs';
import { structuralSequenceDistance } from './structural-diversity.mjs';
import { DESIGN_DIRECTION_SCHEMA, validateDesignDirectionPlan } from './design-direction-contract.mjs';

export const GENERATOR_TOURNAMENT_SCHEMA='webforge.generator-tournament.v1';
export const UIGEN_FX_MODEL={
  source:'QuantFactory/UIGEN-FX-4B-Preview-GGUF',
  upstream:'Tesslate/UIGEN-FX-4B-Preview',
  revision:'3a1c73445814ac5cd7c8ec0c11eb9616f2190a33',
  file:'UIGEN-FX-4B-Preview.Q4_K_M.gguf',
  size_bytes:2716064480,
  sha256:'a3b0427574ebc820192ef692808a478f87a01a352b53fdcc04c749aea627a439',
  license:'apache-2.0',
  status:'RESEARCH_PREVIEW'
};

const now=()=>new Date().toISOString();
const safeId=value=>String(value||'case').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'case';
const shaFile=file=>execFileSync('shasum',['-a','256',file],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim().split(/\s+/)[0];
function writeJson(root,name,value){
  fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n');
}
function routeDir(root,route){
  const rel=String(route||'/').replace(/^\/+|\/+$/g,'');
  return rel?path.join(root,rel):root;
}
function copySpecs(root,designSpec,behaviorSpec){
  writeJson(root,'web-ui-design-spec.json',designSpec);
  writeJson(root,'web-ui-behavior-spec.json',behaviorSpec);
}

export function inspectUigenFxModel(modelPath,{verifyHash=true}={}){
  if(!modelPath||!fs.existsSync(modelPath)) return {status:'UNVERIFIED',reason:'MODEL_UNAVAILABLE',model:{...UIGEN_FX_MODEL}};
  const stat=fs.statSync(modelPath);
  if(!stat.isFile()) return {status:'BLOCKED',reason:'MODEL_NOT_FILE',model:{...UIGEN_FX_MODEL}};
  if(stat.size!==UIGEN_FX_MODEL.size_bytes) return {status:'BLOCKED',reason:'MODEL_SIZE_MISMATCH',actual_size:stat.size,model:{...UIGEN_FX_MODEL}};
  const digest=verifyHash?shaFile(modelPath):null;
  if(verifyHash&&digest!==UIGEN_FX_MODEL.sha256) return {status:'BLOCKED',reason:'MODEL_SHA256_MISMATCH',actual_sha256:digest,model:{...UIGEN_FX_MODEL}};
  return {status:'PASS',path:modelPath,size_bytes:stat.size,sha256:digest||UIGEN_FX_MODEL.sha256,model:{...UIGEN_FX_MODEL}};
}

function compactSpec(spec){return JSON.stringify(spec);}
export function buildUigenFxPrompt({brief,designSpec}){
  return ['You are the semantic-markup stage of a bounded UIGEN-FX candidate inside the WEBFORGE generator tournament.',
    'Return ONLY one complete <body>...</body> fragment. Do not return a doctype, <html>, <head>, <style>, CSS, scripts, SVG, images or markdown fences.',
    'HARD OUTPUT CONTRACT: close </body> within about 430 generated tokens. An incomplete body is an automatic FAIL.',
    'Use one compact <header> with <nav>, exactly one <main>, exactly one <h1>, exactly 4 meaningful <section> elements, and one compact <footer>.',
    'Keep copy concise. Give sections useful ids/classes. Use keyboard-usable anchors/buttons and accessible labels. No inline event handlers or style attributes.',
    'Use only relative/internal href paths from layout.information_hierarchy when useful. Do not invent testimonials, prices, metrics or live facts.',
    'Make the structure materially specific to this brief. Avoid a generic universal SaaS landing-page skeleton.',
    `BRIEF: ${brief}`,
    `WEB_UI_DESIGN_SPEC: ${compactSpec(designSpec)}`].join('\n');
}
export function buildUigenFxCssPrompt({brief,designSpec,body}){
  return ['You are the visual-style stage of the same bounded UIGEN-FX candidate.',
    'Return ONLY one complete <style>...</style> element for the provided BODY. Do not return HTML, markdown, comments, @import, url(), scripts or external resources.',
    'HARD OUTPUT CONTRACT: close </style> within about 340 generated tokens. An incomplete style is an automatic FAIL.',
    'Use at most 12 CSS rules and 30 declarations, one compact rule per line. No CSS custom properties, utility-class systems, reset/framework code, animations or pseudo-elements.',
    'Use system fonts. Include one small responsive rule when useful. Make composition, spacing and typography reflect the brief and WebUIDesignSpec instead of a generic template.',
    `BRIEF: ${brief}`,
    `WEB_UI_DESIGN_SPEC: ${compactSpec(designSpec)}`,
    `BODY_TO_STYLE: ${body}`].join('\n');
}
function extractLastClosedElement(raw,tag){
  const text=String(raw||'').trim(),lower=text.toLowerCase(),close=`</${tag}>`;
  const end=lower.lastIndexOf(close),start=end>=0?lower.lastIndexOf(`<${tag}`,end):-1;
  if(start<0||end<start)return null;
  if(lower.indexOf(`<${tag}`,end+close.length)>=0)return null;
  const openEnd=text.indexOf('>',start);if(openEnd<0||openEnd>end)return null;
  return text.slice(start,end+close.length);
}
export function extractUigenFxBodyStage(raw){
  let body=extractLastClosedElement(raw,'body');
  if(!body)return {status:'FAIL',reason:'HTML_BODY_NOT_FOUND'};
  const styleBlocks=[...body.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].length;
  if(styleBlocks)body=body.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  if(/<(?:html|head|style|script|link|meta)\b/i.test(body))return {status:'BLOCKED',reason:'BODY_STAGE_FORBIDDEN_TAG',sanitized_style_blocks:styleBlocks};
  if(/\son[a-z][a-z0-9_-]*\s*=/i.test(body)||/javascript\s*:/i.test(body))return {status:'BLOCKED',reason:'BODY_STAGE_ACTIVE_CONTENT',sanitized_style_blocks:styleBlocks};
  return {status:'PASS',body,sanitized_style_blocks:styleBlocks};
}
export function extractUigenFxStyleStage(raw){
  const style=extractLastClosedElement(raw,'style');
  if(!style)return {status:'FAIL',reason:'CSS_STYLE_NOT_FOUND'};
  const css=style.replace(/^<style\b[^>]*>/i,'').replace(/<\/style>$/i,'').trim();
  if(!css)return {status:'FAIL',reason:'CSS_EMPTY'};
  if(/@import\b/i.test(css)||/\burl\s*\(/i.test(css))return {status:'BLOCKED',reason:'CSS_ACTIVE_RESOURCE'};
  return {status:'PASS',style:`<style>${css}</style>`,css};
}
const UNSAFE_PATTERNS=[
  [/\b(?:src|href)\s*=\s*["']https?:\/\//i,'EXTERNAL_RESOURCE'],
  [/\burl\s*\(/i,'CSS_URL_FORBIDDEN'],
  [/@import\b/i,'CSS_IMPORT_FORBIDDEN'],
  [/<script\b/i,'INLINE_SCRIPT_FORBIDDEN'],
  [/\son[a-z][a-z0-9_-]*\s*=/i,'INLINE_EVENT_HANDLER'],
  [/\b(?:src|href)\s*=\s*["']\s*javascript:/i,'JAVASCRIPT_URL'],
  [/<(?:iframe|object|embed)\b/i,'EMBEDDED_ACTIVE_CONTENT'],
  [/\bfetch\s*\(/i,'NETWORK_FETCH'],
  [/\bXMLHttpRequest\b/i,'NETWORK_XHR'],
  [/\bWebSocket\s*\(/i,'NETWORK_WEBSOCKET'],
  [/\bwindow\.open\s*\(\s*["']https?:\/\//i,'NETWORK_WINDOW_OPEN'],
  [/\blocation(?:\.href)?\s*=\s*["']https?:\/\//i,'NETWORK_LOCATION'],
  [/(?:src|href)\s*=\s*["']\/\//i,'PROTOCOL_RELATIVE_RESOURCE'],
  [/url\(\s*["']?\/\//i,'PROTOCOL_RELATIVE_CSS_RESOURCE'],
  [/\bsendBeacon\s*\(/i,'NETWORK_BEACON'],
  [/<form\b[^>]*\baction\s*=\s*["'][^"'#]/i,'FORM_EXTERNAL_ACTION']
];

export function validateExternalCandidateSource(source){
  const html=String(source||'');
  const violations=UNSAFE_PATTERNS.filter(([re])=>re.test(html)).map(([,id])=>id);
  return {
    status:violations.length?'BLOCKED':'PASS',
    violations,
    truth_boundary:{network_effects:false,generated_code_untrusted:true,production_authority:'NONE'}
  };
}

export function extractUigenFxCandidate(raw){
  const text=String(raw||'').trim(),lower=text.toLowerCase();
  const end=lower.lastIndexOf('</html>'),start=end>=0?lower.lastIndexOf('<!doctype html>',end):-1;
  if(start<0||end<start) return {status:'FAIL',reason:'HTML_DOCUMENT_NOT_FOUND'};
  let html=text.slice(start,end+'</html>'.length);
  const safety=validateExternalCandidateSource(html);
  if(safety.status!=='PASS') return {status:'BLOCKED',reason:'UNSAFE_GENERATED_SOURCE',safety};
  const styles=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1].trim()).filter(Boolean);
  if(!styles.length) return {status:'FAIL',reason:'INLINE_STYLE_REQUIRED'};
  const css=styles.join('\n\n');
  html=html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  html=html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi,'');
  const link='<link rel="stylesheet" href="./styles.css">';
  html=/<\/head>/i.test(html)?html.replace(/<\/head>/i,`${link}</head>`):html.replace(/<html([^>]*)>/i,`<html$1><head>${link}</head>`);
  return {status:'PASS',html,css,safety};
}
function runProcess(command,args,{timeoutMs=12*60*1000,maxStdoutBytes=8*1024*1024,maxStderrBytes=2*1024*1024}={}){
  return new Promise(resolve=>{
    const started=Date.now(),child=spawn(command,args,{stdio:['ignore','pipe','pipe']});
    const out=[],err=[];let outBytes=0,errBytes=0,timedOut=false,outputLimit=false,settled=false;
    const stop=()=>{try{child.kill('SIGTERM')}catch{};setTimeout(()=>{if(child.exitCode===null)try{child.kill('SIGKILL')}catch{}},900)};
    const capture=(chunks,b,used,limit)=>{const left=Math.max(0,limit-used);if(left>0)chunks.push(b.length<=left?b:b.subarray(0,left));return used+b.length};
    child.stdout.on('data',b=>{outBytes=capture(out,b,outBytes,maxStdoutBytes);if(outBytes>maxStdoutBytes&&!outputLimit){outputLimit=true;stop()}});
    child.stderr.on('data',b=>{errBytes=capture(err,b,errBytes,maxStderrBytes);if(errBytes>maxStderrBytes&&!outputLimit){outputLimit=true;stop()}});
    const timer=setTimeout(()=>{timedOut=true;stop()},timeoutMs);
    child.once('error',error=>{if(settled)return;settled=true;clearTimeout(timer);resolve({status:'FAIL',reason:'PROCESS_ERROR',error:String(error),duration_ms:Date.now()-started,stdout:Buffer.concat(out).toString('utf8'),stderr:Buffer.concat(err).toString('utf8'),stdout_bytes:outBytes,stderr_bytes:errBytes})});
    child.once('exit',(code,signal)=>{if(settled)return;settled=true;clearTimeout(timer);const reason=outputLimit?'OUTPUT_LIMIT':timedOut?'TIMEOUT':code===0?null:'PROCESS_EXIT';resolve({
      status:reason===null?'PASS':'FAIL',reason,code,signal,duration_ms:Date.now()-started,
      stdout:Buffer.concat(out).toString('utf8'),stderr:Buffer.concat(err).toString('utf8'),stdout_bytes:outBytes,stderr_bytes:errBytes
    })});
  });
}

function stageReceipt(result,prompt,tokens){
  return {status:result.status,reason:result.reason||null,duration_ms:result.duration_ms,code:result.code??null,signal:result.signal??null,prompt_sha256:crypto.createHash('sha256').update(prompt).digest('hex'),max_tokens:tokens,stdout_bytes:result.stdout_bytes||0,stderr_bytes:result.stderr_bytes||0};
}
async function runUigenStage({label,prompt,modelPath,llamaCli,tokens,threads,timeoutMs}){
  const promptFile=path.join(path.dirname(modelPath),`.webforge-uigen-${label}-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(promptFile,prompt);
  try{
    const result=await runProcess(llamaCli,[
      '--model',modelPath,'--file',promptFile,'--ctx-size','8192','--n-predict',String(tokens),
      '--threads',String(threads),'--seed','42','--temp','0.2','--repeat-penalty','1.1','--no-display-prompt','--no-conversation','--single-turn','--simple-io','--log-disable'
    ],{timeoutMs});
    return {...result,receipt:stageReceipt(result,prompt,tokens)};
  } finally {try{fs.rmSync(promptFile,{force:true})}catch{}}
}

export async function runUigenFxGeneration({brief,designSpec,modelPath,modelReadiness=null,llamaCli='llama-cli',maxTokens=768,threads=8,timeoutMs}={}){
  const readiness=modelReadiness?.status==='PASS'&&modelReadiness.path===modelPath?modelReadiness:inspectUigenFxModel(modelPath);
  if(readiness.status!=='PASS') return {status:readiness.status,reason:readiness.reason,readiness};
  const totalBudget=Math.max(512,Number(maxTokens)||768),bodyTokens=Math.max(300,Math.round(totalBudget*.56)),cssTokens=Math.max(192,totalBudget-bodyTokens);
  const stageTimeout=timeoutMs?Math.max(60_000,Math.floor(timeoutMs/2)):6*60*1000,started=Date.now();
  const bodyPrompt=buildUigenFxPrompt({brief,designSpec});
  const bodyGeneration=await runUigenStage({label:'body',prompt:bodyPrompt,modelPath,llamaCli,tokens:bodyTokens,threads,timeoutMs:stageTimeout});
  const bodyParsed=bodyGeneration.status==='PASS'?extractUigenFxBodyStage(bodyGeneration.stdout):{status:'FAIL',reason:bodyGeneration.reason||'BODY_GENERATION_FAILED'};
  bodyGeneration.receipt.sanitized_style_blocks=bodyParsed.sanitized_style_blocks||0;
  if(bodyParsed.status!=='PASS') return {status:bodyParsed.status,reason:bodyParsed.reason,duration_ms:Date.now()-started,model:readiness.model,model_sha256:readiness.sha256,stages:{body:bodyGeneration.receipt},stage_outputs:{body:bodyGeneration.stdout||''}};

  const cssPrompt=buildUigenFxCssPrompt({brief,designSpec,body:bodyParsed.body});
  const cssGeneration=await runUigenStage({label:'css',prompt:cssPrompt,modelPath,llamaCli,tokens:cssTokens,threads,timeoutMs:stageTimeout});
  const cssParsed=cssGeneration.status==='PASS'?extractUigenFxStyleStage(cssGeneration.stdout):{status:'FAIL',reason:cssGeneration.reason||'CSS_GENERATION_FAILED'};
  if(cssParsed.status!=='PASS') return {status:cssParsed.status,reason:cssParsed.reason,duration_ms:Date.now()-started,model:readiness.model,model_sha256:readiness.sha256,stages:{body:bodyGeneration.receipt,css:cssGeneration.receipt},stage_outputs:{body:bodyGeneration.stdout||'',css:cssGeneration.stdout||''}};

  const document=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UIGEN-FX candidate</title>${cssParsed.style}</head>${bodyParsed.body}</html>`;
  const safety=validateExternalCandidateSource(document);
  if(safety.status!=='PASS') return {status:'BLOCKED',reason:'UNSAFE_GENERATED_SOURCE',duration_ms:Date.now()-started,model:readiness.model,model_sha256:readiness.sha256,safety,stages:{body:bodyGeneration.receipt,css:cssGeneration.receipt},stage_outputs:{body:bodyGeneration.stdout||'',css:cssGeneration.stdout||''}};
  const combinedPromptHash=crypto.createHash('sha256').update(bodyPrompt+'\n---STYLE-STAGE---\n'+cssPrompt).digest('hex');
  return {status:'PASS',reason:null,duration_ms:Date.now()-started,stdout:document,model:readiness.model,model_sha256:readiness.sha256,prompt_sha256:combinedPromptHash,generation_mode:'two-stage-bounded-html-css',stages:{body:bodyGeneration.receipt,css:cssGeneration.receipt},stage_outputs:{body:bodyGeneration.stdout||'',css:cssGeneration.stdout||''},safety};
}

export const UIGEN_FX_STRUCTURED_SCHEMA=DESIGN_DIRECTION_SCHEMA;
export const validateUigenFxStructuredPlan=validateDesignDirectionPlan;
function structuredDesignContext(designSpec){
  return {
    direction:designSpec.direction,target_users:designSpec.target_users,critical_journeys:designSpec.critical_journeys,
    layout:{grid:designSpec.layout?.grid,density:designSpec.layout?.density,information_hierarchy:(designSpec.layout?.information_hierarchy||[]).map(x=>({id:x.id,path:x.path,purpose:x.purpose}))},
    components:(designSpec.components||[]).map(x=>({id:x.id,role:x.role,template:x.template}))
  };
}
export function buildUigenFxStructuredPrompt({brief,designSpec}){
  return [
    'You are a bounded design-direction challenger inside the WEBFORGE generator tournament.',
    'Return exactly one JSON object matching the supplied schema. No prose, HTML, CSS, JavaScript, markdown or URLs.',
    'Choose four DISTINCT section roles. Use the brief and WEBFORGE design context; do not collapse unrelated briefs into the same universal SaaS layout.',
    'The plan is advisory only. WEBFORGE will deterministically render and verify it.',
    `BRIEF: ${brief}`,`DESIGN_CONTEXT: ${JSON.stringify(structuredDesignContext(designSpec))}`
  ].join('\n');
}
export function extractUigenFxStructuredPlan(raw){
  const candidates=[...String(raw||'').matchAll(/\{[^{}]*\}/g)].map(m=>m[0]).reverse();
  for(const candidate of candidates){
    try{const parsed=JSON.parse(candidate),checked=validateUigenFxStructuredPlan(parsed);if(checked.status==='PASS')return {...checked,raw_json:candidate};}catch{}
  }
  return {status:'FAIL',reason:'STRUCTURED_PLAN_JSON_NOT_FOUND'};
}
export async function runUigenFxStructuredGeneration({brief,designSpec,modelPath,modelReadiness=null,llamaCli='llama-cli',maxTokens=128,threads=8,timeoutMs}={}){
  const readiness=modelReadiness?.status==='PASS'&&modelReadiness.path===modelPath?modelReadiness:inspectUigenFxModel(modelPath);
  if(readiness.status!=='PASS')return {status:readiness.status,reason:readiness.reason,readiness};
  const prompt=buildUigenFxStructuredPrompt({brief,designSpec});
  const tokens=Math.min(160,Math.max(96,Number(maxTokens)||128));
  const promptFile=path.join(path.dirname(modelPath),`.webforge-uigen-plan-${process.pid}-${Date.now()}.txt`);
  const schemaFile=path.join(path.dirname(modelPath),`.webforge-uigen-plan-${process.pid}-${Date.now()}.schema.json`);
  fs.writeFileSync(promptFile,prompt);fs.writeFileSync(schemaFile,JSON.stringify(UIGEN_FX_STRUCTURED_SCHEMA));
  try{
    const result=await runProcess(llamaCli,[
      '--model',modelPath,'--file',promptFile,'--ctx-size','4096','--n-predict',String(tokens),
      '--threads',String(threads),'--seed','42','--temp','0.2','--repeat-penalty','1.1','--json-schema-file',schemaFile,
      '--no-display-prompt','--no-conversation','--no-jinja','--single-turn','--simple-io','--log-disable'
    ],{timeoutMs:timeoutMs||3*60*1000,maxStdoutBytes:512*1024,maxStderrBytes:256*1024});
    const parsed=result.status==='PASS'?extractUigenFxStructuredPlan(result.stdout):{status:'FAIL',reason:result.reason||'STRUCTURED_GENERATION_FAILED'};
    return {
      status:parsed.status,reason:parsed.reason||null,duration_ms:result.duration_ms,model:readiness.model,model_sha256:readiness.sha256,
      prompt_sha256:crypto.createHash('sha256').update(prompt).digest('hex'),generation_mode:'structured-plan-deterministic-render',
      structured_plan:parsed.plan||null,raw_output:result.stdout||'',stages:{plan:stageReceipt(result,prompt,tokens)},
      truth_boundary:{model_output_code:false,deterministic_renderer:true,release_authority:'NONE',production_authority:'NONE'}
    };
  } finally {try{fs.rmSync(promptFile,{force:true});fs.rmSync(schemaFile,{force:true})}catch{}}
}
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function label(value){return String(value||'').replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase());}
function staticPages(designSpec,behaviorSpec){
  const familyByPath=new Map();
  for(const journey of behaviorSpec.journeys||[])for(const step of journey.steps||[])if(step.path&&!step.dynamic)familyByPath.set(step.path,{id:step.page_id,family:step.family||'overview'});
  for(const page of behaviorSpec.form_pages||[])familyByPath.set(page.path,{id:page.page_id,family:page.family});
  const pages=[];
  for(const item of designSpec.layout?.information_hierarchy||[]){
    if(!item.path||item.path.includes('['))continue;
    const normalized=item.path==='/'?'/':`/${String(item.path).replace(/^\/+|\/+$/g,'')}/`;
    const known=familyByPath.get(normalized)||{};
    pages.push({id:known.id||item.id,path:normalized,family:known.family||(item.purpose==='transact'?'action':item.purpose==='contact'?'contact':'overview'),purpose:item.purpose||'overview'});
  }
  for(const [p,known] of familyByPath)if(!pages.some(x=>x.path===p))pages.push({id:known.id,path:p,family:known.family,purpose:known.family});
  return pages.filter((x,i,a)=>a.findIndex(y=>y.path===x.path)===i);
}
function routeForIntent(intent,pages){
  const pick=id=>pages.find(x=>x.id===id)?.path;
  if(intent==='transact')return pick('transaction')||pick('pricing')||pick('contact')||'/';
  if(intent==='contact')return pick('contact')||'/';
  return pages.find(x=>x.path!=='/'&&!['action','contact'].includes(x.family))?.path||pick('contact')||'/';
}
function sectionMarkup(role,{brief,direction,keywords,ctaPath}){
  const intent=esc(direction||brief),key=esc((keywords||[]).slice(0,3).join(' · '));
  const common=`<p>${intent}</p>`;
  if(role==='offer')return `<section id="offer" class="wf-section role-offer"><h2>What this experience is built around</h2>${common}<div class="cards"><article>Primary offer</article><article>Decision support</article><article>Next action</article></div></section>`;
  if(role==='proof')return `<section id="proof" class="wf-section role-proof"><h2>Signals before claims</h2><p>${key||intent}</p><blockquote>Evidence stays explicit; unverified facts stay provisional.</blockquote></section>`;
  if(role==='process')return `<section id="process" class="wf-section role-process"><h2>A clear path forward</h2><ol><li>Orient</li><li>Evaluate</li><li>Act with confidence</li></ol></section>`;
  if(role==='gallery')return `<section id="gallery" class="wf-section role-gallery"><h2>Visual rhythm</h2><div class="visual-grid"><div></div><div></div><div></div></div></section>`;
  if(role==='faq')return `<section id="faq" class="wf-section role-faq"><h2>Questions before the next step</h2><details><summary>What should I know first?</summary>${common}</details><details><summary>What happens next?</summary><p>Choose the route that matches your intent.</p></details></section>`;
  if(role==='pricing')return `<section id="pricing" class="wf-section role-pricing"><h2>Decision-ready path</h2><p>No invented prices. Continue to the real transaction or pricing route when available.</p><a class="cta primary" href="${esc(ctaPath)}">Continue</a></section>`;
  if(role==='integrations')return `<section id="integrations" class="wf-section role-integrations"><h2>Connected ecosystem</h2><div class="chips"><span>Core workflow</span><span>Supporting tools</span><span>Operational context</span></div></section>`;
  return `<section id="contact" class="wf-section role-contact"><h2>Start the next step</h2>${common}<a class="cta primary" href="${esc(ctaPath)}">Continue</a></section>`;
}
function structuredCss(plan){
  const palette={warm:['#f6f1e8','#2b2721','#a85f3d','#fffaf2'],cool:['#edf3f7','#14222d','#256783','#f8fbfd'],neutral:['#f4f4f1','#222421','#5c665e','#ffffff'],contrast:['#f6f6f2','#111111','#e04f2f','#ffffff']}[plan.palette];
  const [bg,text,accent,surface]=palette,radius=plan.shape==='sharp'?'2px':plan.shape==='pill'?'28px':'14px';
  const space=plan.density==='airy'?'clamp(3.5rem,8vw,7rem)':plan.density==='dense'?'clamp(1.8rem,4vw,3.4rem)':'clamp(2.6rem,6vw,5rem)';
  const heroCols=plan.hero==='text-led'?'1.4fr .6fr':plan.hero==='media-led'?'.75fr 1.25fr':'1fr 1fr';
  const wrapCols=plan.archetype==='grid'?'repeat(2,minmax(0,1fr))':plan.archetype==='showcase'?'minmax(0,1.45fr) minmax(240px,.55fr)':'1fr';
  const navGap=plan.nav==='compact'?'.7rem':plan.nav==='prominent'?'1.6rem':'1rem';
  return `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:${text};background:${bg}}*{box-sizing:border-box}body{margin:0;background:${bg};color:${text};line-height:1.55}a{color:inherit}.shell{width:min(1180px,calc(100% - 32px));margin:auto}header{position:sticky;top:0;background:${bg};border-bottom:1px solid color-mix(in srgb,${text} 16%,transparent);z-index:2}.nav{display:flex;align-items:center;justify-content:space-between;gap:${navGap};padding:1rem 0}.nav-links{display:flex;flex-wrap:wrap;gap:${navGap};list-style:none;padding:0;margin:0}.nav a{text-decoration:none}.brand{font-weight:800}.hero{display:grid;grid-template-columns:${heroCols};gap:clamp(1.5rem,5vw,5rem);align-items:center;padding:${space} 0}.hero h1{font-size:clamp(2.6rem,7vw,6.6rem);line-height:.95;letter-spacing:-.055em;margin:.2em 0}.hero p{font-size:clamp(1rem,2vw,1.25rem);max-width:62ch}.visual-panel{min-height:320px;border-radius:${radius};background:linear-gradient(145deg,${surface},color-mix(in srgb,${accent} 35%,${surface}));border:1px solid color-mix(in srgb,${text} 15%,transparent)}.section-wrap{display:grid;grid-template-columns:${wrapCols};gap:1.25rem;padding-bottom:${space}}.wf-section{padding:clamp(1.5rem,4vw,3rem);border-radius:${radius};background:${surface};border:1px solid color-mix(in srgb,${text} 13%,transparent)}.wf-section h2{font-size:clamp(1.7rem,4vw,3.2rem);line-height:1.05;margin-top:0}.cards,.visual-grid,.chips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.8rem}.cards article,.chips span,.visual-grid div{padding:1rem;border:1px solid color-mix(in srgb,${text} 14%,transparent);border-radius:${radius}}.visual-grid div{min-height:150px;background:linear-gradient(135deg,color-mix(in srgb,${accent} 18%,${surface}),${surface})}.cta{display:inline-flex;padding:.8rem 1.1rem;border-radius:${radius};text-decoration:none;font-weight:800}.cta.primary{background:${accent};color:white}.route-page{padding:${space} 0;max-width:820px}.route-page form{display:grid;gap:.8rem}.route-page input,.route-page textarea,.route-page button{font:inherit;padding:.8rem;border:1px solid color-mix(in srgb,${text} 25%,transparent);border-radius:${radius};background:${surface};color:${text}}footer{padding:2rem 0 4rem;border-top:1px solid color-mix(in srgb,${text} 13%,transparent)}@media(max-width:760px){.nav{align-items:flex-start}.nav-links{font-size:.9rem}.hero,.section-wrap{grid-template-columns:1fr}.cards,.visual-grid,.chips{grid-template-columns:1fr}.hero h1{font-size:clamp(2.5rem,13vw,4.8rem)}.visual-panel{min-height:220px}}`;
}
function navigationHtml(pages,{limit=8}={}){
  const available=pages.filter(x=>x.path!=='/'),shown=Number.isFinite(limit)?available.slice(0,Math.max(0,limit)):available;
  const links=shown.map(x=>`<li><a href="${esc(x.path)}">${esc(label(x.id))}</a></li>`).join('');
  return `<header><div class="shell nav"><a class="brand" href="/">WEBFORGE candidate</a><nav aria-label="Primary"><ul class="nav-links">${links}</ul></nav></div></header>`;
}
function formBlock(){return `<div data-wf-form-root data-ui-state="empty"><form novalidate><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Details<textarea name="details" required></textarea></label><button type="submit">Continue</button></form></div><script>(()=>{const root=document.querySelector('[data-wf-form-root]'),form=root.querySelector('form');form.addEventListener('submit',e=>{e.preventDefault();let invalid=0;for(const el of form.querySelectorAll('[required]')){const bad=!String(el.value||'').trim();el.toggleAttribute('aria-invalid',bad);if(bad)invalid++}root.dataset.uiState=invalid?'error':'success';});})();</script>`;}
function renderStructuredHome({brief,designSpec,behaviorSpec,plan,candidateLabel='Bounded UIGEN-FX structured challenger · WEBFORGE deterministic renderer'}){
  const pages=staticPages(designSpec,behaviorSpec),ctaPath=routeForIntent(plan.cta,pages),sections=[plan.section_1,plan.section_2,plan.section_3,plan.section_4];
  const direction=designSpec.direction?.intent||brief,keywords=designSpec.direction?.keywords||[];
  const sectionHtml=sections.map(role=>sectionMarkup(role,{brief,direction,keywords,ctaPath})).join('');
  const title=label(designSpec.direction?.name||'WEBFORGE candidate');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="./styles.css"></head><body class="archetype-${esc(plan.archetype)} rhythm-${esc(plan.rhythm)}">${navigationHtml(pages)}<main class="shell" data-page="home" data-family="home"><section id="hero" class="hero hero-${esc(plan.hero)}"><div><p>${esc((keywords||[]).slice(0,3).join(' · '))}</p><h1>${esc(direction)}</h1><p>${esc(brief)}</p><a class="cta primary" href="${esc(ctaPath)}">${plan.cta==='transact'?'Continue to action':plan.cta==='contact'?'Contact':'Explore'}</a></div><div class="visual-panel" aria-hidden="true"></div></section><div class="section-wrap">${sectionHtml}</div></main><footer><div class="shell">${esc(candidateLabel)}</div></footer></body></html>`;
  return {html,css:structuredCss(plan),pages};
}
function renderStructuredRoute({page,pages,plan}){
  const isForm=['action','contact'].includes(page.family),form=isForm?formBlock():'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(label(page.id))} — WEBFORGE candidate</title><link rel="stylesheet" href="/styles.css"></head><body>${navigationHtml(pages,{limit:Infinity})}<main class="shell route-page" data-page="${esc(page.id)}" data-family="${esc(page.family)}"><p>${esc(label(page.family))}</p><h1>${esc(label(page.id))}</h1><p>This static route exists to verify the same declared WEBFORGE journey contract without granting the model routing or runtime authority.</p>${form}</main><footer><div class="shell">Structured challenger route scaffold</div></footer></body></html>`;
}
export function materializeStructuredCandidate({brief,designSpec,behaviorSpec,root,generation,generatorId='uigen-fx-4b',candidateLabel='Bounded UIGEN-FX structured challenger · WEBFORGE deterministic renderer'}){
  fs.mkdirSync(root,{recursive:true});copySpecs(root,designSpec,behaviorSpec);
  fs.writeFileSync(path.join(root,'model-output.structured.raw.txt'),generation.raw_output||'');
  writeJson(root,'uigen-structured-plan.json',generation.structured_plan);
  const rendered=renderStructuredHome({brief,designSpec,behaviorSpec,plan:generation.structured_plan,candidateLabel});
  fs.writeFileSync(path.join(root,'index.html'),rendered.html);fs.writeFileSync(path.join(root,'styles.css'),rendered.css+'\n');
  for(const page of rendered.pages.filter(x=>x.path!=='/')){const dir=routeDir(root,page.path);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),renderStructuredRoute({page,pages:rendered.pages,plan:generation.structured_plan}));}
  writeJson(root,'candidate.meta.json',{schema:'webforge.generator-candidate.v1',generator:generatorId,status:'PASS',generation_mode:generation.generation_mode,structured_plan:generation.structured_plan,model:generation.model||null,model_sha256:generation.model_sha256||null,prompt_sha256:generation.prompt_sha256||null,duration_ms:generation.duration_ms||null,truth_boundary:generation.truth_boundary||{release_authority:'NONE',production_authority:'NONE'}});
  return {status:'PASS',root};
}

function materializeNativeCandidate({plan,designSpec,behaviorSpec,root,id}){
  fs.mkdirSync(root,{recursive:true});
  const mediaAssets=writeMediaAssets(root,plan.visual,`tournament|${id}|${plan.project.brief}`);
  for(const slot of plan.visual.media.slots) slot.src=mediaAssets[slot.id]||null;
  for(const section of plan.visual.sections) for(const slot of section.media||[]) slot.src=mediaAssets[slot.id]||null;
  copySpecs(root,designSpec,behaviorSpec);
  fs.writeFileSync(path.join(root,'index.html'),renderWebsite(plan,plan.visual,`tournament-${id}`));
  fs.writeFileSync(path.join(root,'styles.css'),renderCss(plan.visual));
  for(const page of plan.siteBlueprint.pages.filter(x=>!x.dynamic&&x.path!=='/')){
    const dir=routeDir(root,page.path);fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'index.html'),renderBlueprintPage(plan,plan.visual,page));
  }
  writeJson(root,'candidate.meta.json',{schema:'webforge.generator-candidate.v1',generator:'webforge-native',brief:plan.project.brief,status:'PASS'});
  return {status:'PASS',root};
}

function materializeExternalCandidate({raw,designSpec,behaviorSpec,root,generation}){
  fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,'model-output.raw.txt'),String(raw||''));
  if(generation?.stage_outputs?.body)fs.writeFileSync(path.join(root,'model-output.body.raw.txt'),generation.stage_outputs.body);
  if(generation?.stage_outputs?.css)fs.writeFileSync(path.join(root,'model-output.css.raw.txt'),generation.stage_outputs.css);
  copySpecs(root,designSpec,behaviorSpec);
  const parsed=extractUigenFxCandidate(raw);
  const generationEvidence={model:generation?.model||UIGEN_FX_MODEL,model_sha256:generation?.model_sha256||null,prompt_sha256:generation?.prompt_sha256||null,duration_ms:generation?.duration_ms||null,generation_mode:generation?.generation_mode||'single-stage-legacy',stages:generation?.stages||null};
  if(parsed.status!=='PASS'){
    writeJson(root,'candidate.meta.json',{schema:'webforge.generator-candidate.v1',generator:'uigen-fx-4b',status:parsed.status,reason:parsed.reason,safety:parsed.safety||null,...generationEvidence});
    return {...parsed,root};
  }
  fs.writeFileSync(path.join(root,'index.html'),parsed.html);
  fs.writeFileSync(path.join(root,'styles.css'),parsed.css+'\n');
  writeJson(root,'candidate.meta.json',{schema:'webforge.generator-candidate.v1',generator:'uigen-fx-4b',status:'PASS',...generationEvidence,safety:parsed.safety});
  return {status:'PASS',root};
}

function behaviorCoverage(receipt,spec){
  if(!receipt||!spec) return 0;
  let expected=0,pass=0;
  const actualJourneys=new Map((receipt.journeys||[]).map(x=>[x.id,x]));
  for(const journey of spec.journeys||[]){
    const actual=actualJourneys.get(journey.id);const actualSteps=new Map((actual?.steps||[]).map(x=>[x.index,x]));
    for(const step of journey.steps||[]){if(step.dynamic)continue;expected++;if(actualSteps.get(step.index)?.status==='PASS')pass++;}
  }
  const actualForms=new Map((receipt.form_checks||[]).map(x=>[x.page_id,x]));
  for(const form of spec.form_pages||[]){expected++;if(actualForms.get(form.page_id)?.status==='PASS')pass++;}
  return expected?pass/expected:0;
}
function qualityCoverage(receipt){
  const required=(receipt?.viewports||[]).flatMap(v=>v.required||[]);
  return required.length?required.filter(x=>x.status==='PASS').length/required.length:0;
}

function attr(tag,name){return String(tag||'').match(new RegExp(`\\b${name}=["']([^"']*)["']`,'i'))?.[1]||'';}
function genericStructure(root){
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  const sections=[...html.matchAll(/<section\b[^>]*>/gi)].map(m=>{const tag=m[0],id=attr(tag,'id'),classes=attr(tag,'class').split(/\s+/).filter(Boolean);return id||classes.slice(0,2).join('.')||'section';});
  const headings=[...html.matchAll(/<h([1-3])\b[^>]*>/gi)].map(m=>`h${m[1]}`);
  const nav=html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i)?.[1]||'';
  const navTargets=[...nav.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map(m=>m[1].replace(/[?#].*$/,''));
  const ctas=[...html.matchAll(/<a\b([^>]*)href=["']([^"']+)["'][^>]*>/gi)].filter(m=>/(?:primary|button|cta)/i.test(m[1])).map(m=>m[2].replace(/[?#].*$/,''));
  const grids=[...css.matchAll(/grid-template-columns\s*:\s*([^;}]+)/gi)].map(m=>m[1].replace(/\s+/g,' ').trim()).slice(0,30);
  return {sections,headings,navTargets,ctas,grids};
}
function structureDistance(a,b){
  const metrics={
    sections:structuralSequenceDistance(a.sections,b.sections),headings:structuralSequenceDistance(a.headings,b.headings),
    nav:structuralSequenceDistance(a.navTargets,b.navTargets),ctas:structuralSequenceDistance(a.ctas,b.ctas),grids:structuralSequenceDistance(a.grids,b.grids)
  };
  const composite=.40*metrics.sections+.15*metrics.headings+.15*metrics.nav+.15*metrics.ctas+.15*metrics.grids;
  return {...metrics,composite:Number(composite.toFixed(3))};
}
function diversityFor(samples){
  const pairs=[];for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++)pairs.push({pair:[samples[i].id,samples[j].id],...structureDistance(samples[i].structure,samples[j].structure)});
  const minimum=pairs.length?Math.min(...pairs.map(x=>x.composite)):0;
  const average=pairs.length?pairs.reduce((n,x)=>n+x.composite,0)/pairs.length:0;
  return {sample_count:samples.length,minimum_composite_distance:Number(minimum.toFixed(3)),average_composite_distance:Number(average.toFixed(3)),pairs};
}
async function evaluateCandidate(root,behaviorSpec){
  const quality=await runWebUiQualityMatrix(root,{writeReceipt:true,visualRegression:false});
  const behavior=[];
  for(const viewport of WEB_UI_VIEWPORTS){
    const receipt=await runWebUiBehaviorVerifier(root,{writeReceipt:false,viewport:{width:viewport.width,height:viewport.height}});
    behavior.push({viewport,receipt});
    writeJson(root,`web-ui-behavior.${viewport.id}.receipt.json`,receipt);
  }
  const behaviorCoverageAverage=behavior.reduce((n,x)=>n+behaviorCoverage(x.receipt,behaviorSpec),0)/behavior.length;
  const behaviorStatuses=behavior.map(x=>x.receipt.status);
  const status=quality.status==='FAIL'||behaviorStatuses.includes('FAIL')?'FAIL':quality.status==='PASS'&&behaviorStatuses.every(x=>x==='PASS')?'PASS':'UNVERIFIED';
  const evaluation={
    schema:'webforge.generator-candidate-evaluation.v1',status,
    quality,behavior:behavior.map(x=>({viewport:x.viewport,status:x.receipt.status,coverage:Number(behaviorCoverage(x.receipt,behaviorSpec).toFixed(3)),receipt:x.receipt})),
    quality_coverage:Number(qualityCoverage(quality).toFixed(3)),behavior_coverage:Number(behaviorCoverageAverage.toFixed(3)),
    structure:genericStructure(root),truth_boundary:{human_visual_review_required:true,release_authority:'NONE',production_authority:'NONE'}
  };
  writeJson(root,'candidate.evaluation.json',evaluation);
  return evaluation;
}

function average(xs){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;}
function candidateScore({cases,diversity,diversityBaseline,fastestGenerationMs}){
  if(!cases.length) return {total:0,quality:0,behavior:0,diversity:0,efficiency:0};
  const quality=average(cases.map(x=>x.evaluation?.quality_coverage||0));
  const behavior=average(cases.map(x=>x.evaluation?.behavior_coverage||0));
  const sampleCoverage=Math.min(1,(diversity?.sample_count||0)/cases.length);
  const diversityRatio=diversityBaseline>0?Math.min(1,(diversity?.minimum_composite_distance||0)/diversityBaseline)*sampleCoverage:0;
  const generationMs=average(cases.map(x=>Math.max(1,x.generation_ms||1)));
  const efficiency=Math.min(1,fastestGenerationMs/Math.max(1,generationMs));
  const completion=cases.filter(x=>x.evaluation).length/cases.length;
  const parts={quality:quality*40,behavior:behavior*30,diversity:diversityRatio*20,efficiency:efficiency*10};
  return {...Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,Number(v.toFixed(2))])),total:Number(Object.values(parts).reduce((a,b)=>a+b,0).toFixed(2)),raw:{quality,behavior,diversityRatio,sampleCoverage,completion,generationMs,efficiency}};
}
export async function runGeneratorTournament(entries,{outputRoot,modelPath,externalGenerator=runUigenFxStructuredGeneration,candidateEvaluator=evaluateCandidate,maxTokens=128,threads=8}={}){
  if(!Array.isArray(entries)||entries.length<2) throw new Error('Generator tournament requires at least two briefs');
  if(!outputRoot) throw new Error('Generator tournament requires an explicit outputRoot outside canonical generation paths');
  const ids=entries.map(x=>safeId(x.id));if(new Set(ids).size!==ids.length) throw new Error('Generator tournament case ids must be unique');
  const runId=`run-${new Date().toISOString().replace(/[:.]/g,'-')}`;
  const root=path.join(path.resolve(outputRoot),runId);fs.mkdirSync(root,{recursive:true});
  const sharedModelReadiness=[runUigenFxStructuredGeneration,runUigenFxGeneration].includes(externalGenerator)?inspectUigenFxModel(modelPath):null;
  if(sharedModelReadiness&&sharedModelReadiness.status!=='PASS'){
    const blocked={schema:GENERATOR_TOURNAMENT_SCHEMA,created_at:now(),status:sharedModelReadiness.status,run_id:runId,model:sharedModelReadiness.model,reason:sharedModelReadiness.reason,promotion:{winner:null,status:'BLOCKED'},truth_boundary:{release_gate_changed:false,default_generator_changed:false,release_authority:'NONE',production_authority:'NONE'},cases:[]};
    writeJson(root,'generator-tournament.receipt.json',blocked);return {...blocked,output_root:root};
  }
  const cases=[];
  for(let i=0;i<entries.length;i++){
    const entry=entries[i],id=ids[i],caseRoot=path.join(root,id);fs.mkdirSync(caseRoot,{recursive:true});
    const plan=compose(entry.brief),designSpec=compileWebUIDesignSpec(plan),behaviorSpec=compileWebUiBehaviorSpec(plan);
    writeJson(caseRoot,'tournament.input.json',{schema:'webforge.generator-tournament-input.v1',id,brief:entry.brief,design_spec:designSpec,behavior_spec:behaviorSpec});

    const nativeRoot=path.join(caseRoot,'webforge-native'),nativeStart=Date.now();
    materializeNativeCandidate({plan,designSpec,behaviorSpec,root:nativeRoot,id});
    const nativeGenerationMs=Date.now()-nativeStart,nativeEvaluation=await candidateEvaluator(nativeRoot,behaviorSpec);

    const externalRoot=path.join(caseRoot,'uigen-fx-4b');
    const generation=await externalGenerator({brief:entry.brief,designSpec,modelPath,modelReadiness:sharedModelReadiness,maxTokens,threads});
    let externalMaterialized=null,externalEvaluation=null;
    if(generation.status==='PASS'){
      externalMaterialized=generation.structured_plan
        ?materializeStructuredCandidate({brief:entry.brief,designSpec,behaviorSpec,root:externalRoot,generation})
        :materializeExternalCandidate({raw:generation.stdout,designSpec,behaviorSpec,root:externalRoot,generation});
      if(externalMaterialized.status==='PASS') externalEvaluation=await candidateEvaluator(externalRoot,behaviorSpec);
    }else{
      fs.mkdirSync(externalRoot,{recursive:true});copySpecs(externalRoot,designSpec,behaviorSpec);
      if(generation.raw_output)fs.writeFileSync(path.join(externalRoot,'model-output.structured.raw.txt'),generation.raw_output);
      if(generation.stage_outputs?.body)fs.writeFileSync(path.join(externalRoot,'model-output.body.raw.txt'),generation.stage_outputs.body);
      if(generation.stage_outputs?.css)fs.writeFileSync(path.join(externalRoot,'model-output.css.raw.txt'),generation.stage_outputs.css);
      writeJson(externalRoot,'candidate.meta.json',{schema:'webforge.generator-candidate.v1',generator:'uigen-fx-4b',status:generation.status,reason:generation.reason||'GENERATION_FAILED',model:generation.model||UIGEN_FX_MODEL,model_sha256:generation.model_sha256||null,duration_ms:generation.duration_ms||null,generation_mode:generation.generation_mode||'structured-plan-deterministic-render',stages:generation.stages||null,safety:generation.safety||null,truth_boundary:generation.truth_boundary||null});
    }
    cases.push({
      id,brief:entry.brief,design_spec_sha256:crypto.createHash('sha256').update(JSON.stringify(designSpec)).digest('hex'),
      native:{root:nativeRoot,generation_ms:nativeGenerationMs,evaluation:nativeEvaluation},
      external:{root:externalRoot,generation_ms:generation.duration_ms||0,generation_status:generation.status,generation_reason:generation.reason||null,generation_mode:generation.generation_mode||null,evaluation:externalEvaluation,materialization_status:externalMaterialized?.status||null}
    });
  }
  const nativeSamples=cases.map(x=>({id:x.id,structure:x.native.evaluation.structure}));
  const externalSamples=cases.filter(x=>x.external.evaluation).map(x=>({id:x.id,structure:x.external.evaluation.structure}));
  const nativeDiversity=diversityFor(nativeSamples),externalDiversity=diversityFor(externalSamples);
  const nativeAvgMs=average(cases.map(x=>x.native.generation_ms));
  const externalAvgMs=average(cases.map(x=>Math.max(1,x.external.generation_ms||1)));
  const fastest=Math.max(1,Math.min(nativeAvgMs,externalAvgMs));
  const nativeCases=cases.map(x=>({evaluation:x.native.evaluation,generation_ms:x.native.generation_ms}));
  const externalCases=cases.map(x=>({evaluation:x.external.evaluation,generation_ms:x.external.generation_ms}));
  const baseline=nativeDiversity.minimum_composite_distance;
  const scores={
    'webforge-native':candidateScore({cases:nativeCases,diversity:nativeDiversity,diversityBaseline:baseline,fastestGenerationMs:fastest}),
    'uigen-fx-4b':candidateScore({cases:externalCases,diversity:externalDiversity,diversityBaseline:baseline,fastestGenerationMs:fastest})
  };
  const ordered=Object.entries(scores).sort((a,b)=>b[1].total-a[1].total);
  const objectiveLeader=ordered[0]?.[0]||null;
  const allExternalGenerated=cases.every(x=>x.external.generation_status==='PASS'&&x.external.evaluation);
  const aggregateEvaluationStatus=items=>items.includes('FAIL')?'FAIL':items.includes('UNVERIFIED')?'UNVERIFIED':items.length&&items.every(x=>x==='PASS')?'PASS':'UNVERIFIED';
  const candidateStatus={
    'webforge-native':aggregateEvaluationStatus(cases.map(x=>x.native.evaluation?.status||'UNVERIFIED')),
    'uigen-fx-4b':aggregateEvaluationStatus(cases.map(x=>x.external.evaluation?.status||'UNVERIFIED'))
  };
  const executionStatus=allExternalGenerated?'PASS':'UNVERIFIED';
  const reportStatus=executionStatus!=='PASS'?executionStatus:candidateStatus['uigen-fx-4b']==='FAIL'?'FAIL':'UNVERIFIED';
  const report={
    schema:GENERATOR_TOURNAMENT_SCHEMA,created_at:now(),status:reportStatus,execution_status:executionStatus,candidate_status:candidateStatus,comparison_status:'REVIEW_REQUIRED',run_id:runId,
    model:{...UIGEN_FX_MODEL,local_path:modelPath||null},dataset:{count:entries.length,ids},
    fairness:{same_brief:true,same_web_ui_design_spec:true,same_quality_gate:true,same_behavior_gate:true,external_candidate_scope:'UIGEN-FX selects a bounded enum-only design plan; WEBFORGE deterministically materializes safe static routes/forms. This measures integration value, not pure model code generation.'},
    diversity:{'webforge-native':nativeDiversity,'uigen-fx-4b':externalDiversity,normalization:'external diversity score is normalized against native minimum pair distance'},
    scores,objective_leader:objectiveLeader,
    promotion:{winner:null,status:'REVIEW_REQUIRED',reasons:['human perceptual review remains required','UIGEN-FX model is a research preview','tournament evidence does not grant release or production authority']},
    truth_boundary:{release_gate_changed:false,default_generator_changed:false,network_execution_only_for_model_artifact_acquisition:true,release_authority:'NONE',production_authority:'NONE'},
    cases:cases.map(x=>({id:x.id,brief:x.brief,design_spec_sha256:x.design_spec_sha256,native:{generation_ms:x.native.generation_ms,status:x.native.evaluation.status,quality_coverage:x.native.evaluation.quality_coverage,behavior_coverage:x.native.evaluation.behavior_coverage},external:{generation_ms:x.external.generation_ms,generation_status:x.external.generation_status,generation_reason:x.external.generation_reason,generation_mode:x.external.generation_mode,status:x.external.evaluation?.status||x.external.materialization_status||'UNVERIFIED',quality_coverage:x.external.evaluation?.quality_coverage??0,behavior_coverage:x.external.evaluation?.behavior_coverage??0}}))
  };
  writeJson(root,'generator-tournament.receipt.json',report);
  return {...report,output_root:root};
}
