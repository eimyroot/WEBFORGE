import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runMarketCoverageBenchmark} from '../src/core/market-coverage-benchmark.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const datasetPath=path.join(root,'tests/data/market-coverage-briefs.json');
const entries=JSON.parse(fs.readFileSync(datasetPath,'utf8'));
const report=runMarketCoverageBenchmark(entries);
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const receipt={
  ...report,
  generatedAt:new Date().toISOString(),
  provenance:{
    repositoryRoot:root,
    branch:git(['branch','--show-current']),
    head:git(['rev-parse','HEAD']),
    dirty:git(['status','--porcelain']).length>0,
    dataset:'tests/data/market-coverage-briefs.json'
  }
};

const outIndex=process.argv.indexOf('--output');
if(outIndex>=0){
  const out=process.argv[outIndex+1];
  if(!out) throw new Error('--output requires a path');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');
}
console.log(JSON.stringify(receipt,null,2));
process.exitCode=receipt.status==='PASS'?0:1;
