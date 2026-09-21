import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createAppJwt, createInstallationToken, publishCommitStatus } from '../src/core/github-app-status.mjs';

const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const privateKey=pair.privateKey.export({type:'pkcs8',format:'pem'});

test('GitHub App JWT is exact-app scoped and signed',()=>{
  const jwt=createAppJwt({appId:5020260,privateKey,now:2000000000});
  const [header,payload,signature]=jwt.split('.');
  const body=JSON.parse(Buffer.from(payload,'base64url').toString());
  assert.equal(body.iss,5020260);
  assert.equal(body.exp-body.iat,600);
  assert.equal(crypto.verify('RSA-SHA256',Buffer.from(`${header}.${payload}`),pair.publicKey,Buffer.from(signature,'base64url')),true);
});

test('installation token request is repository and permission bounded',async()=>{
  let seen;
  const fetchImpl=async(url,options)=>{seen={url,options};return new Response(JSON.stringify({token:'installation-token'}),{status:201});};
  const token=await createInstallationToken({appId:5020260,installationId:163476651,privateKey,repository:'WEBFORGE',fetchImpl});
  assert.equal(token,'installation-token');
  assert.match(seen.url,/\/app\/installations\/163476651\/access_tokens$/);
  assert.deepEqual(JSON.parse(seen.options.body),{repositories:['WEBFORGE'],permissions:{contents:'read',statuses:'write'}});
});

test('commit status publication preserves exact SHA context and App creator',async()=>{
  let seen;
  const fetchImpl=async(url,options)=>{seen={url,options};return new Response(JSON.stringify({state:'success',context:'webforge/local-ci',creator:{login:'webforge-ci-gate[bot]'}}),{status:201});};
  const out=await publishCommitStatus({token:'installation-token',repository:'eimyroot/WEBFORGE',sha:'abc123',state:'success',context:'webforge/local-ci',description:'passed',fetchImpl});
  assert.match(seen.url,/\/repos\/eimyroot\/WEBFORGE\/statuses\/abc123$/);
  assert.deepEqual(JSON.parse(seen.options.body),{state:'success',context:'webforge/local-ci',description:'passed'});
  assert.equal(out.creator,'webforge-ci-gate[bot]');
});
