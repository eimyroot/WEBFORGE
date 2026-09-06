import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVercelInvocation, deploymentResult, validateCanonicalVercelProductionBinding } from '../src/core/deployment-executor.mjs';

const TEAM='team_P8cB47XVLz6mGykUGFdfh0ki';
const PROJECT='prj_At8RZceUAND02Y5Bxsu4lV6066Y5';
const SHA='825354b5572d07f126cd586b9199f8bd4658b1cb';
const targetRecord={status:'CANONICAL',scope:'production-hosting-target-identity',provider:'vercel',target:{teamId:TEAM,projectId:PROJECT}};
const valid={targetRecord,provider:'vercel',teamId:TEAM,projectId:PROJECT,sourceSha:SHA,checkoutSha:SHA,checkoutClean:true,productionApproved:true};

test('correct canonical project/team is eligible',()=>{
  const out=validateCanonicalVercelProductionBinding(valid);
  assert.equal(out.status,'ELIGIBLE');
  assert.equal(out.eligible,true);
  assert.deepEqual(out.blockers,[]);
});

test('wrong project is blocked',()=>{
  const out=validateCanonicalVercelProductionBinding({...valid,projectId:'prj_wrong'});
  assert.equal(out.status,'BLOCKED');
  assert.ok(out.blockers.includes('project-id-mismatch'));
});

test('wrong team is blocked',()=>{
  const out=validateCanonicalVercelProductionBinding({...valid,teamId:'team_wrong'});
  assert.equal(out.status,'BLOCKED');
  assert.ok(out.blockers.includes('team-id-mismatch'));
});

test('missing source SHA is blocked',()=>{
  const out=validateCanonicalVercelProductionBinding({...valid,sourceSha:null});
  assert.equal(out.status,'BLOCKED');
  assert.ok(out.blockers.includes('source-sha-missing'));
});

test('productionApproved false is blocked',()=>{
  const out=validateCanonicalVercelProductionBinding({...valid,productionApproved:false});
  assert.equal(out.status,'BLOCKED');
  assert.ok(out.blockers.includes('production-approval-missing'));
});

test('Vercel production invocation is explicit prebuilt project/team deploy',()=>{
  const invocation=buildVercelInvocation({mode:'production',teamId:TEAM,projectId:PROJECT});
  assert.deepEqual(invocation.args,['deploy','--prebuilt','--yes','--project',PROJECT,'-T',TEAM,'--prod']);
  assert.equal(invocation.env.VERCEL_PROJECT_ID,PROJECT);
  assert.equal(invocation.env.VERCEL_ORG_ID,TEAM);
});

test('command success without deployment URL is UNVERIFIED',()=>{
  const out=deploymentResult({repository:'eimyroot/WEBFORGE',branch:'main',sourceSha:SHA,mode:'production',provider:'vercel',teamId:TEAM,projectId:PROJECT,commandStatus:0,output:'done',url:null});
  assert.equal(out.status,'UNVERIFIED');
  assert.equal(out.verificationStatus,'UNVERIFIED');
  assert.equal(out.deploymentUrl,null);
});

test('command failure is FAIL',()=>{
  const out=deploymentResult({repository:'eimyroot/WEBFORGE',branch:'main',sourceSha:SHA,mode:'production',provider:'vercel',teamId:TEAM,projectId:PROJECT,commandStatus:1,output:'failed',url:null});
  assert.equal(out.status,'FAIL');
  assert.equal(out.verificationStatus,'FAIL');
});
