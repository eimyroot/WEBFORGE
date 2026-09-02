import path from 'node:path'; import fs from 'node:fs';
import {generateWebsite,generatedProjectDir} from '../src/core/generator.mjs';
import {fulfillMedia} from '../src/core/media-fulfillment.mjs';import {fulfillContent} from '../src/core/content-fulfillment.mjs';import {connectorExecutionPlan} from '../src/core/live-connectors.mjs';
import {renderWebsite,renderCss,renderBlueprintPage} from '../src/core/visual-renderer.mjs';import {forgeRuntimeProject} from '../src/core/runtime-forge.mjs';
const brief=process.argv.slice(2).join(' ')||'Premium techno club called VANTA in Prague. Dark cinematic mobile-first website with events, DJs, tickets, gallery, immersive sound, membership and strong conversion.';
const out=generateWebsite(brief); const dir=generatedProjectDir(out.projectId); const assetDir=process.env.WEBFORGE_MEDIA_ASSET_DIR||path.resolve('demo-media');
const media=fulfillMedia(dir,{assetDir,approve:process.env.WEBFORGE_APPROVE_DEMO_MEDIA==='1'});const content=fulfillContent(dir,{approve:process.env.WEBFORGE_APPROVE_DEMO_CONTENT==='1'});const connectors=connectorExecutionPlan(dir);
// Bind fulfilled media back into the visual model and regenerate portable + runtime-native output.
const visual=JSON.parse(fs.readFileSync(path.join(dir,'visual-composition.json'),'utf8'));
const bySlot=new Map(media.items.filter(x=>x.asset).map(x=>[x.slotId,'./'+x.asset]));
for(const section of visual.sections||[]) for(const slot of section.media||[]) if(bySlot.has(slot.id)){slot.src=bySlot.get(slot.id);slot.status=media.status==='PASS'?'APPROVED':'FULFILLED';}
for(const slot of visual.media?.slots||[]) if(bySlot.has(slot.id)){slot.src=bySlot.get(slot.id);slot.status=media.status==='PASS'?'APPROVED':'FULFILLED';}
out.plan.visual=visual; fs.writeFileSync(path.join(dir,'visual-composition.json'),JSON.stringify(visual,null,2)+'\n');
fs.writeFileSync(path.join(dir,'index.html'),renderWebsite(out.plan,visual,out.projectId));fs.writeFileSync(path.join(dir,'styles.css'),renderCss(visual));
for(const page of out.plan.siteBlueprint?.pages||[]){if(page.dynamic||page.path==='/')continue;const rel=page.path.replace(/^\//,'').replace(/\/$/,'');const pd=path.join(dir,rel);fs.mkdirSync(pd,{recursive:true});fs.writeFileSync(path.join(pd,'index.html'),renderBlueprintPage(out.plan,visual,page));}
forgeRuntimeProject(dir,out.plan);
console.log(JSON.stringify({status:'PASS',projectId:out.projectId,dir,previewUrl:`/preview/${out.projectId}/`,media,content,connectors},null,2));
