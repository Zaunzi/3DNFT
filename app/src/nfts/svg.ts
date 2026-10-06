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

/** Accept only embedded PNG background layers, never general SVG CSS. */
export function embeddedPNGLayers(style: string): string[] {
    let images: string[];
    const allowed: Record<string, string[]> = {
        'background-repeat': ['no-repeat'], 'background-size': ['contain'],
        'background-position': ['center'], 'image-rendering': ['pixelated', '-webkit-optimize-contrast', '-moz-crisp-edges'],
        '-ms-interpolation-mode': ['nearest-neighbor']
    };
    const values = new Map<string,string>();
    const match = /^background-image:((?:url\(data:image\/png;base64,[A-Za-z0-9+/=]+\),?)+);/.exec(style);
    if (!match) throw new Error('Unsupported SVG background');
    images = [...match[1].matchAll(/url\((data:image\/png;base64,[A-Za-z0-9+/=]+)\)/g)].map(m => m[1]);
    if (!images.length || images.length > 32 || match[1] !== images.map(uri => `url(${uri})`).join(',')) throw new Error('Unsupported SVG layers');
    for (const declaration of style.slice(match[0].length).split(';').filter(s => s.trim())) {
        const [name, value, extra] = declaration.trim().split(':');
        if (extra !== undefined || !allowed[name]?.includes(value)) throw new Error('Unsupported SVG background CSS');
        values.set(name,value);
    }
    if (values.get('background-repeat') !== 'no-repeat' || values.get('background-size') !== 'contain' || values.get('background-position') !== 'center') throw new Error('Unsupported SVG background layout');
    for (const uri of images) {
        const bytes=Uint8Array.from(atob(uri.slice(22)), c=>c.charCodeAt(0));
        if (bytes.length < 24 || bytes.length > MAX_SVG || ![137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b) || String.fromCharCode(...bytes.subarray(12,16)) !== 'IHDR') throw new Error('Invalid embedded PNG');
        const view=new DataView(bytes.buffer),w=view.getUint32(16),h=view.getUint32(20);
        if (!w || !h || w>2048 || h>2048 || w*h>1000000) throw new Error('Embedded PNG too large');
    }
    return images;
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
            if (node === source.documentElement && attr.name === 'version' && ['1.1','1.2'].includes(attr.value)) continue;
            if (node === source.documentElement && attr.name === 'style') {
                const layers=embeddedPNGLayers(attr.value);
                const width=Number(node.getAttribute('width')),height=Number(node.getAttribute('height'));
                if (!(width>0&&height>0&&width<=4096&&height<=4096)) throw new Error('Invalid background dimensions');
                // CSS draws its first background on top; SVG paints the last image on top.
                for (const uri of layers.reverse()) {
                    const image=output.createElementNS(SVG_NS,'image');
                    image.setAttribute('href',uri);image.setAttribute('width',String(width));image.setAttribute('height',String(height));
                    image.setAttribute('preserveAspectRatio','xMidYMid meet');image.setAttribute('image-rendering','pixelated');clean.appendChild(image);
                }
                continue;
            }
            // Source links, general CSS, handlers and animation remain unsupported.
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
