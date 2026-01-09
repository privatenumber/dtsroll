import fs from 'node:fs/promises';
import { expect, testSuite } from 'manten';
import { createFixture } from 'fs-fixture';
import { build } from 'vite';
import dts from 'vite-plugin-dts';
import { dtsroll } from '#dtsroll/vite';

export default testSuite(({ describe }) => {
	describe('vite plugin', ({ test }) => {
		test('auto-detects inputs from package.json', async () => {
			await using fixture = await createFixture({
				'package.json': JSON.stringify({
					types: './dist/entry.d.ts',
				}),
				src: {
					'entry.ts': `
					import type { A } from './types.js';
					export const a: A = 1;
					`,
					'types.ts': 'export type A = number;',
				},
				'tsconfig.json': JSON.stringify({
					includes: ['src'],
				}),
			});

			await build({
				root: fixture.path,
				build: {
					lib: {
						entry: fixture.getPath('src/entry.ts'),
						formats: ['es'],
					},
				},
				plugins: [
					dts({
						tsconfigPath: fixture.getPath('tsconfig.json'),
					}),
					dtsroll(), // No inputs - should auto-detect from package.json
				],
			});

			const bundled = await fixture.readFile('dist/entry.d.ts', 'utf8');
			expect(bundled).toMatch('type A = number;');
		});

		test('only runs once for multiple output formats', async () => {
			await using fixture = await createFixture({
				src: {
					'entry.ts': `
					import type { A } from './types.js';
					export const a: A = 1;
					`,
					'types.ts': 'export type A = number;',
				},
				'tsconfig.json': JSON.stringify({
					includes: ['src'],
				}),
			});

			let dtsrollCallCount = 0;
			const trackingPlugin = {
				name: 'track-dtsroll',
				writeBundle: {
					sequential: true,
					order: 'post' as const,
					handler: () => {
						dtsrollCallCount += 1;
					},
				},
			};

			await build({
				root: fixture.path,
				build: {
					lib: {
						entry: fixture.getPath('src/entry.ts'),
						formats: ['es', 'cjs'], // Multiple formats
					},
				},
				plugins: [
					dts({
						tsconfigPath: fixture.getPath('tsconfig.json'),
					}),
					dtsroll({
						inputs: [fixture.getPath('dist/entry.d.ts')],
					}),
					trackingPlugin,
				],
			});

			// writeBundle is called for each format, but tracking plugin counts 2
			// dtsroll should only run once due to 'built' flag
			const files = await fs.readdir(fixture.getPath('dist'));
			const dtsFiles = files.filter(f => f.endsWith('.d.ts'));
			expect(dtsFiles).toHaveLength(1); // Should only be one .d.ts file
		});

		test('builds', async () => {
			await using fixture = await createFixture({
				src: {
					'entry.ts': `
					import type { A } from './types.js';
					export const a: A = 1;
					`,
					'types.ts': 'export type A = number;',
				},
				'tsconfig.json': JSON.stringify({
					includes: ['src'],
				}),
			});

			await build({
				root: fixture.path,
				build: {
					lib: {
						entry: fixture.getPath('src/entry.ts'),
						formats: ['es'],
					},
				},
				plugins: [
					dts({
						tsconfigPath: fixture.getPath('tsconfig.json'),
					}),
					dtsroll({
						inputs: [fixture.getPath('dist/entry.d.ts')],
					}),
				],
			});

			const bundled = await fixture.readFile('dist/entry.d.ts', 'utf8');
			expect(bundled).toMatch('type A = number;');
		});

		test('silent mode', async () => {
			await using fixture = await createFixture({
				src: {
					'entry.ts': `
					import type { A } from './types.js';
					export const a: A = 1;
					`,
					'types.ts': 'export type A = number;',
				},
				'tsconfig.json': JSON.stringify({
					includes: ['src'],
				}),
			});

			await build({
				root: fixture.path,
				logLevel: 'silent',
				build: {
					lib: {
						entry: fixture.getPath('src/entry.ts'),
						formats: ['es'],
					},
				},
				plugins: [
					dts({
						tsconfigPath: fixture.getPath('tsconfig.json'),
					}),
					dtsroll({
						inputs: [fixture.getPath('dist/entry.d.ts')],
					}),
				],
			});

			const bundled = await fixture.readFile('dist/entry.d.ts', 'utf8');
			expect(bundled).toMatch('type A = number;');
		});
	});
});
