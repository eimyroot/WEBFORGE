import fs from 'node:fs';
import path from 'node:path';

export const TRUSTED_PACKAGE_CATALOG = Object.freeze({
  astro:{version:'7.2.0',source:'astro.build release 2026-08-06',policy:'supported-stable'},
  next:{version:'16.3.3',source:'nextjs.org security release 2026-08-25',policy:'active-lts-security-patched'},
  vite:{version:'8.2.2',source:'vite.dev release 2026-06-23',policy:'supported-stable'},
  '@vitejs/plugin-react':{version:'6.1.1',source:'npm package current 2026-08-30',policy:'stable'},
  react:{version:'19.2.7',source:'react.dev versions',policy:'latest-stable-patch'},
  'react-dom':{version:'19.2.7',source:'react.dev versions',policy:'match-react'}
});

const allowedByRuntime={
  astro:['astro'],
  next:['next','react','react-dom'],
  'vite-react':['vite','@vitejs/plugin-react','react','react-dom']
};

export function resolvePackages(runtime){
  const names=allowedByRuntime[runtime];
  if(!names) throw new Error(`No package policy for runtime: ${runtime}`);
  const packages=Object.fromEntries(names.map(name=>[name,TRUSTED_PACKAGE_CATALOG[name].version]));
  return {
    schema:'webforge.package-resolution.v2',
    runtime,
    resolutionMode:'trusted-catalog-exact',
    packages,
    provenance:names.map(name=>({name,...TRUSTED_PACKAGE_CATALOG[name]})),
    checks:[
      {id:'known-runtime',status:'PASS'},
      {id:'exact-version-pins',status:Object.values(packages).every(v=>/^\d+\.\d+\.\d+$/.test(v))?'PASS':'FAIL'},
      {id:'no-floating-latest',status:Object.values(packages).every(v=>v!=='latest'&&!v.startsWith('^')&&!v.startsWith('~'))?'PASS':'FAIL'},
      {id:'next-security-baseline',status:runtime!=='next'||packages.next==='16.3.3'?'PASS':'FAIL'}
    ]
  };
}

export function writePackageResolution(root,runtime){
  const receipt=resolvePackages(runtime);
  fs.writeFileSync(path.join(root,'package-resolution.json'),JSON.stringify(receipt,null,2)+'\n');
  return receipt;
}
