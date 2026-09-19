import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {compose} from '../src/core/compose.mjs';
import {generateWebsite,generatedFile} from '../src/core/generator.mjs';

const briefs=[
  'Webové stránky pro květinářství v Praze. Kytice, svatby, doručení květin a vazba na přání.',
  'Boutique hotel in Prague with rooms, spa, restaurant, local guide and direct booking.',
  'B2B analytics SaaS with dashboard, integrations, security, pricing and enterprise demo.',
  'Industrial robotics manufacturer with technical specifications, industries, case studies and request for quote.',
  'A living atlas of household objects where families attach memories and follow objects through generations.',
  'Chef-led neighborhood restaurant with seasonal menu, reservations, private dining and story.'
];
const cleanup=out=>{const p=generatedFile(out.projectId,'index.html');if(p)fs.rmSync(path.dirname(p),{recursive:true,force:true});fs.rmSync(path.join('evidence','generated',`${out.projectId}.json`),{force:true});};
test('diverse briefs produce materially different spatial compositions',()=>{
  const plans=briefs.map(compose);
  const fingerprints=new Set(plans.map(p=>p.visual.spatial.fingerprint));
  const canvases=new Set(plans.map(p=>p.visual.spatial.canvas));
  const heroes=new Set(plans.map(p=>p.visual.spatial.sections.find(x=>x.id==='hero')?.geometry));
  const zones=new Set(plans.map(p=>p.visual.spatial.zones.map(z=>z.kind).join('|')));
  assert.equal(plans.every(p=>p.visual.spatial.version==='webforge.spatial-composition.v1'),true);
  assert.ok(fingerprints.size>=5,`spatial fingerprints ${fingerprints.size}/6`);
  assert.ok(canvases.size>=4,`canvas diversity ${canvases.size}/6`);
  assert.ok(heroes.size>=4,`hero geometry diversity ${heroes.size}/6`);
  assert.ok(zones.size>=4,`zone topology diversity ${zones.size}/6`);
  assert.equal(plans.some(p=>p.visual.spatial.zones.some(z=>z.kind==='paired')),false);
});

test('renderer emits spatial contracts into actual generated HTML',()=>{
  const out=generateWebsite(briefs[4]);
  const html=fs.readFileSync(generatedFile(out.projectId,'index.html'),'utf8');
  assert.match(html,/data-canvas="[^"]+"/);
  assert.match(html,/data-spatial-geometry="[^"]+"/);
  assert.match(html,/data-spatial-width="(?:full|wide|standard|narrow)"/);
  assert.doesNotMatch(html,/zone-paired/);
  cleanup(out);
});
