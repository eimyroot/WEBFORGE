import fs from 'node:fs';
import path from 'node:path';
import { resolvePackages, writePackageResolution } from './package-policy.mjs';
import { renderWebsite, renderCss, renderBlueprintPage } from './visual-renderer.mjs';

const ensure=p=>fs.mkdirSync(p,{recursive:true});
const write=(root,rel,body)=>{const p=path.join(root,rel);ensure(path.dirname(p));fs.writeFileSync(p,body);return rel};
const slug=v=>String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'webforge-site';
function bodyFragment(plan){
  const html=renderWebsite(plan,plan.visual||{content:{model:{}},sections:[],artDirection:{theme:{id:'fallback'}}},'runtime');
  return html.match(/<body>([\s\S]*?)<\/body>/)?.[1]||'';
}
function copyVisualAssets(projectDir,runtimeRoot){
  const src=path.join(projectDir,'assets'); if(!fs.existsSync(src)) return [];
  const dst=path.join(runtimeRoot,'public','assets'); ensure(path.dirname(dst)); fs.cpSync(src,dst,{recursive:true});
  const files=[]; for(const f of fs.readdirSync(path.join(dst,'media'),{withFileTypes:true})){if(f.isFile())files.push(`public/assets/media/${f.name}`)} return files;
}
function model(plan){return {name:plan.brand.identity.name,seo:plan.brand.content.seo,visual:plan.visual,bodyHtml:bodyFragment(plan),template:plan.layout.id,mood:plan.brand.style.mood,siteBlueprint:plan.siteBlueprint};}

function pageBody(plan,page){const html=renderBlueprintPage(plan,plan.visual,page);return html.match(/<body>([\s\S]*?)<\/body>/)?.[1]||'';}
function staticPages(plan){return (plan.siteBlueprint?.pages||[]).filter(x=>!x.dynamic&&x.path!=='/');}
function astro(root,plan){const site=model(plan),r=resolvePackages('astro').packages,files=[];
 files.push(write(root,'package.json',JSON.stringify({name:`${slug(site.name)}-astro`,private:true,type:'module',scripts:{dev:'astro dev',build:'astro build',preview:'astro preview'},dependencies:{astro:r.astro}},null,2)+'\n'));
 files.push(write(root,'astro.config.mjs',"import { defineConfig } from 'astro/config';\nexport default defineConfig({ output: 'static' });\n"));
 files.push(write(root,'src/styles/global.css',renderCss(plan.visual)));
 files.push(write(root,'src/content/site.json',JSON.stringify(site,null,2)+'\n'));
 files.push(write(root,'src/pages/index.astro',`---\nimport '../styles/global.css';\nimport site from '../content/site.json';\n---\n<!doctype html><html lang="en" data-template={site.template} data-art-direction={site.visual.artDirection.theme.id}><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="description" content={site.seo.description}/><title>{site.seo.title}</title></head><body><Fragment set:html={site.bodyHtml}/></body></html>`));
 for(const page of staticPages(plan)){const rel=page.path.replace(/^\/|\/$/g,'');files.push(write(root,`src/pages/${rel}/index.astro`,`---\nimport '../../styles/global.css';\nimport site from '../../content/site.json';\n---\n<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${page.title} — ${site.name}</title></head><body><Fragment set:html={${JSON.stringify(pageBody(plan,page))}}/></body></html>`));}
 files.push(write(root,'README.md',`# ${site.name}\n\nWEBFORGE 6.0 composition-registry source for Astro.\n`)); return files;}
function next(root,plan){const site=model(plan),r=resolvePackages('next').packages,files=[];
 files.push(write(root,'package.json',JSON.stringify({name:`${slug(site.name)}-next`,private:true,scripts:{dev:'next dev',build:'next build',start:'next start'},dependencies:{next:r.next,react:r.react,'react-dom':r['react-dom']}},null,2)+'\n'));
 files.push(write(root,'next.config.mjs',"const nextConfig={reactStrictMode:true}; export default nextConfig;\n"));files.push(write(root,'jsconfig.json',JSON.stringify({compilerOptions:{baseUrl:'.'}},null,2)+'\n'));
 files.push(write(root,'app/globals.css',renderCss(plan.visual))); files.push(write(root,'content/site.json',JSON.stringify(site,null,2)+'\n'));
 files.push(write(root,'app/layout.jsx',`import './globals.css';import site from '../content/site.json';export const metadata={title:site.seo.title,description:site.seo.description};export default function RootLayout({children}){return <html lang="en" data-template={site.template} data-art-direction={site.visual.artDirection.theme.id}><body>{children}</body></html>}`));
 files.push(write(root,'app/page.jsx',`import site from '../content/site.json';export default function Page(){return <div dangerouslySetInnerHTML={{__html:site.bodyHtml}}/>}`));
 for(const page of staticPages(plan)){const rel=page.path.replace(/^\/|\/$/g,'');files.push(write(root,`app/${rel}/page.jsx`,`export default function Page(){return <div dangerouslySetInnerHTML={{__html:${JSON.stringify(pageBody(plan,page))}}}/>}\n`));}
 files.push(write(root,'README.md',`# ${site.name}\n\nWEBFORGE 6.0 composition-registry source for Next.js.\n`));return files;}
function vite(root,plan){const site=model(plan),r=resolvePackages('vite-react').packages,files=[];
 files.push(write(root,'package.json',JSON.stringify({name:`${slug(site.name)}-vite`,private:true,type:'module',scripts:{dev:'vite',build:'vite build',preview:'vite preview'},dependencies:{'@vitejs/plugin-react':r['@vitejs/plugin-react'],vite:r.vite,react:r.react,'react-dom':r['react-dom']}},null,2)+'\n'));
 files.push(write(root,'vite.config.js',"import { defineConfig } from 'vite';import react from '@vitejs/plugin-react';export default defineConfig({plugins:[react()]});\n"));
 files.push(write(root,'index.html','<div id="root"></div><script type="module" src="/src/main.jsx"></script>\n'));files.push(write(root,'src/styles.css',renderCss(plan.visual)));files.push(write(root,'src/site.json',JSON.stringify(site,null,2)+'\n'));
 files.push(write(root,'src/main.jsx',"import React from 'react';import{createRoot}from'react-dom/client';import App from './App.jsx';import './styles.css';createRoot(document.getElementById('root')).render(<App/>);\n"));
 files.push(write(root,'src/App.jsx',`import site from './site.json';export default function App(){return <div dangerouslySetInnerHTML={{__html:site.bodyHtml}}/>}`));
 files.push(write(root,'site-blueprint.json',JSON.stringify(plan.siteBlueprint,null,2)+'\n'));
 files.push(write(root,'README.md',`# ${site.name}\n\nWEBFORGE 6.0 composition-registry source for Vite + React. Blueprint routes are emitted in site-blueprint.json; static portable preview contains all non-dynamic routes.\n`));return files;}
export function forgeRuntimeProject(projectDir,plan){const runtime=plan.selection.runtime.id,root=path.join(projectDir,'runtime');ensure(root);let files;if(runtime==='astro')files=astro(root,plan);else if(runtime==='next')files=next(root,plan);else if(runtime==='vite-react')files=vite(root,plan);else throw new Error(`Unsupported runtime: ${runtime}`);files.push(...copyVisualAssets(projectDir,root));const packageResolution=writePackageResolution(root,runtime);files.push('package-resolution.json');const manifest={schema:'webforge.runtime-forge.v4',runtime,generated:true,visualParity:true,multiPageBlueprint:true,dependencyPolicy:'trusted exact-version baseline; install/build separately attested',packageResolution,files};fs.writeFileSync(path.join(root,'runtime.manifest.json'),JSON.stringify(manifest,null,2)+'\n');return {...manifest,files:[...files,'runtime.manifest.json']};}
