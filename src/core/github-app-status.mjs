import crypto from 'node:crypto';

const api='https://api.github.com';
const headers=token=>({
  Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28',
  'User-Agent':'webforge-ci-runner',
  ...(token?{Authorization:`Bearer ${token}`}:{})
});

function b64json(value){
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createAppJwt({appId,privateKey,now=Math.floor(Date.now()/1000)}={}){
  if(!appId||!privateKey) throw new Error('GitHub App id and private key are required');
  const unsigned=`${b64json({alg:'RS256',typ:'JWT'})}.${b64json({iat:now-60,exp:now+540,iss:Number(appId)})}`;
  const signature=crypto.sign('RSA-SHA256',Buffer.from(unsigned),privateKey).toString('base64url');
  return `${unsigned}.${signature}`;
}

async function parse(response,label){
  const body=await response.text();
  if(!response.ok) throw new Error(`${label} failed: HTTP ${response.status} ${body.slice(0,1200)}`);
  return body?JSON.parse(body):{};
}
export async function createInstallationToken({appId,installationId,privateKey,repository='WEBFORGE',fetchImpl=fetch}={}){
  if(!installationId) throw new Error('GitHub App installation id is required');
  const jwt=createAppJwt({appId,privateKey});
  const response=await fetchImpl(`${api}/app/installations/${installationId}/access_tokens`,{
    method:'POST',
    headers:{...headers(jwt),'Content-Type':'application/json'},
    body:JSON.stringify({repositories:[repository],permissions:{contents:'read',statuses:'write'}})
  });
  const data=await parse(response,'GitHub App installation token');
  if(!data.token) throw new Error('GitHub App installation token missing');
  return data.token;
}

export async function publishCommitStatus({token,repository='eimyroot/WEBFORGE',sha,state,context='webforge/local-ci',description,fetchImpl=fetch}={}){
  if(!token||!sha||!state) throw new Error('installation token, sha and state are required');
  const response=await fetchImpl(`${api}/repos/${repository}/statuses/${sha}`,{
    method:'POST',
    headers:{...headers(token),'Content-Type':'application/json'},
    body:JSON.stringify({state,context,description})
  });
  const data=await parse(response,'GitHub commit status publish');
  return {state:data.state,context:data.context,creator:data.creator?.login||null};
}
