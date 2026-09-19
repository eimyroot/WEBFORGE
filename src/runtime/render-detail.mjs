const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const value=v=>Array.isArray(v)?v.join(', '):v&&typeof v==='object'?JSON.stringify(v):String(v??'');
const labels={product:'Product detail',property:'Property detail',job:'Role detail',course:'Course detail',article:'Article detail',event:'Event detail',profile:'Profile detail'};

export function renderDetailRecord(record){
  const fields=Object.entries(record.fields||{}).map(([key,val],i)=>`<article><span class="card-no">${String(i+1).padStart(2,'0')}</span><h3>${esc(key.replaceAll(/[-_]/g,' '))}</h3><p>${esc(value(val))}</p></article>`).join('');
  const source=record.source||{};
  return `<main class="runtime-detail runtime-detail-${esc(record.kind)}" data-runtime-detail-kind="${esc(record.kind)}">
<section class="page-intro page-intro-evidence"><div class="page-intro-copy"><span class="kicker">${esc(labels[record.kind]||'Detail')}</span><h1>${esc(record.title)}</h1><p>${esc(record.summary)}</p></div><aside class="page-intro-aside"><span>SOURCE</span><strong>${esc(source.provider||'unknown')}</strong><p>${esc(source.provenance||'Source provenance required.')}</p></aside></section>
<section class="vc-section card-section"><div class="section-heading"><span class="kicker">VERIFIED DATA</span><h2>Source-backed detail fields.</h2></div><div class="pro-card-grid">${fields||'<article><h3>No optional fields</h3><p>The provider returned no additional public fields.</p></article>'}</div></section>
</main>`;
}
