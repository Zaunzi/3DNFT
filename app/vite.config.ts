import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: 'app', base: './', server: { host: '127.0.0.1', port: 5173, strictPort: true }, build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: { world: fileURLToPath(new URL('./index.html', import.meta.url)), mint: fileURLToPath(new URL('./mint.html', import.meta.url)) } } } });
