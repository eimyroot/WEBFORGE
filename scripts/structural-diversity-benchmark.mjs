import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runStructuralDiversityBenchmark} from '../src/core/structural-diversity.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const entries=JSON.parse(fs.readFileSync(path.join(root,'tests/data/design-diversity-briefs.json'),'utf8'));
const ids=['boutique-hotel','florist-studio','accounting-saas','corporate-law','techno-club','architecture-portfolio','fine-dining','industrial-marketplace'];
const selected=ids.map(id=>entries.find(x=>x.id===id)).filter(Boolean);
const report=runStructuralDiversityBenchmark(selected);
const output=process.env.WEBFORGE_STRUCTURAL_DIVERSITY_OUTPUT;
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
if(selected.length!==ids.length||report.status!=='PASS')process.exit(1);
