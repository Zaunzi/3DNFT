export const itemPages = [
	{ id: '1', source: 'dj-board', title: 'Afterhours', kind: 'DJ board' },
	{ id: '2', source: 'keyboard', title: 'Nocturne 88', kind: 'Keyboard' },
	{ id: '3', source: 'drumkit', title: 'Backbeat', kind: 'Drum kit' },
	{ id: '4', source: 'xylophone', title: 'Prism', kind: 'Xylophone' },
	{ id: '5', source: 'bongos', title: 'Barrio', kind: 'Bongos' }
] as const;

export function itemPage(id: string) {
	return itemPages.find((item) => item.id === id);
}
