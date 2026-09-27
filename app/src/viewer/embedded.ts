/** Frame detection works across origins without reading the parent's document. */
export function embeddedViewer(win: Window = window): boolean {
  if (new URLSearchParams(win.location.search).get('embed') === '1') return true;
  try { return win.self !== win.top; } catch { return true; }
}

export function setupEmbeddedViewer(root: HTMLElement, pause: () => void) {
  const drawer = document.createElement('details'); drawer.className = 'viewer-menu';
  const summary = document.createElement('summary'); summary.textContent = 'Controls';
  const contents = document.createElement('div'); contents.className = 'viewer-menu-content';
  drawer.append(summary, contents); root.append(drawer);
  // Move existing controls, retaining all wallet, inventory and debugging listeners.
  for (const selector of ['.management', '.assets-button', '.experience-toolbar', 'aside']) {
    const element = root.querySelector(selector); if (element) contents.append(element);
  }
  drawer.addEventListener('toggle', () => { if (drawer.open) pause(); });
  contents.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest('button');
    if (button?.matches('#build-toggle, .assets-button, #open-inventory, #portal-back')) drawer.open = false;
  });
  const link = root.querySelector<HTMLAnchorElement>('.brand a')!;
  link.textContent = 'Open in Atlas ↗'; link.target = '_blank'; link.rel = 'noopener noreferrer';
  const updateLink = () => { const url = new URL(window.location.href); url.searchParams.delete('embed'); link.href = url.href; };
  updateLink(); link.addEventListener('click', updateLink);
  root.querySelector('#enter')!.addEventListener('click', () => { drawer.open = false; });
  return drawer;
}
