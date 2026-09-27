import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runStructuralDiversityBenchmark} from '../src/core/structural-diversity.mjs';
import {STRUCTURAL_PLAYGROUND_BASELINES} from '../src/core/structural-diversity-baseline.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const selected=STRUCTURAL_PLAYGROUND_BASELINES;
const report=runStructuralDiversityBenchmark(selected);
const output=process.env.WEBFORGE_STRUCTURAL_DIVERSITY_OUTPUT;
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
if(selected.length!==8||report.status!=='PASS')process.exit(1);
