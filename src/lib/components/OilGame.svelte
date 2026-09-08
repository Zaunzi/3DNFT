<script lang="ts">
 import {onMount,untrack} from 'svelte';
 import {replaceState} from '$app/navigation';
 import {Droplet,ArrowUpRight,Wallet,Move,Layers,Radio,Clock,ExternalLink,Check,ChevronRight} from '@lucide/svelte';
 import OilScene from './OilScene.svelte';
 import {PARCELS,DEMO_DURATION,seasonAt,available,surveyDemo,harvestDemo,drawDemo,validBook,upgradeDemo,upgradePrice,type OilDemo} from '$lib/oil';
 import {wallet,connect,switchNetwork} from '$lib/web3/wallet';
 import {oilConfigured,readOil,oilTransaction,oilError,validId,type OilSnapshot} from '$lib/web3/oil-contracts';
 import {formatEther} from 'ethers';
 import '$lib/oil.css';
 let {onchain=false,embed=false}=$props<{onchain?:boolean;embed?:boolean}>();
 let book=$state<OilDemo>({version:1,genesis:0,balance:0,reserves:{}});
 let ready=$state(false),saved=$state(true),busy=$state(false),loading=$state(false);
 let now=$state(0),size=$state(0),token=$state('1'),tokenInput=$state('1'),selectedSeason=$state(1),seasonInput=$state('1');
 let snapshot=$state<OilSnapshot|null>(null);let error=$state('');let message=$state('Choose your parcel. Survey what lies beneath.');let txHash=$state('');
 let alive=true;let sequence=0;let previousWallet:string|undefined;
 const KEY='cloudacre-oil-demo-v1';
 let current=$derived(onchain?snapshot?.currentSeason??1:seasonAt(book.genesis,now));
 let actualSize=$derived(onchain?snapshot?.size??size:size);
 let level=$derived(onchain?snapshot?.level??0:book.levels?.[size]??0);
 let cost=$derived(onchain?snapshot?.upgradeCost??0:upgradePrice(size,level));
 let parcel=$derived(PARCELS[actualSize]);
 let reserve=$derived(book.reserves[`${size}:${selectedSeason}`]);
 let requested=$derived(onchain?snapshot?.requested??false:!!reserve);
 let fulfilled=$derived(onchain?snapshot?.fulfilled??false:!!reserve);
 let allocation=$derived(onchain?snapshot?.allocation??0:reserve?.allocation??0);
 let harvested=$derived(onchain?snapshot?.harvested??0:reserve?.harvested??0);
 let claimable=$derived(onchain?snapshot?.claimable??0:available(reserve,book.genesis,selectedSeason,now));
 let balance=$derived(onchain?snapshot?.balance??0:book.balance);
 let owns=$derived(!!snapshot&&snapshot.owner.toLowerCase()===$wallet.address?.toLowerCase());
 let enabled=$derived(ready&&!busy&&(!onchain||(owns&&$wallet.chainId===84532&&!loading)));
 let duration=$derived(onchain?snapshot?.duration??604800000:DEMO_DURATION);
 let genesis=$derived(onchain?snapshot?.genesis??0:book.genesis);
 let chainNow=$derived(onchain?snapshot?.timestamp??0:now);
 let remaining=$derived(Math.max(0,genesis+selectedSeason*duration-chainNow));
 const number=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:2});
 const short=(s:string)=>`${s.slice(0,6)}…${s.slice(-4)}`;
 function timeLeft(ms:number){if(ms<=0)return 'Season closed';const minutes=Math.ceil(ms/60000);return minutes>=1440?`${Math.floor(minutes/1440)}d ${Math.floor(minutes%1440/60)}h remaining`:minutes>=60?`${Math.floor(minutes/60)}h ${minutes%60}m remaining`:`${minutes}m remaining`}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(book))}catch{saved=false}}
 async function refresh(latest=false){const request=++sequence;if(!oilConfigured){snapshot=null;error='Deploy OilField v2 to connect onchain reserves.';return}loading=true;const id=token;const address=$wallet.address;
  try{const next=await readOil(id,latest?undefined:selectedSeason,address);if(alive&&request===sequence){snapshot=next;if(latest){selectedSeason=next.season;seasonInput=String(next.season)}error=''}}catch(e){if(alive&&request===sequence){snapshot=null;error=oilError(e)}}finally{if(alive&&request===sequence)loading=false}
 }
 onMount(()=>{alive=true;now=Date.now();if(onchain){token=new URLSearchParams(location.search).get('token')||'1';tokenInput=token;message='Survey once per season. Pyth reveals your finite oil reserve.';void refresh(true)}else{try{const previous=JSON.parse(localStorage.getItem(KEY)||'null');book=validBook(previous)?previous:{version:1,genesis:now-60000,balance:0,reserves:{}}}catch{book={version:1,genesis:now-60000,balance:0,reserves:{}};saved=false}selectedSeason=seasonAt(book.genesis,now);seasonInput=String(selectedSeason);save()}if(!onchain){const q=Number(new URLSearchParams(location.search).get('size'));if(Number.isInteger(q)&&q>=0&&q<=2)size=q}ready=true;
  const timer=setInterval(()=>{now=Date.now()},1000);const poll=setInterval(()=>{if(onchain&&!busy&&!loading)void refresh()},10000);
  return()=>{alive=false;sequence++;clearInterval(timer);clearInterval(poll)};
 });
 $effect(()=>{const key=`${$wallet.address??''}:${$wallet.chainId??''}`;if(!ready||!onchain)return;if(previousWallet===undefined){previousWallet=key;return}if(previousWallet!==key){previousWallet=key;untrack(()=>{snapshot=null;void refresh()})}});
 function chooseSeason(){const value=Number(seasonInput);if(!Number.isSafeInteger(value)||value<1||value>current){error='Choose a season between 1 and the current season.';return}selectedSeason=value;error='';if(onchain)void refresh()}
 function latestSeason(){if(onchain)void refresh(true);else{selectedSeason=current;seasonInput=String(current);error=''}}
 function viewParcel(){if(!validId(tokenInput)){error='Enter a valid positive parcel ID.';return}token=tokenInput;snapshot=null;replaceState(`?token=${token}`,{});void refresh(true)}
 async function openWallet(){try{await connect()}catch(e){message=oilError(e)}}
 async function changeNetwork(){try{await switchNetwork()}catch(e){message=oilError(e)}}
 async function act(action:'mint'|'survey'|'harvest'|'upgrade'){
  if(busy||!ready)return;
  if(!onchain){try{if(action==='upgrade'){book=upgradeDemo(book,size,Date.now());message='Equipment upgraded. Faster extraction, same finite reserve.'}else if(action==='survey'){book=surveyDemo(book,size,selectedSeason,drawDemo(size),Date.now());message=`Survey complete: ${number(book.reserves[`${size}:${selectedSeason}`].allocation)} OIL discovered. Local demo randomness.`}else if(action==='harvest'){const before=book.balance;book=harvestDemo(book,size,selectedSeason,Date.now());message=`${number(book.balance-before)} demo OIL collected.`}save()}catch(e){message=oilError(e)}return}
  busy=true;txHash='';message='Confirm the transaction in your wallet.';
  try{const result=await oilTransaction(action,token,selectedSeason,size,hash=>{txHash=hash;message='Submitted. Waiting for transaction confirmation…'});txHash=result.hash;token=result.id;tokenInput=token;replaceState(`?token=${token}`,{});message=action==='survey'?'Survey confirmed. Waiting for the Pyth callback…':action==='mint'?'Parcel minted. Request its first seasonal survey.':action==='upgrade'?'Equipment upgraded on Base Sepolia.':'OIL harvested on Base Sepolia.';await refresh(action==='mint')}catch(e){message=oilError(e)}finally{busy=false}
 }
</script>
<svelte:head><title>Cloudacre Oil · {embed?'Parcel viewer':onchain?'Testnet parcels':'Seasonal oilfields'}</title><meta name="description" content="Small, medium, and large 3D oil parcels with finite seasonal reserves allocated using Pyth Entropy."/></svelte:head>
<main class="oil-app" class:is-embed={embed}>
 {#if !embed}<header class="oil-header"><a class="oil-brand" href="/"><span><Droplet size={22}/></span>CLOUDACRE <b>OIL</b></a><nav aria-label="Oil navigation"><a class:active={!onchain} href="/">Playground</a><a class:active={onchain} href="/oil/nft/">My parcels</a><a href="/oil/mint/">Mint</a><a href="/oil/world/">District</a><a class="legacy-link" href="/farm/">Original farm ↗</a></nav>{#if onchain}<button class="connect-oil" onclick={openWallet} disabled={busy}><Wallet size={15}/>{$wallet.address?short($wallet.address):'Connect wallet'}</button>{:else}<span class="demo-pill">SIMULATION</span>{/if}</header>{/if}
 <div class="oil-layout"><section class="oil-world"><div class="oil-world-heading"><p class="oil-kicker">CLOUDACRE EXPLORATION CO.</p><h1>{parcel.name} oilfield<span>PARCEL {onchain?`#${token}`:['S–001','M–001','L–001'][size]}</span></h1><div class="oil-tags"><span><Layers size={13}/>{parcel.area}</span><span><Radio size={13}/>{onchain?'Pyth Entropy':'Local demo'}</span></div></div>
 {#if !onchain||snapshot}<OilScene size={actualSize} {level}/>{:else}<div class="oil-empty"><Droplet size={42}/><h2>{loading?'Reading parcel…':'Oilfield not connected'}</h2><p>{error}</p><p>The original SEED farm is a separate deployment.</p>{#if !embed}<a href="/">Explore the oil demo <ArrowUpRight size={15}/></a>{/if}</div>{/if}
 <div class="oil-survey-stamp"><span class="stamp-dot" class:discovered={fulfilled}></span>{fulfilled?'RESERVE DISCOVERED':requested?'SURVEY IN PROGRESS':'UNSURVEYED TERRITORY'}</div><div class="oil-world-bottom"><span><Move size={14}/>Drag to orbit · Scroll to zoom</span><span>{parcel.pumps} {parcel.pumps===1?'pumpjack':'pumpjacks'} · {onchain?'7-day':'5-minute demo'} seasons</span></div>
 </section>
 {#if !embed}<aside class="oil-console"><div class="oil-console-top"><p class="oil-kicker">FIELD OPERATIONS</p><div class="oil-season-row"><h2>Season {selectedSeason.toString().padStart(2,'0')}</h2><span><Clock size={13}/>{timeLeft(remaining)}</span></div></div>
 {#if onchain}<a class="oil-secondary" href="/oil/nft/">Back to my parcels</a>{/if}
 {#if !onchain}<fieldset class="parcel-options"><legend>{onchain?'New parcel size':'Choose your parcel'}</legend>{#each PARCELS as p,i}<label class:selected={size===i}><input type="radio" name="parcel-size" value={i} bind:group={size} disabled={busy}/><span class="parcel-mark">{['S','M','L'][i]}</span><span><b>{p.name} land</b><small>{number(p.min)}–{number(p.max)} OIL / season</small></span><span class="parcel-check">{#if size===i}<Check size={16}/>{/if}</span></label>{/each}</fieldset>{/if}
 {#if onchain}{#if $wallet.connected&&$wallet.chainId!==84532}<button class="oil-secondary" onclick={changeNetwork} disabled={busy}>Switch to Base Sepolia</button>{/if}{#if !oilConfigured}<p class="oil-warning">OilField v2 address needed. Your existing farm address is preserved.</p>{/if}{#if snapshot}<p class="oil-owner">Owner: {short(snapshot.owner)} {owns?'· You':''} <a href={`/oil/embed/?token=${token}`} target="_blank" rel="noreferrer" aria-label="Open NFT viewer"><ExternalLink size={13}/></a></p>{/if}{/if}
 <section class="reserve-panel"><div class="reserve-top"><span>SEASONAL RESERVE</span><span class="reserve-status">{fulfilled?'Confirmed':requested?'Awaiting reveal':'Not surveyed'}</span></div><div class="reserve-amount">{fulfilled?number(allocation):'—'}<span>OIL</span></div><div class="oil-progress"><progress value={harvested} max={allocation||1} aria-label="Seasonal oil harvested"></progress></div><div class="reserve-meta"><span>{number(harvested)} collected</span><span>{fulfilled?number(Math.max(0,allocation-harvested)):'—'} remaining</span></div>
 {#if !requested}<button class="oil-primary" onclick={()=>act('survey')} disabled={!enabled||selectedSeason!==current}><Radio size={18}/>{onchain?'Survey with Pyth':'Survey parcel'}<ChevronRight size={18}/></button>{:else if !fulfilled}<div class="waiting-reveal"><Radio size={17}/><span>Awaiting Pyth’s callback.<small>This survey cannot be rerolled.</small></span></div>{:else}<button class="oil-primary" onclick={()=>act('harvest')} disabled={!enabled||(onchain?!(snapshot&&snapshot.claimableWei>0n):claimable<.01)}><Droplet size={18}/>{busy?'Waiting for confirmation…':`Harvest ${number(claimable)} OIL`}<ArrowUpRight size={17}/></button>{/if}
 {#if onchain&&snapshot&&!requested}<p class="oil-note">Entropy fee: {formatEther(snapshot.fee)} ETH + transaction gas</p>{/if}
 <p class="oil-feedback" role="status">{message}</p>{#if txHash}<a class="oil-tx" href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={12}/></a>{/if}
 {#if requested&&!fulfilled&&snapshot}<p class="oil-note">Provider {short(snapshot.provider)} · request #{snapshot.sequence}. If delayed, check the <a href="https://entropy-explorer.pyth.network/" target="_blank" rel="noreferrer">Entropy Explorer</a>; a new survey is not a retry.</p>{/if}
 </section>
 <div class="oil-balance"><span><Droplet size={17}/>Your {onchain?'testnet':'demo'} OIL</span><b>{number(balance)}</b></div>
 <section class="reserve-panel"><div class="reserve-top"><span>EQUIPMENT LEVEL {level} / 3</span><span>{1+level*.25}� extraction</span></div><p class="oil-note">Burn OIL to improve this parcel permanently. Faster extraction starts now; seasonal reserves stay finite.</p><button class="oil-secondary" onclick={()=>act('upgrade')} disabled={!enabled||level>=3||balance<cost}>{level>=3?'Equipment fully upgraded':`Upgrade � ${number(cost)} OIL`}</button></section>
 <form class="oil-season-select" onsubmit={e=>{e.preventDefault();chooseSeason()}}><label for="oil-season">View past reserves</label><div><input id="oil-season" inputmode="numeric" bind:value={seasonInput} disabled={busy}/><button disabled={busy||loading}>View season</button><button type="button" onclick={latestSeason} disabled={busy||loading}>Current</button></div></form>
 {#if error}<p class="oil-warning" role="alert">{error}</p>{/if}<p class="oil-note">{onchain?'Oil unlocks throughout each 7-day season. Past reserves remain claimable by the current owner.':`Demo seasons last 5 minutes. Local randomness simulates the reveal; it does not use Pyth. ${saved?'Saved on this device.':'Storage unavailable; this visit only.'}`}</p>
 </aside>{/if}</div>
 {#if !embed}<footer class="oil-footer"><span>FINITE RESERVES. A NEW DISCOVERY EVERY SEASON.</span><span>Game resource · no physical oil backing or price peg</span></footer>{/if}
</main>

