import fs from 'node:fs';import path from 'node:path';
export function connectorExecutionPlan(projectDir){const plan={schema:'webforge.live-connectors.v1',connectors:[
{id:'cms',capability:'content.events',provider:'supabase-or-sanity',status:'AWAITING_TARGET',required:['project/account target','credentials','schema approval']},
{id:'ticketing',capability:'conversion.tickets',provider:'stripe',status:'AWAITING_APPROVAL',required:['Stripe account selection','test/live mode approval','product/price definition']},
{id:'media',capability:'media.delivery',provider:'generated/local/cloudinary',status:fs.existsSync(path.join(projectDir,'media.fulfillment.json'))?'READY':'UNFULFILLED'},
{id:'preview-deploy',capability:'deployment.preview',provider:'vercel',status:'READY_FOR_EXECUTION'}],invariant:'selection does not authorize external mutation'};fs.writeFileSync(path.join(projectDir,'connector-execution.plan.json'),JSON.stringify(plan,null,2)+'\n');return plan;}
