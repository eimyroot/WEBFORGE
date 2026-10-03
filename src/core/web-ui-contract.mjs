const uniq=xs=>[...new Set(xs.filter(Boolean))];
const values=x=>Array.isArray(x)?x:[];

export const WEB_UI_DESIGN_SPEC_SCHEMA='WebUIDesignSpec/v1';
export const WEB_UI_VIEWPORTS=[
  {id:'desktop',width:1280,height:720,mobile:false},
  {id:'tablet',width:768,height:1024,mobile:true},
  {id:'mobile',width:375,height:812,mobile:true}
];

export function compileWebUIDesignSpec(plan){
  if(!plan?.project||!plan?.designDNA) throw new Error('WEBFORGE plan with project and Design DNA required');
  const strategy=plan.designStrategy||plan.project.designStrategy||{};
  const creative=plan.creative||plan.project.creative||{};
  const dna=plan.designDNA||{};
  const pages=values(plan.siteBlueprint?.pages);
  const sections=values(plan.visual?.sections);
  const media=values(plan.visual?.media?.slots);
  const jobs=values(plan.product?.userJobs);
  const audience=values(strategy.audience?.segments).length?values(strategy.audience?.segments):values(plan.domain?.genome?.audience);
  const journeys=uniq([...values(creative.narrative?.stages),...jobs.map(x=>x.id||x.goal)]);
  const responsive=dna.responsive||{};
  const accessibility=dna.accessibility||{};
  const colors=strategy.color_strategy?.tokens||{};
  const components=sections.map(section=>({
    id:section.id,
    template:section.template||null,
    role:section.role||section.intent||null,
    renderer:section.renderer||null
  }));
  const assets=media.map(slot=>({
    id:slot.id,
    section:slot.section||null,
    kind:slot.kind||slot.type||null,
    status:slot.status||'UNVERIFIED',
    source:slot.source||null
  }));
  return {
    schema:WEB_UI_DESIGN_SPEC_SCHEMA,
    brief:plan.project.brief||'',
    target_users:uniq(audience),
    critical_journeys:journeys,
    direction:{
      name:creative.narrative?.pattern||strategy.layout_strategy?.primary||dna.mode||'webforge-direction',
      intent:creative.thesis?.idea||strategy.business_goal||'brief-derived web experience',
      typicality_score:null,
      keywords:uniq([...(creative.thesis?.emotion||[]),...(strategy.brand_personality?.traits||[]),dna.emotionalIntent,dna.mode]).slice(0,12)
    },
    design_system:{
      source:'WEBFORGE project plan',
      tokens:{
        color:{...colors},
        typography:{character:dna.typography?.character||null,scale:dna.typography?.scale||null},
        spacing:{density:dna.density||strategy.visual_density||null,rhythm:creative.compositionIntent?.rhythm||strategy.layout_strategy?.sectionRhythm||null},
        radius:{},
        shadow:{}
      }
    },
    layout:{
      information_hierarchy:pages.map(page=>({id:page.id||null,path:page.path||null,purpose:page.purpose||null})),
      grid:dna.grid||'',
      density:dna.density||strategy.visual_density||'',
      responsive_rules:uniq([
        responsive.strategy,
        responsive.mobilePriority?`mobile-priority:${responsive.mobilePriority}`:null,
        responsive.reducedMotion?`reduced-motion:${responsive.reducedMotion}`:null,
        ...WEB_UI_VIEWPORTS.map(v=>`${v.id}:${v.width}x${v.height}`)
      ])
    },
    components,
    assets,
    motion:{
      principles:uniq([dna.motion,strategy.interaction_strategy?.motion,creative.compositionIntent?.rhythm]),
      reduced_motion_required:responsive.reducedMotion==='required'
    },
    accessibility:{
      target:accessibility.target||'WCAG-2.2-AA-oriented',
      keyboard:['critical journeys keyboard-operable','visible focus on interactive controls'],
      semantics:['single primary h1 heuristic','landmarks and accessible names','images require meaningful alt or explicit decoration'],
      error_recovery:['forms expose understandable error and recovery states']
    },
    acceptance:{
      functional:['critical journeys remain reachable','generated static pages resolve to planned paths'],
      visual:['Creative R2 thesis remains visible in rendered result','composition diversity gate remains PASS','human visual review required before production promotion'],
      responsive:WEB_UI_VIEWPORTS.map(v=>`${v.id} ${v.width}x${v.height}: no unintended horizontal overflow`),
      accessibility:['WEBFORGE automated accessibility heuristics PASS','manual accessibility review remains separate from automated PASS'],
      performance:['WEBFORGE browser performance budget PASS','field Core Web Vitals are not inferred from lab render']
    },
    non_goals:['production deployment authorization','external connector execution','legal WCAG conformance claim','replacement of WEBFORGE project-native browser QA'],
    provenance:{
      source_plan_schema:plan.schema||null,
      creative_schema:creative.schema||null,
      design_dna_schema:dna.schema||null,
      adapter:'webforge.web-ui-contract.v1'
    }
  };
}
