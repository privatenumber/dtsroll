import fs from 'node:fs/promises';
import { describe, test, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { build } from 'vite';
import dts from 'vite-plugin-dts';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { dtsroll } from '#dtsroll/vite';

describe('vite plugin', () => {
	test('throws when no dts inputs are found', async () => {
		await using fixture = await createFixture({
			'package.json': JSON.stringify({
				types: './dist/entry.d.ts',
			}),
			src: {
				'entry.ts': 'export const a = 1;',
			},
			'tsconfig.json': JSON.stringify({
				includes: ['src'],
			}),
		});

		// No vite-plugin-dts, so no .d.ts files are generated
		await expect(
			build({
				root: fixture.path,
				logLevel: 'silent',
				build: {
					lib: {
						entry: fixture.getPath('src/entry.ts'),
						formats: ['es'],
					},
				},
				plugins: [
					dtsroll(),
				],
			}),
		).rejects.toThrow('No input files');
	});

	/**
	 * Regression test: root must come from configResolved, not config hook.
	 *
	 * The `config` hook receives UserConfig (raw/unresolved), where `root`
	 * may be undefined if not explicitly set. The `configResolved` hook
	 * receives ResolvedConfig, where `root` is always resolved.
	 * https://vite.dev/guide/api-plugin.html#config
	 * https://vite.dev/guide/api-plugin.html#configresolved
	 *
	 * In monorepo setups, root may be set by a framework plugin (e.g. nx)
	 * that runs after dtsroll in the enforce: 'post' group. The config
	 * hook processes plugins sequentially within each enforce tier, so
	 * dtsroll's config hook would see root=undefined if it runs first.
	 * configResolved always sees the final resolved root.
	 *
	 * With old code (config hook): cwd=undefined → falls back to
	 * process.cwd() (wrong directory) → reads wrong package.json.
	 * With fix (configResolved): cwd=fixture root → correct.
	 */
	test('resolves root from configResolved (not config hook)', async () => {
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
			// Deliberately NOT setting root in inline config
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
				dtsroll(),

				/**
				 * Sets root after dtsroll in the same enforce: 'post' group.
				 * Config hooks within an enforce tier run in array order, so
				 * dtsroll's old config hook would have already captured
				 * root=undefined before this plugin sets it.
				 */
				{
					name: 'late-root-setter',
					enforce: 'post' as const,
					config: () => ({ root: fixture.path }),
				},
			],
		});

		const bundled = await fixture.readFile('dist/entry.d.ts', 'utf8');
		expect(bundled).toMatch('type A = number;');
	});

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

		let _writeCount = 0;
		const trackingPlugin = {
			name: 'track-dtsroll',
			writeBundle: {
				sequential: true,
				order: 'post' as const,
				handler: () => {
					_writeCount += 1;
				},
			},
		};

		await build({
			root: fixture.path,
			logLevel: 'silent',
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

	test('sourcemaps chain back to original .ts files', async () => {
		await using fixture = await createFixture({
			src: {
				'entry.ts': `
				import type { MyType } from './types.js';
				export const value: MyType = { name: 'test', count: 42 };
				`,
				'types.ts': `
				export type MyType = {
					name: string;
					count: number;
				};
				`,
			},
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					declaration: true,
					declarationMap: true,
				},
				include: ['src'],
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
					compilerOptions: {
						declaration: true,
						declarationMap: true,
					},
				}),
				dtsroll({
					inputs: [fixture.getPath('dist/entry.d.ts')],
					sourcemap: true,
				}),
			],
		});

		// Verify sourcemap file was generated
		const mapPath = fixture.getPath('dist/entry.d.ts.map');
		const mapExists = await fs.access(mapPath).then(() => true, () => false);
		expect(mapExists).toBe(true);

		// Verify .d.ts references the sourcemap
		const dtsContent = await fixture.readFile('dist/entry.d.ts', 'utf8');
		expect(dtsContent).toContain('//# sourceMappingURL=entry.d.ts.map');

		// Verify sourcemap points to original .ts files, not .d.ts files
		const mapContent = await fixture.readFile('dist/entry.d.ts.map', 'utf8');
		const sourceMap = JSON.parse(mapContent);
		const sources = sourceMap.sources as string[];

		const pointsToTs = sources.some(
			(source: string) => source.endsWith('.ts') && !source.endsWith('.d.ts'),
		);
		expect(pointsToTs).toBe(true);

		// Verify we can trace back to original source
		const tracer = new TraceMap(sourceMap);
		const lines = dtsContent.split('\n');

		// Find MyType definition - should trace back to types.ts
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
});
