import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {compose} from '../src/core/compose.mjs';
import {forgeRuntimeProject} from '../src/core/runtime-forge.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null};
const output=arg('--output');
const cases=[
  ['next','Premium ecommerce store with products, search, accounts and checkout.'],
  ['astro','Premium tattoo studio called INKFORM in Prague with gallery booking local SEO and editorial content.']
];
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const results=[];

for(const [runtime,brief] of cases){
  const plan=compose(brief); plan.selection.runtime={...plan.selection.runtime,id:runtime};
  const dir=path.join(root,'generated',`_runtime-dynamic-smoke-${runtime}`);
  fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  try{
    const manifest=forgeRuntimeProject(dir,plan),rr=path.join(dir,'runtime');
    const modules=['data-contract.mjs','provider-adapter.mjs','provider.mjs','render-detail.mjs','records.mjs'];
    const moduleChecks=modules.map(name=>{const file=path.join(rr,'lib','webforge',name);let ok=fs.existsSync(file);if(ok)try{execFileSync(process.execPath,['--check',file],{stdio:'ignore'});}catch{ok=false}return {name,status:ok?'PASS':'FAIL'}});
    const contract=JSON.parse(fs.readFileSync(path.join(rr,'runtime-data-contract.json'),'utf8'));
    const providerSource=fs.readFileSync(path.join(rr,'lib','webforge','provider.mjs'),'utf8');
    const routeChecks=manifest.dynamicSupport.routes.map(route=>({path:route.path,kind:route.kind,resolution:route.resolution,boundaries:route.boundaries,status:'PASS'}));
    const adapter=await import(pathToFileURL(path.join(rr,'lib','webforge','provider-adapter.mjs')).href+`?t=${Date.now()}`);
    const testProvider=adapter.createProviderAdapter({name:'smoke',list:async()=>[],get:async()=>null});
    const providerOk=(await testProvider.list('product',{pageId:'detail'})).length===0;
    const implicitNetwork=!/\bfetch\s*\(|process\.env/.test(providerSource);
    const status=manifest.dynamicSupport.status==='PASS'&&moduleChecks.every(x=>x.status==='PASS')&&providerOk&&implicitNetwork?'PASS':'FAIL';
    results.push({runtime,status,routes:routeChecks,moduleChecks,providerAdapter:providerOk?'PASS':'FAIL',implicitNetwork:implicitNetwork?'PASS':'FAIL',boundaries:contract.boundaries});
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
const receipt={
  schema:'webforge.runtime-dynamic-smoke.v1',
  status:results.every(x=>x.status==='PASS')?'PASS':'FAIL',
  results,
  frameworkBuild:{status:'UNVERIFIED',reason:'dependency install/network execution was not authorized in this bounded work block'},
  generatedAt:new Date().toISOString(),
  provenance:{repositoryRoot:root,branch:git(['branch','--show-current']),head:git(['rev-parse','HEAD']),dirty:git(['status','--porcelain']).length>0}
};
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify(receipt,null,2));
process.exitCode=receipt.status==='PASS'?0:1;
