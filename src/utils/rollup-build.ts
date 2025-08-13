import { rolldown, type RolldownOptions } from 'rolldown';
import { dts } from 'rolldown-plugin-dts'
// import nodeResolve from '@rollup/plugin-node-resolve';
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
	input.map(inputFile => {
		let name = inputFile.slice(outputDirectory.length + 1);

		// if (name.endsWith('.ts')) {
		// 	name = name.slice(0, -'.ts'.length);
		// }
		// else if (name.endsWith('.mts')) {
		// 	name = name.slice(0, -'.mts'.length);
		// }
		// else if (name.endsWith('.cts')) {
		// 	name = name.slice(0, -'.cts'.length);
		// }

		return [
			name,
			inputFile,
		];
	}),
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
			// nodeResolve({
			// 	extensions: ['.ts', ...dtsExtensions],
			// 	exportConditions: conditions,
			// }),
			dts({
				emitDtsOnly: true,
				dtsInput: true,
				// resolve: true,
				// respectExternal: true,

				/**
				 * Setting a tsconfig or compilerOptions shouldn't be necessary since
				 * we're dealing with pre-compiled d.ts files
				 *
				 * But may be something we need to support if we want to support
				 * aliases in the future
				 */
			}),
		],
	} satisfies RolldownOptions;

	const rollupBuild = await rolldown(rollupConfig);
	const built = await rollupBuild[mode](rollupConfig.output);

	console.log({ input });
	
	console.dir(built, { depth: 3, maxArrayLength: null });
	
	
	await rollupBuild.close();

	return {
		built,
		externalized,
		getPackageEntryPoint,
		sourceSize: sizeRef.value!,
	};
};
