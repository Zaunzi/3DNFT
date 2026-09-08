<script lang="ts">
 import {onMount} from 'svelte';
 import {createDistrict} from '$lib/oil-world';
 import {plannedSize} from '$lib/district';
 import {PARCELS} from '$lib/oil';
 import {oilConfigured,readDistrictParcel} from '$lib/web3/oil-contracts';
 import '$lib/oil.css';
 let host:HTMLDivElement;let selected=$state(1);let input=$state('1');let error=$state('');let status=$state('');let owner=$state('');let minted=$state(false);let loading=$state(false);
 let view:ReturnType<typeof createDistrict>|undefined;let request=0;let active=true;
 let walking=$state(false);
 function walk(){view?.walk();walking=true}
 function overview(){view?.overview();walking=false}
 let size=$derived(plannedSize(selected));
 async function inspect(id:number){selected=id;input=String(id);error='';owner='';minted=false;const seq=++request;if(!oilConfigured){status='Mint status unavailable · OilField not configured';return}loading=true;status='Checking Base Sepolia…';try{const p=await readDistrictParcel(id);if(!active||seq!==request)return;owner=p.owner;minted=p.minted;status=p.minted?'Minted':'Unminted · reserved location';view?.setLevel(id,p.level)}catch{if(active&&seq===request)status='Mint status unavailable · RPC read failed'}finally{if(active&&seq===request)loading=false}}
 function go(){try{const id=Number(input);plannedSize(id);view?.focus(id);walking=false;void inspect(id)}catch(e){error=(e as Error).message}}
 onMount(()=>{active=true;try{view=createDistrict(host,id=>{walking=false;void inspect(id)});void inspect(1)}catch{error='3D rendering is unavailable. You can still look up token IDs.'}const poll=setInterval(()=>void inspect(selected),20000);return()=>{active=false;request++;clearInterval(poll);view?.dispose()}});
</script>
<svelte:head><title>Cloudacre · 1,000 Parcel District</title></svelte:head>
<main class="oil-app district">
 <header class="oil-header"><a class="oil-brand" href="/">CLOUDACRE <b>OIL</b></a><nav><a href="/oil/nft/">My parcels</a><a class="active" href="/oil/world/">District</a><a href="/oil/mint/">Mint</a></nav><span class="demo-pill">1,000 PERMANENT PLOTS</span></header>
 <section class="district-view"><div class="district-canvas" bind:this={host} aria-label="Interactive district with 1000 selectable parcel locations. Drag to orbit, right-drag to pan, scroll to zoom." role="img"></div><div class="district-title"><p class="oil-kicker">CLOUDACRE DISTRICT</p><h1>1,000 plots. A place for every token.</h1><p>400 small · 400 medium · 200 large<br/>Click a plot · Drag to orbit · Right-drag to pan · Scroll to zoom</p><button class="oil-secondary" onclick={overview}>View entire district</button> <button class="oil-secondary" onclick={walk}>{walking?'Return to selected parcel':'Explore on foot'}</button></div>
 <aside class="district-card" class:walking><form onsubmit={e=>{e.preventDefault();go()}}><label for="parcel-id">Find token ID (1–1000)</label><div class="lookup"><input id="parcel-id" type="number" min="1" max="1000" step="1" bind:value={input}/><button class="oil-secondary">Go</button></div></form><p class="oil-kicker">PARCEL #{selected}</p><h2>{PARCELS[size].name} oilfield</h2><p>{[24,41.6,58.8][size]} × {[18.5,32,45.3][size]} metres</p><p role="status">{status}</p>{#if minted}<p class="owner">Owner: {owner}</p><a class="oil-primary" href={`/oil/nft/?token=${selected}`}>Open NFT #{selected} ↗</a>{:else}<p class="oil-note">This location and size remain fixed when the NFT mints.</p>{/if}<button class="oil-secondary" onclick={()=>void inspect(selected)} disabled={loading}>Refresh mint status</button><p class="oil-note">IDs 1–400: Small · 401–800: Medium · 801–1000: Large. All planned plots are visible, regardless of mint status.</p>{#if error}<p role="alert">{error}</p>{/if}</aside></section>
 <footer class="oil-footer"><span>1 WORLD UNIT = 1 METRE · FIXED TOKEN LOCATIONS</span><span>12 m roads · 3 m pavements · 1 : 3 : 6 land areas</span></footer>
</main>
<style>
 .district-card.walking{display:none}.district-view{position:relative;height:calc(100dvh - 130px);min-height:700px}.district-canvas{position:absolute;inset:0}.district-title{position:absolute;top:24px;left:30px;max-width:570px;pointer-events:none}.district-title button{pointer-events:auto}.district-title h1{font-size:30px;margin:8px 0}.district-title p{color:#b9c4c8;line-height:1.5}.district-card{position:absolute;right:24px;bottom:24px;width:310px;padding:24px;background:#172126ee;border:1px solid #45514f;border-radius:16px}.district-card h2{margin:12px 0}.district-card p{line-height:1.5}.district-card a{text-decoration:none;display:flex;justify-content:center}.lookup{display:flex;gap:8px;margin:10px 0 20px}.lookup input{min-width:0;width:100%;padding:10px;background:#26343a;color:white;border:1px solid #59666b;border-radius:6px}.owner{overflow-wrap:anywhere;font-size:13px}@media(max-width:700px){.district-title{left:18px;right:18px}.district-title h1{font-size:22px}.district-card{left:16px;right:16px;bottom:16px;width:auto;padding:16px}.district-view{min-height:900px}.district .oil-header{flex-wrap:wrap;gap:12px}}
</style>
