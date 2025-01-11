import { expect, testSuite } from 'manten';
import { createFixture } from 'fs-fixture';
import { build } from 'vite';
import dts from 'vite-plugin-dts';
import { dtsroll } from '#dtsroll/vite';

export default testSuite(({ describe }) => {
	describe('vite plugin', ({ test }) => {
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
