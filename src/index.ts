import path from 'node:path';
import type { OutputChunk } from 'rollup';
import { getPackageJson } from './utils/package-json.ts';
import { getCommonDirectory } from './utils/get-common-directory.ts';
import { validateInput } from './utils/validate-input.ts';
import { build } from './rollup/build.ts';
import type { Output, Externals, DtsrollOutput } from './types.ts';
import { getPackageName } from './utils/package-name.ts';
import { warningPrefix } from './utils/log-output.ts';

/**
 * Configuration options for dtsroll.
 */
export type Options = {

	/** Working directory. Defaults to process.cwd(). */
	cwd?: string;

	/** Input .d.ts files to bundle. If not provided, auto-detects from package.json. */
	inputs?: string[];

	/** Packages to externalize (only used when no package.json is present). */
	external?: string[];

	/** Export conditions for module resolution. */
	conditions?: string[];

	/** If true, generates output without writing files. */
	dryRun?: boolean;

	/** If true, generates source maps (.d.ts.map files). */
	sourcemap?: boolean;
};

/**
 * Bundle TypeScript declaration files using Rollup.
 *
 * @param options - Configuration options
 * @returns Build output including bundled files, sizes, and externalized packages
 */
export const dtsroll = async ({
	cwd = process.cwd(),
	inputs,
	external,
	conditions,
	dryRun,
	sourcemap,
}: Options = {}): Promise<DtsrollOutput> => {
	const pkgJson = await getPackageJson(cwd);

	const externals = pkgJson
		? pkgJson.getExternals()
		: new Map</* package name */ string, /* reason */ string>();

	if (external && external.length > 0) {
		if (pkgJson) {
			console.warn(`${warningPrefix} The --external flag is only supported when there is no package.json`);
		} else {
			for (const externalDependency of external) {
				externals.set(externalDependency, 'by --external flag');
			}
		}
	}

	const manualInput = inputs && inputs.length > 0;
	const validatedInputs = await validateInput(
		manualInput
			? inputs.map(file => path.resolve(file))
			: await pkgJson?.getDtsEntryPoints(),
	);

	const inputFiles = validatedInputs
		.filter(input => !input[2])
		.map(([file]) => file);

	if (inputFiles.length === 0) {
		return {
			inputs: validatedInputs,
			error: 'No input files',
		};
	}

	const outputDirectory = getCommonDirectory(inputFiles);

	const {
		built,
		externalized,
		getPackageEntryPoint,
		sourceSize,
	} = await build(
		inputFiles,
		outputDirectory,
		externals,
		dryRun ? 'generate' : 'write',
		conditions,
		sourcemap,
	);

	let outputSize = 0;
	const outputEntries: Output[] = [];
	const outputChunks: Output[] = [];
	const moduleImports = new Set<string>();
	const chunks = built.output.filter((file): file is OutputChunk => file.type === 'chunk');
	for (const file of chunks) {
		const size = Buffer.byteLength(file.code);
		outputSize += size;

		const moduleToPackage = Object.fromEntries(
			file.moduleIds.map(moduleId => [moduleId, getPackageEntryPoint(moduleId)]),
		);

		const chunkWithSize = Object.assign(file, {
			size,
			moduleToPackage,
		});
		if (chunkWithSize.isEntry) {
			outputEntries.push(chunkWithSize);
		} else {
			outputChunks.push(chunkWithSize);
		}

		/**
		 * There could be file imports here too, but they're hard to distinguish
		 * (e.g. `_dtsroll-chunks/types.d.ts` vs `actual-package`)
		 *
		 * We aggregate them all here and filter later
		 */
		for (const id of file.imports) {
			moduleImports.add(getPackageName(id));
		}
	}

	/**
	 * After the build externalizes modules at the resolution level,
	 * we filter it down against what's actually imported from the
	 * built files
	 */
	const externalPackages: Externals = [];
	moduleImports.forEach((importedSpecifier) => {
		const reason = externalized.get(importedSpecifier);
		if (reason) {
			externalPackages.push([
				importedSpecifier,
				reason,
				pkgJson?.devTypePackages?.[importedSpecifier],
			]);
		}
	});

	return {
		inputs: validatedInputs,
		outputDirectory,
		output: {
			entries: outputEntries,
			chunks: outputChunks,
		},
		size: {
			input: sourceSize,
			output: outputSize,
		},
		externals: externalPackages,
	};
};

export type { DtsrollOutput };
