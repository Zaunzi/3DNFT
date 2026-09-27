export const noteName=n=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][n%12]+(Math.floor(n/12)-1);
export const xyloNotes=Array.from({length:25},(_,i)=>({id:String(60+i),note:60+i,name:noteName(60+i),black:[1,3,6,8,10].includes((60+i)%12)}));
export const bongoPads=['small','large'].flatMap(drum=>['open','slap','rim'].map(stroke=>({id:drum+'-'+stroke,drum,stroke,name:(drum==='small'?'Macho':'Hembra')+' '+stroke})));
