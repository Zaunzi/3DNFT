// Fold all 256 seed bits, rather than silently discarding the high bits.
export function seed32(seed: bigint): number {
  if (seed < 0n || seed >= 1n << 256n) throw new RangeError('Seed must be uint256');
  let h = 2166136261;
  for (let i = 0; i < 32; i++) { h = Math.imul(h ^ Number(seed & 255n), 16777619); seed >>= 8n; }
  return h >>> 0;
}
export function hash(x: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0;
}
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function gradient(h: number, x: number, z: number) { const a = h & 7; return a < 4 ? ((a & 1) ? -x : x) + ((a & 2) ? -z : z) : (a & 1 ? x : z) * (a & 2 ? -1 : 1); }
export function perlin(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), dx = x - ix, dz = z - iz;
  return mix(mix(gradient(hash(ix, iz, seed), dx, dz), gradient(hash(ix + 1, iz, seed), dx - 1, dz), fade(dx)), mix(gradient(hash(ix, iz + 1, seed), dx, dz - 1), gradient(hash(ix + 1, iz + 1, seed), dx - 1, dz - 1), fade(dx)), fade(dz));
}
