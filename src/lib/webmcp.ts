import {accrue,harvest,upgrade,type Farm} from './farm';
import {tick} from 'svelte';
/** Optional page tools operate on the same demo state; never submit wallet transactions. */
export function registerDemoTools(get:()=>Farm,set:(farm:Farm)=>void){
 const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:unknown)=>unknown}}).modelContext;
 if(!context)return()=>{};
 const lifecycle=new AbortController();
 for(const action of ['read','harvest','upgrade'] as const){
  try{Promise.resolve(context.registerTool({name:`${action}_farm`,description:`${action} the device-local demo farm. No wallet transactions or real tokens.`,inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:action==='read'},async execute(input:unknown){
   if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object');
   const farm=get();const result=action==='read'?accrue(farm,Date.now()):action==='harvest'?harvest(farm,Date.now()):upgrade(farm,Date.now());
   if(action==='upgrade'&&result.level===farm.level)throw new Error('Upgrade unavailable');
   if(action!=='read'){set(result);await tick()}return result;
  }},{signal:lifecycle.signal})).catch(()=>{})}catch{}
 }
 return()=>lifecycle.abort();
}
