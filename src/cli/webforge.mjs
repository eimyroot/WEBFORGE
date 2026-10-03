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
import { compileWebUIDesignSpec } from '../core/web-ui-contract.mjs';
import { runWebUiQualityMatrix } from '../core/web-ui-quality.mjs';
import { runWebUiVisualCritic, runWebUiRefinement } from '../core/web-ui-refinement.mjs';
import { runPerceptualReviewRequest, runPerceptualVisualCritic } from '../core/web-ui-perceptual-critic.mjs';
import { runWebUiBehaviorVerifier } from '../core/web-ui-behavior.mjs';
import { runGeneratorTournament } from '../core/generator-tournament.mjs';
import { rescoreGeneratorTournamentRun } from '../core/generator-tournament-design-score.mjs';
import { runDesignDirectionTournament, rescoreDesignDirectionTournament } from '../core/design-direction-tournament.mjs';

const [cmd,...rest]=process.argv.slice(2);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const print=x=>console.log(JSON.stringify(x,null,2));

if(cmd==='factory') print(await runAutonomousFactory(rest.join(' ')));
else if(['plan','resolve','explain'].includes(cmd)) print(compose(rest.join(' ')));
else if(cmd==='design-spec') print(compileWebUIDesignSpec(compose(rest.join(' '))));
else if(cmd==='generate') print(generateWebsite(rest.join(' ')));
else if(cmd==='qa'){
  const dir=generatedProjectDir(rest[0]); if(!dir) throw new Error('Unknown projectId');
  let qa=await runBrowserQa(dir,{baseline:true});
  if(qa.checks.some(x=>x.id==='visual-regression'&&x.status==='BASELINE_CREATED')) qa=await runBrowserQa(dir,{baseline:true});
  print(qa);
}
else if(cmd==='qa-matrix'){
  const dir=generatedProjectDir(rest[0]); if(!dir) throw new Error('Unknown projectId');
  print(await runWebUiQualityMatrix(dir));
}
else if(cmd==='behavior-qa'){
  const dir=generatedProjectDir(rest[0]); if(!dir) throw new Error('Unknown projectId');
  print(await runWebUiBehaviorVerifier(dir));
}
else if(cmd==='visual-critic'){
  const dir=generatedProjectDir(rest[0]); if(!dir) throw new Error('Unknown projectId');
  const result=await runWebUiVisualCritic(dir); print(result.critique);
}
else if(cmd==='perceptual-request'){
  const dir=generatedProjectDir(rest[0]); if(!dir) throw new Error('Unknown projectId');
  print(await runPerceptualReviewRequest(dir));
}
else if(cmd==='perceptual-critic'){
  const dir=generatedProjectDir(rest[0]); if(!dir) throw new Error('Unknown projectId');
  const inputFlag=rest.find(x=>x.startsWith('--input='));
  const evaluatorOutput=inputFlag?JSON.parse(fs.readFileSync(path.resolve(inputFlag.slice('--input='.length)),'utf8')):null;
  print(runPerceptualVisualCritic(dir,{evaluatorOutput}));
}
else if(cmd==='visual-refine'){
  const dir=generatedProjectDir(rest[0]); if(!dir) throw new Error('Unknown projectId');
  const maxFlag=rest.find(x=>x.startsWith('--max-iterations='));
  const perceptualFlag=rest.find(x=>x.startsWith('--perceptual='));
  const maxIterations=maxFlag?Number(maxFlag.split('=')[1]):1;
  const perceptualCritique=perceptualFlag?JSON.parse(fs.readFileSync(path.resolve(perceptualFlag.slice('--perceptual='.length)),'utf8')):null;
  const result=await runWebUiRefinement(dir,{maxIterations,perceptualCritique}); print(result.receipt);
}
else if(cmd==='generator-tournament'){
  const flag=name=>rest.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)||null;
  const briefsFile=flag('briefs'),modelPath=flag('model'),outputRoot=flag('out');
  if(!briefsFile||!outputRoot) throw new Error('Usage: webforge generator-tournament --briefs=/path/briefs.json --out=/path/evidence [--model=/path/model.gguf] [--max-tokens=128] [--threads=8]');
  const entries=JSON.parse(fs.readFileSync(path.resolve(briefsFile),'utf8'));
  print(await runGeneratorTournament(entries,{outputRoot:path.resolve(outputRoot),modelPath:modelPath?path.resolve(modelPath):null,maxTokens:Number(flag('max-tokens')||128),threads:Number(flag('threads')||8)}));
}
else if(cmd==='generator-tournament-score'){
  const flag=name=>rest.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)||null;
  const runRoot=flag('run'),reviewsFile=flag('reviews');
  if(!runRoot||!reviewsFile) throw new Error('Usage: webforge generator-tournament-score --run=/path/run --reviews=/path/reviews.json');
  const reviews=JSON.parse(fs.readFileSync(path.resolve(reviewsFile),'utf8'));
  print(rescoreGeneratorTournamentRun(path.resolve(runRoot),{reviews}));
}
else if(cmd==='design-direction-tournament'){
  const flag=name=>rest.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)||null;
  const brief=flag('brief'),outputRoot=flag('out'),modelPath=flag('model');
  if(!brief||!outputRoot) throw new Error('Usage: webforge design-direction-tournament --brief="..." --out=/path/evidence [--model=/path/model.gguf]');
  print(await runDesignDirectionTournament(brief,{outputRoot:path.resolve(outputRoot),modelPath:modelPath?path.resolve(modelPath):null,maxTokens:Number(flag('max-tokens')||128),threads:Number(flag('threads')||8)}));
}
else if(cmd==='design-direction-tournament-score'){
  const flag=name=>rest.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3)||null;
  const runRoot=flag('run'),reviewsFile=flag('reviews');
  if(!runRoot||!reviewsFile) throw new Error('Usage: webforge design-direction-tournament-score --run=/path/run --reviews=/path/reviews.json [--top=3]');
  const reviews=JSON.parse(fs.readFileSync(path.resolve(reviewsFile),'utf8'));
  print(rescoreDesignDirectionTournament(path.resolve(runRoot),{reviews,topK:Number(flag('top')||3),minDistance:Number(flag('min-distance')||0.30)}));
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
else {console.log('Usage: webforge <factory|universal|domain|genome|product|experience|plan|design-spec|generate|qa|qa-matrix|behavior-qa|visual-critic|perceptual-request|perceptual-critic|visual-refine|generator-tournament|generator-tournament-score|design-direction-tournament|design-direction-tournament-score|runtime-build|release|deploy|components|registry|blueprint|plugins|workflow|audit> ...'); process.exitCode=1;}
