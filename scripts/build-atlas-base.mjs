// Only public configuration is loaded here. Ordinary dev/build retain their mock defaults.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const configuration = fs.readFileSync(new URL('../docs/deployments/atlas-base.env.example', import.meta.url), 'utf8');
for (const line of configuration.split(/\r?\n/)) {
  if (!line.trim() || line.startsWith('#')) continue;
  const match = /^(VITE_[A-Z0-9_]+)=(.*)$/.exec(line);
  if (!match) throw new Error('Invalid public deployment configuration');
  process.env[match[1]] = match[2];
}
if (process.env.VITE_CHAIN_ID !== '8453' || process.env.VITE_WORLD_STATE_MODE !== 'onchain') throw new Error('Expected Base mainnet configuration');
const check = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'app/tsconfig.json'], { stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status ?? 1);
const { build } = await import('vite');
await build({ configFile: 'app/vite.config.ts' });
