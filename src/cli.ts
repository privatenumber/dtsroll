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
		// sourcemap: {
		//	 type: Boolean,
		//	 description: 'Generate sourcemaps',
		// },
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
}).then(
	(output) => {
		if ('error' in output) {
			process.exitCode = 1;
		}
		logOutput(output);
	},
	(error) => {
		let errorMessage = '\nFailed to build';
		if (error.id) {
			errorMessage += `\n  File: ${error.id}`;
		}
		if (error.importChain && error.importChain.length > 1) {
			errorMessage += '\n\n  Import chain:\n    ';
			errorMessage += error.importChain.join('\n    → ');
		}
		errorMessage += `\n\n${error.message}`;
		console.error(errorMessage);
		process.exitCode = 1;
	},
);
