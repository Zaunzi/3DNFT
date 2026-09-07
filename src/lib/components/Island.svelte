<script lang="ts">
 import {createIsland} from '$lib/island';
 let {level=0}=$props<{level?:number}>();
 let host:HTMLDivElement;let error=$state(false);
 $effect(()=>{if(!host)return;try{error=false;return createIsland(host,level)}catch{error=true}});
</script>
<div class="island" bind:this={host} role="img" aria-label={`Floating farm, level ${level+1}. Drag to orbit and pinch to zoom.`}>
 {#if error}<p class="render-error">3D rendering is unavailable on this device. Farm controls are still available.</p>{/if}
</div>
