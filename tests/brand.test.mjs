
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {compose} from '../src/core/compose.mjs';
import {generateWebsite,generatedFile} from '../src/core/generator.mjs';

test('brand intelligence resolves identity, style and content model',()=>{
  const p=compose('Premium techno club called VANTA in Prague. Dark cinematic mobile-first website with events, DJs, tickets and gallery.');
  assert.equal(p.version,'8.0.0');
  assert.equal(p.brand.identity.name,'VANTA');
  assert.equal(p.brand.style.mood,'cinematic');
  assert.equal(p.brand.style.palette,'dark-electric');
  assert.ok(p.brand.content.headline.length>15);
  assert.ok(p.brand.content.primaryCta.length>3);
  assert.equal(p.brand.content.seo.location,'Prague');
});

test('generated public site hides internal component ids and carries brand semantics',()=>{
  const out=generateWebsite('Premium techno club called VANTA in Prague. Dark cinematic mobile-first website with events, DJs, tickets and gallery.');
  const html=fs.readFileSync(generatedFile(out.projectId,'index.html'),'utf8');
  const manifest=JSON.parse(fs.readFileSync(generatedFile(out.projectId,'webforge.manifest.json'),'utf8'));
  assert.match(html,/data-brand="VANTA"/);
  assert.match(html,/data-mood="cinematic"/);
  for(const internalId of out.plan.selection.components.map(x=>x.id)){assert.ok(!html.includes(`<h3>${internalId}</h3>`),`public card leaked ${internalId}`);}
  assert.equal(manifest.brand.identity.name,'VANTA');
  fs.rmSync(path.dirname(generatedFile(out.projectId,'index.html')),{recursive:true,force:true});
  fs.rmSync(path.join('evidence','generated',`${out.projectId}.json`),{force:true});
});
