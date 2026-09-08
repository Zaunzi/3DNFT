<script lang="ts">
 import {page} from '$app/state';
 import {onMount} from 'svelte';
 let mounted=$state(false);
 onMount(()=>{mounted=true});
 import OilGame from '$lib/components/OilGame.svelte';
 import OilCollection from '$lib/components/OilCollection.svelte';
</script>
{#if mounted && page.url.searchParams.has('token')}{#key page.url.searchParams.get('token')}<OilGame onchain />{/key}{:else}<OilCollection />{/if}
