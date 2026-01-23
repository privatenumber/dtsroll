import fs from 'node:fs/promises';
import { expect, testSuite } from 'manten';
import { createFixture } from 'fs-fixture';
import outdent from 'outdent';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { readSourceMap } from '../utils/read-sourcemap.js';
import * as fixtures from '../fixtures.js';
import { tsc } from '../utils/tsc.js';
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
				const sourceMap = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));
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
				await tsc(fixture.path);

				onTestFail(() => console.log('Fixture path:', fixture.path));

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);

				// Read the final sourcemap
				const sourceMap = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));

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

				const outputMap = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));
				expect(outputMap.sources.some(s => s?.includes('src/index.ts'))).toBe(true);
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

				const outputMap = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));
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

				const outputMap = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));
				expect(outputMap.sources.some(s => s?.includes('src/index.ts'))).toBe(true);
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

				const outputMap = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));
				expect(outputMap.sources.some(s => s?.includes('src/index.ts'))).toBe(true);
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

				const outputMap = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));
				expect(outputMap.sources.some(s => s?.includes('src/index.ts'))).toBe(true);
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

				const outputMap = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));

				// Without the fix, sources would be [] (empty)
				// With the fix, sources should point to the original .ts file
				expect(outputMap.sources.length).toBeGreaterThan(0);
				expect(outputMap.sources.some(s => s?.includes('src/index.ts'))).toBe(true);
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
				await tsc(fixture.path);

				onTestFail(() => console.log('Fixture path:', fixture.path));

				// Verify tsc generated the sourcemap
				const tscMap = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));
				expect(tscMap.sources.length).toBeGreaterThan(0);

				const generated = await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				expect('error' in generated).toBe(false);

				// After dtsroll, the sourcemap should still have sources
				const outputMap = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));

				// Without the fix, Rollup would produce sources: []
				// With the fix, sources should still point to the original .ts file
				expect(outputMap.sources.length).toBeGreaterThan(0);
				expect(outputMap.sources.some(s => s?.endsWith('index.ts'))).toBe(true);
			});

			test('sourcemap has line-by-line mappings for Go-to-Definition', async ({ onTestFail }) => {
				// This test validates that sourcemaps have proper line-by-line mappings
				// so VSCode's Go-to-Definition works correctly
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
						'index.ts': `export type User = {
	id: string;
	name: string;
};
`,
					},
				});

				onTestFail(() => console.log('Fixture:', fixture.path));

				// Compile with tsc
				await tsc(fixture.path);

				// Run dtsroll
				await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				const map = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));

				// The bundled output should have:
				// Line 1: type User = {
				// Line 2:     id: string;
				// Line 3:     name: string;
				// Line 4: };
				// Line 5: (empty)
				// Line 6: export type { User };

				// Each line with content should have at least one mapping
				// Currently rollup-plugin-dts only maps line 1, leaving lines 2-4 unmapped
				const mappingLines = map.mappings.split(';');

				// Count lines that have mappings (non-empty segments)
				const linesWithMappings = mappingLines.filter((line: string) => line.length > 0).length;

				// We expect at least 4 lines to have mappings (the type definition lines)
				// Currently this fails because rollup-plugin-dts only generates mappings for line 1
				expect(linesWithMappings).toBeGreaterThanOrEqual(4);
			});

			test('re-exported types map back to original definition file', async ({ onTestFail }) => {
				// Test that when a type is re-exported through a barrel file,
				// the sourcemap points to the original definition, not the re-export
				//
				// src/types.ts: defines User
				// src/index.ts: export { User } from './types'
				//
				// After bundling, clicking User should jump to types.ts, not index.ts
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
						'types.ts': `export type User = {
	id: string;
	name: string;
};
`,
						'index.ts': `export { User } from './types.js';
`,
					},
				});

				onTestFail(() => console.log('Fixture:', fixture.path));

				// Compile with tsc
				await tsc(fixture.path);

				// Run dtsroll
				await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/index.d.ts')],
					sourcemap: true,
				});

				// Read the bundled output and sourcemap
				const bundledCode = await fixture.readFile('dist/index.d.ts', 'utf8');
				const map = await readSourceMap(fixture.getPath('dist/index.d.ts.map'));

				onTestFail(() => {
					console.log('Bundled code:', bundledCode);
					console.log('Sourcemap sources:', map.sources);
					console.log('Sourcemap mappings:', map.mappings);
				});

				// The sourcemap should reference types.ts (where User is defined)
				// not just index.ts (where it's re-exported)
				const hasTypesSource = map.sources.some(s => s?.includes('types.ts'));
				expect(hasTypesSource).toBe(true);

				// Use trace-mapping to verify the User type definition maps to types.ts
				const tracer = new TraceMap(map);

				// Find the line with "type User" in the bundled output
				const lines = bundledCode.split('\n');
				const userLineIndex = lines.findIndex(line => line.includes('type User'));
				expect(userLineIndex).toBeGreaterThanOrEqual(0);

				// Find the column of "User" on that line
				const userLine = lines[userLineIndex]!;
				const userCol = userLine.indexOf('User');
				expect(userCol).toBeGreaterThanOrEqual(0);

				// Look up where "User" maps to in the original source
				// trace-mapping uses 1-based lines, 0-based columns
				const pos = originalPositionFor(tracer, {
					line: userLineIndex + 1,
					column: userCol,
				});

				// The mapping should point to types.ts, not index.ts
				expect(pos.source).toContain('types.ts');
			});

			test('sourcemap paths are relative to chunk directory for subdirectories', async ({ onTestFail }) => {
				// Test that when types are in a subdirectory (like dist/contexts/index.d.ts),
				// the sourcemap correctly chains to original .ts sources with the right relative paths.
				//
				// This test uses MULTIPLE source files to trigger the multi-source remapping
				// code path (not the simple single-source replace path).
				//
				// src/contexts/Provider.ts: defines ProviderProps
				// src/contexts/Consumer.ts: defines ConsumerProps
				// src/contexts/index.ts: re-exports both
				//
				// After bundling to dist/contexts/index.d.ts:
				// - Sources should be .ts files (chained through), NOT .d.ts files
				// - Paths should be "../../src/..." (relative to dist/contexts/),
				//   NOT "../src/..." (relative to dist/)
				//
				// The bug was that rollup-plugin-dts used outputDir (dist/)
				// instead of chunkDir (dist/contexts/)
				// when resolving source paths, causing both:
				// 1. Failed lookup of input sourcemaps (couldn't find the .d.ts.map files)
				// 2. Wrong relative paths in output (one ../ missing)
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
						contexts: {
							'Provider.ts': `export type ProviderProps = {
	enabled: boolean;
	timeout: number;
};
`,
							'Consumer.ts': `export type ConsumerProps = {
	name: string;
	value: number;
};
`,
							'index.ts': `export type { ProviderProps } from './Provider.js';
export type { ConsumerProps } from './Consumer.js';
`,
						},
					},
				});

				onTestFail(() => console.log('Fixture:', fixture.path));

				// Compile with tsc
				await tsc(fixture.path);

				// Run dtsroll
				await dtsroll({
					cwd: fixture.path,
					inputs: [fixture.getPath('dist/contexts/index.d.ts')],
					sourcemap: true,
				});

				// Read the sourcemap
				const map = await readSourceMap(fixture.getPath('dist/contexts/index.d.ts.map'));

				onTestFail(() => {
					console.log('Sourcemap sources:', map.sources);
				});

				// Verify we have multiple sources (triggers multi-source remapping path)
				expect(map.sources.length).toBeGreaterThan(1);

				// Sources should point to original .ts files, NOT intermediate .d.ts files
				// If the bug is present, sources will be like ['Provider.d.ts', 'Consumer.d.ts']
				const hasOriginalTsSources = map.sources.every(
					s => s?.endsWith('.ts') && !s?.endsWith('.d.ts'),
				);
				expect(hasOriginalTsSources).toBe(true);

				// The sourcemap should have paths relative to dist/contexts/
				// From dist/contexts/, we need ../../src/contexts/Provider.ts
				const hasCorrectRelativePaths = map.sources.every(s => s?.startsWith('../../src/'));
				expect(hasCorrectRelativePaths).toBe(true);
			});

			test('sourcemap paths correct when multiple inputs from different subdirectories', async ({ onTestFail }) => {
				// This test exposes the chunkDir vs outputDir bug.
				//
				// When there are multiple inputs from different subdirectories:
				// - inputs: [dist/contexts/index.d.ts, dist/utils/index.d.ts]
				// - getCommonDirectory returns: dist/ (common parent)
				// - outputDir passed to rollup-plugin-dts: dist/
				//
				// For dist/contexts/index.d.ts:
				// - Its sources (Provider.d.ts, Consumer.d.ts) are in dist/contexts/
				// - BUGGY: path.resolve('dist/', 'Provider.d.ts') → dist/Provider.d.ts (WRONG)
				// - FIXED: path.resolve('dist/contexts/', 'Provider.d.ts') → correct path
				//
				// Without the fix, sourcemap chaining fails because the intermediate .d.ts files
				// can't be found at the wrong path, so sources stay as .d.ts instead of .ts files.
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
						contexts: {
							'Provider.ts': 'export type ProviderProps = { enabled: boolean; };',
							'Consumer.ts': 'export type ConsumerProps = { name: string; };',
							'index.ts': "export type { ProviderProps } from './Provider.js'; export type { ConsumerProps } from './Consumer.js';",
						},
						utils: {
							'Formatter.ts': 'export type FormatterOptions = { locale: string; };',
							'Parser.ts': 'export type ParserConfig = { strict: boolean; };',
							'index.ts': "export type { FormatterOptions } from './Formatter.js'; export type { ParserConfig } from './Parser.js';",
						},
					},
				});

				onTestFail(() => console.log('Fixture:', fixture.path));

				// Compile with tsc
				await tsc(fixture.path);

				// Run dtsroll with MULTIPLE inputs from different subdirectories
				// This makes getCommonDirectory return dist/ instead of dist/contexts/
				await dtsroll({
					cwd: fixture.path,
					inputs: [
						fixture.getPath('dist/contexts/index.d.ts'),
						fixture.getPath('dist/utils/index.d.ts'),
					],
					sourcemap: true,
				});

				// Check contexts sourcemap
				const contextsMap = await readSourceMap(fixture.getPath('dist/contexts/index.d.ts.map'));

				onTestFail(() => {
					console.log('contexts sourcemap sources:', contextsMap.sources);
				});

				// Sources should be .ts files, NOT .d.ts files
				// If bug is present: ['Provider.d.ts', 'Consumer.d.ts']
				// If fixed: ['../../src/contexts/Provider.ts', '../../src/contexts/Consumer.ts']
				const contextsHasTsSources = contextsMap.sources.every(
					s => s?.endsWith('.ts') && !s?.endsWith('.d.ts'),
				);
				expect(contextsHasTsSources).toBe(true);

				// Paths should be relative to dist/contexts/ (../../src/...)
				const contextsHasCorrectPaths = contextsMap.sources.every(
					s => s?.startsWith('../../src/contexts/'),
				);
				expect(contextsHasCorrectPaths).toBe(true);

				// Check utils sourcemap
				const utilsMap = await readSourceMap(fixture.getPath('dist/utils/index.d.ts.map'));

				onTestFail(() => {
					console.log('utils sourcemap sources:', utilsMap.sources);
				});

				const utilsHasTsSources = utilsMap.sources.every(
					s => s?.endsWith('.ts') && !s?.endsWith('.d.ts'),
				);
				expect(utilsHasTsSources).toBe(true);

				const utilsHasCorrectPaths = utilsMap.sources.every(
					s => s?.startsWith('../../src/utils/'),
				);
				expect(utilsHasCorrectPaths).toBe(true);
			});
		});
	});
});
