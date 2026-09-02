const STOP=new Set(['website','web','with','and','for','the','a','an','in','of','to','mobile','first','design','site','platform','app','page','portal','chci','udělej','pro','který','která','kde']);
const titleCase=s=>s.replace(/\b\w/g,c=>c.toUpperCase());
function inferName(brief,project){
  const quoted=brief.match(/["“]([^"”]{2,40})["”]/); if(quoted)return quoted[1].trim();
  const named=brief.match(/\b(?:called|named|brand|project|platform called|for)\s+([A-ZÁ-Ž][A-Za-zÁ-ž0-9&'’-]*(?:\s+[A-ZÁ-Ž][A-Za-zÁ-ž0-9&'’-]*){0,2})/u); if(named)return named[1].trim();
  const concepts=project.domain?.namedConcepts||[]; if(concepts.length)return concepts[0];
  const words=brief.replace(/[^\p{L}\p{N}\s&'-]/gu,' ').split(/\s+/).filter(Boolean);
  const candidates=words.filter(w=>!STOP.has(w.toLowerCase())&&w.length>2&&/^[A-ZÁ-Ž]/.test(w)).slice(0,2);
  if(candidates.length)return candidates.join(' ');
  if(project.domain?.classification==='NOVEL'){if(/future self/i.test(brief))return 'Future Self';if(project.domain?.genome?.visualMode==='experiential')return 'Untitled Experience';return 'Untitled Web Product';}
  const labels={venue:'Night Signal','local-service':'Local Standard',portfolio:'Selected Practice',company:'Clear Company',saas:'Product Signal',marketplace:'Open Market','web-app':'Focused App',editorial:'Current Edition'};
  return titleCase(labels[project.archetype]||project.domain?.primary?.label||'WEBFORGE Project');
}
function styleSignals(brief,project){
  const b=brief.toLowerCase(),has=(...xs)=>xs.some(x=>b.includes(x)); let mood='precise',voice='clear',palette='neutral-contrast',image='documentary',type='modern-grotesk';
  const mode=project.domain?.genome?.visualMode;
  if(mode==='experiential'){mood='experimental';palette='immersive-contrast';image='conceptual-art-directed';type='expressive-display';}
  else if(mode==='cinematic'||has('dark','cinematic','techno','night','club','industrial')){mood='cinematic';palette='dark-electric';image='atmospheric-editorial';type='display-grotesk';}
  else if(has('luxury','premium','elegant','fashion')){mood='premium';palette='restrained-luxury';image='art-directed';type='editorial-display';}
  else if(has('friendly','family','playful','kids','children')){mood='warm';palette='warm-human';image='human-candid';type='friendly-grotesk';}
  else if(mode==='editorial'){mood='editorial';palette='editorial-contrast';image='art-directed-documentary';type='editorial-display';}
  else if(has('minimal','clean','architect')){mood='minimal';palette='monochrome';image='object-led';type='neo-grotesk';}
  if(project.domain?.genome?.trustBurden==='critical'){voice='reassuring-explicit';palette=palette==='dark-electric'?palette:'high-trust-neutral';}
  else if(project.archetype==='saas'||project.archetype==='web-app') voice='direct-product';
  else if(project.archetype==='local-service') voice='reassuring-local';
  else if(project.archetype==='portfolio') voice='editorial-confident';
  return {mood,voice,palette,imageStrategy:image,typography:type};
}
function copyByPurpose(project){
  const p=project.domain?.genome?.purpose||[]; const label=project.domain?.primary?.label||'project';
  if(p.includes('book')) return {eyebrow:'CLEAR / AVAILABLE',headline:'Make the next step easy to choose.',subheadline:`A ${label.toLowerCase()} experience organized around clarity, trust and booking.`,primary:'Check availability',secondary:'See details'};
  if(p.includes('transact')||p.includes('sell')) return {eyebrow:'DISCOVER / DECIDE',headline:'Find the right option and act with confidence.',subheadline:`A ${label.toLowerCase()} experience built around discovery, proof and a clear transaction path.`,primary:'Explore options',secondary:'How it works'};
  if(p.includes('fund')) return {eyebrow:'IMPACT / PROOF',headline:'Turn interest into visible impact.',subheadline:'Show what support enables, where it goes and what happens next.',primary:'See the impact',secondary:'How support works'};
  if(p.includes('submit')) return {eyebrow:'GUIDE / SUBMIT',headline:'Make a complex request feel straightforward.',subheadline:'Explain the process, collect the right information and show the next status clearly.',primary:'Start a submission',secondary:'How it works'};
  if(p.includes('experience')) return {eyebrow:'ENTER / EXPLORE',headline:'Make the experience begin before the first click.',subheadline:'A media-led journey that balances atmosphere, orientation and action.',primary:'Enter the experience',secondary:'Explore'};
  if(p.includes('configure')) return {eyebrow:'REQUIREMENTS / FIT',headline:'Turn requirements into a valid configuration.',subheadline:'Guide choices, expose constraints and make the resulting option easy to evaluate.',primary:'Start configuring',secondary:'See capabilities'};
  if(p.includes('learn')) return {eyebrow:'LEARN / PROGRESS',headline:'Make the next useful lesson easy to find.',subheadline:'Structure content, sessions and actions around real learner progress.',primary:'Explore learning',secondary:'How it works'};
  if(p.includes('connect')) return {eyebrow:'PEOPLE / PARTICIPATION',headline:'Make participation feel immediate and worthwhile.',subheadline:'Connect people, context and the next useful action without unnecessary friction.',primary:'Explore the community',secondary:'How it works'};
  return {eyebrow:'CLARITY / PURPOSE',headline:'Make the value clear before asking for action.',subheadline:`A ${label.toLowerCase()} experience structured around the audience, evidence and next step.`,primary:'Start here',secondary:'Learn more'};
}
function contentModel(project,name,signals){
  const base=copyByPurpose(project);
  const location=(project.brief.match(/\b(?:in|v|near)\s+([A-ZÁ-Ž][\p{L}-]+(?:\s+[A-ZÁ-Ž][\p{L}-]+)?)/u)||[])[1]||null;
  return {brandName:name,eyebrow:base.eyebrow,headline:base.headline,subheadline:base.subheadline,primaryCta:base.primary,secondaryCta:base.secondary,location,tone:signals.voice,seo:{title:`${name} — ${base.headline.replace(/[.!?]$/,'')}`,description:base.subheadline,entityType:project.domainArchetype||project.archetype,location}};
}
export function resolveBrand(project){
  const name=inferName(project.brief,project),signals=styleSignals(project.brief,project);
  return {version:'brand-intelligence.v2-universal',identity:{name,archetype:project.archetype,domainArchetype:project.domainArchetype},style:signals,content:contentModel(project,name,signals),principles:['specific before generic','outcome before implementation','proof before unsupported claim','brand direction must remain portable','public copy must not expose internal component ids','sensitive domains require explicit trust language']};
}
