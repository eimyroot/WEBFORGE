import { compose } from '../core/compose.mjs';
import { generateStatelessPreview } from '../core/stateless-preview.mjs';

const version='9.1.0';
const send=(res,status,body)=>{res.statusCode=status;res.setHeader?.('content-type','application/json; charset=utf-8');res.setHeader?.('cache-control','no-store');res.setHeader?.('x-content-type-options','nosniff');res.end(JSON.stringify(body,null,2));};
async function jsonBody(req){
  if(req.body&&typeof req.body==='object') return req.body;
  if(typeof req.body==='string') return JSON.parse(req.body||'{}');
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>64_000)throw new Error('Request too large');}
  return JSON.parse(raw||'{}');
}
function routePath(req){const u=new URL(req.url||'/','http://localhost');return u.searchParams.get('path')||u.pathname.replace(/^\/api\//,'');}

export default async function controlRoomHandler(req,res){
  const route=routePath(req);
  if(req.method==='GET'&&route==='health') return send(res,200,{status:'PASS',service:'webforge-control-room',version,mode:'STATELESS_CONTROL_ROOM'});
  if(req.method==='POST'&&route==='plan'){
    try{const body=await jsonBody(req);if(typeof body.brief!=='string'||body.brief.trim().length<8)throw new Error('Brief must contain at least 8 characters');return send(res,200,compose(body.brief));}
    catch(e){return send(res,400,{error:e.message});}
  }
  if(req.method==='POST'&&route==='generate'){
    try{const body=await jsonBody(req);const out=generateStatelessPreview(body.brief);return send(res,out.status==='PASS'?201:409,out);}
    catch(e){return send(res,e.code==='POLICY_BLOCK'?409:400,{error:e.message,policy:e.plan?.policy||null});}
  }
  if(req.method==='POST'&&['qa','release/evaluate','visual/approve','deploy'].includes(route)){
    return send(res,409,{status:'BLOCKED',error:'This public Control Room is stateless and preview-only. Production QA, approval and deployment require the governed execution path.',route});
  }
  return send(res,404,{error:'Not found',route});
}
