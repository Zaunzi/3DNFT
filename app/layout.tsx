import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Cloudacre — A little land, a living world',description:'Grow, harvest, and evolve your own floating 3D farm. A playable NFT concept with demo resources.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
