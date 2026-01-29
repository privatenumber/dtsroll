import { cli } from 'cleye';
import { bgYellow, black } from 'kolorist';
import { name, version, description } from '../package.json';
import { logOutput } from './utils/log-output.js';
import { dtsroll } from './index.js';

const argv = cli({
	name,
	version,
	help: {
		description,
	},
	strictFlags: true,
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
		sourcemap: {
			type: Boolean,
			alias: 's',
			description: 'Generate sourcemaps',
		},
	},
});

const { flags } = argv;

if (flags.dryRun) {
	console.log(bgYellow(black(' Dry run - No files will be written ')));
}

dtsroll({
	inputs: argv._.inputFiles,
	external: flags.external,
	conditions: flags.conditions,
	dryRun: flags.dryRun,
	sourcemap: flags.sourcemap,
}).then(
	(output) => {
		if ('error' in output) {
			process.exitCode = 1;
		}
		logOutput(output);
	},
).catch(
	(error: unknown) => {
		console.error('\nFailed to build\n');
		console.error(error instanceof Error ? error.message : String(error));

		const importTrace = (error as { importTrace?: string[] }).importTrace;
		if (importTrace && importTrace.length > 1) {
			console.error('\nImport trace:');
			for (const [index, filePath] of importTrace.entries()) {
				const prefix = index === 0 ? '  ' : '  ↳ ';
				console.error(`${prefix}${filePath}`);
			}
		}

		process.exitCode = 1;
	},
);
