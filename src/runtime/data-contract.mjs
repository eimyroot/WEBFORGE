export const DETAIL_KINDS=Object.freeze(['product','property','job','course','article','event','profile']);

export const DETAIL_FIELD_HINTS=Object.freeze({
  product:['price','availability','sku','category'],
  property:['price','address','availability','area'],
  job:['compensation','location','workMode','deadline'],
  course:['schedule','fees','admissions','duration'],
  article:['publishedAt','author','topic','readingTime'],
  event:['startsAt','venue','ticketAvailability','endsAt'],
  profile:['role','credentials','location','availability']
});

const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.trim().length>0;
const slug=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{0,127}$/.test(v);
const safeKey=k=>!/(password|secret|token|api[-_]?key|credential)/i.test(k);
function jsonSafe(v,depth=0){
  if(depth>6)return false;
  if(v===null||['string','number','boolean'].includes(typeof v))return true;
  if(Array.isArray(v))return v.every(x=>jsonSafe(x,depth+1));
  if(object(v))return Object.entries(v).every(([k,x])=>safeKey(k)&&jsonSafe(x,depth+1));
  return false;
}
export function validateDetailRecord(record,expectedKind=null){
  const errors=[];
  if(!object(record))errors.push('record:not-object');
  if(errors.length)return {schema:'webforge.runtime-data-validation.v1',status:'FAIL',errors};
  if(!DETAIL_KINDS.includes(record.kind))errors.push('kind:unsupported');
  if(expectedKind&&record.kind!==expectedKind)errors.push(`kind:expected-${expectedKind}`);
  if(!text(record.id))errors.push('id:required');
  if(!slug(record.slug))errors.push('slug:invalid');
  if(!text(record.title))errors.push('title:required');
  if(!text(record.summary))errors.push('summary:required');
  if(!object(record.source))errors.push('source:required');
  else{
    if(!text(record.source.provider))errors.push('source.provider:required');
    if(!text(record.source.recordId))errors.push('source.recordId:required');
    if(record.source.classification!=='public-content')errors.push('source.classification:public-content-required');
    if(!text(record.source.provenance))errors.push('source.provenance:required');
  }
  if(!object(record.fields))errors.push('fields:object-required');
  else if(!jsonSafe(record.fields))errors.push('fields:unsafe-or-non-json');
  return {schema:'webforge.runtime-data-validation.v1',status:errors.length?'FAIL':'PASS',errors};
}
export function runtimeDataContract(runtime='portable'){
  const boundaries=runtime==='next'
    ?{loading:'route-ui',notFound:'route-ui',error:'route-ui',dynamicResolution:'request-time'}
    :runtime==='astro'
      ?{loading:'NOT_APPLICABLE_STATIC_BUILD',notFound:'404-page',error:'FAIL_CLOSED_BUILD',dynamicResolution:'getStaticPaths'}
      :{loading:'UNVERIFIED',notFound:'UNVERIFIED',error:'UNVERIFIED',dynamicResolution:'UNSUPPORTED'};
  return {
    schema:'webforge.runtime-data-contract.v1',
    lifecycle:'beta',owner:'WEBFORGE runtime',visibility:'internal-generated',
    classification:'public-content-only',
    record:{required:['id','slug','kind','title','summary','source','fields'],detailKinds:DETAIL_FIELD_HINTS},
    source:{required:['provider','recordId','classification','provenance'],classification:'public-content'},
    provider:{methods:{list:'async (kind, context?) => record[]',get:'async (kind, slug, context?) => record|null'},sideEffects:'read-only; no mutation',network:'explicit opt-in by provider implementation',credentials:'runtime secret store only; never serialize into records or evidence',retries:'none-by-default'},
    errors:['WEBFORGE_PROVIDER_INVALID','WEBFORGE_PROVIDER_UNAVAILABLE','WEBFORGE_DATA_CONTRACT_INVALID'],
    recordForbidden:['credentials','secrets','authentication tokens'],
    forbidden:['implicit network provider activation'],
    boundaries
  };
}
