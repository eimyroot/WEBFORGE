import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateWebsite, generatedFile } from '../src/core/generator.mjs';
import { compose } from '../src/core/compose.mjs';
import { forgeRuntimeProject } from '../src/core/runtime-forge.mjs';

function cleanup(out){
  const p=generatedFile(out.projectId,'index.html');
  if(p) fs.rmSync(path.dirname(p),{recursive:true,force:true});
  fs.rmSync(path.join('evidence','generated',`${out.projectId}.json`),{force:true});
}

test('Astro selection produces a real Astro source scaffold',()=>{
  const out=generateWebsite('Premium tattoo studio called INKFORM in Prague with gallery booking local SEO and editorial content.');
  assert.equal(out.plan.selection.runtime.id,'astro');
  assert.ok(generatedFile(out.projectId,'runtime/astro.config.mjs'));
  assert.ok(generatedFile(out.projectId,'runtime/src/pages/index.astro'));
  const pkg=JSON.parse(fs.readFileSync(generatedFile(out.projectId,'runtime/package.json'),'utf8'));
  assert.equal(pkg.scripts.build,'astro build');
  assert.equal(out.manifest.runtimeForge.runtime,'astro');
  cleanup(out);
});

test('Next selection produces App Router source scaffold',()=>{
  const out=generateWebsite('SaaS product called SIGNAL with login dashboard pricing integrations analytics and customer accounts.');
  assert.equal(out.plan.selection.runtime.id,'next');
  assert.ok(generatedFile(out.projectId,'runtime/app/page.jsx'));
  assert.ok(generatedFile(out.projectId,'runtime/app/layout.jsx'));
  const pkg=JSON.parse(fs.readFileSync(generatedFile(out.projectId,'runtime/package.json'),'utf8'));
  assert.equal(pkg.scripts.build,'next build');
  cleanup(out);
});

test('Vite React forge is supported and structurally complete',()=>{
  const plan=compose('Web app called FOCUS with a task-first interface.');
  plan.selection.runtime={...plan.selection.runtime,id:'vite-react'};
  const dir=path.resolve('generated','_vite-forge-test');
  fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  const manifest=forgeRuntimeProject(dir,plan);
  assert.equal(manifest.runtime,'vite-react');
  assert.ok(fs.existsSync(path.join(dir,'runtime','src','App.jsx')));
  assert.ok(fs.existsSync(path.join(dir,'runtime','vite.config.js')));
  fs.rmSync(dir,{recursive:true,force:true});
});

test('nested preview path traversal is rejected',()=>{
  const out=generateWebsite('Company website called SAFE with services proof and contact.');
  assert.equal(generatedFile(out.projectId,'../web/index.html'),null);
  assert.equal(generatedFile(out.projectId,'runtime/../../web/index.html'),null);
  cleanup(out);
});
