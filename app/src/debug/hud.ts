import { getNeighbors, tokenIdToCoordinate } from '../world/coordinates.ts';
export function updateDebug(element: HTMLElement, token: number, x: number, z: number, seed: bigint, loaded: number[], fps: number) {
  const c = tokenIdToCoordinate(token), n = getNeighbors(c);
  element.textContent = `TOKEN       #${token}\nWORLD/PARCEL (${c.x}, ${c.z})\nGLOBAL X/Z  ${x.toFixed(2)} / ${z.toFixed(2)}\nN / S       ${n.north ?? 'edge'} / ${n.south ?? 'edge'}\nE / W       ${n.east ?? 'edge'} / ${n.west ?? 'edge'}\nSEED        ${seed}\nFPS         ${fps.toFixed(0)}\nLOADED (${loaded.length}) ${loaded.join(', ')}`;
}
