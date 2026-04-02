import path from 'node:path';
import fs from 'node:fs/promises';
import {
	rollup, type RollupOptions, type OutputChunk, type OutputBundle,
} from 'rollup';
import { dts } from 'rollup-plugin-dts';
import nodeResolve from '@rollup/plugin-node-resolve';
import { importTrace } from 'rollup-plugin-import-trace';
import { dtsExtensions } from '../utils/dts-extensions.ts';
import { createExternalizePlugin } from './plugins/externalize.ts';
import { resolveSubpathImportsPlugin } from './plugins/resolve-subpath-imports.ts';

const nodeModulesSegment = `${path.sep}node_modules${path.sep}`;

/**
 * Each entry point is bundled in a separate Rollup build rather than
 * a single multi-entry build. This avoids generating shared chunk files
 * in `_dtsroll-chunks/` — instead, shared types are inlined into each
 * entry that uses them.
 *
 * Why: Rollup's default code-splitting creates chunks for modules shared
 * across entry points. These chunks aren't listed in the package's
 * `exports` map, so TypeScript's declaration emit considers them "not
 * portable" and raises TS2742/TS2883 in downstream packages that
 * re-export types. This affects `moduleResolution` modes NodeNext,
 * Node16, and Bundler — virtually all modern TypeScript projects.
 *
 * The trade-off is type duplication: if a large type is shared across
 * many entries, each entry's output includes its own copy. In practice,
 * type declarations are small (a few hundred bytes), so inlining
 * produces smaller output than chunks (which add import/export
 * boilerplate). Only with very large shared types (50+ fields) across
 * 5+ entries does chunk-based output become smaller — and even then
 * the difference is a few KB of build-time-only .d.ts files.
 *
 * Other benefits of per-entry builds:
 * - Simpler output structure (no internal `_dtsroll-chunks/` directory)
 * - Better sourcemaps (each entry maps directly to all source files)
 * - No user intervention needed (no manual exports modification)
 */
export const build = async (
	input: string[],
	outputDirectory: string,
	externals: Map<string, string>,
	mode: 'generate' | 'write',
	conditions?: string[],
	sourcemap?: boolean,
) => {
	const {
		externalizePlugin,
		externalized,
		getPackageEntryPoint,
	} = createExternalizePlugin(externals);

	const allOutputChunks: OutputChunk[] = [];

	/**
	 * Track bundled module sizes across all builds, deduplicating by
	 * module ID so shared modules aren't counted multiple times.
	 */
	const moduleSizes = new Map<string, number>();
	const allBundledModuleIds = new Set<string>();

	for (const inputFile of input) {
		const entryName = inputFile.slice(outputDirectory.length + 1);

		/**
		 * Externalize other entry points so cross-entry imports are
		 * preserved as relative imports (e.g. `import { T } from './a'`).
		 * These relative paths point to entries in the package's exports
		 * map, making them portable for downstream declaration emit.
		 */
		const otherEntryPaths = new Set(input
			.filter(file => file !== inputFile)
			.map(file => path.resolve(file)));

		const rollupConfig = {
			input: { [entryName]: inputFile },

			output: {
				sourcemap,
				dir: outputDirectory,
				entryFileNames: '[name]',
			},

			plugins: [
				importTrace(),

				// Externalize other entry points
				{
					name: 'externalize-entries',
					resolveId(source: string, importer: string | undefined) {
						if (!importer) {
							return null;
						}
						const resolved = path.resolve(path.dirname(importer), source);
						for (const extension of ['', '.d.ts', '.d.cts', '.d.mts', '.ts']) {
							if (otherEntryPaths.has(resolved + extension)) {
								return {
									id: source,
									external: true,
								};
							}
						}
						return null;
					},
				},

				externalizePlugin,

				// Track module sizes for input size reporting
				{
					name: 'track-module-sizes',
					transform: {
						order: 'pre' as const,
						handler: (code: string) => ({ meta: { size: Buffer.byteLength(code) } }),
					},
					generateBundle(
						_options: unknown,
						bundle: OutputBundle,
					) {
						for (const chunk of Object.values(bundle)) {
							if (chunk.type !== 'chunk') {
								continue;
							}
							for (const moduleId of chunk.moduleIds) {
								allBundledModuleIds.add(moduleId);
								if (!moduleSizes.has(moduleId)) {
									const moduleInfo = this.getModuleInfo(moduleId);
									const size = moduleInfo?.meta?.size;
									if (typeof size === 'number') {
										moduleSizes.set(moduleId, size);
									}
								}
							}
						}
					},
				},

				resolveSubpathImportsPlugin(),
				nodeResolve({
					extensions: ['.ts', ...dtsExtensions],
					exportConditions: conditions,
				}),
				dts({
					respectExternal: true,
					sourcemap,
				}),
			],
		} satisfies RollupOptions;

		const rollupBuild = await rollup(rollupConfig);
		const built = await rollupBuild[mode](rollupConfig.output);

		for (const chunk of built.output) {
			if (chunk.type === 'chunk') {
				allOutputChunks.push(chunk);
			}
		}

		await rollupBuild.close();
	}

	let sourceSize = 0;
	for (const size of moduleSizes.values()) {
		sourceSize += size;
	}

	/**
	 * Delete bundled source files after ALL builds complete.
	 * This is deferred because the same source file may be
	 * processed by multiple per-entry builds.
	 */
	if (mode === 'write') {
		const outputFiles = new Set(
			allOutputChunks.map(chunk => path.join(outputDirectory, chunk.fileName)),
		);

		const deleteFiles = [...allBundledModuleIds].filter(moduleId => (
			moduleId
			&& moduleId.startsWith(outputDirectory)
			&& !moduleId.includes(nodeModulesSegment)
			&& !outputFiles.has(moduleId)
		));

		await Promise.all(
			deleteFiles.flatMap(moduleId => [
				fs.rm(moduleId),
				fs.rm(`${moduleId}.map`, { force: true }),
			]),
		);
	}

	return {
		built: { output: allOutputChunks },
		externalized,
		getPackageEntryPoint,
		sourceSize,
	};
};
