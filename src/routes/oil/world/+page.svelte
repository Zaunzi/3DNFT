<script lang="ts">
 import {onMount} from 'svelte';
 import {createDistrict} from '$lib/oil-world';
 import {PARCELS,validBook} from '$lib/oil';
 import '$lib/oil.css';
 let host:HTMLDivElement;let selected=$state(0);let error=$state('');
 onMount(()=>{try{let levels=[0,0,0];try{const book=JSON.parse(localStorage.getItem('cloudacre-oil-demo-v1')||'null');if(validBook(book))levels=book.levels??levels}catch{}return createDistrict(host,size=>selected=size,levels)}catch{error='3D rendering is unavailable. Select a parcel below to continue.'}});
</script>
<svelte:head><title>Cloudacre · Oil District</title></svelte:head>
<main class="oil-app district">
 <header class="oil-header"><a class="oil-brand" href="/">CLOUDACRE <b>OIL</b></a><nav><a href="/">Parcels</a><a class="active" href="/oil/world/">District</a><a href="/oil/nft/">Testnet</a></nav><span class="demo-pill">DISTRICT SIMULATION</span></header>
 <section class="district-view"><div class="district-canvas" bind:this={host} aria-label="Interactive oil district. Drag to orbit, right-drag to pan, scroll to zoom." role="img"></div><div class="district-title"><p class="oil-kicker">EXPLORATION DISTRICT 01</p><h1>A place for every parcel.</h1><p>Click a plot to inspect it. Drag to orbit · Right-drag to pan · Scroll to zoom.</p>{#if error}<p role="alert">{error}</p>{/if}</div>
 <aside class="district-card"><p class="oil-kicker">SELECTED PARCEL TYPE</p><h2>{PARCELS[selected].name} oilfield</h2><p>{[24,41.6,58.8][selected]} × {[18.5,32,45.3][selected]} metres</p><p>{PARCELS[selected].min.toLocaleString()}–{PARCELS[selected].max.toLocaleString()} OIL per season</p><div class="district-sizes">{#each PARCELS as p,i}<button class="oil-secondary" class:chosen={selected===i} onclick={()=>selected=i}>{p.name}</button>{/each}</div><a class="oil-primary" href={`/?size=${selected}`}>Operate this demo parcel ↗</a><p class="oil-note">Six illustrative plots. Ownership locations and multiplayer are not connected yet.</p></aside></section>
 <footer class="oil-footer"><span>1 WORLD UNIT = 1 METRE · 1.8 M HUMAN REFERENCE</span><span>12 m road · 3 m pavements · land areas in a 1 : 3 : 6 ratio</span></footer>
</main>
<style>
 .district-view{position:relative;height:calc(100dvh - 130px);min-height:650px}.district-canvas{position:absolute;inset:0}.district-title{position:absolute;top:24px;left:30px;pointer-events:none;max-width:520px}.district-title h1{font-size:32px;margin:8px 0}.district-title p{color:#b9c4c8;line-height:1.5}.district-card{position:absolute;right:24px;bottom:24px;width:310px;padding:24px;background:#172126ee;border:1px solid #45514f;border-radius:16px}.district-card h2{margin:12px 0}.district-card p{line-height:1.5}.district-sizes{display:flex;gap:6px;margin:18px 0}.district-sizes button{padding:10px}.chosen{outline:2px solid #e8b060}.district-card a{text-decoration:none;display:flex;justify-content:center}@media(max-width:700px){.district-title{left:18px;right:18px}.district-title h1{font-size:24px}.district-card{left:16px;right:16px;bottom:16px;width:auto;padding:16px}.district-view{min-height:780px}.district .oil-header{flex-wrap:wrap;gap:12px}}
</style>
