import { rollup, type RollupOptions } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import nodeResolve from '@rollup/plugin-node-resolve';
import { importTrace } from 'rollup-plugin-import-trace';
import ts from 'typescript';
import { dtsExtensions } from '../utils/dts-extensions.ts';
import { createExternalizePlugin } from './plugins/externalize.ts';
import { removeBundledModulesPlugin } from './plugins/remove-bundled-modules.ts';
import { resolveSubpathImportsPlugin } from './plugins/resolve-subpath-imports.ts';

/**
 * Input array is converted to an object because rollup-plugin-dts has a bug
 * where it normalizes input paths but doesn't account for duplicate file names
 * across nested directories:
 * https://github.com/Swatinem/rollup-plugin-dts/blob/32ba006c6148778d90422095fdf1f4c5b8a91ef3/src/index.ts#L99-L107
 */
const createInputMap = (
	input: string[],
	outputDirectory: string,
) => Object.fromEntries(
	input.map(inputFile => [
		inputFile.slice(outputDirectory.length + 1),
		inputFile,
	]),
);

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

	const sizeRef: { value?: number } = {};
	const rollupConfig = {
		input: createInputMap(input, outputDirectory),

		output: {
			sourcemap,
			dir: outputDirectory,
			entryFileNames: '[name]',
			chunkFileNames: '_dtsroll-chunks/[hash]-[name].ts',
		},

		plugins: [
			importTrace(),
			externalizePlugin,
			removeBundledModulesPlugin(outputDirectory, sizeRef),
			resolveSubpathImportsPlugin(),
			nodeResolve({
				extensions: ['.ts', ...dtsExtensions],
				exportConditions: conditions,
			}),
			dts({
				respectExternal: true,
				sourcemap,
				compilerOptions: {
					/**
					 * TS6 changed the default moduleResolution from node10 to bundler.
					 * rollup-plugin-dts uses ts.resolveModuleName with whatever compilerOptions
					 * are passed, and bundler resolution picks .js files over directories
					 * containing .d.ts files (e.g. utils.js over utils/index.d.ts).
					 *
					 * Since dtsroll operates on compiled .d.ts output, node10 resolution
					 * is correct: it prioritizes .d.ts files and directory index lookups.
					 */
					moduleResolution: ts.ModuleResolutionKind.Node10,
				},
			}),
		],
	} satisfies RollupOptions;

	const rollupBuild = await rollup(rollupConfig);
	const built = await rollupBuild[mode](rollupConfig.output);

	await rollupBuild.close();

	return {
		built,
		externalized,
		getPackageEntryPoint,
		sourceSize: sizeRef.value ?? 0,
	};
};
