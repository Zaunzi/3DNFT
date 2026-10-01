import './style.css';

document.title='Doodverse — A world to make your own';
document.querySelector('#app')!.innerHTML=`
<div class="landing">
<nav aria-label="Main navigation"><a class="logo" href="./">◈ DOODVERSE</a><div><a href="#discover">Discover</a><a href="./mint.html">Mint assets ↗</a><a class="nav-enter" href="?mode=world">Enter world ↗</a></div></nav>
<main>
<section class="hero" aria-labelledby="hero-title">
<div class="hero-copy"><p class="eyebrow"><span class="dot"></span> ONE SHARED WORLD · BUILT ON BASE</p><h1 id="hero-title">A little land.<br>A world of<br><em>possibility.</em></h1><p class="intro">Find your place in Doodverse. Build a home, bring your NFTs to life, and step through a portal to somewhere new.</p><div class="actions"><a class="button primary" href="?mode=world">Enter the world <span>↗</span></a><a class="button secondary" href="./mint.html">Mint a parcel <span>+</span></a></div><p class="entry-note">Explore without a wallet. Connect when you’re ready to build.</p></div>
<div class="hero-art"><span class="art-label">LIVE FROM PARCEL #1</span>
<iframe class="parcel-preview" src="?mode=showcase&tokenId=1&hero=1" title="Live view of Doodverse parcel 1. Drag to orbit." loading="lazy"></iframe><div class="art-caption"><span>5,000 parcels. One continuous world.</span><span>64 × 64 ↗</span></div><p class="illustration-note">Drag to orbit · <a href="?mode=world&tokenId=1">Visit parcel #1 ↗</a></p></div>
</section>
<section class="discover" id="discover" aria-labelledby="discover-title"><div class="section-heading"><p class="eyebrow">MORE THAN A COLLECTIBLE</p><h2 id="discover-title">Make yourself at home.</h2></div><div class="features"><article><span class="feature-number">01 / BUILD</span><h3>Start with a place.</h3><p>Your parcel is a real location in a continuous procedural world. Place foundations, raise walls, and make it yours.</p></article><article><span class="feature-number">02 / BRING IT TO LIFE</span><h3>Put your NFTs in the world.</h3><p>Display art, place characters, and play your instruments. Attached assets stay with the land when ownership changes.</p></article><article><span class="feature-number">03 / EXPLORE</span><h3>There’s more next door.</h3><p>Walk across parcel borders or build a portal. Your place is part of something bigger.</p></article></div></section>
<section class="visit" aria-labelledby="visit-title"><div><p class="eyebrow">KNOW WHERE YOU’RE GOING?</p><h2 id="visit-title">Visit a parcel.</h2><p>Enter a parcel ID from 0 to 4,999 to jump into the world.</p></div><form action="" method="get"><input type="hidden" name="mode" value="world"><label for="visit-token">Parcel ID</label><div class="visit-input"><input id="visit-token" name="tokenId" type="number" min="0" max="4999" step="1" placeholder="e.g. 742" required><button class="button primary" type="submit">Visit ↗</button></div></form></section>
</main><footer><a class="logo" href="./">◈ DOODVERSE</a><span>An experimental world on Base. Built to be explored.</span><a href="./mint.html">Mint assets ↗</a></footer>
</div>`;
