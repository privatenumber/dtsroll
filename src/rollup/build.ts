import { rollup, type RollupOptions } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import nodeResolve from '@rollup/plugin-node-resolve';
import { dtsExtensions } from '../utils/dts-extensions.js';
import { DtsrollBuildError } from '../types.js';
import { createExternalizePlugin } from './plugins/externalize.js';
import { createImportChainPlugin } from './plugins/import-chain.js';
import { removeBundledModulesPlugin } from './plugins/remove-bundled-modules.js';
import { resolveSubpathImportsPlugin } from './plugins/resolve-subpath-imports.js';

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

	const { plugin: importChainPlugin, getImportChain } = createImportChainPlugin();

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
			importChainPlugin,
			externalizePlugin,
			removeBundledModulesPlugin(outputDirectory, sizeRef),
			resolveSubpathImportsPlugin(),
			nodeResolve({
				extensions: ['.ts', ...dtsExtensions],
				exportConditions: conditions,
			}),
			dts({
				respectExternal: true,

				/**
				 * Setting a tsconfig or compilerOptions shouldn't be necessary since
				 * we're dealing with pre-compiled d.ts files
				 *
				 * But may be something we need to support if we want to support
				 * aliases in the future
				 */
			}),
		],
	} satisfies RollupOptions;

	try {
		const rollupBuild = await rollup(rollupConfig);
		const built = await rollupBuild[mode](rollupConfig.output);

		await rollupBuild.close();

		return {
			built,
			externalized,
			getPackageEntryPoint,
			sourceSize: sizeRef.value ?? 0,
		};
	} catch (error) {
		if (error instanceof Error && 'id' in error && typeof error.id === 'string') {
			throw new DtsrollBuildError(
				error.message,
				error.id,
				getImportChain(error.id),
			);
		}
		throw error;
	}
};
