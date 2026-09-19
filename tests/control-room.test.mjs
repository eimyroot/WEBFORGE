import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateStatelessPreview } from '../src/core/stateless-preview.mjs';
import controlRoomHandler from '../src/api/control-room-handler.mjs';
import { buildControlRoom } from '../scripts/build-control-room.mjs';

const brief='Premium hotel in Prague with booking, rooms, spa, restaurant and editorial city guide.';
function mockRes(){return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(v){this.body=v}}}

test('stateless Control Room generates a self-contained adaptive preview without persistence',()=>{
  const out=generateStatelessPreview(brief);
  assert.equal(out.status,'PASS');assert.equal(out.stateless,true);assert.equal(out.release.productionEligible,false);
  assert.match(out.previewHtml,/<style>/);assert.doesNotMatch(out.previewHtml,/styles\.css/);assert.match(out.previewHtml,/data:image\/svg\+xml;base64,/);
  assert.equal(out.previewChecks.some(x=>x.status==='FAIL'),false);assert.equal(out.receipt.truthBoundary.productionMutation,'BLOCKED');
});

test('stateless previews materially adapt to different briefs',()=>{
  const hotel=generateStatelessPreview(brief);const saas=generateStatelessPreview('B2B SaaS analytics workspace with login dashboard integrations pricing and enterprise security.');
  assert.notEqual(hotel.plan.project.archetype,saas.plan.project.archetype);assert.notEqual(hotel.plan.layout.fingerprint,saas.plan.layout.fingerprint);assert.notEqual(hotel.receipt.previewSha256,saas.receipt.previewSha256);
});

test('public handler exposes plan/generate/health but fails closed on deployment',async()=>{
  let res=mockRes();await controlRoomHandler({method:'GET',url:'/api/health'},res);assert.equal(res.statusCode,200);assert.equal(JSON.parse(res.body).mode,'STATELESS_CONTROL_ROOM');
  res=mockRes();await controlRoomHandler({method:'POST',url:'/api/generate',body:{brief}},res);assert.equal(res.statusCode,201);assert.equal(JSON.parse(res.body).status,'PASS');
  res=mockRes();await controlRoomHandler({method:'POST',url:'/api/deploy',body:{}},res);assert.equal(res.statusCode,409);assert.equal(JSON.parse(res.body).status,'BLOCKED');
});

test('Control Room deployment bundle contains only the bounded app package',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-control-room-'));try{const out=buildControlRoom(dir);assert.equal(out.status,'PASS');for(const f of out.files)assert.ok(fs.existsSync(path.join(dir,f)),f);const cfg=JSON.parse(fs.readFileSync(path.join(dir,'vercel.json'),'utf8'));assert.equal(cfg.rewrites[0].destination,'/api/control-room?path=:path*');}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
