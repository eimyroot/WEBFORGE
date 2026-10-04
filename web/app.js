const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const brief=$('#brief');
let currentPlan=null;
let currentReceipt=null;
let currentProjectId=null;
let currentStateless=null;
let currentPlayground=null;
let currentDirections=null;
let selectedDirectionId=null;
let selectedDirectionDigest=null;
let previewObjectUrl=null;

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
async function jsonResponse(r){const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw new Error(`WEBFORGE server returned ${r.status}: ${text.slice(0,120)||'empty response'}`)}if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);return data}
function kv(k,v,selected=false){return `<div class="kv"><b>${escapeHtml(k)}</b><span class="${selected?'selected':''}">${escapeHtml(v)}</span></div>`}
function setJourney(stage,state){const el=$(`#journey-${stage}`);if(!el)return;el.classList.toggle('active',state==='active');el.classList.toggle('done',state==='done');const small=el.querySelector('small');if(small)small.textContent=state==='done'?'Hotovo':state==='active'?'Probíhá':'Čeká'}
function setReady(ready){const btn=$('#generate'),dry=$('#dryrun'),effective=Boolean(ready&&selectedDirectionId);btn.disabled=!effective;dry.disabled=!ready;$('#build-state').textContent=effective?'PŘIPRAVENO KE GENEROVÁNÍ':ready?'VYBER DESIGNOVÝ SMĚR':'ČEKÁ NA ANALÝZU';$('#build-dot').classList.toggle('ready',effective);$('#build-copy').textContent=effective?'Designový směr je vybraný. WEBFORGE ho přenese do plného deterministického buildu.':ready?'Analýza prošla. Nejdřív vyber jeden z materiálně odlišných designových směrů.':'Nejdřív spusť analýzu. Generování se odemkne pouze po průchodu policy gate.'}
function briefSynthesis(p){return p.project?.domain?.synthesis||p.domain?.synthesis||null}
function setPlaygroundWaiting(){currentPlayground=null;$('#playground-status').textContent='ČEKÁ';$('#playground-status').className='';$('#playground-nearest').textContent='—';$('#playground-distance').textContent='—';$('#playground-collisions').textContent='—';$('#playground-copy').textContent='Po analýze se nový brief porovná s osmi strukturálně odlišnými baseline weby.';$('#playground-signature').textContent='Čeká na brief.';$('#playground-comparisons').innerHTML=''}
function setDirectionsWaiting(){
  currentDirections=null;selectedDirectionId=null;selectedDirectionDigest=null;
  $('#directions-state').textContent='ČEKÁ NA ANALÝZU';$('#selected-direction-copy').textContent='Zatím není vybraný směr.';
  $('#direction-cards').innerHTML='<div class="muted">Po analýze se zde objeví vizuální směry.</div>';
}
function selectDirection(id){
  if(!currentDirections?.options?.some(x=>x.id===id))return;
  selectedDirectionId=id;
  const selected=currentDirections.options.find(x=>x.id===id);
  selectedDirectionDigest=selected?.selectionClaim?.selection_digest||null;
  if(!selectedDirectionDigest){selectedDirectionId=null;setReady(false);return;}
  $$('.direction-card').forEach(card=>card.classList.toggle('selected',card.dataset.directionId===id));
  $$('.direction-card button').forEach(button=>{const selected=button.dataset.directionId===id;button.textContent=selected?'VYBRÁNO ✓':'VYBRAT TENTO SMĚR';button.disabled=selected});
  $('#directions-state').textContent='SMĚR VYBRÁN';$('#selected-direction-copy').textContent=`${selected.label} · ${selected.directionPlan.archetype} · ${selected.directionPlan.rhythm}`;
  $('#release').textContent='PŘIPRAVENO';setJourney('direction','done');setJourney('preview','active');setReady(Boolean(currentPlan?.releaseEligible&&currentPlan?.policy?.status==='PASS'));
}
function renderDirections(out){
  currentDirections=out;selectedDirectionId=null;selectedDirectionDigest=null;const root=$('#direction-cards');root.innerHTML='';
  for(const option of out.options||[]){
    const card=document.createElement('article');card.className='direction-card';card.dataset.directionId=option.id;
    const preview=document.createElement('div');preview.className='direction-preview';const frame=document.createElement('iframe');frame.title=`Preview směru ${option.label}`;frame.setAttribute('sandbox','');frame.loading='lazy';frame.srcdoc=option.previewHtml;preview.append(frame);
    const meta=document.createElement('div');meta.className='direction-meta';
    const head=document.createElement('div');head.className='direction-meta-head';head.innerHTML=`<div><h3>${escapeHtml(option.label)}</h3><small>${escapeHtml(option.description)}</small></div><small>Δ ${escapeHtml(option.distanceFromNative)}</small>`;
    const tags=document.createElement('div');tags.className='direction-plan';for(const value of [option.directionPlan.archetype,option.directionPlan.hero,option.directionPlan.density,option.directionPlan.rhythm,option.directionPlan.palette]){const span=document.createElement('span');span.textContent=value;tags.append(span)}
    const button=document.createElement('button');button.type='button';button.dataset.directionId=option.id;button.textContent='VYBRAT TENTO SMĚR';button.addEventListener('click',()=>selectDirection(option.id));
    meta.append(head,tags,button);card.append(preview,meta);root.append(card);
  }
  $('#directions-state').textContent=out.status==='PASS'?'VYBER 1 SMĚR':'UNVERIFIED';$('#selected-direction-copy').textContent='Vyber jeden směr. Bez výběru WEBFORGE plný build nespustí.';
  setJourney('direction','active');setJourney('preview','waiting');setReady(Boolean(currentPlan?.releaseEligible&&currentPlan?.policy?.status==='PASS'));
}
async function loadDirections(){
  $('#directions-state').textContent='GENERUJI SMĚRY…';
  try{const r=await fetch('/api/directions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brief:brief.value})});const out=await jsonResponse(r);renderDirections(out);return out}
  catch(e){currentDirections={status:'FAIL',error:e.message};selectedDirectionId=null;selectedDirectionDigest=null;$('#directions-state').textContent='FAIL';$('#selected-direction-copy').textContent=`Generování směrů selhalo: ${e.message}`;$('#direction-cards').innerHTML='<div class="muted">Design direction evidence není dostupná. Build zůstává zablokovaný.</div>';setReady(false);return currentDirections}
}
function renderPlayground(out){
  currentPlayground=out;const c=out.candidate||{},h=c.homepage||{},root=c.root||{},nearest=out.nearest?.[0];
  $('#playground-status').textContent=out.status;$('#playground-status').className=`playground-${String(out.status).toLowerCase()}`;
  $('#playground-nearest').textContent=nearest?`${nearest.id} · ${nearest.domain}`:'—';$('#playground-distance').textContent=nearest?String(nearest.compositeDistance):'—';$('#playground-collisions').textContent=String(out.hardCollisions?.length||0);
  $('#playground-copy').textContent=out.status==='PASS'?'Struktura je mimo warning collision radius vůči baseline sadě.':out.status==='WARN'?'Struktura je blízko baseline nebo sdílí rizikový structural dimension. Preview je povolený, ale podobnost stojí za kontrolu.':'Nalezená cross-domain kolize porušuje hard structural threshold. Preview zůstává dostupný pro diagnostiku, release by měl zůstat zablokovaný.';
  $('#playground-signature').innerHTML=kv('HERO',root.heroArchetype||'—',true)+kv('NAV',root.navigationModel||'—')+kv('LAYOUT',root.layoutTemplate||'—')+kv('STRATEGY',root.layoutStrategy||'—')+kv('CANVAS',root.canvas||'—')+kv('SECTIONS',(h.sectionSequence||[]).join(' → ')||'—')+kv('GEOMETRY',(h.geometrySequence||[]).join(' → ')||'—')+kv('CTA',(h.ctaPattern||[]).join(' → ')||'—')+kv('TEMPLATE FAMILIES',(h.templateFamilies||[]).join(' → ')||'—')+kv('PAGE GRAPH',String(c.pageGraph?.length||0));
  $('#playground-comparisons').innerHTML=(out.nearest||[]).map(x=>`<div class="comparison"><b>${escapeHtml(x.id)}</b><span>${escapeHtml(x.domain)} · distance ${escapeHtml(x.compositeDistance)}</span></div>`).join('');
}
async function evaluatePlayground(){
  $('#playground-status').textContent='BĚŽÍ';try{const r=await fetch('/api/playground/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brief:brief.value})});const out=await jsonResponse(r);renderPlayground(out);return out}catch(e){currentPlayground={status:'FAIL',error:e.message};$('#playground-status').textContent='FAIL';$('#playground-status').className='playground-fail';$('#playground-copy').textContent=`Structural evaluation selhala: ${e.message}`;$('#playground-signature').textContent='UNVERIFIED';$('#playground-comparisons').innerHTML='';return currentPlayground}}
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
  $('#release').textContent=p.releaseEligible?'VYBER SMĚR':'BLOKOVÁNO';
  $('#analysis-state').textContent=p.releaseEligible?'ANALÝZA HOTOVÁ':'VYŽADUJE POZORNOST';
  $('#analysis-state').classList.toggle('pass',p.releaseEligible);
  renderTechnical(p);
  $('#evidence').textContent=JSON.stringify(p.evidence,null,2);
  setReady(false);
  setJourney('brief','done');setJourney('analysis','done');setJourney('direction','active');setJourney('preview','waiting');
}
async function plan(){
  $('#status').textContent='ANALYZUJI…';$('#analysis-check').textContent='BĚŽÍ';setReady(false);setJourney('analysis','active');
  try{const r=await fetch('/api/plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brief:brief.value})});const p=await jsonResponse(r);renderPlan(p);await Promise.all([evaluatePlayground(),loadDirections()]);$('#status').textContent='ANALÝZA HOTOVÁ · VYBER SMĚR';$('#directions').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){currentPlan=null;$('#status').textContent='ANALÝZA SELHALA';$('#analysis-check').textContent='FAIL';$('#analysis-state').textContent='CHYBA ANALÝZY';$('#analysis-state').classList.remove('pass');$('#evidence').textContent=e.message;setJourney('analysis','active');}}
$('#forge').addEventListener('click',plan);
brief.addEventListener('input',()=>{currentPlan=null;setDirectionsWaiting();setReady(false);setPlaygroundWaiting();$('#status').textContent='ZADÁNÍ ZMĚNĚNO';$('#analysis-check').textContent='ČEKÁ';$('#analysis-state').textContent='ČEKÁ NA ANALÝZU';$('#analysis-state').classList.remove('pass');setJourney('brief','active');setJourney('analysis','waiting');setJourney('direction','waiting');setJourney('preview','waiting')});
$$('.preset').forEach(btn=>btn.addEventListener('click',()=>{brief.value=btn.dataset.brief||'';brief.dispatchEvent(new Event('input'));brief.focus()}));

const stages=['Vybraný designový směr','Struktura webu','Composition registry','Policy gates','Art direction','Section templates','Media plan','Content binding','Responsive composition','Runtime parity','Evidence receipt','Preview ready'];
function showProgress(active=0,done=false){$('#progress-panel').classList.remove('hidden');$('#progress').innerHTML=stages.map((s,i)=>`<div class="step ${done||i<active?'done':i===active?'active':''}"><span>${done||i<active?'✓':i===active?'●':'○'}</span><b>${escapeHtml(s)}</b></div>`).join('')}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
$('#dryrun').addEventListener('click',()=>{if(!currentPlan)return;$('#technical-details').open=true;$('#technical-details').scrollIntoView({behavior:'smooth',block:'start'})});
$('#generate').addEventListener('click',async()=>{
  if(!currentPlan||!currentPlan.releaseEligible||!selectedDirectionId||!selectedDirectionDigest)return;
  const btn=$('#generate');btn.disabled=true;$('#result-panel').classList.add('hidden');$('#build-state').textContent='GENERUJI';setJourney('preview','active');
  try{
    for(let i=0;i<5;i++){showProgress(i);await sleep(90)}
    const r=await fetch('/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({brief:brief.value,directionId:selectedDirectionId,selectionDigest:selectedDirectionDigest})});const out=await jsonResponse(r);
    for(let i=5;i<stages.length;i++){showProgress(i);await sleep(90)}showProgress(stages.length,true);
    currentReceipt=out.receipt;currentProjectId=out.projectId;currentStateless=out.stateless?out:null;
    $('#result-id').textContent=out.projectId;$('#result-direction').textContent=out.plan.designDirectionSelection?.id?.toUpperCase()||selectedDirectionId.toUpperCase();$('#result-runtime').textContent=out.plan.selection.runtime.id.toUpperCase();$('#result-artifacts').textContent=String(out.previewChecks?.length||out.receipt.artifacts?.length||0);
    if(out.previewHtml){if(previewObjectUrl)URL.revokeObjectURL(previewObjectUrl);previewObjectUrl=URL.createObjectURL(new Blob([out.previewHtml],{type:'text/html'}));$('#preview').href=previewObjectUrl;$('#preview-frame').src=previewObjectUrl;$('#qa-state').textContent=out.previewChecks?.some(x=>x.status==='FAIL')?'FAIL':'PASS';$('#release').textContent=out.release?.previewEligible?'PREVIEW READY':'BLOKOVÁNO';$('#run-qa').textContent='QA DETAIL';$('#approve-visual').hidden=true;}else{$('#preview').href=out.previewUrl;$('#preview-frame').src=out.previewUrl;}
    $('#evidence').textContent=JSON.stringify(out.receipt,null,2);$('#result-panel').classList.remove('hidden');$('#build-state').textContent='WEB PŘIPRAVEN';$('#build-dot').classList.add('ready');setJourney('preview','done');$('#result-panel').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){$('#build-state').textContent='GENEROVÁNÍ BLOKOVÁNO';$('#evidence').textContent=JSON.stringify({status:'FAIL',error:e.message},null,2);$('#evidence-section').open=true;setJourney('preview','active');}
  finally{btn.disabled=!(currentPlan&&currentPlan.releaseEligible&&selectedDirectionId&&selectedDirectionDigest)}
});
$('#approve-visual')?.addEventListener('click',async()=>{if(!currentProjectId)return;const btn=$('#approve-visual');btn.disabled=true;try{const r=await fetch('/api/visual/approve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:currentProjectId,contentApproved:true,mediaApproved:true})});const out=await jsonResponse(r);btn.textContent='VISUAL APPROVED ✓';$('#evidence').textContent=JSON.stringify(out,null,2);}catch(e){$('#evidence').textContent=JSON.stringify({status:'FAIL',error:e.message},null,2);btn.disabled=false;}});
$('#show-receipt').addEventListener('click',()=>{if(currentReceipt){$('#evidence').textContent=JSON.stringify(currentReceipt,null,2);$('#evidence-section').open=true;$('#evidence-section').scrollIntoView({behavior:'smooth',block:'start'})}});
$('#run-qa').addEventListener('click',async()=>{if(currentStateless){$('#evidence').textContent=JSON.stringify({previewChecks:currentStateless.previewChecks,truthBoundary:currentStateless.truthBoundary},null,2);$('#evidence-section').open=true;return}if(!currentProjectId)return;const btn=$('#run-qa');btn.disabled=true;$('#qa-state').textContent='BĚŽÍ…';try{let r=await fetch('/api/qa',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:currentProjectId,baseline:true})});let qa=await jsonResponse(r);if(qa.checks.some(x=>x.id==='visual-regression'&&x.status==='BASELINE_CREATED')){r=await fetch('/api/qa',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:currentProjectId,baseline:true})});qa=await jsonResponse(r)}$('#qa-state').textContent=qa.status;$('#evidence').textContent=JSON.stringify(qa,null,2);$('#evidence-section').open=true;}catch(e){$('#qa-state').textContent='FAIL';$('#evidence').textContent=JSON.stringify({status:'FAIL',error:e.message},null,2);$('#evidence-section').open=true;}finally{btn.disabled=false}});
$('#release-eval').addEventListener('click',async()=>{if(currentStateless){$('#evidence').textContent=JSON.stringify({release:currentStateless.release,truthBoundary:currentStateless.truthBoundary},null,2);$('#evidence-section').open=true;return}if(!currentProjectId)return;try{const r=await fetch('/api/release/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:currentProjectId,productionApproved:false})});const out=await jsonResponse(r);$('#release').textContent=out.previewEligible?'PREVIEW READY':'BLOKOVÁNO';$('#evidence').textContent=JSON.stringify(out,null,2);$('#evidence-section').open=true;}catch(e){$('#evidence').textContent=JSON.stringify({status:'FAIL',error:e.message},null,2);$('#evidence-section').open=true;}});
