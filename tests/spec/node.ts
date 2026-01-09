import { expect, testSuite } from 'manten';
import { createFixture } from 'fs-fixture';
import outdent from 'outdent';
import * as fixtures from '../fixtures.js';
import { dtsroll } from '#dtsroll';

export default testSuite(({ describe }) => {
	describe('node', ({ describe, test }) => {
		test('Single entry-point', async () => {
			await using fixture = await createFixture(fixtures.singleEntryPoint);

			const generated = await dtsroll({
				inputs: [fixture.getPath('dist/entry.d.ts')],
			});

			expect(generated).toMatchObject({
				size: {
					input: 207,
					output: 118,
				},
			});
		});

		test('Multiple entry-point', async () => {
			await using fixture = await createFixture(fixtures.multipleEntryPoints);

			const generated = await dtsroll({
				inputs: [fixture.getPath('./dist/index.d.ts'), fixture.getPath('./dist/some-dir/index.d.ts')],
			});

			/**
			 * Output is slightly bigger because the input is so small
			 * and the built snytax is more verbose
			 * e.g. type a = 1; export { a as b }  vs export type b = 1;
			 */
			expect(generated).toMatchObject({
				size: {
					input: 288,
					output: 320,
				},
			});
		});

		describe('subpath imports', ({ test }) => {
			/**
			 * Without special handling, node-resolve doesn't resolve the .d.ts
			 * extension for subpath imports, causing rollup-plugin-dts to see
			 * them as different modules and creating duplicate type definitions.
			 */
			test('should not duplicate types from subpath imports', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						imports: {
							'#*': './dist/*',
						},
					}),
					dist: {
						'index.d.ts': outdent`
						import { MyEnum } from './components/types.js';
						export declare const a: MyEnum;
						`,
						'consumer.d.ts': outdent`
						import { MyEnum } from '#components/types.js';
						export declare const b: MyEnum;
						`,
						'components/types.d.ts': outdent`
						export declare enum MyEnum {
							A = "A",
							B = "B"
						}
						`,
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [
						fixture.getPath('dist/index.d.ts'),
						fixture.getPath('dist/consumer.d.ts'),
					],
				});

				expect('error' in generated).toBe(false);
				if ('error' in generated) {
					return;
				}

				const indexContent = await fixture.readFile('dist/index.d.ts', 'utf8');
				const consumerContent = await fixture.readFile('dist/consumer.d.ts', 'utf8');
				const combinedContent = indexContent + consumerContent;

				// Should not have duplicated enum declarations
				const enumMatches = combinedContent.match(/enum MyEnum/g);
				expect(enumMatches?.length ?? 0).toBeLessThanOrEqual(1);

				// Should share a common chunk instead of inlining duplicates
				expect(generated.output.chunks.length).toBeGreaterThan(0);
			});

			test('should resolve .mjs to .d.mts', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						imports: {
							'#*': './dist/*',
						},
					}),
					dist: {
						'index.d.mts': outdent`
						import { MyType } from '#types.mjs';
						export declare const a: MyType;
						`,
						'types.d.mts': 'export type MyType = string;',
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.mts')],
				});

				expect('error' in generated).toBe(false);
			});

			test('should resolve .cjs to .d.cts', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						imports: {
							'#*': './dist/*',
						},
					}),
					dist: {
						'index.d.cts': outdent`
						import { MyType } from '#types.cjs';
						export declare const a: MyType;
						`,
						'types.d.cts': 'export type MyType = string;',
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.cts')],
				});

				expect('error' in generated).toBe(false);
			});

			test('should fall back to .ts if .d.ts does not exist', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						imports: {
							'#*': './dist/*',
						},
					}),
					dist: {
						'index.d.ts': outdent`
						import { MyType } from '#types.js';
						export declare const a: MyType;
						`,
						// Note: types.ts instead of types.d.ts
						'types.ts': 'export type MyType = string;',
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
				});

				expect('error' in generated).toBe(false);
			});

			test('should use types condition over default', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						imports: {
							'#types': {
								types: './dist/types.d.ts',
								default: './dist/types.js',
							},
						},
					}),
					dist: {
						'index.d.ts': outdent`
						import { MyType } from '#types';
						export declare const a: MyType;
						`,
						'types.d.ts': 'export type MyType = string;',
						'types.js': 'export const MyType = "not-a-type";',
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
				});

				expect('error' in generated).toBe(false);
				const content = await fixture.readFile('dist/index.d.ts', 'utf8');
				expect(content).toContain('type MyType = string');
			});

			test('should externalize unresolvable subpath imports', async () => {
				await using fixture = await createFixture({
					'package.json': JSON.stringify({
						imports: {
							'#utils': './dist/utils.js',
						},
					}),
					dist: {
						'index.d.ts': outdent`
						import { MyType } from '#nonexistent';
						export declare const a: MyType;
						`,
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
				});

				// Unresolvable subpath imports are left as external (warning is logged)
				expect('error' in generated).toBe(false);
				const content = await fixture.readFile('dist/index.d.ts', 'utf8');
				expect(content).toContain("from '#nonexistent'");
			});

			test('should work without package.json', async () => {
				await using fixture = await createFixture({
					dist: {
						'index.d.ts': outdent`
						import { MyType } from './types.js';
						export declare const a: MyType;
						`,
						'types.d.ts': 'export type MyType = string;',
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
				});

				expect('error' in generated).toBe(false);
				const content = await fixture.readFile('dist/index.d.ts', 'utf8');
				expect(content).toContain('type MyType = string');
			});
		});
	});
});
