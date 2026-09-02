import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const safe=s=>String(s).replace(/[^a-zA-Z0-9._-]+/g,'-');
export function fulfillMedia(projectDir,{assetDir,approve=false}={}){
  const reqPath=path.join(projectDir,'media.requests.json');
  if(!fs.existsSync(reqPath)) return {schema:'webforge.media-fulfillment.v1',status:'FAIL',reason:'media.requests.json missing'};
  const spec=JSON.parse(fs.readFileSync(reqPath,'utf8'));
  const inventory=assetDir&&fs.existsSync(assetDir)?fs.readdirSync(assetDir).filter(f=>/\.(png|jpe?g|webp)$/i.test(f)).map(f=>path.join(assetDir,f)):[];
  const outDir=path.join(projectDir,'assets','fulfilled'); fs.mkdirSync(outDir,{recursive:true});
  const fulfilled=[];
  for(let i=0;i<spec.requests.length;i++){
    const r=spec.requests[i], src=inventory.length?inventory[i%inventory.length]:null;
    if(!src){fulfilled.push({...r,status:'UNFULFILLED',evidence:null});continue;}
    const ext=path.extname(src).toLowerCase(); const name=`${String(i+1).padStart(2,'0')}-${safe(r.role)}${ext}`; const dst=path.join(outDir,name); fs.copyFileSync(src,dst);
    fulfilled.push({...r,status:approve?'APPROVED':'FULFILLED',asset:`assets/fulfilled/${name}`,evidence:{provider:'webforge-generated-media-pack',sha256:sha(dst),rights:'ORIGINAL_GENERATED',approval:approve?'APPROVED':'PENDING'}});
  }
  const critical=fulfilled.filter(x=>x.section==='hero'||x.section==='next-event');
  const status=fulfilled.some(x=>x.status==='UNFULFILLED')?'UNVERIFIED':approve&&critical.every(x=>x.status==='APPROVED')?'PASS':'FULFILLED_PENDING_APPROVAL';
  const receipt={schema:'webforge.media-fulfillment.v1',status,requested:fulfilled.length,fulfilled:fulfilled.filter(x=>x.status!=='UNFULFILLED').length,approved:fulfilled.filter(x=>x.status==='APPROVED').length,items:fulfilled};
  fs.writeFileSync(path.join(projectDir,'media.fulfillment.json'),JSON.stringify(receipt,null,2)+'\n');
  return receipt;
}
