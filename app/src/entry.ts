import { presentationMode } from './viewer/mode.ts';
let framed = true;
try { framed = window.self !== window.top; } catch { /* Cross-origin frames showcase the parcel. */ }
const mode = presentationMode(location.search, framed);
if (mode === 'showcase') void import('./viewer/showcase.ts');
else if (mode === 'world') void import('./main.ts');
else void import('./landing/main.ts');
