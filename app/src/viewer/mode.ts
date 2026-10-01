export type PresentationMode = 'landing' | 'showcase' | 'world';
export function presentationMode(search: string, framed: boolean): PresentationMode {
  const params = new URLSearchParams(search);
  if (params.get('mode') === 'world') return 'world';
  if (params.get('mode') === 'showcase' || params.get('embed') === '1' || framed) return 'showcase';
  if (params.has('tokenId') || params.has('chain') || params.has('contract')) return 'world';
  return 'landing';
}
