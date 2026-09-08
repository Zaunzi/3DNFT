export const PARCELS = [
 {name:'Small',area:'24 × 18.5 m',min:1000,max:2000,supply:500,pumps:1},
 {name:'Medium',area:'41.6 × 32 m',min:2500,max:5000,supply:300,pumps:2},
 {name:'Large',area:'58.8 × 45.3 m',min:6000,max:10000,supply:200,pumps:3}
] as const;
export const DEMO_DURATION=5*60*1000;
export type OilReserve={allocation:number;harvested:number;checkpoint?:number;work?:number;level?:number};
export type OilDemo={version:1;genesis:number;balance:number;levels?:number[];reserves:Record<string,OilReserve>};
export const seasonAt=(genesis:number,now:number,duration=DEMO_DURATION)=>Math.max(1,Math.floor((now-genesis)/duration)+1);
export function available(reserve:OilReserve|undefined,genesis:number,season:number,now:number,duration=DEMO_DURATION){if(!reserve)return 0;const work=Math.min(duration*4,(reserve.work??0)+Math.max(0,now-(reserve.checkpoint??(genesis+(season-1)*duration)))*(4+(reserve.level??0)));return Math.max(0,reserve.allocation*work/(duration*4)-reserve.harvested)}
export function surveyDemo(book:OilDemo,size:number,season:number,draw:number,now:number):OilDemo{
 if(!PARCELS[size]||season!==seasonAt(book.genesis,now))throw new Error('Survey the current season.');
 const key=`${size}:${season}`;if(book.reserves[key])throw new Error('This parcel has already been surveyed this season.');
 if(!Number.isInteger(draw)||draw<PARCELS[size].min||draw>PARCELS[size].max)throw new Error('Invalid reserve allocation.');
 return {...book,reserves:{...book.reserves,[key]:{allocation:draw,harvested:0,level:book.levels?.[size]??0}}};
}
export function harvestDemo(book:OilDemo,size:number,season:number,now:number):OilDemo{const key=`${size}:${season}`;const reserve=book.reserves[key];if(!reserve)throw new Error('Survey this parcel first.');const amount=available(reserve,book.genesis,season,now);return {...book,balance:book.balance+amount,reserves:{...book.reserves,[key]:{...reserve,harvested:reserve.harvested+amount}}}}
export function drawDemo(size:number){const parcel=PARCELS[size];const range=parcel.max-parcel.min+1;const limit=Math.floor(2**32/range)*range;const data=new Uint32Array(1);do{crypto.getRandomValues(data)}while(data[0]>=limit);return parcel.min+data[0]%range}
export function validBook(book:unknown):book is OilDemo{const b=book as OilDemo;if(!b||b.version!==1||!Number.isFinite(b.genesis)||b.genesis<=0||!Number.isFinite(b.balance)||b.balance<0||!b.reserves||typeof b.reserves!=='object')return false;if(b.levels&&(!Array.isArray(b.levels)||b.levels.length!==3||!b.levels.every(l=>Number.isInteger(l)&&l>=0&&l<=3)))return false;return Object.entries(b.reserves).every(([key,r])=>{const [size,season]=key.split(':').map(Number);const p=PARCELS[size];return !!p&&(r.level===undefined||(Number.isInteger(r.level)&&r.level>=0&&r.level<=3))&&(r.work===undefined||(Number.isFinite(r.work)&&r.work>=0&&r.work<=DEMO_DURATION*4))&&(r.checkpoint===undefined||(Number.isFinite(r.checkpoint)&&r.checkpoint>=b.genesis))&&Number.isInteger(season)&&season>0&&Number.isFinite(r.allocation)&&r.allocation>=p.min&&r.allocation<=p.max&&Number.isFinite(r.harvested)&&r.harvested>=0&&r.harvested<=r.allocation})}

export const upgradePrice=(size:number,level:number)=>level>=3?0:250*(level+1)**2*(size+1);
export function upgradeDemo(book:OilDemo,size:number,now:number):OilDemo {
 const levels=[...(book.levels??[0,0,0])];const level=levels[size];const cost=upgradePrice(size,level);
 if(!PARCELS[size]||!cost)throw new Error('Maximum equipment level.');
 if(book.balance<cost)throw new Error('Harvest more OIL to upgrade.');
 const key=`${size}:${seasonAt(book.genesis,now)}`;const r=book.reserves[key];const reserves={...book.reserves};
 if(r)reserves[key]={...r,work:Math.min(DEMO_DURATION*4,(r.work??0)+(now-(r.checkpoint??(book.genesis+(seasonAt(book.genesis,now)-1)*DEMO_DURATION)))*(4+(r.level??0))),checkpoint:now,level:level+1};
 levels[size]++;return {...book,levels,reserves,balance:book.balance-cost};
}
