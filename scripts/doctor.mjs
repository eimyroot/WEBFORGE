import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {discoverChromium} from '../src/core/browser-qa.mjs';

function command(name,args=['--version']){try{return execFileSync(name,args,{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}catch{return null}}
function portFree(port){return new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.once('listening',()=>s.close(()=>resolve(true)));s.listen(port,'127.0.0.1')})}
const nodeMajor=Number(process.versions.node.split('.')[0]);
const browser=discoverChromium();
const port8787=await portFree(8787);
const checks=[
 {id:'node>=22',status:nodeMajor>=22?'PASS':'FAIL',detail:process.version},
 {id:'npm',status:command('npm')?'PASS':'FAIL',detail:command('npm')},
 {id:'browser',status:browser?'PASS':'UNVERIFIED',detail:browser||'Install Chrome/Chromium or set CHROME_PATH'},
 {id:'port:8787',status:port8787?'PASS':'ADVISORY',detail:port8787?'free':'occupied; auto-start will choose another port'},
 {id:'platform',status:'INFO',detail:`${process.platform}/${process.arch} · ${os.release()}`}
];
const blocking=checks.filter(x=>x.status==='FAIL');
const out={schema:'webforge.doctor.v1',status:blocking.length?'FAIL':'PASS',checks};
console.log(JSON.stringify(out,null,2));
if(blocking.length)process.exit(1);
