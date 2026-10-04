/** Only the official BasePaint media routes can use the optional presence-server relay. */
export function basePaintRelayURL(value:string,server?:string):string|undefined {
 if(!server)return;
 try{
  const url=new URL(value);if(url.origin!=='https://basepaint.xyz'||url.username||url.password||url.hash)return;
  let id:bigint,kind:string;
  const metadata=/^\/api\/art\/([0-9a-fA-F]{64})$/.exec(url.pathname);
  if(metadata&&!url.search){id=BigInt('0x'+metadata[1]);kind='metadata';}
  else if(url.pathname==='/api/art/image'&&/^\?day=[1-9][0-9]*$/.test(url.search)){id=BigInt(url.searchParams.get('day')!);kind='image';}
  else return;
  if(id<1n||id>=1n<<256n)return;
  const relay=new URL(server);if(relay.username||relay.password)return;
  if(relay.protocol==='wss:')relay.protocol='https:';
  else if(relay.protocol==='ws:'&&['127.0.0.1','localhost'].includes(relay.hostname))relay.protocol='http:';
  else return;
  relay.pathname=`/media/basepaint/${id}/${kind}`;relay.search='';relay.hash='';return relay.href;
 }catch{return;}
}
