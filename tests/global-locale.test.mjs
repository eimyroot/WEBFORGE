import test from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/core/compose.mjs';
import { renderWebsite, renderBlueprintPage } from '../src/core/visual-renderer.mjs';

const cases=[
  ['hotel','Boutique hotel v Praze s pokoji, wellness, restaurací, lokálním průvodcem a přímou rezervací.'],
  ['saas','Český B2B SaaS pro správu projektů s dashboardem, integracemi, bezpečností, ceníkem a firemním demem.'],
  ['industrial','Výrobce průmyslové robotiky s technickými parametry, odvětvími, případovými studiemi, servisem a poptávkou.'],
  ['restaurant','Městská restaurace se sezónním menu, rezervacemi, soukromým stolováním, příběhem kuchyně a galerií.'],
  ['professional','Advokátní kancelář v Praze s oblastmi praxe, odborníky, přehledy, pobočkami a kontaktem.'],
  ['commerce','Český internetový obchod s elektronikou, kategoriemi, srovnáním, recenzemi, dopravou a podporou.'],
  ['novel','Interaktivní digitální archiv rodinných předmětů, kde lidé přidávají vzpomínky a sledují příběh předmětu napříč generacemi.']
];
const bannedVisible=/>\s*(Home|About|Contact|Pricing|Location|Booking|Rooms|Product|Security|Services|Capabilities|Industries|Case Studies|Support|Request Quote|Programmes|Programs|Admissions|Campus|Jobs|Companies|Career Advice|For Employers|Membership|Directory|Resources|Shop|Categories|Featured|Compare|Reviews|Help|Browse|Sell|Trust|How It Works|Integrations|Private Dining|Practice Areas|Professionals|Offices)\s*</i;
const bannedUi=/(View all|View full gallery|Get directions|TRUTH BOUNDARY|Form state contract|Collection state contract|Choose plan|DECISION READY|PRODUCT EXPERIENCE|INDEPENDENT PUBLICATION|LATEST EDITION)/i;
const czechSignal=/[ěščřžýáíéůúďťň]|\b(další|vyberte|prozkoumat|přehled|služby|produkt|rezervace|nabídka|důkazy|lidé|obsah|vstupte|rezervovat)\b/i;
test('cs-CZ propagates through blueprint navigation and content across domains',()=>{
  for(const [id,brief] of cases){
    const plan=compose(brief);
    assert.equal(plan.project.locale?.tag,'cs-CZ',`${id}: locale`);
    assert.ok(plan.siteBlueprint.pages.length>1,`${id}: pages`);
    for(const page of plan.siteBlueprint.pages)assert.doesNotMatch(page.title,bannedVisible,`${id}:${page.path}: blueprint title`);
    for(const item of plan.designStrategy.navigation_model.items)assert.doesNotMatch(item.label,bannedVisible,`${id}:${item.path}: nav label`);
    assert.match(plan.visual.content.model.hero?.headline||'',czechSignal,`${id}: hero headline`);
    assert.match(plan.visual.content.model.hero?.primary||'',czechSignal,`${id}: hero CTA`);
  }
});

test('every generated static cs-CZ page stays localized at the public render boundary',()=>{
  for(const [id,brief] of cases){
    const plan=compose(brief), visual=plan.visual;
    const pages=[{id:'home',path:'/',title:'Domů',family:'home',sectionHints:[]}].concat(plan.siteBlueprint.pages.filter(p=>!p.dynamic&&p.path!=='/'));
    for(const page of pages){
      const html=page.path==='/'?renderWebsite(plan,visual,`locale-${id}`):renderBlueprintPage(plan,visual,page);
      assert.match(html,/<html lang="cs-CZ"/,`${id}:${page.path}: html lang`);
      assert.doesNotMatch(html,bannedVisible,`${id}:${page.path}: visible English page/UI label`);
      assert.doesNotMatch(html,bannedUi,`${id}:${page.path}: hardcoded renderer English`);
    }
  }
});


test('cs-CZ novel synthesis preserves display-language diacritics and Czech interaction copy',()=>{
  const plan=compose(cases.at(-1)[1]);
  assert.match(plan.domain.synthesis.subject,/[íěščřžýáéůúďťň]/i);
  assert.doesNotMatch(plan.domain.synthesis.copy.eyebrow,/EDITORIAL|IMMERSIVE|SYSTEM|DISCOVERY|COMMUNITY|EVIDENCE|ACTION/i);
  for(const job of plan.domain.synthesis.jobs){
    assert.doesNotMatch(job.goal,/\b(Understand|Explore|Learn|Browse|Continue)\b/i);
    assert.ok(job.needs.every(x=>!/^clear next state$/i.test(x)));
  }
});

test('cs-CZ preserves primary domain semantics and novel display labels',()=>{
  const hotel=compose('Boutique hotel v Praze s pokoji, wellness, restaurací, lokálním průvodcem a přímou rezervací.');
  assert.equal(hotel.project.domainArchetype,'hospitality');
  assert.match(hotel.visual.content.model.hero.headline,/Pobyt/i);
  assert.doesNotMatch(hotel.visual.content.model.hero.headline,/Jídlo/i);
  const novel=compose('Interaktivní digitální archiv rodinných předmětů, kde lidé přidávají vzpomínky a sledují příběh předmětu napříč generacemi.');
  const page=novel.siteBlueprint.pages.find(p=>p.id==='interaktivni-digitalni-archiv');
  assert.equal(page?.title,'Interaktivní Digitální Archiv');
  assert.match(page?.purpose||'',/vychází přímo ze zadání/i);
});
