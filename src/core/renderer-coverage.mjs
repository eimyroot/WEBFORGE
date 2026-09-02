import { registry } from './composition-registry.mjs';

export function rendererCoverage(){
  const templates=registry('sectionTemplates');
  const contracts=registry('rendererContracts');
  const byId=new Map(contracts.map(x=>[x.id,x]));
  const records=templates.map(t=>{
    const c=byId.get(t.rendererKey);
    const backed=Boolean(c&&c.supportedModes?.includes(t.layoutMode));
    return {template:t.id,rendererKey:t.rendererKey,layoutMode:t.layoutMode,backed,responsive:Boolean(c?.responsive),a11yContract:Boolean(c?.a11yContract),trust:c?.trust||'MISSING'};
  });
  const count=k=>records.filter(x=>x[k]).length;
  return {
    schema:'webforge.renderer-coverage.r2',
    registered:records.length,
    rendererBacked:count('backed'),
    responsiveContract:count('responsive'),
    a11yContract:count('a11yContract'),
    missing:records.filter(x=>!x.backed),
    contracts:contracts.length,
    productionInvariant:'renderer contract coverage is necessary but not equivalent to browser or production verification'
  };
}
