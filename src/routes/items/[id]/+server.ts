import { error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemPage, itemPages } from '../catalog';
import type { RequestHandler } from './$types';

const staticRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../static');

export const prerender = true;
export const trailingSlash = 'always';

export function entries() {
	return itemPages.map((item) => ({ id: item.id }));
}

export const GET: RequestHandler = ({ params }) => {
	const item = itemPage(params.id);
	if (!item) error(404, 'Item not found');
	const html = readFileSync(join(staticRoot, item.source, 'index.html'));
	return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
