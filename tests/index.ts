import { describe } from 'manten';
import ts from 'typescript';

describe(`dtsroll using TypeScript ${ts.version}`, async () => {
	await import('./spec/utils.ts');
	await import('./spec/cli.ts');
	await import('./spec/node.ts');
	await import('./spec/vite.ts');
});
