import fs from 'node:fs';
import { rendererCoverage } from '../src/core/renderer-coverage.mjs';

const baseline=rendererCoverage();
const expanded=rendererCoverage({includeExtensions:true});
const out={
  schema:'webforge.renderer-coverage.r3',
  generatedAt:new Date().toISOString(),
  baseline,
  expanded,
  overlay:{templates:expanded.registered-baseline.registered,contracts:expanded.contracts-baseline.contracts}
};
fs.mkdirSync('evidence',{recursive:true});
fs.writeFileSync('evidence/RENDERER_COVERAGE_R3.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
if(expanded.missing.length||expanded.rendererBacked!==expanded.registered)process.exit(1);
