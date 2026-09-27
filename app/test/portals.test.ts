import test from 'node:test';
import assert from 'node:assert/strict';
import {PortalNavigator} from '../src/portals/navigation.ts';
import {resolveInternalDestination,type NFTWorldLocation} from '../src/portals/location.ts';
import {findSafeSpawnPosition} from '../src/portals/spawn.ts';
import {worldToParcel,coordinateToTokenId,nearbyTokenIds} from '../src/world/coordinates.ts';
test('portal travel updates location, URL, spawn and neighbors; back restores source',async()=>{
 let location:NFTWorldLocation={chainId:31337,contractAddress:'0x1111111111111111111111111111111111111111',tokenId:742n};
 let url=new URL('https://atlas.example/?tokenId=742'),loaded:number[]=[];
 const nav=new PortalNavigator({current:()=>location,currentURL:()=>url,prepare:async()=>({exists:true,obstacles:[]}),commit:(destination,spawn,next)=>{location=destination;url=new URL(next);const c=worldToParcel(spawn.x,spawn.z);assert.equal(coordinateToTokenId(c.x,c.z),Number(destination.tokenId));loaded=nearbyTokenIds(c,2);}},7422026n);
 await nav.travel({...location,tokenId:1934n});assert.equal(url.searchParams.get('tokenId'),'1934');assert.ok(loaded.includes(1934));await nav.back();assert.equal(location.tokenId,742n);assert.equal(nav.stack.length,0);
 await assert.rejects(nav.travel({...location,chainId:1}));assert.throws(()=>resolveInternalDestination({kind:'URL',url:'javascript:alert(1)'},location));
});
test('obstructed NFT/container spawn cancels travel and preserves source',async()=>{
 const location:NFTWorldLocation={chainId:31337,contractAddress:'0x1111111111111111111111111111111111111111',tokenId:742n};
 let committed=false;const center=findSafeSpawnPosition(743,7422026n,[]);
 const blocked={x:center.x,z:center.z,radius:1000};
 const nav=new PortalNavigator({current:()=>location,currentURL:()=>new URL('https://atlas.example/?tokenId=742'),prepare:async()=>({exists:true,obstacles:[blocked]}),commit:()=>{committed=true;}},7422026n);
 await assert.rejects(nav.travel({...location,tokenId:743n}),/obstructed/);assert.equal(committed,false);assert.equal(nav.busy,false);assert.equal(nav.stack.length,0);
 const shifted=findSafeSpawnPosition(743,7422026n,[{x:center.x,z:center.z,radius:2}]);assert.ok(Math.hypot(shifted.x-center.x,shifted.z-center.z)>2.6);
});
