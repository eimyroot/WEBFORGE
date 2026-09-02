import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {runAutonomousFactory} from '../src/core/factory.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const briefs=[
'Premium techno club in Prague with events, artists, tickets, gallery and a world-class dark cinematic identity.',
'Marketplace for renting excavators with search, filters, maps, profiles, availability, booking and reviews.',
'Interactive future-self ritual where people create promises represented as evolving constellations and timed unlocks.'
];
const results=[];for(const brief of briefs){const r=await runAutonomousFactory(brief);results.push({brief,projectId:r.projectId,status:r.status,preview:r.preview.status,production:r.production.status,score:r.critiqueHistory.at(-1).score});}
const status=results.every(x=>x.status==='PASS'&&x.preview==='PREVIEW_READY'&&x.production==='BLOCKED')?'PASS':'FAIL';const out={schema:'webforge.factory-matrix.v1',status,results};fs.mkdirSync(path.join(root,'evidence'),{recursive:true});fs.writeFileSync(path.join(root,'evidence','AUTONOMOUS_FACTORY_MATRIX_9.0.0.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));if(status!=='PASS')process.exit(1);
