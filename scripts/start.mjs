import net from 'node:net';
import {spawn} from 'node:child_process';

function portFree(port){return new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.once('listening',()=>s.close(()=>resolve(true)));s.listen(port,'127.0.0.1')})}
async function choosePort(){
 if(process.env.PORT){const p=Number(process.env.PORT);if(!Number.isInteger(p)||p<1||p>65535)throw new Error('PORT must be a valid TCP port');return p}
 for(let p=8787;p<=8797;p++) if(await portFree(p)) return p;
 throw new Error('No free WEBFORGE port found in 8787-8797. Set PORT=<free-port>.');
}
const port=await choosePort();
console.log(`WEBFORGE_START port=${port}${port===8787?'':' (8787 occupied; selected automatically)'}`);
const child=spawn(process.execPath,['src/api/server.mjs'],{stdio:'inherit',env:{...process.env,PORT:String(port)}});
for(const sig of ['SIGINT','SIGTERM']) process.on(sig,()=>child.kill(sig));
child.on('exit',code=>process.exitCode=code??0);
