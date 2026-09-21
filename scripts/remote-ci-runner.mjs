import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const env=process.env;
const repository='eimyroot/WEBFORGE';
const repositoryUrl='https://github.com/eimyroot/WEBFORGE.git';
const branch=(env.WEBFORGE_CI_REMOTE_BRANCH||'').trim();
const expectedSha=(env.WEBFORGE_CI_EXPECTED_SHA||'').trim().toLowerCase();
const provider=(env.WEBFORGE_CI_PROVIDER||'independent').trim();
const evidenceRoot=env.WEBFORGE_CI_EVIDENCE_ROOT||'/evidence/webforge';
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const text=result=>`${result.stdout||''}${result.stderr||''}`;
const run=(cmd,args,opts={})=>spawnSync(cmd,args,{cwd:opts.cwd,encoding:'utf8',env:opts.env||env,maxBuffer:64*1024*1024});
const fail=message=>{throw new Error(message)};

if(!branch) fail('WEBFORGE_CI_REMOTE_BRANCH is required');
if(!/^[0-9a-f]{40}$/.test(expectedSha)) fail('WEBFORGE_CI_EXPECTED_SHA must be an exact 40-character SHA');
const forbidden=Object.keys(env).filter(name=>name==='GH_TOKEN'||name==='GITHUB_TOKEN'||name==='GITHUB_PAT'||name.startsWith('VERCEL_'));
if(forbidden.length) fail(`forbidden runner credentials present: ${forbidden.sort().join(',')}`);
if(!env.WEBFORGE_GITHUB_APP_PRIVATE_KEY&&!env.WEBFORGE_GITHUB_APP_PRIVATE_KEY_FILE) fail('GitHub App credential is required');

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const runDir=path.join(evidenceRoot,`${stamp}-${expectedSha.slice(0,12)}`);
const checkout=path.join(runDir,'checkout');
const ciEvidence=path.join(runDir,'ci');
fs.mkdirSync(runDir,{recursive:true});

let result=run('git',['clone','--filter=blob:none','--no-checkout',repositoryUrl,checkout]);
if(result.status!==0) fail(`git clone failed\n${text(result).slice(-4000)}`);
result=run('git',['fetch','--depth=1','origin',`refs/heads/${branch}`],{cwd:checkout});
if(result.status!==0) fail(`git fetch failed\n${text(result).slice(-4000)}`);
result=run('git',['checkout','-B',branch,'FETCH_HEAD'],{cwd:checkout});
if(result.status!==0) fail(`git checkout failed\n${text(result).slice(-4000)}`);
const actualSha=String(run('git',['rev-parse','HEAD'],{cwd:checkout}).stdout||'').trim().toLowerCase();
if(actualSha!==expectedSha) fail(`checked out SHA ${actualSha} != expected ${expectedSha}`);
const remoteLine=String(run('git',['ls-remote','origin',`refs/heads/${branch}`],{cwd:checkout}).stdout||'').trim();
const remoteSha=remoteLine.split(/\s+/)[0]?.toLowerCase();
if(remoteSha!==expectedSha) fail(`remote branch SHA ${remoteSha||'missing'} != expected ${expectedSha}`);

const childEnv={...env,WEBFORGE_PUBLISH_STATUS:'1',WEBFORGE_CI_REMOTE_BRANCH:branch,WEBFORGE_CI_EVIDENCE_ROOT:ciEvidence};
result=run('npm',['run','ci:local'],{cwd:checkout,env:childEnv});
fs.writeFileSync(path.join(runDir,'ci-runner.log'),text(result));
const receiptDirs=fs.existsSync(ciEvidence)?fs.readdirSync(ciEvidence).filter(name=>name.endsWith(`-${expectedSha.slice(0,12)}`)).sort():[];
const receiptPath=receiptDirs.length?path.join(ciEvidence,receiptDirs.at(-1),'local-ci.receipt.json'):null;
if(!receiptPath||!fs.existsSync(receiptPath)) fail('local CI receipt was not produced');
const localReceiptBytes=fs.readFileSync(receiptPath);
const localReceipt=JSON.parse(localReceiptBytes.toString('utf8'));
const remoteReceipt={
  schema:'webforge.independent-runner-receipt.v1',recordedAt:new Date().toISOString(),repository,provider,
  runner:{hostname:os.hostname(),platform:process.platform,arch:process.arch,node:process.version},
  branch,expectedSha,actualSha,remoteSha,forbiddenCredentialNames:forbidden,
  localCi:{status:localReceipt.status,receiptSha256:sha256(localReceiptBytes),remoteStatus:localReceipt.remoteStatus||null},
  productionCredentialsPresent:false,productionChanged:false
};
fs.writeFileSync(path.join(runDir,'independent-runner.receipt.json'),JSON.stringify(remoteReceipt,null,2)+'\n');
const remoteReceiptSha=sha256(fs.readFileSync(path.join(runDir,'independent-runner.receipt.json')));
fs.writeFileSync(path.join(runDir,'independent-runner.receipt.sha256'),`${remoteReceiptSha}  independent-runner.receipt.json\n`);
if(result.status!==0||localReceipt.status!=='PASS'||localReceipt.remoteStatus?.publisher!=='github-app') fail('independent CI gate did not complete with GitHub App PASS');
console.log(JSON.stringify({status:'PASS',repository,provider,branch,sourceSha:actualSha,runDir,receiptSha256:remoteReceiptSha,creator:localReceipt.remoteStatus.creator},null,2));
