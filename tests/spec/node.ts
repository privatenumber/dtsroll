import fs from 'node:fs/promises';
import { expect, testSuite } from 'manten';
import { createFixture } from 'fs-fixture';
import outdent from 'outdent';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
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

		describe('sourcemaps', ({ test }) => {
			test('generates sourcemap when enabled', async () => {
				await using fixture = await createFixture({
					dist: {
						'index.d.ts': outdent`
						import { MyType } from './types.js';
						export declare const value: MyType;
						`,
						'types.d.ts': outdent`
						export type MyType = {
							name: string;
							count: number;
						};
						`,
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);

				// Should generate .d.ts.map file
				const mapPath = fixture.getPath('dist/index.d.ts.map');
				const mapExists = await fs.access(mapPath).then(() => true, () => false);
				expect(mapExists).toBe(true);

				// Output .d.ts should reference the sourcemap
				const dtsContent = await fixture.readFile('dist/index.d.ts', 'utf8');
				expect(dtsContent).toContain('//# sourceMappingURL=index.d.ts.map');

				// Sourcemap should be valid JSON with expected structure
				const mapContent = await fixture.readFile('dist/index.d.ts.map', 'utf8');
				const sourceMap = JSON.parse(mapContent);
				expect(sourceMap).toHaveProperty('version', 3);
				expect(sourceMap).toHaveProperty('sources');
				expect(sourceMap).toHaveProperty('mappings');

				// Verify sources contains the bundled files
				const sources = sourceMap.sources as string[];
				expect(sources.some((source: string) => source.endsWith('types.d.ts'))).toBe(true);
				expect(sources.some((source: string) => source.endsWith('index.d.ts'))).toBe(true);

				// Verify mappings can be parsed and are accurate
				const tracer = new TraceMap(sourceMap);

				// Find "type MyType" in output (line 1) - should map to types.d.ts
				const typeDefinitionOriginal = originalPositionFor(tracer, {
					line: 1,
					column: 0,
				});
				expect(typeDefinitionOriginal.source).toContain('types.d.ts');
				expect(typeDefinitionOriginal.line).toBe(1);

				// Find "name: string" in output - should map to types.d.ts line 2
				const lines = dtsContent.split('\n');
				const nameLineIndex = lines.findIndex(line => line.includes('name: string'));
				expect(nameLineIndex).toBeGreaterThan(-1);
				const nameOriginal = originalPositionFor(tracer, {
					line: nameLineIndex + 1,
					column: 0,
				});
				expect(nameOriginal.source).toContain('types.d.ts');
				expect(nameOriginal.line).toBe(2);

				// Find "declare const value" in output - should map to index.d.ts
				const valueLineIndex = lines.findIndex(line => line.includes('declare const value'));
				expect(valueLineIndex).toBeGreaterThan(-1);
				const valueOriginal = originalPositionFor(tracer, {
					line: valueLineIndex + 1,
					column: 0,
				});
				expect(valueOriginal.source).toContain('index.d.ts');
				expect(valueOriginal.line).toBe(2);
			});
		});
	});
});
