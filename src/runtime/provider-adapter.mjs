import {DETAIL_KINDS} from './data-contract.mjs';

const slug=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{0,127}$/.test(v);

export function createProviderAdapter(adapter){
  if(!adapter||typeof adapter!=='object')throw new Error('WEBFORGE_PROVIDER_INVALID');
  if(typeof adapter.list!=='function'||typeof adapter.get!=='function')throw new Error('WEBFORGE_PROVIDER_INVALID');
  return Object.freeze({
    name:String(adapter.name||'custom-provider'),
    list:async(kind,context={})=>{
      if(!DETAIL_KINDS.includes(kind))return [];
      const rows=await adapter.list(kind,context);
      if(!Array.isArray(rows))throw new Error('WEBFORGE_PROVIDER_INVALID');
      return rows;
    },
    get:async(kind,value,context={})=>{
      if(!DETAIL_KINDS.includes(kind)||!slug(value))return null;
      return await adapter.get(kind,value,context);
    }
  });
}
