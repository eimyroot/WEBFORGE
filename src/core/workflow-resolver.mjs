import { registry } from './composition-registry.mjs';
const workflows=registry('workflows');
export function resolveWorkflow(plan){
  const a=plan.project.archetype;let id='static-marketing-delivery';if(a==='venue')id='venue-event-delivery';else if(a==='local-service')id='local-service-delivery';else if(a==='portfolio')id='portfolio-delivery';else if(a==='saas'||a==='web-app')id='saas-product-delivery';else if(a==='marketplace')id='marketplace-delivery';else if(a==='editorial')id='editorial-delivery';
  const primary=workflows.find(x=>x.id===id),support=workflows.filter(x=>['visual-qa','preview-release','production-release'].includes(x.id));
  return {schema:'webforge.workflow.r1',primary,support,executionPolicy:'fail-closed',approvalGates:['preview-readiness','content-media-readiness','production-human-approval']};
}
