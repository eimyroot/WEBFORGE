const uniq=xs=>[...new Set(xs.filter(Boolean))];
const words=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(Boolean);
const has=(set,...xs)=>xs.some(x=>set.has(x));
const cap=(caps,...xs)=>xs.some(x=>caps.has(x));
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

const TOPICS={
  room:{id:'rooms',label:'Rooms',purpose:'evaluate-stay',sections:['gallery','services','proof','availability']},
  rooms:{id:'rooms',label:'Rooms',purpose:'evaluate-stay',sections:['gallery','services','proof','availability']},
  suite:{id:'rooms',label:'Rooms',purpose:'evaluate-stay',sections:['gallery','services','proof','availability']},
  suites:{id:'rooms',label:'Rooms',purpose:'evaluate-stay',sections:['gallery','services','proof','availability']},
  spa:{id:'experience',label:'Experience',purpose:'experience-offer',sections:['experience','gallery','services','proof']},
  restaurant:{id:'experience',label:'Experience',purpose:'experience-offer',sections:['experience','gallery','services','proof']},
  dining:{id:'experience',label:'Experience',purpose:'experience-offer',sections:['experience','gallery','services','proof']},
  event:{id:'events',label:'Events',purpose:'browse-events',sections:['next-event','latest-content','schedule']},
  events:{id:'events',label:'Events',purpose:'browse-events',sections:['next-event','latest-content','schedule']},
  artist:{id:'artists',label:'Artists',purpose:'discover-people',sections:['artists','gallery','latest-content']},
  artists:{id:'artists',label:'Artists',purpose:'discover-people',sections:['artists','gallery','latest-content']},
  pricing:{id:'pricing',label:'Pricing',purpose:'evaluate-commercial-fit',sections:['pricing','proof','faq']},
  security:{id:'security',label:'Security',purpose:'reduce-risk',sections:['security','proof','faq']},
  reports:{id:'solutions',label:'Solutions',purpose:'understand-product-value',sections:['product-proof','feature-grid','outcomes']},
  reporting:{id:'solutions',label:'Solutions',purpose:'understand-product-value',sections:['product-proof','feature-grid','outcomes']},
  invoicing:{id:'product',label:'Product',purpose:'understand-product',sections:['product-proof','feature-grid','workflow']},
  expenses:{id:'product',label:'Product',purpose:'understand-product',sections:['product-proof','feature-grid','workflow']}
};

function semanticTopics(brief){
  const seen=new Set(),out=[];
  for(const w of words(brief)){
    const t=TOPICS[w];
    if(t&&!seen.has(t.id)){seen.add(t.id);out.push({...t,path:`/${t.id}/`});}
  }
  return out;
}
function businessGoal(domain,product){
  const c=new Set(product.capabilityIds),p=domain.genome.purpose;
  if(cap(c,'conversion.booking'))return 'book';
  if(cap(c,'conversion.tickets'))return 'sell-tickets';
  if(cap(c,'commerce.checkout','commerce.subscription'))return 'sell-or-activate';
  if(cap(c,'workflow.submission'))return 'collect-and-process';
  if(domain.genome.applicationDepth>=3)return 'activate-and-retain';
  if(p.includes('experience'))return 'immerse-and-convert';
  return 'inform-and-convert';
}
function personality(domain,tokens){
  const g=domain.genome,traits=[];
  if(g.visualMode==='cinematic')traits.push('immersive','high-contrast','expressive');
  else if(g.visualMode==='application')traits.push('precise','systematic','credible');
  else if(g.visualMode==='minimal')traits.push('refined','calm','selective');
  else if(g.visualMode==='editorial')traits.push('editorial','cultured','content-led');
  else traits.push('clear','confident','purposeful');
  if(g.trustBurden==='high'||g.trustBurden==='critical'||has(tokens,'sensitive','funeral','health','medical','clinic','legal'))traits.push('reassuring');
  if(has(tokens,'luxury','premium','boutique','elegant'))traits.push('premium','restrained');
  if(has(tokens,'underground','techno','night','club'))traits.push('nocturnal','energetic');
  if(has(tokens,'family','kids','children'))traits.push('warm','playful');
  if(domain.primary.id==='florist-retail')traits.push('botanical','crafted','warm','image-led');
  if(domain.classification==='NOVEL'&&domain.synthesis?.direction?.traits)traits.push(...domain.synthesis.direction.traits);
  return uniq(traits);
}
function hslToHex(h,s,l){
  s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l);const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return '#'+[f(0),f(8),f(4)].map(x=>Math.round(255*x).toString(16).padStart(2,'0')).join('');
}
function hashHue(s){let h=0;for(const ch of s)h=(h*31+ch.charCodeAt(0))%360;return h;}
const DOMAIN_COLOR_PROFILES={
  'venue-entertainment':{hue:282,temperature:'electric',dark:true,saturation:74},
  'local-professional-service':{hue:204,temperature:'trust',saturation:48},
  'creative-practice':{hue:18,temperature:'editorial',saturation:54},
  'software-product':{hue:218,temperature:'cool',saturation:66},
  'web-application':{hue:202,temperature:'cool',saturation:60},
  'marketplace-platform':{hue:158,temperature:'fresh',saturation:58},
  'editorial-publication':{hue:352,temperature:'editorial',saturation:58},
  'commerce-store':{hue:328,temperature:'vivid',saturation:62},
  'florist-retail':{hue:342,temperature:'floral',saturation:46},
  hospitality:{hue:32,temperature:'warm',saturation:46},
  'education-learning':{hue:248,temperature:'scholarly',saturation:56},
  'civic-government':{hue:198,temperature:'civic',saturation:58},
  'nonprofit-impact':{hue:142,temperature:'natural',saturation:52},
  'real-estate':{hue:172,temperature:'architectural',saturation:50},
  'jobs-careers':{hue:230,temperature:'professional',saturation:58},
  healthcare:{hue:184,temperature:'clinical',saturation:48},
  finance:{hue:222,temperature:'financial',saturation:64},
  'industrial-b2b':{hue:28,temperature:'industrial',saturation:60},
  'digital-experience':{hue:304,temperature:'electric',dark:true,saturation:72},
  'community-membership':{hue:334,temperature:'social',saturation:58},
  'generic-organization':{hue:210,temperature:'neutral',saturation:54}
};
const DOMAIN_GRAMMARS={
  'education-learning':{primary:'academic-system',hero:'academic-campus',rhythm:'chaptered',nav:'academic-nav',density:'balanced',type:'editorial-display',interaction:'explore-and-apply'},
  'jobs-careers':{primary:'careers-system',hero:'job-search',rhythm:'search-and-evaluate',nav:'careers-nav',density:'balanced',type:'functional-grotesk',interaction:'search-and-apply'},
  'industrial-b2b':{primary:'industrial-system',hero:'specification-led',rhythm:'technical-evidence',nav:'industrial-nav',density:'balanced',type:'technical-grotesk',interaction:'specify-and-enquire'},
  finance:{primary:'finance-system',hero:'trust-led',rhythm:'advisory-evidence',nav:'finance-nav',density:'airy',type:'authority-serif',interaction:'understand-and-consult'},
  'community-membership':{primary:'community-system',hero:'people-led',rhythm:'community-flow',nav:'community-nav',density:'balanced',type:'humanist-grotesk',interaction:'discover-and-join'},
  'commerce-store':{primary:'commerce-system',hero:'catalog-led',rhythm:'merchandising',nav:'commerce-nav',density:'balanced',type:'modern-grotesk',interaction:'browse-compare-buy'},
  'florist-retail':{primary:'florist-system',hero:'botanical-editorial',rhythm:'occasion-to-bouquet',nav:'florist-nav',density:'airy',type:'editorial-display',interaction:'browse-personalize-deliver'}
};
function domainGrammar(domain,tokens){
  if(domain.primary.id==='generic-organization'&&has(tokens,'agency','studio','corporate','company','consultancy'))return {primary:'corporate-system',hero:'manifesto-led',rhythm:'case-led',nav:'corporate-nav',density:'airy',type:'editorial-display',interaction:'evaluate-and-contact'};
  if(domain.primary.id==='hospitality'&&has(tokens,'restaurant','dining','chef','menu')&&!has(tokens,'hotel','resort','hostel','room','rooms','suite','suites'))return {primary:'culinary-system',hero:'menu-led',rhythm:'editorial-service',nav:'culinary-nav',density:'spacious',type:'editorial-display',interaction:'browse-and-reserve'};
  if(domain.primary.id==='local-professional-service'&&has(tokens,'law','legal','lawyer','attorney','accounting','accountant','consulting','consultant','advisory','firm'))return {primary:'professional-system',hero:'authority-led',rhythm:'expertise-evidence',nav:'professional-nav',density:'airy',type:'authority-serif',interaction:'evaluate-and-contact'};
  if(domain.classification==='NOVEL'&&domain.synthesis?.direction){const d=domain.synthesis.direction;return {primary:`novel-${d.id}`,hero:d.hero,rhythm:d.rhythm,nav:d.nav,density:d.density,type:d.type,interaction:d.id==='interactive-system'?'task-oriented':d.id==='immersive-story'?'immerse-and-explore':'progressive'};}
  return DOMAIN_GRAMMARS[domain.primary.id]||null;
}
function semanticColorProfile(domain,tokens,traits){
  const id=domain.primary.id,base={...(DOMAIN_COLOR_PROFILES[id]||DOMAIN_COLOR_PROFILES['generic-organization'])};
  if(has(tokens,'funeral','memorial'))Object.assign(base,{hue:38,temperature:'calm',saturation:28});
  else if(has(tokens,'emergency','urgent','plumber'))Object.assign(base,{hue:8,temperature:'urgent',saturation:72});
  else if(has(tokens,'accounting','invoicing','expenses','finance','financial'))Object.assign(base,{hue:188,temperature:'financial',saturation:58});
  else if(has(tokens,'developer','api','monitoring','cyber','security'))Object.assign(base,{hue:262,temperature:'technical',saturation:66});
  else if(has(tokens,'climate','eco','environmental','nature'))Object.assign(base,{hue:142,temperature:'natural',saturation:52});
  else if(has(tokens,'recipe','cooking','chef')||(has(tokens,'restaurant','dining')&&!has(tokens,'hotel','resort','hostel')))Object.assign(base,{hue:24,temperature:'culinary',saturation:62});
  else if(has(tokens,'fashion','runway'))Object.assign(base,{hue:326,temperature:'fashion',saturation:62});
  else if(has(tokens,'architecture','architect'))Object.assign(base,{hue:22,temperature:'architectural',saturation:46});
  else if(has(tokens,'university','education','course','learning'))Object.assign(base,{hue:248,temperature:'scholarly',saturation:56});
  else if(has(tokens,'civic','municipal','government'))Object.assign(base,{hue:198,temperature:'civic',saturation:58});
  else if(has(tokens,'jobs','careers','recruitment'))Object.assign(base,{hue:230,temperature:'professional',saturation:58});
  else if(has(tokens,'property','estate','realtor'))Object.assign(base,{hue:172,temperature:'architectural',saturation:50});
  else if(has(tokens,'corporate','consultancy','agency','studio'))Object.assign(base,{hue:214,temperature:'corporate',saturation:44});
  if(traits.includes('nocturnal'))base.dark=true;
  return base;
}
function luminance(hex){
  const rgb=[0,2,4].map(i=>parseInt(hex.slice(1+i,3+i),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function contrastRatio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function accentText(accent){return contrastRatio(accent,'#ffffff')>=contrastRatio(accent,'#000000')?'#ffffff':'#000000';}
const LIGHT_CANVASES={
  neutral:{background:'#f5f3ef',surface:'#fffdfa',surface2:'#eae6df',line:'#d2cbc1'},
  corporate:{background:'#f3f1ed',surface:'#fffdfa',surface2:'#e5e2dc',line:'#cac5bc'},
  scholarly:{background:'#f0eff8',surface:'#fcfbff',surface2:'#e4e2f1',line:'#cbc8dd'},
  professional:{background:'#eef2f8',surface:'#fbfcff',surface2:'#dfe7f2',line:'#c5d1e1'},
  industrial:{background:'#f1eee8',surface:'#fbfaf7',surface2:'#e2ddd3',line:'#c8c0b4'},
  financial:{background:'#edf4f4',surface:'#fbfdfd',surface2:'#dceaea',line:'#c0d4d3'},
  technical:{background:'#eef0f7',surface:'#fbfcff',surface2:'#dde1ef',line:'#c3c9dd'},
  social:{background:'#f7edf2',surface:'#fffafd',surface2:'#eedde6',line:'#dbc3cf'},
  culinary:{background:'#f7f0e6',surface:'#fffaf3',surface2:'#eadbc7',line:'#d4c0a6'},
  trust:{background:'#edf4f7',surface:'#fbfdfe',surface2:'#dce9ee',line:'#c2d5de'},
  vivid:{background:'#f7edf4',surface:'#fff9fd',surface2:'#eedbe8',line:'#dbc2d3'},
  editorial:{background:'#f6f0f1',surface:'#fffafa',surface2:'#eadcdf',line:'#d2c4c7'},
  natural:{background:'#eef5ef',surface:'#fbfdfb',surface2:'#dceadd',line:'#c2d4c4'},
  architectural:{background:'#f3f1ed',surface:'#fdfcf9',surface2:'#e5e1da',line:'#cbc5ba'},
  civic:{background:'#edf4f7',surface:'#fbfdfe',surface2:'#dbe9ef',line:'#bfd3dc'},
  clinical:{background:'#edf6f5',surface:'#fbfefd',surface2:'#daebe8',line:'#bfd6d2'},
  fresh:{background:'#edf6f1',surface:'#fbfefa',surface2:'#d9ebe0',line:'#bdd5c5'},
  warm:{background:'#f7f2e9',surface:'#fffaf3',surface2:'#e9dec9',line:'#d2c2a9'},
  fashion:{background:'#f7eff4',surface:'#fffafd',surface2:'#eadde5',line:'#d3c3cd'},
  floral:{background:'#f7f3ef',surface:'#fffdf9',surface2:'#e7eee4',line:'#d0d9cb'}
};
function colorStrategy(domain,traits,tokens){
  const g=domain.genome,profile=semanticColorProfile(domain,tokens,traits);
  const tokenSeed=[domain.primary.id,...traits,...[...tokens].filter(x=>x.length>4).slice(0,18)].join('|');
  const jitter=(hashHue(tokenSeed)%29)-14;
  let hue=(profile.hue+jitter+360)%360;
  if(has(tokens,'techno','club'))hue=278;
  if(traits.includes('premium')&&domain.primary.id==='hospitality')hue=32;
  const mode=profile.dark||g.visualMode==='cinematic'?'dark':'light';
  const sat=Math.max(28,Math.min(78,profile.saturation+(traits.includes('premium')?-8:0)));
  const accent=hslToHex(hue,sat,mode==='dark'?58:42),accent2=hslToHex((hue+46)%360,Math.max(32,sat-12),mode==='dark'?68:52);
  const dark=mode==='dark',premium=traits.includes('premium');
  const canvas=LIGHT_CANVASES[profile.temperature]||(premium?LIGHT_CANVASES.warm:LIGHT_CANVASES.neutral);
  const tokensOut={background:dark?'#08090d':canvas.background,surface:dark?'#10131a':canvas.surface,surface2:dark?'#171b24':canvas.surface2,text:dark?'#f5f7fb':'#15171a',muted:dark?'#a6adbb':'#666d78',accent,accent2,accentText:accentText(accent),line:dark?'#2b3140':canvas.line};
  return {mode,temperature:profile.temperature,accentHue:hue,tokens:tokensOut,accessibility:{accentTextContrast:Number(contrastRatio(accent,tokensOut.accentText).toFixed(2)),strategy:'best-contrast-text'}};
}
function addDomainNavigation(domain,product,tokens,add){
  const c=new Set(product.capabilityIds),id=domain.primary.id;
  if(id==='industrial-b2b'){
    if(c.has('commerce.marketplace')){add('parts','Parts','/parts/',97,['categories','featured','comparison']);add('suppliers','Suppliers','/suppliers/',90,['featured','proof']);add('rfq','Request Quote','/rfq/',88,['process','final-cta']);}
    else {add('products','Products','/products/',98,['services','product-proof']);add('capabilities','Capabilities','/capabilities/',92,['services','outcomes']);add('industries','Industries','/industries/',86,['categories','proof']);add('case-studies','Case Studies','/case-studies/',80,['case-study','outcomes']);add('support','Support','/support/',72,['faq','services']);add('rfq','Request Quote','/rfq/',90,['process','final-cta']);}
  }
  if(id==='jobs-careers'||has(tokens,'jobs','job','careers','hiring')){add('jobs','Jobs','/jobs/',98,['categories','featured']);add('companies','Companies','/companies/',90,['featured','proof']);add('advice','Career Advice','/career-advice/',82,['latest-content','how-it-works']);add('employers','For Employers','/employers/',76,['services','process']);}
  if(id==='editorial-publication'){
    if(has(tokens,'recipe','recipes','cooking')){add('recipes','Recipes','/recipes/',98,['latest-content','categories']);add('categories','Categories','/categories/',88,['categories','featured']);add('guides','Guides','/guides/',78,['latest-content','how-it-works']);}
    else {add('latest','Latest','/latest/',98,['latest-content','featured']);add('topics','Topics','/topics/',88,['categories','latest-content']);add('authors','Authors','/authors/',74,['team','latest-content']);}
    if(c.has('communication.newsletter')||c.has('commerce.subscription'))add('newsletter','Newsletter','/newsletter/',70,['newsletter','proof']);
  }
  if(id==='nonprofit-impact'){add('impact','Impact','/impact/',98,['outcomes','proof']);add('research','Research','/research/',86,['latest-content','proof']);add('campaigns','Campaigns','/campaigns/',84,['featured','latest-content']);add('volunteer','Get Involved','/volunteer/',72,['process','final-cta']);if(c.has('commerce.donation'))add('donate','Donate','/donate/',94,['outcomes','final-cta']);}
  if(id==='real-estate'){add('properties','Properties','/properties/',98,['categories','featured']);add('neighborhoods','Neighborhoods','/neighborhoods/',86,['location','latest-content']);add('agents','Agents','/agents/',78,['team','proof']);add('viewings','Book a Viewing','/viewings/',90,['availability','process']);}
  if(id==='civic-government'){add('report','Report an Issue','/report/',98,['process','workflow']);add('map','Map','/map/',88,['location','latest-content']);add('status','Status','/status/',84,['workflow','outcomes']);add('services','Services','/services/',76,['services','how-it-works']);}
  if(id==='education-learning'){add('programmes','Programmes','/programmes/',98,['categories','featured']);add('admissions','Admissions','/admissions/',94,['process','faq']);add('campus','Campus','/campus/',86,['gallery','location']);add('research','Research','/research/',82,['latest-content','proof']);add('student-life','Student Life','/student-life/',78,['latest-content','gallery']);add('resources','Resources','/resources/',70,['latest-content','categories']);}
  if(id==='creative-practice'){
    if(has(tokens,'fashion','runway','collections')){add('collections','Collections','/collections/',98,['gallery','selected-work']);add('stories','Stories','/stories/',84,['latest-content','gallery']);add('press','Press','/press/',72,['latest-content','proof']);}
    else {add('projects','Projects','/projects/',98,['selected-work','case-study','gallery']);add('studio','Studio','/studio/',82,['about','team']);if(has(tokens,'awards','award'))add('awards','Awards','/awards/',72,['proof','outcomes']);}
  }
  if(id==='healthcare'){add('services','Services','/services/',96,['services','proof']);add('clinicians','Clinicians','/clinicians/',86,['team','proof']);add('resources','Resources','/resources/',72,['latest-content','faq']);}
  if(id==='finance'){add('services','Services','/services/',98,['services','proof']);add('planning','Planning','/planning/',92,['process','outcomes']);add('insights','Insights','/insights/',82,['latest-content','proof']);add('security','Security','/security/',88,['security','proof']);add('documents','Documents','/documents/',72,['latest-content','faq']);}
  if(id==='community-membership'){add('membership','Membership','/membership/',98,['services','proof']);add('events','Events','/events/',90,['next-event','schedule']);add('directory','Directory','/directory/',84,['team','search-results']);add('resources','Resources','/resources/',78,['latest-content','categories']);add('committees','Committees','/committees/',70,['team','about']);add('join','Join','/join/',88,['pricing','final-cta']);}
  if(id==='commerce-store'){add('shop','Shop','/shop/',99,['categories','featured']);add('categories','Categories','/categories/',94,['categories','featured']);add('featured','Featured','/featured/',88,['featured','gallery']);add('compare','Compare','/compare/',82,['comparison','proof']);add('reviews','Reviews','/reviews/',74,['testimonials','proof']);add('help','Help','/help/',66,['faq','trust-safety']);}
  if(id==='florist-retail'){const cs=domain.locale?.language==='cs';add('bouquets',cs?'Kytice':'Bouquets','/bouquets/',99,['featured','gallery']);add('occasions',cs?'Podle příležitosti':'By Occasion','/occasions/',96,['categories','featured']);add('weddings',cs?'Svatby a události':'Weddings & Events','/weddings/',86,['services','gallery']);add('subscriptions',cs?'Květinové předplatné':'Flower Subscriptions','/subscriptions/',78,['services','latest-content']);add('delivery',cs?'Doručení a vyzvednutí':'Delivery & Pickup','/delivery/',90,['process','location','faq']);add('story',cs?'O nás':'Our Florists','/about/',68,['about','gallery']);}
  if(id==='marketplace-platform'&&!has(tokens,'jobs','job','careers','hiring')){add('browse','Browse','/browse/',98,['categories','featured']);add('how-it-works','How It Works','/how-it-works/',78,['how-it-works','proof']);}
  if(id==='software-product'&&has(tokens,'api','developer','monitoring')){add('integrations','Integrations','/integrations/',86,['integrations','proof']);if(c.has('content.documentation'))add('docs','Docs','/docs/',78,['latest-content','how-it-works']);}
  if(id==='local-professional-service'&&has(tokens,'funeral','memorial')){add('services','Services','/services/',96,['services','proof']);add('guidance','Guidance','/guidance/',88,['how-it-works','faq']);add('process','Arrangements','/arrangements/',84,['process','proof']);}
  if(id==='hospitality'&&has(tokens,'restaurant','dining','chef','menu')&&!has(tokens,'hotel','resort','hostel','room','rooms','suite','suites')){add('menu','Menu','/menu/',99,['services','featured']);add('reservations','Reservations','/reservations/',96,['availability','booking']);add('private-dining','Private Dining','/private-dining/',84,['services','gallery']);add('story','Our Story','/story/',74,['about','team']);add('gallery','Gallery','/gallery/',70,['gallery']);}
  if(id==='local-professional-service'&&has(tokens,'law','legal','lawyer','attorney','accounting','accountant','consulting','consultant','advisory','firm')){add('practice-areas','Practice Areas','/practice-areas/',98,['services','proof']);add('professionals','Professionals','/professionals/',90,['team','proof']);add('industries','Industries','/industries/',82,['categories','case-study']);add('insights','Insights','/insights/',74,['latest-content','proof']);add('offices','Offices','/offices/',68,['location','contact']);}
  if(id==='generic-organization'&&has(tokens,'agency','studio','corporate','company','consultancy')){add('capabilities','Capabilities','/capabilities/',96,['services','outcomes']);add('work','Work','/work/',92,['selected-work','case-study']);add('approach','Approach','/approach/',82,['process','proof']);add('team','Team','/team/',74,['team','about']);add('insights','Insights','/insights/',68,['latest-content','proof']);}
  if(id==='generic-organization'&&c.has('conversion.booking')&&has(tokens,'emergency','plumber','repair')){add('services','Services','/services/',96,['services','proof']);add('areas','Service Areas','/areas/',86,['location','services']);add('pricing','Pricing','/pricing/',82,['pricing','proof']);if(c.has('trust.reviews'))add('reviews','Reviews','/reviews/',76,['proof','testimonials']);}
}
function navItems(domain,product,briefTopics,tokens){
  const c=new Set(product.capabilityIds),entities=new Set(product.entities.map(x=>x.name.toLowerCase()));
  const items=[]; const add=(id,label,path=`/${id}/`,priority=50,sections=[])=>{const existing=items.find(x=>x.id===id);if(existing){if(priority>existing.priority)Object.assign(existing,{label,path,priority,sections:sections.length?sections:existing.sections});return;}items.push({id,label,path,priority,sections});};
  add('home','Home','/',100,['hero']);
  if(domain.classification==='NOVEL'&&domain.synthesis?.topics?.length) for(const t of domain.synthesis.topics)add(t.id,t.label,`/${t.id}/`,t.priority||88,t.sections||[]);
  for(const t of briefTopics)add(t.id,t.label,t.path,88,t.sections);
  addDomainNavigation(domain,product,tokens,add);
  if(c.has('events.calendar'))add('events','Events','/events/',98,['next-event','latest-content','schedule']);
  if(entities.has('artist'))add('artists','Artists','/artists/',92,['artists','gallery']);
  if(c.has('commerce.catalog')&&domain.primary.id==='software-product')add('product','Product','/product/',96,['product-proof','feature-grid','workflow']);
  if(domain.genome.applicationDepth>=3&&!['jobs-careers','education-learning','civic-government'].includes(domain.primary.id)&&!has(tokens,'jobs','job','careers','hiring'))add('solutions','Solutions','/solutions/',84,['feature-grid','outcomes','workflow']);
  if((c.has('commerce.checkout')||c.has('commerce.subscription')||briefTopics.some(x=>x.id==='pricing'))&&!['editorial-publication','commerce-store'].includes(domain.primary.id))add('pricing','Pricing','/pricing/',82,['pricing','proof','faq']);
  if((domain.genome.trustBurden==='high'||domain.genome.trustBurden==='critical'||briefTopics.some(x=>x.id==='security'))&&!['healthcare','civic-government'].includes(domain.primary.id))add('security','Security','/security/',80,['security','proof','faq']);
  if(c.has('media.gallery')&&!items.some(x=>['rooms','experience','projects','collections'].includes(x.id)))add('gallery','Gallery','/gallery/',70,['gallery']);
  if(c.has('geo.location'))add('location',domain.primary.id==='hospitality'?'Location':'Venue','/location/',80,['location']);
  if(c.has('conversion.booking')&&!items.some(x=>x.id==='reservations'))add('booking',domain.primary.id==='hospitality'?'Book':has(tokens,'consultation')?'Consultation':'Booking','/book/',99,['availability','booking','proof']);
  if(c.has('conversion.tickets'))add('tickets','Tickets','/checkout/',90,['next-event','pricing','proof']);
  if(c.has('identity.account'))add('login','Login','/account/',60,['task-preview']);
  if(!c.has('identity.account')&&items.length<7)add('contact','Contact','/contact/',40,['services','final-cta']);
  return items.sort((a,b)=>b.priority-a.priority).slice(0,8);
}
function layoutStrategy(domain,product,traits,tokens){
  const g=domain.genome,c=new Set(product.capabilityIds),grammar=domainGrammar(domain,tokens);
  if(grammar)return {primary:grammar.primary,hero:grammar.hero,sectionRhythm:grammar.rhythm,proofPlacement:g.trustBurden==='high'||g.trustBurden==='critical'||['industrial-system','finance-system','professional-system'].includes(grammar.primary)?'early':'contextual',ctaPlacement:cap(c,'conversion.booking','conversion.tickets')?'persistent-and-contextual':'progressive'};
  const primary=domain.primary.id==='editorial-publication'?'editorial-system':g.applicationDepth>=3?'product-system':g.mediaIntensity>=80?'media-led':g.conversionIntensity>=75?'conversion-led':g.trustBurden==='high'?'evidence-led':'narrative-balanced';
  return {primary,hero:primary==='editorial-system'?'editorial-cover':g.mediaIntensity>=80?'immersive':g.applicationDepth>=3?'product-stage':traits.includes('premium')?'editorial':'value-led',sectionRhythm:primary==='editorial-system'?'editorial-paced':g.applicationDepth>=3?'compact-system':g.mediaIntensity>=80?'cinematic-spacious':'balanced',proofPlacement:g.trustBurden==='high'||g.trustBurden==='critical'?'early':'contextual',ctaPlacement:cap(c,'conversion.booking','conversion.tickets')?'persistent-and-contextual':'progressive'};
}
export function compileDesignStrategy(domain,product,brief){
  const tokenSet=new Set(words(brief)),topics=semanticTopics(brief),traits=personality(domain,tokenSet),navigation=navItems(domain,product,topics,tokenSet),g=domain.genome,grammar=domainGrammar(domain,tokenSet);
  const pageHierarchy=navigation.map((x,index)=>({...x,rank:index+1}));
  return {
    schema:'webforge.design-strategy.v1',
    audience:{segments:uniq(g.audience),primary:g.audience[0]||'general',context:g.applicationDepth>=3?'returning-and-task-oriented':'browse-and-decide'},
    business_goal:businessGoal(domain,product),
    primary_jobs:product.userJobs.map(x=>({id:x.id,goal:x.goal,needs:x.needs})),
    content_model:{modes:uniq(g.content),entities:product.entities.map(x=>x.name),updateCadence:product.capabilityIds.includes('content.cms')?'frequent':'bounded'},
    brand_personality:{traits,voice:g.trustBurden==='high'||g.trustBurden==='critical'?'explicit-and-reassuring':g.applicationDepth>=3?'direct-and-precise':'confident-and-distinct'},
    information_complexity:{level:g.applicationDepth>=3?'high':product.capabilityIds.length>=10?'medium-high':product.capabilityIds.length>=7?'medium':'low',applicationDepth:g.applicationDepth,dataDepth:g.dataDepth,capabilityCount:product.capabilityIds.length},
    navigation_model:{pattern:grammar?.nav||(domain.primary.id==='editorial-publication'?'editorial-nav':domain.primary.id==='creative-practice'?'portfolio-nav':g.applicationDepth>=3?'product-nav':g.mediaIntensity>=80?'experience-nav':'task-nav'),maxPrimary:8,items:navigation},
    page_hierarchy:pageHierarchy,
    layout_strategy:layoutStrategy(domain,product,traits,tokenSet),
    visual_density:grammar?.density||(domain.primary.id==='editorial-publication'?'balanced':g.applicationDepth>=3?'dense':g.mediaIntensity>=80?'spacious':g.content.includes('structured')?'balanced':'airy'),
    color_strategy:colorStrategy(domain,traits,tokenSet),
    typography_strategy:{character:grammar?.type||(domain.primary.id==='editorial-publication'?'editorial-display':g.applicationDepth>=3?'functional-grotesk':traits.includes('premium')?'editorial-display':g.visualMode==='cinematic'?'expressive-display':'modern-grotesk'),contrast:grammar||domain.primary.id==='editorial-publication'||traits.includes('premium')||g.visualMode==='cinematic'?'high':'moderate'},
    media_strategy:{intensity:g.mediaIntensity,role:g.mediaIntensity>=80?'primary-storytelling':g.mediaIntensity>=50?'supporting-proof':'selective-support',treatment:domain.classification==='NOVEL'&&domain.synthesis?.direction?.mediaTreatment?domain.synthesis.direction.mediaTreatment:g.visualMode==='cinematic'?'atmospheric':traits.includes('premium')?'art-directed':'contextual'},
    interaction_strategy:{depth:g.applicationDepth,mode:grammar?.interaction||(domain.primary.id==='editorial-publication'?'browse-and-read':g.applicationDepth>=3?'task-oriented':g.conversionIntensity>=70?'decision-oriented':'progressive'),motion:g.visualMode==='cinematic'?'expressive':domain.primary.id==='editorial-publication'?'subtle':g.applicationDepth>=3?'functional':'subtle'},
    conversion_strategy:{intensity:g.conversionIntensity,primaryAction:businessGoal(domain,product),pattern:cap(new Set(product.capabilityIds),'conversion.booking','conversion.tickets')?'high-visibility-action':g.applicationDepth>=3?'activation-path':'progressive-cta'},
    provenance:{domain:domain.primary.id,classification:domain.classification,capabilities:product.capabilityIds.length,topicSignals:topics.map(x=>x.id)}
  };
}
