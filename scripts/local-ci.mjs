import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInstallationToken, publishCommitStatus } from '../src/core/github-app-status.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(cmd,args,opts={})=>spawnSync(cmd,args,{cwd:opts.cwd||repo,encoding:'utf8',env:{...process.env,...opts.env},maxBuffer:32*1024*1024});
const text=result=>`${result.stdout||''}${result.stderr||''}`;
const required=(result,label)=>{if(result.status!==0) throw new Error(`${label} failed\n${text(result).slice(-4000)}`);return String(result.stdout||'').trim();};
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const now=new Date().toISOString();

const root=required(run('git',['rev-parse','--show-toplevel']),'git root');
if(path.resolve(root)!==repo) throw new Error(`unexpected git root: ${root}`);
const branch=required(run('git',['branch','--show-current']),'branch');
const sourceSha=required(run('git',['rev-parse','HEAD']),'HEAD');
const trackedDirty=required(run('git',['status','--porcelain','--untracked-files=no']),'tracked status');
const expectedRemoteBranch=(process.env.WEBFORGE_CI_REMOTE_BRANCH||'main').trim();
const refCheck=run('git',['check-ref-format','--branch',expectedRemoteBranch]);
if(refCheck.status!==0) throw new Error(`invalid WEBFORGE_CI_REMOTE_BRANCH: ${expectedRemoteBranch}`);
if(branch!==expectedRemoteBranch) throw new Error(`local CI branch ${branch} != expected remote branch ${expectedRemoteBranch}`);
if(trackedDirty) throw new Error('tracked worktree must be clean before local CI');

const remoteRef=`refs/heads/${expectedRemoteBranch}`;
const remote=run('git',['ls-remote','origin',remoteRef]);
const remoteLine=required(remote,`origin/${expectedRemoteBranch}`);
if(!remoteLine) throw new Error(`origin/${expectedRemoteBranch} does not exist`);
const remoteSha=remoteLine.split(/\s+/)[0];
if(remoteSha!==sourceSha) throw new Error(`origin/${expectedRemoteBranch} ${remoteSha} != HEAD ${sourceSha}`);
const evidenceBase=process.env.WEBFORGE_CI_EVIDENCE_ROOT||'/Users/eimyna/0_EVIDENCE/WEBFORGE/local-ci';
const stamp=now.replace(/[:.]/g,'-');
const evidenceDir=path.join(evidenceBase,`${stamp}-${sourceSha.slice(0,12)}`);
const workspace=path.join(evidenceDir,'workspace');
fs.mkdirSync(workspace,{recursive:true});

const tarPath=path.join(evidenceDir,'source.tar');
const archive=run('git',['archive','--format=tar',`--output=${tarPath}`,'HEAD']);
if(archive.status!==0) throw new Error(`git archive failed: ${text(archive)}`);
const extract=run('tar',['-xf',tarPath,'-C',workspace]);
if(extract.status!==0) throw new Error(`archive extract failed: ${text(extract)}`);

const checks=[
  ['test',['test']],
  ['verify',['run','verify']],
  ['provenance',['run','provenance:verify']],
  ['build',['run','build']],
  ['audit',['run','audit']],
  ['renderer-coverage',['run','renderer:coverage']],
  ['release-gate',['run','release:gate']],
  ['release-full',['run','release:full']]
];
const results=[];
for(const [id,args] of checks){
  const result=run('npm',args,{cwd:workspace});
  const output=text(result);
  fs.writeFileSync(path.join(evidenceDir,`${id}.log`),output);
  results.push({id,status:result.status===0?'PASS':'FAIL',exitCode:result.status,logSha256:sha256(output)});
  if(result.status!==0) break;
}
const status=results.length===checks.length&&results.every(x=>x.status==='PASS')?'PASS':'FAIL';
const receipt={
  schema:'webforge.local-ci-receipt.v1',
  recordedAt:now,
  repository:'eimyroot/WEBFORGE',
  branch,
  sourceSha,
  remoteBranch:expectedRemoteBranch,
  remoteBranchSha:remoteSha,
  remoteMainSha:expectedRemoteBranch==='main'?remoteSha:null,
  runner:{hostname:os.hostname(),platform:process.platform,arch:process.arch,node:process.version,npm:required(run('npm',['--version']),'npm version')},
  sourceArchiveSha256:sha256(fs.readFileSync(tarPath)),
  checks:results,
  status,
  productionChanged:false
};
const receiptPath=path.join(evidenceDir,'local-ci.receipt.json');

if(process.env.WEBFORGE_PUBLISH_STATUS==='1'){
  try{
    const appContract=JSON.parse(fs.readFileSync(path.join(repo,'config','ci-status-app.json'),'utf8'));
    const keyFile=process.env.WEBFORGE_GITHUB_APP_PRIVATE_KEY_FILE;
    const keyPem=process.env.WEBFORGE_GITHUB_APP_PRIVATE_KEY;
    if(appContract.status!=='CANONICAL'||appContract.repository!=='eimyroot/WEBFORGE'||appContract.context!=='webforge/local-ci') throw new Error('CI status App contract is not canonical');
    if(appContract.secretMaterialInRepository!==false) throw new Error('CI status App contract permits repository secret material');
    if(keyFile&&keyPem) throw new Error('provide GitHub App private key by file or environment, not both');
    if(!keyPem&&(!keyFile||!fs.existsSync(keyFile))) throw new Error('GitHub App private key is required outside the repository');
    const privateKey=keyPem||fs.readFileSync(keyFile,'utf8');
    const token=await createInstallationToken({appId:appContract.app.id,installationId:appContract.app.installationId,privateKey,repository:'WEBFORGE'});
    const description=status==='PASS'?'Deterministic external/local CI gate passed':'Deterministic external/local CI gate failed';
    const published=await publishCommitStatus({token,repository:appContract.repository,sha:sourceSha,state:status==='PASS'?'success':'failure',context:appContract.context,description});
    receipt.remoteStatus={status:'PASS',context:published.context,publisher:'github-app',appId:appContract.app.id,installationId:appContract.app.installationId,creator:published.creator};
  }catch(error){
    receipt.remoteStatus={status:'FAIL',publisher:'github-app',detail:String(error?.message||error).slice(-2000)};
    console.error(receipt.remoteStatus.detail);
    process.exitCode=1;
  }
}

fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
const receiptSha=sha256(fs.readFileSync(receiptPath));
fs.writeFileSync(path.join(evidenceDir,'receipt.sha256'),`${receiptSha}  local-ci.receipt.json\n`);
console.log(JSON.stringify({status,sourceSha,evidenceDir,receiptSha256:receiptSha,checks:results,remoteStatus:receipt.remoteStatus||null},null,2));
if(status!=='PASS') process.exitCode=1;
