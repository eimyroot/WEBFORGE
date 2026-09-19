import records from './records.mjs';
import {validateDetailRecord} from './data-contract.mjs';
import {createProviderAdapter} from './provider-adapter.mjs';
export {createProviderAdapter} from './provider-adapter.mjs';

const localProvider=createProviderAdapter({
  name:'webforge-local-records',
  list:async kind=>records[kind]||[],
  get:async(kind,value)=>(records[kind]||[]).find(row=>row.slug===value)||null
});

export async function listValidated(kind,context={}){
  const rows=await provider.list(kind,context);
  return rows.map(row=>{
    const check=validateDetailRecord(row,kind);
    if(check.status!=='PASS')throw new Error(`WEBFORGE_DATA_CONTRACT_INVALID:${check.errors.join(',')}`);
    return row;
  });
}

export async function getValidated(kind,value,context={}){
  const row=await provider.get(kind,value,context);
  if(!row)return null;
  const check=validateDetailRecord(row,kind);
  if(check.status!=='PASS')throw new Error(`WEBFORGE_DATA_CONTRACT_INVALID:${check.errors.join(',')}`);
  return row;
}

export const provider=localProvider;
export default provider;
