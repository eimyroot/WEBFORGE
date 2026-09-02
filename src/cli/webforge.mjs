#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compose } from '../core/compose.mjs';
import { generateWebsite, generatedProjectDir } from '../core/generator.mjs';
import { runBrowserQa } from '../core/browser-qa.mjs';
import { verifyRuntimeBuild } from '../core/runtime-build.mjs';
import { evaluateDeployment } from '../core/deployment.mjs';
import { executeDeployment } from '../core/deployment-executor.mjs';
import { registrySummary, registry } from '../core/composition-registry.mjs';
import { analyzeDomain, domainOntology } from '../core/domain-intelligence.mjs';
import { capabilityOntology } from '../core/product-intelligence.mjs';
import { compileUniversalBrief } from '../core/universal-compiler.mjs';
import { runAutonomousFactory } from '../core/factory.mjs';
import { federatedSources, searchFederatedComponents, inspectFederatedCandidate } from '../core/federated-components.mjs';

const [cmd,...rest]=process.argv.slice(2);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const print=x=>console.log(JSON.stringify(x,null,2));

if(cmd==='factory') print(await runAutonomousFactory(rest.join(' ')));
else if(['plan','resolve','explain'].includes(cmd)) print(compose(rest.join(' ')));
else if(cmd==='generate') print(generateWebsite(rest.join(' ')));
else if(cmd==='qa'){
  const dir=generatedProjectDir(rest[0]); if(!dir) throw new Error('Unknown projectId');
  let qa=await runBrowserQa(dir,{baseline:true});
  if(qa.checks.some(x=>x.id==='visual-regression'&&x.status==='BASELINE_CREATED')) qa=await runBrowserQa(dir,{baseline:true});
  print(qa);
}
else if(cmd==='runtime-build'){
  const dir=generatedProjectDir(rest[0]); if(!dir) throw new Error('Unknown projectId');
  const allowNetwork=rest.includes('--allow-network'); const receipt=verifyRuntimeBuild(path.join(dir,'runtime'),{allowNetwork});
  fs.writeFileSync(path.join(dir,'runtime-build.receipt.json'),JSON.stringify(receipt,null,2)+'\n'); print(receipt);
}
else if(cmd==='release'){
  const dir=generatedProjectDir(rest[0]); if(!dir) throw new Error('Unknown projectId');
  const evidence=JSON.parse(fs.readFileSync(path.join(dir,'evidence.receipt.json'),'utf8'));
  const build=JSON.parse(fs.readFileSync(path.join(dir,'runtime-build.receipt.json'),'utf8'));
  const qaPath=path.join(dir,'qa','browser-qa.json'); const qa=fs.existsSync(qaPath)?JSON.parse(fs.readFileSync(qaPath,'utf8')):{checks:[]};
  const checks=[{id:'policy',status:evidence.policy==='PASS'?'PASS':'FAIL'},{id:'runtime-build',status:build.status},...qa.checks.filter(x=>['browser-qa','accessibility','performance','visual-regression'].includes(x.id)).map(x=>({id:x.id,status:x.status}))];
  print({checks,...evaluateDeployment({checks},{productionApproved:rest.includes('--approve-production')})});
}
else if(cmd==='deploy'){
  const [projectId,mode='preview',provider='vercel',...flags]=rest; const dir=generatedProjectDir(projectId); if(!dir) throw new Error('Unknown projectId');
  print(executeDeployment(dir,{mode,provider,productionApproved:flags.includes('--approve-production')}));
}


else if(cmd==='universal') print(compileUniversalBrief(rest.join(' ')));
else if(cmd==='domain') print(analyzeDomain(rest.join(' ')));
else if(cmd==='genome') print(analyzeDomain(rest.join(' ')).genome);
else if(cmd==='product') print(compileUniversalBrief(rest.join(' ')).product);
else if(cmd==='experience') print(compileUniversalBrief(rest.join(' ')).experience);
else if(cmd==='domain-ontology') print({status:'PASS',items:domainOntology()});
else if(cmd==='capability-ontology') print({status:'PASS',items:capabilityOntology()});

else if(cmd==='components'){
  const sub=rest.shift()||'sources';
  if(sub==='sources') print({status:'PASS',items:federatedSources()});
  else if(sub==='search') print(await searchFederatedComponents(rest.join(' ')));
  else if(sub==='inspect'){ const candidate=JSON.parse(rest.join(' ')); print(await inspectFederatedCandidate(candidate)); }
  else throw new Error('Usage: webforge components <sources|search|inspect> ...');
}

else if(cmd==='registry'){
  if(rest[0]) print({status:'PASS',name:rest[0],items:registry(rest[0])}); else print({status:'PASS',...registrySummary()});
}
else if(cmd==='blueprint') {const p=compose(rest.join(' '));print(p.siteBlueprint);}
else if(cmd==='plugins') {const p=compose(rest.join(' '));print(p.visual.plugins);}
else if(cmd==='workflow') {const p=compose(rest.join(' '));print(p.visual.workflow);}

else if(cmd==='audit') print({schemas:fs.readdirSync(path.join(root,'schemas')).length,components:JSON.parse(fs.readFileSync(path.join(root,'src/registries/components.json'))).length,status:'PASS'});
else {console.log('Usage: webforge <factory|universal|domain|genome|product|experience|plan|generate|qa|runtime-build|release|deploy|components|registry|blueprint|plugins|workflow|audit> ...'); process.exitCode=1;}
