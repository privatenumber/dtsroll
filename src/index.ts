import path from 'node:path';
import type { OutputChunk } from 'rollup';
import { getPackageJson } from './utils/package-json.js';
import { getCommonDirectory } from './utils/get-common-directory.js';
import { validateInput } from './utils/validate-input.js';
import { build } from './rollup/build.js';
import type { Output, Externals, DtsrollOutput } from './types.js';
import { getPackageName } from './utils/package-name.js';
import { warningPrefix } from './utils/log-output.js';

export type Options = {
	cwd?: string;
	inputs?: string[];
	external?: string[];
	conditions?: string[];
	dryRun?: boolean;
};

export const dtsroll = async ({
	cwd = process.cwd(),
	inputs,
	external,
	conditions,
	dryRun,
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
	);

	let outputSize = 0;
	const outputEntries: Output[] = [];
	const outputChunks: Output[] = [];
	const moduleImports = new Set<string>();
	for (const file of built.output as OutputChunk[]) {
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
