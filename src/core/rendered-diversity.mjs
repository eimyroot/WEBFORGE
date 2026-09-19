import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const round=(n,d=4)=>Number(n.toFixed(d));
const pairs=xs=>{const out=[];for(let i=0;i<xs.length;i++)for(let j=i+1;j<xs.length;j++)out.push([xs[i],xs[j]]);return out;};

function paeth(a,b,c){
  const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
  return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
}
function chunks(buffer){
  const out=[];let offset=8;
  while(offset+12<=buffer.length){
    const length=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8);
    const data=buffer.subarray(offset+8,offset+8+length);out.push({type,data});offset+=12+length;
    if(type==='IEND')break;
  }
  return out;
}
function pixelChannels(colorType){return ({0:1,2:3,4:2,6:4})[colorType]||0;}
export function pngVisualSignature(file,gridSize=12){
  const buffer=fs.readFileSync(file);
  if(buffer.toString('hex',0,8)!=='89504e470d0a1a0a')throw new Error('PNG signature required');
  const parsed=chunks(buffer),ihdr=parsed.find(x=>x.type==='IHDR')?.data;
  if(!ihdr)throw new Error('PNG IHDR missing');
  const width=ihdr.readUInt32BE(0),height=ihdr.readUInt32BE(4),bitDepth=ihdr[8],colorType=ihdr[9],interlace=ihdr[12];
  const channels=pixelChannels(colorType);
  if(bitDepth!==8||interlace!==0||!channels)throw new Error(`Unsupported PNG bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  const raw=zlib.inflateSync(Buffer.concat(parsed.filter(x=>x.type==='IDAT').map(x=>x.data)));
  const stride=width*channels,sums=Array(gridSize*gridSize*3).fill(0),counts=Array(gridSize*gridSize).fill(0);
  let pos=0,prev=Buffer.alloc(stride);
  for(let y=0;y<height;y++){
    const filter=raw[pos++],src=raw.subarray(pos,pos+stride);pos+=stride;const row=Buffer.allocUnsafe(stride);
    for(let i=0;i<stride;i++){
      const left=i>=channels?row[i-channels]:0,up=prev[i]||0,upperLeft=i>=channels?(prev[i-channels]||0):0;
      const predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):filter===4?paeth(left,up,upperLeft):null;
      if(predictor===null)throw new Error(`Unsupported PNG filter ${filter}`);row[i]=(src[i]+predictor)&255;
    }
    const gy=Math.min(gridSize-1,Math.floor(y*gridSize/height));
    for(let x=0;x<width;x++){
      const gx=Math.min(gridSize-1,Math.floor(x*gridSize/width)),cell=gy*gridSize+gx,base=x*channels;
      let r,g,b,a=255;if(colorType===0){r=g=b=row[base]}else{r=row[base];g=row[base+1];b=row[base+2];if(colorType===6)a=row[base+3]}
      if(a!==255){r=Math.round((r*a+255*(255-a))/255);g=Math.round((g*a+255*(255-a))/255);b=Math.round((b*a+255*(255-a))/255)}
      sums[cell*3]+=r;sums[cell*3+1]+=g;sums[cell*3+2]+=b;counts[cell]++;
    }
    prev=row;
  }
  const signature=[];
  for(let cell=0;cell<counts.length;cell++){
    const count=Math.max(counts[cell],1);
    signature.push(sums[cell*3]/count/255,sums[cell*3+1]/count/255,sums[cell*3+2]/count/255);
  }
  return {width,height,gridSize,signature,sha256:crypto.createHash('sha256').update(buffer).digest('hex')};
}

export function visualSignatureDistance(a,b){
  if(a.length!==b.length||a.length%3!==0)throw new Error('Comparable RGB signatures required');
  let total=0,cells=0;
  for(let i=0;i<a.length;i+=3){
    total+=Math.sqrt((a[i]-b[i])**2+(a[i+1]-b[i+1])**2+(a[i+2]-b[i+2])**2)/Math.sqrt(3);cells++;
  }
  return cells?total/cells:0;
}

export const RENDERED_DIVERSITY_THRESHOLDS={
  browserPassRate:1,
  accessibilityPassRate:1,
  performancePassRate:1,
  deterministicPassRate:1,
  screenshotUniqueRate:1,
  perceptualDistance:0.12,
  minimumPairDistance:0.04
};
export function evaluateRenderedDiversity(samples,thresholds=RENDERED_DIVERSITY_THRESHOLDS){
  const distances=pairs(samples).map(([a,b])=>visualSignatureDistance(a.signature,b.signature));
  const metrics={
    sampleCount:samples.length,
    browserPassRate:round(samples.filter(x=>x.browserPass).length/Math.max(samples.length,1)),
    accessibilityPassRate:round(samples.filter(x=>x.accessibilityPass).length/Math.max(samples.length,1)),
    performancePassRate:round(samples.filter(x=>x.performancePass).length/Math.max(samples.length,1)),
    deterministicPassRate:round(samples.filter(x=>x.deterministicPass).length/Math.max(samples.length,1)),
    screenshotUniqueRate:round(new Set(samples.map(x=>x.screenshotSha256)).size/Math.max(samples.length,1)),
    perceptualDistance:round(avg(distances)),
    minimumPairDistance:round(distances.length?Math.min(...distances):0)
  };
  const gates=Object.entries(thresholds).map(([metric,min])=>({metric,min,actual:metrics[metric],status:metrics[metric]>=min?'PASS':'FAIL'}));
  return {
    schema:'webforge.rendered-diversity-benchmark.v1',thresholds:{...thresholds},metrics,gates,
    status:gates.every(x=>x.status==='PASS')?'PASS':'FAIL',
    samples:samples.map(({signature,...x})=>x)
  };
}
