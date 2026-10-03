const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_SVG = 128 * 1024;
const tags = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'title', 'desc']);
const attributes = new Set(['viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'transform', 'preserveAspectRatio']);

/** Decode only bounded SVG data images. No recursive URLs or other data media. */
export function decodeSVGDataURL(uri: string): string {
    if (uri.length > MAX_SVG * 3) throw new Error('SVG too large');
    const match = /^data:image\/svg\+xml(?:;(base64|utf8|charset=utf-8))?,([\s\S]*)$/i.exec(uri);
    if (!match) throw new Error('Unsupported data image');
    const text = match[1]?.toLowerCase() === 'base64'
        ? new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(match[2]), c => c.charCodeAt(0)))
        : decodeURIComponent(match[2]);
    if (new TextEncoder().encode(text).length > MAX_SVG) throw new Error('SVG too large');
    return text;
}

/** Rebuild a small static geometry subset in a fresh document, never insert source SVG in the page. */
export function sanitizeSVG(text: string): string {
    if (new TextEncoder().encode(text).length > MAX_SVG || /<!|<\?/.test(text)) throw new Error('Unsupported SVG declarations');
    const source = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (source.querySelector('parsererror') || source.documentElement.localName !== 'svg') throw new Error('Invalid SVG');
    const output = document.implementation.createDocument(SVG_NS, 'svg');
    let count = 0;
    function copy(node: Element, depth: number): Element {
        if (++count > 2048 || depth > 24 || node.namespaceURI !== SVG_NS || !tags.has(node.localName)) throw new Error('Unsupported SVG element');
        const clean = output.createElementNS(SVG_NS, node.localName);
        for (const attr of Array.from(node.attributes)) {
            if (attr.name === 'xmlns' && attr.value === SVG_NS) continue;
            // No CSS, event handlers, links, paint servers, embedded images, filters or animation.
            if (attr.namespaceURI || !attributes.has(attr.name) || !/^[a-zA-Z0-9#.,+\-\s()%]*$/.test(attr.value) || /url\s*\(/i.test(attr.value)) throw new Error('Unsupported SVG attribute');
            clean.setAttribute(attr.name, attr.value);
        }
        for (const child of Array.from(node.children)) clean.appendChild(copy(child, depth + 1));
        if (node.localName === 'title' || node.localName === 'desc') clean.textContent = node.textContent?.slice(0, 1000) ?? '';
        return clean;
    }
    const root = copy(source.documentElement, 0);
    if (!root.hasAttribute('viewBox')) {
        const width = Number(root.getAttribute('width')), height = Number(root.getAttribute('height'));
        if (!(width > 0 && height > 0 && width <= 4096 && height <= 4096)) throw new Error('Invalid SVG dimensions');
        root.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
    const view = root.getAttribute('viewBox')!.trim().split(/[\s,]+/).map(Number);
    if (view.length !== 4 || view.some(n => !Number.isFinite(n) || Math.abs(n) > 100000) || view[2] <= 0 || view[3] <= 0) throw new Error('Invalid SVG viewBox');
    root.setAttribute('width', '512'); root.setAttribute('height', '512');
    return new XMLSerializer().serializeToString(root);
}

export async function rasterizeSVG(text: string): Promise<ImageBitmap> {
    const url = URL.createObjectURL(new Blob([sanitizeSVG(text)], { type: 'image/svg+xml' }));
    const image = new Image();
    try {
        await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(() => { image.src = ''; reject(new Error('SVG decode timed out')); }, 8000);
            image.onload = () => { clearTimeout(timer); resolve(); };
            image.onerror = () => { clearTimeout(timer); reject(new Error('SVG decode failed')); };
            image.src = url;
        });
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
        canvas.getContext('2d')!.drawImage(image, 0, 0, 512, 512);
        // Three.js cannot apply Texture.flipY to ImageBitmap; orient during decoding.
        return await createImageBitmap(canvas, { imageOrientation: 'flipY' });
    } finally { URL.revokeObjectURL(url); }
}
