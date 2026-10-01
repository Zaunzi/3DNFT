import './style.css';

// A lightweight illustration, not another WebGL scene. World state loads only on entry.
const trees = [[172,244,1],[240,189,.8],[300,160,.7],[478,224,1.1],[513,300,.8],[208,334,.7],[395,329,.65]];
const forest = trees.map(([x,y,s])=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="8" rx="26" ry="10" fill="#172f26" opacity=".22"/><path d="M-4 0h8v-26h-8" fill="#655336"/><path d="M0-95 29-24H-29Z" fill="#244d3b"/><path d="M0-95 0-24H29Z" fill="#36654a"/><path d="M0-114 22-57H-22Z" fill="#48744d"/></g>`).join('');
document.title='Doodverse — A world to make your own';
document.querySelector('#app')!.innerHTML=`
<div class="landing">
<nav aria-label="Main navigation"><a class="logo" href="./">◈ DOODVERSE</a><div><a href="#discover">Discover</a><a href="./mint.html">Mint assets ↗</a><a class="nav-enter" href="?mode=world">Enter world ↗</a></div></nav>
<main>
<section class="hero" aria-labelledby="hero-title">
<div class="hero-copy"><p class="eyebrow"><span class="dot"></span> ONE SHARED WORLD · BUILT ON BASE</p><h1 id="hero-title">A little land.<br>A world of<br><em>possibility.</em></h1><p class="intro">Find your place in Doodverse. Build a home, bring your NFTs to life, and step through a portal to somewhere new.</p><div class="actions"><a class="button primary" href="?mode=world">Enter the world <span>↗</span></a><a class="button secondary" href="./mint.html">Mint a parcel <span>+</span></a></div><p class="entry-note">Explore without a wallet. Connect when you’re ready to build.</p></div>
<div class="hero-art"><span class="art-label">YOUR CORNER OF THE DOODVERSE</span>
<svg viewBox="0 0 680 500" role="img" aria-label="Illustration of a green parcel with a home, trees and a glowing portal">
<defs><linearGradient id="grass" x2="1" y2="1"><stop stop-color="#b9ca83"/><stop offset="1" stop-color="#6f945b"/></linearGradient><radialGradient id="portal"><stop stop-color="#173d47"/><stop offset=".7" stop-color="#2d9b94"/><stop offset="1" stop-color="#b7f4cf"/></radialGradient></defs>
<ellipse cx="345" cy="421" rx="240" ry="39" fill="#061e18" opacity=".45"/>
<path d="m85 314 300 105 225-144v48L385 468 85 361Z" fill="#40543b"/><path d="m385 419 225-144v48L385 468Z" fill="#2b4131"/>
<path d="m85 314 224-149 301 110-225 144Z" fill="url(#grass)"/>
<g fill="none" stroke="#e6e9b9" stroke-width="1" opacity=".35"><path d="m160 264 300 108M235 215l300 107M185 349l223-148M286 384l223-148"/></g>
<path d="m296 365 44-29 55 19 23-14 28 10-68 44Z" fill="#c4bb8a"/>
<g><path d="m291 291 75 27 61-40-75-27Z" fill="#d3c491"/><path d="m291 291 75 27v-66l-75-27Z" fill="#ead8a8"/><path d="m366 318 61-40v-65l-61 39Z" fill="#b6a67a"/><path d="m275 228 79-71 84 52-72 46Z" fill="#345c4b"/><path d="m275 228 79-71 12 98Z" fill="#537962"/><path d="m319 301 24 9v-44l-24-8Z" fill="#755235"/><path d="m383 258 26-17v23l-26 17Z" fill="#76aca0"/><path d="m298 257 13 5v18l-13-5Z" fill="#e9ce73"/><circle cx="338" cy="287" r="2" fill="#ead8a8"/></g>
${forest}
<g class="portal-glow" transform="translate(435 350) rotate(15)"><ellipse cy="4" rx="30" ry="11" fill="#466341"/><ellipse cy="-35" rx="24" ry="38" fill="url(#portal)" stroke="#d1edb3" stroke-width="5"/><ellipse cy="-35" rx="17" ry="29" fill="none" stroke="#81d8b7" stroke-width="1"/></g>
<g fill="#81917a"><path d="m253 319 9-12 14 6 2 10-13 6Z"/><path d="m473 280 9-8 14 6-6 10Z"/><path d="m338 392 7-7 13 4-3 8Z"/></g>
</svg><div class="art-caption"><span>5,000 parcels. One continuous world.</span><span>64 × 64 ↗</span></div><p class="illustration-note">A glimpse of what you could build · illustration</p></div>
</section>
<section class="discover" id="discover" aria-labelledby="discover-title"><div class="section-heading"><p class="eyebrow">MORE THAN A COLLECTIBLE</p><h2 id="discover-title">Make yourself at home.</h2></div><div class="features"><article><span class="feature-number">01 / BUILD</span><h3>Start with a place.</h3><p>Your parcel is a real location in a continuous procedural world. Place foundations, raise walls, and make it yours.</p></article><article><span class="feature-number">02 / BRING IT TO LIFE</span><h3>Put your NFTs in the world.</h3><p>Display art, place characters, and play your instruments. Attached assets stay with the land when ownership changes.</p></article><article><span class="feature-number">03 / EXPLORE</span><h3>There’s more next door.</h3><p>Walk across parcel borders or build a portal. Your place is part of something bigger.</p></article></div></section>
<section class="visit" aria-labelledby="visit-title"><div><p class="eyebrow">KNOW WHERE YOU’RE GOING?</p><h2 id="visit-title">Visit a parcel.</h2><p>Enter a parcel ID from 0 to 4,999 to jump into the world.</p></div><form action="" method="get"><input type="hidden" name="mode" value="world"><label for="visit-token">Parcel ID</label><div class="visit-input"><input id="visit-token" name="tokenId" type="number" min="0" max="4999" step="1" placeholder="e.g. 742" required><button class="button primary" type="submit">Visit ↗</button></div></form></section>
</main><footer><a class="logo" href="./">◈ DOODVERSE</a><span>An experimental world on Base. Built to be explored.</span><a href="./mint.html">Mint assets ↗</a></footer>
</div>`;
