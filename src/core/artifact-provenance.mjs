import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { compose } from './compose.mjs';
import { forgeRuntimeProject } from './runtime-forge.mjs';
import { writeMediaAssets } from './media-assets.mjs';

export const TREE_DIGEST_ALGORITHM='webforge.sha256-tree.v1';
export const SOURCE_ARTIFACT_SCHEMA='webforge.source-artifact.v1';
export const BUILD_ARTIFACT_SCHEMA='webforge.build-artifact.v1';
export const CANONICAL_PRODUCT_KEY='webforge-reference';

const SOURCE_EXCLUDES=['package-lock.json','node_modules','.vercel'];
const sha256Bytes=value=>crypto.createHash('sha256').update(value).digest('hex');
const safeRunId=value=>String(value||'run').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-|-$/g,'')||'run';
const tail=value=>String(value||'').slice(-6000).replace(/vcp_[A-Za-z0-9_-]+/g,'[REDACTED]').replace(/Bearer\s+[A-Za-z0-9._-]+/gi,'Bearer [REDACTED]');
const jsonFile=(root,rel)=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const fileDigest=file=>sha256Bytes(fs.readFileSync(file));
const firstLine=value=>String(value||'').trim().split(/\r?\n/).find(Boolean)||'';
const versionFromVercel=value=>String(value||'').match(/(?:Vercel CLI\s+)?(\d+\.\d+\.\d+)/i)?.[1]||null;

export function sha256File(file){return fileDigest(file);}

export function treeDigestFromManifest(entries){
  const sorted=[...entries].map(entry=>({path:String(entry.path),size:Number(entry.size),sha256:String(entry.sha256)})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const canonical=sorted.map(entry=>JSON.stringify([entry.path,entry.size,entry.sha256])).join('\n')+'\n';
  return sha256Bytes(canonical);
}

export function createFileManifest(root,{exclude=[]}={}){
  const base=path.resolve(root);
  if(!fs.existsSync(base)||!fs.statSync(base).isDirectory()) return [];
  const excluded=[...exclude].map(x=>String(x).replaceAll('\\','/').replace(/^\.\//,''));
  const out=[];
  const walk=(dir)=>{
    const entries=fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
    for(const entry of entries){
      const abs=path.join(dir,entry.name);
      const rel=path.relative(base,abs).split(path.sep).join('/');
      if(excluded.some(x=>rel===x||rel.startsWith(`${x}/`))) continue;
      if(entry.isDirectory()){walk(abs);continue;}
      if(entry.isSymbolicLink()) throw new Error(`Symlink unsupported in canonical artifact manifest: ${rel}`);
      if(!entry.isFile()) throw new Error(`Non-file artifact entry unsupported: ${rel}`);
      const bytes=fs.readFileSync(abs);
      out.push({path:rel,size:bytes.byteLength,sha256:sha256Bytes(bytes)});
    }
  };
  walk(base);
  return out.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}

export function createTreeReceipt(root,options={}){
  const files=createFileManifest(root,options);
  return {algorithm:TREE_DIGEST_ALGORITHM,files,treeDigest:treeDigestFromManifest(files)};
}

export function loadCanonicalArtifactContracts(repoRoot,{productKey=CANONICAL_PRODUCT_KEY}={}){
  return {
    productSpec:jsonFile(repoRoot,`config/products/${productKey}.json`),
    binding:jsonFile(repoRoot,`config/product-target-bindings/${productKey}.json`),
    hostingTarget:jsonFile(repoRoot,'config/production-target.json'),
    toolchain:jsonFile(repoRoot,`config/artifact-toolchains/${productKey}.json`)
  };
}

export function validateCanonicalProductContracts({productSpec,binding,hostingTarget,toolchain,expectedProductKey=CANONICAL_PRODUCT_KEY}={}){
  const blockers=[];
  const inputValue=productSpec?.canonicalInput?.value;
  const inputDigest=typeof inputValue==='string'?sha256Bytes(Buffer.from(inputValue,productSpec?.canonicalInput?.encoding==='utf-8'?'utf8':'utf8')):null;
  if(productSpec?.schema!=='webforge.product-spec.v1') blockers.push('product-spec-schema');
  if(productSpec?.status!=='CANONICAL') blockers.push('product-spec-status');
  if(productSpec?.productKey!==expectedProductKey) blockers.push('product-key-mismatch');
  if(!Number.isInteger(productSpec?.specVersion)) blockers.push('product-spec-version');
  if(typeof inputValue!=='string'||!inputValue) blockers.push('canonical-input-missing');
  if(!productSpec?.canonicalInput?.sha256) blockers.push('canonical-input-digest-missing');
  else if(inputDigest!==productSpec.canonicalInput.sha256) blockers.push('canonical-input-digest-mismatch');
  if(productSpec?.identityConstraints?.generationRunIdIsProductIdentity!==false) blockers.push('generation-run-id-identity');
  if(productSpec?.authority?.deploymentAuthorized!==false) blockers.push('product-deployment-authority');

  if(binding?.schema!=='webforge.product-target-binding.v1') blockers.push('product-binding-schema');
  if(binding?.status!=='CANONICAL') blockers.push('product-binding-status');
  if(binding?.productKey!==expectedProductKey) blockers.push('product-binding-key');
  if(binding?.productPurpose!==productSpec?.productPurpose) blockers.push('product-purpose-mismatch');
  if(binding?.artifactClass!=='generated-web-product') blockers.push('artifact-class');
  if(binding?.target?.targetPurpose!=='reference-demo'||binding?.target?.permanentReferenceSlot!==true) blockers.push('reference-target-semantics');
  if(binding?.constraints?.deploymentAuthorized!==false) blockers.push('binding-deployment-authority');

  if(hostingTarget?.schema!=='webforge.production-target.v1'||hostingTarget?.status!=='CANONICAL'||hostingTarget?.scope!=='production-hosting-target-identity') blockers.push('hosting-target-contract');
  if(hostingTarget?.provider!==binding?.target?.provider) blockers.push('hosting-provider-mismatch');
  if(hostingTarget?.target?.teamId!==binding?.target?.teamId) blockers.push('hosting-team-mismatch');
  if(hostingTarget?.target?.projectId!==binding?.target?.projectId) blockers.push('hosting-project-mismatch');
  if(hostingTarget?.authority?.constraints?.deploymentAuthorized!==false) blockers.push('hosting-deployment-authority');

  if(toolchain?.schema!=='webforge.artifact-toolchain.v1'||toolchain?.status!=='CANONICAL'||toolchain?.productKey!==expectedProductKey) blockers.push('toolchain-contract');
  if(!/^\d+\.\d+\.\d+$/.test(toolchain?.nodeVersion||'')) blockers.push('node-version-pin');
  if(!/^\d+\.\d+\.\d+$/.test(toolchain?.npmVersion||'')) blockers.push('npm-version-pin');
  if(!/^\d+\.\d+\.\d+$/.test(toolchain?.vercelCliVersion||'')) blockers.push('vercel-version-pin');
  if(toolchain?.vercelBuild?.deploymentAuthorized!==false) blockers.push('toolchain-deployment-authority');

  return {status:blockers.length?'BLOCKED':'PASS',eligible:blockers.length===0,blockers,canonicalInputDigest:inputDigest};
}

export function readRepositoryState(repoRoot,{spawn=spawnSync}={}){
  const head=spawn('git',['-C',repoRoot,'rev-parse','HEAD'],{encoding:'utf8'});
  const status=spawn('git',['-C',repoRoot,'status','--porcelain'],{encoding:'utf8'});
  return {sha:head.status===0?firstLine(head.stdout):null,clean:status.status===0&&String(status.stdout||'').trim()==='',verified:head.status===0&&status.status===0};
}

export function detectToolchainVersions({spawn=spawnSync}={}){
  const npm=spawn('npm',['--version'],{encoding:'utf8'});
  const vercel=spawn('vercel',['--version'],{encoding:'utf8'});
  return {
    nodeVersion:process.version.replace(/^v/,''),
    npmVersion:npm.status===0?firstLine(npm.stdout):null,
    vercelCliVersion:vercel.status===0?versionFromVercel(`${vercel.stdout||''}\n${vercel.stderr||''}`):null
  };
}

export function validateToolchainVersions(actual,expected){
  const blockers=[];
  if(actual?.nodeVersion!==expected?.nodeVersion) blockers.push('node-version-mismatch');
  if(actual?.npmVersion!==expected?.npmVersion) blockers.push('npm-version-mismatch');
  if(actual?.vercelCliVersion!==expected?.vercelCliVersion) blockers.push('vercel-cli-version-mismatch');
  return {status:blockers.length?'BLOCKED':'PASS',eligible:blockers.length===0,blockers};
}

function stableMediaSeed(productSpec){
  return sha256Bytes(Buffer.from(['webforge.canonical-media.v1',productSpec.productKey,String(productSpec.specVersion),productSpec.canonicalInput.sha256].join('\n'),'utf8'));
}

function writeCanonicalVercelConfig(runtimeRoot){
  const body={installCommand:'npm ci --ignore-scripts --no-audit --no-fund',buildCommand:'npm run build'};
  fs.writeFileSync(path.join(runtimeRoot,'vercel.json'),JSON.stringify(body,null,2)+'\n');
}

function ensureFreshOutputRoot(outputRoot){
  if(fs.existsSync(outputRoot)&&fs.readdirSync(outputRoot).length) return false;
  fs.mkdirSync(outputRoot,{recursive:true});
  return true;
}

export function generateCanonicalRuntimeSource({outputRoot,productSpec,binding,hostingTarget,toolchain,generationRunId='run',expectedProductKey=CANONICAL_PRODUCT_KEY}={}){
  const validation=validateCanonicalProductContracts({productSpec,binding,hostingTarget,toolchain,expectedProductKey});
  if(!validation.eligible) return {...validation,generationRunId:safeRunId(generationRunId)};
  if(!ensureFreshOutputRoot(outputRoot)) return {status:'BLOCKED',eligible:false,blockers:['output-root-not-empty'],generationRunId:safeRunId(generationRunId)};
  const plan=compose(productSpec.canonicalInput.value);
  if(!plan.releaseEligible||plan.policy?.status!=='PASS') return {status:'BLOCKED',eligible:false,blockers:['generation-policy-gate'],generationRunId:safeRunId(generationRunId)};
  const mediaSeed=stableMediaSeed(productSpec);
  const mediaAssets=writeMediaAssets(outputRoot,plan.visual,mediaSeed);
  for(const slot of plan.visual.media.slots) slot.src=mediaAssets[slot.id]||null;
  for(const section of plan.visual.sections) for(const slot of section.media||[]) slot.src=mediaAssets[slot.id]||null;
  const runtimeForge=forgeRuntimeProject(outputRoot,plan);
  const runtimeRoot=path.join(outputRoot,'runtime');
  writeCanonicalVercelConfig(runtimeRoot);
  const source=createTreeReceipt(runtimeRoot,{exclude:SOURCE_EXCLUDES});
  const dependencyResolutionDigest=fileDigest(path.join(runtimeRoot,'package-resolution.json'));
  return {
    status:'PASS',eligible:true,blockers:[],generationRunId:safeRunId(generationRunId),runtimeRoot,runtime:runtimeForge.runtime,
    sourceManifest:source.files,runtimeSourceTreeDigest:source.treeDigest,treeDigestAlgorithm:source.algorithm,dependencyResolutionDigest,mediaSeed,plan
  };
}

export function validateProductionBuildInputs(runtimeRoot){
  const blockers=[];
  if(!fs.existsSync(path.join(runtimeRoot,'package.json'))) blockers.push('package-json-missing');
  if(!fs.existsSync(path.join(runtimeRoot,'package-lock.json'))) blockers.push('lockfile-missing');
  return {status:blockers.length?'BLOCKED':'PASS',eligible:blockers.length===0,blockers};
}

export function resolveCanonicalLockfile(runtimeRoot,{allowNetwork=false,spawn=spawnSync}={}){
  const lockPath=path.join(runtimeRoot,'package-lock.json');
  let resolution='existing-lockfile';
  let resolutionCommand=null;
  if(!fs.existsSync(lockPath)){
    if(!allowNetwork) return {status:'BLOCKED',blockers:['dependency-resolution-network-not-authorized'],lockfileDigest:null};
    resolutionCommand=['npm','install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'];
    const r=spawn(resolutionCommand[0],resolutionCommand.slice(1),{cwd:runtimeRoot,encoding:'utf8',timeout:180000});
    if(r.status!==0) return {status:'FAIL',blockers:['lockfile-resolution-failed'],detail:tail(`${r.stdout||''}\n${r.stderr||''}`),lockfileDigest:null,resolutionCommand};
    resolution='resolved-from-registry';
  }
  if(!fs.existsSync(lockPath)) return {status:'UNVERIFIED',blockers:['lockfile-not-created'],lockfileDigest:null,resolutionCommand};
  const lockfileDigest=fileDigest(lockPath);
  const inputValidation=validateProductionBuildInputs(runtimeRoot);
  if(!inputValidation.eligible) return {...inputValidation,lockfileDigest,resolution,resolutionCommand};
  const installCommand=['npm','ci','--ignore-scripts','--no-audit','--no-fund'];
  const install=spawn(installCommand[0],installCommand.slice(1),{cwd:runtimeRoot,encoding:'utf8',timeout:180000});
  if(install.status!==0) return {status:'FAIL',blockers:['locked-install-failed'],detail:tail(`${install.stdout||''}\n${install.stderr||''}`),lockfileDigest,resolution,resolutionCommand,installCommand};
  return {status:'PASS',blockers:[],lockfileDigest,resolution,resolutionCommand,installCommand,externalMutableStateCaptured:resolution==='resolved-from-registry'};
}

export function canonicalVercelBuildInvocation({teamId,projectId}={}){
  if(!teamId||!projectId) throw new Error('canonical teamId and projectId are required');
  return {command:'vercel',args:['build','--prod'],env:{VERCEL_ORG_ID:teamId,VERCEL_PROJECT_ID:projectId}};
}

export function buildReceiptResult({base={},commandStatus,outputManifest=null,detail=null}={}){
  const outputTreeDigest=Array.isArray(outputManifest)&&outputManifest.length?treeDigestFromManifest(outputManifest):null;
  if(commandStatus!==0) return {...base,status:'FAIL',outputManifest:outputManifest||[],outputTreeDigest,detail};
  if(!outputTreeDigest) return {...base,status:'UNVERIFIED',outputManifest:outputManifest||[],outputTreeDigest:null,detail:'Vercel build exited 0 but no immutable output digest was produced.'};
  return {...base,status:'PASS',outputManifest,outputTreeDigest,detail};
}

function authBootstrapFailure(detail){return /(not authenticated|authentication|credentials|login|token|unauthorized|forbidden|project settings|not linked|link this directory|link to a project)/i.test(String(detail||''));}

export function buildVercelPrebuiltArtifact({runtimeRoot,binding,sourceReceipt,toolchain,spawn=spawnSync,env=process.env}={}){
  const inputValidation=validateProductionBuildInputs(runtimeRoot);
  const base={
    schema:BUILD_ARTIFACT_SCHEMA,version:1,repository:sourceReceipt.repository,sourceSha:sourceReceipt.sourceSha,productKey:sourceReceipt.productKey,
    artifactClass:sourceReceipt.artifactClass,runtime:sourceReceipt.runtime,runtimeSourceTreeDigest:sourceReceipt.runtimeSourceTreeDigest,
    lockfileDigest:sourceReceipt.lockfileDigest,nodeVersion:sourceReceipt.toolchainVersions.nodeVersion,npmVersion:sourceReceipt.toolchainVersions.npmVersion,
    vercelCliVersion:sourceReceipt.toolchainVersions.vercelCliVersion,buildCommand:'vercel build --prod',buildMode:'production-prebuilt',outputRoot:'.vercel/output',
    target:{provider:binding.target.provider,teamId:binding.target.teamId,projectId:binding.target.projectId},productionDeploymentAuthorized:false
  };
  if(!inputValidation.eligible) return {...base,status:'BLOCKED',blockers:inputValidation.blockers,outputManifest:[],outputTreeDigest:null};
  const actual=detectToolchainVersions({spawn});
  const versionCheck=validateToolchainVersions(actual,toolchain);
  if(!versionCheck.eligible) return {...base,status:'BLOCKED',blockers:versionCheck.blockers,actualToolchain:actual,outputManifest:[],outputTreeDigest:null};
  const projectDir=path.join(runtimeRoot,'.vercel');
  fs.mkdirSync(projectDir,{recursive:true});
  fs.writeFileSync(path.join(projectDir,'project.json'),JSON.stringify({orgId:binding.target.teamId,projectId:binding.target.projectId},null,2)+'\n');
  const invocation=canonicalVercelBuildInvocation({teamId:binding.target.teamId,projectId:binding.target.projectId});
  const r=spawn(invocation.command,invocation.args,{cwd:runtimeRoot,encoding:'utf8',timeout:300000,env:{...env,...invocation.env}});
  const detail=tail(`${r.stdout||''}\n${r.stderr||''}`);
  const outputRoot=path.join(runtimeRoot,'.vercel','output');
  if(r.status!==0&&authBootstrapFailure(detail)) return {...base,status:'BLOCKED',blockers:['vercel-auth-bootstrap-required'],auth:{vercelTokenPresent:Boolean(env.VERCEL_TOKEN),secretValueRecorded:false},outputManifest:[],outputTreeDigest:null,detail};
  if(r.status!==0) return {...base,status:'FAIL',blockers:['vercel-build-failed'],outputManifest:[],outputTreeDigest:null,detail};
  const outputManifest=createFileManifest(outputRoot);
  return buildReceiptResult({base:{...base,auth:{vercelTokenPresent:Boolean(env.VERCEL_TOKEN),secretValueRecorded:false}},commandStatus:r.status,outputManifest,detail});
}

export function makeSourceArtifactReceipt({repository,sourceSha,productSpec,binding,hostingTarget,toolchain,toolchainVersions,generation,lockfileDigest,contractDigests={}}={}){
  return {
    schema:SOURCE_ARTIFACT_SCHEMA,version:1,repository,sourceSha,productKey:productSpec.productKey,productSpecVersion:productSpec.specVersion,
    canonicalInputDigest:productSpec.canonicalInput.sha256,artifactClass:binding.artifactClass,runtime:generation.runtime,generationRunId:generation.generationRunId,
    generationRunIdIsIdentity:false,treeDigestAlgorithm:generation.treeDigestAlgorithm,sourceFileManifest:generation.sourceManifest,
    runtimeSourceTreeDigest:generation.runtimeSourceTreeDigest,dependencyResolutionDigest:generation.dependencyResolutionDigest,lockfileDigest,
    toolchainVersions,contractDigests,target:{provider:hostingTarget.provider,teamId:hostingTarget.target.teamId,projectId:hostingTarget.target.projectId},
    identity:{repository,sourceSha,productKey:productSpec.productKey,productSpecVersion:productSpec.specVersion,canonicalInputDigest:productSpec.canonicalInput.sha256,artifactClass:binding.artifactClass,runtime:generation.runtime,runtimeSourceTreeDigest:generation.runtimeSourceTreeDigest,lockfileDigest}
  };
}

export function sourceArtifactIdentityDigest(receipt){return sha256Bytes(Buffer.from(JSON.stringify(receipt.identity),'utf8'));}

export function validatePredeployOutputDigest({runtimeRoot,buildReceipt}={}){
  const blockers=[];
  if(buildReceipt?.schema!==BUILD_ARTIFACT_SCHEMA) blockers.push('build-receipt-schema');
  if(buildReceipt?.status!=='PASS') blockers.push('build-receipt-not-pass');
  if(!buildReceipt?.outputTreeDigest) blockers.push('approved-output-digest-missing');
  const outputRoot=path.join(runtimeRoot,'.vercel','output');
  if(!fs.existsSync(outputRoot)||!fs.statSync(outputRoot).isDirectory()) blockers.push('prebuilt-output-missing');
  let actualPredeployOutputTreeDigest=null;
  if(!blockers.includes('prebuilt-output-missing')) actualPredeployOutputTreeDigest=createTreeReceipt(outputRoot).treeDigest;
  if(buildReceipt?.outputTreeDigest&&actualPredeployOutputTreeDigest&&buildReceipt.outputTreeDigest!==actualPredeployOutputTreeDigest) blockers.push('predeploy-output-digest-mismatch');
  return {status:blockers.length?'BLOCKED':'ELIGIBLE',eligible:blockers.length===0,blockers,approvedBuildReceiptOutputTreeDigest:buildReceipt?.outputTreeDigest||null,actualPredeployOutputTreeDigest};
}

export function contractFileDigests(repoRoot,{productKey=CANONICAL_PRODUCT_KEY}={}){
  const files={
    productSpec:`config/products/${productKey}.json`,
    productBinding:`config/product-target-bindings/${productKey}.json`,
    hostingTarget:'config/production-target.json',
    toolchain:`config/artifact-toolchains/${productKey}.json`
  };
  return Object.fromEntries(Object.entries(files).map(([key,rel])=>[key,{path:rel,sha256:fileDigest(path.join(repoRoot,rel))}]));
}

export function canonicalOutputRoot(repoRoot,generationRunId){return path.join(repoRoot,'generated','canonical',CANONICAL_PRODUCT_KEY,safeRunId(generationRunId));}
