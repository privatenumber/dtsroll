import type { Plugin } from 'vite';
import { logOutput } from './utils/log-output.js';
import { dtsroll, type Options } from './index.js';

const dtsrollPlugin = (
	options?: Options,
): Plugin => {
	let built = false;
	let cwd: string | undefined;
	return {
		name: 'dtsroll',
		apply: 'build',
		enforce: 'post',
		config: ({ root }) => {
			cwd = root;
		},
		writeBundle: {
			sequential: true,
			order: 'post',
			handler: async () => {
				// writeBundle gets triggered for every output format
				if (built) {
					return;
				}

				logOutput(await dtsroll({
					cwd,
					...options,
				}));
				console.log(); // Enter new line to distinguish from other Vite logs

				built = true;
			},
		},
	};
};

export { dtsrollPlugin as dtsroll };
