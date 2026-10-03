import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {compose} from '../src/core/compose.mjs';
import {compileWebUIDesignSpec} from '../src/core/web-ui-contract.mjs';
import {deriveNativeDirectionPlan,deriveContrastDirectionPlan,MIN_DIRECTION_DISTANCE} from '../src/core/design-direction-contract.mjs';
import {applyDesignDirectionToPlan} from '../src/core/design-direction-bridge.mjs';
import {generateStatelessDirectionOptions} from '../src/core/stateless-preview.mjs';
import {generateWebsite,generatedProjectDir} from '../src/core/generator.mjs';

const florist='Premium local florist in Prague with seasonal bouquets, weddings, same-day delivery, subscriptions and a botanical editorial feel.';
const repoRoot=path.resolve(new URL('..',import.meta.url).pathname);

test('selected contrast direction materially overlays the full WEBFORGE plan without mutating base',()=>{
  const base=compose(florist),spec=compileWebUIDesignSpec(base),native=deriveNativeDirectionPlan(spec),contrast=deriveContrastDirectionPlan(native);
  const before=[...base.layout.sections],over=applyDesignDirectionToPlan(base,contrast,{directionId:'contrast',source:'test'});
  assert.deepEqual(base.layout.sections,before);
  assert.notDeepEqual(over.layout.sections,before);
  assert.equal(over.designDirectionSelection.id,'contrast');
  assert.equal(over.designDirectionSelection.authority.release,'NONE');
  assert.equal(over.policy.status,'PASS');assert.equal(over.releaseEligible,true);
  assert.equal(over.layout.sections[0],'hero');assert.equal(over.layout.sections.at(-1),'final-cta');
});
test('selected direction fails closed when it asks for a section role the site cannot support',()=>{
  const base=compose(florist),spec=compileWebUIDesignSpec(base),native=deriveNativeDirectionPlan(spec);
  const invalid={...native,section_1:'integrations',section_2:'offer',section_3:'process',section_4:'faq'};
  assert.throws(()=>applyDesignDirectionToPlan(base,invalid,{directionId:'bad'}),error=>error.code==='DIRECTION_ROLE_UNSUPPORTED');
});

test('stateless product exposes two materially distinct self-contained direction previews',()=>{
  const out=generateStatelessDirectionOptions(florist);
  assert.equal(out.status,'PASS');assert.equal(out.options.length,2);
  const native=out.options.find(x=>x.id==='native'),contrast=out.options.find(x=>x.id==='contrast');
  assert.ok(native&&contrast);assert.ok(contrast.distanceFromNative>=MIN_DIRECTION_DISTANCE);
  assert.notEqual(native.previewSha256,contrast.previewSha256);
  assert.match(native.previewHtml,/<style>/);assert.match(contrast.previewHtml,/<style>/);
  assert.doesNotMatch(native.previewHtml,/styles\.css/);assert.doesNotMatch(contrast.previewHtml,/styles\.css/);
});

test('full generator persists exact selected direction as an auditable build input',()=>{
  const base=compose(florist),spec=compileWebUIDesignSpec(base),contrast=deriveContrastDirectionPlan(deriveNativeDirectionPlan(spec));
  const out=generateWebsite(florist,{directionPlan:contrast,directionId:'contrast',directionSource:'test-selection'}),dir=generatedProjectDir(out.projectId);
  try{
    assert.ok(dir);assert.equal(out.plan.designDirectionSelection.id,'contrast');
    assert.ok(fs.existsSync(path.join(dir,'design-direction.selection.json')));
    const selected=JSON.parse(fs.readFileSync(path.join(dir,'design-direction.selection.json'),'utf8'));
    assert.equal(selected.plan_sha256,out.plan.designDirectionSelection.plan_sha256);
    assert.equal(selected.authority.production,'NONE');
    assert.ok(out.receipt.artifacts.includes('design-direction.selection.json'));
  } finally {
    if(dir)fs.rmSync(dir,{recursive:true,force:true});
    fs.rmSync(path.join(repoRoot,'evidence','generated',`${out.projectId}.json`),{force:true});
  }
});