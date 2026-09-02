import fs from 'node:fs'; import path from 'node:path'; import { compose } from '../src/core/compose.mjs';
const required=['webforge','project','capability','pattern','component','tool','service','runtime','policy','evidence','visual-composition','media-plan','section-template','primitive','page-blueprint','art-direction','media-role','interaction','connector-contract','plugin','plugin-set','workflow','composition-registry','website-genome','domain-model','product-model','design-dna','universal-plan'].map(x=>`schemas/${x}.schema.json`); const evidence=[];
for(const f of required) evidence.push({check:`exists:${f}`,status:fs.existsSync(path.join(process.cwd(),f))?'PASS':'FAIL'});

const registryFiles={'domain-ontology':20,'capability-ontology':65,primitives:60,'section-templates':320,'page-blueprints':30,'art-directions':15,'media-roles':30,interactions:40,'connector-contracts':20,plugins:20,'plugin-sets':10,workflows:10,'composition-patterns':60,'renderer-contracts':30};
for(const [name,min] of Object.entries(registryFiles)){const items=JSON.parse(fs.readFileSync(`src/registries/${name}.json`));evidence.push({check:`registry:${name}>=${min}`,status:items.length>=min?'PASS':'FAIL',detail:String(items.length)});}

const comps=JSON.parse(fs.readFileSync('src/registries/components.json')); evidence.push({check:'component-count>=20',status:comps.length>=20?'PASS':'FAIL',detail:String(comps.length)});
for(const f of fs.readdirSync('fixtures')){const b=JSON.parse(fs.readFileSync(path.join('fixtures',f))).brief; const p=compose(b); evidence.push({check:`fixture:${f}`,status:p.policy.status,detail:`${p.project.archetype}/${p.selection.runtime.id}`});}
const fail=evidence.some(x=>x.status!=='PASS'); fs.mkdirSync('evidence',{recursive:true}); fs.writeFileSync('evidence/verify.json',JSON.stringify({generatedAt:new Date().toISOString(),evidence},null,2)); console.log(JSON.stringify(evidence,null,2)); if(fail)process.exit(1);
