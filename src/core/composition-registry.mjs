import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),dir=path.join(here,'../registries');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const CACHE={
  primitives:read('primitives.json'),sectionTemplates:read('section-templates.json'),pageBlueprints:read('page-blueprints.json'),artDirections:read('art-directions.json'),mediaRoles:read('media-roles.json'),interactions:read('interactions.json'),connectors:read('connector-contracts.json'),plugins:read('plugins.json'),pluginSets:read('plugin-sets.json'),workflows:read('workflows.json'),patterns:read('composition-patterns.json'),rendererContracts:read('renderer-contracts.json'),domainOntology:read('domain-ontology.json'),capabilityOntology:read('capability-ontology.json')
};
export function registry(name){if(!(name in CACHE))throw new Error(`Unknown registry: ${name}`);return structuredClone(CACHE[name]);}
export function registrySummary(){
 const capabilitySupport=CACHE.capabilityOntology.reduce((a,x)=>(a[x.support]=(a[x.support]||0)+1,a),{});
 return {schema:'webforge.composition-registry.r2',version:'8.0.0',counts:Object.fromEntries(Object.entries(CACHE).map(([k,v])=>[k,v.length])),quality:{sectionTemplatesApproved:CACHE.sectionTemplates.filter(x=>x.trust==='approved').length,pluginsResolverApproved:CACHE.plugins.filter(x=>x.installPolicy==='resolver-approved-only').length,connectorFailClosed:CACHE.connectors.filter(x=>x.failClosed).length,domainPatterns:CACHE.domainOntology.length,rendererContracts:CACHE.rendererContracts.length,capabilitySupport},invariants:['registry-selection-is-deterministic','quality-score-is-not-production-evidence','external-connectors-require-authority','missing-capability-never-equals-pass','novel-domain-is-decomposed-before-template-selection','every-registry-template-requires-a-renderer-contract','project-local-components-require-human-design-review']};
}
export function compositionRegistry(){return structuredClone(CACHE);}
