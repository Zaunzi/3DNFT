export const WORLD_LIMIT=158;
export const MAP_SIZE=336;
export const ROAD_AXES=[-144,-72,0,72,144];
export const ROADS=ROAD_AXES.flatMap(a=>[{x:a,z:0,w:14,d:302},{x:0,z:a,w:302,d:14}]);
export const HOME_LOTS=[[-45,-46],[-20,-49],[23,-48],[48,-40],[-49,-23],[49,46],[-48,48],
 [-110,-110],[-35,-110],[35,-110],[110,-110],[-110,110],[-35,110],[35,110],[-110,-35],[-110,35],[110,-35],[110,35]];
export function overlaps(a:{x:number;z:number;w:number;d:number},b:{x:number;z:number;w:number;d:number},clearance=0){return Math.abs(a.x-b.x)<(a.w+b.w)/2+clearance&&Math.abs(a.z-b.z)<(a.d+b.d)/2+clearance;}
export function district(x:number,z:number){return z<-72?'Northside':z>72?'Southside':x<-72?'West End':x>72?'Eastside':'The Block';}
