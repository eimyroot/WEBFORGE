import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {pngVisualSignature,visualSignatureDistance,evaluateRenderedDiversity} from '../src/core/rendered-diversity.mjs';

function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);return Buffer.concat([len,Buffer.from(type),data,Buffer.alloc(4)]);}
function tinyPng(file,[r,g,b]){
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(2,0);ihdr.writeUInt32BE(2,4);ihdr[8]=8;ihdr[9]=2;
  const row=Buffer.from([0,r,g,b,r,g,b]);
  const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat([row,row]))),chunk('IEND',Buffer.alloc(0))]);
  fs.writeFileSync(file,png);
}
test('PNG visual signatures distinguish materially different renders',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'webforge-png-'));
  try{
    const red=path.join(dir,'red.png'),blue=path.join(dir,'blue.png'),red2=path.join(dir,'red2.png');
    tinyPng(red,[220,20,40]);tinyPng(blue,[20,60,220]);tinyPng(red2,[220,20,40]);
    const a=pngVisualSignature(red,2),b=pngVisualSignature(blue,2),c=pngVisualSignature(red2,2);
    assert.equal(visualSignatureDistance(a.signature,c.signature),0);
    assert.ok(visualSignatureDistance(a.signature,b.signature)>0.4);
    assert.notEqual(a.sha256,b.sha256);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

test('rendered diversity evaluator fails closed on visually identical samples',()=>{
  const base={signature:Array(12).fill(.5),browserPass:true,accessibilityPass:true,performancePass:true,deterministicPass:true};
  const report=evaluateRenderedDiversity([{...base,id:'a',screenshotSha256:'same'},{...base,id:'b',screenshotSha256:'same'}]);
  assert.equal(report.status,'FAIL');
  assert.equal(report.metrics.screenshotUniqueRate,0.5);
  assert.equal(report.metrics.perceptualDistance,0);
});
