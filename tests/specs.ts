import { describe } from 'manten';

describe('dtsroll', async () => {
	await import('./spec/utils.js');
	await import('./spec/cli.js');
	await import('./spec/node.js');
	await import('./spec/vite.js');
});
