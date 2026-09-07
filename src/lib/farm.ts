export const UPGRADES = [
 {name:'More to grow', type:'Terraced fields', cost:20, rate:12, cap:40, description:'Open a second patch of golden wheat.'},
 {name:'Let it flow', type:'Irrigation', cost:45, rate:24, cap:80, description:'Fresh water keeps your fields thriving.'},
 {name:'Catch the breeze', type:'Windmill', cost:90, rate:48, cap:160, description:'Turn the island breeze into a bigger harvest.'}
];
export type Farm = {balance:number; stored:number; updated:number; level:number};
export const rate = (level:number) => [6,12,24,48][level];
export const capacity = (level:number) => [20,40,80,160][level];
export function accrue(f:Farm, now:number):Farm {return {...f,stored:Math.min(capacity(f.level),f.stored+Math.max(0,now-f.updated)/60000*rate(f.level)),updated:Math.max(now,f.updated)}}
export function harvest(f:Farm, now:number):Farm {const a=accrue(f,now);const n=Math.floor(a.stored);return {...a,balance:a.balance+n,stored:a.stored-n}}
export function upgrade(f:Farm, now:number):Farm {const a=accrue(f,now);const u=UPGRADES[a.level];return u&&a.balance>=u.cost?{...a,balance:a.balance-u.cost,level:a.level+1}:a}
