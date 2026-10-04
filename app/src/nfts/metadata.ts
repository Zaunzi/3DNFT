import {basePaintRelayURL} from './basepaint.ts';
import { assetKey, type NFTAsset } from './model.ts';
import { decodeSVGDataURL, rasterizeSVG } from './svg.ts';
export interface SafeMetadata {
    name: string;
    description: string;
    image?: string;
    attributes: {
        trait_type: string;
        value: string;
    }[];
}
export const FALLBACK: SafeMetadata = { name: 'Unknown NFT', description: 'Metadata unavailable or unsupported', attributes: [] };
const MAX_JSON = 128 * 1024, MAX_IMAGE = 4 * 1024 * 1024;
export function resolveURL(value: string, gateway: string): string {
    if (value.length > 2048)
        throw new Error('URL too long');
    if (value.startsWith('ipfs://')) {
        const path = value.slice(7).replace(/^ipfs\//, '');
        if (path.split('/').some(part => part === '.' || part === '..') || !/^[a-zA-Z0-9]+(?:\/[a-zA-Z0-9._~-]+)*$/.test(path))
            throw new Error('Invalid IPFS path');
        const base = new URL(gateway);
        if (base.protocol !== 'https:' || base.username || base.password)
            throw new Error('Invalid gateway');
        return `${base.href.replace(/\/$/, '')}/${path}`;
    }
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error('Unsupported URL');
    return url.href;
}
export function parseMetadata(text: string, gateway: string): SafeMetadata {
    if (new TextEncoder().encode(text).length > MAX_JSON)
        throw new Error('Metadata too large');
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error('Invalid metadata');
    const obj = raw as Record<string, unknown>;
    const str = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
    let image: string | undefined;
    try {
        if (typeof obj.image === 'string') {
            if (obj.image.startsWith('data:')) { decodeSVGDataURL(obj.image); image = obj.image; }
            else image = resolveURL(obj.image, gateway);
        }
    }
    catch { /* Unsupported media never becomes an executable resource. */ }
    return { name: str(obj.name, 120) || 'Unknown NFT', description: str(obj.description, 1000), image, attributes: Array.isArray(obj.attributes) ? obj.attributes.slice(0, 32).flatMap(a => a && typeof a === 'object' && typeof a.trait_type === 'string' && ['string', 'number', 'boolean'].includes(typeof a.value) ? [{ trait_type: str(a.trait_type, 80), value: String(a.value).slice(0, 160) }] : []) : [] };
}
async function fetchSingle(url: string, limit: number): Promise<{
    bytes: Uint8Array;
    type: string;
}> {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > limit)
        throw new Error('Resource unavailable or too large');
    if (!response.body)
        throw new Error('Empty resource');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.length;
            if (size > limit)
                throw new Error('Resource too large');
            chunks.push(value);
        }
    }
    finally {
        await reader.cancel();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of chunks) {
        bytes.set(part, offset);
        offset += part.length;
    }
    return { bytes, type: response.headers.get('content-type')?.split(';')[0].toLowerCase() ?? '' };
}
/** Retry content-addressed IPFS resources, never arbitrary website URLs.
 * Every attempt retains the same byte limits, timeouts and no-redirect policy. */
export function ipfsCandidates(url:string):string[]{
    const parsed=new URL(url),match=/^\/ipfs\/([a-zA-Z0-9]+(?:\/[a-zA-Z0-9._~-]+)*)$/.exec(parsed.pathname);
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||!match||parsed.search||parsed.hash)return [url];
    return [...new Set([url,...['https://gateway.pinata.cloud/ipfs/','https://ipfs.filebase.io/ipfs/'].map(base=>base+match[1])])];
}
async function boundedFetch(url:string,limit:number){
    let failure:unknown;
    const relay=basePaintRelayURL(url,import.meta.env?.VITE_MULTIPLAYER_URL);
    for(const candidate of relay?[relay,...ipfsCandidates(url)]:ipfsCandidates(url)){
        try{return await fetchSingle(candidate,limit);}catch(error){failure=error;}
    }
    throw failure;
}
export async function loadMetadata(uri: string, gateway: string): Promise<SafeMetadata> {
    if (uri.length > MAX_JSON * 3)
        throw new Error('Metadata too large');
    let text: string;
    if (uri.startsWith('data:application/json;base64,')) {
        const bytes = Uint8Array.from(atob(uri.slice(29)), c => c.charCodeAt(0));
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    else if (uri.startsWith('data:application/json;utf8,'))
        text = decodeURIComponent(uri.slice(27));
    else {
        const result = await boundedFetch(resolveURL(uri, gateway), MAX_JSON);
        text = new TextDecoder('utf-8', { fatal: true }).decode(result.bytes);
    }
    return parseMetadata(text, gateway);
}
/** Cache promises as well as results to deduplicate neighboring-parcel requests. Failures expire sooner. */
export class MetadataCache {
    hits = 0;
    misses = 0;
    private cache = new Map<string, {
        expires: number;
        value: Promise<SafeMetadata>;
    }>();
    private uri: (asset: NFTAsset) => Promise<string>;
    private gateway: string;
    private clock: () => number;
    constructor(uri: MetadataCache['uri'], gateway: string, clock = Date.now) { this.uri = uri; this.gateway = gateway; this.clock = clock; }
    get(asset: NFTAsset) {
        const key = assetKey(asset), entry = this.cache.get(key);
        if (entry && entry.expires > this.clock()) {
            this.hits++;
            return entry.value;
        }
        this.misses++;
        const record = { expires: this.clock() + 300000, value: Promise.resolve(FALLBACK) };
        record.value = this.uri(asset).then(uri => loadMetadata(uri, this.gateway)).catch(() => { record.expires = this.clock() + 30000; return { ...FALLBACK }; });
        if (this.cache.size >= 256)
            this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, record);
        return record.value;
    }
}
/** PNG/JPEG or a strictly validated static SVG rasterized into a bounded texture. */
export async function loadSafeImage(url: string): Promise<ImageBitmap> {
    if (url.startsWith('data:')) return rasterizeSVG(decodeSVGDataURL(url));
    const { bytes, type } = await boundedFetch(resolveURL(url, 'https://ipfs.io/ipfs/'), MAX_IMAGE);
    if (type === 'image/svg+xml') return rasterizeSVG(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const png = type === 'image/png' && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpeg = type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!png && !jpeg)
        throw new Error('Unsupported image');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let width = 0, height = 0;
    if (png && bytes.length >= 24) {
        width = view.getUint32(16);
        height = view.getUint32(20);
    }
    if (jpeg) {
        let offset = 2;
        while (offset + 4 < bytes.length) {
            if (bytes[offset++] !== 255)
                break;
            const marker = bytes[offset++];
            if (marker === 0xd9 || marker === 0xda)
                break;
            const length = view.getUint16(offset);
            if (length < 2 || offset + length > bytes.length)
                break;
            if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 7) {
                height = view.getUint16(offset + 3);
                width = view.getUint16(offset + 5);
                break;
            }
            offset += length;
        }
    }
    if (width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 8000000)
        throw new Error('Unsupported image dimensions');
    // Decode to a bounded output texture; the compressed download is capped as well.
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }), { imageOrientation: 'flipY', resizeWidth: 512, resizeHeight: 512, resizeQuality: 'low' });
    if (bitmap.width > 2048 || bitmap.height > 2048) {
        bitmap.close();
        throw new Error('Image too large');
    }
    return bitmap;
}
