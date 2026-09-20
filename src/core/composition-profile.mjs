const uniq=xs=>[...new Set(xs.filter(Boolean))];
const has=(set,...ids)=>ids.some(id=>set.has(id));

function visualCharacter(domain,strategy){
  const g=domain.genome||{};
  return {
    mediaPriority:g.mediaIntensity>=80?'primary':g.mediaIntensity>=55?'supporting':'selective',
    density:strategy?.visual_density||'balanced',
    proofTiming:strategy?.layout_strategy?.proofPlacement||'contextual',
    interaction:strategy?.interaction_strategy?.mode||'progressive',
    hero:strategy?.layout_strategy?.hero||'value-led'
  };
}

function makeProfile(domain,strategy,id,{family,sections,flow,rationale=[]}){
  return {
    schema:'webforge.composition-profile.v1',
    siteArchetype:id,
    family,
    homepageSections:uniq(sections),
    conversionFlow:uniq(flow),
    visualCharacter:visualCharacter(domain,strategy),
    rationale:[`domain:${domain.primary.id}`,`base:${domain.primary.baseArchetype}`,`goal:${strategy?.business_goal||'inform-and-convert'}`,...rationale]
  };
}

export function compileCompositionProfile(domain,product,brief,strategy={}){
  const id=domain.primary.id, base=domain.primary.baseArchetype, g=domain.genome||{};
  const caps=new Set(product.capabilityIds||[]), text=String(brief||'').toLowerCase();
  const local=has(caps,'geo.location','seo.local'), booking=has(caps,'conversion.booking','booking.availability');
  const proof=g.trustBurden==='high'||g.trustBurden==='critical'||has(caps,'trust.reviews','trust.certifications');

  if(id==='florist-retail') return makeProfile(domain,strategy,'florist-commerce',{
    family:'showcase-commerce',
    sections:['categories','featured','services','gallery','process','latest-content',local&&'location','faq'],
    flow:['occasion','bouquet','personalize','delivery'],
    rationale:['occasion-led-merchandising','seasonal-media-primary']
  });

  if(id==='hospitality'){
    const restaurantOnly=/(restaurant|dining|chef|menu|restaurace|bistro|jídel|jidel)/i.test(text)&&!/(hotel|resort|hostel|room|rooms|suite|suites|pokoj|ubytov)/i.test(text);
    if(restaurantOnly) return makeProfile(domain,strategy,'hospitality-dining',{
      family:'culinary-experience',
      sections:['services','featured','gallery',booking&&'booking','experience',local&&'location','faq'],
      flow:['menu','atmosphere','reserve'],
      rationale:['menu-led-decision','atmosphere-before-reservation']
    });
    return makeProfile(domain,strategy,'hospitality-stay',{
      family:'stay-experience',
      sections:['availability','gallery','services','proof',booking&&'booking',local&&'location','faq'],
      flow:['explore-stay','check-availability','compare-options','book'],
      rationale:['availability-early','property-media-primary']
    });
  }

  if(id==='venue-entertainment'||base==='venue'){
    const immersive=/(cinematic|immersive|gallery|visual|atmosphere|photo)/i.test(text);
    const artistLed=/(dj|artist|lineup|performer|band|music)/i.test(text);
    const scheduleLed=/(weekly|schedule|program|programme|calendar|events?)/i.test(text);
    return makeProfile(domain,strategy,'event-experience',{
      family:'event-experience',
      sections:['next-event',scheduleLed&&'latest-content',artistLed&&'artists',immersive&&'gallery',immersive&&'experience',scheduleLed&&'schedule','proof','faq'],
      flow:['discover-event',artistLed?'evaluate-lineup':'check-programme','get-ticket'],
      rationale:['event-led-opening',immersive?'atmosphere-led':'programme-led','time-sensitive-conversion']
    });
  }

  if(id==='education-learning') return makeProfile(domain,strategy,'academic-discovery',{
    family:'academic',
    sections:['categories','featured','process','gallery','latest-content','proof','faq'],
    flow:['explore-programme','check-admissions','see-campus','apply'],
    rationale:['programme-led','admissions-before-application']
  });

  if(id==='jobs-careers') return makeProfile(domain,strategy,'career-marketplace',{
    family:'career-discovery',
    sections:['categories','featured','team','latest-content','services','proof','faq'],
    flow:['search-role','evaluate-employer','prepare-application','apply'],
    rationale:['vacancy-led','candidate-and-employer-paths-separated']
  });

  if(id==='industrial-b2b') return makeProfile(domain,strategy,'technical-evaluation',{
    family:'technical',
    sections:['services','categories','featured','outcomes','case-study','process','faq'],
    flow:['specify-need','evaluate-capability','review-evidence','request-quote'],
    rationale:['specification-before-rfq','technical-proof-primary']
  });

  if(id==='finance'){
    const application=g.applicationDepth>=3||has(caps,'dashboard.user','identity.account')||/(fintech|banking app|digital bank|payments app)/i.test(text);
    if(application) return makeProfile(domain,strategy,'financial-application',{
      family:'product',
      sections:['product-proof','task-preview','workflow','security','proof','faq'],
      flow:['understand-product','inspect-account','verify-security','activate'],
      rationale:['account-task-before-marketing','security-before-activation']
    });
    return makeProfile(domain,strategy,'financial-advisory',{
      family:'authority-service',
      sections:['services','process','proof','security','latest-content',booking&&'booking','faq'],
      flow:['identify-need','understand-process','verify-controls','consult'],
      rationale:['trust-before-consultation','security-visible']
    });
  }

  if(id==='civic-government') return makeProfile(domain,strategy,'civic-service-workflow',{
    family:'service-application',
    sections:['task-preview','services','process',local&&'location','proof','faq'],
    flow:['understand-service','submit-request','track-status','resolve'],
    rationale:['task-before-institution','submission-and-status-visible']
  });

  if(id==='nonprofit-impact') return makeProfile(domain,strategy,'impact-fundraising',{
    family:'impact',
    sections:['outcomes','featured','process','proof','latest-content','faq'],
    flow:['understand-cause','review-impact','see-programmes','support'],
    rationale:['impact-before-ask','evidence-before-support']
  });

  if(id==='community-membership') return makeProfile(domain,strategy,'membership-community',{
    family:'community',
    sections:['services','next-event','team','latest-content','feature-grid','pricing','faq'],
    flow:['understand-membership','see-community','join-event','join'],
    rationale:['people-and-events-before-join','membership-benefits-visible']
  });

  if(id==='healthcare') return makeProfile(domain,strategy,'care-service',{
    family:'authority-service',
    sections:['services','team','process','proof',booking&&'booking',local&&'location','faq'],
    flow:['identify-care','evaluate-provider','understand-visit','book'],
    rationale:['care-path-before-booking','trust-and-provider-context']
  });

  if(id==='real-estate') return makeProfile(domain,strategy,'property-discovery',{
    family:'property-discovery',
    sections:['categories','featured','latest-content','team',booking&&'booking',local&&'location','proof','faq'],
    flow:['browse-property','understand-place','evaluate-agent','book-viewing'],
    rationale:['property-and-place-led','viewing-after-context']
  });

  if(['software-product','web-application'].includes(id)||base==='saas'){
    const realtime=has(caps,'data.realtime')||/(live status|real-time|realtime|monitoring|alerts)/i.test(text);
    const docs=has(caps,'content.documentation')||/(documentation|docs|developer)/i.test(text);
    return makeProfile(domain,strategy,'product-application',{
      family:'product',
      sections:['product-proof','task-preview',!realtime&&'feature-grid','workflow','integrations',docs&&'latest-content','proof','security','pricing','faq'],
      flow:['understand-product','see-core-task',realtime?'inspect-live-state':'compare-capabilities','evaluate-proof','activate'],
      rationale:['task-before-marketing-grid',realtime?'operations-state-visible':'capability-comparison',docs?'documentation-visible':'documentation-secondary','proof-before-commercial-action']
    });
  }

  if(id==='local-professional-service'||base==='local-service'){
    const authority=/(law|legal|lawyer|attorney|advok|práv|pravni|účet|ucet|account|consult|advisory|poraden)/i.test(text)||g.trustBurden==='high'||g.trustBurden==='critical';
    if(authority) return makeProfile(domain,strategy,'authority-service',{
      family:'authority-service',
      sections:['services','team','proof','process','latest-content',booking&&'booking',local&&'location','faq'],
      flow:['identify-matter','evaluate-expertise','review-evidence',booking?'book-consultation':'contact'],
      rationale:['expertise-attributable','evidence-before-contact']
    });
    if(booking) return makeProfile(domain,strategy,'appointment-service',{
      family:'appointment-service',
      sections:['services','proof','booking','process',local&&'location','faq'],
      flow:['identify-service','check-trust','choose-slot','confirm'],
      rationale:['service-before-slot','booking-is-primary-action']
    });
    return makeProfile(domain,strategy,'local-service-evidence',{
      family:'local-service',
      sections:['services','proof','process','gallery',local&&'location','faq'],
      flow:['understand-service','review-proof','contact'],
      rationale:['local-proof','low-friction-contact']
    });
  }

  if(id==='commerce-store'||base==='marketplace') return makeProfile(domain,strategy,'merchandising-commerce',{
    family:'commerce',
    sections:['categories','featured',has(caps,'discovery.filter','product.configuration')&&'comparison',has(caps,'trust.reviews')&&'testimonials',g.mediaIntensity>=60&&'gallery','trust-safety','faq'],
    flow:['browse','compare','trust','buy'],
    rationale:['catalog-led','decision-support-before-checkout']
  });

  if(id==='digital-experience') return makeProfile(domain,strategy,'immersive-experience',{
    family:'immersive-experience',
    sections:['experience','gallery','featured','statement','about','faq'],
    flow:['enter-story','explore-scenes','inspect-artifacts',booking?'book-visit':'continue-exploring'],
    rationale:['experience-before-explanation','media-and-artifacts-primary']
  });

  if(id==='creative-practice'||base==='portfolio') return makeProfile(domain,strategy,'media-showcase',{
    family:'portfolio',
    sections:['selected-work','gallery','case-study','statement','about','proof'],
    flow:['see-work','understand-approach','review-proof','contact'],
    rationale:['work-before-biography','media-primary']
  });

  if(id==='editorial-publication'||base==='editorial') return makeProfile(domain,strategy,'editorial-publication',{
    family:'editorial',
    sections:['latest-content','categories','featured','newsletter','proof'],
    flow:['read-lead','browse-topic','subscribe'],
    rationale:['content-first','return-visit-loop']
  });

  if(strategy?.layout_strategy?.primary==='corporate-system') return makeProfile(domain,strategy,'corporate-showcase',{
    family:'authority',
    sections:['services','selected-work','process','team',has(caps,'trust.reviews')&&'testimonials','latest-content','proof','faq'],
    flow:['understand-capability','see-work','meet-team','review-proof','contact'],
    rationale:['work-and-proof-before-contact','corporate-specialized-renderers']
  });

  if(proof) return makeProfile(domain,strategy,'evidence-led-organization',{
    family:'evidence-led',
    sections:['proof','services','process','outcomes','team','faq'],
    flow:['understand','verify','decide','contact'],
    rationale:['trust-burden-elevates-proof']
  });

  return makeProfile(domain,strategy,'narrative-organization',{
    family:'narrative',
    sections:['services','outcomes','process',g.mediaIntensity>=65&&'gallery','proof','about','faq'],
    flow:['understand','see-value','see-process','contact'],
    rationale:['simple-purpose-led-default']
  });
}
