import { registry } from './composition-registry.mjs';
const roleRegistry=registry('mediaRoles');
const visualSections=new Set(['hero','next-event','gallery','artists','selected-work','team','product-proof','task-preview','case-study','experience','location','latest-content','featured','services']);
const roleBySection={hero:'hero-image','next-event':'event-card',gallery:'gallery-landscape',artists:'artist-portrait','selected-work':'case-detail',team:'team-portrait','product-proof':'product-stage','task-preview':'product-stage','case-study':'case-hero',experience:'experience-image',location:'location-image','latest-content':'article-card',featured:'article-hero',services:'service-image'};
const findRole=id=>roleRegistry.find(x=>x.id===id)||roleRegistry[0];
export function resolveMedia(plan,content,art){
  const slots=[];
  for(const item of plan.layout.sectionPlan){
    if(!visualSections.has(item.id)) continue;
    const count=item.id==='gallery'?6:item.id==='artists'||item.id==='team'?4:item.id==='latest-content'?3:item.id==='services'?4:1;
    for(let i=0;i<count;i++){
      const role=findRole(roleBySection[item.id]||'article-card');
      slots.push({id:`${item.id}:${i+1}`,section:item.id,index:i,role:role.id,aspectRatio:role.aspectRatio,minWidth:role.minWidth,priority:item.id==='hero'?'critical':item.slot<3?'high':'normal',loading:role.loading,focalPoint:role.focalPointRequired?(item.id==='artists'||item.id==='team'?'50% 28%':'50% 50%'):'50% 50%',cropPolicy:role.cropPolicy,treatment:art.theme.media,connectorOrder:role.connectorOrder,fallback:'procedural-art',status:'PROVISIONAL',approvalRequired:role.productionApproval,altRequired:role.altRequired});
    }
  }
  return {version:'webforge.media-intelligence.v2',roleRegistryCount:roleRegistry.length,slots,connectors:[{id:'project-assets',status:'READY',authority:'user-supplied'},{id:'cms-media',status:'CONDITIONAL',providers:['sanity','contentful']},{id:'cloudinary',status:'CONDITIONAL'},{id:'image-generation',status:'CONDITIONAL'}],productionPolicy:'critical media slots require APPROVED/VERIFIED asset or explicit procedural-art approval'};
}
