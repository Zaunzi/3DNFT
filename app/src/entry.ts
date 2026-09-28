import { presentationMode } from './viewer/mode.ts';
let framed = true;
try { framed = window.self !== window.top; } catch { /* Cross-origin frames showcase the parcel. */ }
if (presentationMode(location.search, framed) === 'showcase') void import('./viewer/showcase.ts');
else void import('./main.ts');
