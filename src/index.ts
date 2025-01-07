import path from 'node:path';
import { yellow } from 'kolorist';
import { processPackageJson } from './utils/package-json.js';
import { getCommonDirectory } from './utils/get-common-directory.js';
import { validateInput } from './utils/validate-input.js';
import { build } from './utils/rollup-build.js';
import { logOutput } from './utils/log-output.js';

type Options = {
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
}: Options) => {
	const pkgJson = await processPackageJson();

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

	logOutput({
		outputDirectory,
		built,
		externalized,
		sourceSize,
		getPackageEntryPoint,
		getDevTypePackages: pkgJson?.getDevTypePackages,
	});
};
