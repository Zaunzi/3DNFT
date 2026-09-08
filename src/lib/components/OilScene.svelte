<script lang="ts">
 import {createOilScene} from '$lib/oil-scene';
 let {size=0,level=0}=$props<{size?:number;level?:number}>();let host:HTMLDivElement;let error=$state(false);
 $effect(()=>{if(!host)return;try{error=false;return createOilScene(host,size,level)}catch{error=true}});
</script>
<div class="oil-scene" bind:this={host} role="img" aria-label={`Interactive ${['small','medium','large'][size]} oil parcel. Drag to orbit; pinch or scroll to zoom.`}>
 {#if error}<p class="scene-error">3D rendering is unavailable. You can still use the oil controls.</p>{/if}
</div>
