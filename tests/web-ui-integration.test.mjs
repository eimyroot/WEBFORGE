import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { generateWebsite, generatedProjectDir } from '../src/core/generator.mjs';
import { compileWebUIDesignSpec, WEB_UI_VIEWPORTS } from '../src/core/web-ui-contract.mjs';
import { runWebUiQualityMatrix } from '../src/core/web-ui-quality.mjs';

const florist='Premium local florist in Prague with seasonal bouquets, weddings, same-day delivery, subscriptions and a botanical editorial feel.';
const saas='API monitoring SaaS for engineering teams with realtime alerts, incident workflows, integrations, security and pricing.';

test('Design DNA exports to WebUIDesignSpec/v1 without creating a second authority',()=>{
  const plan=compose(florist);
  const spec=compileWebUIDesignSpec(plan);
  assert.equal(spec.schema,'WebUIDesignSpec/v1');
  assert.equal(spec.provenance.adapter,'webforge.web-ui-contract.v1');
  assert.match(spec.direction.intent,/botanical/i);
  assert.ok(spec.target_users.length>0);
  assert.ok(spec.critical_journeys.length>0);
  assert.ok(spec.components.length>=5);
  assert.ok(spec.layout.responsive_rules.includes('desktop:1280x720'));
  assert.ok(spec.layout.responsive_rules.includes('tablet:768x1024'));
  assert.ok(spec.layout.responsive_rules.includes('mobile:375x812'));
  assert.equal(spec.non_goals.includes('replacement of WEBFORGE project-native browser QA'),true);
});

test('different briefs keep materially different design directions in exported contract',()=>{
  const a=compileWebUIDesignSpec(compose(florist));
  const b=compileWebUIDesignSpec(compose(saas));
  assert.notEqual(a.direction.intent,b.direction.intent);
  assert.notEqual(a.direction.name,b.direction.name);
  assert.notDeepEqual(a.layout.information_hierarchy,b.layout.information_hierarchy);
});

test('responsive quality matrix executes exact shared desktop tablet mobile viewports',async()=>{
  const calls=[];
  const qaRunner=async(_dir,options)=>{
    calls.push(options.viewport);
    return {schema:'webforge.browser-qa.test-double.v1',status:'PASS',checks:[
      {id:'browser-qa',status:'PASS'},
      {id:'accessibility',status:'PASS'},
      {id:'responsive-overflow',status:'PASS'},
      {id:'performance',status:'PASS'}
    ],screenshot:{current:`qa/${options.evidenceKey}/current.png`}};
  };
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-webui-'));
  try{
    const receipt=await runWebUiQualityMatrix(dir,{qaRunner});
    assert.equal(receipt.status,'PASS');
    assert.deepEqual(calls,WEB_UI_VIEWPORTS.map(x=>({width:x.width,height:x.height,mobile:x.mobile})));
    assert.ok(fs.existsSync(path.join(dir,'web-ui-quality.receipt.json')));
    assert.equal(receipt.checks.release_gate_changed,false);
    assert.equal(receipt.truth_boundary.production_authority,'NONE');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('generator emits WebUIDesignSpec as additive evidence artifact',()=>{
  const out=generateWebsite(florist),dir=generatedProjectDir(out.projectId);
  try{
    const file=path.join(dir,'web-ui-design-spec.json');
    assert.ok(fs.existsSync(file));
    const spec=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(spec.schema,'WebUIDesignSpec/v1');
    assert.equal(out.manifest.webUiDesignSpec.file,'web-ui-design-spec.json');
    assert.ok(out.receipt.artifacts.includes('web-ui-design-spec.json'));
    assert.ok(out.receipt.checks.some(x=>x.id==='web-ui-design-spec'&&x.status==='PASS'));
  } finally {
    fs.rmSync(dir,{recursive:true,force:true});
    fs.rmSync(new URL(`../evidence/generated/${out.projectId}.json`,import.meta.url),{force:true});
  }
});
