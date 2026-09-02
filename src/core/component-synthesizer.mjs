const slug=v=>String(v||'section').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'section';

function modeFor(plan,role='VALUE'){
  const dna=plan.designDNA||{};
  if(role==='MEDIA'||dna.mode==='cinematic'||dna.mode==='experiential') return 'immersive';
  if(role==='CONVERT'||role==='ACTION') return 'conversion';
  if(role==='DISCOVER') return 'rail';
  if(role==='PROOF'||role==='TRUST') return 'split';
  if(dna.density==='dense') return 'bento';
  return 'editorial';
}

export function synthesizeProjectLocalTemplate(plan,sectionId,index=0){
  const sectionPlan=plan.layout.sectionPlan?.find(x=>x.id===sectionId)||{};
  const role=sectionPlan.role||'VALUE';
  const mode=modeFor(plan,role);
  const id=`project-local.${slug(sectionId)}.${slug(plan.project.domainArchetype||plan.project.archetype)}.r1`;
  return {
    id,
    family:sectionId,
    sectionId,
    rendererKey:'adaptive-section',
    layoutMode:mode,
    density:plan.designDNA?.density||'medium',
    semanticRole:role.toLowerCase(),
    motion:plan.designDNA?.motion||'subtle',
    contentBias:role==='MEDIA'?'media-heavy':role==='CONVERT'?'cta-led':'balanced',
    bestFor:[plan.project.archetype],
    avoidFor:[],
    mediaRoles:[],
    requiredPrimitives:['primitive.container','primitive.stack','primitive.display-section','primitive.focus-ring'],
    qualityScore:82,
    maturity:'experimental',
    trust:'generated-provisional',
    responsive:{desktop:'native',tablet:'reflow',mobile:'stack'},
    gates:['a11y','responsive','content-contract','media-contract','human-design-review'],
    source:'project-local-synthesis',
    registration:'PROJECT_LOCAL_ONLY',
    productionGate:'REVIEW_REQUIRED',
    rationale:[`missing registry family:${sectionId}`,`role:${role}`,`design mode:${plan.designDNA?.mode||'unknown'}`],
    index
  };
}
