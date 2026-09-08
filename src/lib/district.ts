export const COLLECTION_SIZE=1000;
export function plannedSize(id:number){if(!Number.isInteger(id)||id<1||id>1000)throw new Error('Choose a token ID from 1 to 1000.');return id<=400?0:id<=800?1:2}
const small=24,medium=Math.sqrt(108)*4,large=Math.sqrt(216)*4;
const gap=2,alley=4,sidewalk=3,street=12;
const moduleW=medium*2+gap,moduleD=large*.77+gap+medium*.77;
const blockW=4*moduleW+3*alley+2*sidewalk,blockD=2*moduleD+alley+2*sidewalk;
export const DISTRICT_WIDTH=5*blockW+4*street;
export const DISTRICT_DEPTH=5*blockD+4*street;
export const DISTRICT_BLOCKS=Array.from({length:25},(_,i)=>({x:(i%5)*(blockW+street)+blockW/2-DISTRICT_WIDTH/2,z:Math.floor(i/5)*(blockD+street)+blockD/2-DISTRICT_DEPTH/2,w:blockW,d:blockD}));
// Compact five-plot modules: two small stacked beside a large, two medium below.
export const DISTRICT_PLOTS=Array.from({length:200},(_,i)=>{
 const block=DISTRICT_BLOCKS[Math.floor(i/8)],slot=i%8;
 const left=block.x-blockW/2+sidewalk+(slot%4)*(moduleW+alley);
 const top=block.z-blockD/2+sidewalk+Math.floor(slot/4)*(moduleD+alley);
 return [{id:i*2+1,size:0,x:left+small/2,z:top+small*.77/2},
 {id:i*2+2,size:0,x:left+small/2,z:top+small*.77*1.5+gap},
 {id:801+i,size:2,x:left+small+gap+large/2,z:top+large*.77/2},
 {id:401+i*2,size:1,x:left+medium/2,z:top+large*.77+gap+medium*.77/2},
 {id:402+i*2,size:1,x:left+medium*1.5+gap,z:top+large*.77+gap+medium*.77/2}];
}).flat();
export const DISTRICT_ROADS=[
 ...Array.from({length:4},(_,i)=>({x:(i+1)*blockW+i*street+street/2-DISTRICT_WIDTH/2,z:0,w:street,d:DISTRICT_DEPTH})),
 ...Array.from({length:20},(_,i)=>({x:(i%5)*(blockW+street)+blockW/2-DISTRICT_WIDTH/2,z:(Math.floor(i/5)+1)*blockD+Math.floor(i/5)*street+street/2-DISTRICT_DEPTH/2,w:blockW,d:street}))
];
export const plotById=(id:number)=>{plannedSize(id);return DISTRICT_PLOTS.find(p=>p.id===id)!};
