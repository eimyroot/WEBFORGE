const STOP=new Set(`a an the and or for with from into onto of to in on at by as is are be been being this that these those website web site page pages platform app portal digital create build make design modern premium simple custom unique new user users people person visitor visitors audience service services product products business company organization organisation experience solution system tool using use where which who whose their your our its plus more about online based around through over under between after before only real clear direct specific`.split(/\s+/));
const STYLE=new Set(`modern premium elegant minimal clean bold dark light cinematic immersive editorial playful friendly calm luxury refined experimental interactive visual beautiful stunning sleek professional custom unique creative`.split(/\s+/));
const ACTION=new Set(`find search explore discover browse choose compare buy purchase book reserve join submit send share exchange collect create track manage connect learn read view open unlock grow combine follow leave attach place pin reveal complete start enter request`.split(/\s+/));
const GENERIC=new Set(['website','web','site','platform','app','portal','project','product','experience','organization','organisation','company','business','service','solution','system','tool']);
const normalize=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();
const ACRONYMS=new Set(['ai','api','b2b','b2c','ui','ux','cms','crm']);
const title=s=>String(s||'').trim().split(/\s+/).filter(Boolean).map(w=>ACRONYMS.has(w.toLowerCase())?w.toUpperCase():w[0].toUpperCase()+w.slice(1)).join(' ');
const slug=s=>normalize(s).replace(/\s+/g,'-')||'topic';
const uniq=xs=>[...new Set(xs.filter(Boolean))];
function hash(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function contentWords(text){return normalize(text).split(' ').filter(w=>w.length>2&&!STOP.has(w)&&!STYLE.has(w));}
function cleanPhrase(raw){
  const ws=normalize(raw).split(' ').filter(w=>w.length>2&&!STOP.has(w)&&!STYLE.has(w)&&!['including','featuring','contains','offers','offer'].includes(w));
  while(ws.length&&ACTION.has(ws[0]))ws.shift();
  while(ws.length&&['that','where','when','after','before'].includes(ws.at(-1)))ws.pop();
  return title(ws.slice(0,4).join(' '));
}
function subjectFromBrief(brief){
  const original=String(brief||'').replace(/[–—]/g,' - ').trim();
  const patterns=[
    /(?:website|web site|site|platform|app|portal)\s+(?:for|about)\s+([^,.;]+)/i,
    /(?:create|build|design|make)\s+(?:a|an|the)?\s*([^,.;]+?)(?=\s+(?:with|where|that|for|including|featuring)\b|[,.;]|$)/i,
    /^(?:a|an|the)\s+([^,.;]+?)(?=\s+(?:with|where|that|for|including|featuring)\b|[,.;]|$)/i,
    /-\s*([^,.;]+)/
  ];
  for(const rx of patterns){const m=original.match(rx);if(!m)continue;const c=cleanPhrase(m[1]);if(c&&normalize(c).split(' ').some(w=>!GENERIC.has(w)))return c;}
  const ws=contentWords(original).filter(w=>!GENERIC.has(w));
  return title(ws.slice(0,3).join(' '))||'Distinct Idea';
}
function entityPhrases(brief,subject){
  const original=String(brief||'').replace(/[–—]/g,' - ');
  const out=[subject];
  const tails=[...original.matchAll(/\b(?:with|including|featuring|contains?|offers?)\s+([^.;]+)/gi)].map(m=>m[1]);
  for(const tail of tails){for(const part of tail.split(/,|\band\b|\bplus\b/i)){const c=cleanPhrase(part);if(c)out.push(c);}}
  for(const m of original.matchAll(/\b(?:exchange|collect|attach|place|pin|share|compare|follow|reveal|unlock|track|grow|combine)\s+([^,.;]+?)(?=\s+(?:that|where|when|after|before|with|and)\b|[,.;]|$)/gi)){const c=cleanPhrase(m[1]);if(c)out.push(c);}
  const ws=contentWords(original).filter(w=>!GENERIC.has(w)&&!ACTION.has(w));
  for(let i=0;i<ws.length-1;i++){const p=title(`${ws[i]} ${ws[i+1]}`);if(p.length>=7)out.push(p);}
  const seen=new Set(),result=[];
  for(const x of out){const key=normalize(x);if(!key||seen.has(key)||[...GENERIC].includes(key))continue;seen.add(key);result.push(x);if(result.length>=6)break;}
  return result.length?result:[subject];
}
function sectionFor(label){
  const s=normalize(label);
  if(/person|people|member|profile|stranger|family|participant|artist|maker/.test(s))return ['team','proof'];
  if(/story|letter|memory|archive|note|observation|article|voice/.test(s))return ['latest-content','gallery'];
  if(/date|time|window|status|history|branch|step|journey|chain/.test(s))return ['process','how-it-works'];
  if(/map|place|city|location|atlas|garden|room|space/.test(s))return ['gallery','location'];
  if(/trust|receipt|proof|promise|rule|safety|identity/.test(s))return ['proof','faq'];
  if(/object|item|symbol|fragment|garment|recording|idea/.test(s))return ['featured','gallery'];
  return ['services','featured'];
}
const ACTION_LABELS={
  discover:['Explore','Browse'],search:['Search','Find'],submit:['Submit','Start'],connect:['Join','Connect'],learn:['Explore','Learn'],experience:['Enter','Explore'],transact:['Continue','Review'],sell:['Explore','Choose'],book:['Reserve','Check availability'],configure:['Configure','See options'],inform:['Explore','Learn more'],showcase:['Explore','View'],publish:['Read','Explore'],operate:['Open workspace','View system'],collaborate:['Join','See activity'],register:['Start','See details'],fund:['Support','See impact']
};
const ACTION_LABELS_CS={discover:['Prozkoumat','Procházet'],search:['Hledat','Najít'],submit:['Odeslat','Začít'],connect:['Přidat se','Prozkoumat'],learn:['Prozkoumat','Zjistit více'],experience:['Vstoupit','Prozkoumat'],transact:['Pokračovat','Zobrazit'],sell:['Prozkoumat','Vybrat'],book:['Rezervovat','Zjistit dostupnost'],configure:['Konfigurovat','Zobrazit možnosti'],inform:['Prozkoumat','Zjistit více'],showcase:['Prozkoumat','Zobrazit'],publish:['Číst','Prozkoumat'],operate:['Otevřít','Zobrazit'],collaborate:['Přidat se','Zobrazit aktivitu'],register:['Začít','Zobrazit detaily'],fund:['Podpořit','Zobrazit dopad']};
const DIRECTIONS=[
  {id:'immersive-story',family:'experience',hero:'immersive',rhythm:'cinematic-spacious',nav:'experience-nav',density:'spacious',type:'expressive-display',mediaTreatment:'atmospheric',traits:['immersive','expressive'],sections:['domain-signature','experience','gallery','statement','process','proof','faq']},
  {id:'editorial-narrative',family:'editorial',hero:'editorial',rhythm:'chaptered-editorial',nav:'editorial-nav',density:'airy',type:'editorial-display',mediaTreatment:'art-directed',traits:['editorial','selective'],sections:['domain-signature','statement','latest-content','gallery','about','proof','final-cta']},
  {id:'interactive-system',family:'application',hero:'product-stage',rhythm:'task-system',nav:'product-nav',density:'balanced',type:'functional-grotesk',mediaTreatment:'contextual',traits:['systematic','precise'],sections:['domain-signature','task-preview','workflow','services','outcomes','security','faq']},
  {id:'discovery-explorer',family:'transactional',hero:'search-first',rhythm:'discovery-flow',nav:'task-nav',density:'balanced',type:'modern-grotesk',mediaTreatment:'contextual',traits:['clear','exploratory'],sections:['domain-signature','categories','featured','gallery','how-it-works','proof','faq']},
  {id:'community-flow',family:'community',hero:'editorial',rhythm:'people-to-action',nav:'experience-nav',density:'balanced',type:'humanist-grotesk',mediaTreatment:'documentary',traits:['human','participatory'],sections:['domain-signature','team','latest-content','process','gallery','proof','faq']},
  {id:'evidence-led',family:'authority',hero:'value-led',rhythm:'evidence-first',nav:'task-nav',density:'airy',type:'authority-serif',mediaTreatment:'selective',traits:['credible','calm'],sections:['domain-signature','proof','services','process','outcomes','latest-content','faq']},
  {id:'action-led',family:'conversion',hero:'value-led',rhythm:'action-first',nav:'task-nav',density:'focused',type:'modern-grotesk',mediaTreatment:'selective',traits:['direct','purposeful'],sections:['domain-signature','services','how-it-works','proof','process','faq']}
];
function scoreDirection(d,ctx,seed){
  const g=ctx.genome||{},purpose=new Set(ctx.purposes||[]),interactions=new Set(ctx.interactions||[]),audiences=new Set(ctx.audiences||[]),content=new Set(ctx.content||[]),text=normalize(seed);
  let s=0;
  if(d.id==='immersive-story')s+=g.mediaIntensity*.34+g.novelty*.12+(ctx.visualMode==='experiential'||ctx.visualMode==='cinematic'?52:0)+(/ritual|constellation|spatial|sound|dream|atmosphere|room/.test(text)?34:0);
  if(d.id==='editorial-narrative')s+=(content.has('editorial')?55:0)+g.mediaIntensity*.18+g.novelty*.14+(/story|stories|letter|memory|history|archive|observation|note|lineage/.test(text)?42:0);
  if(d.id==='interactive-system')s+=g.applicationDepth*22+g.dataDepth*14+(interactions.has('manage')||interactions.has('collaborate')?45:0)+(/system|state|branch|tree|track|pattern|record|log/.test(text)?38:0);
  if(d.id==='discovery-explorer')s+=(purpose.has('discover')||interactions.has('search')||interactions.has('filter')?70:0)+g.mediaIntensity*.08+(/atlas|map|collection|objects|symbols|inspect|compare/.test(text)?42:0);
  if(d.id==='community-flow')s+=(purpose.has('connect')||audiences.has('community')||interactions.has('collaborate')?75:0)+g.novelty*.08+(/people|strangers|families|groups|participants|shared|collaborative|exchange|kindness/.test(text)?46:0);
  if(d.id==='evidence-led')s+=(g.trustBurden==='high'||g.trustBurden==='critical'?80:g.trustBurden==='medium'?45:10)+(/trust|receipt|promise|identity|private|anonymous|repair|origin/.test(text)?42:0);
  if(d.id==='action-led')s+=g.conversionIntensity*.58+(purpose.has('submit')||purpose.has('book')||purpose.has('register')?45:0)+(/unlock|open|reveal|handoff|choose|complete|leave/.test(text)?32:0);
  s+=(hash(`${seed}|${d.id}`)%37)-18;
  return s;
}
function tailorSections(base,entities,seed,ctx){
  const g=ctx.genome||{},h=hash(seed),semantic=uniq(entities.flatMap(sectionFor));
  let out=uniq(['domain-signature',...semantic.slice(0,2),...base.filter(x=>x!=='domain-signature'&&x!=='final-cta')]);
  if(g.mediaIntensity<45&&!semantic.includes('gallery'))out=out.filter(x=>x!=='gallery');
  if(g.applicationDepth<2&&!semantic.includes('task-preview'))out=out.filter(x=>!['task-preview','security'].includes(x));
  if(g.trustBurden==='normal'&&!semantic.includes('proof'))out=out.filter(x=>x!=='security');
  const head=out.shift();
  if(out.length>3&&h%2===1)[out[0],out[1]]=[out[1],out[0]];
  if(out.length>4&&h%3===0){const x=out.splice(2,1)[0];out.splice(Math.min(4,out.length),0,x);}
  if(out.length>5&&h%5===0)out=[...out.slice(0,2),...out.slice(3,5),out[2],...out.slice(5)];
  return [head,...uniq(out)].slice(0,8);
}
function copyFor(subject,primaryPurpose,direction,locale,seed){
  const cs=locale?.language==='cs';const labels=(cs?ACTION_LABELS_CS:ACTION_LABELS)[primaryPurpose]||(cs?['Prozkoumat','Zjistit více']:['Explore','Learn more']);
  const variants=cs?{
    'immersive-story':[`Vstupte do ${subject}.`,`Prožitek, který se odvíjí z samotné myšlenky, ne z univerzální šablony.`],
    'editorial-narrative':[`${subject}, poskládané jako příběh.`,`Obsah, souvislosti a důležité momenty v rytmu odpovídajícím tématu.`],
    'interactive-system':[`${subject}, které se dá skutečně používat.`,`Rozhraní postavené kolem úloh, stavů a rozhodnutí návštěvníka.`],
    'discovery-explorer':[`Prozkoumejte ${subject} po svém.`,`Struktura začíná tím, co chce návštěvník najít, porovnat nebo pochopit.`],
    'community-flow':[`${subject} jako prostor pro lidi.`,`Lidé, příspěvky a další krok jsou součástí jedné čitelné cesty.`],
    'evidence-led':[`Pochopte ${subject} dřív, než se rozhodnete.`,`Důležité informace a důkazy přicházejí dřív než výzva k akci.`],
    'action-led':[`${subject}, bez zbytečné cesty okolo.`,`Každá část stránky podporuje konkrétní rozhodnutí a další krok.`]
  }: {
    'immersive-story':[`Enter ${subject}.`,`An experience shaped by the idea itself rather than a universal site template.`],
    'editorial-narrative':[`${subject}, arranged as a story.`,`Content, context and key moments paced around the subject rather than a fixed company page.`],
    'interactive-system':[`${subject}, built to be used.`,`A working interface shaped around visitor tasks, states and decisions.`],
    'discovery-explorer':[`Explore ${subject} on your terms.`,`Structure begins with what visitors need to find, compare or understand.`],
    'community-flow':[`${subject} as a place for people.`,`People, contributions and the next useful action belong to one coherent flow.`],
    'evidence-led':[`Understand ${subject} before you act.`,`Important context and evidence appear before the call to action.`],
    'action-led':[`${subject}, without the detour.`,`Every section supports a concrete decision and a useful next step.`]
  };
  const pair=variants[direction.id]||variants['action-led'];
  const eyebrow=direction.id.replaceAll('-',' / ').toUpperCase();
  return {eyebrow,headline:pair[0],subheadline:pair[1],primary:labels[0],secondary:labels[1]};
}
export function synthesizeBriefModel(brief,ctx={}){
  const subject=subjectFromBrief(brief),entities=entityPhrases(brief,subject);
  const seed=`${normalize(brief)}|${entities.join('|')}`;
  const ranked=DIRECTIONS.map(d=>({...d,score:scoreDirection(d,ctx,seed)})).sort((a,b)=>b.score-a.score);
  const direction={...ranked[0],candidates:ranked.slice(0,3).map(x=>({id:x.id,score:Number(x.score.toFixed(1))}))};
  direction.sections=tailorSections(direction.sections,entities,seed,ctx);
  const topics=entities.slice(0,5).map((label,i)=>({id:slug(label),label,priority:90-i*7,sections:sectionFor(label),description:`${label} is a first-class part of ${subject}, derived from the brief rather than a generic slot.`}));
  const primaryPurpose=(ctx.purposes||[])[0]||'inform';
  const copy=copyFor(subject,primaryPurpose,direction,ctx.locale,seed);
  const labels=(ctx.locale?.language==='cs'?ACTION_LABELS_CS:ACTION_LABELS)[primaryPurpose]||['Explore','Learn more'];
  const jobs=[
    {id:`${slug(primaryPurpose)}-${slug(subject)}`,goal:`${labels[0]} ${subject}`,needs:topics.slice(0,3).map(x=>x.label)},
    ...(topics[1]?[{id:`understand-${topics[1].id}`,goal:`Understand ${topics[1].label}`,needs:[topics[1].label,topics[2]?.label||subject,'clear next state']}]:[])
  ];
  return {schema:'webforge.brief-synthesis.v1',subject,signature:hash(seed).toString(16).padStart(8,'0'),entities,topics,actions:uniq([primaryPurpose,...(ctx.interactions||[])]),jobs,direction,copy,source:{method:'deterministic brief decomposition + semantic direction scoring',competitorPatterns:['structure-first','multi-direction-theme-selection','section-context','design-system-context']}};
}
