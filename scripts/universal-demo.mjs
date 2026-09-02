import fs from 'node:fs';
import path from 'node:path';
import {compileUniversalBrief} from '../src/core/universal-compiler.mjs';
import {compose} from '../src/core/compose.mjs';

const briefs=[
  ['venue','Premium techno club in Prague with events, DJs, tickets, gallery, immersive sound and strong conversion.'],
  ['marketplace','Tinder for renting excavators with map, availability, profiles, payments, filters and reviews.'],
  ['impact','A platform where people adopt real trees, follow a digital twin, fund care and see impact over time.'],
  ['funeral','Sensitive funeral service website in Prague with immediate contact, services, transparent guidance and high trust.'],
  ['exhibition','Experimental digital art exhibition navigated as an immersive spatial story with video and interactive chapters.'],
  ['industrial','B2B industrial laser manufacturer with product catalog, technical documentation, quote flow and a 3D product configurator.'],
  ['camp','Children camp website with dates, parent registration, payments, gallery, FAQ and private parent area.'],
  ['civic','City portal where residents report street defects, track status on a map and receive updates.'],
  ['novel','A web ritual for exchanging promises with your future self, represented as evolving constellations and timed unlocks.']
];
const results=[];
for(const [id,brief] of briefs){
  const u=compileUniversalBrief(brief); const p=compose(brief);
  results.push({id,brief,classification:u.domain.classification,domain:u.domain.primary.id,genome:u.domain.genome,capabilities:u.product.capabilityIds,unresolved:u.product.unresolved,pages:u.experience.sitemap.map(x=>x.path),runtime:p.selection.runtime.id,policy:p.policy.status,productionEligible:p.productionEligible});
}
const out={schema:'webforge.universal-matrix.v1',version:'8.0.0',generatedAt:new Date().toISOString(),cases:results,summary:{cases:results.length,novel:results.filter(x=>x.classification==='NOVEL').length,hybrid:results.filter(x=>x.classification==='HYBRID').length,known:results.filter(x=>x.classification==='KNOWN').length,unresolvedCases:results.filter(x=>x.unresolved.length).length}};
fs.mkdirSync('evidence',{recursive:true});fs.writeFileSync(path.join('evidence','UNIVERSAL_MATRIX_8.0.0.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
