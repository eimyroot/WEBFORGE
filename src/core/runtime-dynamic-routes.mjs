import fs from 'node:fs';
import path from 'node:path';
import {runtimeDataContract} from '../runtime/data-contract.mjs';

const ensure=p=>fs.mkdirSync(p,{recursive:true});
const write=(root,rel,body)=>{const p=path.join(root,rel);ensure(path.dirname(p));fs.writeFileSync(p,body);return rel};
const source=name=>fs.readFileSync(new URL(`../runtime/${name}`,import.meta.url),'utf8');
const dynamicPages=plan=>(plan.siteBlueprint?.pages||[]).filter(x=>x.dynamic&&x.path.includes('[slug]'));
const routeRel=p=>p.path.replace(/^\/|\/$/g,'');
const importPath=(fromDir,target)=>{let rel=path.posix.relative(fromDir,target);if(!rel.startsWith('.'))rel='./'+rel;return rel};

function writeShared(root,runtime){
  const files=[];
  for(const name of ['data-contract.mjs','provider-adapter.mjs','provider.mjs','render-detail.mjs','records.mjs']){
    files.push(write(root,`lib/webforge/${name}`,source(name)));
  }
  const contract=runtimeDataContract(runtime);
  files.push(write(root,'runtime-data-contract.json',JSON.stringify(contract,null,2)+'\n'));
  files.push(write(root,'PROVIDER.md',providerReadme(contract)));
  return {files,contract};
}

function providerReadme(contract){
  return `# WEBFORGE data provider\n\nDefault provider is local and side-effect free. It ships with empty records.\n\nExternal CMS/API integration is opt-in: replace or wrap \`lib/webforge/provider.mjs\` with an adapter created by \`createProviderAdapter\`. Do not activate network access implicitly.\n\nRequired methods:\n- \`${contract.provider.methods.list}\`\n- \`${contract.provider.methods.get}\`\n\nOnly \`public-content\` records are accepted by this generated contract. Secrets, credentials and authentication tokens are forbidden.\n`;
}
function nextRoute(root,page){
  const rel=routeRel(page),dir=`app/${rel}`;
  const lib=importPath(dir,'lib/webforge');
  const context=JSON.stringify({pageId:page.id,path:page.path});
  const kind=JSON.stringify(page.detailKind||'product');
  const files=[];
  files.push(write(root,`${dir}/page.jsx`,`import {notFound} from 'next/navigation';\nimport {getValidated} from '${lib}/provider.mjs';\nimport {renderDetailRecord} from '${lib}/render-detail.mjs';\nexport const dynamic='force-dynamic';\nexport default async function Page({params}){const {slug}=await params;const record=await getValidated(${kind},slug,${context});if(!record)notFound();return <div dangerouslySetInnerHTML={{__html:renderDetailRecord(record)}}/>}\n`));
  files.push(write(root,`${dir}/loading.jsx`,`export default function Loading(){return <main className="subpage"><section className="page-intro page-intro-overview"><div className="page-intro-copy"><span className="kicker">LOADING</span><h1>Loading detail</h1><p>Waiting for the configured data provider.</p></div></section></main>}\n`));
  files.push(write(root,`${dir}/not-found.jsx`,`export default function NotFound(){return <main className="subpage"><section className="page-intro page-intro-evidence"><div className="page-intro-copy"><span className="kicker">NOT FOUND</span><h1>Detail unavailable</h1><p>No source-backed record matched this route.</p></div></section></main>}\n`));
  files.push(write(root,`${dir}/error.jsx`,`'use client';\nexport default function ErrorBoundary({reset}){return <main className="subpage"><section className="page-intro page-intro-action"><div className="page-intro-copy"><span className="kicker">DATA ERROR</span><h1>Detail could not be loaded</h1><p>The provider or data contract failed closed.</p><button className="button primary" onClick={()=>reset()}>Retry</button></div></section></main>}\n`));
  return {files,route:{pageId:page.id,path:page.path,kind:page.detailKind||'product',resolution:'request-time',boundaries:['loading','not-found','error']}};
}
function astroRoute(root,page){
  const rel=routeRel(page),file=`src/pages/${rel}.astro`,dir=path.posix.dirname(file);
  const lib=importPath(dir,'lib/webforge');
  const styles=importPath(dir,'src/styles/global.css');
  const context=JSON.stringify({pageId:page.id,path:page.path});
  const kind=JSON.stringify(page.detailKind||'product');
  const body=`---\nimport '${styles}';\nimport {listValidated} from '${lib}/provider.mjs';\nimport {renderDetailRecord} from '${lib}/render-detail.mjs';\nexport async function getStaticPaths(){const rows=await listValidated(${kind},${context});return rows.map(record=>({params:{slug:record.slug},props:{record}}));}\nconst {record}=Astro.props;\n---\n<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>{record.title}</title></head><body><Fragment set:html={renderDetailRecord(record)}/></body></html>\n`;
  return {files:[write(root,file,body)],route:{pageId:page.id,path:page.path,kind:page.detailKind||'product',resolution:'getStaticPaths',boundaries:['404-page','fail-closed-build'],loading:'NOT_APPLICABLE_STATIC_BUILD'}};
}

function astroNotFound(root){
  const body=`---\nimport '../styles/global.css';\n---\n<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Not found</title></head><body><main class="subpage"><section class="page-intro page-intro-evidence"><div class="page-intro-copy"><span class="kicker">404</span><h1>Page not found</h1><p>No source-backed record matched this route.</p></div></section></main></body></html>\n`;
  return write(root,'src/pages/404.astro',body);
}
export function forgeDynamicRuntimeSupport(root,plan,runtime){
  const pages=dynamicPages(plan);
  if(!['next','astro'].includes(runtime)||!pages.length){
    return {schema:'webforge.runtime-dynamic-support.v1',status:'NOT_APPLICABLE',runtime,files:[],routes:[],contract:null};
  }
  const shared=writeShared(root,runtime),files=[...shared.files],routes=[];
  for(const page of pages){
    const built=runtime==='next'?nextRoute(root,page):astroRoute(root,page);
    files.push(...built.files);routes.push(built.route);
  }
  if(runtime==='astro')files.push(astroNotFound(root));
  const manifest={schema:'webforge.runtime-dynamic-support.v1',status:'PASS',runtime,routes,contract:shared.contract,boundaryInvariant:runtime==='astro'?'static build: loading UI is not applicable; provider/contract errors fail build':'App Router boundaries generated per dynamic route'};
  files.push(write(root,'dynamic-runtime.manifest.json',JSON.stringify(manifest,null,2)+'\n'));
  return {...manifest,files};
}
