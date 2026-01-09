import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, testSuite } from 'manten';
import { createFixture } from 'fs-fixture';
import outdent from 'outdent';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import nanoSpawn from 'nano-spawn';
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

			test('chains sourcemaps back to original .ts source files', async ({ onTestFail }) => {
				await using fixture = await createFixture({
					'tsconfig.json': JSON.stringify({
						compilerOptions: {
							declaration: true,
							declarationMap: true,
							outDir: 'dist',
							rootDir: 'src',
							target: 'ES2020',
							module: 'NodeNext',
							moduleResolution: 'NodeNext',
						},
						include: ['src'],
					}),
					src: {
						'index.ts': outdent`
						import { MyType } from './types.js';
						export const value: MyType = { name: 'test', count: 42 };
						`,
						'types.ts': outdent`
						export type MyType = {
							name: string;
							count: number;
						};
						`,
					},
				});

				// Run tsc to generate real .d.ts and .d.ts.map files
				await nanoSpawn(path.resolve('node_modules/.bin/tsc'), [], { cwd: fixture.path });

				onTestFail(() => console.log('Fixture path:', fixture.path));

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);

				// Read the final sourcemap
				const mapContent = await fixture.readFile('dist/index.d.ts.map', 'utf8');
				const sourceMap = JSON.parse(mapContent);

				// The final sourcemap should chain back to .ts files, not .d.ts files
				const sources = sourceMap.sources as string[];
				const pointsToTs = sources.some(
					(source: string) => source.endsWith('.ts') && !source.endsWith('.d.ts'),
				);
				const pointsToDts = sources.every((source: string) => source.endsWith('.d.ts'));

				// This is the key assertion: sources should point to .ts files
				expect(pointsToTs).toBe(true);
				expect(pointsToDts).toBe(false);

				// Verify we can trace back to the original .ts source
				const tracer = new TraceMap(sourceMap);
				const dtsContent = await fixture.readFile('dist/index.d.ts', 'utf8');
				const lines = dtsContent.split('\n');

				// Find MyType definition - should trace back to src/types.ts
				const typeLineIndex = lines.findIndex(line => line.includes('type MyType'));
				if (typeLineIndex !== -1) {
					const typeOriginal = originalPositionFor(tracer, {
						line: typeLineIndex + 1,
						column: 0,
					});
					expect(typeOriginal.source).toContain('types.ts');
					expect(typeOriginal.source).not.toContain('.d.ts');
				}
			});

			test('handles inline base64 sourcemap', async () => {
				const sourceMap = {
					version: 3,
					sources: ['../src/index.ts'],
					sourcesContent: ['export const a: string = "hello";'],
					mappings: 'AAAA',
					names: [],
				};
				const base64Map = Buffer.from(JSON.stringify(sourceMap)).toString('base64');

				await using fixture = await createFixture({
					dist: {
						'index.d.ts': outdent`
						export declare const a: string;
						//# sourceMappingURL=data:application/json;base64,${base64Map}
						`,
					},
					src: {
						'index.ts': 'export const a: string = "hello";',
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);

				const mapContent = await fixture.readFile('dist/index.d.ts.map', 'utf8');
				const outputMap = JSON.parse(mapContent);
				expect(outputMap.sources.some((s: string) => s.includes('src/index.ts'))).toBe(true);
			});

			test('handles inline URL-encoded sourcemap with commas in JSON', async () => {
				const sourceMap = {
					version: 3,
					sources: ['../src/a.ts', '../src/b.ts'],
					sourcesContent: ['export const a = 1;', 'export const b = 2;'],
					mappings: 'AAAA;ACAA',
					names: [],
				};
				const encodedMap = encodeURIComponent(JSON.stringify(sourceMap));

				await using fixture = await createFixture({
					dist: {
						'index.d.ts': outdent`
						export declare const a: number;
						export declare const b: number;
						//# sourceMappingURL=data:application/json;charset=utf-8,${encodedMap}
						`,
					},
					src: {
						'a.ts': 'export const a = 1;',
						'b.ts': 'export const b = 2;',
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);

				const mapContent = await fixture.readFile('dist/index.d.ts.map', 'utf8');
				const outputMap = JSON.parse(mapContent);
				// Should have both sources, not truncated at first comma
				expect(outputMap.sources.length).toBeGreaterThanOrEqual(2);
			});

			test('handles plain text data URL (no encoding specifier)', async () => {
				const sourceMap = {
					version: 3,
					sources: ['../src/index.ts'],
					sourcesContent: ['export const x: number = 42;'],
					mappings: 'AAAA',
					names: [],
				};
				// Plain text data URL - content is URL-encoded but no ;charset or ;base64
				const encodedMap = encodeURIComponent(JSON.stringify(sourceMap));

				await using fixture = await createFixture({
					dist: {
						'index.d.ts': outdent`
						export declare const x: number;
						//# sourceMappingURL=data:application/json,${encodedMap}
						`,
					},
					src: {
						'index.ts': 'export const x: number = 42;',
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);

				const mapContent = await fixture.readFile('dist/index.d.ts.map', 'utf8');
				const outputMap = JSON.parse(mapContent);
				expect(outputMap.sources.some((s: string) => s.includes('src/index.ts'))).toBe(true);
			});

			test('gracefully handles malformed JSON in sourcemap file', async () => {
				await using fixture = await createFixture({
					dist: {
						'index.d.ts': outdent`
						export declare const value: string;
						`,
						'index.d.ts.map': '{ invalid json here',
					},
				});

				// Should not throw, should complete build (just without chaining)
				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);
			});

			test('falls back to sourceMappingURL when .d.ts.map file missing', async () => {
				await using fixture = await createFixture({
					dist: {
						'index.d.ts': outdent`
						export declare const value: string;
						//# sourceMappingURL=maps/index.d.ts.map
						`,
						maps: {
							'index.d.ts.map': JSON.stringify({
								version: 3,
								sources: ['../../src/index.ts'],
								sourcesContent: ['export const value: string = "test";'],
								mappings: 'AAAA',
								names: [],
							}),
						},
					},
					src: {
						'index.ts': 'export const value: string = "test";',
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);

				const mapContent = await fixture.readFile('dist/index.d.ts.map', 'utf8');
				const outputMap = JSON.parse(mapContent);
				expect(outputMap.sources.some((s: string) => s.includes('src/index.ts'))).toBe(true);
			});

			test('ignores query string in comment when adjacent map file exists', async () => {
				await using fixture = await createFixture({
					dist: {
						'index.d.ts': outdent`
						export declare const value: string;
						//# sourceMappingURL=index.d.ts.map?v=12345
						`,
						'index.d.ts.map': JSON.stringify({
							version: 3,
							sources: ['../src/index.ts'],
							sourcesContent: ['export const value: string = "test";'],
							mappings: 'AAAA',
							names: [],
						}),
					},
					src: {
						'index.ts': 'export const value: string = "test";',
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);

				const mapContent = await fixture.readFile('dist/index.d.ts.map', 'utf8');
				const outputMap = JSON.parse(mapContent);
				expect(outputMap.sources.some((s: string) => s.includes('src/index.ts'))).toBe(true);
			});

			test('preserves sources for empty entry point files', async () => {
				// Rollup generates empty sourcemaps (sources: []) for empty chunks
				// This test ensures we preserve the original source references
				await using fixture = await createFixture({
					dist: {
						'index.d.ts': 'export {};\n',
						'index.d.ts.map': JSON.stringify({
							version: 3,
							file: 'index.d.ts',
							sources: ['../src/index.ts'],
							sourcesContent: [''],
							mappings: '',
							names: [],
						}),
					},
					src: {
						'index.ts': '',
					},
				});

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);

				const mapContent = await fixture.readFile('dist/index.d.ts.map', 'utf8');
				const outputMap = JSON.parse(mapContent);

				// Without the fix, sources would be [] (empty)
				// With the fix, sources should point to the original .ts file
				expect(outputMap.sources.length).toBeGreaterThan(0);
				expect(outputMap.sources.some((s: string) => s.includes('src/index.ts'))).toBe(true);
			});

			test('preserves sources for empty barrel file compiled with tsc', async ({ onTestFail }) => {
				// Real-world scenario: barrel file that becomes empty after bundling
				await using fixture = await createFixture({
					'tsconfig.json': JSON.stringify({
						compilerOptions: {
							declaration: true,
							declarationMap: true,
							outDir: 'dist',
							rootDir: 'src',
							target: 'ES2020',
							module: 'NodeNext',
							moduleResolution: 'NodeNext',
						},
						include: ['src'],
					}),
					src: {
						// Empty barrel file - common pattern for re-export entry points
						'index.ts': 'export {};',
					},
				});

				// Compile with tsc to generate real .d.ts and .d.ts.map
				await nanoSpawn(path.resolve('node_modules/.bin/tsc'), [], { cwd: fixture.path });

				onTestFail(() => console.log('Fixture path:', fixture.path));

				// Verify tsc generated the sourcemap
				const tscMapContent = await fixture.readFile('dist/index.d.ts.map', 'utf8');
				const tscMap = JSON.parse(tscMapContent);
				expect(tscMap.sources.length).toBeGreaterThan(0);

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);

				// After dtsroll, the sourcemap should still have sources
				const mapContent = await fixture.readFile('dist/index.d.ts.map', 'utf8');
				const outputMap = JSON.parse(mapContent);

				// Without the fix, Rollup would produce sources: []
				// With the fix, sources should still point to the original .ts file
				expect(outputMap.sources.length).toBeGreaterThan(0);
				expect(outputMap.sources.some((s: string) => s.endsWith('index.ts'))).toBe(true);
			});
		});
	});
});
