import { createServer } from 'vite';
// Explicitly overrides local deployment mode without editing the user's Base configuration.
process.env.VITE_WORLD_STATE_MODE = 'mock';
const server = await createServer({configFile:'app/vite.config.ts',server:{host:'127.0.0.1',port:5174,strictPort:false}});
await server.listen();server.printUrls();

