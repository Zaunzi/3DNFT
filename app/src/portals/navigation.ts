import type { NFTWorldLocation } from './location.ts';
import { locationURL } from './location.ts';
import { findSafeSpawnPosition, type SpawnObstacle } from './spawn.ts';
export interface TravelHost {
  current():NFTWorldLocation; currentURL():URL;
  prepare(tokenId:number):Promise<{exists:boolean;obstacles:SpawnObstacle[]}>;
  commit(location:NFTWorldLocation,spawn:{x:number;y:number;z:number},url:string):void;
}
export class PortalNavigator {
  readonly stack:NFTWorldLocation[]=[]; busy=false;
  private host:TravelHost;private seed:bigint;
  constructor(host:TravelHost,seed:bigint){this.host=host;this.seed=seed;}
  async travel(destination:NFTWorldLocation,back=false) {
    if(this.busy)throw new Error('Travel already in progress');
    const source=this.host.current();
    if(destination.chainId!==source.chainId||destination.contractAddress.toLowerCase()!==source.contractAddress.toLowerCase())throw new Error('External worlds are not supported yet.');
    this.busy=true;
    try {const data=await this.host.prepare(Number(destination.tokenId));if(!data.exists)throw new Error('Destination NFT does not exist');const spawn=findSafeSpawnPosition(Number(destination.tokenId),this.seed,data.obstacles);this.host.commit(destination,spawn,locationURL(this.host.currentURL(),destination));if(back)this.stack.pop();else this.stack.push(source);}
    finally{this.busy=false;}
  }
  async back(){const previous=this.stack.at(-1);if(!previous)throw new Error('No previous portal destination');await this.travel(previous,true);}
}
