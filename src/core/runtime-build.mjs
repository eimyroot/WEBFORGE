import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tail=(s='')=>String(s).slice(-5000);

export function verifyRuntimeBuild(runtimeRoot,{allowNetwork=process.env.WEBFORGE_ALLOW_NETWORK==='1'}={}){
  const pkgPath=path.join(runtimeRoot,'package.json');
  if(!fs.existsSync(pkgPath)) return {schema:'webforge.runtime-build.v2',status:'FAIL',checks:[{id:'package-json',status:'FAIL'}]};
  const checks=[{id:'package-json',status:'PASS'}];
  const lockPath=path.join(runtimeRoot,'package-lock.json');
  const nodeModules=path.join(runtimeRoot,'node_modules');

  if(!fs.existsSync(nodeModules)){
    if(!allowNetwork){
      checks.push({id:'dependency-install',status:'UNVERIFIED',detail:'node_modules absent; set WEBFORGE_ALLOW_NETWORK=1 to authorize npm install'});
      checks.push({id:'framework-build',status:'UNVERIFIED',detail:'dependency install not authorized'});
      return {schema:'webforge.runtime-build.v2',status:'UNVERIFIED',checks};
    }
    const install=spawnSync('npm',['install','--ignore-scripts','--no-audit','--no-fund'],{cwd:runtimeRoot,encoding:'utf8',timeout:180000});
    checks.push({id:'dependency-install',status:install.status===0?'PASS':'FAIL',detail:tail(install.stdout||install.stderr)});
    if(install.status!==0) return {schema:'webforge.runtime-build.v2',status:'FAIL',checks};
  } else checks.push({id:'dependency-install',status:'PASS',detail:'existing node_modules'});

  checks.push({id:'lockfile',status:fs.existsSync(lockPath)?'PASS':'UNVERIFIED',detail:fs.existsSync(lockPath)?'package-lock.json present':'npm install may not have produced lockfile'});
  const build=spawnSync('npm',['run','build'],{cwd:runtimeRoot,encoding:'utf8',timeout:180000});
  checks.push({id:'framework-build',status:build.status===0?'PASS':'FAIL',detail:tail(build.stdout||build.stderr)});
  const status=checks.some(x=>x.status==='FAIL')?'FAIL':checks.some(x=>x.status==='UNVERIFIED')?'UNVERIFIED':'PASS';
  return {schema:'webforge.runtime-build.v2',status,checks};
}
