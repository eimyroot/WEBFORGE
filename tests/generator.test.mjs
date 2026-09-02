import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateWebsite, generatedFile } from '../src/core/generator.mjs';

test('final forge action generates a real preview site and evidence receipt',()=>{
  const out=generateWebsite('Premium tattoo studio in Prague with artists, gallery, booking, dark minimal design and mobile-first UX.');
  assert.equal(out.status,'PASS');
  assert.equal(out.plan.policy.status,'PASS');
  assert.match(out.previewUrl,/^\/preview\/[a-z0-9-]+\/$/);
  for(const file of ['index.html','styles.css','package.json','server.mjs','webforge.manifest.json','evidence.receipt.json']) {
    const p=generatedFile(out.projectId,file); assert.ok(p,`missing ${file}`); assert.ok(fs.statSync(p).size>20,`${file} is empty`);
  }
  const receipt=JSON.parse(fs.readFileSync(generatedFile(out.projectId,'evidence.receipt.json'),'utf8'));
  assert.equal(receipt.status,'PASS'); assert.equal(receipt.action,'generate-universal-web-product');
  assert.ok(receipt.checks.every(x=>x.status!=='FAIL')); assert.equal(receipt.checks.find(x=>x.id==='runtime-build')?.status,'UNVERIFIED');
  fs.rmSync(path.dirname(generatedFile(out.projectId,'index.html')),{recursive:true,force:true});
  fs.rmSync(path.join('evidence','generated',`${out.projectId}.json`),{force:true});
});

test('generated preview does not allow path traversal',()=>{
  assert.equal(generatedFile('../evidence','verify.json'),null);
  assert.equal(generatedFile('bad/id','index.html'),null);
});

test('layout intelligence chooses distinct template families and section order',()=>{
  const venue=generateWebsite('Premium techno club in Prague with events, DJs, tickets, cinematic gallery and frequent updates.');
  const saas=generateWebsite('SaaS analytics product with login dashboard integrations pricing and product analytics.');
  assert.ok(venue.plan.layout.parents.some(x=>x.includes('venue-')));
  assert.ok(saas.plan.layout.parents.some(x=>x.includes('saas-')));
  assert.ok(venue.plan.layout.alternatives.length>=3);
  assert.ok(saas.plan.layout.alternatives.length>=3);
  assert.notDeepEqual(venue.plan.layout.sections,saas.plan.layout.sections);
  const venueHtml=fs.readFileSync(generatedFile(venue.projectId,'index.html'),'utf8');
  assert.match(venueHtml,new RegExp(`data-template="${venue.plan.layout.id}"`));
  for (const id of venue.plan.layout.sections.filter(x=>!['hero','final-cta'].includes(x))) assert.match(venueHtml,new RegExp(`id="${id}"`));
  assert.equal(venue.plan.layout.constraints.find(x=>x.id==='hero-first').status,'PASS');
  assert.equal(venue.plan.layout.constraints.find(x=>x.id==='cta-last').status,'PASS');
  const manifest=JSON.parse(fs.readFileSync(generatedFile(saas.projectId,'webforge.manifest.json'),'utf8'));
  assert.ok(['product','authority','conversion','editorial'].includes(manifest.layout.family));
  for (const out of [venue,saas]) {
    fs.rmSync(path.dirname(generatedFile(out.projectId,'index.html')),{recursive:true,force:true});
    fs.rmSync(path.join('evidence','generated',`${out.projectId}.json`),{force:true});
  }
});

test('design intelligence assigns section variants and responsive visual rhythm',()=>{
  const venue=generateWebsite('Premium techno club in Prague with events, DJs, tickets, cinematic gallery and frequent updates.');
  const local=generateWebsite('Local tattoo studio in Prague with booking, gallery, map, FAQ and proof.');
  assert.equal(venue.plan.layout.variants['next-event'],'spotlight');
  assert.equal(venue.plan.layout.variants.gallery,'masonry');
  if(local.plan.layout.sections.includes('process')) assert.equal(local.plan.layout.variants.process,'timeline');
  assert.ok(['authority','editorial','display','product'].includes(local.plan.layout.design.type));
  assert.notEqual(venue.plan.layout.fingerprint,local.plan.layout.fingerprint);
  const html=fs.readFileSync(generatedFile(venue.projectId,'index.html'),'utf8');
  const css=fs.readFileSync(generatedFile(venue.projectId,'styles.css'),'utf8');
  assert.match(html,/variant-spotlight/);
  assert.match(html,/variant-masonry/);
  assert.match(css,/\.next-event-feature/);
  assert.match(css,/@media\(max-width:640px\)/);
  for (const out of [venue,local]) {
    fs.rmSync(path.dirname(generatedFile(out.projectId,'index.html')),{recursive:true,force:true});
    fs.rmSync(path.join('evidence','generated',`${out.projectId}.json`),{force:true});
  }
});
