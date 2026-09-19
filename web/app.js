const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const brief=$('#brief');
let currentPlan=null;
let currentReceipt=null;
let currentProjectId=null;
let currentStateless=null;
let previewObjectUrl=null;

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
async function jsonResponse(r){const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw new Error(`WEBFORGE server returned ${r.status}: ${text.slice(0,120)||'empty response'}`)}if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);return data}
function kv(k,v,selected=false){return `<div class="kv"><b>${escapeHtml(k)}</b><span class="${selected?'selected':''}">${escapeHtml(v)}</span></div>`}
function setJourney(stage,state){const el=$(`#journey-${stage}`);if(!el)return;el.classList.toggle('active',state==='active');el.classList.toggle('done',state==='done');const small=el.querySelector('small');if(small)small.textContent=state==='done'?'Hotovo':state==='active'?'Probíhá':'Čeká'}
function setReady(ready){const btn=$('#generate'),dry=$('#dryrun');btn.disabled=!ready;dry.disabled=!ready;$('#build-state').textContent=ready?'PŘIPRAVENO KE GENEROVÁNÍ':'ČEKÁ NA ANALÝZU';$('#build-dot').classList.toggle('ready',ready);$('#build-copy').textContent=ready?'Struktura i policy gate jsou vyřešené. Můžeš vygenerovat izolovaný preview web.':'Nejdřív spusť analýzu. Generování se odemkne pouze po průchodu policy gate.'}
function briefSynthesis(p){return p.project?.domain?.synthesis||p.domain?.synthesis||null}
function renderTechnical(p){const detail={domain:p.project.domain,product:{entities:p.product?.entities,userJobs:p.product?.userJobs,capabilities:p.product?.capabilityIds},designStrategy:p.designStrategy,layout:{id:p.layout.id,origin:p.layout.origin,parents:p.layout.parents,selectionReason:p.layout.selectionReason,signals:p.layout.signals,fingerprint:p.layout.fingerprint,sections:p.layout.sections,sectionPlan:p.layout.sectionPlan},siteBlueprint:p.siteBlueprint,runtime:p.selection.runtime,visual:{artDirection:p.visual.artDirection?.theme?.id,registry:p.visual.registry?.counts,templates:p.visual.sections?.map(x=>({id:x.id,template:x.template,quality:x.qualityScore})),mediaSlots:p.visual.media?.slots?.length,connectors:p.visual.connectors?.selected,plugins:p.visual.plugins?.selected?.map(x=>x.id),workflow:p.visual.workflow?.primary?.id,interactions:p.visual.interactions?.selected?.map(x=>x.id)}};$('#technical-plan').textContent=JSON.stringify(detail,null,2)}
function renderPlan(p){
  currentPlan=p;
  const synth=briefSynthesis(p);
  const locale=p.project.locale?.tag||p.project.domain?.locale?.tag||'en';
  const direction=synth?.direction?.id||p.designStrategy?.layout_strategy?.primary||p.layout.family;
  $('#project').innerHTML=kv('DOMÉNA',p.project.domainArchetype,true)+kv('LOCALE',locale)+kv('ÚČEL',p.project.primary_goal)+kv('SUBJECT',synth?.subject||p.brand.identity.name)+kv('ENTITY',p.product?.entities?.slice(0,4).map(x=>x.name).join(' · ')||'—');
  $('#stack').innerHTML=kv('BRAND',p.brand.identity.name,true)+kv('DIRECTION',direction,true)+kv('HERO',p.layout.hero)+kv('STRUKTURA',p.layout.sections.join(' → '))+kv('RUNTIME',`${p.selection.runtime.id.toUpperCase()} · ${p.selection.runtime.score}/100`)+kv('PAGES',String(p.siteBlueprint.pageCount));
  $('#capabilities').innerHTML=p.capabilities.map(x=>`<span class="chip">${escapeHtml(x)}</span>`).join('');
  $('#components').innerHTML=p.selection.components.map(x=>`<div class="component"><span>${escapeHtml(x.id)}</span><em>APPROVED</em></div>`).join('')||'<span class="muted">Žádná speciální component palette.</span>';
  $('#rejected').innerHTML=p.rejected.map(x=>`<div class="decision"><b>× ${escapeHtml(x.id)}</b><span>${escapeHtml(x.reason)}</span></div>`).join('')||'<span class="muted">Bez odmítnutých možností.</span>';
  $('#policy').textContent=p.policy.status;
  $('#analysis-check').textContent='PASS';
  $('#release').textContent=p.releaseEligible?'PŘIPRAVENO':'BLOKOVÁNO';
  $('#analysis-state').textContent=p.releaseEligible?'ANALÝZA HOTOVÁ':'VYŽADUJE POZORNOST';
  $('#analysis-state').classList.toggle('pass',p.releaseEligible);
  renderTechnical(p);
  $('#evidence').textContent=JSON.stringify(p.evidence,null,2);
  setReady(p.releaseEligible&&p.policy.status==='PASS');
  setJourney('brief','done');setJourney('analysis','done');setJourney('preview','active');
}
async function plan(){
  $('#status').textContent='ANALYZUJI…';$('#analysis-check').textContent='BĚŽÍ';setReady(false);setJourney('analysis','active');
  try{const r=await fetch('/api/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brief:brief.value})});const p=await jsonResponse(r);renderPlan(p);$('#status').textContent='ANALÝZA HOTOVÁ';$('#analysis').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){currentPlan=null;$('#status').textContent='ANALÝZA SELHALA';$('#analysis-check').textContent='FAIL';$('#analysis-state').textContent='CHYBA ANALÝZY';$('#analysis-state').classList.remove('pass');$('#evidence').textContent=e.message;setJourney('analysis','active');}}
$('#forge').addEventListener('click',plan);
brief.addEventListener('input',()=>{currentPlan=null;setReady(false);$('#status').textContent='ZADÁNÍ ZMĚNĚNO';$('#analysis-check').textContent='ČEKÁ';$('#analysis-state').textContent='ČEKÁ NA ANALÝZU';$('#analysis-state').classList.remove('pass');setJourney('brief','active');setJourney('analysis','waiting');setJourney('preview','waiting')});
$$('.preset').forEach(btn=>btn.addEventListener('click',()=>{brief.value=btn.dataset.brief||'';brief.dispatchEvent(new Event('input'));brief.focus()}));

const stages=['Struktura webu','Composition registry','Policy gates','Art direction','Section templates','Media plan','Content binding','Responsive composition','Runtime parity','Evidence receipt','Preview ready'];
function showProgress(active=0,done=false){$('#progress-panel').classList.remove('hidden');$('#progress').innerHTML=stages.map((s,i)=>`<div class="step ${done||i<active?'done':i===active?'active':''}"><span>${done||i<active?'✓':i===active?'●':'○'}</span><b>${escapeHtml(s)}</b></div>`).join('')}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
$('#dryrun').addEventListener('click',()=>{if(!currentPlan)return;$('#technical-details').open=true;$('#technical-details').scrollIntoView({behavior:'smooth',block:'start'})});
$('#generate').addEventListener('click',async()=>{
  if(!currentPlan||!currentPlan.releaseEligible)return;
  const btn=$('#generate');btn.disabled=true;$('#result-panel').classList.add('hidden');$('#build-state').textContent='GENERUJI';setJourney('preview','active');
  try{
    for(let i=0;i<5;i++){showProgress(i);await sleep(90)}
    const r=await fetch('/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brief:brief.value})});const out=await jsonResponse(r);
    for(let i=5;i<stages.length;i++){showProgress(i);await sleep(90)}showProgress(stages.length,true);
    currentReceipt=out.receipt;currentProjectId=out.projectId;currentStateless=out.stateless?out:null;
    $('#result-id').textContent=out.projectId;$('#result-runtime').textContent=out.plan.selection.runtime.id.toUpperCase();$('#result-artifacts').textContent=String(out.previewChecks?.length||out.receipt.artifacts?.length||0);
    if(out.previewHtml){if(previewObjectUrl)URL.revokeObjectURL(previewObjectUrl);previewObjectUrl=URL.createObjectURL(new Blob([out.previewHtml],{type:'text/html'}));$('#preview').href=previewObjectUrl;$('#preview-frame').src=previewObjectUrl;$('#qa-state').textContent=out.previewChecks?.some(x=>x.status==='FAIL')?'FAIL':'PASS';$('#release').textContent=out.release?.previewEligible?'PREVIEW READY':'BLOKOVÁNO';$('#run-qa').textContent='QA DETAIL';$('#approve-visual').hidden=true;}else{$('#preview').href=out.previewUrl;$('#preview-frame').src=out.previewUrl;}
    $('#evidence').textContent=JSON.stringify(out.receipt,null,2);$('#result-panel').classList.remove('hidden');$('#build-state').textContent='WEB PŘIPRAVEN';$('#build-dot').classList.add('ready');setJourney('preview','done');$('#result-panel').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){$('#build-state').textContent='GENEROVÁNÍ BLOKOVÁNO';$('#evidence').textContent=JSON.stringify({status:'FAIL',error:e.message},null,2);$('#evidence-section').open=true;setJourney('preview','active');}
  finally{btn.disabled=!(currentPlan&&currentPlan.releaseEligible)}
});
$('#approve-visual')?.addEventListener('click',async()=>{if(!currentProjectId)return;const btn=$('#approve-visual');btn.disabled=true;try{const r=await fetch('/api/visual/approve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:currentProjectId,contentApproved:true,mediaApproved:true})});const out=await jsonResponse(r);btn.textContent='VISUAL APPROVED ✓';$('#evidence').textContent=JSON.stringify(out,null,2);}catch(e){$('#evidence').textContent=JSON.stringify({status:'FAIL',error:e.message},null,2);btn.disabled=false;}});
$('#show-receipt').addEventListener('click',()=>{if(currentReceipt){$('#evidence').textContent=JSON.stringify(currentReceipt,null,2);$('#evidence-section').open=true;$('#evidence-section').scrollIntoView({behavior:'smooth',block:'start'})}});
$('#run-qa').addEventListener('click',async()=>{if(currentStateless){$('#evidence').textContent=JSON.stringify({previewChecks:currentStateless.previewChecks,truthBoundary:currentStateless.truthBoundary},null,2);$('#evidence-section').open=true;return}if(!currentProjectId)return;const btn=$('#run-qa');btn.disabled=true;$('#qa-state').textContent='BĚŽÍ…';try{let r=await fetch('/api/qa',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:currentProjectId,baseline:true})});let qa=await jsonResponse(r);if(qa.checks.some(x=>x.id==='visual-regression'&&x.status==='BASELINE_CREATED')){r=await fetch('/api/qa',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:currentProjectId,baseline:true})});qa=await jsonResponse(r)}$('#qa-state').textContent=qa.status;$('#evidence').textContent=JSON.stringify(qa,null,2);$('#evidence-section').open=true;}catch(e){$('#qa-state').textContent='FAIL';$('#evidence').textContent=JSON.stringify({status:'FAIL',error:e.message},null,2);$('#evidence-section').open=true;}finally{btn.disabled=false}});
$('#release-eval').addEventListener('click',async()=>{if(currentStateless){$('#evidence').textContent=JSON.stringify({release:currentStateless.release,truthBoundary:currentStateless.truthBoundary},null,2);$('#evidence-section').open=true;return}if(!currentProjectId)return;try{const r=await fetch('/api/release/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:currentProjectId,productionApproved:false})});const out=await jsonResponse(r);$('#release').textContent=out.previewEligible?'PREVIEW READY':'BLOKOVÁNO';$('#evidence').textContent=JSON.stringify(out,null,2);$('#evidence-section').open=true;}catch(e){$('#evidence').textContent=JSON.stringify({status:'FAIL',error:e.message},null,2);$('#evidence-section').open=true;}});
