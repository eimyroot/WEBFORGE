import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {compose} from '../src/core/compose.mjs';
import {forgeRuntimeProject} from '../src/core/runtime-forge.mjs';
import {runtimeDataContract,validateDetailRecord} from '../src/runtime/data-contract.mjs';
import {createProviderAdapter} from '../src/runtime/provider.mjs';

const root=path.resolve('generated');
function forge(name,brief,runtime){
  const plan=compose(brief); plan.selection.runtime={...plan.selection.runtime,id:runtime};
  const dir=path.join(root,name); fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  return {dir,plan,manifest:forgeRuntimeProject(dir,plan)};
}
const read=(dir,rel)=>fs.readFileSync(path.join(dir,'runtime',rel),'utf8');
const exists=(dir,rel)=>fs.existsSync(path.join(dir,'runtime',rel));

const validProduct={id:'p-1',slug:'sample-product',kind:'product',title:'Sample product',summary:'Source-backed sample.',source:{provider:'fixture',recordId:'p-1',classification:'public-content',provenance:'test fixture'},fields:{price:'€10',availability:'in-stock'}};
test('runtime data contract validates source-backed public records and rejects secret-shaped fields',()=>{
  assert.equal(validateDetailRecord(validProduct,'product').status,'PASS');
  const bad={...validProduct,fields:{apiToken:'nope'}};
  assert.equal(validateDetailRecord(bad,'product').status,'FAIL');
  assert.match(validateDetailRecord({...validProduct,slug:'Bad Slug'},'product').errors.join(','),/slug:invalid/);
  const contract=runtimeDataContract('next');
  assert.equal(contract.boundaries.dynamicResolution,'request-time');
  assert.equal(contract.classification,'public-content-only');
});

test('provider adapters keep context explicit and default contract side-effect free',async()=>{
  let seen=null;
  const provider=createProviderAdapter({name:'test',list:async(kind,context)=>{seen={kind,context};return [validProduct]},get:async()=>validProduct});
  const rows=await provider.list('product',{pageId:'detail'});
  assert.equal(rows.length,1); assert.deepEqual(seen,{kind:'product',context:{pageId:'detail'}});
  const source=fs.readFileSync('src/runtime/provider.mjs','utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/process\.env/);
});
test('Next runtime emits native dynamic route and loading not-found error boundaries',()=>{
  const x=forge('_runtime-next-dynamic','Premium ecommerce store with products, search, accounts and checkout.','next');
  try{
    assert.equal(x.manifest.schema,'webforge.runtime-forge.v5');
    assert.equal(x.manifest.dynamicSupport.status,'PASS');
    assert.ok(exists(x.dir,'app/product/[slug]/page.jsx'));
    assert.ok(exists(x.dir,'app/product/[slug]/loading.jsx'));
    assert.ok(exists(x.dir,'app/product/[slug]/not-found.jsx'));
    assert.ok(exists(x.dir,'app/product/[slug]/error.jsx'));
    assert.match(read(x.dir,'app/product/[slug]/page.jsx'),/getValidated\("product",slug/);
    assert.match(read(x.dir,'app/product/[slug]/page.jsx'),/force-dynamic/);
    assert.ok(exists(x.dir,'runtime-data-contract.json'));
    assert.ok(exists(x.dir,'PROVIDER.md'));
  }finally{fs.rmSync(x.dir,{recursive:true,force:true})}
});
test('Astro runtime emits native static dynamic routes with explicit static boundary semantics',()=>{
  const x=forge('_runtime-astro-dynamic','Premium tattoo studio called INKFORM in Prague with gallery booking local SEO and editorial content.','astro');
  try{
    assert.equal(x.manifest.dynamicSupport.status,'PASS');
    assert.ok(exists(x.dir,'src/pages/services/[slug].astro'));
    assert.ok(exists(x.dir,'src/pages/resources/[slug].astro'));
    assert.ok(exists(x.dir,'src/pages/404.astro'));
    assert.match(read(x.dir,'src/pages/services/[slug].astro'),/getStaticPaths/);
    const serviceRoute=read(x.dir,'src/pages/services/[slug].astro');
    assert.match(serviceRoute,/listValidated\("product"/);
    assert.match(serviceRoute,/from '\.\.\/\.\.\/\.\.\/lib\/webforge\/provider\.mjs'/);
    assert.ok(exists(x.dir,'lib/webforge/provider.mjs'));
    const contract=JSON.parse(read(x.dir,'runtime-data-contract.json'));
    assert.equal(contract.boundaries.loading,'NOT_APPLICABLE_STATIC_BUILD');
    assert.equal(contract.boundaries.error,'FAIL_CLOSED_BUILD');
    assert.equal(x.manifest.dynamicSupport.routes[0].resolution,'getStaticPaths');
  }finally{fs.rmSync(x.dir,{recursive:true,force:true})}
});
