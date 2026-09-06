import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const productSpec=JSON.parse(fs.readFileSync('config/products/webforge-reference.json','utf8'));
const binding=JSON.parse(fs.readFileSync('config/product-target-bindings/webforge-reference.json','utf8'));
const hostingTarget=JSON.parse(fs.readFileSync('config/production-target.json','utf8'));

test('webforge-reference has stable canonical product identity and exact input',()=>{
  assert.equal(productSpec.schema,'webforge.product-spec.v1');
  assert.equal(productSpec.status,'CANONICAL');
  assert.equal(productSpec.productKey,'webforge-reference');
  assert.equal(productSpec.productPurpose,'reference-demo');
  assert.equal(productSpec.specVersion,1);
  assert.equal(productSpec.identityConstraints.generationRunIdIsProductIdentity,false);
  assert.equal(productSpec.identityConstraints.vantaIsProductionProduct,false);
  assert.equal(productSpec.identityConstraints.customerProduct,false);
  assert.equal(productSpec.identityConstraints.platformControlRoomProduct,false);
  assert.equal(Object.hasOwn(productSpec,'projectId'),false);
  assert.equal(Object.hasOwn(productSpec,'generationRunId'),false);
  assert.equal(productSpec.canonicalInput.kind,'brief');
  assert.equal(productSpec.canonicalInput.encoding,'utf-8');
  assert.equal(productSpec.canonicalInput.normalization,'none');
  assert.equal(productSpec.canonicalInput.value.includes('VANTA'),false);
  const digest=crypto.createHash('sha256').update(productSpec.canonicalInput.value,'utf8').digest('hex');
  assert.equal(digest,productSpec.canonicalInput.sha256);
  assert.equal(productSpec.authority.deploymentAuthorized,false);
});

test('webforge-reference binding matches canonical hosting target and artifact class',()=>{
  assert.equal(binding.schema,'webforge.product-target-binding.v1');
  assert.equal(binding.status,'CANONICAL');
  assert.equal(binding.bindingVersion,1);
  assert.equal(binding.productKey,productSpec.productKey);
  assert.equal(binding.productPurpose,productSpec.productPurpose);
  assert.equal(binding.artifactClass,'generated-web-product');
  assert.equal(binding.target.provider,hostingTarget.provider);
  assert.equal(binding.target.teamId,hostingTarget.target.teamId);
  assert.equal(binding.target.projectId,hostingTarget.target.projectId);
  assert.equal(binding.target.targetPurpose,'reference-demo');
  assert.equal(binding.target.permanentReferenceSlot,true);
  assert.equal(binding.constraints.deploymentAuthorized,false);
  assert.equal(binding.constraints.vantaProductPromotion,false);
  assert.equal(binding.constraints.platformControlRoomTarget,false);
  assert.equal(binding.constraints.customerProductsCovered,false);
});

test('hosting target contract remains focused on hosting target identity',()=>{
  assert.equal(hostingTarget.schema,'webforge.production-target.v1');
  assert.equal(hostingTarget.status,'CANONICAL');
  assert.equal(hostingTarget.scope,'production-hosting-target-identity');
  assert.equal(Object.hasOwn(hostingTarget,'productKey'),false);
  assert.equal(Object.hasOwn(hostingTarget,'productPurpose'),false);
  assert.equal(Object.hasOwn(hostingTarget,'artifactClass'),false);
  assert.equal(hostingTarget.authority.constraints.deploymentAuthorized,false);
});
