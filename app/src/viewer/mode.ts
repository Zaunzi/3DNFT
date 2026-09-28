export type PresentationMode = 'showcase' | 'world';
export function presentationMode(search: string, framed: boolean): PresentationMode {
  const params = new URLSearchParams(search);
  if (params.get('mode') === 'world') return 'world';
  if (params.get('mode') === 'showcase' || params.get('embed') === '1' || framed) return 'showcase';
  return 'world';
}
