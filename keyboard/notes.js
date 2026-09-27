export const blackNote=n=>[1,3,6,8,10].includes(n%12);
export const noteName=n=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][n%12]+(Math.floor(n/12)-1);
export const frequency=n=>440*2**((n-69)/12);
export function makeKeys(){let white=0;return Array.from({length:88},(_,i)=>{const note=i+21,black=blackNote(note);const x=black?white-.5:white++;return {note,black,x,name:noteName(note)}})}
