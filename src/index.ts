import path from 'node:path';
import { yellow } from 'kolorist';
import type { OutputChunk } from 'rollup';
import { getPackageJson } from './utils/package-json.js';
import { getCommonDirectory } from './utils/get-common-directory.js';
import { validateInput } from './utils/validate-input.js';
import { build } from './utils/rollup-build.js';
import type { Output, Externals, DtsrollOutput } from './types.js';
import { getPackageName } from './utils/package-name.js';

export type Options = {
	inputs?: string[];
	external?: string[];
	conditions?: string[];
	dryRun?: boolean;
};

export const dtsroll = async ({
	inputs,
	external,
	conditions,
	dryRun,
}: Options): Promise<DtsrollOutput> => {
	const pkgJson = await getPackageJson();

	const externals = pkgJson
		? pkgJson.getExternals()
		: new Map</* package name */ string, /* reason */ string>();

	if (external && external.length > 0) {
		if (pkgJson) {
			console.warn(`${yellow('Warning:')} The --external flag is only supported when there is no package.json`);
		} else {
			for (const externalDependency of external) {
				externals.set(externalDependency, 'by --external flag');
			}
		}
	}

	const input = await validateInput(
		inputs && inputs.length > 0
			? inputs.map(file => path.resolve(file))
			: pkgJson?.getDtsEntryPoints(),
	);

	const outputDirectory = getCommonDirectory(input);

	const {
		built,
		externalized,
		getPackageEntryPoint,
		sourceSize,
	} = await build(
		input,
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
