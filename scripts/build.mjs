import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(), dist=path.join(root,'dist'); fs.rmSync(dist,{recursive:true,force:true}); fs.mkdirSync(dist,{recursive:true}); fs.cpSync(path.join(root,'web'),dist,{recursive:true});
const manifest={name:'CASER WEBFORGE',version:'0.1.0-rc.2',builtAt:new Date().toISOString(),entry:'index.html'}; fs.writeFileSync(path.join(dist,'release-manifest.json'),JSON.stringify(manifest,null,2)); console.log('BUILD PASS',dist);
