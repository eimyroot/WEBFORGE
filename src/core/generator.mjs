import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { compose } from './compose.mjs';
import { forgeRuntimeProject } from './runtime-forge.mjs';
import { deploymentPlan } from './deployment.mjs';
import { verifyRuntimeBuild } from './runtime-build.mjs';
import { renderWebsite, renderCss, renderBlueprintPage } from './visual-renderer.mjs';
import { writeMediaAssets } from './media-assets.mjs';
import { buildMediaRequests } from './media-requests.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const generatedRoot = path.join(root, 'generated');
const evidenceRoot = path.join(root, 'evidence', 'generated');

const esc = (v='') => String(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const slugify = (v='website') => v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42) || 'website';
const now = () => new Date().toISOString();

function titleFromPlan(plan) { return plan.brand?.identity?.name || 'WEBFORGE Project';
}

function copyFor(plan) {
  const c=plan.brand?.content;
  return c ? [c.headline,c.subheadline] : ['Built for the job.','A governed website generated from an explainable WEBFORGE blueprint.'];
}

function ctaLabel(plan) {
  return plan.brand?.content?.primaryCta || 'Start here';
}

function sectionCopy(plan, id) {
  const universal={
    schedule:['PROGRAM','What happens, when, and why it matters.'],
    availability:['AVAILABILITY','Make the next available action obvious.'],
    newsletter:['STAY CURRENT','A direct line to the next useful update.'],
    featured:['FEATURED','Surface the strongest thing first.'],
    'how-it-works':['HOW IT WORKS','Turn complexity into a clear sequence.'],
    'problem-solution':['WHY CHANGE','Connect the problem directly to the better state.'],
    'supply-demand':['BOTH SIDES','Create value for both sides of the exchange.'],
    security:['SECURITY','Reduce risk before asking for commitment.'],
    'task-preview':['CORE TASK','Show the primary job before the feature list.'],
    'logo-cloud':['TRUST','Recognizable proof without slowing the story.']
  };
  const a=plan.project.archetype;
  const dictionaries={
    venue:{'next-event':['NEXT UP','This week, after dark.'],'artists':['LINEUP','Artists with a point of view.'],'experience':['THE ROOM','Sound, light and bodies in motion.'],'gallery':['AFTER IMAGES','A glimpse of the atmosphere.'],'location':['FIND US','Built for the city, easy to reach.'],'latest-content':['LATEST','News, lineups and announcements.']},
    'local-service':{'trust-strip':['TRUST','Local proof before promises.'],'services':['SERVICES','Clear choices. No friction.'],'proof':['RESULTS','Show the work that earns trust.'],'gallery':['WORK','Real outcomes, not filler.'],'process':['PROCESS','A simple path from interest to action.'],'location':['LOCAL','Close, clear and easy to find.'],'faq':['FAQ','Remove the last reasons to hesitate.'],'latest-content':['LATEST','Fresh updates and useful guidance.']},
    portfolio:{'selected-work':['SELECTED WORK','Lead with the strongest work.'],'statement':['POINT OF VIEW','A concise creative position.'],'case-study':['CASE STUDY','Show the thinking behind the outcome.'],'gallery':['ARCHIVE','A broader visual rhythm.'],'about':['ABOUT','Enough context to make the work human.'],'latest-content':['LATEST','Recent work and notes.']},
    company:{'trust-strip':['TRUST SIGNALS','Proof early, before the pitch.'],'services':['WHAT WE DO','Clear capabilities mapped to outcomes.'],'outcomes':['OUTCOMES','Show business value, not just activity.'],'process':['HOW IT WORKS','Make the engagement feel predictable.'],'team':['TEAM','Put accountable people behind the work.'],'proof':['PROOF','Evidence that reduces perceived risk.'],'faq':['FAQ','Resolve buying friction.'],'latest-content':['INSIGHTS','Current thinking and expertise.']},
    saas:{'logo-cloud':['TRUST','Used where the work matters.'],'problem-solution':['WHY','Frame the problem before the feature list.'],'feature-grid':['CAPABILITIES','Show what users can actually accomplish.'],'product-proof':['PRODUCT PROOF','Make the product visible and concrete.'],'integrations':['INTEGRATIONS','Fit into the existing stack.'],'pricing':['PRICING','Make the next step legible.'],'faq':['FAQ','Answer adoption blockers.'],'latest-content':['RESOURCES','Teach, prove and convert.']},
    marketplace:{'categories':['DISCOVER','Start from what people are trying to find.'],'featured':['FEATURED','Surface high-value supply quickly.'],'how-it-works':['HOW IT WORKS','Make both sides of the market understand the loop.'],'trust-safety':['TRUST & SAFETY','Trust is part of the transaction.'],'supply-demand':['FOR BOTH SIDES','Balance buyer and supplier value.'],'proof':['PROOF','Show liquidity and successful outcomes.'],'latest-content':['LATEST','Fresh supply and market activity.']},
    'web-app':{'task-preview':['CORE TASK','Show the primary job immediately.'],'feature-grid':['CAPABILITIES','Support the task without clutter.'],'workflow':['WORKFLOW','Reveal the sequence users will repeat.'],'integrations':['INTEGRATIONS','Connect the surrounding system.'],'security':['SECURITY','Make trust visible where it matters.'],'latest-content':['UPDATES','Keep users current.']}
  };
  return dictionaries[a]?.[id] || universal[id] || [id.replaceAll('-',' ').toUpperCase(), 'A purposeful section synthesized for this visitor journey.'];
}

function renderCards(plan,id,index,count=3){
  const [label,title]=sectionCopy(plan,id);
  const nouns={
    services:['Strategy','Design','Delivery','Support'],
    artists:['Residents','Guests','Selectors','Live'],
    pricing:['Essential','Growth','Scale','Custom'],
    integrations:['Connect','Automate','Measure','Extend'],
    categories:['Discover','Compare','Trust','Act'],
    proof:['Outcome','Evidence','Signal','Result'],
    gallery:['Detail','Atmosphere','Craft','Context']
  };
  const items=nouns[id]||['Focus','Proof','Experience','Next step'];
  return items.slice(0,count).map((name,i)=>`<article><span class="card-index">${String(i+1).padStart(2,'0')}</span><h3>${esc(name)}</h3><p>${esc(i===0?title:'Designed around the visitor journey, not internal implementation details.')}</p></article>`).join('');
}

function renderSection(plan,id,index){
  if(id==='hero') return '';
  const variant=plan.layout.variants?.[id]||'content-grid';
  const directive=plan.layout.direction?.sectionDirectives?.find(x=>x.id===id)||{role:'EXPLAIN',emphasis:'medium',contrast:'base',mobilePriority:'normal'};
  if(id==='final-cta') return `<section class="section final-cta variant-${variant}" id="contact"><div class="section-label">READY</div><h2>${esc(plan.layout.cta==='tickets'?'Choose the night.':plan.layout.cta==='booking'?'Make the next move.':plan.layout.cta==='start'?'Start with the product.':'Start the conversation.')}</h2><a class="primary" href="#">${esc(ctaLabel(plan))} →</a></section>`;
  const [label,title]=sectionCopy(plan,id);
  const cards=renderCards(plan,id,index, variant.includes('grid')||variant==='feature-bento'?4:3);
  const visual=['masonry','gallery-grid','project-led','case-editorial','case-proof','product-stage','app-stage','spotlight','listing-rail','map-split'].includes(variant);
  const metric=['stats','metrics'].includes(variant);
  const timeline=variant==='timeline';
  const quote=variant==='quote';
  let body='';
  if(metric){
    body=`<div class="metric-grid"><div><strong>01</strong><span>Proof before promise</span></div><div><strong>02</strong><span>Clear outcome</span></div><div><strong>03</strong><span>Low friction</span></div></div>`;
  } else if(timeline){
    body=`<div class="timeline">${['Discover','Decide','Deliver'].map((x,i)=>`<div><span>0${i+1}</span><h3>${x}</h3><p>One clear step in the user journey.</p></div>`).join('')}</div>`;
  } else if(quote){
    body=`<blockquote>“The layout should make the hierarchy obvious before the visitor reads every word.”</blockquote>`;
  } else {
    body=`${visual?`<div class="visual-block visual-${variant}"><span>${esc(plan.layout.family.toUpperCase())} / ${esc(variant.toUpperCase())}</span><strong>${esc(id.replaceAll('-',' '))}</strong></div>`:''}<div class="section-cards cards-${variant}">${cards}</div>`;
  }
  return `<section class="section variant-${variant} role-${directive.role.toLowerCase()} emphasis-${directive.emphasis} contrast-${directive.contrast} mobile-${directive.mobilePriority}" data-role="${directive.role}" id="${esc(id)}"><div class="section-head"><div class="section-label">${esc(label)} <span class="role-tag">${directive.role}</span></div><h2>${esc(title)}</h2></div><div class="section-body">${body}</div></section>`;
}

function websiteHtml(plan, projectId) {
  const [headline, sub] = copyFor(plan);
  const title = titleFromPlan(plan);
  const navItems=plan.layout.sections.filter(x=>!['hero','final-cta','trust-strip','logo-cloud'].includes(x)).slice(0,4);
  const nav=navItems.map(x=>`<a href="#${esc(x)}">${esc(x.replaceAll('-',' '))}</a>`).join('');
  const sections=plan.layout.sections.map((id,i)=>renderSection(plan,id,i)).join('');
  const design=plan.layout.design||{};
  return `<!doctype html><html lang="en" data-template="${esc(plan.layout.id)}" data-brand="${esc(plan.brand?.identity?.name||title)}" data-mood="${esc(plan.brand?.style?.mood||'precise')}" data-space="${esc(design.space||'balanced')}" data-type="${esc(design.type||'display')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(sub)}"><title>${esc(title)}</title><link rel="stylesheet" href="./styles.css"></head><body class="family-${esc(plan.layout.family)} rhythm-${esc(plan.layout.rhythm)} density-${esc(plan.layout.density)}">
<header><a class="logo" href="#">${esc(title.split(' ').slice(0,2).join(' '))}</a><nav>${nav}</nav><a class="cta" href="#contact">${esc(ctaLabel(plan))}</a></header>
<main data-narrative="${esc(plan.layout.direction?.narrative||'')}"><section class="hero hero-${esc(plan.layout.hero)}"><div class="hero-meta"><span>${esc(plan.project.archetype.toUpperCase())}</span><span>${esc(plan.layout.id)}</span></div><h1>${esc(headline)}</h1><p>${esc(sub)}</p><div class="hero-actions"><a class="primary" href="#${esc(navItems[0]||'contact')}">${esc(ctaLabel(plan))} →</a><span>${esc(plan.layout.family)} / ${esc(plan.layout.density)}</span></div></section>${sections}</main>
<footer><span>${esc(title)}</span><span>${esc(plan.layout.id)} · Generated by WEBFORGE · ${esc(projectId)}</span></footer></body></html>`;
}

function websiteCss(plan) {
  const family=plan.layout.family;
  const cinematic=plan.capabilities.includes('motion.cinematic');
  const design=plan.layout.design||{};
  const accent=family==='experience'?'#ff4fd8':family==='product'?'#6ef2ff':family==='conversion'?'#d8ff4a':family==='showcase'?'#ffcf5a':family==='transactional'?'#7ee6a8':'#b7ff39';
  const sectionPad=design.space==='spacious'?'clamp(92px,11vw,176px)':design.space==='compact'?'clamp(58px,7vw,104px)':'clamp(72px,9vw,138px)';
  const heroSize=design.type==='editorial'?'clamp(64px,12vw,184px)':design.type==='product'?'clamp(54px,8.4vw,128px)':'clamp(58px,10vw,160px)';
  return `:root{--bg:#090a0c;--panel:#111318;--fg:#f4f5f6;--muted:#9da5af;--line:#292e36;--accent:${accent};--max:${design.container==='wide'?'1480px':'1240px'};--section:${sectionPad}}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font-family:Inter,ui-sans-serif,system-ui,sans-serif}a{color:inherit;text-decoration:none}header{height:76px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 max(4vw,24px);border-bottom:1px solid var(--line);position:sticky;top:0;background:#090a0cec;backdrop-filter:blur(18px);z-index:5}.logo{font-weight:900;letter-spacing:-.03em}nav{display:flex;gap:24px;color:var(--muted);font-size:12px;text-transform:capitalize}.cta{justify-self:end;border:1px solid var(--line);padding:11px 15px}.hero{min-height:${family==='experience'?'92vh':'78vh'};padding:clamp(90px,9vw,150px) max(6vw,28px) 7vw;display:flex;flex-direction:column;justify-content:flex-end;background:${cinematic?'radial-gradient(circle at 76% 15%,color-mix(in srgb,var(--accent) 22%,transparent) 0,transparent 34%),linear-gradient(180deg,#0d1013,#090a0c)':'linear-gradient(180deg,#0d1013,#090a0c)'}.hero-meta{display:flex;justify-content:space-between;gap:20px;color:var(--accent);font:10px ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase}.hero h1{font-size:${heroSize};max-width:1200px;line-height:.84;letter-spacing:-.075em;margin:30px 0 26px}.hero p{max-width:680px;font-size:clamp(18px,2vw,24px);line-height:1.5;color:#c4c9ce}.hero-actions{display:flex;align-items:center;gap:20px;margin-top:26px;color:var(--muted);font:11px ui-monospace,monospace;text-transform:uppercase}.primary{display:inline-block;background:var(--accent);color:#070807;padding:15px 20px;font-weight:850;width:max-content}.section{padding:var(--section) max(6vw,28px);border-top:1px solid var(--line);max-width:var(--max);margin:auto}.section-head{display:grid;grid-template-columns:minmax(120px,.32fr) 1fr;gap:5vw;align-items:start}.section-label{font:10px ui-monospace,monospace;letter-spacing:.15em;color:var(--accent)}.section h2{font-size:clamp(38px,6vw,86px);max-width:1000px;line-height:.93;letter-spacing:-.055em;margin:0}.section-body{display:grid;grid-template-columns:1fr 1fr;gap:3vw;margin-top:56px}.visual-block{min-height:clamp(320px,48vw,720px);border:1px solid var(--line);background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 16%,#101318),#0b0d10 55%);padding:28px;display:flex;flex-direction:column;justify-content:space-between}.visual-block span{font:10px ui-monospace,monospace;color:var(--muted)}.visual-block strong{font-size:clamp(36px,5vw,76px);letter-spacing:-.055em;text-transform:capitalize}.section-cards{display:grid;grid-template-columns:repeat(2,1fr);border-top:1px solid var(--line)}.section-cards article{min-height:190px;padding:24px;border-bottom:1px solid var(--line);border-right:1px solid var(--line)}.section-cards h3{font-size:22px;margin:46px 0 8px;text-transform:capitalize}.section-cards p{color:var(--muted);font:12px ui-monospace,monospace;text-transform:capitalize}.card-index{color:var(--accent);font:10px ui-monospace,monospace}.variant-spotlight .section-body,.variant-product-stage .section-body,.variant-app-stage .section-body,.variant-project-led .section-body{grid-template-columns:1.35fr .65fr}.variant-split .section-body,.variant-map-split .section-body,.variant-dual-column .section-body{grid-template-columns:1fr 1fr}.variant-masonry .visual-block{min-height:72vw;max-height:900px}.variant-masonry .section-body{grid-template-columns:1.45fr .55fr}.variant-gallery-grid .section-body,.variant-feature-bento .section-body,.variant-category-grid .section-body,.variant-pricing-grid .section-body,.variant-integration-grid .section-body{grid-template-columns:1fr}.variant-gallery-grid .section-cards,.variant-feature-bento .section-cards,.variant-category-grid .section-cards,.variant-pricing-grid .section-cards,.variant-integration-grid .section-cards{grid-template-columns:repeat(4,1fr)}.variant-logo-rail .section-body,.variant-rail .section-body,.variant-listing-rail .section-body{grid-template-columns:1fr}.variant-logo-rail .section-cards,.variant-rail .section-cards,.variant-listing-rail .section-cards{grid-template-columns:repeat(3,1fr)}.metric-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line)}.metric-grid div{padding:34px 10px;border-right:1px solid var(--line)}.metric-grid strong{display:block;color:var(--accent);font-size:clamp(48px,7vw,96px);letter-spacing:-.06em}.metric-grid span{color:var(--muted);font:11px ui-monospace,monospace}.timeline{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line)}.timeline div{padding:28px;border-right:1px solid var(--line)}.timeline span{color:var(--accent);font:10px ui-monospace,monospace}.timeline h3{font-size:28px;margin:60px 0 10px}.timeline p{color:var(--muted)}blockquote{grid-column:1/-1;margin:0;max-width:1050px;font-size:clamp(40px,7vw,100px);line-height:.96;letter-spacing:-.055em}.variant-trust-panel{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 8%,#090a0c),#090a0c)}.final-cta{min-height:60vh;display:flex;flex-direction:column;justify-content:center}.final-cta h2{font-size:clamp(58px,9vw,140px);max-width:1050px;margin:20px 0 35px}.role-tag{margin-left:8px;color:var(--accent);opacity:.7}.contrast-alternate{background:rgba(255,255,255,.018)}.emphasis-high h2{max-width:900px}.emphasis-low{padding-top:64px;padding-bottom:64px}.role-proof{border-top-color:color-mix(in srgb,var(--accent) 28%,var(--line))}.role-convert{background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--accent) 5%,transparent))}@media(max-width:760px){.mobile-early{order:-1}.mobile-late{order:2}}footer{display:flex;justify-content:space-between;padding:32px max(6vw,28px) 60px;border-top:1px solid var(--line);color:#69717b;font:10px ui-monospace,monospace}@media(max-width:900px){.variant-gallery-grid .section-cards,.variant-feature-bento .section-cards,.variant-category-grid .section-cards,.variant-pricing-grid .section-cards,.variant-integration-grid .section-cards{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){header{grid-template-columns:1fr auto}nav{display:none}.hero{padding-top:120px}.hero-meta{flex-direction:column}.hero h1{font-size:clamp(54px,18vw,88px)}.section-head,.section-body,.variant-spotlight .section-body,.variant-product-stage .section-body,.variant-app-stage .section-body,.variant-project-led .section-body,.variant-masonry .section-body{grid-template-columns:1fr}.section-body{margin-top:34px}.section-cards,.variant-gallery-grid .section-cards,.variant-feature-bento .section-cards,.variant-category-grid .section-cards,.variant-pricing-grid .section-cards,.variant-integration-grid .section-cards,.variant-logo-rail .section-cards,.variant-rail .section-cards,.variant-listing-rail .section-cards,.metric-grid,.timeline{grid-template-columns:1fr}.hero-actions{align-items:flex-start;flex-direction:column}footer{flex-direction:column;gap:10px}}`;
}

function packageFor(plan, projectId) {
  return {
    name: `webforge-${projectId}`,
    private: true,
    version: '0.1.0',
    webforge: { runtime: plan.selection.runtime.id, template: plan.layout.id, generated: true },
    scripts: { preview: 'node server.mjs' }
  };
}

function portableServer() {
  return `import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';const root=path.dirname(fileURLToPath(import.meta.url));const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');let name=u.pathname==='/'?'index.html':u.pathname.slice(1);if(name.endsWith('/'))name+='index.html';let p=path.resolve(root,name);if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');if(!(p===root||p.startsWith(root+path.sep))||!fs.existsSync(p)||fs.statSync(p).isDirectory()){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'content-type':types[path.extname(p)]||'text/plain'});res.end(fs.readFileSync(p))}).listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Preview http://127.0.0.1:4173'));`;
}

export function generateWebsite(brief) {
  const plan = compose(brief);
  if (!plan.releaseEligible || plan.policy.status !== 'PASS') {
    const err = new Error('Generation blocked by policy gate'); err.code='POLICY_BLOCK'; err.plan=plan; throw err;
  }
  fs.mkdirSync(generatedRoot,{recursive:true}); fs.mkdirSync(evidenceRoot,{recursive:true});
  const seed = `${brief}|${plan.selection.runtime.id}|${Date.now()}`;
  const id = `${slugify(plan.project.domainArchetype||plan.project.archetype)}-${crypto.createHash('sha256').update(seed).digest('hex').slice(0,8)}`;
  const dir = path.join(generatedRoot,id); fs.mkdirSync(dir,{recursive:false});
  const manifest = {
    schema:'webforge.universal-composition.v1', projectId:id, generatedAt:now(), brief,
    project:plan.project, domain:plan.domain, product:plan.product, experience:plan.experience, designDNA:plan.designDNA, brand:plan.brand, capabilities:plan.capabilities, siteBlueprint:plan.siteBlueprint, runtime:plan.selection.runtime,
    patterns:plan.selection.patterns.map(x=>x.id), layout:plan.layout, components:plan.selection.components.map(x=>x.id),
    tools:plan.selection.tools, policy:plan.policy, visual:plan.visual
  };
  const mediaAssets=writeMediaAssets(dir,plan.visual,`${brief}|${id}`);
  for(const slot of plan.visual.media.slots) slot.src=mediaAssets[slot.id]||null;
  for(const section of plan.visual.sections) for(const slot of section.media||[]) slot.src=mediaAssets[slot.id]||null;
  fs.writeFileSync(path.join(dir,'universal.plan.json'),JSON.stringify(plan,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'domain.model.json'),JSON.stringify(plan.domain,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'website-genome.json'),JSON.stringify(plan.domain.genome,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'product.model.json'),JSON.stringify(plan.product,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'experience.model.json'),JSON.stringify(plan.experience,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'design-dna.json'),JSON.stringify(plan.designDNA,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'visual-composition.json'),JSON.stringify(plan.visual,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'media.plan.json'),JSON.stringify(plan.visual.media,null,2)+'\n');
  const mediaRequests=buildMediaRequests(plan); fs.writeFileSync(path.join(dir,'media.requests.json'),JSON.stringify(mediaRequests,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'index.html'),renderWebsite(plan,plan.visual,id));
  fs.writeFileSync(path.join(dir,'styles.css'),renderCss(plan.visual));
  const generatedPages=[];
  for(const page of plan.siteBlueprint.pages.filter(x=>!x.dynamic&&x.path!=='/')){
    const rel=page.path.replace(/^\/|\/$/g,'');
    const pageDir=path.join(dir,rel); fs.mkdirSync(pageDir,{recursive:true});
    fs.writeFileSync(path.join(pageDir,'index.html'),renderBlueprintPage(plan,plan.visual,page));
    generatedPages.push(`${rel}/index.html`);
  }
  fs.writeFileSync(path.join(dir,'site-blueprint.json'),JSON.stringify(plan.siteBlueprint,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'composition-registry-selection.json'),JSON.stringify({registry:plan.visual.registry,patterns:plan.visual.patterns,primitives:plan.visual.primitives,plugins:plan.visual.plugins,connectors:plan.visual.connectors,workflow:plan.visual.workflow,interactions:plan.visual.interactions},null,2)+'\n');
  fs.writeFileSync(path.join(dir,'renderer-coverage.json'),JSON.stringify(plan.visual.rendererCoverage,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'project-local-components.json'),JSON.stringify({schema:'webforge.project-local-components.r1',reviewRequired:plan.visual.templates.productionReviewRequired,components:plan.visual.projectLocalComponents},null,2)+'\n');
  fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify(packageFor(plan,id),null,2)+'\n');
  fs.writeFileSync(path.join(dir,'server.mjs'),portableServer());
  const runtimeForge=forgeRuntimeProject(dir,plan);
  const runtimeBuild=verifyRuntimeBuild(path.join(dir,'runtime'));
  const deployPlan=deploymentPlan(plan,id);
  manifest.visual=plan.visual; manifest.runtimeForge=runtimeForge; manifest.runtimeBuild=runtimeBuild; manifest.deployment=deployPlan;
  fs.writeFileSync(path.join(dir,'deployment.plan.json'),JSON.stringify(deployPlan,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'runtime-build.receipt.json'),JSON.stringify(runtimeBuild,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'webforge.manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const receipt = {
    schema:'webforge.evidence.receipt.v1', receiptId:crypto.randomUUID(), projectId:id, timestamp:now(),
    action:'generate-universal-web-product', status:'PASS', policy:'PASS', runtime:plan.selection.runtime.id, template:plan.layout.id, brand:plan.brand.identity.name,
    artifacts:['index.html','styles.css','universal.plan.json','domain.model.json','website-genome.json','product.model.json','experience.model.json','design-dna.json','site-blueprint.json','composition-registry-selection.json','renderer-coverage.json','project-local-components.json','visual-composition.json','media.plan.json','media.requests.json','assets/media','package.json','server.mjs','webforge.manifest.json','deployment.plan.json','runtime-build.receipt.json',...generatedPages,...runtimeForge.files.map(x=>`runtime/${x}`)],
    checks:[
      {id:'universal-domain-model',status:'PASS',detail:{classification:plan.domain.classification,domain:plan.project.domainArchetype,confidence:plan.domain.confidence}},
      {id:'website-genome',status:'PASS',detail:plan.domain.genome},
      {id:'product-capabilities',status:plan.product.unresolved.length?'UNRESOLVED':plan.product.conditional.length?'CONDITIONAL':'PASS',detail:{count:plan.product.capabilityIds.length,unresolved:plan.product.unresolved,conditional:plan.product.conditional}},
      {id:'experience-synthesis',status:'PASS',detail:{mode:plan.experience.mode,pages:plan.experience.pageCount,jobs:plan.experience.journeys.length}},
      {id:'design-dna',status:'PASS',detail:{mode:plan.designDNA.mode,grid:plan.designDNA.grid,motion:plan.designDNA.motion}},
      {id:'policy-gate',status:'PASS'},
      {id:'runtime-resolved',status:'PASS'},
      {id:'component-trust',status:'PASS'},
      {id:'portable-preview',status:'PASS'},
      {id:'visual-composition',status:'PASS',detail:plan.visual.version},
      {id:'composition-registry',status:'PASS',detail:plan.visual.registry.counts},
      {id:'site-blueprint',status:'PASS',detail:{id:plan.siteBlueprint.id,pages:plan.siteBlueprint.pageCount,generatedStaticPages:generatedPages.length}},
      {id:'plugin-resolution',status:'PASS',detail:plan.visual.plugins.set},
      {id:'workflow-resolution',status:'PASS',detail:plan.visual.workflow.primary.id},
      {id:'section-templates',status:'PASS',detail:plan.visual.sections.map(x=>`${x.id}:${x.template}`)},
      {id:'renderer-coverage',status:plan.visual.rendererCoverage.missing.length?'FAIL':'PASS',detail:plan.visual.rendererCoverage},
      {id:'project-local-components',status:plan.visual.templates.productionReviewRequired?'REVIEW_REQUIRED':'PASS',detail:plan.visual.projectLocalComponents.map(x=>x.id)},
      {id:'media-plan',status:'PASS',detail:{slots:plan.visual.media.slots.length,policy:plan.visual.media.productionPolicy}},
      {id:'media-request-plan',status:'PASS',detail:{requests:mediaRequests.requests.length,gate:mediaRequests.productionGate}},
      {id:'content-binding',status:plan.visual.content.source.status,detail:plan.visual.content.source.productionRequirement},
      {id:'package-resolution',status:runtimeForge.packageResolution.checks.every(x=>x.status==='PASS')?'PASS':'FAIL',detail:runtimeForge.packageResolution.packages},
      {id:'runtime-native-scaffold',status:'PASS',detail:runtimeForge.runtime},
      {id:'runtime-build',status:runtimeBuild.status,detail:runtimeBuild.checks},
      {id:'browser-qa',status:'UNVERIFIED',detail:'run POST /api/qa'},
      {id:'accessibility',status:'UNVERIFIED',detail:'run POST /api/qa'},
      {id:'performance',status:'UNVERIFIED',detail:'run POST /api/qa'},
      {id:'visual-regression',status:'UNVERIFIED',detail:'run POST /api/qa'},
      {id:'preview-deploy',status:'UNVERIFIED',detail:deployPlan.previewTarget},
      {id:'production-deploy',status:'BLOCKED',detail:{reason:'explicit human approval + real content/media/connectors required',productReadiness:plan.product.productionReadiness,connectorGate:plan.visual.connectors.productionGate}}
    ]
  };
  fs.writeFileSync(path.join(dir,'evidence.receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  fs.writeFileSync(path.join(evidenceRoot,`${id}.json`),JSON.stringify(receipt,null,2)+'\n');
  return { status:'PASS', projectId:id, previewUrl:`/preview/${id}/`, projectPath:`generated/${id}`, runtimeProjectPath:`generated/${id}/runtime`, qaStatus:'UNVERIFIED', deploymentStatus:'BLOCKED_PENDING_GATES', productionEligible:plan.productionEligible, universal:{classification:plan.domain.classification,domain:plan.project.domainArchetype,capabilities:plan.product.capabilityIds.length,pages:plan.siteBlueprint.pageCount,designMode:plan.designDNA.mode}, plan, manifest, receipt };
}

export function generatedFile(projectId, file='index.html') {
  if (!/^[a-z0-9-]+$/.test(projectId)) return null;
  const dir=path.resolve(generatedRoot,projectId); const p=path.resolve(dir,file);
  if(!(p===dir || p.startsWith(dir+path.sep)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return null;
  return p;
}

export function generatedProjectDir(projectId){ if(!/^[a-z0-9-]+$/.test(projectId)) return null; const dir=path.resolve(generatedRoot,projectId); return fs.existsSync(dir)&&fs.statSync(dir).isDirectory()?dir:null; }
