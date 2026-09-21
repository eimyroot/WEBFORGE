import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const ledgerDir=path.join(repoRoot,'config','promotion-ledger');
const SHA40=/^[0-9a-f]{40}$/;
const SHA256=/^[0-9a-f]{64}$/;

export function validatePromotionRecord(record,file='record'){
  const errors=[];
  const need=(ok,message)=>{if(!ok) errors.push(`${file}: ${message}`);};
  need(record?.schema==='webforge.promotion-record.v1','schema');
  need(record?.recordVersion===1,'recordVersion');
  need(typeof record?.recordId==='string'&&record.recordId.length>10,'recordId');
  need(SHA40.test(record?.sourceSha||''),'sourceSha');
  need(record?.repository==='eimyroot/WEBFORGE','repository');
  need(record?.branch==='main','branch');
  need(record?.target?.provider==='vercel','target.provider');
  need(/^team_/.test(record?.target?.teamId||''),'target.teamId');
  need(/^prj_/.test(record?.target?.projectId||''),'target.projectId');
  need(/^dpl_/.test(record?.deployment?.id||''),'deployment.id');
  need(record?.rollback?.preserved===true,'rollback.preserved');
  need(SHA256.test(record?.evidence?.externalReceiptSha256||''),'evidence.externalReceiptSha256');
  if(record?.gates?.ci?.status==='BYPASSED_EXCEPTION'){
    need(record.gates.ci.scopeSourceSha===record.sourceSha,'CI exception must be scoped to sourceSha');
    need(typeof record.gates.ci.reason==='string'&&record.gates.ci.reason.length>20,'CI exception reason');
  }
  return errors;
}

function git(args){
  return spawnSync('git',['-C',repoRoot,...args],{encoding:'utf8'});
}

export function verifyAppendOnly(baseSha=process.env.WEBFORGE_LEDGER_BASE_SHA||''){
  const errors=[];
  if(!baseSha||/^0+$/.test(baseSha)) return errors;
  if(!SHA40.test(baseSha)) return [`invalid WEBFORGE_LEDGER_BASE_SHA: ${baseSha}`];
  const exists=git(['cat-file','-e',`${baseSha}^{commit}`]);
  if(exists.status!==0) return [`base commit unavailable: ${baseSha}`];
  const diff=git(['diff','--name-status',baseSha,'HEAD','--','config/promotion-ledger']);
  if(diff.status!==0) return ['unable to diff promotion ledger'];
  for(const line of String(diff.stdout||'').trim().split(/\r?\n/).filter(Boolean)){
    const [status,...names]=line.split('\t');
    const jsonNames=names.filter(name=>name.endsWith('.json'));
    if(!jsonNames.length) continue;
    if(status!=='A') errors.push(`append-only violation: ${line}`);
  }
  return errors;
}

export function verifyLedger({baseSha=process.env.WEBFORGE_LEDGER_BASE_SHA||''}={}){
  const errors=[];
  const records=[];
  const ids=new Set();
  for(const name of fs.readdirSync(ledgerDir).filter(x=>x.endsWith('.json')).sort()){
    const file=path.join(ledgerDir,name);
    let record;
    try{record=JSON.parse(fs.readFileSync(file,'utf8'));}
    catch(error){errors.push(`${name}: invalid JSON: ${error.message}`);continue;}
    errors.push(...validatePromotionRecord(record,name));
    if(ids.has(record.recordId)) errors.push(`${name}: duplicate recordId`);
    ids.add(record.recordId);
    records.push({name,record});
  }
  errors.push(...verifyAppendOnly(baseSha));
  return {status:errors.length?'FAIL':'PASS',recordCount:records.length,errors,records};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const out=verifyLedger();
  console.log(JSON.stringify({status:out.status,recordCount:out.recordCount,errors:out.errors},null,2));
  if(out.status!=='PASS') process.exitCode=1;
}
