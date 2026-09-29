<script lang="ts">
	import { itemPages } from './catalog';
</script>

<svelte:head><title>CryptoDoodz items</title></svelte:head>
<main>
	<p class="eyebrow">CRYPTODOODZ</p>
	<h1>Items</h1>
	<ul>
		{#each itemPages as item (item.id)}
			<li>
				<a href="/items/{item.id}/">
					<span>{item.id.padStart(3, '0')}</span>
					<strong>{item.title}</strong>
					<small>{item.kind}</small>
				</a>
			</li>
		{/each}
	</ul>
</main>

<style>
	main {
		min-height: 100vh;
		background: #0b0d12;
		color: #eef1f6;
		padding: 48px 8vw;
		font-family: system-ui, sans-serif;
	}
	.eyebrow {
		letter-spacing: 3px;
		color: #919baa;
		font-size: 12px;
		margin: 0;
	}
	h1 {
		font-weight: 750;
		letter-spacing: -0.03em;
		margin: 8px 0 28px;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 12px;
		max-width: 640px;
	}
	a {
		display: flex;
		align-items: baseline;
		gap: 16px;
		text-decoration: none;
		color: inherit;
		border: 1px solid #2b3240;
		border-radius: 12px;
		padding: 18px 20px;
		background: #141820;
	}
	a:hover {
		background: #202530;
	}
	span {
		color: #b2ff78;
		letter-spacing: 2px;
		font-size: 13px;
	}
	strong {
		font-size: 18px;
		font-weight: 650;
	}
	small {
		margin-left: auto;
		color: #919baa;
	}
</style>
