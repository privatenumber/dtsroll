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

const dryMode = flags.dryRun;
if (dryMode) {
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
		console.error('\nFailed to build:', error.message);
		process.exitCode = 1;
	},
);
