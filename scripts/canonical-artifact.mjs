import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_PRODUCT_KEY,
  buildVercelPrebuiltArtifact,
  canonicalOutputRoot,
  contractFileDigests,
  detectToolchainVersions,
  generateCanonicalRuntimeSource,
  loadCanonicalArtifactContracts,
  makeSourceArtifactReceipt,
  readRepositoryState,
  resolveCanonicalLockfile,
  sourceArtifactIdentityDigest,
  validateCanonicalProductContracts,
  validateToolchainVersions
} from '../src/core/artifact-provenance.mjs';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repository=process.env.WEBFORGE_REPOSITORY||process.env.GITHUB_REPOSITORY||'eimyroot/WEBFORGE';
const expectedSourceSha=process.env.WEBFORGE_SOURCE_SHA||process.env.GITHUB_SHA||null;
const generationRunId=process.env.WEBFORGE_GENERATION_RUN_ID||`${process.env.GITHUB_RUN_ID||'local'}-${process.env.GITHUB_RUN_ATTEMPT||'1'}-${crypto.randomUUID()}`;
const allowNetwork=process.env.WEBFORGE_ALLOW_NETWORK==='1';
const state=readRepositoryState(repoRoot);

function fail(message,detail={}){
  console.error(JSON.stringify({status:'FAIL',message,...detail},null,2));
  process.exitCode=1;
}

if(!state.verified||!state.sha){
  fail('canonical checkout state unavailable');
} else if(expectedSourceSha&&state.sha!==expectedSourceSha){
  fail('canonical checkout SHA mismatch',{expectedSourceSha,actualSourceSha:state.sha});
} else if(!state.clean){
  fail('canonical checkout must be clean before artifact generation',{sourceSha:state.sha});
} else {
  const contracts=loadCanonicalArtifactContracts(repoRoot,{productKey:CANONICAL_PRODUCT_KEY});
  const contractValidation=validateCanonicalProductContracts({...contracts,expectedProductKey:CANONICAL_PRODUCT_KEY});
  const actualToolchain=detectToolchainVersions();
  const toolchainValidation=validateToolchainVersions(actualToolchain,contracts.toolchain);
  if(!contractValidation.eligible){
    fail('canonical product contract blocked',{blockers:contractValidation.blockers});
  } else if(!toolchainValidation.eligible){
    fail('canonical toolchain mismatch',{blockers:toolchainValidation.blockers,expected:{nodeVersion:contracts.toolchain.nodeVersion,npmVersion:contracts.toolchain.npmVersion,vercelCliVersion:contracts.toolchain.vercelCliVersion},actual:actualToolchain});
  } else {
    const outputRoot=canonicalOutputRoot(repoRoot,generationRunId);
    const generation=generateCanonicalRuntimeSource({outputRoot,...contracts,generationRunId,expectedProductKey:CANONICAL_PRODUCT_KEY});
    if(generation.status!=='PASS'){
      fail('deterministic runtime generation blocked',{blockers:generation.blockers});
    } else {
      const lock=resolveCanonicalLockfile(generation.runtimeRoot,{allowNetwork});
      if(lock.status!=='PASS'){
        const receipt={schema:'webforge.dependency-lock.v1',status:lock.status,productKey:CANONICAL_PRODUCT_KEY,sourceSha:state.sha,blockers:lock.blockers||[],lockfileDigest:lock.lockfileDigest||null,resolution:lock.resolution||null,externalMutableStateCaptured:Boolean(lock.externalMutableStateCaptured)};
        fs.writeFileSync(path.join(outputRoot,'dependency-lock.receipt.json'),JSON.stringify(receipt,null,2)+'\n');
        fail('locked dependency input unavailable',{status:lock.status,blockers:lock.blockers||[],receipt:path.relative(repoRoot,path.join(outputRoot,'dependency-lock.receipt.json'))});
      } else {
        const sourceReceipt=makeSourceArtifactReceipt({
          repository,sourceSha:state.sha,productSpec:contracts.productSpec,binding:contracts.binding,hostingTarget:contracts.hostingTarget,toolchain:contracts.toolchain,
          toolchainVersions:actualToolchain,generation,lockfileDigest:lock.lockfileDigest,contractDigests:contractFileDigests(repoRoot,{productKey:CANONICAL_PRODUCT_KEY})
        });
        sourceReceipt.dependencyLock={resolution:lock.resolution,resolutionCommand:lock.resolutionCommand,lockedInstallCommand:lock.installCommand,externalMutableStateCaptured:Boolean(lock.externalMutableStateCaptured)};
        sourceReceipt.sourceArtifactIdentityDigest=sourceArtifactIdentityDigest(sourceReceipt);
        const sourceReceiptPath=path.join(outputRoot,'source-artifact.receipt.json');
        fs.writeFileSync(sourceReceiptPath,JSON.stringify(sourceReceipt,null,2)+'\n');

        const buildReceipt=buildVercelPrebuiltArtifact({runtimeRoot:generation.runtimeRoot,binding:contracts.binding,sourceReceipt,toolchain:contracts.toolchain});
        const buildReceiptPath=path.join(outputRoot,'build-artifact.receipt.json');
        fs.writeFileSync(buildReceiptPath,JSON.stringify(buildReceipt,null,2)+'\n');

        const summary={
          schema:'webforge.canonical-artifact-run.v1',productKey:CANONICAL_PRODUCT_KEY,sourceSha:state.sha,generationRunId,
          runtimeSourceTreeDigest:sourceReceipt.runtimeSourceTreeDigest,lockfileDigest:sourceReceipt.lockfileDigest,
          sourceArtifactIdentityDigest:sourceReceipt.sourceArtifactIdentityDigest,buildStatus:buildReceipt.status,outputTreeDigest:buildReceipt.outputTreeDigest||null,
          sourceReceipt:path.relative(repoRoot,sourceReceiptPath),buildReceipt:path.relative(repoRoot,buildReceiptPath),productionDeploymentExecuted:false
        };
        fs.writeFileSync(path.join(outputRoot,'artifact-run.summary.json'),JSON.stringify(summary,null,2)+'\n');
        console.log(JSON.stringify(summary,null,2));
        if(buildReceipt.status==='FAIL'||buildReceipt.status==='UNVERIFIED') process.exitCode=1;
      }
    }
  }
}
