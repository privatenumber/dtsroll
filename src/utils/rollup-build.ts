import { rollup, type RollupOptions } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import nodeResolve from '@rollup/plugin-node-resolve';
import { dtsExtensions } from './dts-extensions.js';
import { createExternalizePlugin } from './rollup-plugin-externalize.js';
import { removeBundledModulesPlugin } from './rollup-plugin-remove-bundled-modules.js';

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
			// sourcemap: true,
			dir: outputDirectory,
			entryFileNames: '[name]',
			chunkFileNames: '_dtsroll-chunks/[hash]-[name].ts',
		},

		plugins: [
			externalizePlugin,
			removeBundledModulesPlugin(outputDirectory, sizeRef),
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

	const rollupBuild = await rollup(rollupConfig);
	const built = await rollupBuild[mode](rollupConfig.output);

	await rollupBuild.close();

	return {
		built,
		externalized,
		getPackageEntryPoint,
		sourceSize: sizeRef.value!,
	};
};
