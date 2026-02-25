import { describe } from 'manten';

describe('dtsroll', async () => {
	await import('./spec/utils.ts');
	await import('./spec/cli.ts');
	await import('./spec/node.ts');
	await import('./spec/vite.ts');
});
