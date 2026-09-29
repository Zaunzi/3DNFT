import { error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { itemPage, itemPages } from '../catalog';
import type { RequestHandler } from './$types';

// The built endpoint lives under .svelte-kit/output, so a path relative to
// import.meta.url does not reach the repo static directory during prerender.
const staticRoot = join(process.cwd(), 'static');

export const prerender = true;
export const trailingSlash = 'always';

export function entries() {
	return itemPages.map((item) => ({ id: item.id }));
}

export const GET: RequestHandler = ({ params }) => {
	const item = itemPage(params.id);
	if (!item) error(404, 'Item not found');
	const html = readFileSync(join(staticRoot, item.source, 'index.html'));
	return new Response(html, { headers: { 'content-type': 'text/html' } });
};
