import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function buildControlRoom(outDir=path.join(root,'.control-room-deploy')){
  const out=path.resolve(outDir);fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
  fs.cpSync(path.join(root,'web'),path.join(out,'public'),{recursive:true});
  fs.cpSync(path.join(root,'src'),path.join(out,'src'),{recursive:true});
  fs.mkdirSync(path.join(out,'api'),{recursive:true});
  fs.writeFileSync(path.join(out,'api','control-room.mjs'),"export { default } from '../src/api/control-room-handler.mjs';\n");
  fs.writeFileSync(path.join(out,'package.json'),JSON.stringify({name:'webforge-control-room',private:true,type:'module',version:'9.1.0',engines:{node:'24.x'}},null,2)+'\n');
  fs.writeFileSync(path.join(out,'vercel.json'),JSON.stringify({version:2,rewrites:[{source:'/api/:path*',destination:'/api/control-room?path=:path*'}],functions:{'api/control-room.mjs':{maxDuration:60}}},null,2)+'\n');
  return {status:'PASS',out,files:['public/index.html','public/app.js','public/styles.css','api/control-room.mjs','vercel.json','package.json']};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const arg=process.argv.find(x=>x.startsWith('--out='));console.log(JSON.stringify(buildControlRoom(arg?arg.slice(6):undefined),null,2));}
