export const GUNS = [
 {id:'glock',name:'Glock',price:0,capacity:17,damage:25,interval:.24,automatic:false},
 {id:'smg',name:'Block SMG',price:650,capacity:30,damage:16,interval:.085,automatic:true},
 {id:'rifle',name:'Street Carbine',price:1100,capacity:24,damage:40,interval:.15,automatic:false}
] as const;
export const CARS=[{id:'compact',name:'Compact',price:0,speed:18,color:0xf0b653},{id:'coupe',name:'Sport Coupe',price:950,speed:27,color:0x5ca8ad},{id:'muscle',name:'Muscle',price:1400,speed:33,color:0xa266b8}] as const;
export type Save={cash:number;guns:string[];gun:string;cars:string[];car:string;ammo:number;avatar:number};
export const freshSave=():Save=>({cash:500,guns:['glock'],gun:'glock',cars:['compact'],car:'compact',ammo:136,avatar:1});
export function restoreSave(raw:string|null):Save{try{const p=JSON.parse(raw||'null');if(!p)return freshSave();const guns=GUNS.filter(g=>p.guns?.includes(g.id)).map(g=>g.id) as string[];const cars=CARS.filter(c=>p.cars?.includes(c.id)).map(c=>c.id) as string[];if(!guns.includes('glock'))guns.push('glock');if(!cars.includes('compact'))cars.push('compact');return{cash:Math.max(0,Math.min(1000000,Math.floor(Number(p.cash)||0))),guns,gun:guns.includes(p.gun)?p.gun:'glock',cars,car:cars.includes(p.car)?p.car:'compact',ammo:Math.max(0,Math.min(999,Math.floor(Number(p.ammo)||0))),avatar:Math.max(1,Math.min(1000,Math.floor(Number(p.avatar)||1)))}}catch{return freshSave()}}
export function purchase(save:Save,kind:'gun'|'car',id:string):{ok:boolean;message:string}{const item=kind==='gun'?GUNS.find(x=>x.id===id):CARS.find(x=>x.id===id);if(!item)return{ok:false,message:'Unknown item'};const owned=kind==='gun'?save.guns:save.cars;if(!owned.includes(id)){if(save.cash<item.price)return{ok:false,message:'Not enough cash'};save.cash-=item.price;owned.push(id)}if(kind==='gun')save.gun=id;else save.car=id;return{ok:true,message:`${item.name} equipped`}}
export function intersects(x:number,z:number,r:number,boxes:{x:number;z:number;w:number;d:number}[]){return boxes.some(b=>x+r>b.x-b.w/2&&x-r<b.x+b.w/2&&z+r>b.z-b.d/2&&z-r<b.z+b.d/2)}
