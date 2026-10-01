import { getAddress, isAddress, zeroAddress } from 'viem';
export type MintKind = 'parcel' | 'character' | 'item' | 'trinket';
export function mintInput(kind: MintKind, recipient: string, idText: string, quantityText: string) {
  if (!isAddress(recipient) || getAddress(recipient) === zeroAddress) throw new Error('Enter a valid, nonzero recipient address.');
  const integer = (value: string) => { if (!/^\d+$/.test(value)) throw new Error('IDs and quantities must be whole numbers.'); const n = BigInt(value); if (n >= 2n ** 256n) throw new Error('Number exceeds uint256.'); return n; };
  const id = integer(idText), quantity = kind === 'item' || kind === 'trinket' ? integer(quantityText) : 1n;
  if (kind === 'parcel' && id >= 5000n) throw new Error('Parcel IDs range from 0 to 4999.');
  if (kind === 'item' && (id < 1n || id > 6n || quantity < 1n || quantity > 1000000n)) throw new Error('Choose item 1–6 and quantity 1–1,000,000.');
  if (kind === 'trinket' && (id < 1n || id > 5n || quantity < 1n || quantity > 1000000n)) throw new Error('Choose trinket 1–5 and quantity 1–1,000,000.');
  return { recipient: getAddress(recipient), id, quantity };
}

export function parcelMintQuantity(text: string): bigint {
  if (!/^[1-5]$/.test(text)) throw new Error('Choose 1–5 parcels.');
  return BigInt(text);
}
