import {createPublicClient,http,parseAbi,verifyMessage} from 'viem';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {pathToFileURL} from 'node:url';
export function createPresenceServer({origins=['http://127.0.0.1:5177'],maxPlayers=100,allowMockAvatars=false,characters=process.env.CHARACTER_ADDRESS,rpc=process.env.RPC_URL??'https://mainnet.base.org',chainId=8453,characterCollections=(process.env.CHARACTER_ADDRESSES??'0x03847D61A017731A843109F0b6BC637AF8a3f7e0,0x16E9432a0a09c903e70ca8467Ce3bfE77b3Dc56f').split(','),verifyIdentity,sessionTTL=8*60*60*1000}={}){
 const peers=new Map(), sessions=new Map();
 const revoke=p=>{if(p.resumeToken)sessions.delete(p.resumeToken);p.resumeToken=null;};
 const client=createPublicClient({transport:http(rpc)});
 const checkIdentity=verifyIdentity??(async(message,auth)=>{
  const collection=auth.collection??characters;
  if(!collection||![characters,...characterCollections].some(a=>a?.toLowerCase()===collection.toLowerCase())||!/^0x[0-9a-fA-F]{40}$/.test(auth.address)||!Number.isInteger(auth.character)||auth.character<1||auth.character>5000)return false;
  if(!await verifyMessage({address:auth.address,message,signature:auth.signature}))return false;
  if(await client.getChainId()!==chainId)return false;
  const owner=await client.readContract({address:collection,abi:parseAbi(['function ownerOf(uint256) view returns(address)']),functionName:'ownerOf',args:[BigInt(auth.character)]});return owner.toLowerCase()===auth.address.toLowerCase();
 });
 const server=createServer((req,res)=>{res.writeHead(req.url==='/health'?200:404,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:req.url==='/health'}));});
 const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{if(!origins.includes(req.headers.origin)||peers.size>=maxPlayers||req.url!=='/'){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));});
 wss.on('connection',ws=>{
  const peer={id:randomUUID(),ws,room:null,state:null,alive:true,tokens:30,refill:Date.now(),last:0,guestCharacter:12,character:12,challenge:null,authBusy:false};peers.set(peer.id,peer);
  ws.on('pong',()=>peer.alive=true);
  ws.on('close',()=>peers.delete(peer.id));ws.on('error',()=>ws.close());
  ws.on('message',async raw=>{const now=Date.now();peer.tokens=Math.min(30,peer.tokens+(now-peer.refill)*.02);peer.refill=now;if(--peer.tokens<0){ws.close(1008,'Rate limit');return;}
   try{const m=JSON.parse(raw.toString());
    if(m.type==='join'&&!peer.room&&typeof m.room==='string'&&/^(mock|onchain):[0-9]+:0x[0-9a-f]{40}:[0-9]+:[0-9]+$/.test(m.room)){peer.room=m.room;if(Number.isInteger(m.guestCharacter)&&m.guestCharacter>=1&&m.guestCharacter<=5000){peer.guestCharacter=m.guestCharacter;peer.character=m.guestCharacter;}if(allowMockAvatars&&peer.room.startsWith('mock:')&&Number.isInteger(m.character)&&m.character>=1&&m.character<=5000)peer.character=m.character;peer.challenge=`Doodverse multiplayer login\nSession: ${peer.id}\nWorld: ${peer.room}\nNonce: ${randomUUID()}\nExpires: ${Date.now()+120000}`;peer.challengeExpires=Date.now()+120000;ws.send(JSON.stringify({type:'welcome',id:peer.id,message:peer.challenge,canAuthenticate:!!characters||characterCollections.length>0}));return;}
    if(m.type==='resume'&&peer.room&&!peer.authBusy){
      const session=sessions.get(m.token);peer.authBusy=true;const attempt=peer.authMessage=randomUUID();
      try{if(session&&session.room===peer.room&&session.expires>Date.now()&&await checkIdentity(session.message,session.auth)&&sessions.get(m.token)===session&&session.expires>Date.now()&&peer.authMessage===attempt&&ws.readyState===WebSocket.OPEN){peer.character=session.auth.character;peer.auth=session.auth;peer.authMessage=session.message;peer.authTime=Date.now();peer.resumeToken=m.token;peer.challenge=null;ws.send(JSON.stringify({type:'authenticated',resumeToken:m.token}));}else ws.send(JSON.stringify({type:'authFailed'}));}catch{ws.send(JSON.stringify({type:'authFailed'}));}finally{peer.authBusy=false;}return;
    }
    if(m.type==='guest'){revoke(peer);peer.character=peer.guestCharacter;peer.authTime=0;peer.challenge=null;peer.authMessage=null;return;}
    if(m.type==='authenticate'&&peer.room&&!peer.authBusy&&peer.challenge){
      peer.authBusy=true;const message=peer.challenge;peer.authMessage=message;peer.challenge=null;
      try{if(Date.now()<peer.challengeExpires&&peer.room.startsWith(`onchain:${chainId}:`)&&await checkIdentity(message,m)&&peer.authMessage===message&&ws.readyState===WebSocket.OPEN){peer.character=m.character;peer.auth=m;peer.authTime=Date.now();const resumeToken=randomUUID();peer.resumeToken=resumeToken;sessions.set(resumeToken,{room:peer.room,message,auth:m,expires:Date.now()+sessionTTL});while(sessions.size>maxPlayers*4)sessions.delete(sessions.keys().next().value);ws.send(JSON.stringify({type:'authenticated',resumeToken}));}else ws.send(JSON.stringify({type:'authFailed'}));}catch{ws.send(JSON.stringify({type:'authFailed'}));}finally{peer.authBusy=false;}return;
    }
    if(m.type!=='state'||!peer.room)throw Error();
    const {x,y,z,yaw,animation}=m;
    if(![x,y,z,yaw].every(Number.isFinite)||x<0||x>6400||z<0||z>3200||Math.abs(y)>1000||Math.abs(yaw)>Math.PI||!['Idle','Walk','Run','Jump'].includes(animation))throw Error();
    // Presence cannot modify any persistent state. Large jumps are treated as
    // teleports and simply replaced; portals and spawn changes remain possible.
    peer.state={x,y,z,yaw,animation};peer.last=now;
   }catch{ws.close(1008,'Invalid message');}
  });
 });
 const tick=setInterval(()=>{const now=Date.now();for(const p of peers.values()){
  if(!p.state||p.ws.readyState!==WebSocket.OPEN)continue;
  if(p.authTime&&now-p.authTime>60000&&!p.authBusy){p.authBusy=true;const message=p.authMessage;void checkIdentity(message,p.auth).then(ok=>{if(p.authMessage!==message)return;if(!ok){revoke(p);p.character=p.guestCharacter;p.authTime=0;}else p.authTime=Date.now();}).catch(()=>{if(p.authMessage!==message)return;revoke(p);p.character=p.guestCharacter;p.authTime=0;}).finally(()=>p.authBusy=false);}
  if(now-p.last>15000){p.ws.close(1000,'Idle connection');continue;}
  if(p.ws.bufferedAmount>65536){p.ws.close(1013,'Slow connection');continue;}
  const nearby=[...peers.values()].filter(q=>q!==p&&q.room===p.room&&q.state&&now-q.last<=15000&&Math.hypot(q.state.x-p.state.x,q.state.z-p.state.z)<160).sort((a,b)=>Math.hypot(a.state.x-p.state.x,a.state.z-p.state.z)-Math.hypot(b.state.x-p.state.x,b.state.z-p.state.z)).slice(0,24).map(q=>({id:q.id,character:q.character,...q.state}));
  p.ws.send(JSON.stringify({type:'snapshot',players:nearby}));
 }},100);
 const heartbeat=setInterval(()=>{for(const [token,s]of sessions)if(s.expires<Date.now())sessions.delete(token);for(const p of peers.values()){if(!p.alive||!p.room){p.ws.terminate();continue;}p.alive=false;p.ws.ping();}},30000);
 return {server,async close(){clearInterval(tick);clearInterval(heartbeat);for(const p of peers.values())p.ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const origins=(process.env.ALLOWED_ORIGINS??'http://127.0.0.1:5177').split(',').map(s=>s.trim());
 const app=createPresenceServer({origins,allowMockAvatars:process.env.ALLOW_MOCK_AVATARS==='true'});app.server.listen(Number(process.env.PORT??8787),'0.0.0.0',()=>console.log('Doodverse presence listening'));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
}
