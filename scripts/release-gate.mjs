import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolvePackages} from '../src/core/package-policy.mjs';
import {discoverChromium} from '../src/core/browser-qa.mjs';
const checks=[];
function run(id,args){try{execFileSync('npm',args,{stdio:'pipe'});checks.push({id,status:'PASS'});}catch(e){checks.push({id,status:'FAIL',detail:String(e.stdout||e.message).slice(-2000)});}}
run('tests',['test']);run('renderer-coverage',['run','renderer:coverage']);run('universal-matrix',['run','universal:demo']);run('verify',['run','verify']);run('build',['run','build']);run('audit',['run','audit']);
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));checks.push({id:'package-version-9.1.0',status:pkg.version==='9.1.0'?'PASS':'FAIL'});
const server=fs.readFileSync('src/api/server.mjs','utf8');checks.push({id:'api-version-9.1.0',status:server.includes("const version='9.1.0'")?'PASS':'FAIL'});
for(const route of ['/api/qa','/api/runtime-build','/api/deploy','/api/environment','/api/visual/approve','/api/visual/registry','/api/registry','/api/fulfill/media','/api/fulfill/content','/api/connectors/plan','/api/factory/run','/api/universal/analyze','/api/universal/domain','/api/universal/capabilities','/api/components/sources','/api/components/search']) checks.push({id:`route:${route}`,status:server.includes(`'${route}'`)?'PASS':'FAIL'});
for(const runtime of ['astro','next','vite-react']){const r=resolvePackages(runtime);checks.push({id:`package-policy:${runtime}`,status:r.checks.every(x=>x.status==='PASS')?'PASS':'FAIL',detail:r.packages});}
checks.push({id:'browser-capability',status:discoverChromium()?'PASS':'UNVERIFIED',detail:discoverChromium()||'not installed on this machine'});
checks.push({id:'visual-composition-engine',status:fs.existsSync('src/core/visual-composition.mjs')&&fs.existsSync('src/core/visual-renderer.mjs')?'PASS':'FAIL'});
checks.push({id:'section-template-registry',status:JSON.parse(fs.readFileSync('src/registries/section-templates.json')).length>=320?'PASS':'FAIL'});
const rendererCoverage=(await import('../src/core/renderer-coverage.mjs')).rendererCoverage();checks.push({id:'renderer-contract-coverage',status:rendererCoverage.missing.length===0&&rendererCoverage.rendererBacked===rendererCoverage.registered?'PASS':'FAIL',detail:rendererCoverage});
checks.push({id:'project-local-component-synthesizer',status:fs.existsSync('src/core/component-synthesizer.mjs')?'PASS':'FAIL'});
checks.push({id:'page-blueprint-registry',status:JSON.parse(fs.readFileSync('src/registries/page-blueprints.json')).length>=30?'PASS':'FAIL'});
checks.push({id:'primitive-registry',status:JSON.parse(fs.readFileSync('src/registries/primitives.json')).length>=60?'PASS':'FAIL'});
checks.push({id:'art-direction-registry',status:JSON.parse(fs.readFileSync('src/registries/art-directions.json')).length>=15?'PASS':'FAIL'});
checks.push({id:'plugin-registry',status:JSON.parse(fs.readFileSync('src/registries/plugins.json')).length>=20?'PASS':'FAIL'});
checks.push({id:'workflow-registry',status:JSON.parse(fs.readFileSync('src/registries/workflows.json')).length>=10?'PASS':'FAIL'});
checks.push({id:'media-intelligence',status:fs.existsSync('src/core/media-intelligence.mjs')?'PASS':'FAIL'});

checks.push({id:'domain-ontology',status:fs.existsSync('src/registries/domain-ontology.json')&&JSON.parse(fs.readFileSync('src/registries/domain-ontology.json')).length>=20?'PASS':'FAIL'});
checks.push({id:'capability-ontology',status:fs.existsSync('src/registries/capability-ontology.json')&&JSON.parse(fs.readFileSync('src/registries/capability-ontology.json')).length>=65?'PASS':'FAIL'});
for(const f of ['src/core/domain-intelligence.mjs','src/core/product-intelligence.mjs','src/core/experience-intelligence.mjs','src/core/design-dna.mjs','src/core/universal-compiler.mjs']) checks.push({id:`universal-core:${f}`,status:fs.existsSync(f)?'PASS':'FAIL'});
for(const f of ['schemas/website-genome.schema.json','schemas/domain-model.schema.json','schemas/product-model.schema.json','schemas/design-dna.schema.json','schemas/universal-plan.schema.json']) checks.push({id:`universal-schema:${f}`,status:fs.existsSync(f)?'PASS':'FAIL'});
const universalTest=fs.readFileSync('tests/universal.test.mjs','utf8');checks.push({id:'cross-domain-regression-matrix',status:universalTest.includes('Tinder')&&universalTest.includes('future')?'PASS':'FAIL'});

const deploy=fs.readFileSync('src/core/deployment.mjs','utf8');checks.push({id:'production-explicit-approval-invariant',status:deploy.includes('productionEligible:productionBlockers.length===0&&productionApproved===true')?'PASS':'FAIL'});
const fed=(await import('../src/core/federated-components.mjs')).federatedSources();checks.push({id:'federated-component-pack',status:fed.length>=14?'PASS':'FAIL',detail:{sources:fed.length}});
const status=checks.some(x=>x.status==='FAIL')?'FAIL':'PASS';console.log(JSON.stringify({status,gate:'PACKAGE',checks},null,2));if(status!=='PASS')process.exit(1);
