const pad=n=>String(n).padStart(2,'0');
const words=(xs,i)=>xs[i%xs.length];

function venue(plan){
  const brand=plan.brand.identity.name;
  const loc=plan.brand.content.location||'Prague';
  const eventNames=['Dark Matter','Frequency','Hypnotic','Eclipse'];
  const artists=['ANNA','FJAAK','Recondite','VTSS'];
  return {
    hero:{eyebrow:`${loc.toUpperCase()} AFTER DARK`,headline:'Immersive techno nights.',subheadline:`Raw sound. Curated energy. A premium club experience in the heart of ${loc}.`,primary:'See next event',secondary:'Buy tickets'},
    navigation:['Experience','Events','Artists','Gallery','Tickets','Contact'],
    'next-event':{kicker:'NEXT EVENT',title:eventNames[0],date:'SAT 31 MAY',time:'23:00 — 06:00',location:`${brand}, ${loc}`,lineup:artists.slice(0,3),cta:'View event & tickets'},
    artists:{kicker:'FEATURED ARTISTS',items:artists.map((name,i)=>({name,meta:i===2?'LIVE':'DJ SET',mediaLabel:`Artist ${pad(i+1)}`}))},
    gallery:{kicker:'FROM THE CLUB',title:'Inside the room.',items:Array.from({length:6},(_,i)=>({title:words(['Main room','Light architecture','Crowd energy','Booth perspective','Late set','After image'],i),mediaLabel:`Club ${pad(i+1)}`}))},
    schedule:{kicker:'NIGHT FLOW',title:'One night, one continuous arc.',steps:['Doors & warm-up','Peak room','Closing sequence']},
    experience:{kicker:'THE EXPERIENCE',title:'Sound, design and atmosphere engineered for connection.',body:'A night designed as one continuous system: room, light, sound, service and crowd.',features:[['IMMERSIVE SOUND','High-fidelity system tuned for depth and clarity.'],['LIGHT & VISUALS','A responsive light environment that shapes the night.'],['SAFE & INCLUSIVE','Respectful space and clear house standards.'],['PREMIUM BAR','Fast service, considered drinks, no unnecessary friction.']]},
    'latest-content':{kicker:'UPCOMING EVENTS',items:eventNames.slice(1).map((title,i)=>({title,date:`${[14,28,12][i]} ${['JUN','JUN','JUL'][i]}`,time:'23:00 — 06:00',meta:'CLUB NIGHT'}))},
    proof:{kicker:'WHY THE ROOM WORKS',metrics:[['01','Purpose-built sound'],['02','Curated lineups'],['03','Clear night flow']]},
    faq:{kicker:'GOOD TO KNOW',items:[['Doors & entry','Tickets and entry details stay visible before arrival.'],['Accessibility','Key access information belongs on the event page, not behind a message.'],['House policy','Respect, consent and safety are explicit parts of the experience.']]},
    location:{kicker:'LOCATION',title:`In the heart of ${loc}.`,body:'Directions, opening information and transport belong one tap away from the ticket flow.'},
    final:{eyebrow:'BE PART OF THE NIGHT',headline:'Choose the night.',primary:'Buy tickets',secondary:'Membership'},
    footer:{location:`${loc}, Czech Republic`,newsletter:'Be first to know about events and special releases.'}
  };
}

function local(plan){return {hero:{eyebrow:'LOCAL / TRUSTED',headline:'A better next step starts here.',subheadline:'Clear services, real proof and a direct path to booking.',primary:'Book a visit',secondary:'See results'},navigation:['Services','Results','Process','FAQ','Contact'],services:{kicker:'SERVICES',items:['Consultation','Primary service','Follow-up','Specialist option'].map((title,i)=>({title,body:['Start with the right diagnosis.','A clear, outcome-led core service.','Know exactly what happens after delivery.','A focused option for the complex cases.'][i]}))},proof:{kicker:'PROOF',metrics:[['01','Verified work'],['02','Clear process'],['03','Local trust']]},process:{kicker:'PROCESS',steps:['Tell us what you need','Choose the right path','Confirm the next step']},gallery:{kicker:'REAL WORK',title:'Proof should be visible.',items:Array.from({length:5},(_,i)=>({title:`Outcome ${pad(i+1)}`,mediaLabel:`Work ${pad(i+1)}`}))},faq:{kicker:'FAQ',items:[['What happens first?','A short assessment before commitment.'],['How long does it take?','Scope and timing are stated before booking.'],['What should I prepare?','Only the information needed for the first step.']]},location:{kicker:'FIND US',title:plan.brand.content.location||'Local and easy to reach.',body:'Address, hours and directions should support conversion, not interrupt it.'},final:{eyebrow:'READY',headline:'Make the next move.',primary:'Book a visit',secondary:'Contact us'},footer:{location:plan.brand.content.location||'Local service',newsletter:'Useful updates, not inbox noise.'}}}

function product(plan){const saas=plan.project.archetype==='saas';return {hero:{eyebrow:saas?'PRODUCT / VALUE':'TASK / FOCUS',headline:saas?'See the value before the demo ends.':'Put the core task first.',subheadline:'A focused product story built around real workflows, proof and the next action.',primary:'Start with the product',secondary:'See workflow'},navigation:['Product','Workflow','Integrations','Pricing','Security'], 'product-proof':{kicker:'PRODUCT',title:'Make the product visible.',body:'Show the primary workflow before asking people to decode a feature list.'},'task-preview':{kicker:'CORE TASK',title:'The work surface, not a decorative dashboard.',body:'A clear stage for the task users return to every day.'},'feature-grid':{kicker:'CAPABILITIES',items:['Automate','Coordinate','Measure','Control'].map((title,i)=>({title,body:['Remove repetitive steps.','Keep work and ownership legible.','Turn activity into useful evidence.','Keep authority explicit.'][i]}))},workflow:{kicker:'WORKFLOW',steps:['Connect context','Resolve the next action','Verify the outcome']},integrations:{kicker:'INTEGRATIONS',items:['API','Data','Identity','Analytics'].map(title=>({title,body:'Connect only when the capability requires it.'}))},security:{kicker:'SECURITY',metrics:[['01','Explicit authority'],['02','Evidence'],['03','Fail closed']]},pricing:{kicker:'PRICING',items:['Start','Grow','Scale'].map((title,i)=>({title,price:['Free','€49','Custom'][i],body:'A clear boundary between plan and outcome.'}))},proof:{kicker:'PROOF',metrics:[['01','Less friction'],['02','More clarity'],['03','Traceable outcomes']]},faq:{kicker:'FAQ',items:[['Can it fit the current stack?','Integrations are capability-driven, not mandatory.'],['What changes first?','The primary workflow, then the surrounding system.'],['How is risk handled?','Every production action can be gated and evidenced.']]},final:{eyebrow:'NEXT STEP',headline:'Start with the real workflow.',primary:'Start now',secondary:'Talk to us'},footer:{location:'Available globally',newsletter:'Product updates and practical releases.'}}}

function portfolio(plan){return {hero:{eyebrow:'SELECTED / WORK',headline:'The work should make the introduction.',subheadline:'A deliberate edit of projects, process and point of view.',primary:'View selected work',secondary:'Start a project'},navigation:['Work','Case studies','About','Journal','Contact'],'selected-work':{kicker:'SELECTED WORK',items:Array.from({length:4},(_,i)=>({title:['Signal House','Afterimage','Material Study','Public System'][i],meta:['Identity','Digital','Campaign','Experience'][i],mediaLabel:`Project ${pad(i+1)}`}))},gallery:{kicker:'ARCHIVE',title:'A wider visual rhythm.',items:Array.from({length:6},(_,i)=>({title:`Frame ${pad(i+1)}`,mediaLabel:`Archive ${pad(i+1)}`}))},'case-study':{kicker:'CASE STUDY',title:'Show the thinking behind the outcome.',body:'Context, decision, craft and result should read as one narrative.'},statement:{kicker:'POINT OF VIEW',quote:'Good design makes the decision easier before it makes the surface prettier.'},about:{kicker:'ABOUT',title:'Enough context to make the work human.',body:'Practice, point of view and the right amount of biography.'},final:{eyebrow:'START A PROJECT',headline:'Make the next thing worth showing.',primary:'Start a project',secondary:'Email'},footer:{location:'Independent practice',newsletter:'New work and occasional notes.'}}}

function company(plan){return {hero:{eyebrow:'CLARITY / PROOF',headline:'Make the value clear before the pitch.',subheadline:'A credible company presence built around outcomes, expertise and evidence.',primary:'Start a conversation',secondary:'See capabilities'},navigation:['Capabilities','Outcomes','Process','Team','Contact'],services:{kicker:'CAPABILITIES',items:['Strategy','Design','Delivery','Support'].map((title,i)=>({title,body:['Define the right problem.','Turn decisions into a coherent system.','Ship with accountable ownership.','Keep the result healthy after launch.'][i]}))},outcomes:{kicker:'OUTCOMES',metrics:[['01','Clearer decisions'],['02','Lower friction'],['03','Visible evidence']]},proof:{kicker:'PROOF',items:['Case evidence','Client signal','Operational proof'].map(title=>({title,body:'Evidence belongs close to the claim it supports.'}))},process:{kicker:'PROCESS',steps:['Understand','Resolve','Deliver']},team:{kicker:'TEAM',items:['Lead','Design','Engineering'].map((title,i)=>({title,meta:'Accountable owner',mediaLabel:`Team ${pad(i+1)}`}))},faq:{kicker:'FAQ',items:[['How do we start?','With the decision that matters most.'],['How is scope controlled?','Explicit deliverables and change boundaries.'],['Who owns the output?','Ownership is made clear before delivery.']]},final:{eyebrow:'NEXT',headline:'Start the conversation.',primary:'Contact us',secondary:'See work'},footer:{location:'Independent team',newsletter:'Useful releases and field notes.'}}}


function fallbackSection(id,plan){
  const title=id.replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase());
  if(['how-it-works','workflow','process','schedule'].includes(id)) return {kicker:title.toUpperCase(),title,steps:['Understand the need','Choose the right path','Complete the next action']};
  if(['proof','outcomes','security','trust-safety','trust-strip','logo-cloud'].includes(id)) return {kicker:title.toUpperCase(),title,metrics:[['01','Clear signal'],['02','Visible evidence'],['03','Lower uncertainty']]};
  if(['faq'].includes(id)) return {kicker:'FAQ',items:[['What happens next?','The next action stays visible and specific.'],['What is required?','Only the information needed for this step.'],['How is quality controlled?','The page is verified before release.']]};
  if(['statement','about','case-study','problem-solution','product-proof','task-preview'].includes(id)) return {kicker:title.toUpperCase(),title,body:'A focused section bound to the page goal, content model and visitor journey.'};
  if(['pricing','availability','booking'].includes(id)) return {kicker:title.toUpperCase(),title,items:[{title:'Standard',price:'From scope',body:'A clear commercial next step.'},{title:'Priority',price:'Custom',body:'For higher urgency or complexity.'}]};
  if(['featured','categories','search-results','comparison','testimonials','newsletter','supply-demand','feature-grid','services','integrations','latest-content'].includes(id)) return {kicker:title.toUpperCase(),title,items:['Primary','Secondary','Tertiary','Extended'].map((x,i)=>({title:x,body:'Purpose-built content slot '+(i+1)+'.'}))};
  if(id==='domain-signature') return {kicker:'DOMAIN SIGNATURE',title:'A composition synthesized for this specific idea.',body:'This section exists because no registry family was a sufficient semantic match.',items:[{title:'Intent',body:'Derived from the novel-domain model.'},{title:'Entities',body:'Mapped from the product ontology.'},{title:'Journey',body:'Composed from the primary user jobs.'}]};
  return {kicker:title.toUpperCase(),title,items:[{title:'Focus',body:'A purposeful section resolved by WEBFORGE.'}]};
}

function universal(plan){
  const brand=plan.brand.content, entities=(plan.product?.entities||[]).map(x=>x.name), jobs=plan.product?.userJobs||[], domain=plan.domain?.primary?.label||'Web product';
  const model={
    hero:{eyebrow:brand.eyebrow,headline:brand.headline,subheadline:brand.subheadline,primary:brand.primaryCta,secondary:brand.secondaryCta},
    navigation:(plan.siteBlueprint?.navigation||plan.experience?.navigation||[]).map(x=>typeof x==='string'?x:(x.label||x.id)).slice(0,7),
    final:{eyebrow:'NEXT STEP',headline:brand.primaryCta||'Take the next step.',primary:brand.primaryCta||'Continue',secondary:brand.secondaryCta||'Learn more'},
    footer:{location:brand.location||domain,newsletter:'Updates tied to this product, not generic filler.'}
  };
  const entityItems=entities.slice(0,4).map((name,i)=>({title:name,body:`A structured ${name.toLowerCase()} view bound to the product model.`,mediaLabel:`${name} ${pad(i+1)}`}));
  const jobItems=jobs.slice(0,4).map((j,i)=>({title:j.goal,body:j.needs.join(' · '),mediaLabel:`Journey ${pad(i+1)}`}));
  for(const id of plan.layout.sections){
    if(id==='hero'||id==='final-cta'||model[id])continue;
    const title=id.replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase());
    if(['categories','featured','search-results','comparison','testimonials','services','team','artists','gallery','feature-grid','latest-content','integrations'].includes(id)) model[id]={kicker:title.toUpperCase(),title,items:(entityItems.length?entityItems:jobItems)};
    else if(['workflow','process','how-it-works','schedule'].includes(id)) model[id]={kicker:title.toUpperCase(),title,steps:jobs.slice(0,4).map(j=>j.goal)};
    else if(['proof','outcomes','security','trust-safety','trust-strip'].includes(id)) model[id]={kicker:title.toUpperCase(),title,metrics:[['01',`Trust burden: ${plan.domain.genome.trustBurden}`],['02',`${plan.product.capabilityIds.length} resolved capabilities`],['03',`${plan.siteBlueprint.pageCount} synthesized pages`]]};
    else if(['pricing','availability','booking','next-event'].includes(id)) model[id]={kicker:title.toUpperCase(),title,items:[{title:'Primary action',price:'Resolved by connector',body:'Commercial data remains provisional until a real provider is bound.'}]};
    else if(id==='location') model[id]={kicker:'LOCATION',title:brand.location||'Location-aware experience',body:'Location data is shown only when a verified source is available.'};
    else if(id==='domain-signature') model[id]={kicker:'DOMAIN SIGNATURE',title:`A ${plan.domain.primary.label.toLowerCase()} experience synthesized from the idea itself.`,body:'No fixed industry template was used for this section.',items:[...entityItems.slice(0,3),...jobItems.slice(0,2)]};
    else if(id==='faq') model[id]={kicker:'FAQ',items:[['What can I do here?',jobs[0]?.goal||'Understand the offer and take the next useful action.'],['What data is real?','Production content must come from approved content or connector evidence.'],['What if a capability is missing?','WEBFORGE marks it UNRESOLVED rather than pretending it works.']]};
    else model[id]=fallbackSection(id,plan);
  }
  return model;
}

export function bindContent(plan){
  const a=plan.project.archetype;
  const useUniversal=plan.project.domain?.classification==='NOVEL'||(plan.project.domain?.classification==='HYBRID'&&plan.domain?.genome?.applicationDepth>=3);
  const model=useUniversal?universal(plan):a==='venue'?venue(plan):a==='local-service'?local(plan):['saas','web-app','marketplace'].includes(a)?product(plan):a==='portfolio'?portfolio(plan):company(plan);
  for(const id of plan.layout.sections) if(id!=='hero'&&id!=='final-cta'&&!model[id]) model[id]=fallbackSection(id,plan);
  return {version:'webforge.content-binding.universal.v1',archetype:a,domainArchetype:plan.project.domainArchetype,brand:plan.brand.identity.name,locale:'en',model,source:{kind:'generated-seed',status:'PROVISIONAL',productionRequirement:'replace or approve generated seed content'}};
}
