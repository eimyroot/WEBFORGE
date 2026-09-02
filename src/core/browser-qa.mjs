import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import zlib from 'node:zlib';


export function discoverChromium(){
  const candidates=[
    process.env.CHROME_PATH,process.env.CHROMIUM_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/usr/bin/google-chrome-stable'
  ].filter(Boolean);
  for(const candidate of candidates) if(fs.existsSync(candidate)) return candidate;
  for(const command of ['chromium','chromium-browser','google-chrome','google-chrome-stable']){
    try{const candidate=execFileSync('which',[command],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();if(candidate&&fs.existsSync(candidate)) return candidate;}catch{}
  }
  return null;
}


function inlineLocalAssets(html,projectDir){
  return html.replace(/src="\.\/(assets\/(?:media|fulfilled)\/[^"]+)"/g,(full,rel)=>{
    const file=path.resolve(projectDir,rel);
    const root=path.resolve(projectDir)+path.sep;
    if(!file.startsWith(root)||!fs.existsSync(file)) return full;
    const ext=path.extname(file).toLowerCase();
    const mime=ext==='.svg'?'image/svg+xml':ext==='.png'?'image/png':ext==='.jpg'||ext==='.jpeg'?'image/jpeg':null;
    if(!mime) return full;
    return `src="data:${mime};base64,${fs.readFileSync(file).toString('base64')}"`;
  });
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function pngPixelHash(file){
  const b=fs.readFileSync(file);
  if(b.length<8 || b.toString('hex',0,8)!=='89504e470d0a1a0a') return sha(file);
  let off=8; const idat=[]; let ihdr=null;
  while(off+12<=b.length){
    const len=b.readUInt32BE(off); const type=b.toString('ascii',off+4,off+8);
    const data=b.subarray(off+8,off+8+len);
    if(type==='IHDR') ihdr=Buffer.from(data);
    if(type==='IDAT') idat.push(Buffer.from(data));
    off+=12+len;
    if(type==='IEND') break;
  }
  if(!ihdr||!idat.length) return sha(file);
  const raw=zlib.inflateSync(Buffer.concat(idat));
  return crypto.createHash('sha256').update(ihdr).update(raw).digest('hex');
}

async function connectCdp(port){
  let target;
  for(let i=0;i<180;i++){
    try{const list=await fetch(`http://127.0.0.1:${port}/json`); const arr=await list.json(); target=arr.find(x=>x.type==='page'); if(target)break;}catch{}
    await sleep(100);
  }
  if(!target) throw new Error('Chromium CDP target unavailable');
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let seq=0; const pending=new Map();
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data); if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(new Error(m.error.message)):resolve(m.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  return {ws,send};
}

export async function runBrowserQa(projectDir,{baseline=true,budgets={loadMs:1500,htmlBytes:250000,cssBytes:250000}}={}){
  const checks=[]; const evidenceDir=path.join(projectDir,'qa'); fs.mkdirSync(evidenceDir,{recursive:true});
  const sourceHtml=fs.readFileSync(path.join(projectDir,'index.html'),'utf8'); const sourceCss=fs.readFileSync(path.join(projectDir,'styles.css'),'utf8');
  const deterministicCss='\n*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;}html{scroll-behavior:auto!important;}';
  const html=inlineLocalAssets(sourceHtml.replace(/<link rel="stylesheet" href="\.\/styles\.css">/,`<style>${sourceCss}${deterministicCss}</style>`),projectDir); const url='about:blank#webforge-render';
  const cdpPort=19000+Math.floor(Math.random()*3000);
  const userData=path.join(evidenceDir,'.chromium-profile');
  const chromiumPath=discoverChromium();
  if(!chromiumPath){
    const receipt={schema:'webforge.browser-qa.v2',status:'UNVERIFIED',url,checks:[{id:'chromium-available',status:'UNVERIFIED',detail:'Install Google Chrome/Chromium or set CHROME_PATH / CHROMIUM_PATH.'}],screenshot:{current:null,baseline:null}};
    fs.writeFileSync(path.join(evidenceDir,'browser-qa.json'),JSON.stringify(receipt,null,2)+'\n');
    return receipt;
  }
  const chromium=spawn(chromiumPath,[
    '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--disable-lcd-text','--font-render-hinting=none',
    '--force-device-scale-factor=1','--hide-scrollbars','--window-size=1440,1200',
    '--remote-debugging-address=127.0.0.1',`--remote-debugging-port=${cdpPort}`,`--user-data-dir=${userData}`,'about:blank'
  ],{stdio:'ignore'});
  let cdp;
  try{
    cdp=await connectCdp(cdpPort); const {send}=cdp;
    await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1200,deviceScaleFactor:1,mobile:false});
    const tree=await send('Page.getFrameTree'); const frameId=tree.frameTree.frame.id; const renderStart=Date.now(); await send('Page.setDocumentContent',{frameId,html}); await send('Runtime.evaluate',{expression:'document.fonts?.ready',awaitPromise:true}); await sleep(350); const renderMs=Date.now()-renderStart;
    const result=await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const nav=performance.getEntriesByType('navigation')[0];const imgs=[...document.images];const labels=[...document.querySelectorAll('input,select,textarea')].filter(el=>!el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')).length;return {title:document.title,lang:document.documentElement.lang,h1:document.querySelectorAll('h1').length,missingAlt:imgs.filter(i=>!i.hasAttribute('alt')).length,unlabelledFields:labels,main:document.querySelectorAll('main').length,links:document.querySelectorAll('a').length,loadMs:nav?.loadEventEnd||0,domMs:nav?.domContentLoadedEventEnd||0,consoleMarker:'ok'}})()`});
    const dom=result.result.value;
    checks.push({id:'browser-qa',status:dom.title&&dom.main===1&&dom.h1===1?'PASS':'FAIL',detail:dom});
    checks.push({id:'accessibility',status:dom.lang&&dom.h1===1&&dom.missingAlt===0&&dom.unlabelledFields===0&&dom.main===1?'PASS':'FAIL',detail:{lang:dom.lang,h1:dom.h1,missingAlt:dom.missingAlt,unlabelledFields:dom.unlabelledFields,main:dom.main}});
    const htmlBytes=fs.statSync(path.join(projectDir,'index.html')).size; const cssBytes=fs.statSync(path.join(projectDir,'styles.css')).size;
    checks.push({id:'performance',status:renderMs<=budgets.loadMs&&htmlBytes<=budgets.htmlBytes&&cssBytes<=budgets.cssBytes?'PASS':'FAIL',detail:{renderMs,htmlBytes,cssBytes,budgets,measurement:'real Chromium CDP document render; not Lighthouse'}});
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); const current=path.join(evidenceDir,'current.png'); fs.writeFileSync(current,Buffer.from(shot.data,'base64'));
    const baselinePath=path.join(evidenceDir,'baseline.png');
    if(fs.existsSync(baselinePath)){
      const same=pngPixelHash(current)===pngPixelHash(baselinePath);
      checks.push({id:'visual-regression',status:same?'PASS':'FAIL',detail:{baselinePixelSha256:pngPixelHash(baselinePath),currentPixelSha256:pngPixelHash(current),comparison:'decompressed-pixel-data-hash'}});
    }else if(baseline){
      fs.copyFileSync(current,baselinePath);
      checks.push({id:'visual-regression',status:'BASELINE_CREATED',detail:{baselinePixelSha256:pngPixelHash(baselinePath)}});
    }else checks.push({id:'visual-regression',status:'UNVERIFIED',detail:'no baseline'});
    const status=checks.some(x=>x.status==='FAIL')?'FAIL':checks.some(x=>!['PASS'].includes(x.status))?'UNVERIFIED':'PASS';
    const receipt={schema:'webforge.browser-qa.v2',status,url,checks,screenshot:{current:'qa/current.png',baseline:fs.existsSync(baselinePath)?'qa/baseline.png':null}};
    fs.writeFileSync(path.join(evidenceDir,'browser-qa.json'),JSON.stringify(receipt,null,2)+'\n');
    return receipt;
  } finally {
    try{cdp?.ws?.close();}catch{}
    if(chromium.exitCode===null){
      const exited=new Promise(resolve=>chromium.once('exit',resolve));
      try{chromium.kill('SIGTERM');}catch{}
      await Promise.race([exited,sleep(1200)]);
      if(chromium.exitCode===null){try{chromium.kill('SIGKILL');}catch{} await sleep(120);}
    }
    for(let i=0;i<4;i++){try{fs.rmSync(userData,{recursive:true,force:true,maxRetries:2,retryDelay:80});break}catch{await sleep(120)}}
  }
}
