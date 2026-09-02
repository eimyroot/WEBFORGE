import fs from 'node:fs';
import { rendererCoverage } from '../src/core/renderer-coverage.mjs';
const out={...rendererCoverage(),generatedAt:new Date().toISOString()};
fs.mkdirSync('evidence',{recursive:true});
fs.writeFileSync('evidence/RENDERER_COVERAGE_8.0.0.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
if(out.missing.length||out.rendererBacked!==out.registered)process.exit(1);
