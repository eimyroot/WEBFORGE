const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

function has(caps,id){return caps.includes(id)}
function words(s=''){return s.toLowerCase()}

export function resolveCommercial(project,capabilities,layout){
  const b=words(project.brief);
  const factors={
    informationArchitecture: 8 + Math.min(14, Math.max(0,(layout.sections?.length||5)-5)*2),
    designAmbition: /premium|luxury|cinematic|editorial|custom|unique|art|brutalist/.test(b)?16:10,
    content: has(capabilities,'content.cms')?12:7,
    localization: /multilingual|multi-language|2 languages|two languages|bilingual|češtin|angličtin|german|deutsch/.test(b)?8:0,
    integrations: /integration|api|crm|booking|calendar|payment|stripe|mailchimp|hubspot/.test(b)?10:0,
    application: ['saas','marketplace','web-app'].includes(project.archetype)?16:0,
    commerce: /shop|ecommerce|e-commerce|checkout|cart|payment|marketplace/.test(b)?12:0,
    growth: /seo|analytics|conversion|ppc|campaign|marketing|lead/.test(b)?8:3,
    motion: /animation|motion|cinematic|3d|interactive/.test(b)?7:0,
    migration: /migration|migrate|redesign|existing site|wordpress/.test(b)?7:0
  };
  const raw=Object.values(factors).reduce((a,n)=>a+n,0);
  const score=clamp(Math.round(raw),12,100);
  let tier='BUILD';
  if(score>=76) tier='CUSTOM'; else if(score>=52) tier='PERFORM'; else if(score>=30) tier='GROW';
  const ranges={BUILD:[28000,44000],GROW:[45000,69000],PERFORM:[70000,110000],CUSTOM:[110000,null]};
  const [low,high]=ranges[tier];
  const risk=score>=76?'HIGH':score>=52?'MEDIUM':'LOW';
  const confidence=clamp(98-Math.round(score/8)-(risk==='HIGH'?5:0),72,96);
  const includes=[
    'Custom composition','Responsive design system','Accessibility baseline','Performance QA','Full source ownership'
  ];
  if(score>=30) includes.push('Conversion architecture','Analytics plan','SEO structure');
  if(has(capabilities,'content.cms')) includes.push('Structured content / CMS plan');
  if(score>=52) includes.push('Audience & competitor intelligence','Advanced UX strategy','Evidence-backed release');
  if(score>=76) includes.push('Custom integrations & governed delivery');
  return {
    model:'webforge-commercial.v1',tier,complexity:score,deliveryRisk:risk,deliveryConfidence:confidence,
    estimate:{currency:'CZK',low,high,mode:high?'range':'from',nonBinding:true},
    factors,includes,
    ownership:['source code','design system','content','assets','configuration','deployment manifest','decision evidence','portable export'],
    promise:'No WEBFORGE lock-in',
    rationale:[
      `${layout.sections.length} resolved sections`,
      `${project.archetype} delivery profile`,
      has(capabilities,'content.cms')?'structured content required':'lightweight content model',
      risk==='LOW'?'low implementation risk':`${risk.toLowerCase()} implementation risk`
    ]
  };
}
