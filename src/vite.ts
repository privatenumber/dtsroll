import type { Plugin } from 'vite';
import { logOutput } from './utils/log-output.js';
import { dtsroll, type Options } from './index.js';

const dtsrollPlugin = (
	options?: Options,
): Plugin => {
	let built = false;
	let cwd: string | undefined;
	let noLog = false;
	return {
		name: 'dtsroll',
		apply: 'build',
		enforce: 'post',
		config: ({ root, logLevel }) => {
			cwd = root;
			noLog = logLevel === 'silent';
		},
		writeBundle: {
			sequential: true,
			order: 'post',
			handler: async () => {
				// writeBundle gets triggered for every output format
				if (built) {
					return;
				}

				const output = await dtsroll({
					cwd,
					...options,
				});

				built = true;

				if (!noLog) {
					logOutput(output);

					// Enter new line to distinguish from other Vite logs
					console.log();
				}
			},
		},
	};
};

export { dtsrollPlugin as dtsroll };
