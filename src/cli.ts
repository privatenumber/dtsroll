import path from 'node:path';
import { cli } from 'cleye';
import { bgYellow, black, yellow } from 'kolorist';
import { name, version, description } from '../package.json';
import { processPackageJson } from './utils/package-json.js';
import { getCommonDirectory } from './utils/get-common-directory.js';
import { validateInput } from './utils/validate-input.js';
import { build } from './utils/rollup-build.js';
import { logOutput } from './utils/log-output.js';

const argv = cli({
	name,
	version,
	help: {
		description,
	},
	parameters: ['[input files...]'],
	flags: {
		conditions: {
			type: [String],
			alias: 'C',
			description: 'Export conditions',
		},
		dryRun: {
			type: Boolean,
			alias: 'd',
			description: 'Dry run; no files will be written',
		},
		external: {
			type: [String],
			alias: 'e',
			description: 'Dependency to externalize',
		},
		// sourcemap: {
		//     type: Boolean,
		//     description: 'Generate sourcemaps',
		// },
	},
});

const { flags } = argv;

const dryMode = flags.dryRun;
if (dryMode) {
	console.log(bgYellow(black(' Dry run - No files will be written ')));
}

(async () => {
	const externals = new Map</* package name */ string, /* reason */ string>();
	const pkgJson = await processPackageJson(externals);
	if (flags.external.length > 0) {
		if (pkgJson) {
			console.warn(`${yellow('Warning:')} The --external flag is only supported when there is no package.json`);
		} else {
			for (const externalDependency of flags.external) {
				externals.set(externalDependency, 'by --external flag');
			}
		}
	}

	const input = await validateInput(
		argv._.inputFiles.length > 0
			? argv._.inputFiles.map(file => path.resolve(file))
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
		flags.conditions,
		dryMode ? 'generate' : 'write',
	);

	logOutput({
		outputDirectory,
		built,
		externalized,
		sourceSize,
		getPackageEntryPoint,
		getDevTypePackages: pkgJson?.getDevTypePackages,
	});
})().catch((error) => {
	console.error('\nFailed to build:', error.message);
	process.exitCode = 1;
});
